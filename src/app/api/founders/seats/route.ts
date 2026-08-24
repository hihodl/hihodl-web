/**
 * GET /api/founders/seats — the live seats-remaining counter for /founders.
 *
 * Read from the database on every request. There is no hardcoded fallback and
 * no cached number: a seat counter that can be wrong is worse than no counter,
 * because the entire point of it is scarcity the buyer can trust.
 */
import { NextResponse } from "next/server";
import { readSeats } from "@/lib/orders/store";
import { FOUNDER_PASS } from "@/lib/rates.config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const seats = await readSeats();
    return NextResponse.json(
      {
        total: seats.total,
        remaining: seats.remaining,
        soldOut: seats.soldOut,
        earlyRemaining: seats.earlyRemaining,
        priceUsd: seats.earlyRemaining > 0 ? FOUNDER_PASS.earlyPriceUsd : FOUNDER_PASS.priceUsd,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[founders/seats]", e);
    // Fail loud rather than inventing a number. The page renders a quiet
    // "checking availability" state instead of a figure that might be a lie.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
