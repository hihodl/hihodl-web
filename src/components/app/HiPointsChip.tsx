"use client";

/**
 * What this person has in HiPoints, wherever they are in the product.
 *
 * WHY IT LIVES IN THE FRAME AND NOT ON A SCREEN
 *
 * Points are earned in Stays, spent in Stays, and forgotten everywhere else.
 * A balance you can only see by starting a booking is a balance nobody spends,
 * and the whole point of the currency is that it comes back. So it sits with
 * the person, in the sidebar on a big screen and in the top bar on a phone —
 * the two places that are always on screen.
 *
 * IT IS A READOUT, AND IT NEVER HOLDS ANYTHING UP
 *
 * The shell once gated the entire product on two reads finishing, and one
 * section being down took Home, Wallet, Payments and Savings with it. This
 * read is the same shape of risk and gets the opposite treatment: it renders
 * nothing at all until it has an answer, renders nothing on an error, and is
 * never awaited by anything. A missing chip is a chip that is missing; a
 * blank product is an outage.
 *
 * THE AMBER IS THE TINT, NEVER THE FILL
 *
 * Travel spends exactly one amber, and the two are told apart by form: filled
 * is the control that charges, tinted is the thing worth noticing. A balance
 * is worth noticing and charges nothing, so it wears the tint — the same tint
 * `PointsPill` wears on a rate.
 */

import { Ion } from "./ion";
import { usePoints } from "@/lib/app/stays-data";

export function HiPointsChip({ compact = false }: { compact?: boolean }) {
  const points = usePoints();

  // No answer, a failed one, or an empty balance: nothing is drawn. A chip
  // that says "0 pts" is a line of furniture reporting that there is nothing
  // to report.
  const balance = Number(points.data?.balance ?? 0);
  if (!points.data || !Number.isFinite(balance) || balance <= 0) return null;

  const text = `${balance.toLocaleString("en-GB")} pts`;

  return (
    <span
      title={`${text} · HiPoints`}
      aria-label={`${text} in HiPoints`}
      className={`inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-[999px] font-bold tabular-nums tracking-[-0.2px] ${
        compact ? "h-7 px-2 text-[11px]" : "h-8 px-2.5 text-[12px]"
      }`}
      style={{
        background: "rgba(255,183,3,0.10)",
        border: "0.5px solid rgba(255,183,3,0.35)",
        color: "#FFB703",
      }}
    >
      <Ion name="star" size={compact ? 11 : 12} />
      {compact ? balance.toLocaleString("en-GB") : text}
    </span>
  );
}
