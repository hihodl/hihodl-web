/**
 * POST /api/founders/orders — open one Founder Pass order.
 *
 * One order, one seat, and on the on-chain rails one freshly derived receiving
 * address that will never be issued again. The address IS the attribution: it
 * is the only thing that binds a transfer on a public ledger back to the person
 * who bought the pass.
 *
 * For the Stripe rail this also creates the Checkout Session and hands back its
 * URL. The secret key stays here; the browser only ever sees a redirect target.
 */
import { NextRequest, NextResponse } from "next/server";
import { ipRateLimit, validateEmail } from "@/lib/security";
import { createOrder, SoldOutError } from "@/lib/orders/store";
import { toPublicOrder } from "@/lib/orders/public";
import { isSettlementChain, DEFAULT_SETTLEMENT_CHAIN, SITE_URL } from "@/lib/orders/config";
import { FOUNDER_PASS } from "@/lib/rates.config";

export const dynamic = "force-dynamic";

const RAILS = ["stripe", "external_wallet", "onchain_transfer"] as const;
type Rail = (typeof RAILS)[number];

const REFERRAL_CODE_RE = /^[0-9a-z]{8}$/;

export async function POST(req: NextRequest) {
  // An order allocates a database sequence value and, on the on-chain rails, an
  // RPC round trip. Six a minute is far more than a real buyer needs and tight
  // enough that nobody can burn through the address space for fun.
  const limit = ipRateLimit(req, "founder-order", { windowMs: 60_000, max: 6 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many attempts. Try again in a minute." },
      { status: 429, headers: { "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString() } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = validateEmail((body as { email?: unknown }).email);
  if (!email) {
    return NextResponse.json(
      { error: "invalid_email", message: "Enter the email address for your pass." },
      { status: 400 },
    );
  }

  const rail = (body as { rail?: unknown }).rail;
  if (typeof rail !== "string" || !RAILS.includes(rail as Rail)) {
    return NextResponse.json({ error: "invalid_rail" }, { status: 400 });
  }

  const rawChain = (body as { chain?: unknown }).chain;
  const chain = isSettlementChain(rawChain) ? rawChain : DEFAULT_SETTLEMENT_CHAIN;

  const cookieRef = req.cookies.get("hihodl_ref")?.value ?? null;
  const referralCode = cookieRef && REFERRAL_CODE_RE.test(cookieRef) ? cookieRef : null;

  try {
    const order = await createOrder({ email, rail: rail as Rail, chain, referralCode });
    const publicOrder = toPublicOrder(order);

    if (rail === "stripe") {
      const checkoutUrl = await createStripeCheckout({
        reference: order.reference,
        email,
        priceCents: order.price_cents,
      });
      return NextResponse.json({ order: publicOrder, checkoutUrl });
    }

    return NextResponse.json({ order: publicOrder });
  } catch (e) {
    if (e instanceof SoldOutError) {
      return NextResponse.json(
        { error: "sold_out", message: "All 500 founder seats are taken." },
        { status: 409 },
      );
    }
    console.error("[founders/orders] create failed", e);
    return NextResponse.json(
      { error: "server_error", message: "We could not start your order. Try again." },
      { status: 500 },
    );
  }
}

/**
 * Stripe Checkout, created server-side with an inline price.
 *
 * Inline rather than a catalogue Price object because the amount depends on
 * whether the buyer landed inside the early tranche, and that is decided by the
 * database at the moment the order opens. `client_reference_id` carries our
 * order reference through to the webhook, which is what lets a signed Stripe
 * event settle exactly one order.
 */
async function createStripeCheckout(input: {
  reference: string;
  email: string;
  priceCents: number;
}): Promise<string> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Missing STRIPE_SECRET_KEY");

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.reference,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.priceCents,
          product_data: {
            name: "HOLD Founder Pass",
            description:
              `Pro for life, 0% savings fee on up to $${FOUNDER_PASS.savingsFeeWaiverUpToUsd.toLocaleString("en-US")}, ` +
              "0% FX in every corridor, permanent creator referral tier.",
          },
        },
      },
    ],
    metadata: { founder_order_reference: input.reference },
    success_url: `${SITE_URL}/founders/checkout?order=${input.reference}&paid=1`,
    cancel_url: `${SITE_URL}/founders/checkout?order=${input.reference}`,
  });

  // Persist the session id so the webhook can find this order by it, and so a
  // duplicate session can never attach to a second order.
  const { createSupabaseClient } = await import("@/lib/supabase");
  await createSupabaseClient(true)
    .from("founder_orders")
    .update({ stripe_session_id: session.id })
    .eq("reference", input.reference);

  if (!session.url) throw new Error("Stripe returned a session with no URL");
  return session.url;
}
