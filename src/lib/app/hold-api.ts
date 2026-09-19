/**
 * What the app's own screens read, read from the web.
 *
 * WHY THIS CAN BE CALLED FROM A BROWSER AT ALL
 *
 * Every read here sits behind `requireAuth`, which is a plain Supabase bearer
 * token and nothing else: no wallet signature, no device signature, no unlock.
 * (Signing lives on the *write* side, and always on the client: the server
 * hands back an unsigned transaction and never holds a key.) And CORS is not
 * in the way either — `api.hihodl.xyz` is fronted by a Worker that answers
 * every `/api/v1` path it does not hand to the backend with
 * `Access-Control-Allow-Origin: *` and `Authorization` allowed, verified
 * against production on 2026-09-20. We send `credentials: "omit"`, so `*` is
 * safe: the token is a header this page puts there on purpose and no ambient
 * cookie can ride along.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is reads. Nothing here moves money, and nothing here writes. The two
 * POSTs are POSTs because the backend takes the owner address in a body; they
 * are reads all the same. `/ledger/my-container` is the one exception worth
 * knowing: it creates the person's Main and Savings rows the first time it is
 * asked, so it is a write wearing a GET.
 *
 * Money on the web is otherwise view only. A withdrawal is approved on the
 * phone (Android) or signed with a passkey bound to that one transaction
 * (iPhone) — see lib/wallet and documentation/link-your-phone-and-approved-
 * withdrawals.md — and nothing on these screens bypasses that.
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";
import { accessToken } from "@/lib/creator/session";

export class HoldApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "HoldApiError";
  }
}

/**
 * One call, with the person's token on it.
 *
 * The backend answers `{ success: true, data: T }` on these routes and a bare
 * body on a few older ones, so the envelope is unwrapped when it is there and
 * the body used as it is when it is not — the same rule the app's apiClient
 * follows.
 */
export async function read<T>(path: string, init: { json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);

  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  if (init.json !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      method: init.json !== undefined ? "POST" : "GET",
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      credentials: "omit",
      signal: init.signal,
    });
  } catch {
    throw new HoldApiError("NETWORK", 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* an empty or unparseable body is handled by the status below */
  }

  if (!res.ok) {
    const code = (body as { error?: { code?: string } } | null)?.error?.code ?? `HTTP_${res.status}`;
    throw new HoldApiError(code, res.status);
  }

  const envelope = body as { success?: boolean; data?: unknown } | null;
  return (envelope && typeof envelope === "object" && "data" in envelope ? envelope.data : body) as T;
}

/* ── Balances and prices ──────────────────────────────────────────── */

/** One token at one chain, in one account. `balance` is a decimal string. */
export interface Balance {
  chain: string;
  chainLegacy?: string;
  tokenId: string;
  mint?: string | null;
  balance: string;
  account?: string;
  symbol?: string;
  decimals?: number;
}

export interface BalancesAnswer {
  balances: Balance[];
  updatedAt?: string;
}

/**
 * The balances of ONE account (`main`, `savings`, or a pocket's slug).
 *
 * The app asks once per account and adds them up; asking once with no account
 * answers for `main` alone, which is how the "$3 then $16" bug is written.
 */
export function getBalances(account = "main", chains?: readonly string[]): Promise<BalancesAnswer> {
  const q = new URLSearchParams({ account });
  if (chains?.length) q.set("chains", chains.join(","));
  return read<BalancesAnswer>(`balances?${q}`);
}

/** Dollar prices by symbol and by mint. Open to anyone, but sent with the token like the rest. */
export function getPrices(symbols: readonly string[], mints: readonly string[] = []): Promise<{ prices: Record<string, number> }> {
  const q = new URLSearchParams();
  if (symbols.length) q.set("symbols", symbols.join(","));
  if (mints.length) q.set("mints", mints.join(","));
  return read<{ prices: Record<string, number> }>(`prices?${q}`);
}

/** A price series for one symbol: `[[msSinceEpoch, price], …]`. */
export function getPriceHistory(symbol: string, days: 7 | 30 | 90 | 365): Promise<{ symbol: string; prices: [number, number][] }> {
  return read(`prices/history?symbol=${encodeURIComponent(symbol)}&days=${days}`);
}

/* ── What moved ───────────────────────────────────────────────────── */

export type TransferDirection = "in" | "out" | "exchange" | "move";

