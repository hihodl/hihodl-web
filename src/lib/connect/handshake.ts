/**
 * HOLD Connect for the computer, the popup's side of the handshake
 * (documentation/hold-connect-v0.md, "The fourth door").
 *
 *   site (opener)                         app.hihodl.xyz/connect (this popup)
 *   window.open(connectUrl) ───────────▶  load; post {type:"hold-connect:ready"} to opener, "*"
 *   post {type:"hold-connect:hello", appName} ─▶ the site's origin is event.origin, nothing else
 *                                         ... the default phone approves ...
 *   ◀── {type:"hold-connect:connected", account, token}, targetOrigin = that origin
 *   ◀── {type:"hold-connect:error", code, message}, same
 *
 * Who the site is comes from the browser (MessageEvent.origin), never from
 * anything the site writes: `appName` is only what it says it is, drawn small.
 *
 * Pure: no React, no `@/` imports, so ./handshake.check.ts runs it.
 */

export const READY = "hold-connect:ready";
export const HELLO = "hold-connect:hello";
export const CONNECTED = "hold-connect:connected";
export const ERROR = "hold-connect:error";

/** The backend's rule (`^https://[a-z0-9.-]+(:\d+)?$`, lowercased), plus a local http one in development. */
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * The dapp's origin, as the popup accepts it: `MessageEvent.origin`,
 * lowercased, https only (a local http origin only when `dev`). null for
 * anything else, including the opaque "null" of a sandboxed frame or a file.
 */
export function dappOrigin(eventOrigin: unknown, dev: boolean): string | null {
  if (typeof eventOrigin !== "string") return null;
  const o = eventOrigin.toLowerCase();
  if (HTTPS_ORIGIN.test(o)) return o;
  if (dev && LOCAL_ORIGIN.test(o)) return o;
  return null;
}

/** What to draw big: the host, punycode as the browser gives it (never a look-alike in Unicode). */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/**
 * The name the site says it has: display only. Control characters and
 * bidi overrides removed (they could reverse what the person reads), at most
 * 48 characters, null when nothing is left.
 */
export function cleanAppName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

/** A hello, or null for any other message. */
export function readHello(data: unknown): { appName: string | null } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== HELLO) return null;
  return { appName: cleanAppName(d.appName) };
}

/* ── The connect request, as GET /hold-connect/connect/:id answers ───── */

export type ConnectStatus = "pending" | "approved" | "rejected" | "expired";

export interface ConnectAccount {
  address: string;
  publicKey: string | null;
}

export interface ConnectRequest {
  id: string;
  status: ConnectStatus;
  expiresAt: string;
  /** Only once approved, and only on the first read after (the token is revealed once). */
  account: ConnectAccount | null;
  token: string | null;
}

type Raw = Record<string, unknown>;

function str(r: Raw | undefined | null, ...keys: string[]): string | null {
  if (!r) return null;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

const STATUSES: readonly ConnectStatus[] = ["pending", "approved", "rejected", "expired"];

/** `id` is the one we asked for, when the read does not repeat it. */
export function toConnectRequest(raw: unknown, id = ""): ConnectRequest {
  const r = ((raw as Raw | null)?.request as Raw | undefined) ?? ((raw as Raw | null) ?? {});
  const status = str(r, "status");
  const acc = (r.account as Raw | undefined) ?? null;
  const address = str(acc, "address") ?? str(r, "address");
  return {
    id: str(r, "id") ?? id,
    status: status && (STATUSES as readonly string[]).includes(status) ? (status as ConnectStatus) : "pending",
    expiresAt: str(r, "expiresAt", "expires_at") ?? "",
    account: address ? { address, publicKey: str(acc, "publicKey", "public_key") } : null,
    token: str(r, "token"),
  };
}

export function isDecided(s: ConnectStatus): boolean {
  return s !== "pending";
}

/** What the site is told when it does not get connected. 4001 is the user's no, as EIP-1193 and the wallet adapters read it. */
export function errorFor(status: "rejected" | "expired" | "cancelled"): { type: typeof ERROR; code: number; message: string } {
  switch (status) {
    case "rejected":
      return { type: ERROR, code: 4001, message: "The user rejected the request on their phone." };
    case "cancelled":
      return { type: ERROR, code: 4001, message: "The user closed the HOLD window." };
    case "expired":
      return { type: ERROR, code: -32603, message: "The phone did not answer in time." };
  }
}

/* ── Kept across a sign-in round trip in this popup ──────────────────── */

/**
 * sessionStorage is this popup's own (one per top-level browsing context), so
 * what survives an OAuth trip through Apple or Google is this window's site
 * and nobody else's. It only restores what to draw: a fresh hello from the
 * opener is still needed before anything is asked.
 */
export const STORE_KEY = "hold-connect:popup";
const STORE_TTL_MS = 15 * 60_000;

export interface Kept {
  origin: string;
  appName: string | null;
  at: number;
}

export function encodeKept(k: Kept): string {
  return JSON.stringify(k);
}

export function decodeKept(raw: string | null, now: number, dev: boolean): Kept | null {
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as Partial<Kept>;
    const origin = dappOrigin(k.origin, dev);
    if (!origin || typeof k.at !== "number" || now - k.at > STORE_TTL_MS || k.at > now + 60_000) return null;
    return { origin, appName: cleanAppName(k.appName), at: k.at };
  } catch {
    return null;
  }
}
