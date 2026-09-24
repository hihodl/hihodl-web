/**
 * The web wallet's operations, each one ordered so that a failure at any
 * step leaves nothing half-written. The web no longer makes a wallet (Alex,
 * 2026-09-24: it is made in the HOLD app, and `PUT /wallet-backup` answers
 * 410 WEB_WALLETS_CLOSED); what is left opens one made here before:
 *
 *   openWallet      PRF → userSecret → K → mnemonic → Solana key.
 *   wrapForPasskey  the same userSecret under one more passkey; the blob is
 *                   never touched.
 *   registerWalletAddress  the address, proved by a signed message, so the
 *                   backend watches it for deposits.
 *   registerEvmSide the app's EVM xpub on ethereum, base and polygon, so the
 *                   wallet receives on every chain from the day it is made.
 */

"use client";

import {
  EVM_PATH_PREFIX,
  decryptSeedV2,
  deriveEvmKey,
  deriveSolanaKey,
  fromBase64,
  toBase64,
  unwrapUserSecret,
  wipe,
  wrapUserSecret,
  signXpubRegistration,
  type EvmKey,
  type SolanaKey,
  type WrappedSecret,
} from "./core";
import {
  addressChallenge,
  evmChallenge,
  getPepper,
  registerAddress,
  registerEvm,
  type EvmChain,
  type WalletBackup,
} from "./api";
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
 * The same, plus the EVM side for registerEvmSide: the Wallet page's unlock,
 * which is where an older web wallet that never registered it catches up.
 * The caller hands `evm` to registerEvmSide, which wipes its key.
 */
export async function openWalletWithEvm(args: {
  uid: string;
  backup: WalletBackup;
  credentialId: string;
  prf: Uint8Array;
}): Promise<{ key: SolanaKey; evm: EvmKey | null }> {
  const mnemonic = await openMnemonic(args);
  const key = await deriveSolanaKey(mnemonic);
  const evm = await deriveEvmKey(mnemonic).catch(() => null);
  return { key, evm };
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

/**
 * Register the wallet's EVM side (ethereum, base, polygon) exactly as the
 * app's completeWalletSetup does: the xpub at m/44'/60'/0' and, per chain,
 * an EIP-191 signature by the primary over the app's own words with a
 * single-use nonce. The server runs the app's POST /xpubs for each.
 *
 * The words are built HERE from the challenge's fields (account id, chain,
 * timestamp) and this key's own xpub and address; nothing the server sends is
 * signed as given. That registration is the only EVM signature the web ever
 * makes: it never signs an EVM transaction.
 *
 * `known` are the addresses the backend already shows (GET /me/addresses):
 * when all three chains have this address, nothing is asked. Best effort,
 * like registerWalletAddress: a failure changes nothing and the next unlock
 * tries again. Always wipes the key.
 */
export async function registerEvmSide(
  evm: EvmKey | null,
  known?: Partial<Record<string, string | null | undefined>> | null,
): Promise<"registered" | "already" | "conflict" | "failed"> {
  if (!evm) return "failed";
  try {
    const chains: EvmChain[] = ["ethereum", "base", "polygon"];
    if (known && chains.every((c) => (known[c] ?? "").toLowerCase() === evm.address.toLowerCase())) return "already";
    const ch = await evmChallenge({ xpub: evm.xpub, address: evm.address });
    if (ch.path_prefix !== EVM_PATH_PREFIX || ch.address.toLowerCase() !== evm.address.toLowerCase()) return "failed";
    const todo = ch.chains.filter((c) => c.state === "to_register" && c.nonce);
    if (todo.length === 0) return ch.chains.some((c) => c.state === "conflict") ? "conflict" : "already";
    const registrations = todo.map((c) => ({
      chain: c.chain,
      nonce: c.nonce as string,
      signature: signXpubRegistration(evm, { accountId: ch.account_id, chain: c.chain, timestamp: ch.timestamp }),
    }));
    const out = await registerEvm({ xpub: evm.xpub, signed_by_address: evm.address, timestamp: ch.timestamp, registrations });
    if (out.results.some((r) => !r.ok)) return "failed";
    return ch.chains.some((c) => c.state === "conflict") ? "conflict" : "registered";
  } catch {
    return "failed";
  } finally {
    wipe(evm.privateKey);
  }
}