export interface Transfer {
  id: string;
  direction: TransferDirection;
  chain: string;
  tokenId: string;
  symbol: string;
  symbolTo?: string | null;
  amount: string;
  amountTo?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  fromAlias?: string | null;
  toAlias?: string | null;
  status: string;
  txHash?: string | null;
  note?: string | null;
  mint?: string | null;
  method?: string | null;
  counterpartyType?: string | null;
  merchantName?: string | null;
  parentIntentId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TransfersAnswer {
  transfers: Transfer[];
  total: number;
  hasMore?: boolean;
}

export function getTransfers(limit = 50, offset = 0): Promise<TransfersAnswer> {
  return read<TransfersAnswer>(`transfers?limit=${limit}&offset=${offset}`);
}

export function getTransferDetails(id: string): Promise<unknown> {
  return read(`transfers/${encodeURIComponent(id)}/details`);
}

/* ── The ledger: Main, Savings and the pockets ────────────────────── */

/** A subaccount of the person's container. Main and Savings are `isSystem`; every other one is a pocket. */
export interface LedgerSubaccount {
  id: string;
  slug: string;
  displayName: string;
  color?: string | null;
  icon?: string | null;
  position?: number;
  isSystem?: boolean;
  earnEnabled?: boolean;
}

export interface ContainerAnswer {
  container: { id: string; [k: string]: unknown };
  subaccounts: LedgerSubaccount[];
}

/**
 * The person's container and its subaccounts.
 *
 * Asking this the first time CREATES Main and Savings. It is the one call here
 * that is not purely a read; the app makes it on every home focus, so the rows
 * exist for anyone who has opened the app.
 */
export function getContainer(): Promise<ContainerAnswer> {
  return read<ContainerAnswer>("ledger/my-container");
}

/** How a container's money is split: which subaccount holds it, and whether it sits liquid or is supplied to a venue. */
export interface SubaccountBalanceRow {
  subaccountId: string;
  slug: string;
  displayName: string;
  chain: string;
  tokenId: string;
  balanceRaw: string;
  placement: "liquid" | "yield";
  venue: "aave" | "kamino" | "";
  updatedAt?: string;
}

export function getContainerBalances(containerId: string): Promise<{ balances: SubaccountBalanceRow[] }> {
  return read(`ledger/containers/${encodeURIComponent(containerId)}/balances`);
}

/** The pockets: every subaccount that is not Main or Savings (the app's SYSTEM_SLUGS). */
export function pocketsOf(subaccounts: readonly LedgerSubaccount[]): LedgerSubaccount[] {
  return subaccounts.filter((s) => s.slug !== "main" && s.slug !== "savings");
}

/* ── What the money earns ─────────────────────────────────────────── */

export interface YieldPosition {
  offerId: string;
  token: string;
  suppliedBaseUnits: string;
  suppliedUsd: number;
  /** From our own cost basis. `null` is "we do not know", which is not 0. */
  principalBaseUnits?: string | null;
  openedAt?: string | null;
  chain?: string;
}

export interface YieldReserve {
  symbol: string;
  token: string;
  supplyApy: number;
  chain?: string;
}

/** Kamino, on Solana. The owner address is the person's own, from /me/addresses. */
export function getKaminoPositions(owner: string): Promise<{ positions: YieldPosition[] }> {
  return read("yield/kamino/positions", { json: { owner } });
}

/** Aave, on Base and Polygon. */
export function getAavePositions(owner: string): Promise<{ positions: YieldPosition[] }> {
  return read("yield/aave/positions", { json: { owner } });
}

export function getKaminoReserves(): Promise<{ reserves: YieldReserve[] }> {
  return read("yield/kamino/reserves");
}

export function getAaveReserves(): Promise<{ reserves: YieldReserve[] }> {
  return read("yield/aave/reserves");
}

/* ── What the money cost ──────────────────────────────────────────── */

export interface CostBasisPosition {
  chain: string;
  tokenId: string;
  /** Weighted average cost in dollars, or null when we have no basis for it. */
  wacUsd: number | null;
  hasBasis: boolean;
  provisionalLots?: number;
  confirmedLots?: number;
}

export function getCostBasis(): Promise<{ positions: CostBasisPosition[] }> {
  return read("portfolio/cost-basis");
}

/* ── Payments the person is owed, owes, or has standing ───────────── */

export function getScheduledPayments(): Promise<{ schedules: unknown[] }> {
  return read("scheduled-payments");
}

export function getPaymentRequests(): Promise<unknown> {
  return read("payments/requests");
}

export function getPaymentIntents(): Promise<unknown> {
  return read("payment-intents");
}

/** Bank payouts on their way out. */
export function getOfframpOrders(): Promise<unknown> {
  return read("offramp/orders");
}

/** The virtual accounts money can arrive into. */
export function getRailAccounts(): Promise<unknown> {
  return read("rails/accounts");
}

/* ── The person ───────────────────────────────────────────────────── */

export function getHiPoints(): Promise<unknown> {
  return read("hipoints/me");
}

export function getHiPointsHistory(): Promise<unknown> {
  return read("hipoints/history");
}

export function getVerificationStatus(): Promise<unknown> {
  return read("verification/status");
}

/**
 * Routes the app calls that this backend does not mount (they 404): pay links,
 * payment notes and the whole chat shape, `/portfolio/lots`,
 * `/portfolio/realized`, `/groups`, `/stocks/availability`. Nothing on the web
 * may be built on them until they exist.
 */
export const NOT_ON_THE_SERVER = [
  "pay-links",
  "payment-notes",
  "portfolio/lots",
  "portfolio/realized",
  "groups",
  "stocks/availability",
] as const;
