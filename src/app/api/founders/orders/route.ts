/**
 * POST /api/founders/orders: the Founder Pass is closed.
 *
 * This used to open one Founder Pass order (and, on the card rail, a Stripe
 * Checkout Session). The pass is deprecated as of 24 Sep 2026, so nothing can
 * open a new order any more. What still works, on purpose, is everything an
 * order that already exists needs to settle: the Stripe webhook at
 * /api/founders/stripe/webhook and the status poll at
 * /api/founders/orders/[reference], which is also where on-chain payments are
 * confirmed.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "FOUNDER_PASS_CLOSED",
      code: "FOUNDER_PASS_CLOSED",
      message: "The Founder Pass is closed.",
    },
    { status: 410 },
  );
}
