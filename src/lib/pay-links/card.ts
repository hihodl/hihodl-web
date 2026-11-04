/**
 * Paying a pay link by card, Apple Pay or Google Pay (the backend's
 * feat/pay-links-take-a-card). Coinflow is the acquirer: the server opens a
 * card payment and hands back Coinflow's hosted checkout, the page frames it,
 * and Coinflow sends USDC on Solana to the link's owner.
 *
 * The same `X-Checkout-Key` and the same error envelope as the stablecoin
 * checkout (./client).
 */

import { API_BASE } from "@/lib/ad-space/config";
import { CheckoutError, apiRequest } from "@/lib/ad-space/checkout-client";
import { t } from "@/lib/app/i18n";
import { fmtFiat } from "@/lib/app/i18n/format";

import type { CardMethod, CardPayment } from "./types";

const PUBLIC = `${API_BASE}/pay-links/public`;

export interface CardStart {
  payment: CardPayment;
  checkoutUrl: string;
}

/**
 * `POST /:code/card`. `amountMinor` (the currency's minor units) only for an
 * open-amount link; a fixed link is charged its own amount.
 */
export function startCardPayment(
  code: string,
  key: string,
  body: { method: CardMethod; currency: string; amountMinor?: number; note?: string },
): Promise<CardStart> {
  return apiRequest<CardStart>(`${PUBLIC}/${encodeURIComponent(code)}/card`, { key, json: body });
}

/** `GET /card/:paymentId`. */
export async function getCardPayment(paymentId: string, key: string): Promise<CardPayment> {
  const data = await apiRequest<{ payment: CardPayment }>(`${PUBLIC}/card/${encodeURIComponent(paymentId)}`, { key });
  return data.payment;
}

/* ── The card payment this tab started ─────────────────────────────── */

const CARD_PREFIX = "hihodl:pay-links:card:";

/** Remember, for this tab, the card payment in flight on a link, so a reload keeps watching it. */
export function rememberCardPayment(code: string, paymentId: string | null): void {
  try {
    if (paymentId) window.sessionStorage.setItem(CARD_PREFIX + code, paymentId);
    else window.sessionStorage.removeItem(CARD_PREFIX + code);
  } catch {
    // Without storage a reload simply doesn't resume; the payment still settles.
  }
}

export function rememberedCardPayment(code: string): string | null {
  try {
    return window.sessionStorage.getItem(CARD_PREFIX + code);
  } catch {
    return null;
  }
}

/* ── Refusals in plain words ────────────────────────────────────────── */

export interface CardErrorContext {
  /** The card's limits, in US cents. */
  minUsdCents?: number;
  maxUsdCents?: number;
  /** Who is being paid, as the page names them. */
  payee: string;
}

/** Codes that mean "this key is spent": make a new one and ask once more. */
export const CARD_SPENT_KEY_CODES: ReadonlySet<string> = new Set(["checkout_key_reused", "payment_expired"]);

export function describeCardError(e: unknown, ctx: CardErrorContext): string {
  if (e instanceof CheckoutError) {
    switch (e.code) {
      case "card_unavailable":
        return t("payPage.err.cardUnavailable");
      case "link_not_active":
        return t("payPage.err.linkNotActive");
      case "amount_out_of_range":
        return ctx.minUsdCents !== undefined && ctx.maxUsdCents !== undefined
          ? t("payPage.err.amountOutOfRange", {
              min: fmtFiat(ctx.minUsdCents / 100, "USD"),
              max: fmtFiat(ctx.maxUsdCents / 100, "USD"),
            })
          : t("payPage.err.amountOutOfRangePlain");
      case "currency_not_supported":
        return t("payPage.err.currencyNotSupported");
      case "card_limit_reached":
        return t("payPage.err.cardLimitReached", { name: ctx.payee });
      case "link_busy":
        return t("payPage.err.linkBusy");
      case "rate_limited":
        return t("payPage.err.rateLimited");
      case "network":
        return t("payPage.err.network");
    }
  }
  return t("payPage.err.generic");
}
