/**
 * Offers and bids, which are not the same thing and are not shown as one.
 *
 * AN OFFER is a conversation. One brand names a number, it waits for you, and
 * you may say yes, say no, or say a different number back — three rounds at
 * most. Nothing else is happening while it waits.
 *
 * A BID is a standing number with a clock. Several brands are pushing the same
 * one spot up, there is a highest, there is a moment it stops, and the only
 * answers are yes and no: a counter on a bid is refused outright
 * (`not_for_bids`), because countering the leader in an auction is not a
 * thing. So bids are grouped under the spot they are competing for, with that
 * spot's clock above them, and offers are a list of separate conversations.
 * Flattening the two into one inbox would put a countdown next to something
 * that has none and invite a counter on something that takes none.
 *
 * THE MONEY
 *
 * What the creator RECEIVES leads, everywhere, and what the sponsor moves is
 * named as the sponsor's. When our fee sits on top of the price those are two
 * numbers and the API sends both; when the creator carries the fee they are
 * the same number and neither is the receipt, which is why it is worked out
 * exactly rather than labelled hopefully. See `creatorReceivesUsdc`.
 */

"use client";

import { useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { relativeTime, timeLeft } from "@/lib/ad-space/format";
import {
  centsFromDollars,
  centsFromUsdc,
  creatorReceivesUsdc,
  type OfferView,
  type PositionView,
  type SpaceView,
} from "@/lib/creator/listing";
import { acceptOffer, counterOffer, declineOffer, type DeclineReason } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Money } from "../listing/parts";

const OPEN: readonly string[] = ["pending", "countered", "accepted"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting on you",
  countered: "Waiting on them",
  accepted: "Agreed — waiting to be paid",
  paid: "Paid",
  declined: "You said no",
  expired: "Ran out of time",
  withdrawn: "They withdrew it",
  lapsed: "Agreed, then not paid",
  superseded: "Replaced by a higher one",
};

const DECLINE_LABEL: Record<DeclineReason, string> = {
  too_low: "Too low",
  not_a_fit: "Not a fit",
  other: "Something else",
};

