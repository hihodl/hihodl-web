/**
 * Linking a phone, and withdrawals that the linked phone approves:
 * the backend's routes, exactly as documentation/
 * link-your-phone-and-approved-withdrawals.md names them. Same transport as
 * the wallet's (the person's Supabase token, authed CORS).
 *
 * The server may answer in snake_case or camelCase; each reader takes both,
 * so a naming choice on the other side does not break a screen.
 */

"use client";

import { send, WalletApiError } from "@/lib/wallet/api";
import type { WithdrawToken } from "@/lib/wallet/withdraw-core";

import type { DesktopPlatform, Phone } from "./ua";

type Raw = Record<string, unknown>;

function str(r: Raw, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/* ── Device link ──────────────────────────────────────────────────── */

export type LinkStatus = "created" | "joined" | "sealed" | "done" | "expired";

export interface LinkSession {
  sessionId: string;
  expiresAt: string;
  url: string;
}

export interface LinkState {
  status: LinkStatus;
  platform: Phone | null;
  /** base64 (or base64url) of the app's X25519 key, once the phone joined. */
  appPub: string | null;
  expiresAt: string | null;
  /**
   * Whether this link hands the phone the wallet's secret: true when the
   * account has a web wallet. false (an app-born wallet, or none yet): the
   * web seals nothing (`{ box: null, nonce: null }`). null: an older backend
   * that does not say.
   */
  carriesSecret: boolean | null;
}

export async function createLinkSession(body: { webPub: string; desktopPlatform: DesktopPlatform; desktopBrowser: string }): Promise<LinkSession> {
  const r = await send<Raw>("device-link/sessions", { json: body });
  const s = (r.session as Raw | undefined) ?? r;
  const sessionId = str(s, "sessionId", "session_id", "id");
  // No id is no session: a QR for `/link/` would lead the phone nowhere.
  if (!sessionId) throw new WalletApiError("server", 502);
  return {
    sessionId,
    expiresAt: str(s, "expiresAt", "expires_at") ?? "",
    url: str(s, "url") ?? "",
  };
}

export async function getLinkState(id: string): Promise<LinkState> {
  const r = await send<Raw>(`device-link/sessions/${encodeURIComponent(id)}`);
  const s = (r.session as Raw | undefined) ?? r;
  const platform = str(s, "platform");
  return {
    status: (str(s, "status") ?? "created") as LinkStatus,
    platform: platform === "android" || platform === "ios" ? platform : null,
    appPub: str(s, "appPub", "app_pub"),
    expiresAt: str(s, "expiresAt", "expires_at"),
    carriesSecret: typeof s.carriesSecret === "boolean" ? s.carriesSecret : typeof s.carries_secret === "boolean" ? s.carries_secret : null,
  };
}

/** `{ box: null, nonce: null }` only when the account has no web wallet (409 SECRET_REQUIRED otherwise). */
export function sealLinkSession(id: string, body: { box: string | null; nonce: string | null }): Promise<unknown> {
  return send(`device-link/sessions/${encodeURIComponent(id)}/seal`, { json: body });
}

export interface LinkedDevice {
  id: string;
  platform: Phone | "other";
  linkedAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export async function listLinkedDevices(): Promise<LinkedDevice[]> {
  const r = await send<unknown>("device-link/devices");
  const list = Array.isArray(r) ? r : (((r as Raw).devices as unknown[]) ?? []);
  return (list as Raw[]).map((d) => {
    const p = str(d, "platform");
    return {
      id: str(d, "id") ?? "",
      platform: p === "android" || p === "ios" ? p : "other",
      linkedAt: str(d, "linkedAt", "linked_at"),
      lastUsedAt: str(d, "lastUsedAt", "last_used_at"),
      revokedAt: str(d, "revokedAt", "revoked_at"),
    };
  });
}

/** Only the ones that still count: a revoked phone approves nothing. */
export async function activeLinkedDevices(): Promise<LinkedDevice[]> {
  return (await listLinkedDevices()).filter((d) => !d.revokedAt);
}

/* ── Withdrawals ──────────────────────────────────────────────────── */

/** `app`: the linked phone approves and signs. Anything else is an older server's, and the web withdraws it. */
export type WithdrawalChannel = "app" | (string & {});
export type WithdrawalStatus = "pending" | "approved" | "rejected" | "expired" | "submitted" | "confirmed" | "failed";

export interface Withdrawal {
  id: string;
  channel: WithdrawalChannel;
  status: WithdrawalStatus;
  token: WithdrawToken;
  amount: string;
  to: string;
  expiresAt: string | null;
  signature: string | null;
}

function toWithdrawal(r: Raw): Withdrawal {
  const w = (r.withdrawal as Raw | undefined) ?? r;
  return {
    id: str(w, "id") ?? "",
    channel: (str(w, "channel") ?? "app") as WithdrawalChannel,
    status: (str(w, "status") ?? "pending") as WithdrawalStatus,
    token: (str(w, "token") ?? "USDC").toUpperCase() as WithdrawToken,
    amount: String(w.amount ?? ""),
    to: str(w, "to", "to_address", "toAddress") ?? "",
    expiresAt: str(w, "expiresAt", "expires_at"),
    signature: str(w, "signature"),
  };
}

export async function createWithdrawal(body: { token: WithdrawToken; amount: string; to: string }): Promise<Withdrawal> {
  return toWithdrawal(await send<Raw>("withdrawals", { json: body }));
}

export async function getWithdrawal(id: string): Promise<Withdrawal> {
  return toWithdrawal(await send<Raw>(`withdrawals/${encodeURIComponent(id)}`));
}

/**
 * Say no to a withdrawal still pending: the app's decline, and the web's
 * Cancel while it waits for the phone. 409 NOT_PENDING once the phone decided.
 */
export async function rejectWithdrawal(id: string): Promise<unknown> {
  return send(`withdrawals/${encodeURIComponent(id)}/reject`, { json: {} });
}

/* ── The relayer (POST /relayer/solana/submit) ──────────────────────── */

/**
 * Send a transaction the linked phone signed. A spot bought on Spaces is let
 * past the relayer's gate by the phone's approval over its own bytes
 * (POST /payment-approvals/:id/authorize-device), taken before this call, so
 * it needs nothing in the body but the bytes and the key.
 */
export function relayerSubmit(body: {
  serializedTx: string;
  idempotencyKey: string;
  withdrawalId?: string;
}): Promise<{ signature: string; status: string }> {
  return send("relayer/solana/submit", { json: body });
}
