/**
 * Bytes, as the link screen and the payment approvals need them: base64 in
 * and out, and a best-effort wipe. No DOM, no network, no React.
 *
 * This was the web wallet's cryptography (seed backup, passkey PRF wrapping,
 * key derivation). The web makes and opens no wallet any more (Alex,
 * 2026-09-24): the wallet is made in the HOLD app and the linked phone
 * approves and signs, so only these helpers are left.
 */

/** Best effort: JavaScript gives no guarantee a buffer is not copied elsewhere. */
export function wipe(...bufs: (Uint8Array | null | undefined)[]): void {
  for (const b of bufs) b?.fill(0);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(u8: Uint8Array): string {
  let out = "";
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i];
    const b = i + 1 < u8.length ? u8[i + 1] : 0;
    const c = i + 2 < u8.length ? u8[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < u8.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < u8.length ? B64[n & 63] : "=";
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) throw new Error("bad base64");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function toBase64Url(u8: Uint8Array): string {
  return toBase64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
