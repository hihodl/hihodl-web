/**
 * The buyer's invoice details, from the web checkout (sale-invoices-contract.md):
 * kept in this browser for the next purchase, and sent once per order with the
 * checkout key that opened it (`PUT /public/orders/:orderId/billing`).
 *
 * Sending is never on the payment's path. It goes out next to the wallet's
 * signature, not before it, and whatever the server answers (an API without
 * the route yet, a document already issued, a field it refuses) the payment
 * carries on. What the wallet signs is the checkout's answer, untouched.
 */

import { AD_SPACE_API } from "./config";
import { apiRequest } from "./checkout-client";
import { type BillingDetails, billingBody, billingProblem, parseStoredBilling } from "./billing-rules";

const STORE = "hihodl:ad-space:billing";

/** The details this browser used last, or null. Every storage access may throw. */
export function loadBilling(): BillingDetails | null {
  try {
    return parseStoredBilling(window.localStorage.getItem(STORE));
  } catch {
    return null;
  }
}

/** Keep the details for the next checkout, or forget them with null. */
export function storeBilling(d: BillingDetails | null): void {
  try {
    if (d) window.localStorage.setItem(STORE, JSON.stringify(billingBody(d)));
    else window.localStorage.removeItem(STORE);
  } catch {
    // Private mode or blocked storage: the details still apply to this checkout.
  }
}

/** True when the server took the details. Never throws. */
export async function saveOrderBilling(orderId: string, key: string, d: BillingDetails): Promise<boolean> {
  if (billingProblem(d)) return false;
  try {
    await apiRequest<unknown>(`${AD_SPACE_API}/public/orders/${encodeURIComponent(orderId)}/billing`, {
      method: "PUT",
      key,
      json: billingBody(d),
    });
    return true;
  } catch {
    // 404 from an API without invoices, 409 once a document exists, 422 on a
    // field: none of them may stand between the buyer and the payment.
    return false;
  }
}
