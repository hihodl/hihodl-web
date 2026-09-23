/**
 * The transfer row the spending modules read.
 *
 * It is the web's `Transfer` (lib/app/hold-api) with the three places where the
 * app's own type (hihodl-wallet src/types/api.ts `Transfer`) says more: the
 * direction includes `swap`, the counterparty type is the backend's closed set,
 * and a card row carries its `mcc`. The server sends the same JSON to both; only
 * the web's type was narrower. `asSpendTransfers` is the one place that says so.
 */

import type { Transfer } from "../hold-api";

export type CounterpartyType = "hihodl_user" | "crypto_wallet" | "bank" | "card" | "mobile_money";

export type SpendTransfer = Omit<Transfer, "direction" | "counterpartyType"> & {
  direction?: "in" | "out" | "move" | "swap" | "exchange";
  counterpartyType?: CounterpartyType | null;
  /** ISO 18245 merchant category code, on card spend only. */
  mcc?: string | null;
  description?: string | null;
};

/** The rows `/transfers` answered, read as the app reads them. */
export function asSpendTransfers(rows: readonly Transfer[]): SpendTransfer[] {
  return rows as unknown as SpendTransfer[];
}
