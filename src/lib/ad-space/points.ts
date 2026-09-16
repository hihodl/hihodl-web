/**
 * HiPoints a sponsor would earn by paying from the HOLD app
 * (spaces-sponsor-points-v0.md). A web checkout from any other wallet earns
 * nothing, so the page only ever promises them for paying with HOLD.
 *
 * The server's rule, in integers:
 *
 *   points = floor(fee_base * sponsorPointsShareBps / 1e8)
 *
 * `fee_base` is our fee in USDC base units (6 decimals) and 1 point is $0.01.
 * Every function answers null when a figure is missing or not a plain amount,
 * and the page then shows nothing rather than a guess.
 */

import { usdFromCents } from "./format";
import type { OfferView, Position, Space } from "./types";

/** "315.525" to 315_525_000. Null for anything that is not a plain decimal of at most six places. */
export function usdcToBase(usdc: string | null | undefined): number | null {
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec((usdc ?? "").trim().replace(/,/g, ""));
  if (!m) return null;
  const base = Number(m[1]) * 1_000_000 + Number((m[2] ?? "").padEnd(6, "0") || "0");
  return Number.isSafeInteger(base) ? base : null;
}

/** Our fee on an amount (creator side, before fee), as the server computes it: `floor(base * bps / 10_000)`. */
export function feeBaseOf(amountUsdc: string | null | undefined, feeBps: number): number | null {
  const base = usdcToBase(amountUsdc);
  if (base === null || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) return null;
  return Math.floor((base * feeBps) / 10_000);
}

/** Points for a fee, or null when there is nothing worth promising. */
export function sponsorPoints(feeBase: number | null, shareBps: number | null | undefined): number | null {
  if (feeBase === null || !Number.isSafeInteger(feeBase) || feeBase <= 0) return null;
  if (typeof shareBps !== "number" || !Number.isInteger(shareBps) || shareBps <= 0 || shareBps > 10_000) return null;
  // Even a 100% fee on the $25,000 ceiling is 2.5e10 base units; times 1e4 it stays a safe integer.
  const points = Math.floor((feeBase * shareBps) / 100_000_000);
  return points > 0 ? points : null;
}

/** On an offer or bid, at the amount it names. */
export function pointsForOfferAmount(
  amountUsdc: string | null | undefined,
  space: Pick<Space, "feeBps" | "sponsorPointsShareBps">,
  offer?: Pick<OfferView, "sponsorPointsShareBps"> | null,
): number | null {
  return sponsorPoints(feeBaseOf(amountUsdc, space.feeBps), offer?.sponsorPointsShareBps ?? space.sponsorPointsShareBps);
}

/**
 * On the pay step of a spot bought outright. A takeover earns on the fee on
 * the difference, which only the server's `nextFeeUsdc` states; without it,
 * nothing. Otherwise the fee is the gap between what the wallet pays and what
 * the creator receives, whichever side pays it.
 */
export function pointsForPosition(position: Position, space: Pick<Space, "sponsorPointsShareBps">): number | null {
  const share = space.sponsorPointsShareBps;
  if (position.status === "sold" && position.takeover) {
    return sponsorPoints(usdcToBase(position.takeover.nextFeeUsdc), share);
  }
  const pays = usdcToBase(position.sponsorPaysUsdc);
  const receives = usdcToBase(position.creatorReceivesUsdc);
  if (pays === null || receives === null) return null;
  return sponsorPoints(Math.abs(pays - receives), share);
}

/** "Pay with HOLD and earn 500 points". */
export function earnPointsLine(points: number): string {
  return `Pay with HOLD and earn ${points.toLocaleString("en-US")} ${points === 1 ? "point" : "points"}`;
}

/** What the points are worth, one point being $0.01: 500 to "$5". */
export function pointsWorth(points: number): string {
  return usdFromCents(points);
}
