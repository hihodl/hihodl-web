/**
 * Our Spaces fee, for copy that has no space in hand.
 *
 * A space or an order carries its own `feeBps` (lib/ad-space/types), and
 * anything about one sale reads that. A creator's totals (the Overview) do
 * not: `/ad-space/creator/analytics` returns what was paid, not the rate, and
 * no public or config route serves it. So the sentence "brands pay our 5%"
 * reads this one number instead of a literal in each screen. It is the
 * backend's `AD_SPACE.FEE_BPS`; when that changes, this changes with it.
 */
export const AD_SPACE_FEE_BPS = 500;

/** "5%", "2.5%". */
export function feePctText(bps: number = AD_SPACE_FEE_BPS): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}
