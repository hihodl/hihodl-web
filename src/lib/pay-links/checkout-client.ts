/**
 * A creator's checkout from the browser: reading where it is now (so the page
 * can send the buyer back the moment it is paid, however it was paid), and a
 * test checkout's two buttons.
 */

import { API_BASE } from "@/lib/ad-space/config";
import { apiRequest } from "@/lib/ad-space/checkout-client";

import { readCheckout, type CheckoutStatus } from "./checkout";

const PUBLIC = `${API_BASE}/pay-links/public/checkout`;

/** The checkout's status now, or null when it could not be read this time. */
export async function checkoutStatusNow(id: string): Promise<CheckoutStatus | null> {
  try {
    const data = await apiRequest<unknown>(`${PUBLIC}/${encodeURIComponent(id)}`);
    return readCheckout(id, data)?.checkout.status ?? null;
  } catch {
    return null;
  }
}

/** Test mode only: end the checkout as paid or failed. The server refuses it on a live one. */
export function simulateCheckout(id: string, outcome: "paid" | "failed"): Promise<unknown> {
  return apiRequest<unknown>(`${PUBLIC}/${encodeURIComponent(id)}/simulate`, { json: { outcome } });
}
