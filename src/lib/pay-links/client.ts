/**
 * Paying a pay link from the browser (pay-links-v0.md).
 *
 * Built on the HiSpace public checkout: the same `X-Checkout-Key` (made per
 * link and kept in localStorage), the same Solana Pay transaction request, the
 * same error envelope. What differs is that nothing here carries a fee: one
 * transfer on Solana, one ERC-3009 authorization on Base and Polygon.
 */

import { API_BASE } from "@/lib/ad-space/config";
import { CHAIN_LABEL, usdFromCents } from "@/lib/ad-space/format";
import { CheckoutError, apiRequest, describeError } from "@/lib/ad-space/checkout-client";
import type { Chain } from "@/lib/ad-space/types";

import type { PayConfirm, PayLinkCheckout, PayLinkPayment } from "./types";

const PUBLIC = `${API_BASE}/pay-links/public`;

/** The checkout-key scope for a link, so its key never collides with a HiSpace position's. */
export function payKeyScope(code: string): string {
  return `pay:${code}`;
}

export function startPayCheckout(
  code: string,
  key: string,
  body: { chain: Chain; payerAddress: string; amountCents?: number },
): Promise<PayLinkCheckout> {
  return apiRequest(`${PUBLIC}/${encodeURIComponent(code)}/checkout`, { key, json: body });
}

export function confirmPayment(paymentId: string, key: string, signature?: string): Promise<PayConfirm> {
  return apiRequest(`${PUBLIC}/payments/${encodeURIComponent(paymentId)}/confirm`, {
    key,
    json: signature ? { signature } : {},
  });
}

/** ASSUMPTION: answers `{ outcome: "pending", payment, txHash }`, like HiSpace's authorizations. */
export function submitPayAuthorization(
  paymentId: string,
  key: string,
  signature: string,
): Promise<PayConfirm & { txHash?: string | null }> {
  return apiRequest(`${PUBLIC}/payments/${encodeURIComponent(paymentId)}/authorization`, {
    key,
    json: { signature },
  });
}

/**
 * The payment bound to this key, if a phone wallet has created one from the QR.
 * ASSUMPTION: `GET /pay-links/public/checkout` with the key, like HiSpace's
 * `GET /public/checkout`; the contract does not name it.
 */
export async function currentPayment(key: string): Promise<PayLinkPayment | null> {
  const data = await apiRequest<{ payment: PayLinkPayment | null }>(`${PUBLIC}/checkout`, { key });
  return data.payment ?? null;
}

/**
 * The Solana Pay transaction-request link. An open amount travels in the URL
 * the wallet fetches (ASSUMPTION: `&amountCents=`), since the wallet posts only
 * its account.
 */
export function payLinkSolanaPay(code: string, c: string, amountCents: number | null): string {
  const amount = amountCents !== null ? `&amountCents=${amountCents}` : "";
  const url = `${PUBLIC}/solana-pay/${encodeURIComponent(code)}?c=${c}${amount}`;
  return `solana:${encodeURIComponent(url)}`;
}

/** ASSUMPTION: `{ note? }` in the body; the contract names the route only. */
export async function reportPayLink(code: string, note: string): Promise<void> {
  await apiRequest(`${PUBLIC}/${encodeURIComponent(code)}/report`, {
    json: note ? { note } : {},
  });
}

/** Only the path of a receipt link is used, so it always opens on this site. */
export function receiptPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url, "https://hihodl.xyz").pathname.match(/^\/pay\/r\/([A-Za-z0-9_-]{16,128})\/?$/);
    return m ? `/pay/r/${m[1]}` : null;
  } catch {
    return null;
  }
}

/** Explorer link for a transaction, when the server gives none. */
export function explorerTxUrl(chain: Chain, tx: string): string {
  if (chain === "solana") return `https://solscan.io/tx/${encodeURIComponent(tx)}`;
  if (chain === "base") return `https://basescan.org/tx/${encodeURIComponent(tx)}`;
  return `https://polygonscan.com/tx/${encodeURIComponent(tx)}`;
}

/**
 * Pay-link codes in plain words, falling back to the HiSpace sentences for the
 * checkout codes the two routers share (insufficient funds, rate limits, a
 * paused chain, a wallet that closed).
 */
export function describePayError(e: unknown, chain: Chain | null, limits?: { minCents: number; maxCents: number }): string {
  const net = chain ? CHAIN_LABEL[chain] : "this network";
  if (e instanceof CheckoutError) {
    switch (e.code) {
      case "link_not_active":
        return "This link can't take payments any more. It may have been paid, closed or expired. Nothing was paid.";
      case "amount_out_of_range":
        return limits
          ? `The amount has to be between ${usdFromCents(limits.minCents)} and ${usdFromCents(limits.maxCents)}.`
          : "That amount is outside what this link accepts.";
      case "chain_not_accepted":
        return `This link doesn't take payments on ${net}. Pick one of the other networks.`;
      case "receiver_not_ready":
        return `The person you're paying can't receive USDC on ${net} right now. Nothing was paid. Try another network, or tell them.`;
      case "insufficient_funds":
        return `This wallet doesn't have enough USDC on ${net} for this payment. Add USDC or pay from another wallet.`;
      case "rate_limited":
        return e.status === 503
          ? "Payments are paused for a moment on our side. Nothing was paid; try again in a minute."
          : "This link or this wallet has reached its limit of payments for now. Nothing was paid; try again later.";
      case "own_address":
        return "That wallet is the one this link pays. Pay from a different wallet.";
      case "bad_signature":
        return "That signature didn't match the payment, so we didn't send it. Nothing was paid.";
      case "hold_expired":
      case "checkout_key_reused":
        return "That payment took too long to arrive. Nothing was taken; start again.";
      case "not_found":
        return "We can't find this link or payment any more. Refresh the page.";
      case "too_many_holds":
      case "too_many_lapsed_holds":
      case "space_busy":
        return "Too many unfinished payments from this connection right now. Wait a few minutes and try again. Nothing was paid.";
      case "paid_duplicate":
        return "Someone else paid this single-use link a moment before you. Email support@hihodl.xyz with your transaction.";
    }
  }
  return describeError(e, chain);
}
