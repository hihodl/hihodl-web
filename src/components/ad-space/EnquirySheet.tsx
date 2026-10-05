"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  ENQUIRY_APP_MESSAGE_MAX,
  ENQUIRY_COMPANY_MAX,
  ENQUIRY_EMAIL_MAX,
  ENQUIRY_NAME_MAX,
  ENQUIRY_TOKEN_RE,
  ENQUIRY_WEB_MESSAGE_MAX,
  describeEnquiryError,
  enquiryPath,
  enquiryToken,
  guestFormProblem,
  messageProblem,
  rememberEnquiry,
  sendAppEnquiry,
  sendGuestEnquiry,
} from "@/lib/ad-space/enquiries";
import { canAskAbout } from "@/lib/ad-space/enquiry-rules";
import type { Position, Space } from "@/lib/ad-space/types";
import { HoldApiError } from "@/lib/app/hold-api";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { productUrl } from "@/lib/app/paths";
import { useCreatorSession } from "@/lib/creator/session";

import { businessOf, sellerName } from "./business";
import { Spinner } from "./checkout-parts";
import { CreatorChip, PaidMark, PaySheet, SheetNotice, ctaGlass, ctaPrimary, fieldLabel, sheetInput } from "./pay-sheet";

/**
 * "Ask about this spot" and "Ask the seller" (spot-enquiries-contract.md).
 *
 * Built like the offer sheet. A visitor with a HOLD session on this origin
 * asks from their account: the question becomes a note in their Payment
 * Thread with the seller, and the sheet says the conversation continues in
 * HOLD. Anybody else fills in a name, an optional company and an email, and
 * gets a guest thread at /e/<token>; the seller's replies are announced by
 * email with a fresh link.
 *
 * `website` is the honeypot the contract asks for: an input people never see
 * (off screen, out of the tab order, hidden from assistive tech, no
 * autofill). A form-filling bot fills it; the API then answers exactly like a
 * success and writes nothing.
 */

type Sent = { kind: "web"; token: string | null; threadUrl: string } | { kind: "app"; peerUserId: string };

