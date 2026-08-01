/**
 * POST /api/founders/stripe/webhook — settle a card order.
 *
 * The ONLY thing that moves a Stripe order to `paid`. Not the success_url
 * redirect: a redirect is a browser navigation and a browser can navigate
 * anywhere it likes. A signed webhook is the payment.
 *
 * Signature verification is mandatory and fail-closed. Without
 * STRIPE_WEBHOOK_SECRET this route rejects everything rather than trusting an
 * unverified body — an unsigned "payment succeeded" endpoint is a free
 * Founder Pass dispenser.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { settleOrder } from "@/lib/orders/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    console.error("[founders/stripe] webhook not configured — rejecting");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "unsigned" }, { status: 400 });

  // Raw body — Stripe signs the bytes, so it must not be parsed first.
  const raw = await req.text();

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);

  let event: import("stripe").Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (e) {
    console.error("[founders/stripe] bad signature", e);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;

        // Only a session Stripe considers settled counts. `completed` fires for
        // delayed-notification methods before the money is actually there.
        if (session.payment_status !== "paid") break;

        const reference =
          session.client_reference_id ?? session.metadata?.founder_order_reference ?? null;
        if (!reference) {
          console.error("[founders/stripe] session with no order reference", session.id);
          break;
        }

        // Re-read the order rather than trusting the event's idea of the amount:
        // the price is whatever the database quoted when the order opened.
        const supabase = createSupabaseClient(true);
        const { data: order } = await supabase
          .from("founder_orders")
          .select("reference, state, price_cents, stripe_session_id")
          .eq("reference", reference)
          .maybeSingle();

        if (!order) {
          console.error("[founders/stripe] unknown order", reference);
          break;
        }
        if (order.stripe_session_id && order.stripe_session_id !== session.id) {
          console.error("[founders/stripe] session/order mismatch", reference, session.id);
          break;
        }
        if (order.state === "paid" || order.state === "refunded") break; // replay

        if ((session.amount_total ?? 0) < order.price_cents) {
          console.error("[founders/stripe] underpaid session", reference, session.amount_total);
          break;
        }

        await settleOrder(reference, {
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as import("stripe").Stripe.Charge;
        const intentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!intentId) break;

        // The founder number is NOT released. It was issued, and reissuing it
        // would give two people the same numbered card.
        await createSupabaseClient(true)
          .from("founder_orders")
          .update({ state: "refunded", refunded_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", intentId)
          .eq("state", "paid");
        break;
      }

      default:
        break;
    }
  } catch (e) {
    // 500 so Stripe retries. Settlement is idempotent, so a retry is safe.
    console.error("[founders/stripe] handler failed", event.type, e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
