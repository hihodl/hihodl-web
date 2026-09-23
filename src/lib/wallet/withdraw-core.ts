/**
 * The pure half of a withdrawal from the web wallet: amounts, addresses and
 * the hash a passkey assertion is bound to. No DOM, no network, no web3.js,
 * so `npx sucrase-node src/lib/link/sas.check.ts` proves it too.
 *
 * documentation/link-your-phone-and-approved-withdrawals.md:
 *
 *   challenge = sha256(utf8("hihodl/withdrawal/v1") ‖ utf8(id) ‖ sha256(message))
 *
 * The web computes it itself and refuses to prompt for a passkey when the
 * server's options carry anything else: an assertion is then only ever
 * about the transfer this screen built and showed.
 */

import { sha256 } from "@noble/hashes/sha256";
import { base58 } from "@scure/base";

export type WithdrawToken = "USDC" | "SOL";

export const DECIMALS: Record<WithdrawToken, number> = { USDC: 6, SOL: 9 };

export const WITHDRAWAL_DOMAIN = "hihodl/withdrawal/v1";

export function withdrawalChallenge(id: string, message: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const a = enc.encode(WITHDRAWAL_DOMAIN);
  const b = enc.encode(id);
  const c = sha256(message);
  const all = new Uint8Array(a.length + b.length + c.length);
  all.set(a, 0);
  all.set(b, a.length);
  all.set(c, a.length + b.length);
  return sha256(all);
}

/**
 * The challenge `POST /withdrawals/tx-challenge` must answer for bytes the
 * SERVER built (a spot, a stay's bridge deposit):
 *
 *   challenge = sha256(utf8("hihodl/tx/v1") ‖ sha256(message))
 *
 * Checked here before the passkey is asked, as a withdrawal's is: the prompt
 * only ever approves the transaction this page is holding.
 */
export const TX_DOMAIN = "hihodl/tx/v1";

export function txChallenge(message: Uint8Array): Uint8Array {
  const a = new TextEncoder().encode(TX_DOMAIN);
  const c = sha256(message);
  const all = new Uint8Array(a.length + c.length);
  all.set(a, 0);
  all.set(c, a.length);
  return sha256(all);
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

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
