/**
 * The six digits both screens show while a phone is being linked
 * (documentation/link-your-phone-and-approved-withdrawals.md, "Short code"):
 *
 *   sas = sha256(utf8("hihodl/link/v1") ‖ utf8(sessionId) ‖ webPub ‖ appPub)
 *   first 4 bytes as a big-endian uint32, mod 1 000 000, zero-padded to 6
 *
 * webPub and appPub are the raw 32-byte X25519 public keys, never their
 * base64. If the server swapped either key, the two screens disagree, and the
 * person refuses before anything is sealed.
 *
 * Pure (no DOM, no network) so `npx sucrase-node src/lib/link/sas.check.ts`
 * can prove it outside a browser.
 */

import { sha256 } from "@noble/hashes/sha256";

export const SAS_DOMAIN = "hihodl/link/v1";

export function sasBytes(sessionId: string, webPub: Uint8Array, appPub: Uint8Array): Uint8Array {
  if (webPub.length !== 32 || appPub.length !== 32) throw new Error("bad key length");
  const enc = new TextEncoder();
  const parts = [enc.encode(SAS_DOMAIN), enc.encode(sessionId), webPub, appPub];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return sha256(all);
}

/** "042917": the code the person compares with the phone. */
export function computeSas(sessionId: string, webPub: Uint8Array, appPub: Uint8Array): string {
  const h = sasBytes(sessionId, webPub, appPub);
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

/** "042 917", easier to read aloud and compare. */
export function formatSas(sas: string): string {
  return `${sas.slice(0, 3)} ${sas.slice(3)}`;
}
