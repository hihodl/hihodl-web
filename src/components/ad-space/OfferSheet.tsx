"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { CheckoutError, describeError } from "@/lib/ad-space/checkout-client";
import { CONTACT_KINDS, CONTACT_PLACEHOLDER, contactProblem, normaliseContact } from "@/lib/ad-space/contact";
import { CONTACT_KIND_LABEL, isSessionSpace, serviceName, usdFromCents } from "@/lib/ad-space/format";
import {
  OFFER_MAX_CENTS,
  OFFER_MESSAGE_MAX,
  OFFER_NAME_MAX,
  type SavedOffer,
  describeOfferError,
  minimumCents,
  offerFigures,
  offerModeOf,
  offerNamesPosition,
  offerPath,
  offerToken,
  offersFor,
  parseUsdToCents,
  rememberOffer,
  submitOffer,
  usdcFromCents,
  usdcToCents,
} from "@/lib/ad-space/offers-client";
import { earnPointsLine, pointsForOfferAmount } from "@/lib/ad-space/points";
import type { ContactKind, OfferKind, OfferView, Position, Space } from "@/lib/ad-space/types";
import { t as tNow } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { AppPrompt } from "./AppPrompt";
import { Spinner } from "./checkout-parts";
import { type CheckedFunds, FundsCheck, usableProof } from "./FundsCheck";
import {
  CreatorChip,
  InfoTip,
  PaidMark,
  PaySheet,
  SheetNotice,
  Tick,
  TotalRow,
  ctaGlass,
  ctaPrimary,
  dollars,
  feePercent,
  fieldLabel,
  payChainsOf,
  sheetInput,
} from "./pay-sheet";
import { btnSmallSecondary } from "./ui";

/**
 * Making an offer or a bid from the public page, with no HOLD account
 * (hispace-offers-v0.md). Nothing about the app is asked before sending; it is
 * offered afterwards, next to the manage link.
 *
 * The amount the sponsor types is the creator's side, before our fee, which is
 * what `amountCents` means in the contract. Under the input the page says what
 * the wallet would pay and what the creator would receive.
 *
 * No red: problems are amber and say what to do next.
 */

/* ── The amount, with what it comes to ───────────────────────────────── */

/**
 * Whether a refusal leaves the funds check that went with it spent. The server
 * consumes the nonce before it reads the balance, so a failure on its side
 * after that (`chain_unavailable`, or any 5xx) spent it too.
 */
export function proofSpent(err: unknown): boolean {
  if (!(err instanceof CheckoutError)) return false;
  return (
    ["proof_invalid", "proof_expired", "bid_needs_backing", "chain_unavailable"].includes(err.code) || err.status >= 500
  );
}

export function AmountField({
  label,
  value,
  onChange,
  feeBps,
  feePayer,
  creatorHandle: _creatorHandle,
  hint,
  disabled = false,
  kind,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  creatorHandle: string;
  hint?: string | null;
  disabled?: boolean;
  /** Offer or bid, for the fee's line. Without it, read from an English label. */
  kind?: OfferKind;
}) {
  const t = useT();
  const bidKind = kind ? kind === "bid" : label.toLowerCase().includes("bid");
  const cents = parseUsdToCents(value);
  // The server's own arithmetic, to the sixth decimal it writes (offerFigures).
  const figures = cents !== null && cents > 0 ? offerFigures(cents, feeBps, feePayer) : null;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col items-center gap-2 text-center">
        <span className={fieldLabel}>{label}</span>
        <span className="flex items-baseline justify-center gap-1 tabular-nums">
          <span className="text-[52px] font-strong leading-none tracking-[-0.035em] text-white/85 sm:text-[60px]" aria-hidden>
            $
          </span>
          {/* A mirror of the value sizes the input, so the amount stays centred as it is typed. */}
          <span className="inline-grid">
            <span
              className="invisible col-start-1 row-start-1 whitespace-pre text-[52px] font-strong leading-none tracking-[-0.035em] sm:text-[60px]"
              aria-hidden
            >
              {value || "0"}
            </span>
            <input
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-[52px] font-strong leading-none tracking-[-0.035em] text-sp-ink caret-amber outline-none placeholder:text-white/45 disabled:opacity-60 sm:text-[60px]"
              size={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              disabled={disabled}
              aria-describedby="offer-amount-figures"
            />
          </span>
          <span className="ml-1 text-[18px] font-medium text-white/85">USDC</span>
        </span>
        {hint && <span className="text-small text-[#CFE3EC]">{hint}</span>}
      </label>
      <div id="offer-amount-figures" aria-live="polite">
        <TotalRow
          label={t("offers.sheet.youPayIfAccepted")}
          totalUsdc={figures?.sponsorPaysUsdc ?? null}
          note={feeBps > 0 ? t("offers.sheet.includesFee", { fee: feePercent(feeBps) }) : null}
          info={
            <InfoTip label={t("offers.sheet.aboutFee")}>
              {t("offers.sheet.aboutFeeBody", { fee: feePercent(feeBps), kind: bidKind ? "bid" : "offer" })}
            </InfoTip>
          }
        />
      </div>
    </div>
  );
}

