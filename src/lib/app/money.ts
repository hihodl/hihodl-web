/**
 * The money screens' reads, cached across screens (the app's own numbers).
 *
 * Same shape as lib/app/spaces-data: SWR, keyed by the signed-in person so a
 * different account in the same tab never reads the last one's figures, and a
 * return to the tab reads again at most every 30 seconds.
 *
 * WHAT THE WEB SHOWS AND WHAT IT DOES NOT
 *
 * These screens are VIEW ONLY. They draw what the app draws and offer no
 * action that moves money: paying, moving, supplying to a venue, creating a
 * pocket and editing a cost all stay in the app. The one thing the web does
 * do is receive (an address and its QR) and start a withdrawal, which is
 * approved on the phone or signed with a passkey bound to that transaction.
 */

"use client";

import useSWR, { type SWRConfiguration } from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import {
  getAavePositions,
  getAaveReserves,
  getAliases,
  getBalances,
  getContainer,
  getContainerBalances,
  getCostBasis,
  getKaminoPositions,
  getKaminoReserves,
  getOfframpOrders,
  getPriceHistory,
  getPrices,
  getScheduledPayments,
  getTransferDetails,
  getTransfers,
  pocketsOf,
  type AliasRecord,
  type Balance,
  type BalancesAnswer,
  type ContainerAnswer,
  type LedgerSubaccount,
  type OfframpOrder,
  type Schedule,
  type SubaccountBalanceRow,
  type TransferDetails,
  type TransfersAnswer,
  type YieldPosition,
  type YieldReserve,
} from "./hold-api";
import { useMyAddresses } from "./spaces-data";

const OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 30_000,
  shouldRetryOnError: false,
  dedupingInterval: 10_000,
};

function useUserId(): string | null {
  const { session } = useCreatorSession();
  return session?.user?.id ?? null;
}

function useRead<T>(name: string | null, fetcher: () => Promise<T>, extra = "") {
  const uid = useUserId();
  return useSWR<T>(uid && name ? ["money", uid, name, extra] : null, fetcher, OPTIONS);
}

/* ── The accounts money sits in ───────────────────────────────────── */

/**
 * Main, Savings and the pockets.
 *
 * Asking this creates Main and Savings for somebody who has never opened the
 * app. That is the backend's behaviour, not ours, and it is what makes the
 * web's Home show the same two rows the app shows.
 */
export function useContainer() {
  return useRead<ContainerAnswer>("container", getContainer);
}

export function usePockets(): LedgerSubaccount[] {
  const c = useContainer();
  return c.data ? pocketsOf(c.data.subaccounts) : [];
}

/** How the container's money is split between its subaccounts, and what of it is supplied to a venue. */
export function useContainerBalances(containerId: string | null) {
  return useRead<{ balances: SubaccountBalanceRow[] }>(
    containerId ? "container-balances" : null,
    () => getContainerBalances(containerId!),
    containerId ?? "",
  );
}

/* ── What is liquid ───────────────────────────────────────────────── */

/**
 * One account's balances. The app asks once per account rather than once in
 * total, and so does this: an aggregate read answers for `main` alone.
 */
export function useBalancesOf(account: string | null) {
  return useRead<BalancesAnswer>(account ? "balances" : null, () => getBalances(account!), account ?? "");
}

/**
 * Every account's balances at once, in the order given.
 *
 * `data` is undefined until all of them have answered; a single account that
 * fails takes the whole read with it, because a total that silently drops one
 * account is worse than no total.
 */
export function useAllBalances(accounts: readonly string[]) {
  const key = accounts.join(",");
  return useRead<Record<string, BalancesAnswer>>(
    accounts.length ? "balances-all" : null,
    async () => {
      const answers = await Promise.all(accounts.map((a) => getBalances(a)));
      return Object.fromEntries(accounts.map((a, i) => [a, answers[i]]));
    },
    key,
  );
}

/* ── What things are worth ────────────────────────────────────────── */

export function usePrices(symbols: readonly string[], mints: readonly string[] = []) {
  const key = [...symbols].sort().join(",") + "|" + [...mints].sort().join(",");
  return useRead<{ prices: Record<string, number> }>(
    symbols.length || mints.length ? "prices" : null,
    () => getPrices(symbols, mints),
    key,
  );
}

export function usePriceHistory(symbol: string | null, days: 7 | 30 | 90 | 365) {
  return useRead(symbol ? "price-history" : null, () => getPriceHistory(symbol!, days), `${symbol}:${days}`);
}

