/**
 * A seller's quote, from the guest's side at /e/<token>
 * (seller-quotes-contract.md, section 4).
 *
 * A quote is a price the seller sent for one spot inside the conversation.
 * The guest accepts it (the spot is then held for them 24 hours) and pays it
 * exactly as an accepted offer is paid from /o/<token>: the same checkout
 * body, the same browser checkout key, the same confirm and content calls
 * after it. The enquiry token is the only credential, so every call here
 * keeps it out of a Referer.
 *
 * Clients switch on `error.code`, never on the message.
 */

import { t } from "@/lib/app/i18n";

import { AD_SPACE_API } from "./config";
import { CheckoutError, apiRequest, type EvmCheckout, type SolanaCheckout } from "./checkout-client";
import { clockTime } from "./format";
import type { BriefBody, Chain, GuestEnquiry } from "./types";

function quoteCall<T>(token: string, quoteId: string, path: string, init: { json?: unknown; key?: string }): Promise<T> {
  return apiRequest<T>(
    `${AD_SPACE_API}/public/enquiries/${encodeURIComponent(token)}/quotes/${encodeURIComponent(quoteId)}${path}`,
    { method: "POST", ...init, referrerPolicy: "no-referrer" },
  );
}

/**
 * Accept: the spot is held for this thread 24 hours. `updatedAt` is the
 * version on screen; anything the seller wrote since answers `offer_changed`.
 * The answer is the thread itself, with the quote now `accepted`.
 */
export async function acceptGuestQuote(token: string, quoteId: string, updatedAt: string | null): Promise<GuestEnquiry> {
  const json = updatedAt ? { updatedAt } : {};
  return (await quoteCall<{ enquiry: GuestEnquiry }>(token, quoteId, "/accept", { json })).enquiry;
}

/** The longest reason a guest can give for declining. */
export const QUOTE_DECLINE_REASON_MAX = 280;

/**
 * Decline an open quote, with an optional reason the seller reads. The answer
 * is the thread with the quote now `declined`, or null when the API answered
 * without one (the caller then reads the thread again).
 */
export async function declineGuestQuote(token: string, quoteId: string, reason: string): Promise<GuestEnquiry | null> {
  const r = reason.trim().slice(0, QUOTE_DECLINE_REASON_MAX);
  const data = await quoteCall<{ enquiry?: GuestEnquiry } | null>(token, quoteId, "/decline", { json: r ? { reason: r } : {} });
  return data && typeof data === "object" && data.enquiry && Array.isArray(data.enquiry.messages) ? data.enquiry : null;
}

/** The checkout for an accepted quote: exactly the offer checkout's answer, priced at the quote. */
export function startQuoteCheckout(
  token: string,
  quoteId: string,
  key: string,
  body: { chain: "solana"; sponsorAddress: string; brief?: BriefBody },
): Promise<SolanaCheckout>;
export function startQuoteCheckout(
  token: string,
  quoteId: string,
  key: string,
  body: { chain: "base" | "polygon"; sponsorAddress: string; brief?: BriefBody },
): Promise<EvmCheckout>;
export function startQuoteCheckout(
  token: string,
  quoteId: string,
  key: string,
  body: { chain: Chain; sponsorAddress: string; brief?: BriefBody },
): Promise<SolanaCheckout | EvmCheckout> {
  return quoteCall(token, quoteId, "/checkout", { json: body, key });
}

/* ── The invoice, after paying (sale-invoices-contract.md) ─────────── */

export type BuyerDocument =
  | { status: "issued"; kind: "invoice" | "receipt"; number: string; issuedAt: string; pdfUrl: string | null }
  | { status: "pending"; issuesAt: string }
  | { status: "not_available" };

/**
 * The seller's invoice or receipt for an order this browser paid: the
 * checkout key that paid it is the credential. Null when the API has no such
 * route yet, or the order is not this browser's.
 */
export async function getBuyerDocument(orderId: string, key: string): Promise<BuyerDocument | null> {
  try {
    const data = await apiRequest<{ document?: BuyerDocument }>(
      `${AD_SPACE_API}/public/orders/${encodeURIComponent(orderId)}/invoice`,
      { method: "GET", key },
    );
    const d = data?.document;
    if (!d || typeof d !== "object") return null;
    if (d.status === "issued" || d.status === "pending" || d.status === "not_available") return d;
    return null;
  } catch {
    return null;
  }
}

/* ── Refusals, in words ────────────────────────────────────────────── */

/** Codes after which the quote on screen is out of date: read the thread again. */
export const QUOTE_STALE_CODES: ReadonlySet<string> = new Set([
  "offer_not_open",
  "offer_expired",
  "offer_changed",
  "offer_not_accepted",
  "quote_not_open",
  "quote_accepted",
  "quote_declined",
  "quote_changed",
  "position_sold",
  "position_reserved",
  "position_held",
  "space_closed",
  "too_close_to_closing",
  "not_found",
]);

/**
 * Every code the quote routes name, in words for the buyer. Null for a code
 * that is not about the quote (a wallet or network refusal at checkout), so
 * the checkout's own sentences take over.
 */
export function describeQuoteError(e: unknown, subject: "spot" | "session" = "spot"): string | null {
  if (!(e instanceof CheckoutError)) return null;
  const d = e.details ?? {};
  switch (e.code) {
    case "offer_not_open":
    case "quote_not_open":
      return t("enquiries.quote.error.notOpen");
    case "offer_expired":
      return t("enquiries.quote.error.expired");
    case "offer_changed":
    case "quote_changed":
      return t("enquiries.quote.error.changed");
    case "offer_not_accepted":
      return t("enquiries.quote.error.notAccepted");
    case "quote_accepted":
      return t("enquiries.quote.error.alreadyAccepted");
    case "quote_declined":
      return t("enquiries.quote.error.declined");
    case "quote_reason_invalid":
    case "decline_reason_invalid":
      return t("enquiries.quote.error.reasonInvalid");
    case "position_sold":
      return t("enquiries.quote.error.sold", { subject });
    case "package_not_organised":
      return t("publicPages.sponsor.noLongerOnSale");
    case "position_reserved": {
      const until = typeof d.reservedUntil === "string" ? d.reservedUntil : null;
      return until
        ? t("enquiries.quote.error.reservedUntil", { subject, time: clockTime(until) })
        : t("enquiries.quote.error.reserved", { subject });
    }
    case "position_held":
      return t("enquiries.quote.error.held", { subject });
    case "space_closed":
      return t("enquiries.quote.error.spaceClosed");
    case "too_close_to_closing":
      return t("enquiries.quote.error.tooClose");
    case "bidding_in_progress":
      return t("enquiries.quote.error.bidding");
    case "checkout_key_required":
      return t("enquiries.quote.error.keyRequired");
    case "enquiry_link_expired":
      return t("enquiries.thread.expiredBodyPlain");
    case "not_found":
      return t("enquiries.quote.error.notFound");
    // Seller side only (sending, withdrawing, answering through the offer
    // routes). The guest page never makes those calls; mapped so a raw code
    // never shows.
    case "quote_not_an_offer":
    case "quote_answer_invalid":
    case "quote_price_invalid":
    case "quote_days_invalid":
    case "quote_note_invalid":
    case "enquiry_read_only":
    case "enquiry_closed":
    case "chat_request_pending":
    case "space_not_taking_enquiries":
      return t("enquiries.quote.error.sellerSide");
    case "rate_limited":
      return t("enquiries.error.rateLimited");
    case "network":
      return t("enquiries.error.network");
    default:
      return null;
  }
}
