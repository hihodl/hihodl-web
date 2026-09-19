"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { CheckoutError, describeError, existingCheckoutKey } from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL, CONTACT_KIND_LABEL, instantIn, instantUtc, isSessionSpace, timeLeft } from "@/lib/ad-space/format";
import {
  OFFER_STALE_CODES,
  type RespondBody,
  describeOfferError,
  getOfferClient,
  minimumCents,
  offerModeOf,
  offerNamesPosition,
  parseUsdToCents,
  respondToOffer,
  usdcFromCents,
  usdcToCents,
} from "@/lib/ad-space/offers-client";
import { earnPointsLine, pointsForOfferAmount, pointsWorth } from "@/lib/ad-space/points";
import type { OfferStatus, OfferThread, OfferView, Position, Space } from "@/lib/ad-space/types";

import { AppPrompt } from "./AppPrompt";
import { Checkout } from "./Checkout";
import { Spinner } from "./checkout-parts";
import { type CheckedFunds, FundsCheck, usableProof } from "./FundsCheck";
import { AmountField, amountProblem, proofSpent } from "./OfferSheet";
import { payChainsOf } from "./pay-sheet";
import { btnPrimary, btnSecondary, btnSmallSecondary, card, eyebrow, pill } from "./ui";
import { useServerNow } from "./useServerNow";

/**
 * An offer or a bid, from its sponsor's side, at `/o/<token>`
 * (hispace-offers-v0.md). The sponsor has no account: the token in the URL is
 * the offer. It is used for the API path and nothing else, and every call made
 * with it sends no Referer.
 *
 * The server decides every state and every deadline. The buttons below only
 * appear where the contract says an answer is possible; a refusal still gets a
 * plain sentence, and a refusal that means "this page is out of date" reloads
 * the offer instead of guessing.
 */

const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Waiting for an answer",
  countered: "Counter-offer",
  accepted: "Accepted",
  paid: "Paid",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
  lapsed: "Not paid in time",
  superseded: "Closed",
};

const STATUS_PILL: Record<OfferStatus, string> = {
  pending: pill.neutral,
  countered: pill.attention,
  accepted: pill.attention,
  paid: pill.done,
  declined: pill.neutral,
  expired: pill.neutral,
  withdrawn: pill.neutral,
  lapsed: pill.neutral,
  superseded: pill.neutral,
};

function creatorRef(handle: string | null | undefined): string {
  return handle ? `@${handle}` : "the creator";
}

function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/** An instant as UTC on the server, the reader's own clock once in the browser. */
function When({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(instantIn(iso)), [iso]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {local ?? instantUtc(iso)}
    </time>
  );
}

/** "by Wed 7 Oct, 10:00 (1d 4h left)", on the server's clock. */
function Deadline({ iso, now }: { iso: string; now: number | null }) {
  const left = now === null ? null : Date.parse(iso) - now;
  return (
    <>
      <When iso={iso} />
      {left !== null && left > 0 && (
        <span className="text-sp-ink/80">
          {" "}
          (<span className="font-mono">{timeLeft(left)}</span> left)
        </span>
      )}
    </>
  );
}