/** What is wrong with an amount, in words, or null when it can be sent. */
export function amountProblem(
  cents: number | null,
  opts: {
    kind: OfferKind;
    minimum: number;
    belowCents: number | null;
    aboveCents?: number | null;
    /** The creator's standing counter: a raise stays under it (`raise_not_below_counter`). */
    counterCents?: number | null;
  },
): string | null {
  const kind = opts.kind === "bid" ? "bid" : "offer";
  if (cents === null || cents <= 0) return tNow("offers.sheet.problem.typeAmount", { kind });
  if (opts.aboveCents != null && cents <= opts.aboveCents) {
    return tNow("offers.sheet.problem.raiseAbove", { kind, amount: `$${usdcFromCents(opts.aboveCents)}` });
  }
  if (opts.counterCents != null && cents >= opts.counterCents) {
    return tNow("offers.sheet.problem.counterOrMore", { amount: `$${usdcFromCents(opts.counterCents)}` });
  }
  if (cents < opts.minimum) {
    return opts.kind === "bid"
      ? tNow("offers.sheet.problem.nextBid", { amount: `$${usdcFromCents(opts.minimum)}` })
      : tNow("offers.sheet.problem.offerStarts", { amount: usdFromCents(opts.minimum) });
  }
  if (cents > OFFER_MAX_CENTS) return tNow("offers.sheet.problem.tooHigh", { amount: usdFromCents(OFFER_MAX_CENTS) });
  if (opts.belowCents !== null && cents >= opts.belowCents) {
    return tNow("offers.sheet.problem.listedOrMore", { amount: `$${usdcFromCents(opts.belowCents)}` });
  }
  return null;
}

/* ── The sheet ────────────────────────────────────────────────────────── */

type Sent = { offer: OfferView; token: string | null; manageUrl: string; proofSent: boolean };

