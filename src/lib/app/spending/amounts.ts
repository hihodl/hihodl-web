// src/lib/app/spending/amounts.ts: ported from the app's
// hihodl-wallet src/features/spending/amounts.ts.
//
// Shared USD-valuation for a transfer, so the analytics aggregation and the
// category drill-down list report identical figures. Uses the frozen
// usd_price_at_tx when present, else the stablecoin peg. Volatile crypto with
// no captured USD value, or a non-dollar peg with no current rate, returns 0
// (we never guess a price or a rate here).
//
// ONE DIFFERENCE FROM THE APP, AND IT IS THE APP'S OWN NO-RATE CASE
// The app asks its FX service for a non-dollar peg's rate (a euro token needs
// the euro rate). The web has no FX service, so it is always in the case the
// app's test "a spending total does not count euros as dollars" pins: no rate,
// so 0, never par.

import type { SpendTransfer as Transfer } from "./types";

/** hihodl-wallet src/constants/stablecoins.ts STABLE_TO_FIAT, verbatim. */
export const STABLE_TO_FIAT: Readonly<Record<string, string>> = {
  USDC: "USD",
  USDT: "USD",
  USDe: "USD",
  PYUSD: "USD",
  RLUSD: "USD",
  USDM: "USD",
  sUSDS: "USD",
  DAI: "USD",
  USDG: "USD",
  EURC: "EUR",
};

/** The app's `getStableFiatCurrency`: the fiat a stablecoin is pegged to, case-insensitive. */
export function getStableFiatCurrency(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const direct = STABLE_TO_FIAT[symbol];
  if (direct) return direct;
  const upper = symbol.toUpperCase();
  for (const k of Object.keys(STABLE_TO_FIAT)) {
    if (k.toUpperCase() === upper) return STABLE_TO_FIAT[k];
  }
  return null;
}

/**
 * Units of `currency` per dollar, or null when there is no rate. The app's
 * `getUsableFxRate`; on the web only the dollar has one.
 */
function getUsableFxRate(currency: string): number | null {
  return currency.toUpperCase() === "USD" ? 1 : null;
}

/** Parse a transfer amount, correcting raw EVM wei/6dp integers to human units. */
export function parseAmt(t: Transfer): number {
  const amountStr = String(t.amount ?? 0);
  let amt = parseFloat(amountStr) || 0;
  const chainKey = (t.chain || "").toLowerCase();
  const isEvm = chainKey === "ethereum" || chainKey === "polygon" || chainKey === "base";
  if (isEvm && !amountStr.includes(".")) {
    const tokenKey = (t.tokenId || (t as { token?: string }).token || t.symbol || "").toLowerCase();
    const isStable = tokenKey.includes("usdc") || tokenKey.includes("usdt") || tokenKey.includes("dai");
    const threshold = isStable ? 1_000_000 : 1e10;
    if (amt >= threshold) amt = amt / Math.pow(10, isStable ? 6 : 18);
  }
  return amt;
}

/** USD magnitude for a transfer: frozen usd_price_at_tx, else stablecoin peg. */
export function transferUsd(t: Transfer): number {
  const v = t.usdValueAtTx;
  if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v);
  const amt = parseAmt(t);
  const peg = getStableFiatCurrency(t.symbol || t.tokenId || (t as { token?: string }).token || "");
  if (peg) {
    // No current rate for the peg (a euro token and no euro rate) is the same
    // case as a volatile token with no captured value: 0, not a guess at par.
    const rate = getUsableFxRate(peg);
    return rate === null ? 0 : Math.abs(amt) / rate;
  }
  return 0;
}