export function OfferPanel({
  token,
  initial,
  space,
}: {
  token: string;
  initial: OfferThread;
  /** The full public space, for paying through the page's checkout. Null when it couldn't be read. */
  space: Space | null;
}) {
  const [thread, setThread] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [paying, setPaying] = useState(false);
  const acting = useRef(false);
  const now = useServerNow();

  const { offer, space: summary } = thread;
  const handle = summary.creator.xHandle;
  const who = creatorRef(handle);
  const bid = offer.kind === "bid";
  const thing = bid ? "bid" : "offer";
  const what = offer.positionLabel ?? summary.templateName ?? "this space";
  const session = space ? isSessionSpace(space) : false;
  const subject = session ? "session" : "spot";

  const position: Position | null =
    (offer.positionId && space?.positions.find((p) => p.id === offer.positionId)) || thread.position || null;
  const positionOffers = thread.position?.offers ?? position?.offers ?? null;

  const reload = useCallback(async () => {
    try {
      setThread(await getOfferClient(token));
    } catch {
      // Keep what the page shows; any sentence already on screen says why.
    }
  }, [token]);

  async function act(label: string, body: RespondBody): Promise<boolean> {
    if (acting.current) return false;
    acting.current = true;
    setNotice(null);
    setBusy(label);
    try {
      setThread(await respondToOffer(token, body));
      return true;
    } catch (e) {
      setNotice(
        describeOfferError(e, { kind: offer.kind, chain: offer.sponsor.backed?.chain ?? null, subject }) ??
          describeError(e, null, subject),
      );
      if (e instanceof CheckoutError && OFFER_STALE_CODES.has(e.code)) await reload();
      throw e;
    } finally {
      acting.current = false;
      setBusy(null);
    }
  }

  const onPaid = useCallback(() => {
    void reload();
  }, [reload]);
  const closeCheckout = useCallback(() => setPaying(false), []);

  const open = offer.status === "pending" || offer.status === "countered";
  const biddingEnd = positionOffers?.biddingEndsAt ? Date.parse(positionOffers.biddingEndsAt) : NaN;
  const biddingOpen =
    bid && positionOffers?.biddingOpen !== false && !(Number.isFinite(biddingEnd) && now !== null && biddingEnd <= now);
  const canRaise = open && (!bid || biddingOpen);
  /*
   * What paying with the HOLD app would earn (spaces-sponsor-points-v0.md): on
   * the agreed amount once accepted, on the latest amount while it waits. The
   * fee rate comes from the full space; without it, nothing is promised.
   */
  const holdPoints = space
    ? pointsForOfferAmount(offer.status === "accepted" ? offer.agreedUsdc : offer.amountUsdc, space, offer)
    : null;
  /*
   * Withdraw only while the thread waits (pending or countered). An accepted
   * one is never withdrawn: unpaid, it lapses. The leading bid stays once
   * bidding has ended (`bid_locked`): it is the bid the creator is choosing.
   */
  const canWithdraw = open && !(bid && offer.leading === true && !biddingOpen);
  /* Only this browser can know whether it holds the payment's key: read after mount. */
  const [paidHere, setPaidHere] = useState(false);
  const positionId = position?.id ?? null;
  useEffect(() => {
    setPaidHere(offer.status === "paid" && positionId !== null && existingCheckoutKeySafe(positionId));
  }, [offer.status, positionId]);

  return (
    <div className="flex flex-col gap-6">
      <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-label={bid ? "Your bid" : "Your offer"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${eyebrow} text-sp-ink/80`}>{bid ? "Your bid" : "Your offer"}</p>
            <h1 className="mt-2 break-words font-display text-h4 font-light text-sp-ink [overflow-wrap:anywhere] md:text-h3">
              {what}, on {handle ? `@${handle}’s` : "the creator’s"} HiSpace
            </h1>
            <p className="mt-1 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">
              {[summary.event?.name, summary.title || offer.spaceTitle].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className={STATUS_PILL[offer.status]}>
            {bid && offer.status === "pending" ? (offer.leading ? "Highest bid" : "Outbid") : STATUS_LABEL[offer.status]}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 border-t border-[color:var(--color-hairline)] pt-4 text-small sm:grid-cols-2">
          {offer.agreedUsdc && offer.agreedSponsorPaysUsdc ? (
            <>
              <Figure label="Agreed price" value={offer.agreedUsdc} />
              <Figure label={offer.status === "paid" ? "You paid" : "You pay"} value={offer.agreedSponsorPaysUsdc} />
            </>
          ) : (
            <>
              <Figure label={bid ? "Your bid" : "Your offer"} value={offer.amountUsdc} />
              <Figure label="You would pay" value={offer.sponsorPaysUsdc} />
            </>
          )}
          {offer.status === "countered" && offer.counterUsdc && (
            <>
              <Figure label={`${who} countered with`} value={offer.counterUsdc} tone="attention" />
              {offer.counterSponsorPaysUsdc && <Figure label="You would pay" value={offer.counterSponsorPaysUsdc} />}
            </>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          {(summary.path ?? offer.spacePath) && (
            <a href={(summary.path ?? offer.spacePath)!} className={btnSmallSecondary}>
              See the space
            </a>
          )}
        </div>
      </section>

      <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-label="Where it stands">
        <Standing thread={thread} now={now} biddingOpen={biddingOpen} paidHere={paidHere} subject={subject} />

        {offer.status === "countered" && offer.counterUsdc && !raising && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy !== null}
              onClick={() => void act("accept", { action: "accept_counter" }).catch(() => undefined)}
            >
              {busy === "accept" ? (
                <>
                  <Spinner />
                  Accepting…
                </>
              ) : (
                `Accept ${offer.counterUsdc} USDC`
              )}
            </button>
          </div>
        )}

        {offer.status === "accepted" && (
          <div className="flex flex-col gap-4">
            {space && position ? (
              <div>
                <button type="button" className={btnPrimary} onClick={() => setPaying(true)}>
                  Pay {offer.agreedSponsorPaysUsdc ?? offer.sponsorPaysUsdc} USDC
                </button>
              </div>
            ) : (
              <p className="text-small text-sp-amber">
                We couldn&rsquo;t load the payment just now. Refresh the page to pay.
              </p>
            )}
            {holdPoints !== null ? (
              <AppPrompt
                title={earnPointsLine(holdPoints)}
                body={`Worth ${pointsWorth(holdPoints)} in HOLD. Only a payment from the HOLD app earns them; any other wallet pays the same and earns none.`}
              />
            ) : (
              <AppPrompt title="No wallet with USDC? Pay with HOLD" />
            )}
          </div>
        )}

        {paidHere && space && position && (
          <div>
            <button type="button" className={btnPrimary} onClick={() => setPaying(true)}>
              {session ? "See your booking" : "Add your logo"}
            </button>
          </div>
        )}

        {canRaise && raising && space && (
          <RaiseForm
            offer={offer}
            space={space}
            position={position}
            positionOffers={positionOffers}
            now={now}
            busy={busy !== null}
            onCancel={() => setRaising(false)}
            onRaise={async (body) => {
              await act("raise", body);
              setRaising(false);
            }}
          />
        )}

        {(canRaise || canWithdraw) && !raising && (
          <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-hairline)] pt-4">
            {canRaise && space && (
              <button
                type="button"
                className={btnSmallSecondary}
                disabled={busy !== null}
                onClick={() => {
                  setRaising(true);
                  setConfirmWithdraw(false);
                  setNotice(null);
                }}
              >
                {bid ? "Raise my bid" : "Raise my offer"}
              </button>
            )}
            {!canWithdraw ? null : confirmWithdraw ? (
              <>
                <button
                  type="button"
                  className={btnSmallSecondary}
                  disabled={busy !== null}
                  onClick={() =>
                    void act("withdraw", { action: "withdraw" })
                      .then(() => setConfirmWithdraw(false))
                      .catch(() => setConfirmWithdraw(false))
                  }
                >
                  {busy === "withdraw" ? "Withdrawing…" : `Yes, withdraw my ${thing}`}
                </button>
                <button type="button" className={btnSmallSecondary} onClick={() => setConfirmWithdraw(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                className={btnSmallSecondary}
                disabled={busy !== null}
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw
              </button>
            )}
          </div>
        )}
        {confirmWithdraw && (
          <p className="text-tiny text-sp-ink/80">
            Withdrawing closes this {thing} for good. You can make a new one while the space is open.
          </p>
        )}

        {notice && (
          <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-sp-ink/85" role="status">
            {notice}
          </p>
        )}
      </section>

      <Rounds offer={offer} who={who} />

      <section className={`${card} flex flex-col gap-2 p-5 text-small md:p-6`} aria-label="What you sent">
        <h2 className={`${eyebrow} text-sp-ink/80`}>What you sent</h2>
        <p className="text-sp-ink/85">
          Name: <span className="text-sp-ink">{offer.sponsor.name}</span>
        </p>
        {offer.sponsor.contactKind && offer.sponsor.contactValue && (
          <p className="text-sp-ink/85">
            {CONTACT_KIND_LABEL[offer.sponsor.contactKind]}: <span className="text-sp-ink">{offer.sponsor.contactValue}</span>
          </p>
        )}
        {offer.sponsor.message && (
          <p className="whitespace-pre-line break-words text-sp-ink/85 [overflow-wrap:anywhere]">{offer.sponsor.message}</p>
        )}
        <p className="text-sp-ink/85">
          {offer.sponsor.backed ? (
            <>
              <span className="text-sp-ok">Funds checked</span> on {CHAIN_LABEL[offer.sponsor.backed.chain]},{" "}
              <span className="font-mono">{shortAddress(offer.sponsor.backed.address)}</span>
            </>
          ) : (
            "Funds not checked"
          )}
        </p>
        {offer.sponsor.contactKind === "email" && (
          <p className="text-tiny text-sp-ink/80">We email this link to you with every change.</p>
        )}
      </section>

      {(open || offer.status === "accepted") && (
        <AppPrompt
          title={
            bid
              ? "Get notified the moment someone outbids you: follow it in HOLD"
              : "Get notified the moment the creator answers: follow it in HOLD"
          }
          body={open && holdPoints !== null ? `${earnPointsLine(holdPoints)} if it's accepted.` : undefined}
        />
      )}

      {paying && space && position && (
        <Checkout
          space={space}
          position={position}
          onClose={closeCheckout}
          onPaid={onPaid}
          offer={offer.status === "accepted" ? { token, view: offer } : null}
        />
      )}
    </div>
  );
}

