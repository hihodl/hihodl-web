"use client";

import { usdFromUsdc, type SpaceTier } from "@/lib/ad-space/format";
import type { OfferMode, Position } from "@/lib/ad-space/types";
import { useT } from "@/lib/app/i18n/react";

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
  const t = useT();
  if (tiers.length === 0) return null;

  return (
    <section aria-label={session ? t("board.tiers.sessions") : t("board.tiers.packages")} className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {tiers.map((tier) => (
          <li key={tier.key}>
            <TierCard
              tier={tier}
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
  tier,
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
  const t = useT();
  const buy = tier.buy;
  const gone = buy === null;
  /* A rung with nothing open is not an error state: it is a price somebody
     already paid. It goes quiet — dimmed, no amber, no button — and stays on
     the ladder so the rungs above and below it still make sense.

     How it sells is asked of a copy either way, so a rung that went by bidding
     still says "Highest bid" once it is gone, rather than reading as a price
     somebody could have walked up and paid. */
  const mode = modeOf(buy ?? tier.positions[0]);
  const total = tier.positions.length;
  const left =
    tier.open.length > 0
      ? tier.open.length === total
        ? t("board.tiers.available", { count: total })
        : t("board.tiers.leftOf", { left: tier.open.length, total })
      : tier.held > 0
        ? session
          ? t("board.sessionStatus.held")
          : t("board.tiers.beingPaidNow")
        : session
          ? t("board.stats.fullyBooked")
          : t("board.stats.soldOut");
  const leftPill = tier.open.length > 0 ? pill.open : tier.held > 0 ? pill.held : pill.neutral;

  return (
    <article
      className={`grid grid-cols-1 gap-5 rounded-card border p-5 transition-colors duration-180 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8 md:p-6 ${
        gone
          ? "border-[color:var(--color-hairline)] bg-sp-ink/[0.015] opacity-70"
          : "border-[color:var(--color-hairline)] bg-sp-ink/[0.03]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="min-w-0 break-words text-body text-sp-ink [overflow-wrap:anywhere]">{tier.title}</h3>
          <span className={leftPill}>{left}</span>
        </div>
        {tier.pitch && (
          <p className="mt-2 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">{tier.pitch}</p>
        )}
        {tier.perks.length > 0 && (
          <>
            <h4 className={`${eyebrow} mt-4 text-sp-ink/80`}>{t("board.beforeYouPay.title")}</h4>
            <ul className="mt-2 flex flex-col gap-2">
              {tier.perks.map((line, i) => (
                // The creator's own words, as text: `perks` is plain text by
                // contract and is never rendered as markup of any kind.
                <li key={`${tier.key}-${i}`} className="flex items-start gap-3">
                  <Check />
                  <span className="min-w-0 break-words text-small text-sp-ink [overflow-wrap:anywhere]">{line}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {mode === "bids" && buy && (
          <div className="mt-4">
            <BidLines offers={tier.offers} now={now} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 sm:items-end">
        <TierFigure tier={tier} mode={mode} session={session} />
        {buy && buyable && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {(mode === null || mode === "fixed_with_offers") && (
              <button type="button" className={btnSmall} onClick={() => onSponsor(buy)}>
                {mode === "fixed_with_offers" ? t("board.tiers.buyNow") : session ? t("board.stats.bookSession") : t("board.tiers.claimIt")}
              </button>
            )}
            {(mode === "offers" || mode === "fixed_with_offers") && (
              <button
                type="button"
                className={mode === "offers" ? btnSmall : btnSmallSecondary}
                onClick={() => onOffer(buy)}
              >
                {t("board.chip.makeOffer")}
              </button>
            )}
            {mode === "bids" && biddingOpen(buy) && (
              <button type="button" className={btnSmall} onClick={() => onOffer(buy)}>
                {t("board.tiers.bid")}
              </button>
            )}
          </div>
        )}
        {!buy && tier.held > 0 && (
          <p className="max-w-[18rem] text-tiny text-sp-amber sm:text-right">
            {t("board.tiers.payingForLast")}
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
function TierFigure({ tier, mode, session }: { tier: SpaceTier; mode: OfferMode | null; session: boolean }) {
  const t = useT();
  const gone = tier.buy === null;
  if (mode === "bids") {
    const highest = tier.offers?.highestBidUsdc ?? null;
    const shown = highest ?? tier.offers?.openingBidUsdc ?? null;
    if (!shown) return <p className="text-small text-sp-ink/85">{t("board.tiers.openForBids")}</p>;
    return (
      <dl className="flex flex-col gap-0.5 sm:text-right">
        <dt className="text-tiny text-sp-ink/80">{highest ? t("board.tiers.highestBid") : t("board.tiers.openingBid")}</dt>
        <dd className="text-h4 font-light tabular-nums text-sp-ink">
          {usdFromUsdc(shown)}
          <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
        </dd>
      </dl>
    );
  }
  if (mode === "offers" || tier.sponsorPaysUsdc === null) {
    const n = tier.offers?.openCount ?? null;
    return (
      <div className="flex flex-col gap-0.5 sm:text-right">
        <p className="text-body text-sp-ink">{gone ? (session ? t("board.sessionStatus.sold") : t("board.status.sold")) : t("board.stats.nameYourPrice")}</p>
        {!gone && n !== null && (
          <p className="text-tiny text-sp-ink/80">
            {t("board.tiers.openOffers", { count: n })}
          </p>
        )}
      </div>
    );
  }
  return (
    <dl className="flex flex-col gap-0.5 sm:text-right">
      <dt className="text-tiny text-sp-ink/80">{gone ? t("board.tiers.wentFor") : t("board.youPay")}</dt>
      <dd className="text-h4 font-light tabular-nums text-sp-ink">
        {usdFromUsdc(tier.sponsorPaysUsdc)}
        <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
      </dd>
    </dl>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-[3px] shrink-0 text-sp-cool">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
