"use client";

import { type SpaceTier, tiersStartAtCents, usdFromCents } from "@/lib/ad-space/format";
import type { OfferMode, Position } from "@/lib/ad-space/types";

import { BidLines } from "./PositionCard";
import { btnSmall, btnSmallSecondary, eyebrow, pill } from "./ui";

/**
 * The ladder (ad-space-tiers-v0.md): one card per rung, cheapest to dearest or
 * in whatever order the creator built it — the API sends the positions in that
 * order and it is kept, because a creator who put the interview first meant to.
 *
 * A rung is a price and what the brand gets for it. Five copies of the same
 * rung are ONE card saying "5 left", never five cards: the thing being sold is
 * "the mic placement", and how many are left is a fact about it, not five
 * different things to choose between.
 *
 * A rung with nothing left still shows, greyed. A ladder with a missing rung
 * reads as a mistake — and a brand that arrives after the $50 logos have gone
 * needs to see they existed to understand what the $1,300 one is.
 *
 * A rung may also sell its own way (ad-space-tiers-v0.md): the $50 logo to
 * whoever pays first, the one interview to the highest bid, on the same board.
 * So the action and the figure are asked per rung and never once for the page.
 *
 * Everything here is written from the brand's side: what you get, what you pay,
 * what the creator does. The lines are the creator's own plain text and are
 * printed as text.
 */
