/**
 * The link session's key pair: X25519 (`nacl.box`), ephemeral, made when the
 * session opens and kept only in this tab's memory. Its public half is in the
 * QR and in the six-digit code both screens compute (./sas). Nothing is sealed
 * with it any more: the web holds no wallet secret to send (Alex, 2026-09-24).
 *
 * Pure (tweetnacl, no DOM).
 */

import nacl from "tweetnacl";

export interface LinkKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function newLinkKeyPair(): LinkKeyPair {
  return nacl.box.keyPair();
}
