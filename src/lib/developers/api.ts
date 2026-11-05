"use client";

/**
 * Settings › Developers, against the backend's /developer routes: API keys and
 * webhook endpoints for a creator who takes payments on their own site.
 *
 * Every call is the person's own Supabase bearer (lib/app/hold-api read()),
 * like the rest of the signed-in web. A secret (a key's, an endpoint's) comes
 * back once, on create, and is never stored here: the screen shows it and
 * forgets it.
 *
 * A server without these routes answers 404: the screen then says "Coming
 * soon" in one line instead of drawing errors (isNotDeployed).
 *
 * Envelopes are read loosely: `{ keys }` or a bare list, `{ key }` or the
 * object itself, the way lib/pay-links/mine reads its own.
 */

import useSWR from "swr";

import { HoldApiError, read } from "@/lib/app/hold-api";
import { useCreatorSession } from "@/lib/creator/session";

export type KeyMode = "live" | "test";

export interface DevKey {
  id: string;
  name: string;
  mode: KeyMode;
  /** The first characters, shown as "hold_live_ab12…". */
  prefix: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

export type NewDevKey = DevKey & { secret: string };

export interface DevWebhook {
  id: string;
  url: string;
  createdAt?: string | null;
}

export type NewDevWebhook = DevWebhook & { secret: string };

export interface DevDelivery {
  id: string;
  /** "payment.succeeded" … */
  event?: string | null;
  type?: string | null;
  /** delivered / succeeded / failed / pending, as the server words it. */
  status: string;
  responseStatus?: number | null;
  attempts?: number | null;
  createdAt?: string | null;
}

function pick<T>(body: unknown, key: string): T {
  if (body && typeof body === "object" && !Array.isArray(body) && key in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>)[key] as T;
  }
  return body as T;
}

function list<T>(body: unknown, key: string): T[] {
  const v = pick<unknown>(body, key);
  return Array.isArray(v) ? (v as T[]) : [];
}

/** The routes are not on this server yet. */
export function isNotDeployed(e: unknown): boolean {
  return e instanceof HoldApiError && e.status === 404;
}

export async function listKeys(): Promise<DevKey[]> {
  return list<DevKey>(await read<unknown>("developer/keys"), "keys");
}

export async function createKey(name: string, mode: KeyMode): Promise<NewDevKey> {
  return pick<NewDevKey>(await read<unknown>("developer/keys", { json: { name, mode } }), "key");
}

export async function revokeKey(id: string): Promise<void> {
  await read<unknown>(`developer/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listWebhooks(): Promise<DevWebhook[]> {
  // The server lists them as `{ endpoints }`; `{ webhooks }` is still read.
  const body = await read<unknown>("developer/webhooks");
  const endpoints = list<DevWebhook>(body, "endpoints");
  return endpoints.length ? endpoints : list<DevWebhook>(body, "webhooks");
}

export async function createWebhook(url: string): Promise<NewDevWebhook> {
  return pick<NewDevWebhook>(await read<unknown>("developer/webhooks", { json: { url } }), "webhook");
}

export async function deleteWebhook(id: string): Promise<void> {
  await read<unknown>(`developer/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listDeliveries(webhookId: string): Promise<DevDelivery[]> {
  return list<DevDelivery>(await read<unknown>(`developer/webhooks/${encodeURIComponent(webhookId)}/deliveries`), "deliveries");
}

export async function resendDelivery(deliveryId: string): Promise<void> {
  await read<unknown>(`developer/webhooks/deliveries/${encodeURIComponent(deliveryId)}/resend`, { json: {} });
}

/** A webhook URL the screen accepts: https, a host, no credentials. */
export function isWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

/* ── Reads, keyed per account like the other signed-in screens ────── */

const OPTIONS = { revalidateOnFocus: true, focusThrottleInterval: 30_000, shouldRetryOnError: false, dedupingInterval: 5_000 } as const;

function useAccountKey(name: string | null, extra = ""): unknown[] | null {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return uid && name ? ["developers", uid, name, extra] : null;
}

export function useDevKeys() {
  return useSWR<DevKey[]>(useAccountKey("keys"), listKeys, OPTIONS);
}

export function useDevWebhooks() {
  return useSWR<DevWebhook[]>(useAccountKey("webhooks"), listWebhooks, OPTIONS);
}

export function useDeliveries(webhookId: string | null) {
  return useSWR<DevDelivery[]>(useAccountKey(webhookId ? "deliveries" : null, webhookId ?? ""), () => listDeliveries(webhookId!), OPTIONS);
}
