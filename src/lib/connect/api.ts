/**
 * The popup's two calls (documentation/hold-connect-v0.md, API, "Web"),
 * with the person's HOLD session like every other call of the product:
 *
 *   POST /hold-connect/connect      {origin, appName?} → 201 {id, expiresAt}
 *                                   409 NO_LINKED_PHONE without a default phone
 *   GET  /hold-connect/connect/:id  {status, expiresAt}, and once approved
 *                                   {account, token}, the token only on that first read
 */

"use client";

import { send } from "@/lib/wallet/api";

import { isDecided, toConnectRequest, type ConnectRequest } from "./handshake";

export async function askToConnect(origin: string, appName: string | null): Promise<ConnectRequest> {
  const body: { origin: string; appName?: string } = { origin };
  if (appName) body.appName = appName;
  return toConnectRequest(await send<unknown>("hold-connect/connect", { json: body }));
}

export async function readConnect(id: string): Promise<ConnectRequest> {
  return toConnectRequest(await send<unknown>(`hold-connect/connect/${encodeURIComponent(id)}`), id);
}

export const CONNECT_POLL_MS = 1_500;
/** Past `expiresAt` the server says `expired` itself; this is only how long we keep asking for that. */
const EXPIRY_GRACE_MS = 15_000;

/**
 * Poll until the phone answers. Resolves with the decided request, or null
 * when the signal aborted or the request can no longer be read. A failed poll
 * is asked again on the next tick.
 */
export async function waitForConnect(first: ConnectRequest, signal: AbortSignal): Promise<ConnectRequest | null> {
  if (isDecided(first.status)) return first;
  const until = Date.parse(first.expiresAt);
  const giveUpAt = (Number.isFinite(until) ? until : Date.now() + 5 * 60_000) + EXPIRY_GRACE_MS;
  let misses = 0;
  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, CONNECT_POLL_MS));
    if (signal.aborted) return null;
    try {
      const r = await readConnect(first.id);
      misses = 0;
      if (isDecided(r.status)) return r;
    } catch (e) {
      if ((e as { status?: number })?.status === 404 && ++misses >= 3) return null;
    }
    if (Date.now() > giveUpAt) return { ...first, status: "expired" };
  }
  return null;
}
