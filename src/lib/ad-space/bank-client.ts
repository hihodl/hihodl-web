/**
 * Paying a Spaces order by bank transfer, from the browser
 * (a-brand-pays-by-bank-or-card-contract.md, Endpoints, Public).
 *
 * Same checkout key as a wallet checkout: one order per key, and
 * `GET /public/checkout` reads the order back with its `bank` instructions,
 * which is how a brand who closed the tab finds the details again.
 */

import { AD_SPACE_API } from "./config";
import { CheckoutError, apiRequest } from "./checkout-client";
import type { BankInstructions, BankOption, BankRail, Order } from "./types";

/**
 * Whether this spot takes a bank transfer. Null when the API says
 * `bank_unavailable` (switch off, or not this seller yet), predates the route,
 * or could not be asked: the page then simply has no bank door.
 */
export async function bankOption(positionId: string): Promise<BankOption | null> {
  try {
    const data = await apiRequest<BankOption>(
      `${AD_SPACE_API}/public/positions/${encodeURIComponent(positionId)}/bank-transfer`,
      { method: "GET" },
    );
    if (!data || typeof data !== "object" || !("bank" in data)) return null;
    return { bank: data.bank ?? null, reason: data.reason ?? null };
  } catch {
    return null;
  }
}

export interface BankCheckout {
  order: Order;
  bank: BankInstructions | null;
}

/** What a bank transfer pays: the listed spot, an accepted offer, or a seller's quote in a thread. */
export type BankTarget =
  | { kind: "position"; positionId: string }
  | { kind: "offer"; token: string }
  | { kind: "quote"; token: string; quoteId: string };

function bankPath(target: BankTarget): string {
  switch (target.kind) {
    case "position":
      return `/public/positions/${encodeURIComponent(target.positionId)}/bank-transfer`;
    case "offer":
      return `/public/offers/${encodeURIComponent(target.token)}/bank-transfer`;
    case "quote":
      return `/public/enquiries/${encodeURIComponent(target.token)}/quotes/${encodeURIComponent(target.quoteId)}/bank-transfer`;
  }
}

/**
 * Ask for the bank details: the server makes the order (holding the spot),
 * asks Bridge for a transfer on the seller's behalf and answers its
 * instructions. Asking again with the same key answers the same order.
 */
export async function startBankTransfer(target: BankTarget, key: string, rail: BankRail): Promise<BankCheckout> {
  const out = await apiRequest<BankCheckout>(`${AD_SPACE_API}${bankPath(target)}`, {
    method: "POST",
    key,
    json: { rail },
    // An offer or enquiry token is in the path: never let it leave in a Referer.
    ...(target.kind === "position" ? {} : { referrerPolicy: "no-referrer" as const }),
  });
  if (!out?.order) throw new CheckoutError("server", 500);
  return { order: out.order, bank: out.bank ?? out.order.bank ?? null };
}

/** The brand lets the spot go before paying. 409 `bank_transfer_in_flight` once money has arrived. */
export async function cancelBankTransfer(orderId: string, key: string): Promise<Order> {
  const out = await apiRequest<{ order: Order }>(
    `${AD_SPACE_API}/public/orders/${encodeURIComponent(orderId)}/bank-transfer/cancel`,
    { method: "POST", key, json: {} },
  );
  return out.order;
}
