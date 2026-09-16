// Server-only by construction: no "use client" file imports this module.
import { API_BASE } from "@/lib/ad-space/config";
import { fixtureEnabled, upstreamHeaders } from "@/lib/ad-space/server";

import type { PayLinkPublic, PayReceipt } from "./types";

/**
 * Reading a pay link and a receipt on the server.
 *
 * Never cached: a single-use link turns `paid` the moment the chain says so,
 * and a payer must not be shown a pay button for a link that has already been
 * paid. Every read therefore carries the visitor's address so the backend
 * limits the visitor, not our server.
 */

export const PAY_LINKS_API = `${API_BASE}/pay-links`;

/**
 * The backend's code rule (`isLinkCode`): 8 characters from an alphabet with
 * no 0, 1, i, l or o ("k7x2m9qa"). Anything else names no link.
 */
export const PAY_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/;
/** Receipt tokens are random and URL-safe. */
export const RECEIPT_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export type Lookup<T> = { kind: "found"; value: T } | { kind: "missing" } | { kind: "unreachable" };

async function read<T>(path: string, pick: (data: Record<string, unknown>) => T | undefined, from: Headers | null): Promise<Lookup<T>> {
  try {
    const res = await fetch(`${PAY_LINKS_API}/public${path}`, {
      headers: upstreamHeaders(from),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    // 400 is the server refusing a code or token of the wrong shape: no such link either.
    if (res.status === 404 || res.status === 400) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: Record<string, unknown> };
    const value = body?.data ? pick(body.data) : undefined;
    return value ? { kind: "found", value } : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}

export async function getPayLink(code: string, from: Headers | null): Promise<Lookup<PayLinkPublic>> {
  if (!PAY_CODE_RE.test(code)) return { kind: "missing" };
  if (fixtureEnabled()) {
    const { fixturePayLink } = await import("./fixture.dev");
    const link = fixturePayLink(code);
    return link ? { kind: "found", value: link } : { kind: "missing" };
  }
  return read(`/${encodeURIComponent(code)}`, (d) => d.link as PayLinkPublic | undefined, from);
}

export async function getReceipt(token: string, from: Headers | null): Promise<Lookup<PayReceipt>> {
  if (!RECEIPT_TOKEN_RE.test(token)) return { kind: "missing" };
  if (fixtureEnabled()) {
    const { fixtureReceipt } = await import("./fixture.dev");
    const receipt = fixtureReceipt(token);
    return receipt ? { kind: "found", value: receipt } : { kind: "missing" };
  }
  return read(`/receipts/${encodeURIComponent(token)}`, (d) => d.receipt as PayReceipt | undefined, from);
}
