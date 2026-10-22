/**
 * eSIM prices from the backend, read on our server.
 *
 * `GET /connectivity/public/prices` returns one row per destination we sell:
 * the cheapest plan for a week, a typical 10 GB month, a few example plans. It
 * is our own selling price for a free user, in USD, from a table the backend
 * rebuilds every six hours, so one call serves every page.
 *
 * Every page asks for the same URL with the same revalidate, so Next's Data
 * Cache turns a build of 200 pages, and every visitor after it, into one call
 * per hour. No visitor headers on it (see upstreamHeaders in ad-space/server):
 * they would split the cache per visitor.
 *
 * `unreachable` is not "no plans". A page that cannot read prices still
 * renders, without a number; only an answer that lists countries can say a
 * destination is not on sale.
 */

import { API_BASE } from "@/lib/ad-space/config";

export interface EsimPlan {
  dataLabel: string | null;
  dataMb: number | null;
  isUnlimited: boolean;
  days: number;
  /** USD. */
  price: number;
}

export interface EsimCountryPrice {
  countryCode: string;
  fromPrice: number;
  fromPlan: { dataLabel: string | null; days: number };
  typical10gb: { price: number; days: number } | null;
  planCount: number;
  plans: EsimPlan[];
}

export type EsimPrices =
  | { kind: "ok"; generatedAt: string; byCode: ReadonlyMap<string, EsimCountryPrice> }
  | { kind: "unreachable" };

/** Seconds. The backend's table moves every six hours; an hour keeps pages close to it. */
export const ESIM_REVALIDATE = 3600;

function isRow(r: unknown): r is EsimCountryPrice {
  const x = r as EsimCountryPrice;
  return (
    !!x &&
    typeof x.countryCode === "string" &&
    /^[A-Z]{2}$/.test(x.countryCode) &&
    typeof x.fromPrice === "number" &&
    x.fromPrice > 0 &&
    Array.isArray(x.plans)
  );
}

export async function getEsimPrices(): Promise<EsimPrices> {
  try {
    const res = await fetch(`${API_BASE}/connectivity/public/prices`, {
      headers: { accept: "application/json" },
      next: { revalidate: ESIM_REVALIDATE },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { generatedAt?: string; countries?: unknown[] } };
    const list = body?.data?.countries;
    const rows = Array.isArray(list) ? list.filter(isRow) : [];
    // An empty table is an outage upstream, not a world with no eSIMs.
    if (rows.length === 0) return { kind: "unreachable" };
    return {
      kind: "ok",
      generatedAt: body.data?.generatedAt ?? new Date().toISOString(),
      byCode: new Map(rows.map((r) => [r.countryCode, r])),
    };
  } catch {
    return { kind: "unreachable" };
  }
}
