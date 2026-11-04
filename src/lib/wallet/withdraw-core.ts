/**
 * The pure half of a send from the web: amounts and addresses. No DOM, no
 * network, no web3.js, so `npx sucrase-node src/lib/link/sas.check.ts` proves
 * it too. The send itself is approved and signed on the linked phone.
 */

import { base58 } from "@scure/base";

export type WithdrawToken = "USDC" | "SOL";

export const DECIMALS: Record<WithdrawToken, number> = { USDC: 6, SOL: 9 };

/** A Solana address: base58 of exactly 32 bytes. Not an 0x address, not a token account check. */
export function isSolanaAddress(s: string): boolean {
  const t = s.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return false;
  try {
    return base58.decode(t).length === 32;
  } catch {
    return false;
  }
}

/**
 * "12.5" → 12500000n for USDC. Exact, no floating point: refuses more
 * decimals than the token has, a sign, an exponent, or zero.
 */
export function toBaseUnits(amount: string, token: WithdrawToken): bigint | null {
  const t = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const d = DECIMALS[token];
  if (frac.length > d) return null;
  const units = BigInt(whole) * 10n ** BigInt(d) + BigInt((frac + "0".repeat(d)).slice(0, d) || "0");
  return units > 0n ? units : null;
}

/** 12500000n → "12.5". */
export function fromBaseUnits(units: bigint, token: WithdrawToken): string {
  const d = BigInt(DECIMALS[token]);
  const base = 10n ** d;
  const whole = units / base;
  const frac = (units % base).toString().padStart(Number(d), "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** The amount as the API and the quote take it: plain decimal, trimmed ("12.50" → "12.5"). */
export function canonicalAmount(amount: string, token: WithdrawToken): string | null {
  const u = toBaseUnits(amount, token);
  return u === null ? null : fromBaseUnits(u, token);
}

/**
 * Did this send pay the request it was opened for?
 *
 * Pay on a payment request opens Send filled in, and the person may change
 * any of it. Only a send to the same address, in the same token, for the same
 * amount closes the request: settling one after they sent something else, or
 * to somebody else, would tell the person who asked that they were paid.
 * Compared in base units, so "25" and "25.000000" are the same amount.
 */
export function paysTheRequest(
  asked: { to?: string; amount?: string; token?: WithdrawToken },
  sent: { to: string; amount: string; token: WithdrawToken },
): boolean {
  if (!asked.to || !asked.amount) return false;
  if (asked.to !== sent.to || (asked.token ?? "USDC") !== sent.token) return false;
  const a = toBaseUnits(asked.amount, sent.token);
  const b = toBaseUnits(sent.amount, sent.token);
  return a !== null && b !== null && a === b;
}
