/**
 * GET /api/founders/orders/:reference — poll one order.
 *
 * This is where the on-chain rails are actually confirmed. Each poll asks the
 * RPC node what landed on the order's address and advances the state machine
 * accordingly. Nothing the browser sends can move an order forward; the browser
 * is only allowed to ask.
 *
 * The reference is ~130 bits of entropy, so holding one lets you watch exactly
 * one order and learn nothing about any other. That is why no session is
 * required: there is nothing to enumerate.
 */
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { ipRateLimit } from "@/lib/security";
import { getOrder, reconcileOnchainOrder } from "@/lib/orders/store";
import { qrPayload, toPublicOrder } from "@/lib/orders/public";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[0-9a-z]{26}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: { reference: string } },
) {
  // The checkout page polls every few seconds while a quote is live. This bounds
  // how hard a single client can drive our RPC provider.
  const limit = ipRateLimit(req, "founder-order-poll", { windowMs: 60_000, max: 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString() } },
    );
  }

  if (!REFERENCE_RE.test(params.reference)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    let order = await getOrder(params.reference);
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Ask the chain. Never fatal: an RPC hiccup must not make a live order look
    // broken to somebody who has already sent money, so we fall through to the
    // last known state and let the next poll try again.
    if (order.rail !== "stripe") {
      try {
        order = await reconcileOnchainOrder(order);
      } catch (e) {
        console.error("[founders/orders] reconcile failed", params.reference, e);
      }
    }

    const publicOrder = toPublicOrder(order);

    // The QR is rendered here rather than in the browser so no QR library ships
    // in the client bundle and the payload can only ever be the address the
    // server derived for this order.
    let qrSvg: string | null = null;
    const payload = qrPayload(publicOrder);
    if (payload && (order.state === "awaiting_payment" || order.state === "confirming")) {
      qrSvg = await QRCode.toString(payload, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0A0500", light: "#F4F6FA" },
      });
    }

    return NextResponse.json(
      { order: publicOrder, qrSvg },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[founders/orders] read failed", params.reference, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