/** Whether this browser holds a checkout key for the spot (localStorage can throw). */
function existingCheckoutKeySafe(positionId: string): boolean {
  try {
    return existingCheckoutKey(positionId) !== null;
  } catch {
    return false;
  }
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "attention" }) {
  return (
    <div>
      <dt className="text-tiny text-sp-ink/80">{label}</dt>
      <dd className={`mt-1 font-mono ${tone === "attention" ? "text-sp-amber" : "text-sp-ink"}`}>{value} USDC</dd>
    </div>
  );
}

const DECLINE_TEXT: Record<NonNullable<OfferView["declineReason"]>, string> = {
  too_low: "said the amount was too low",
  not_a_fit: "said it isn't a fit",
  other: "declined it",
};

/** Where the offer stands and what happens next, in sentences. */
function Standing({
  thread,
  now,
  biddingOpen,
  paidHere,
  subject,
}: {
  thread: OfferThread;
  now: number | null;
  biddingOpen: boolean;
  paidHere: boolean;
  subject: "spot" | "session";
}) {
  const { offer, space } = thread;
  const who = creatorRef(space.creator.xHandle);
  const bid = offer.kind === "bid";
  const thing = bid ? "bid" : "offer";
  const po = thread.position?.offers ?? null;
  const p = (text: ReactNode) => <p className="text-small text-sp-ink/85">{text}</p>;

  switch (offer.status) {
    case "pending":
      if (bid) {
        return (
          <div className="flex flex-col gap-2">
            <h2 className="text-body text-sp-ink">
              {offer.leading ? "You're the highest bid." : "You've been outbid."}
            </h2>
            {!offer.leading && po?.highestBidUsdc && p(<>The highest bid is now {po.highestBidUsdc} USDC{po.nextMinimumBidUsdc ? `, and the next has to be at least ${po.nextMinimumBidUsdc} USDC` : ""}.</>)}
            {po?.reserveMet === false && offer.leading && p("The creator's reserve isn't met yet, so a win isn't accepted automatically.")}
            {biddingOpen && po?.biddingEndsAt
              ? p(
                  <>
                    Bidding ends <Deadline iso={po.biddingEndsAt} now={now} />. A bid in the last 10 minutes adds 10
                    more.
                  </>,
                )
              : p(
                  <>
                    Bidding has ended. {who} has 24 hours to accept a bid; if they don&rsquo;t, the highest backed bid at
                    or above their reserve is accepted automatically. If it&rsquo;s yours, you&rsquo;ll have 24 hours to
                    pay.
                  </>,
                )}
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-sp-ink">Waiting for {who}.</h2>
          {p(
            <>
              They can accept, counter or decline
              {offer.expiresAt ? (
                <>
                  {" "}
                  until <Deadline iso={offer.expiresAt} now={now} />
                </>
              ) : null}
              . If nobody answers by then, the offer expires.
            </>,
          )}
        </div>
      );
    case "countered":
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-sp-ink">
            {who} answered with {offer.counterUsdc} USDC.
          </h2>
          {p(
            <>
              Accept it, raise your offer, or withdraw
              {offer.expiresAt ? (
                <>
                  {" "}
                  by <Deadline iso={offer.expiresAt} now={now} />
                </>
              ) : null}
              . If you don&rsquo;t answer, it expires.
              {offer.countersLeft === 0 ? " This was the last counter-offer: they can still accept or decline." : ""}
            </>,
          )}
        </div>
      );
    case "accepted":
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-sp-ink">
            {who} accepted your {thing} at {offer.agreedUsdc} USDC.
          </h2>
          {p(
            <>
              The {subject} is held for you. Pay
              {offer.expiresAt ? (
                <>
                  {" "}
                  by <Deadline iso={offer.expiresAt} now={now} />
                </>
              ) : (
                " within 24 hours"
              )}
              , from any wallet, straight to the creator. An accepted {thing} can&rsquo;t be withdrawn: if it isn&rsquo;t
              paid in time, the acceptance lapses and the {subject} goes back to the space.
            </>,
          )}
        </div>
      );
    case "paid":
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-sp-ink">Paid. It&rsquo;s yours.</h2>
          {p(
            paidHere
              ? `Send ${who} what goes on it: your logo, a QR, a text or a photo.`
              : `Send ${who} what goes on it from the browser you paid in: the payment's key lives there.`,
          )}
        </div>
      );
    case "declined":
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-body text-sp-ink">
            {who} {offer.declineReason ? DECLINE_TEXT[offer.declineReason] : "declined it"}.
          </h2>
          {p(`This ${thing} is closed. You can make a new one while the space is open.`)}
        </div>
      );
    case "expired":
      return p(`This ${thing} expired: its answer didn't come in time, or the space closed. You can make a new one while the space is open.`);
    case "withdrawn":
      return p(`You withdrew this ${thing}.`);
    case "lapsed":
      return p(`This ${thing} was accepted but not paid within 24 hours, so the ${subject} went back to the space.`);
    case "superseded":
      return p(`The ${subject} went to another sponsor, so this ${thing} closed. Nothing was paid.`);
    default:
      return null;
  }
}

