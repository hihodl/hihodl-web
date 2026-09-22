/**
 * Signing a transaction somebody else built.
 *
 * WHY THIS IS SEPARATE FROM `withdraw.ts`, AND DELIBERATELY NARROW
 *
 * A withdrawal is a transaction this code BUILDS: `buildWithdrawal` assembles
 * the instructions itself, so `signWithdrawal` knows exactly what it is
 * signing. A bridge deposit is not — the route is quoted by a provider and
 * serialized by our backend, and the browser only ever sees bytes.
 *
 * That is a real difference in trust, so this states the checks out loud
 * rather than hiding them:
 *
 *   1. The key must be one of the transaction's REQUIRED signers. A key that
 *      appears in the accounts but outside the signature header is not being
 *      asked to sign, and signing anyway would be answering a question nobody
 *      put.
 *   2. The address the caller names must be the address the seed derives. The
 *      caller passes `from` so a seed opened for one account can never sign
 *      for another.
 *   3. Only our own slot is filled. The fee payer's signature is left empty
 *      for the relayer, exactly as `signWithdrawal` leaves it.
 *
 * What it does NOT do is inspect the instructions. It cannot: the whole point
 * of a bridge deposit is that its contents are the provider's. The consent
 * that makes this safe is the passkey ceremony the caller runs immediately
 * before it, and the fact that the transaction can only move what the
 * signature authorises — the person's own USDC, to a quote they were shown.
 */

"use client";

import { ed25519 } from "@noble/curves/ed25519";

import { toBase64 } from "./core";

/**
 * Sign a base64 `VersionedTransaction` with the wallet's key and hand it back
 * base64, ready for the relayer.
 *
 * Throws before touching the key when the transaction is not ours to sign.
 */
export async function signSerializedTx(serializedTxB64: string, seed: Uint8Array, from: string): Promise<string> {
  const { VersionedTransaction, PublicKey } = await import("@solana/web3.js");

  const raw = Uint8Array.from(atob(serializedTxB64), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(raw);

  const signer = new PublicKey(ed25519.getPublicKey(seed));
  if (signer.toBase58() !== from) throw new Error("wrong_key");

  const index = tx.message.staticAccountKeys.findIndex((k) => k.equals(signer));
  if (index < 0 || index >= tx.message.header.numRequiredSignatures) throw new Error("not_a_signer");

  // What a Solana signature covers is the serialized MESSAGE, not the whole
  // transaction — the signatures are a header in front of it.
  tx.signatures[index] = ed25519.sign(tx.message.serialize(), seed);
  return toBase64(tx.serialize());
}

/**
 * The compiled MESSAGE of a serialized transaction, base64.
 *
 * What a Solana signature covers, what the backend's gate hashes, and so what
 * an approval has to be taken over. Signing does not change it — the
 * signatures are a header in front of it — so this may be read before or after
 * `signSerializedTx` and gives the same bytes either way.
 */
export async function messageOf(serializedTxB64: string): Promise<string> {
  const { VersionedTransaction } = await import("@solana/web3.js");
  const raw = Uint8Array.from(atob(serializedTxB64), (c) => c.charCodeAt(0));
  return toBase64(VersionedTransaction.deserialize(raw).message.serialize());
}