export function OfferSheet({
  space,
  position,
  kind,
  now,
  onClose,
  onSent,
}: {
  space: Space;
  /**
   * The spot, or null on an untiered service space, where an offer targets the
   * space and any free slot will do. A rung of a ladder is always named.
   */
  position: Position | null;
  kind: OfferKind;
  now: number | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useT();
  const session = isSessionSpace(space);
  const offers = offersFor(space, position);
  const mode = offerModeOf(space, position);
  const handle = space.creator.xHandle;
  const what = position?.label ?? serviceName(space);
  /** What this rung gives the brand, on a tiered space. Empty on every other. */
  const perks = position?.perks ?? [];
  const minimum = minimumCents(kind, session, offers);
  // On a fixed price that also takes offers, an offer must be under the price.
  const priceCents = position?.priceCents ?? (space.kind === "service" ? space.positions[0]?.priceCents ?? null : null);
  const belowCents = mode === "fixed_with_offers" ? priceCents : null;

  const [amount, setAmount] = useState(() => {
    if (kind !== "bid") return "";
    const next = usdcToCents(offers?.nextMinimumBidUsdc ?? offers?.openingBidUsdc ?? null);
    return next !== null ? usdcFromCents(next).replace(/,/g, "").replace(/\.00$/, "") : "";
  });
  const [name, setName] = useState("");
  const [contactKind, setContactKind] = useState<ContactKind>("email");
  const [contactValue, setContactValue] = useState("");
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState<CheckedFunds | null>(null);
  const [wantsCheck, setWantsCheck] = useState(kind === "bid");
  const [wantsMessage, setWantsMessage] = useState(false);
  const verifyRef = useRef<HTMLElement>(null);
  const openCheck = () => {
    setWantsCheck(true);
    // Once it has rendered, bring the wallets into view.
    window.setTimeout(() => verifyRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  };
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  /** One submission at a time, whatever the button's state says. */
  const sending = useRef(false);

  const amountCents = parseUsdToCents(amount);
  const thing = kind === "bid" ? "bid" : "offer";

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending.current || sent) return;
    setNotice(null);

    const problem =
      amountProblem(amountCents, { kind, minimum, belowCents }) ??
      (name.trim().length === 0
        ? t("offers.sheet.problem.name")
        : name.trim().length > OFFER_NAME_MAX
          ? t("offers.sheet.problem.nameMax", { max: OFFER_NAME_MAX })
          : null) ??
      contactProblem(contactKind, contactValue, `@${handle}`) ??
      (message.trim().length > OFFER_MESSAGE_MAX ? t("offers.sheet.problem.messageMax", { max: OFFER_MESSAGE_MAX }) : null);
    if (problem) return setNotice(problem);

    const proofOk = usableProof(checked, amountCents, now);
    if (kind === "bid" && !proofOk) {
      setWantsCheck(true);
      return setNotice(t("offers.sheet.problem.bidBacked"));
    }

    sending.current = true;
    setBusy(true);
    try {
      const res = await submitOffer({
        spaceId: space.id,
        // A tier is named; an untiered service's identical slots are not.
        ...(position && offerNamesPosition(space) ? { positionId: position.id } : {}),
        amountCents: amountCents!,
        sponsorName: name.trim(),
        contact: { kind: contactKind, value: normaliseContact(contactKind, contactValue) },
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(proofOk && checked ? { proof: checked.proof } : {}),
      });
      const token = offerToken(res.manageUrl);
      if (token) {
        const entry: SavedOffer = {
          token,
          kind: res.offer.kind,
          positionId: res.offer.positionId,
          label: res.offer.positionLabel ?? what,
          amountUsdc: res.offer.amountUsdc,
          at: res.offer.createdAt,
        };
        rememberOffer(space.id, entry);
      }
      setSent({ offer: res.offer, token, manageUrl: res.manageUrl, proofSent: proofOk });
      onSent();
    } catch (err) {
      setNotice(
        describeOfferError(err, { kind, chain: checked?.proof.chain ?? null, subject: session ? "session" : "spot" }) ??
          describeError(err, checked?.proof.chain ?? null, session ? "session" : "spot"),
      );
      // A proof is single use and bound to its amount: after these it is spent.
      // So is one the server consumed before a balance read or anything else
      // failed on its side (`chain_unavailable`, any 5xx): check again.
      if (proofSpent(err) && (checked || (err instanceof CheckoutError && err.code === "bid_needs_backing"))) {
        setChecked(null);
        setWantsCheck(true);
      }
      sending.current = false;
    } finally {
      setBusy(false);
    }
  }

  const money = (c: number) => usdFromCents(c);
  const highest = usdcToCents(offers?.highestBidUsdc ?? null);
  const hint =
    kind === "bid"
      ? highest !== null
        ? t("offers.sheet.hint.highest", { highest: money(highest), minimum: money(minimum) })
        : t("offers.sheet.hint.noBids", { minimum: money(minimum) })
      : belowCents !== null
        ? t("offers.sheet.hint.listed", { price: money(belowCents), minimum: money(minimum) })
        : t("offers.sheet.hint.offersFrom", { minimum: money(minimum) });

  const footer = sent ? null : (
    <>
      <button type="submit" form="offer-form" className={ctaPrimary} disabled={busy}>
        {busy ? (
          <>
            <Spinner />
            {t("offers.sheet.sending")}
          </>
        ) : kind === "bid" ? (
          t("offers.sheet.placeBid")
        ) : (
          t("offers.sheet.sendOffer")
        )}
      </button>
      <p className="flex items-center justify-center gap-2 text-center text-tiny text-white/85">
        {t("offers.sheet.nothingPaid")}
        <InfoTip label={t("offers.sheet.whatNext")}>{t("offers.sheet.whatNextBody", { handle, kind: thing })}</InfoTip>
      </p>
    </>
  );

  return (
    <PaySheet
      labelledBy="offer-title"
      eyebrow={kind === "bid" ? t("offers.sheet.eyebrowBid") : t("offers.sheet.eyebrowOffer")}
      title={what}
      onClose={onClose}
      footer={footer}
    >
      {sent ? (
        <OfferSent sent={sent} space={space} what={what} />
      ) : (
        <form id="offer-form" onSubmit={send} className="flex flex-col gap-5" noValidate>
          <div className="flex justify-center pt-1">
            <CreatorChip creator={space.creator} />
          </div>
          <AmountField
            label={kind === "bid" ? t("offers.sheet.yourBid") : t("offers.sheet.yourOffer")}
            kind={kind}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setNotice(null);
            }}
            feeBps={space.feeBps}
            feePayer={space.feePayer}
            creatorHandle={handle}
            hint={hint}
            disabled={busy}
          />

          {/* On a ladder an amount only means something next to the rung it
              is for: "$900" says nothing unless it says $900 for the
              interview. The creator's own lines, printed as text. */}
          {perks.length > 0 && (
            <ul className="flex flex-col gap-1.5 px-1">
              {perks.slice(0, 3).map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-small text-[#CFE3EC] [overflow-wrap:anywhere]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[3px] bg-sp-ink/40" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className={fieldLabel}>{kind === "bid" ? t("offers.sheet.nameBid") : t("offers.sheet.name")}</span>
              <input
                className={sheetInput}
                value={name}
                maxLength={OFFER_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("offers.sheet.namePlaceholder")}
                autoComplete="organization"
                disabled={busy}
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2">
                <span className={fieldLabel} id="offer-contact-label">
                  {t("offers.sheet.contactLabel")}
                </span>
                <InfoTip label={t("offers.sheet.whoSeesContact")}>
                  {contactKind === "email" ? t("offers.sheet.contactEmail") : t("offers.sheet.contactHandle")}
                </InfoTip>
              </span>
              <div className="flex items-stretch overflow-hidden rounded-[14px] bg-black/25 ring-1 ring-inset ring-sp-ink/[0.08] focus-within:ring-amber/60">
                <select
                  aria-label={t("offers.sheet.contactType")}
                  value={contactKind}
                  onChange={(e) => {
                    setContactKind(e.target.value as ContactKind);
                    setNotice(null);
                  }}
                  disabled={busy}
                  className="shrink-0 cursor-pointer appearance-none border-r border-sp-ink/[0.08] bg-sp-ink/[0.05] py-3 pl-4 pr-8 text-small font-medium text-sp-ink outline-none"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5l3 3 3-3' stroke='%23ffffff99' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                  }}
                >
                  {CONTACT_KINDS.map((k) => (
                    <option key={k} value={k} className="bg-[#0A1921]">
                      {CONTACT_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-body text-sp-ink outline-none placeholder:text-white/45"
                  aria-labelledby="offer-contact-label"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={CONTACT_PLACEHOLDER[contactKind]}
                  inputMode={contactKind === "email" ? "email" : "text"}
                  autoComplete={contactKind === "email" ? "email" : "off"}
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                />
              </div>
            </div>

            {wantsMessage || message ? (
              <label className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={fieldLabel}>{t("offers.sheet.messageTo", { handle })}</span>
                  <span className={`text-tiny ${message.length > OFFER_MESSAGE_MAX ? "text-sp-amber" : "text-white/85"}`}>
                    {fmtNumber(message.length)}/{fmtNumber(OFFER_MESSAGE_MAX)}
                  </span>
                </span>
                <textarea
                  className={`${sheetInput} min-h-[88px] resize-y`}
                  value={message}
                  maxLength={OFFER_MESSAGE_MAX}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("offers.sheet.messagePlaceholder")}
                  disabled={busy}
                  autoFocus
                />
              </label>
            ) : (
              <button
                type="button"
                className="self-start px-1 text-small font-medium text-sp-amber hover:text-amber-glow"
                onClick={() => setWantsMessage(true)}
              >
                {t("offers.sheet.addMessage")}
              </button>
            )}
          </div>

          <section
            ref={verifyRef}
            className="flex scroll-mb-4 flex-col gap-4 rounded-[18px] p-4 ring-1 ring-inset ring-sp-ink/[0.10]"
            aria-labelledby="verify-title"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span id="verify-title" className="text-body font-medium text-sp-ink">
                  {t("offers.sheet.verifyTitle")}
                </span>
                {kind !== "bid" && <span className="text-tiny text-white/85">{t("common.optional")}</span>}
                <InfoTip label={t("offers.sheet.aboutVerifying")}>{t("offers.sheet.aboutVerifyingBody", { kind: thing })}</InfoTip>
              </span>
              {!wantsCheck && (
                <button type="button" className={`${ctaGlass} h-10 px-4`} onClick={openCheck}>
                  {t("offers.sheet.verify")}
                </button>
              )}
            </div>
            {wantsCheck && (
              <FundsCheck
                spaceId={space.id}
                positionId={position && offerNamesPosition(space) ? position.id : null}
                chains={payChainsOf(space)}
                amountCents={amountCents}
                kind={kind}
                checked={checked}
                onChecked={setChecked}
                now={now}
                disabled={busy}
              />
            )}
          </section>

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

function OfferSent({ sent, space, what }: { sent: Sent; space: Space; what: string }) {
  const t = useT();
  const { offer } = sent;
  const bid = offer.kind === "bid";
  const handle = space.creator.xHandle;
  const cents = usdcToCents(offer.amountUsdc);
  const shown = cents !== null ? usdFromCents(cents) : `${offer.amountUsdc} USDC`;
  const spaceUrl = `${SITE_URL}/s/${encodeURIComponent(handle)}/${encodeURIComponent(space.slug)}`;
  const shareText = t("offers.sent.shareText", { kind: bid ? "bid" : "offer", amount: shown, handle, what });
  // Nothing is paid on sending, so nothing is earned yet: the promise is for
  // paying it with HOLD once accepted (spaces-sponsor-points-v0.md).
  const points = pointsForOfferAmount(offer.amountUsdc, space, offer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <PaidMark />
        <p className="text-[40px] font-medium leading-none tracking-[-0.02em] tabular-nums text-sp-ink">
          {dollars(offer.amountUsdc) ?? `${offer.amountUsdc} USDC`}
        </p>
        <p className="text-body text-sp-ink">
          {bid ? (offer.leading ? t("offers.sent.highest") : t("offers.sent.bidIn")) : t("offers.sent.offerWith", { handle })}
        </p>
        <p className="max-w-sm text-small text-white/85">
          {offer.status === "countered" && offer.counterUsdc
            ? t("offers.sent.countered", { handle, amount: dollars(offer.counterUsdc) ?? offer.counterUsdc })
            : bid
              ? t("offers.sent.bidNext")
              : t("offers.sent.offerNext")}
        </p>
        {offer.sponsor.backed ? (
          <p className="flex items-center gap-1.5 text-small text-sp-ok">
            <Tick /> {t("offers.sent.fundsChecked")}
          </p>
        ) : (
          sent.proofSent && (
            <p className="max-w-sm text-small text-sp-amber">
              {t("offers.sent.notConfirmed")}
            </p>
          )
        )}
      </div>

      <OfferLinkBox token={sent.token} manageUrl={sent.manageUrl} kind={offer.kind} />

      <AppPrompt
        title={
          bid ? t("offers.sent.appPromptBid") : t("offers.sent.appPromptOffer")
        }
        body={points !== null ? t("offers.sent.pointsIfAccepted", { points: earnPointsLine(points) }) : undefined}
      />

      <ShareButton text={shareText} url={spaceUrl} />
    </div>
  );
}

/**
 * The manage link, in full, with a copy button. A sponsor with no account has
 * no other way back to their offer, so it says so.
 */
export function OfferLinkBox({ token, manageUrl, kind }: { token: string | null; manageUrl: string; kind: OfferKind }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(token ? `${SITE_URL}${offerPath(token)}` : manageUrl);
  useEffect(() => {
    if (token) setLink(`${window.location.origin}${offerPath(token)}`);
  }, [token]);
  const thing = kind === "bid" ? "bid" : "offer";

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
    <div className="flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/[0.06] p-4">
      <p className="text-body text-sp-ink">{t("offers.link.save")}</p>
      <p className="text-small text-sp-ink/85">{t("offers.link.body", { kind: thing })}</p>
      <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 py-2 font-mono text-tiny text-sp-ink">
        {link}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSmallSecondary} onClick={() => void copy()}>
          {copied ? t("common.copied") : t("offers.link.copy")}
        </button>
        {token && (
          <a href={offerPath(token)} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
            {t("offers.link.open")}
          </a>
        )}
      </div>
    </div>
  );
}

function ShareButton({ text, url }: { text: string; url: string }) {
  const t = useT();
  const [native, setNative] = useState(false);
  useEffect(() => setNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  if (native) {
    return (
      <div>
        <button
          type="button"
          className={btnSmallSecondary}
          onClick={() => {
            navigator.share({ text, url }).catch(() => {
              // Closed the share sheet: nothing to do.
            });
          }}
        >
          {t("offers.share.native")}
        </button>
      </div>
    );
  }
  return (
    <div>
      <a href={intent} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
        {t("offers.share.x")}
      </a>
    </div>
  );
}
