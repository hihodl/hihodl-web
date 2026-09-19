/**
 * Linking a phone, and withdrawals that a phone or a passkey approves:
 * the backend's routes, exactly as documentation/
 * link-your-phone-and-approved-withdrawals.md names them. Same transport as
 * the wallet's (the person's Supabase token, authed CORS).
 *
 * The server may answer in snake_case or camelCase; each reader takes both,
 * so a naming choice on the other side does not break a screen.
 */

"use client";

import { send } from "@/lib/wallet/api";
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
  /** base64 (or base64url) of the app's X25519 key, once an Android phone joined. */
  appPub: string | null;
  expiresAt: string | null;
}

export async function createLinkSession(body: { webPub: string; desktopPlatform: DesktopPlatform; desktopBrowser: string }): Promise<LinkSession> {
  const r = await send<Raw>("device-link/sessions", { json: body });
  const s = (r.session as Raw | undefined) ?? r;
  return {
    sessionId: str(s, "sessionId", "session_id", "id") ?? "",
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
  };
}

export function joinLinkSession(id: string, body: { platform: Phone; appPub?: string }): Promise<unknown> {
  return send(`device-link/sessions/${encodeURIComponent(id)}/join`, { json: body });
}

export function sealLinkSession(id: string, body: { box: string; nonce: string }): Promise<unknown> {
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

export function revokeLinkedDevice(id: string): Promise<unknown> {
  return send(`device-link/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ── Withdrawals ──────────────────────────────────────────────────── */

export type WithdrawalChannel = "app" | "web_passkey";
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

/** WebAuthn request options, JSON-encoded the way @simplewebauthn/server writes them. */
export interface AssertionOptionsJSON {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: { id: string; type: "public-key"; transports?: string[] }[];
}

/**
 * `{ publicKey, messageHash }`. A second call replaces the first challenge
 * (the server rebuilds it from the stored hash when the assertion comes).
 */
export async function withdrawalPasskeyChallenge(id: string, message: string): Promise<{ options: AssertionOptionsJSON; messageHash: string | null }> {
  const r = await send<Raw>(`withdrawals/${encodeURIComponent(id)}/passkey-challenge`, { json: { message } });
  const options = (r.publicKey as AssertionOptionsJSON | undefined) ?? (r.options as AssertionOptionsJSON | undefined) ?? (r as unknown as AssertionOptionsJSON);
  return { options, messageHash: str(r, "messageHash", "message_hash") };
}

export async function authorizeWithdrawalPasskey(id: string, assertion: unknown): Promise<Withdrawal> {
  return toWithdrawal(await send<Raw>(`withdrawals/${encodeURIComponent(id)}/authorize-passkey`, { json: { assertion } }));
}

/* ── The relayer (POST /relayer/solana/quote and /submit) ─────────── */

export interface RelayerQuote {
  blockhash: string;
  relayerPublicKey: string;
  idempotencyKey: string;
  computeUnits?: number;
  priorityFeeLamports?: string;
  /** Present only when the recipient's token account has to be bought: the sender pays it back in the same transaction. */
  sponsorship?: {
    accountsToCreate: number;
    chargeBaseUnits: string;
    chargeMint: string;
    treasuryTokenAccount: string;
  } | null;
}

export function relayerQuote(body: { tokenId: string; amount: string; to: string; from: string }): Promise<RelayerQuote> {
  // Sponsored (no USDC rebate leg): a withdrawal's bytes are one transfer, which is what the server checks.
  return send<RelayerQuote>("relayer/solana/quote", { json: { ...body, sponsored: true } });
}

export function relayerSubmit(body: { serializedTx: string; idempotencyKey: string; withdrawalId: string }): Promise<{ signature: string; status: string }> {
  return send("relayer/solana/submit", { json: body });
}