export function Offers({
  space,
  offers,
  onChanged,
}: {
  space: SpaceView;
  offers: readonly OfferView[];
  onChanged: () => void;
}) {
  const plain = offers.filter((o) => o.kind === "offer");
  const bids = offers.filter((o) => o.kind === "bid");
  const biddingPositions = space.positions.filter((p) => p.offers?.mode === "bids");

  if (offers.length === 0) {
    return (
      <p className="text-body text-text-muted">
        Nothing yet. A brand that wants this listing names its number here, and you answer from this page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {plain.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-body text-text">Offers</h3>
            <p className="text-small text-text-muted">
              One brand, one number, waiting for you. You can say yes, say no, or name a different number back — three
              times at most, and only above what they offered.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {plain.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} space={space} onChanged={onChanged} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bids.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-body text-text">Bidding</h3>
            <p className="text-small text-text-muted">
              Several brands pushing the same spot up, against a clock. There is no countering a bid: the highest one
              when the clock stops is the one in front of you.
            </p>
          </div>
          {biddingPositions.map((p) => (
            <BiddingOn key={p.id} position={p} space={space} bids={bids.filter((b) => b.positionId === p.id)} onChanged={onChanged} />
          ))}
          {bids.filter((b) => !biddingPositions.some((p) => p.id === b.positionId)).length > 0 ? (
            <ul className="flex flex-col gap-3">
              {bids
                .filter((b) => !biddingPositions.some((p) => p.id === b.positionId))
                .map((b) => (
                  <li key={b.id}>
                    <OfferCard offer={b} space={space} onChanged={onChanged} />
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/* ── One spot, and the bids on it ─────────────────────────────────── */

function BiddingOn({
  position,
  space,
  bids,
  onChanged,
}: {
  position: PositionView;
  space: SpaceView;
  bids: readonly OfferView[];
  onChanged: () => void;
}) {
  const block = position.offers!;
  const endsIn = block.biddingEndsAt ? new Date(block.biddingEndsAt).getTime() - Date.now() : null;
  const sorted = [...bids].sort((a, b) => (a.leading ? -1 : 0) - (b.leading ? -1 : 0));

  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-text">{position.title ?? position.label}</p>
          <p className="mt-1 text-tiny text-text-muted">
            {block.openingBidUsdc ? `Opened at ${block.openingBidUsdc} USDC` : "One spot"}
            {block.bidCount ? ` · ${block.bidCount} ${block.bidCount === 1 ? "bid" : "bids"}` : " · no bids yet"}
          </p>
        </div>
        <span className={block.biddingOpen ? pill.open : pill.neutral}>
          {block.biddingOpen && endsIn !== null && endsIn > 0
            ? `${timeLeft(endsIn)} left`
            : block.biddingOpen
              ? "Open"
              : "Bidding closed"}
        </span>
      </div>

      {block.minOfferUsdc ? (
        <p className="text-small text-text-muted">
          Your reserve is {block.minOfferUsdc} USDC, and nobody else can see it.{" "}
          {block.reserveMet
            ? "The highest bid has met it."
            : "The highest bid has not met it yet, so nothing is accepted for you when the clock stops."}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="text-small text-text-muted">No bids on this one yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((b) => (
            <li key={b.id}>
              <OfferCard offer={b} space={space} onChanged={onChanged} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── One thread ───────────────────────────────────────────────────── */

function OfferCard({
  offer,
  space,
  onChanged,
  compact,
}: {
  offer: OfferView;
  space: SpaceView;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "counter" | "decline">("none");
  const [counter, setCounter] = useState("");

  const open = OPEN.includes(offer.status);
  const canAnswer = offer.status === "pending" || (offer.kind === "offer" && offer.status === "countered");
  const canCounter = offer.kind === "offer" && offer.status === "pending" && offer.countersLeft > 0;
  const expiresIn = offer.expiresAt ? new Date(offer.expiresAt).getTime() - Date.now() : null;

  const shown = offer.agreedUsdc ?? offer.amountUsdc;
  const shownCents = centsFromUsdc(shown);
  const yours = shownCents === null ? null : creatorReceivesUsdc(shownCents, space.feePayer);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setMode("none");
      onChanged();
    } catch (e) {
      setNotice(describeRunError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex flex-col gap-4 rounded-card border p-5 ${
        offer.leading ? "border-amber/50 bg-amber/[0.06]" : "border-[color:var(--color-hairline)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-text">
            {yours ?? shown} USDC <span className="text-small text-text-muted">to you</span>
          </p>
          <p className="mt-1 text-tiny text-text-muted">
            The sponsor pays {offer.agreedSponsorPaysUsdc ?? offer.sponsorPaysUsdc} USDC
            {space.feePayer === "sponsor" ? " — our 5% sits on top of your price" : " — you carry our 5%"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {offer.leading ? <span className={pill.sold}>Highest</span> : null}
          <span className={open ? pill.attention : pill.neutral}>{STATUS_LABEL[offer.status] ?? offer.status}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-small text-text-muted">
        <p>
          {offer.sponsor.name}
          {!compact && offer.positionLabel ? ` · ${offer.positionLabel}` : ""} · {relativeTime(offer.createdAt)}
          {offer.sponsor.via === "web" ? " · from the web" : " · from the app"}
        </p>
        {offer.sponsor.backed ? (
          <p>
            Their wallet held enough to pay this when they made it, checked on {offer.sponsor.backed.chain}.
          </p>
        ) : (
          <p>Nothing has been checked about their wallet, so this is a number and not yet money.</p>
        )}
        {offer.sponsor.message ? <p className="text-text">“{offer.sponsor.message}”</p> : null}
        {offer.sponsor.contactValue ? (
          <p>
            {offer.sponsor.contactKind}: <span className="text-text">{offer.sponsor.contactValue}</span>
          </p>
        ) : null}
        {offer.status === "countered" && offer.counterUsdc ? (
          <p>
            You asked for {offer.counterUsdc} USDC. {offer.countersLeft} more{" "}
            {offer.countersLeft === 1 ? "counter" : "counters"} left on this one.
          </p>
        ) : null}
        {expiresIn !== null && expiresIn > 0 && open ? (
          <p>
            {offer.status === "accepted"
              ? `They have ${timeLeft(expiresIn)} to pay. If they do not, the spot is yours again.`
              : `${timeLeft(expiresIn)} left on this.`}
          </p>
        ) : null}
        {offer.declineReason ? <p>You said no: {DECLINE_LABEL[offer.declineReason as DeclineReason] ?? offer.declineReason}.</p> : null}
      </div>

      {canAnswer ? (
        mode === "counter" ? (
          <div className="flex flex-col gap-3">
            <p className="text-small text-text-muted">
              Name a number above {offer.amountUsdc} USDC. On a listing with a price on it, a counter cannot go above
              that price — buying it outright has to stay the better deal.
            </p>
            <Money value={counter} onChange={setCounter} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSmall}
                disabled={busy || centsFromDollars(counter) === null}
                onClick={() => {
                  const cents = centsFromDollars(counter);
                  if (cents === null) return;
                  void run(() => counterOffer(offer.id, cents, offer.updatedAt));
                }}
              >
                {busy ? "Sending…" : "Send it"}
              </button>
              <button type="button" className={btnSmallSecondary} onClick={() => setMode("none")}>
                Cancel
              </button>
            </div>
          </div>
        ) : mode === "decline" ? (
          <div className="flex flex-col gap-3">
            <p className="text-small text-text-muted">The sponsor is told you passed, and which of these you picked.</p>
            <div className="flex flex-wrap gap-2">
              {(["too_low", "not_a_fit", "other"] as DeclineReason[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={btnSmallSecondary}
                  disabled={busy}
                  onClick={() => void run(() => declineOffer(offer.id, r, offer.updatedAt))}
                >
                  {DECLINE_LABEL[r]}
                </button>
              ))}
              <button type="button" className={btnSmallSecondary} onClick={() => setMode("none")}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSmall}
              disabled={busy}
              onClick={() => void run(() => acceptOffer(offer.id, offer.updatedAt))}
            >
              {busy ? "Working…" : "Accept"}
            </button>
            {canCounter ? (
              <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setMode("counter")}>
                Name a different number
              </button>
            ) : null}
            <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => setMode("decline")}>
              Pass
            </button>
          </div>
        )
      ) : null}

      {offer.status === "accepted" ? (
        <p className="text-small text-text-muted">
          Nothing more to do here: the spot is held for them while they pay, and the money goes straight to your wallet.
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