function Rounds({ offer, who }: { offer: OfferView; who: string }) {
  if (offer.rounds.length === 0) return null;
  const bid = offer.kind === "bid";
  return (
    <section className={`${card} flex flex-col gap-3 p-5 md:p-6`} aria-label="History">
      <h2 className={`${eyebrow} text-sp-ink/80`}>History</h2>
      <ol className="flex flex-col gap-2">
        {offer.rounds.map((r, i) => (
          <li key={`${r.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-small">
            <span className="text-sp-ink/85">
              {r.by === "sponsor"
                ? i === 0
                  ? bid
                    ? "You bid"
                    : "You offered"
                  : "You raised to"
                : `${who} countered with`}{" "}
              <span className="font-mono text-sp-ink">{r.amountUsdc} USDC</span>
            </span>
            <span className="text-tiny text-sp-ink/80">
              <When iso={r.at} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RaiseForm({
  offer,
  space,
  position,
  positionOffers,
  now,
  busy,
  onCancel,
  onRaise,
}: {
  offer: OfferView;
  space: Space;
  position: Position | null;
  positionOffers: Position["offers"];
  now: number | null;
  busy: boolean;
  onCancel: () => void;
  onRaise: (body: RespondBody) => Promise<void>;
}) {
  const bid = offer.kind === "bid";
  const session = isSessionSpace(space);
  // On a tiered space the rung this offer names is what prices it; on an
  // untiered service the slots are identical and the space prices them.
  const mode = offerModeOf(space, offerNamesPosition(space) ? position : null);
  const last = usdcToCents(offer.amountUsdc);
  const minimum = minimumCents(offer.kind, session, positionOffers ?? null);
  const belowCents = mode === "fixed_with_offers" ? (position?.priceCents ?? space.positions[0]?.priceCents ?? null) : null;
  const [amount, setAmount] = useState(() => {
    const start = bid ? usdcToCents(positionOffers?.nextMinimumBidUsdc ?? null) : null;
    return start !== null && (last === null || start > last) ? usdcFromCents(start).replace(/,/g, "") : "";
  });
  const [checked, setChecked] = useState<CheckedFunds | null>(null);
  const [wantsCheck, setWantsCheck] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cents = parseUsdToCents(amount);
  const counter = offer.status === "countered" ? usdcToCents(offer.counterUsdc) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const p = amountProblem(cents, { kind: offer.kind, minimum, belowCents, aboveCents: last, counterCents: counter });
    if (p) return setProblem(p);
    const proofOk = usableProof(checked, cents, now);
    try {
      await onRaise({ action: "raise", amountCents: cents!, ...(proofOk && checked ? { proof: checked.proof } : {}) });
    } catch (err) {
      // The sentence is already on the page. A bid above what was checked before
      // needs a fresh check, and a proof the server consumed before failing on
      // its side (`chain_unavailable`, any 5xx) is spent.
      if (proofSpent(err) && (checked || (err instanceof CheckoutError && err.code === "bid_needs_backing"))) {
        setChecked(null);
        setWantsCheck(true);
      }
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 border-t border-[color:var(--color-hairline)] pt-4" noValidate>
      <AmountField
        label={bid ? "Your new bid" : "Your new offer"}
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setProblem(null);
        }}
        feeBps={space.feeBps}
        feePayer={space.feePayer}
        creatorHandle={space.creator.xHandle}
        hint={`Your last ${bid ? "bid" : "offer"} was ${offer.amountUsdc} USDC.${
          bid && positionOffers?.nextMinimumBidUsdc ? ` The next bid has to be at least ${positionOffers.nextMinimumBidUsdc} USDC.` : ""
        }${counter !== null && offer.counterUsdc ? ` Stay under the counter of ${offer.counterUsdc} USDC, or accept the counter instead.` : ""}`}
        disabled={busy}
      />
      {bid &&
        (wantsCheck ? (
          <FundsCheck
            spaceId={space.id}
            positionId={offer.positionId}
            chains={payChainsOf(space)}
            amountCents={cents}
            kind="bid"
            checked={checked}
            onChecked={setChecked}
            now={now}
            disabled={busy}
          />
        ) : (
          <p className="text-tiny text-sp-ink/80">
            If the new bid is more than the wallet you checked holds, you&rsquo;ll be asked to check your funds again.{" "}
            <button type="button" className="text-sp-amber hover:underline" onClick={() => setWantsCheck(true)}>
              Check now
            </button>
          </p>
        ))}
      {problem && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-sp-ink/85" role="status">
          {problem}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : bid ? (
            "Raise my bid"
          ) : (
            "Raise my offer"
          )}
        </button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  );
}