/* ── What moved ───────────────────────────────────────────────────── */

export function useTransfers(limit = 50, offset = 0) {
  return useRead<TransfersAnswer>("transfers", () => getTransfers(limit, offset), `${limit}:${offset}`);
}

/** One transfer, expanded — what the app's details sheet is drawn from. */
export function useTransferDetails(id: string | null) {
  return useRead<TransferDetails>(id ? "transfer-details" : null, () => getTransferDetails(id!), id ?? "");
}

/* ── What it earns ────────────────────────────────────────────────── */

/**
 * What is supplied to a venue right now, across Kamino (Solana) and Aave
 * (Base, Polygon).
 *
 * The owner address is the person's own, read from `/me/addresses`: the
 * backend takes it in the body and does not look it up, so a missing address
 * means no read rather than somebody else's position.
 */
export function useYieldPositions() {
  const addrs = useMyAddresses();
  const solana = addrs.data?.solana ?? null;
  const evm = addrs.data?.base ?? addrs.data?.polygon ?? null;
  return useRead<YieldPosition[]>(
    solana || evm ? "yield-positions" : null,
    async () => {
      const [kamino, aave] = await Promise.all([
        solana ? getKaminoPositions(solana).then((a) => a.positions, () => [] as YieldPosition[]) : Promise.resolve([]),
        evm ? getAavePositions(evm).then((a) => a.positions, () => [] as YieldPosition[]) : Promise.resolve([]),
      ]);
      return [...kamino, ...aave];
    },
    `${solana ?? ""}:${evm ?? ""}`,
  );
}

/** The rates on offer, for the line that says what money would earn. Open to anyone. */
export function useYieldReserves() {
  return useRead<YieldReserve[]>("yield-reserves", async () => {
    const [kamino, aave] = await Promise.all([
      getKaminoReserves().then((a) => a.reserves, () => [] as YieldReserve[]),
      getAaveReserves().then((a) => a.reserves, () => [] as YieldReserve[]),
    ]);
    return [...kamino, ...aave];
  });
}

/* ── What it cost ─────────────────────────────────────────────────── */

export function useCostBasis() {
  return useRead("cost-basis", getCostBasis);
}

/* ── Standing payments ────────────────────────────────────────────── */

export function useScheduledPayments() {
  return useRead<{ schedules: Schedule[] }>("scheduled", getScheduledPayments);
}

/** Bank payouts and where each of them got to. */
export function usePayouts(limit = 20) {
  return useRead<{ orders: OfframpOrder[]; hasMore?: boolean }>("payouts", () => getOfframpOrders(limit), String(limit));
}

/* ── The person's own name ────────────────────────────────────────── */

/** `@alex` and the address behind it, for the hi.me link. */
export function useAliases() {
  return useRead<AliasRecord[]>("aliases", getAliases);
}

/* ── The rules the app applies to these numbers, not the server ───── */

const STABLES = new Set(["USDC", "USDT", "HUSD", "DAI", "EURC", "PYUSD", "USDS", "FDUSD"]);

/** A dollar, whatever chain it sits on. The app's `isStableSymbol`. */
export function isStable(symbol: string): boolean {
  return STABLES.has(symbol.toUpperCase());
}

/** What Invest counts: everything that is not a dollar. The app's `isInvestable`. */
export function isInvestable(symbol: string): boolean {
  return !isStable(symbol);
}

/** A balance row's dollar value, at the prices we have. A price we do not know is not zero, it is unknown. */
export function usdOf(b: Balance, prices: Record<string, number>): number | null {
  const amount = Number(b.balance);
  if (!Number.isFinite(amount)) return null;
  const symbol = (b.symbol ?? b.tokenId ?? "").toUpperCase();
  const price = (b.mint ? prices[b.mint] : undefined) ?? prices[symbol];
  if (price === undefined) return isStable(symbol) ? amount : null;
  return amount * price;
}

/**
 * A total, and whether anything was left out of it.
 *
 * The app never prints a total that quietly drops a holding it could not
 * price: it prints the total and says what it leaves out.
 */
export function totalUsd(rows: readonly Balance[], prices: Record<string, number>): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const row of rows) {
    const usd = usdOf(row, prices);
    if (usd === null) unpriced += 1;
    else total += usd;
  }
  return { total, unpriced };
}
