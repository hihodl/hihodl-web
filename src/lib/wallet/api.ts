/**
 * The web wallet's calls to the backend, straight from the browser with the
 * person's Supabase token (the same authed CORS the Spaces console uses).
 *
 * What travels: ciphertext, wrappings, the pepper, a passkey's public
 * registration, and a public Solana address for its balance. What never
 * travels: the mnemonic, userSecret, a PRF output, a private key.
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";
import { accessToken } from "@/lib/creator/session";

import type { CipherBlobV2, WrappedSecret } from "./core";

export class WalletApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "WalletApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

/**
 * One call. `raw` is for the two passkey routes that answer with a bare body
 * instead of `{ data }`.
 */
export async function send<T>(path: string, init: { method?: Method; json?: unknown; auth?: boolean; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.auth !== false) {
    const token = await accessToken();
    if (!token) throw new WalletApiError("UNAUTHORIZED", 401);
    headers.authorization = `Bearer ${token}`;
  }
  if (init.json !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}`, {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new WalletApiError("network", 0);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !body || body.error) {
    const err = body?.error;
    const code = err?.details?.code ?? err?.code ?? (res.status === 429 ? "rate_limited" : res.status === 404 ? "not_found" : "server");
    throw new WalletApiError(code, res.status, err?.details ?? {});
  }
  if (init.raw) return body as T;
  if (body.data === undefined) throw new WalletApiError("server", res.status);
  return body.data as T;
}

/* ── Wallet backup v2 ─────────────────────────────────────────────── */

export type WalletState = "none" | "app_wallet" | "web_wallet";

export interface WrappingMeta {
  credential_id: string;
  label: string | null;
  created_at: string;
}

export interface WalletStatus {
  state: WalletState;
  /**
   * The rollout gate. false: the web shows no wallet at all (no nav item, no
   * page). Always true for somebody who already has a web wallet. An older
   * backend without the field reads as enabled.
   */
  enabled?: boolean;
  /** The Solana address the backend watches for this account, if any. */
  registered_address?: string | null;
  current_blob_hash: string | null;
  wrappings: WrappingMeta[];
  email_verified: boolean;
}

export interface WalletBackup {
  cipher_blob: CipherBlobV2;
  current_blob_hash: string;
  wrappings: (WrappingMeta & { wrapped: WrappedSecret })[];
}

export function getWalletStatus(): Promise<WalletStatus> {
  return send<WalletStatus>("wallet-backup/status");
}

export function getWalletBackup(): Promise<WalletBackup> {
  return send<WalletBackup>("wallet-backup");
}

/** Create, once. `previous_blob_hash: null` is the compare-and-swap against nothing. */
export function createWalletBackup(body: {
  cipher_blob: CipherBlobV2;
  wrapping: { credential_id: string; wrapped: WrappedSecret; label: string | null };
}): Promise<{ saved: boolean; idempotent: boolean; current_blob_hash: string }> {
  return send("wallet-backup", { method: "PUT", json: { ...body, previous_blob_hash: null } });
}

export function addWrapping(body: { credential_id: string; wrapped: WrappedSecret; label: string | null }): Promise<{ added: boolean }> {
  return send("wallet-backup/wrappings", { method: "POST", json: body });
}

export function removeWrapping(credentialId: string): Promise<{ removed: boolean }> {
  return send(`wallet-backup/wrappings/${encodeURIComponent(credentialId)}`, { method: "DELETE" });
}

/**
 * Registering this wallet's address so the backend watches it for deposits
 * (the app does the same through register-primary). A single-use challenge,
 * signed as a message by the unlocked key; never a transaction.
 */
export function addressChallenge(address: string): Promise<{ nonce: string; message: string; expires_in_minutes: number }> {
  return send("wallet-backup/address/challenge", { json: { address } });
}

export function registerAddress(body: { address: string; nonce: string; signature: string }): Promise<{ address: string; registered: boolean; idempotent: boolean }> {
  return send("wallet-backup/address", { json: body });
}

/** The per-person pepper (half of v1's key, one of three inputs to v2's). */
export async function getPepper(): Promise<string> {
  const d = await send<{ pepper: string }>("security/pepper");
  return d.pepper;
}

/* ── Passkeys (the existing /passkeys routes) ─────────────────────── */

export interface RegistrationOptionsJSON {
  challenge: string;
  rp: { name: string; id?: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  timeout?: number;
  excludeCredentials?: { id: string; type: "public-key"; transports?: string[] }[];
  authenticatorSelection?: Record<string, unknown>;
  attestation?: string;
  extensions?: Record<string, unknown>;
}

export async function beginPasskeyRegistration(email: string, supabaseUid: string): Promise<RegistrationOptionsJSON> {
  const body = await send<{ publicKey: RegistrationOptionsJSON }>("passkeys/register/begin", {
    json: { email, userId: supabaseUid },
    raw: true,
  });
  return body.publicKey;
}

export function completePasskeyRegistration(credential: {
  id: string;
  rawId: string;
  type: "public-key";
  response: { clientDataJSON: string; attestationObject: string };
}): Promise<{ success: boolean; credentialId: string }> {
  return send("passkeys/register/complete", { json: { credential } });
}

export interface RegisteredPasskey {
  id: string;
  name: string;
  deviceType: string | null;
  createdAt: string;
}

export async function listPasskeys(): Promise<RegisteredPasskey[]> {
  const d = await send<{ passkeys: RegisteredPasskey[] }>("passkeys/list");
  return d.passkeys;
}

/* ── Balances (the authed Solana RPC proxy) ───────────────────────── */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const body = await send<{ result?: T; error?: { message?: string } }>("rpc/solana", {
    json: { jsonrpc: "2.0", id: 1, method, params },
    raw: true,
  });
  if (body.error || body.result === undefined) throw new WalletApiError("rpc", 502);
  return body.result;
}

export interface Balances {
  sol: number;
  usdc: number;
}

/** Read-only: lamports and the USDC token accounts of a public address. */
export async function getBalances(address: string): Promise<Balances> {
  const [lamports, tokens] = await Promise.all([
    rpc<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]),
    rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] }>(
      "getTokenAccountsByOwner",
      [address, { mint: USDC_MINT }, { encoding: "jsonParsed", commitment: "confirmed" }],
    ),
  ]);
  const usdc = tokens.value.reduce((s, a) => s + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
  return { sol: lamports.value / 1e9, usdc };
}