export function TierLadder({
  tiers,
  buyable,
  session,
  modeOf,
  biddingOpen,
  now,
  onSponsor,
  onOffer,
}: {
  tiers: SpaceTier[];
  /** False once the space is closed: nothing on the ladder can be bought. */
  buyable: boolean;
  /** A session in person: booked, not sponsored. */
  session: boolean;
  /** How this rung sells when the sponsor names the price, else null. */
  modeOf: (p: Position) => OfferMode | null;
  /** Whether bidding is still open on this rung's copy, on a rung sold by bids. */
  biddingOpen: (p: Position) => boolean;
  /** The server-clock "now" for the bidding countdown; null before mount. */
  now: number | null;
  onSponsor: (p: Position) => void;
  onOffer: (p: Position) => void;
}) {
  if (tiers.length === 0) return null;
  const from = tiersStartAtCents(tiers);
  const noun = session ? "Sessions" : "Spots";
  /* "Pay and it's yours" is only true while every rung on offer sells at its
     price. The moment one of them takes offers or bids, the line has to stop
     promising a brand it can walk up and buy the one it wants. */
  const allOnePrice = tiers.every((t) => !t.buy || modeOf(t.buy) === null);

  return (
    <section aria-labelledby="the-ladder" className="flex flex-col gap-6">
      <div>
        <h2 id="the-ladder" className="font-display text-h4 font-light text-text">
          What you can buy
        </h2>
        {from !== null && (
          <p className="mt-1 text-small text-text-muted">
            {noun} start at <span className="font-mono text-text">{usdFromCents(from)}</span>.{" "}
            {allOnePrice
              ? "Pick one and pay in USDC; there is nothing to agree first."
              : "Each one says what it costs and how it sells: some at their price, some to the best bid or offer."}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-4">
        {tiers.map((t) => (
          <li key={t.key}>
            <TierCard
              tier={t}
              buyable={buyable}
              session={session}
              modeOf={modeOf}
              biddingOpen={biddingOpen}
              now={now}
              onSponsor={onSponsor}
              onOffer={onOffer}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TierCard({
  tier: t,
  buyable,
  session,
  modeOf,
  biddingOpen,
  now,
  onSponsor,
  onOffer,
}: {
  tier: SpaceTier;
  buyable: boolean;
  session: boolean;
  modeOf: (p: Position) => OfferMode | null;
  biddingOpen: (p: Position) => boolean;
  now: number | null;
  onSponsor: (p: Position) => void;
  onOffer: (p: Position) => void;
}) {
  const buy = t.buy;
  const gone = buy === null;
  /* A rung with nothing open is not an error state: it is a price somebody
     already paid. It goes quiet — dimmed, no amber, no button — and stays on
     the ladder so the rungs above and below it still make sense.

     How it sells is asked of a copy either way, so a rung that went by bidding
     still says "Highest bid" once it is gone, rather than reading as a price
     somebody could have walked up and paid. */
  const mode = modeOf(buy ?? t.positions[0]);
  const total = t.positions.length;
  const left =
    t.open.length > 0
      ? total === 1
        ? "1 available"
        : t.open.length === total
          ? `${total} available`
          : `${t.open.length} left of ${total}`
      : t.held > 0
        ? session
          ? "Being booked"
          : "Being paid now"
        : session
          ? "Fully booked"
          : "Sold out";
  const leftPill = t.open.length > 0 ? pill.open : t.held > 0 ? pill.held : pill.neutral;

  return (
    <article
      className={`grid grid-cols-1 gap-5 rounded-card border p-5 transition-colors duration-180 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8 md:p-6 ${
        gone
          ? "border-[color:var(--color-hairline)] bg-white/[0.015] opacity-70"
          : "border-[color:var(--color-hairline)] bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="min-w-0 break-words text-body text-text [overflow-wrap:anywhere]">{t.title}</h3>
          <span className={leftPill}>{left}</span>
        </div>
        {t.pitch && (
          <p className="mt-2 break-words text-small text-text-muted [overflow-wrap:anywhere]">{t.pitch}</p>
        )}
        {t.perks.length > 0 && (
          <>
            <h4 className={`${eyebrow} mt-4 text-text-faint`}>What you get</h4>
            <ul className="mt-2 flex flex-col gap-2">
              {t.perks.map((line, i) => (
                // The creator's own words, as text: `perks` is plain text by
                // contract and is never rendered as markup of any kind.
                <li key={`${t.key}-${i}`} className="flex items-start gap-3">
                  <Check />
                  <span className="min-w-0 break-words text-small text-text [overflow-wrap:anywhere]">{line}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {mode === "bids" && buy && (
          <div className="mt-4">
            <BidLines offers={t.offers} now={now} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 sm:items-end">
        <TierFigure tier={t} mode={mode} session={session} />
        {buy && buyable && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {(mode === null || mode === "fixed_with_offers") && (
              <button type="button" className={btnSmall} onClick={() => onSponsor(buy)}>
                {mode === "fixed_with_offers" ? "Buy now" : session ? "Book a session" : "Sponsor this spot"}
              </button>
            )}
            {(mode === "offers" || mode === "fixed_with_offers") && (
              <button
                type="button"
                className={mode === "offers" ? btnSmall : btnSmallSecondary}
                onClick={() => onOffer(buy)}
              >
                Make an offer
              </button>
            )}
            {mode === "bids" && biddingOpen(buy) && (
              <button type="button" className={btnSmall} onClick={() => onOffer(buy)}>
                Bid
              </button>
            )}
          </div>
        )}
        {!buy && t.held > 0 && (
          <p className="max-w-[18rem] text-tiny text-amber sm:text-right">
            Somebody is paying for the last one right now. It comes back if they don&rsquo;t finish.
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * What the rung costs, under a visible label on anything but a plain price.
 *
 * A sold-out rung keeps its figure and says it is what the spot went for: the
 * ladder is read by price, so a rung with the price blanked out would break the
 * only column a brand reads down.
 */
function TierFigure({ tier: t, mode, session }: { tier: SpaceTier; mode: OfferMode | null; session: boolean }) {
  const gone = t.buy === null;
  if (mode === "bids") {
    const highest = t.offers?.highestBidUsdc ?? null;
    const shown = highest ?? t.offers?.openingBidUsdc ?? null;
    if (!shown) return <p className="text-small text-text-muted">Open for bids</p>;
    return (
      <dl className="flex flex-col gap-0.5 sm:text-right">
        <dt className="text-tiny text-text-faint">{highest ? "Highest bid" : "Opening bid"}</dt>
        <dd className="font-mono text-h4 font-light text-text">{shown} USDC</dd>
      </dl>
    );
  }
  if (mode === "offers" || t.sponsorPaysUsdc === null) {
    const n = t.offers?.openCount ?? null;
    return (
      <div className="flex flex-col gap-0.5 sm:text-right">
        <p className="text-body text-text">{gone ? (session ? "Booked" : "Sold") : "Name your price"}</p>
        {!gone && n !== null && (
          <p className="text-tiny text-text-faint">
            {n === 0 ? "No offers yet" : n === 1 ? "1 open offer" : `${n} open offers`}
          </p>
        )}
      </div>
    );
  }
  return (
    <dl className="flex flex-col gap-0.5 sm:text-right">
      <dt className="text-tiny text-text-faint">{gone ? "Went for" : "You pay"}</dt>
      <dd className="font-mono text-h4 font-light text-text">{t.sponsorPaysUsdc} USDC</dd>
      {!gone && t.creatorReceivesUsdc && (
        <div className="flex items-baseline gap-1 text-tiny text-text-faint sm:justify-end">
          <dt>Creator receives</dt>
          <dd className="font-mono">{t.creatorReceivesUsdc}</dd>
        </div>
      )}
    </dl>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] shrink-0 text-moonlight">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
