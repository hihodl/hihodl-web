"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { CheckoutError, describeError } from "@/lib/ad-space/checkout-client";
import { CONTACT_KINDS, CONTACT_PLACEHOLDER, contactProblem, normaliseContact } from "@/lib/ad-space/contact";
import { CONTACT_KIND_LABEL, isSessionSpace, usdFromCents } from "@/lib/ad-space/format";
import {
  OFFER_MAX_CENTS,
  OFFER_MESSAGE_MAX,
  OFFER_NAME_MAX,
  type SavedOffer,
  describeOfferError,
  minimumCents,
  offerFigures,
  offerModeOf,
  offerPath,
  offerToken,
  offersFor,
  parseUsdToCents,
  rememberOffer,
  submitOffer,
  usdcFromCents,
  usdcToCents,
} from "@/lib/ad-space/offers-client";
import type { ContactKind, OfferKind, OfferView, Position, Space } from "@/lib/ad-space/types";

import { AppPrompt } from "./AppPrompt";
import { Spinner } from "./checkout-parts";
import { type CheckedFunds, FundsCheck, usableProof } from "./FundsCheck";
import { btnPrimary, btnSmallSecondary, eyebrow, input } from "./ui";

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

export function AmountField({
  label,
  value,
  onChange,
  feeBps,
  feePayer,
  creatorHandle,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  creatorHandle: string;
  hint?: string | null;
  disabled?: boolean;
}) {
  const cents = parseUsdToCents(value);
  const figures = cents !== null && cents > 0 ? offerFigures(cents, feeBps, feePayer) : null;
  const pct = `${feeBps / 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="text-small text-text-muted">{label}</span>
        <span className="relative flex items-center">
          <span className="pointer-events-none absolute left-4 text-body text-text-faint" aria-hidden>
            $
          </span>
          <input
            className={`${input} pl-8 font-mono`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            disabled={disabled}
            aria-describedby="offer-amount-figures"
          />
        </span>
      </label>
      {hint && <p className="text-tiny text-text-faint">{hint}</p>}
      <dl
        id="offer-amount-figures"
        className="grid grid-cols-2 gap-3 rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-3"
        aria-live="polite"
      >
        <div>
          <dt className="text-tiny text-text-faint">You pay</dt>
          <dd className="mt-0.5 font-mono text-small text-text">
            {figures ? `$${usdcFromCents(figures.sponsorPaysCents)}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-tiny text-text-faint">@{creatorHandle} receives</dt>
          <dd className="mt-0.5 font-mono text-small text-text">
            {figures ? `$${usdcFromCents(figures.creatorReceivesCents)}` : "—"}
          </dd>
        </div>
        <div className="col-span-2 text-tiny text-text-faint">
          {feePayer === "sponsor"
            ? `You pay HOLD's ${pct} on top, in USDC, only if the offer is accepted and you pay it.`
            : `HOLD's ${pct} comes out of what the creator receives, only if the offer is accepted and paid.`}
        </div>
      </dl>
    </div>
  );
}

