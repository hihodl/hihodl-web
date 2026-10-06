/**
 * Paying a Spaces order by bank transfer, the rules the page needs
 * (a-brand-pays-by-bank-or-card-contract.md). Pure, so bank-rules.check.ts can
 * run them without a browser.
 *
 * The server decides everything that matters: whether bank is offered, the
 * amount, the hold, and when the order is paid (Bridge's own read of the
 * transfer). The page only shows it and asks again.
 */

import type { MessageKey } from "@/lib/app/i18n/en";

import type { BankOption, BankState } from "./types";

/** The backend's minimum price for a bank transfer, used when a reply does not carry it. */
export const BANK_MIN_USD_CENTS = 25_000;

/** How often an open bank order is read again. Bridge moves in hours, not seconds. */
export const BANK_POLL_MS = 20_000;

/**
 * Where a bank order stands, for the brand:
 *   waiting  — nothing has arrived yet; it can still be cancelled.
 *   received — the money is at Bridge or on its way to the seller.
 *   paid     — delivered; the order turns paid.
 *   gone     — cancelled, or the money went back to the sender.
 *   short    — less arrived than the order: never sold, support settles it.
 *   stuck    — a person has to look: Bridge reported a problem, or a state
 *              this page does not know (the server alerts ops on both).
 */
export type BankStage = "waiting" | "received" | "paid" | "gone" | "short" | "stuck";

export function bankStage(status: BankState | string | null | undefined): BankStage {
  switch (status) {
    // No Bridge state yet: the transfer is being written, nothing has arrived.
    case null:
    case undefined:
    case "":
    case "awaiting_funds":
      return "waiting";
    case "in_review":
    case "funds_received":
    case "payment_submitted":
    case "refund_in_flight":
      return "received";
    case "payment_processed":
      return "paid";
    case "canceled":
    case "returned":
    case "refunded":
      return "gone";
    case "short_paid":
      return "short";
    // undeliverable, refund_failed, stuck, error, and anything Bridge adds
    // later: the page never claims to know more than the server does.
    default:
      return "stuck";
  }
}

/** A guest's free hold before Bridge has the money, and the hold once it has (contract, Holds). */
export const BANK_GUEST_HOLD_HOURS = 24;
export const BANK_HOLD_DAYS = 7;

/**
 * Until when a guest's spot is held once their transfer reaches Bridge: a week
 * from when the order was written, never past the listing's close. The order
 * was written {@link BANK_GUEST_HOLD_HOURS} before its free hold ends (bank is
 * never offered within two days of the close, so that hold is never cut short).
 * Null when either date is unreadable or the week adds nothing.
 */
export function guestWeekUntil(expiresAt: string | null | undefined, closesAt: string | null | undefined): string | null {
  const until = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(until)) return null;
  let week = until - BANK_GUEST_HOLD_HOURS * 3_600_000 + BANK_HOLD_DAYS * 86_400_000;
  const close = Date.parse(closesAt ?? "");
  if (Number.isFinite(close)) week = Math.min(week, close);
  return week > until ? new Date(week).toISOString() : null;
}

/** Only an untouched transfer can be cancelled: Bridge refuses once money has arrived. */
export function canCancel(status: BankState | string | null | undefined): boolean {
  return bankStage(status) === "waiting";
}

/**
 * Refusals that are about the listing itself. They hold for an accepted offer
 * or a quote on it too, so the door stays shut there as well.
 */
const LISTING_REFUSALS: ReadonlySet<string> = new Set([
  "seller_not_verified",
  "bank_too_close_to_closing",
  "bank_not_for_takeover",
  "bank_not_for_crews",
  "bank_not_for_this_listing",
  "seller_vault",
  "position_sold",
  "space_closed",
  "whole_listing_taken",
  "parts_already_sold",
  "session_event_over",
]);

/**
 * Whether the checkout shows "Pay by bank transfer".
 *
 * The position's answer is read for the position's own price. An accepted
 * offer or a quote is priced at its agreed amount and the position is
 * reserved for it, so there only listing refusals shut the door, and the
 * minimum is checked against the agreed price (the server checks it again).
 *
 * @param option null when the API answered 404 (`bank_unavailable`) or not at all: no door.
 * @param bound  the agreed price of the offer or quote this pays, in USD ("1000.00"), or null for a listed price.
 * @param bid    an accepted bid: a wallet backed it, it never pays by bank.
 */
export function bankShown(option: BankOption | null, bound: { priceUsd: string | null; bid: boolean } | null): boolean {
  if (!option) return false;
  if (!bound) return option.bank !== null;
  if (bound.bid) return false;
  if (option.bank === null && option.reason && LISTING_REFUSALS.has(option.reason)) return false;
  const min = option.bank?.minUsdCents ?? BANK_MIN_USD_CENTS;
  const cents = bound.priceUsd !== null ? Math.round(Number(bound.priceUsd) * 100) : NaN;
  return Number.isFinite(cents) && cents >= min;
}

/** "1050.00" to "$1,050.00". The amount is exact to the cent, so cents are always shown. */
export function usdExact(amount: string | null | undefined, locale = "en-US"): string | null {
  if (amount == null) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** The bank-transfer error codes, to the key that words each. Null: not a bank code. */
export function bankErrorKey(code: string): MessageKey | null {
  switch (code) {
    case "bank_unavailable":
      return "sponsor.checkout.bank.error.unavailable";
    case "bank_unavailable_try_again":
      return "sponsor.checkout.bank.error.tryAgain";
    case "seller_not_verified":
      return "sponsor.checkout.bank.error.sellerNotVerified";
    case "bank_below_minimum":
      return "sponsor.checkout.bank.error.belowMinimum";
    case "bank_too_close_to_closing":
      return "sponsor.checkout.bank.error.tooCloseToClosing";
    case "bank_not_for_takeover":
    case "bank_not_for_crews":
    case "bank_not_for_this_listing":
    case "bank_not_for_bids":
    case "seller_vault":
      return "sponsor.checkout.bank.error.notForThis";
    case "bank_hold_limit":
      return "sponsor.checkout.bank.error.holdLimit";
    case "bank_transfer_in_flight":
      return "sponsor.checkout.bank.error.inFlight";
    case "pays_by_bank":
      return "sponsor.checkout.bank.error.paysByBank";
    case "bank_short_paid":
      return "sponsor.checkout.bank.error.shortPaid";
    default:
      return null;
  }
}

/**
 * Asking for bank details: a 429 `rate_limited` there is the guest's daily
 * cap on bank holds (or a burst), said calmly with the wallet as the way on.
 * A 503 `rate_limited` is our limiter down and keeps the checkout's own words.
 */
export function bankRequestErrorKey(code: string, status: number): MessageKey | null {
  if (code === "rate_limited" && status === 429) return "sponsor.checkout.bank.error.dailyCap";
  return bankErrorKey(code);
}
