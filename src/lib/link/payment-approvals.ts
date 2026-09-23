/**
 * Asking the linked phone to approve a spot or a stay, and waiting for it.
 *
 *   POST /payment-approvals              { kind, ref } → pending, a push to the phone
 *   GET  /payment-approvals/:id          polled while the phone decides
 *   POST /payment-approvals/:id/cancel   the web's "never mind"
 *
 * The web sends a ref and nothing else: never a title, an amount or bytes.
 * The server builds the transaction when the person taps Approve on the
 * phone, and the web only submits what comes back signed, exactly as it
 * would after a passkey.
 *
 * documentation/one-wallet-every-device.md, "Payments built by the server,
 * approved on the phone".
 */

"use client";

import { send } from "@/lib/wallet/api";

import { isDecided, toApproval, type PaymentApproval } from "./payment-approval-core";

export * from "./payment-approval-core";

type Raw = Record<string, unknown>;

export type PaymentRef = { kind: "spot"; orderId: string } | { kind: "stay"; bookingId: string };

export async function requestPaymentApproval(ref: PaymentRef): Promise<PaymentApproval> {
  const body = ref.kind === "spot" ? { kind: "spot", ref: { orderId: ref.orderId } } : { kind: "stay", ref: { bookingId: ref.bookingId } };
  return toApproval(await send<Raw>("payment-approvals", { json: body }));
}

export async function getPaymentApproval(id: string): Promise<PaymentApproval> {
  return toApproval(await send<Raw>(`payment-approvals/${encodeURIComponent(id)}`));
}

/** 409 NOT_PENDING once it was sent, expired or already decided. */
export async function cancelPaymentApproval(id: string): Promise<PaymentApproval> {
  return toApproval(await send<Raw>(`payment-approvals/${encodeURIComponent(id)}/cancel`, { json: {} }));
}

/**
 * Every 1.5 seconds. A stay's deposit is built on the phone with a quote that
 * lives about 30 seconds, and the web is the one that submits it, so the gap
 * between "approved" and our submit has to stay a small part of that.
 */
export const PHONE_POLL_MS = 1_500;

/** Past `expiresAt` the server answers `expired` on its own; this is only how long we keep asking for that answer. */
const EXPIRY_GRACE_MS = 15_000;

/**
 * Poll until the phone answers. Resolves with the decided approval, or null
 * when the signal aborted or the approval can no longer be read.
 *
 * Never rejects: a failed poll is a failed poll, asked again on the next
 * tick. `onUpdate` sees every read, so the screen's countdown and status
 * follow the server's.
 */
export async function waitForPhone(
  first: PaymentApproval,
  opts: { onUpdate?: (a: PaymentApproval) => void; signal?: AbortSignal } = {},
): Promise<PaymentApproval | null> {
  if (isDecided(first.status)) return first;
  const until = Date.parse(first.expiresAt);
  const giveUpAt = (Number.isFinite(until) ? until : Date.now() + 10 * 60_000) + EXPIRY_GRACE_MS;
  let misses = 0;
  while (!opts.signal?.aborted) {
    await new Promise((r) => setTimeout(r, PHONE_POLL_MS));
    if (opts.signal?.aborted) return null;
    try {
      const a = await getPaymentApproval(first.id);
      misses = 0;
      opts.onUpdate?.(a);
      if (isDecided(a.status)) return a;
    } catch (e) {
      // Not ours any more (404): nothing left to wait on.
      if ((e as { status?: number })?.status === 404 && ++misses >= 3) return null;
    }
    if (Date.now() > giveUpAt) return { ...first, status: "expired" };
  }
  return null;
}