export function EnquirySheet({
  space,
  position,
  heldByMe = null,
  onClose,
  onSent,
}: {
  space: Space;
  /** The spot asked about, or null for the space as a whole. */
  position: Position | null;
  /** The spot this browser's own checkout holds, which can still be asked about. */
  heldByMe?: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useT();
  const seller = sellerName(space.creator);
  const business = businessOf(space.creator);
  const { session } = useCreatorSession();
  /** Set when a session turned out to be dead mid-send: the guest form from then on. */
  const [forceGuest, setForceGuest] = useState(false);
  const inApp = !!session && !forceGuest;
  const max = inApp ? ENQUIRY_APP_MESSAGE_MAX : ENQUIRY_WEB_MESSAGE_MAX;

  // Only spots still for sale are offered; a question about a sold one goes to the whole space.
  const spots = space.positions.filter((p) => canAskAbout(p, heldByMe));
  const [positionId, setPositionId] = useState<string>(position && canAskAbout(position, heldByMe) ? position.id : "");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const sending = useRef(false);

  const picked = spots.find((p) => p.id === positionId) ?? null;
  const what = picked?.label ?? t("enquiries.ask.whole");

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending.current || sent) return;
    setNotice(null);
    const problem = inApp ? messageProblem(message, max) : guestFormProblem({ name, company, email, message });
    if (problem) return setNotice(problem);

    sending.current = true;
    setBusy(true);
    try {
      if (inApp) {
        const res = await sendAppEnquiry(space.id, { positionId: picked?.id ?? null, message: message.trim() });
        setSent({ kind: "app", peerUserId: res.peerUserId });
      } else {
        const res = await sendGuestEnquiry(space.id, {
          positionId: picked?.id ?? null,
          name: name.trim(),
          ...(company.trim() ? { company: company.trim() } : {}),
          email: email.trim(),
          message: message.trim(),
          website,
        });
        const token = typeof res.token === "string" && ENQUIRY_TOKEN_RE.test(res.token) ? res.token : enquiryToken(res.threadUrl);
        if (token) rememberEnquiry(space.id, { token, label: picked?.label ?? null, at: new Date().toISOString() });
        setSent({ kind: "web", token, threadUrl: res.threadUrl });
      }
      onSent();
    } catch (err) {
      if (inApp && err instanceof HoldApiError && err.status === 401) {
        // The stored session is gone: the guest form takes over, nothing was sent.
        setForceGuest(true);
        setNotice(t("enquiries.error.signedOut"));
      } else {
        setNotice(describeEnquiryError(err, max));
      }
      sending.current = false;
    } finally {
      setBusy(false);
    }
  }

  const footer = sent ? null : (
    <>
      <button type="submit" form="enquiry-form" className={ctaPrimary} disabled={busy}>
        {busy ? (
          <>
            <Spinner />
            {t("enquiries.sheet.sending")}
          </>
        ) : (
          t("enquiries.sheet.send")
        )}
      </button>
      <p className="text-center text-tiny text-white/85">
        {inApp ? t("enquiries.sheet.inApp", { seller }) : t("enquiries.sheet.emailHint", { seller })}
      </p>
    </>
  );

  return (
    <PaySheet labelledBy="enquiry-title" eyebrow={t("enquiries.sheet.eyebrow")} title={space.title} onClose={onClose} footer={footer}>
      {sent ? (
        <EnquirySent sent={sent} seller={seller} />
      ) : (
        <form id="enquiry-form" onSubmit={send} className="flex flex-col gap-5" noValidate>
          <div className="flex justify-center pt-1">
            <CreatorChip creator={space.creator} />
          </div>

          {spots.length > 0 && (
            <label className="flex flex-col gap-2">
              <span className={fieldLabel}>{t("enquiries.sheet.about")}</span>
              <select
                className={`${sheetInput} cursor-pointer appearance-none`}
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                disabled={busy}
              >
                <option value="" className="bg-[#0A1921]">
                  {t("enquiries.ask.whole")}
                </option>
                {spots.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0A1921]">
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!inApp && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-2">
                <span className={fieldLabel}>{t("enquiries.sheet.name")}</span>
                <input
                  className={sheetInput}
                  value={name}
                  maxLength={ENQUIRY_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("enquiries.sheet.namePlaceholder")}
                  autoComplete="name"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="flex items-baseline gap-2">
                  <span className={fieldLabel}>{t("enquiries.sheet.company")}</span>
                  <span className="text-tiny text-white/85">{t("common.optional")}</span>
                </span>
                <input
                  className={sheetInput}
                  value={company}
                  maxLength={ENQUIRY_COMPANY_MAX}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t("enquiries.sheet.companyPlaceholder")}
                  autoComplete="organization"
                  disabled={busy}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={fieldLabel}>{t("enquiries.sheet.email")}</span>
                <input
                  className={sheetInput}
                  type="email"
                  value={email}
                  maxLength={ENQUIRY_EMAIL_MAX}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("enquiries.sheet.emailPlaceholder")}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3">
              <span className={fieldLabel}>{t("enquiries.sheet.message")}</span>
              <span className={`text-tiny ${message.length > max ? "text-sp-amber" : "text-white/85"}`}>
                {fmtNumber(message.length)}/{fmtNumber(max)}
              </span>
            </span>
            <textarea
              className={`${sheetInput} min-h-[132px] resize-y`}
              value={message}
              maxLength={max}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("enquiries.sheet.messagePlaceholder")}
              disabled={busy}
              aria-describedby="enquiry-what"
            />
            <span id="enquiry-what" className="sr-only">
              {what}
            </span>
          </label>

          {inApp && business && <p className="text-tiny text-white/85">{t("enquiries.sheet.teamReads", { seller })}</p>}

          {/* The honeypot. People never see or reach it; bots fill it. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          {notice && (
            <SheetNotice>
              <p>{notice}</p>
            </SheetNotice>
          )}
        </form>
      )}
    </PaySheet>
  );
}

/* ── After sending ────────────────────────────────────────────────────── */

function EnquirySent({ sent, seller }: { sent: Sent; seller: string }) {
  const t = useT();
  if (sent.kind === "app") {
    const href = productUrl(`/payments?thread=${encodeURIComponent(`peer:${sent.peerUserId}`)}`);
    return (
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <PaidMark />
        <p className="text-h4 font-medium text-sp-ink">{t("enquiries.sent.inAppTitle")}</p>
        <p className="max-w-sm text-small text-white/85">{t("enquiries.sent.inAppBody", { seller })}</p>
        <a href={href} className={`${ctaPrimary} mt-2`}>
          {t("enquiries.sent.openInApp")}
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <PaidMark />
        <p className="text-h4 font-medium text-sp-ink">{t("enquiries.sent.title")}</p>
        <p className="max-w-sm text-small text-white/85">{t("enquiries.sent.body", { seller })}</p>
      </div>
      <ThreadLinkBox token={sent.token} threadUrl={sent.threadUrl} />
    </div>
  );
}

/** The conversation link in full, with copy and open. A guest has no other way back before the first reply. */
function ThreadLinkBox({ token, threadUrl }: { token: string | null; threadUrl: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(threadUrl);
  useEffect(() => {
    if (token) setLink(`${window.location.origin}${enquiryPath(token)}`);
  }, [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-sp-ink/[0.06] p-4">
      <p className="text-small text-sp-ink/85">{t("enquiries.sent.keep")}</p>
      <p className="break-all rounded-[12px] bg-black/25 px-3 py-2 font-mono text-tiny text-sp-ink">{link}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={ctaGlass} onClick={() => void copy()}>
          {copied ? t("common.copied") : t("enquiries.sent.copy")}
        </button>
        {token && (
          <a href={enquiryPath(token)} rel="noreferrer" className={ctaGlass}>
            {t("enquiries.sent.open")}
          </a>
        )}
      </div>
    </div>
  );
}
