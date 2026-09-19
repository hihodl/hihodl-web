/**
 * The demo's passkey: no WebAuthn sheet, a fixed credential and a fixed PRF
 * output, so every ceremony answers at once (after a short wait, so "Waiting
 * for your passkey…" shows) and every demo passkey opens the demo wallet.
 */

import { toBase64Url } from "@/lib/wallet/core";

/** Every demo passkey answers with this PRF output. */
export const DEMO_PRF_BYTES: readonly number[] = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 0xff);
/** The seeded passkey ("iCloud Keychain"), base64url as a browser spells a credential id. */
export const DEMO_PASSKEY_ID = "ZGVtby1wYXNza2V5LWljbG91ZA";

export function demoPrf(): Uint8Array {
  return new Uint8Array(DEMO_PRF_BYTES);
}

export function demoWait(ms = 700): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A new credential id for a passkey "made" in this browser. */
export function newDemoCredentialId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return toBase64Url(b);
}

/** Bytes that stand in for WebAuthn's own (client data, attestation, signature). */
export function demoBytes(label: string): string {
  return toBase64Url(new TextEncoder().encode(`demo:${label}`));
}
