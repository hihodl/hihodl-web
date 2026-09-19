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
  // The server's own arithmetic, to the sixth decimal it writes (offerFigures).
  const figures = cents !== null && cents > 0 ? offerFigures(cents, feeBps, feePayer) : null;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col items-center gap-2 text-center">
        <span className={fieldLabel}>{label}</span>
        <span className="flex items-baseline justify-center gap-1 tabular-nums">
          <span className="text-[52px] font-strong leading-none tracking-[-0.035em] text-white/60 sm:text-[60px]" aria-hidden>
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
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-[52px] font-strong leading-none tracking-[-0.035em] text-text caret-amber outline-none placeholder:text-white/25 disabled:opacity-60 sm:text-[60px]"
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
          <span className="ml-1 text-[18px] font-medium text-white/60">USDC</span>
        </span>
        {hint && <span className="text-small text-[#CFE3EC]">{hint}</span>}
      </label>
      <div id="offer-amount-figures" aria-live="polite">
        <TotalRow
          label="You pay if accepted"
          totalUsdc={figures?.sponsorPaysUsdc ?? null}
          note={feeBps > 0 ? `includes ${feePercent(feeBps)} HOLD fee` : null}
          info={
            <InfoTip label="About the fee">
              HOLD&rsquo;s {feePercent(feeBps)} fee is only charged if your {label.toLowerCase().includes("bid") ? "bid" : "offer"}{" "}
              is accepted and paid. Nothing is paid now.
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
  const thing = opts.kind === "bid" ? "bid" : "offer";
  if (cents === null || cents <= 0) return `Type your ${thing} in dollars, like 300 or 300.50.`;
  if (opts.aboveCents != null && cents <= opts.aboveCents) {
    return `A raise has to be more than your last ${thing} of $${usdcFromCents(opts.aboveCents)}.`;
  }
  if (opts.counterCents != null && cents >= opts.counterCents) {
    return `That's the counter-offer of $${usdcFromCents(opts.counterCents)} or more. To pay the counter, accept it instead of raising.`;
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
        ? `Highest ${money(highest)} · next bid from ${money(minimum)}`
        : `No bids yet · bidding opens at ${money(minimum)}`
      : belowCents !== null
        ? `Listed at ${money(belowCents)} · offers from ${money(minimum)}`
        : `Offers from ${money(minimum)}`;

  const footer = sent ? null : (
    <>
      <button type="submit" form="offer-form" className={ctaPrimary} disabled={busy}>
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
      <p className="flex items-center justify-center gap-2 text-center text-tiny text-white/60">
        Nothing is paid now.
        <InfoTip label="What happens next">
          Nothing is paid and nothing is locked. If @{handle} accepts your {thing}, you have 24 hours to pay it from any
          wallet, straight to the creator. Neither of you is bound to go ahead.
        </InfoTip>
      </p>
    </>
  );

  return (
    <PaySheet
      labelledBy="offer-title"
      eyebrow={kind === "bid" ? "Place a bid" : "Make an offer"}
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

          {/* On a ladder an amount only means something next to the rung it
              is for: "$900" says nothing unless it says $900 for the
              interview. The creator's own lines, printed as text. */}
          {perks.length > 0 && (
            <ul className="flex flex-col gap-1.5 px-1">
              {perks.slice(0, 3).map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-small text-[#CFE3EC] [overflow-wrap:anywhere]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[3px] bg-white/40" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className={fieldLabel}>{kind === "bid" ? "Name or brand, shown if you lead" : "Name or brand"}</span>
              <input
                className={sheetInput}
                value={name}
                maxLength={OFFER_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme"
                autoComplete="organization"
                disabled={busy}
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2">
                <span className={fieldLabel} id="offer-contact-label">
                  Where we send the answer
                </span>
                <InfoTip label="Who sees your contact">
                  {contactKind === "email"
                    ? "Only the creator sees it. We email you the link to this offer with every change."
                    : "Only the creator sees it. We don't message X or Telegram: the link you get next is how you follow it."}
                </InfoTip>
              </span>
              <div className="flex items-stretch overflow-hidden rounded-[14px] bg-black/25 ring-1 ring-inset ring-white/[0.08] focus-within:ring-amber/60">
                <select
                  aria-label="Contact type"
                  value={contactKind}
                  onChange={(e) => {
                    setContactKind(e.target.value as ContactKind);
                    setNotice(null);
                  }}
                  disabled={busy}
                  className="shrink-0 cursor-pointer appearance-none border-r border-white/[0.08] bg-white/[0.05] py-3 pl-4 pr-8 text-small font-medium text-text outline-none"
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
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-body text-text outline-none placeholder:text-white/30"
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
                  <span className={fieldLabel}>Message to @{handle}</span>
                  <span className={`text-tiny ${message.length > OFFER_MESSAGE_MAX ? "text-amber" : "text-white/60"}`}>
                    {message.length}/{OFFER_MESSAGE_MAX}
                  </span>
                </span>
                <textarea
                  className={`${sheetInput} min-h-[88px] resize-y`}
                  value={message}
                  maxLength={OFFER_MESSAGE_MAX}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="We launch on day 2 and would love the front of the suitcase."
                  disabled={busy}
                  autoFocus
                />
              </label>
            ) : (
              <button
                type="button"
                className="self-start px-1 text-small font-medium text-amber hover:text-amber-glow"
                onClick={() => setWantsMessage(true)}
              >
                + Add a message
              </button>
            )}
          </div>

          <section
            ref={verifyRef}
            className="flex scroll-mb-4 flex-col gap-4 rounded-[18px] p-4 ring-1 ring-inset ring-white/[0.10]"
            aria-labelledby="verify-title"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span id="verify-title" className="text-body font-medium text-text">
                  Verify you can pay
                </span>
                {kind !== "bid" && <span className="text-tiny text-white/60">Optional</span>}
                <InfoTip label="About verifying">
                  {kind === "bid"
                    ? "A bid counts only if a wallet of yours holds what you'd pay. "
                    : "A verified offer shows the creator a Funds checked badge and goes to the top of their list. "}
                  You sign a message: it costs nothing and moves no money. We only read that wallet&rsquo;s USDC.
                </InfoTip>
              </span>
              {!wantsCheck && (
                <button type="button" className={`${ctaGlass} h-10 px-4`} onClick={openCheck}>
                  Verify
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
  const { offer } = sent;
  const bid = offer.kind === "bid";
  const handle = space.creator.xHandle;
  const cents = usdcToCents(offer.amountUsdc);
  const shown = cents !== null ? usdFromCents(cents) : `${offer.amountUsdc} USDC`;
  const spaceUrl = `${SITE_URL}/s/${encodeURIComponent(handle)}/${encodeURIComponent(space.slug)}`;
  const shareText = `I just ${bid ? "bid" : "offered"} ${shown} for @${handle}'s ${what} 👇`;
  // Nothing is paid on sending, so nothing is earned yet: the promise is for
  // paying it with HOLD once accepted (spaces-sponsor-points-v0.md).
  const points = pointsForOfferAmount(offer.amountUsdc, space, offer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <PaidMark />
        <p className="text-[40px] font-medium leading-none tracking-[-0.02em] tabular-nums text-text">
          {dollars(offer.amountUsdc) ?? `${offer.amountUsdc} USDC`}
        </p>
        <p className="text-body text-text">
          {bid ? (offer.leading ? "You're the highest bid." : "Your bid is in.") : `Your offer is with @${handle}.`}
        </p>
        <p className="max-w-sm text-small text-white/60">
          {offer.status === "countered" && offer.counterUsdc
            ? `@${handle} already answered with ${dollars(offer.counterUsdc) ?? offer.counterUsdc}: open your link to accept, raise or withdraw.`
            : bid
              ? "Still highest when bidding ends and accepted? You have 24 hours to pay."
              : "The creator has 48 hours to accept, counter or decline."}
        </p>
        {offer.sponsor.backed ? (
          <p className="flex items-center gap-1.5 text-small text-success">
            <Tick /> Funds checked
          </p>
        ) : (
          sent.proofSent && (
            <p className="max-w-sm text-small text-amber">
              We couldn&rsquo;t confirm the USDC in that wallet, so it went in without the Funds checked badge.
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
        body={points !== null ? `${earnPointsLine(points)} if it's accepted.` : undefined}
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
