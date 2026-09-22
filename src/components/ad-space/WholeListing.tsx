"use client";

import { STATUS_LABEL, usdFromUsdc } from "@/lib/ad-space/format";
import type { OfferMode, Position } from "@/lib/ad-space/types";

import { btnSmall, btnSmallSecondary, pill } from "./ui";

/**
 * "One brand takes everything": the position that sells the whole listing.
 *
 * It is not a square and it is never drawn on the board, so it gets one card
 * of its own above the squares — the thing a brand going all in came to buy,
 * said once, at the top, with its price and one button.
 *
 * Deliberately not a banner plus a card: a Spaces screen says less and fits a
 * screenful. Everything here is one row of type, one line of prose and the
 * action.
 */
export function WholeListing({
  position: p,
  productName,
  buyable,
  offerMode,
  partsSold,
  onSponsor,
  onOffer,
}: {
  position: Position;
  /** What the listing sells, lowercased: "whole look", "carry-on suitcase". */
  productName: string;
  buyable: boolean;
  offerMode: OfferMode | null;
  /** A square is already gone, so nobody can buy all of it any more. */
  partsSold: boolean;
  onSponsor: (p: Position) => void;
  onOffer?: (p: Position) => void;
}) {
  const namesPrice = offerMode === "offers" || offerMode === "bids" || p.sponsorPaysUsdc === null;
  const taken = p.status === "sold";
  const gone = !taken && partsSold;
  return (
    <article
      id={`spot-${p.id}`}
      className={`flex flex-col gap-4 rounded-card border p-5 ${
        taken
          ? "border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.06]"
          : "border-amber/40 bg-amber/[0.06]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body text-sp-ink">{p.title ?? "One brand takes everything"}</h3>
          <p className="mt-1 text-tiny text-sp-ink/80">
            {taken
              ? `The whole ${productName} is one brand's.`
              : `Every spot on the ${productName}, and nobody else on it.`}
          </p>
        </div>
        <span className={pill[taken ? "sold" : gone ? "closed" : p.status]}>
          {gone ? "No longer whole" : STATUS_LABEL[p.status]}
        </span>
      </header>

      {p.pitch && <p className="text-small text-sp-ink/85">{p.pitch}</p>}

      {p.perks && p.perks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {p.perks.map((line) => (
            <li key={line} className="text-small text-sp-ink/85">
              {line}
            </li>
          ))}
        </ul>
      )}

      {taken && p.sponsor?.name && <p className="text-small text-sp-ink/85">{p.sponsor.name} took all of it.</p>}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-[color:var(--color-hairline)] pt-4">
        {namesPrice ? (
          <p className="text-small text-sp-ink/80">You name the price.</p>
        ) : (
          <dl className="flex flex-col gap-0.5">
            <dt className="sr-only">You pay</dt>
            <dd className="text-body tabular-nums text-sp-ink">
              {usdFromUsdc(p.sponsorPaysUsdc)}
              <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
            </dd>
          </dl>
        )}
        {buyable && !taken && !gone && (
          namesPrice && onOffer ? (
            <button type="button" className={btnSmall} onClick={() => onOffer(p)}>
              {offerMode === "bids" ? "Bid for all of it" : "Offer for all of it"}
            </button>
          ) : (
            <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
              Take all of it
            </button>
          )
        )}
        {gone && (
          // Said plainly rather than hidden: a brand that came for the whole
          // piece should learn why it cannot have it, not find a missing button.
          <p className="text-tiny text-sp-ink/70">A spot has been sold, so the piece is no longer whole.</p>
        )}
      </div>
    </article>
  );
}

/** A reason a square cannot be bought, when the whole listing was. */
export function takenWholeText(productName: string): string {
  return `One brand took the whole ${productName}.`;
}

/** The whole-listing position of a board, or null. */
export function wholeOf(positions: readonly Position[]): Position | null {
  return positions.find((p) => p.takesEverything) ?? null;
}

/** Everything else: what a page means by "the board". */
export function squaresOf(positions: readonly Position[]): Position[] {
  return positions.filter((p) => !p.takesEverything);
}
