/**
 * The web wallet's three operations, each one ordered so that a failure at
 * any step leaves nothing half-written:
 *
 *   sealNewWallet   make the mnemonic, prove the whole chain opens in memory,
 *                   THEN upload blob + first wrapping in one call (CAS null).
 *   openWallet      PRF → userSecret → K → mnemonic → Solana key.
 *   wrapForPasskey  the same userSecret under one more passkey; the blob is
 *                   never touched.
 *   registerWalletAddress  the address, proved by a signed message, so the
 *                   backend watches it for deposits.
 */

"use client";

import {
  decryptSeedV2,
  deriveSolanaKey,
  encryptSeedV2,
  fromBase64,
  generateMnemonic,
  newUserSecret,
  toBase64,
  unwrapUserSecret,
  wipe,
  wrapUserSecret,
  type SolanaKey,
  type WrappedSecret,
} from "./core";
import { addressChallenge, createWalletBackup, getPepper, registerAddress, WalletApiError, type WalletBackup } from "./api";
import { normalizeCredentialId } from "./passkey";
import { signChallenge } from "./vault";

export class WalletFlowError extends Error {
  constructor(readonly code: "unknown_passkey" | "self_check_failed" | "upload_failed", readonly cause?: unknown) {
    super(code);
    this.name = "WalletFlowError";
  }
}

async function pepperBytes(): Promise<Uint8Array> {
  return fromBase64(await getPepper());
}

/**
 * Create the wallet. The caller has already checked the account has no
 * wallet of any kind; the server checks again and refuses to overwrite.
 *
 * The self-check before the upload is the point: the blob is stored only
 * after this tab has opened it with the passkey's own PRF output, so a
 * wallet we could not open is never the one we save.
 */
export async function sealNewWallet(args: {
  uid: string;
  credentialId: string;
  prf: Uint8Array;
  label: string | null;
}): Promise<SolanaKey> {
  const mnemonic = generateMnemonic();
  const userSecret = newUserSecret();
  const pepper = await pepperBytes();
  let check: Uint8Array | null = null;
  try {
    const blob = await encryptSeedV2({ uid: args.uid, pepper, userSecret, mnemonic });
    const wrapped = await wrapUserSecret(args.prf, userSecret);

    check = await unwrapUserSecret(args.prf, wrapped);
    const reopened = await decryptSeedV2({ uid: args.uid, pepper, userSecret: check, blob });
    if (reopened !== mnemonic) throw new WalletFlowError("self_check_failed");

    const key = await deriveSolanaKey(mnemonic);

    // The same blob sent again is an idempotent success, so a dropped
    // response is retried rather than reported as a failure.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await createWalletBackup({
          cipher_blob: blob,
          wrapping: { credential_id: normalizeCredentialId(args.credentialId), wrapped, label: args.label },
        });
        return key;
      } catch (e) {
        lastError = e;
        if (!(e instanceof WalletApiError) || (e.status !== 0 && e.status < 500)) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    wipe(key.seed);
    throw lastError instanceof WalletApiError ? lastError : new WalletFlowError("upload_failed", lastError);
  } finally {
    wipe(userSecret, pepper, check);
  }
}

function wrappingFor(backup: WalletBackup, credentialId: string): WrappedSecret {
  const id = normalizeCredentialId(credentialId);
  const w = backup.wrappings.find((x) => normalizeCredentialId(x.credential_id) === id);
  if (!w) throw new WalletFlowError("unknown_passkey");
  return w.wrapped;
}

/** The userSecret this passkey unwraps. Caller wipes it. */
export async function userSecretFrom(backup: WalletBackup, credentialId: string, prf: Uint8Array): Promise<Uint8Array> {
  return unwrapUserSecret(prf, wrappingFor(backup, credentialId));
}

/** The mnemonic, for the export screen or for deriving the key. */
export async function openMnemonic(args: {
  uid: string;
  backup: WalletBackup;
  credentialId: string;
  prf: Uint8Array;
}): Promise<string> {
  const userSecret = await userSecretFrom(args.backup, args.credentialId, args.prf);
  const pepper = await pepperBytes();
  try {
    return await decryptSeedV2({ uid: args.uid, pepper, userSecret, blob: args.backup.cipher_blob });
  } finally {
    wipe(userSecret, pepper);
  }
}

export async function openWallet(args: {
  uid: string;
  backup: WalletBackup;
  credentialId: string;
  prf: Uint8Array;
}): Promise<SolanaKey> {
  const mnemonic = await openMnemonic(args);
  return deriveSolanaKey(mnemonic);
}

/**
 * The wrapping for one more passkey, checked before it is returned: it must
 * unwrap to the same secret with the new passkey's PRF output.
 */
export async function wrapForPasskey(userSecret: Uint8Array, prf: Uint8Array): Promise<WrappedSecret> {
  const wrapped = await wrapUserSecret(prf, userSecret);
  const back = await unwrapUserSecret(prf, wrapped);
  const same = back.length === userSecret.length && back.every((b, i) => b === userSecret[i]);
  wipe(back);
  if (!same) throw new WalletFlowError("self_check_failed");
  return wrapped;
}

/**
 * Tell the backend this wallet's address, so it is watched for deposits and
 * shows in activity like the app's (the backend runs the app's own
 * registration path, Helius webhook included).
 *
 * The server issues a single-use nonce and the exact words; the unlocked key
 * signs those words as a MESSAGE (vault.signChallenge refuses anything else).
 * Idempotent on the server, and skipped when the backend already has this
 * address. Best effort: a failure changes nothing and is retried on the next
 * unlock.
 */
export async function registerWalletAddress(address: string, registered: string | null | undefined): Promise<"registered" | "already" | "failed"> {
  if (registered === address) return "already";
  try {
    const challenge = await addressChallenge(address);
    const signature = toBase64(signChallenge(challenge.message));
    await registerAddress({ address, nonce: challenge.nonce, signature });
    return "registered";
  } catch {
    return "failed";
  }
}
