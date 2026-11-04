/**
 * The wallet's calls to the backend, straight from the browser with the
 * person's Supabase token (the same authed CORS the Spaces console uses).
 *
 * Read only: whose wallet this is and who approves a payment started here
 * (GET /wallet-backup/status), and a public address's balance. The web makes,
 * opens and signs with no wallet (Alex, 2026-09-24): no passkey, no backup,
 * no key ever reaches this page.
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";
import { accessToken } from "@/lib/creator/session";

import type { CanPayFromWeb } from "@/lib/app/app-wallet-gate";

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
 * One call. `raw` is for a route that answers with a bare body instead of
 * `{ data }` (the Solana RPC proxy).
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

/* ── Whose wallet, and who approves ───────────────────────────────── */

export type WalletState = "none" | "app_wallet" | "web_wallet";

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
  /**
   * Who approves a payment started on the web (documentation/one-wallet-every-device.md).
   * The web never pays by itself (2026-09-24), so it is always the phone:
   *   app          a phone (iPhone or Android) with a device key is linked:
   *                it approves and signs
   *   link_first   a wallet, and no phone linked: link it first
   *   none         nothing to pay from: the wallet is made in the HOLD app
   * Read it through `payerOf`.
   */
  canPayFromWeb?: CanPayFromWeb;
  /**
   * The default phone, the one that approves the web: only it gets the push,
   * and a signature from another phone is refused with 409
   * APPROVE_ON_YOUR_DEFAULT_PHONE (documentation/the-default-phone-approves.md).
   * null with no phone linked; absent from an older server.
   */
  approver?: { deviceId: string; platform: "ios" | "android" | string } | null;
}

// Pure, in lib/app/app-wallet-gate so its check script can run it.
export { payerOf, type CanPayFromWeb } from "@/lib/app/app-wallet-gate";

export function getWalletStatus(): Promise<WalletStatus> {
  return send<WalletStatus>("wallet-backup/status");
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

/* ── Can this address be paid in USDC? ────────────────────────────── */

export type UsdcAccountState = "ready" | "missing" | "not_theirs" | "frozen";

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/**
 * The publish gate's own check (`usdcAccountState` in the backend's
 * services/ad-space/solana.ts), read through the same RPC proxy: the owner's
 * canonical USDC account exists, is USDC, is still theirs and is not frozen.
 * A listing on Solana is refused at publish without it, because a sponsor
 * paying from the app could not open it for them.
 */
export async function usdcAccountState(owner: string): Promise<UsdcAccountState> {
  const { PublicKey } = await import("@solana/web3.js");
  const o = new PublicKey(owner);
  const [ata] = PublicKey.findProgramAddressSync(
    [o.toBuffer(), new PublicKey(TOKEN_PROGRAM_ID).toBuffer(), new PublicKey(USDC_MINT).toBuffer()],
    new PublicKey(ATA_PROGRAM_ID),
  );
  const info = await rpc<{ value: { data?: { parsed?: { info?: { mint?: string; owner?: string; state?: string } } } } | null } | null>(
    "getAccountInfo",
    [ata.toBase58(), { encoding: "jsonParsed", commitment: "confirmed" }],
  );
  if (!info?.value) return "missing";
  const parsed = info.value.data?.parsed?.info;
  if (!parsed || parsed.mint !== USDC_MINT || parsed.owner !== owner) return "not_theirs";
  if (parsed.state === "frozen") return "frozen";
  return "ready";
}
