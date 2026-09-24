/**
 * The box that carries an older web wallet to the phone being linked.
 *
 * X25519 + XSalsa20-Poly1305 (`nacl.box`), both key pairs ephemeral: the web
 * pair is made when the link session opens and lives only in this tab's
 * memory, the app's only on the phone. What goes in is the 32-byte
 * `userSecret` of recovery v3, never the seed or the words; the app rebuilds
 * the seed from it exactly as a passkey restore does.
 *
 * Pure (tweetnacl, no DOM), so the check script can open what this seals.
 */

import nacl from "tweetnacl";

export interface LinkKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function newLinkKeyPair(): LinkKeyPair {
  return nacl.box.keyPair();
}

export function sealSecret(userSecret: Uint8Array, appPub: Uint8Array, webSecret: Uint8Array): { box: Uint8Array; nonce: Uint8Array } {
  if (userSecret.length !== 32) throw new Error("bad secret length");
  if (appPub.length !== nacl.box.publicKeyLength) throw new Error("bad app key");
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(userSecret, nonce, appPub, webSecret);
  return { box, nonce };
}

/** What the app does with it; here only for the check script. */
export function openSecret(box: Uint8Array, nonce: Uint8Array, webPub: Uint8Array, appSecret: Uint8Array): Uint8Array | null {
  return nacl.box.open(box, nonce, webPub, appSecret);
}
