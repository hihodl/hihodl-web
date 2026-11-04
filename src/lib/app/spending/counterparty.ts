// src/lib/app/spending/counterparty.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/counterparty.ts. Change the app first, then this.
//
// "WHAT is the other side of this payment?" — the missing signal Alex asked for.
// `Transfer.method` only carries the RAIL (crypto/pix/iban/card); it doesn't say
// whether the counterparty is a person, a raw wallet, a bank, a card merchant or
// a mobile-money wallet. Knowing that is what lets analytics categorize
// accurately (bank → payout/fiat, hihodl_user → a person, card → card spend)
// instead of guessing from merchant text.
//
// The real field is `Transfer.counterpartyType`, populated by the backend at
// send time (CTO deploy). Until every row has it, `inferCounterpartyType`
// DERIVES it on-device from the signals we already have, so categorization is
// better TODAY and upgrades seamlessly when the captured field lands.

import type { CounterpartyType, SpendTransfer as Transfer } from "./types";
import type { CategoryId } from "./categories";
import { t } from "../i18n";

export type { CounterpartyType };

/** True when this counterparty type settles in fiat (bank / card / wallet cash). */
export function isFiatCounterparty(type: CounterpartyType | null | undefined): boolean {
  return type === "bank" || type === "card" || type === "mobile_money";
}

// Canonical set of payment rails that settle into a bank / fiat account — i.e.
// an OFF-RAMP, not consumption. Single source of truth, shared with
// categorize.ts, so the "payout" classification can never drift between the two
// files. Country-specific rails double as the destination-country signal for
// the payouts/geography KPI (pix→BR, spei→MX, nuban→NG, pse→CO).
export const BANK_RAILS = new Set<string>([
  "iban", // SEPA / EU bank transfer
  "sepa",
  "wire", // international wire
  "ach", // US
  "pix", // Brazil
  "spei", // Mexico
  "nuban", // Nigeria bank account
  "pse", // Colombia
  "mercadopago",
]);

/** True when a rail string denotes a bank/fiat off-ramp (case-insensitive). */
export function isBankRail(method: string | null | undefined): boolean {
  return !!method && BANK_RAILS.has(method.toLowerCase());
}

/**
 * Best-effort counterparty type from whatever the transfer carries. Prefers the
 * real backend field; otherwise derives it:
 *   • method card              → card
 *   • method iban/pix/mp       → bank (fiat off-ramp)
 *   • @alias present           → hihodl_user (in-network peer)
 *   • raw 0x / base58 address  → crypto_wallet
 * Returns null only when there's genuinely no signal.
 */
export function inferCounterpartyType(t: Transfer): CounterpartyType | null {
  if (t.counterpartyType) return t.counterpartyType;

  const method = (t.method || "").toLowerCase();
  if (method === "card") return "card";
  if (isBankRail(method)) return "bank";

  const inbound = t.direction === "in";
  const alias = (inbound ? t.fromAlias : t.toAlias) || "";
  if (alias.trim().startsWith("@")) return "hihodl_user";

  const addr = (inbound ? t.fromAddress : t.toAddress) || "";
  if (addr.startsWith("0x") && addr.length > 12) return "crypto_wallet";
  if (addr.length >= 32 && addr.length <= 44) return "crypto_wallet";
  if (addr.startsWith("bc1") || addr.length >= 26) return "crypto_wallet";

  return null;
}

/**
 * The category a counterparty type most strongly implies, when it maps cleanly
 * to one. Used as a HIGH-priority hint before keyword heuristics — but only for
 * types with an unambiguous meaning. Card/bank don't map to a single spending
 * category (a card buys anything), so they return null and let MCC / keywords
 * decide the sub-category.
 */
export function categoryFromCounterpartyType(
  type: CounterpartyType | null | undefined,
): CategoryId | null {
  switch (type) {
    case "hihodl_user":
      return "people"; // paying another HOLD user = a person, not a merchant
    case "mobile_money":
      return "people"; // GCash/bKash transfers are person-to-person cash
    default:
      return null; // card / bank / crypto_wallet → decided by MCC or keywords
  }
}

/**
 * Derive the counterparty type from a recipient string at SEND time — the one
 * moment the client unambiguously knows what it's paying. `@handle` → an
 * in-network HOLD user; anything else (0x…, base58, bc1…) → a raw crypto
 * wallet. Fiat rails (PIX / IBAN / card) run through their own send paths and
 * set `bank` / `card` explicitly.
 */
export function counterpartyTypeFromRecipient(to: string | null | undefined): CounterpartyType {
  const raw = (to || "").trim();
  if (raw.startsWith("@")) return "hihodl_user";
  return "crypto_wallet";
}

/** Human label for a counterparty type (for tx details / debugging surfaces). */
export function counterpartyTypeLabel(type: CounterpartyType | null | undefined): string {
  switch (type) {
    case "hihodl_user":
      return t("analytics.counterpartyType.hihodlUser");
    case "crypto_wallet":
      return t("analytics.counterpartyType.cryptoWallet");
    case "bank":
      return t("analytics.counterpartyType.bank");
    case "card":
      return t("analytics.counterpartyType.card");
    case "mobile_money":
      return t("analytics.counterpartyType.mobileMoney");
    default:
      return t("analytics.counterpartyType.unknown");
  }
}