/** What is wrong with an amount, in words, or null when it can be sent. */
export function amountProblem(
  cents: number | null,
  opts: { kind: OfferKind; minimum: number; belowCents: number | null; aboveCents?: number | null },
): string | null {
  const thing = opts.kind === "bid" ? "bid" : "offer";
  if (cents === null || cents <= 0) return `Type your ${thing} in dollars, like 300 or 300.50.`;
  if (opts.aboveCents != null && cents <= opts.aboveCents) {
    return `A raise has to be more than your last ${thing} of $${usdcFromCents(opts.aboveCents)}.`;
  }
  if (cents < opts.minimum) {
    return opts.kind === "bid"
      ? `The next bid has to be at least $${usdcFromCents(opts.minimum)}.`
      : `An offer starts at ${usdFromCents(opts.minimum)}.`;
  }
  if (cents > OFFER_MAX_CENTS) return `That's more than any spot can cost (${usdFromCents(OFFER_MAX_CENTS)}).`;
  if (opts.belowCents !== null && cents >= opts.belowCents) {
    return `That's the listed price or more, so use Buy now instead. An offer has to be under $${usdcFromCents(opts.belowCents)}.`;
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
  /** The spot, or null on a service space, where an offer targets the space. */
  position: Position | null;
  kind: OfferKind;
  now: number | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const session = isSessionSpace(space);
  const offers = offersFor(space, position);
  const mode = offerModeOf(space, position);
  const handle = space.creator.xHandle;
  const what = position?.label ?? space.template.name;
  const minimum = minimumCents(kind, session, offers);
  // On a fixed price that also takes offers, an offer must be under the price.
  const priceCents = position?.priceCents ?? (space.kind === "service" ? space.positions[0]?.priceCents ?? null : null);
  const belowCents = mode === "fixed_with_offers" ? priceCents : null;

  const [amount, setAmount] = useState(() => {
    if (kind !== "bid") return "";
    const next = usdcToCents(offers?.nextMinimumBidUsdc ?? offers?.openingBidUsdc ?? null);
    return next !== null ? usdcFromCents(next).replace(/,/g, "") : "";
  });
  const [name, setName] = useState("");
  const [contactKind, setContactKind] = useState<ContactKind>("email");
  const [contactValue, setContactValue] = useState("");
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState<CheckedFunds | null>(null);
  const [wantsCheck, setWantsCheck] = useState(kind === "bid");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  /** One submission at a time, whatever the button's state says. */
  const sending = useRef(false);

  const amountCents = parseUsdToCents(amount);
  const thing = kind === "bid" ? "bid" : "offer";

  /* Escape closes, and the page behind does not scroll. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending.current || sent) return;
    setNotice(null);

    const problem =
      amountProblem(amountCents, { kind, minimum, belowCents }) ??
      (name.trim().length === 0
        ? "Add the name the creator will see."
        : name.trim().length > OFFER_NAME_MAX
          ? `A name is up to ${OFFER_NAME_MAX} characters.`
          : null) ??
      contactProblem(contactKind, contactValue, `@${handle}`) ??
      (message.trim().length > OFFER_MESSAGE_MAX ? `Keep the message to ${OFFER_MESSAGE_MAX} characters.` : null);
    if (problem) return setNotice(problem);

    const proofOk = usableProof(checked, amountCents, now);
    if (kind === "bid" && !proofOk) {
      setWantsCheck(true);
      return setNotice("A bid has to be backed: check your funds for this amount first.");
    }

    sending.current = true;
    setBusy(true);
    try {
      const res = await submitOffer({
        spaceId: space.id,
        ...(position && space.kind !== "service" ? { positionId: position.id } : {}),
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
      if (err instanceof CheckoutError && ["proof_invalid", "proof_expired", "bid_needs_backing"].includes(err.code)) {
        setChecked(null);
        setWantsCheck(true);
      }
      sending.current = false;
    } finally {
      setBusy(false);
    }
  }

  const hint =
    kind === "bid"
      ? offers?.highestBidUsdc
        ? `Highest bid ${offers.highestBidUsdc} USDC. The next bid has to be at least ${usdcFromCents(minimum)} USDC.`
        : `No bids yet. Bidding opens at ${usdcFromCents(minimum)} USDC.`
      : belowCents !== null
        ? `Listed at $${usdcFromCents(belowCents)}. An offer goes from ${usdFromCents(minimum)} to just under that.`
        : `Offers start at ${usdFromCents(minimum)}. The creator can accept, counter or decline.`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-title"
    >
      <button type="button" aria-label="Close" className="absolute inset-0 bg-abyss/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-card border border-[color:var(--color-hairline-strong)] bg-night shadow-2xl sm:m-6 sm:max-w-lg sm:rounded-card">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--color-hairline)] bg-night/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className={`${eyebrow} text-amber`}>{kind === "bid" ? "Bid" : "Make an offer"}</p>
            <h2 id="offer-title" className="mt-1 truncate text-body text-text">
              {what}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] text-text-muted hover:bg-white/5 hover:text-text"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-6">
          {sent ? (
            <OfferSent sent={sent} space={space} what={what} />
          ) : (
            <form onSubmit={send} className="flex flex-col gap-6" noValidate>
              <AmountField
                label={kind === "bid" ? "Your bid" : "Your offer"}
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

              <label className="flex flex-col gap-2">
                <span className="text-small text-text-muted">
                  Your name or your brand&rsquo;s{kind === "bid" ? ", shown publicly if you lead" : ""}
                </span>
                <input
                  className={input}
                  value={name}
                  maxLength={OFFER_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme"
                  autoComplete="organization"
                  disabled={busy}
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-small text-text-muted">How we tell you the answer</legend>
                <div className="flex flex-wrap gap-2">
                  {CONTACT_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setContactKind(k);
                        setNotice(null);
                      }}
                      aria-pressed={contactKind === k}
                      disabled={busy}
                      className={`inline-flex h-10 items-center whitespace-nowrap rounded-[20px] border px-4 text-small transition-colors duration-180 ${
                        contactKind === k
                          ? "border-amber bg-amber/10 text-text"
                          : "border-[color:var(--color-hairline-strong)] text-text-muted hover:text-text"
                      }`}
                    >
                      {CONTACT_KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                <input
                  className={`${input} mt-2`}
                  aria-label={`Your ${CONTACT_KIND_LABEL[contactKind]}`}
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={CONTACT_PLACEHOLDER[contactKind]}
                  inputMode={contactKind === "email" ? "email" : "text"}
                  autoComplete={contactKind === "email" ? "email" : "off"}
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                />
                <p className="text-tiny text-text-faint">
                  {contactKind === "email"
                    ? "We email you the link to this offer with every change. Only the creator sees your contact."
                    : "Only the creator sees your contact. We don't message X or Telegram: the link you get next is how you follow the offer."}
                </p>
              </fieldset>

              <label className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between gap-3 text-small text-text-muted">
                  <span>Message to @{handle} (optional)</span>
                  <span className={`text-tiny ${message.length > OFFER_MESSAGE_MAX ? "text-amber" : "text-text-faint"}`}>
                    {message.length}/{OFFER_MESSAGE_MAX}
                  </span>
                </span>
                <textarea
                  className={`${input} min-h-[88px] resize-y`}
                  value={message}
                  maxLength={OFFER_MESSAGE_MAX}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="We launch on day 2 and would love the front of the suitcase."
                  disabled={busy}
                />
              </label>

              <section className="flex flex-col gap-3 border-t border-[color:var(--color-hairline)] pt-5">
                <div>
                  <h3 className="text-body text-text">Check my funds{kind === "bid" ? "" : " (optional)"}</h3>
                  <p className="mt-1 text-small text-text-muted">
                    {kind === "bid"
                      ? "A bid counts only if a wallet of yours holds what you would pay. Sign a message with it; nothing moves."
                      : "An offer from a wallet that holds the money shows the creator a Funds checked badge and goes to the top of their list."}
                  </p>
                </div>
                {wantsCheck ? (
                  <FundsCheck
                    spaceId={space.id}
                    positionId={position && space.kind !== "service" ? position.id : null}
                    chains={space.chains}
                    amountCents={amountCents}
                    kind={kind}
                    checked={checked}
                    onChecked={setChecked}
                    now={now}
                    disabled={busy}
                  />
                ) : (
                  <div>
                    <button type="button" className={btnSmallSecondary} onClick={() => setWantsCheck(true)}>
                      Check my funds
                    </button>
                  </div>
                )}
              </section>

              {notice && (
                <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
                  {notice}
                </p>
              )}

              <div className="flex flex-col gap-3">
                <button type="submit" className={btnPrimary} disabled={busy}>
                  {busy ? (
                    <>
                      <Spinner />
                      Sending…
                    </>
                  ) : kind === "bid" ? (
                    "Place my bid"
                  ) : (
                    "Send my offer"
                  )}
                </button>
                <p className="text-tiny leading-relaxed text-text-faint">
                  Nothing is paid now and nothing is locked. If @{handle} accepts your {thing}, you have 24 hours to pay
                  it from any wallet, directly to the creator. Neither of you is bound to go ahead.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── After sending ────────────────────────────────────────────────────── */

function OfferSent({ sent, space, what }: { sent: Sent; space: Space; what: string }) {
  const { offer } = sent;
  const bid = offer.kind === "bid";
  const handle = space.creator.xHandle;
  const cents = usdcToCents(offer.amountUsdc);
  const shown = cents !== null ? usdFromCents(cents) : `${offer.amountUsdc} USDC`;
  const spaceUrl = `${SITE_URL}/s/${encodeURIComponent(handle)}/${encodeURIComponent(space.slug)}`;
  const shareText = `I just ${bid ? "bid" : "offered"} ${shown} for @${handle}'s ${what} 👇`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`${eyebrow} text-success`}>{bid ? "Bid placed" : "Offer sent"}</p>
        <h3 className="mt-2 font-display text-h3 font-light text-text">
          {bid ? (offer.leading ? "You're the highest bid." : "Your bid is in.") : "Your offer is with @" + handle + "."}
        </h3>
        <p className="mt-3 text-small text-text-muted">
          {bid ? "You bid" : "You offered"} <span className="font-mono text-text">{offer.amountUsdc} USDC</span>
          {offer.sponsorPaysUsdc !== offer.amountUsdc && (
            <>
              {" "}
              (you would pay <span className="font-mono text-text">{offer.sponsorPaysUsdc} USDC</span> with the fee)
            </>
          )}
          .{" "}
          {offer.status === "countered" && offer.counterUsdc
            ? `@${handle} has already answered with ${offer.counterUsdc} USDC: open your link to accept it, raise or withdraw.`
            : bid
              ? "If you're still the highest when bidding ends and the creator accepts, you have 24 hours to pay."
              : "The creator has 48 hours to accept, counter or decline."}
        </p>
        {offer.sponsor.backed ? (
          <p className="mt-2 text-small text-success">Funds checked.</p>
        ) : (
          sent.proofSent && (
            <p className="mt-2 text-small text-amber">
              We couldn&rsquo;t confirm the USDC in that wallet, so your offer went in without the Funds checked
              badge.
            </p>
          )
        )}
      </div>

      <OfferLinkBox token={sent.token} manageUrl={sent.manageUrl} kind={offer.kind} />

      <AppPrompt
        title={
          bid
            ? "Get notified the moment someone outbids you: follow it in HOLD"
            : "Get notified the moment the creator answers: follow it in HOLD"
        }
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
      <p className="text-body text-text">Save this link</p>
      <p className="text-small text-text-muted">
        It is your {thing}: where you see the creator&rsquo;s answer, accept a counter-offer, raise, withdraw, and pay
        if it&rsquo;s accepted. This browser keeps it too. Anyone with it can manage your {thing}, so keep it to
        yourself.
      </p>
      <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.04] px-3 py-2 font-mono text-tiny text-text">
        {link}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSmallSecondary} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy the link"}
        </button>
        {token && (
          <a href={offerPath(token)} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
            Open it
          </a>
        )}
      </div>
    </div>
  );
}

function ShareButton({ text, url }: { text: string; url: string }) {
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
          Share it
        </button>
      </div>
    );
  }
  return (
    <div>
      <a href={intent} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
        Share on X
      </a>
    </div>
  );
}
