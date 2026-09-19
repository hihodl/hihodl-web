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
import { HOLD_KEEPS } from "@/lib/rates.config";

import {
  getAavePositions,
  getAaveReserves,
  getBalances,
  getContainer,
  getContainerBalances,
  getCostBasis,
  getKaminoPositions,
  getKaminoReserves,
  getPriceHistory,
  getPrices,
  getScheduledPayments,
  getTransfers,
  pocketsOf,
  type Balance,
  type BalancesAnswer,
  type ContainerAnswer,
  type LedgerSubaccount,
  type SubaccountBalanceRow,
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

/* ── What it earns ────────────────────────────────────────────────── */

export type Venue = "kamino" | "aave";

/**
 * What is supplied to a venue right now, and which venues would not say.
 *
 * `failed` is the whole point of the shape. Kamino 502s on call size and has
 * done for weeks; a read that swallowed it would report no supplied money and
 * a hero built on that would print a total smaller than the person's money,
 * confidently. A venue that did not answer is not a venue holding nothing, so
 * the caller is told and says so.
 *
 * The owner address is the person's own, read from `/me/addresses`: the
 * backend takes it in the body and does not look it up, so a missing address
 * means no read rather than somebody else's position.
 *
 * Kamino's rows are tagged `solana` here because Kamino is Solana and the
 * backend does not repeat itself. The attribution below matches a position to
 * the ledger's rows by (chain, token), and an untagged position would match
 * the Base and Polygon rows too.
 */
export function useYieldPositions() {
  const addrs = useMyAddresses();
  const solana = addrs.data?.solana ?? null;
  const evm = addrs.data?.base ?? addrs.data?.polygon ?? null;
  return useRead<{ positions: YieldPosition[]; failed: Venue[] }>(
    solana || evm ? "yield-positions" : null,
    async () => {
      const failed: Venue[] = [];
      const [kamino, aave] = await Promise.all([
        solana
          ? getKaminoPositions(solana).then(
              (a) => a.positions.map((p) => ({ ...p, chain: p.chain ?? "solana" })),
              () => {
                failed.push("kamino");
                return [] as YieldPosition[];
              },
            )
          : Promise.resolve([] as YieldPosition[]),
        evm
          ? getAavePositions(evm).then(
              (a) => a.positions,
              () => {
                failed.push("aave");
                return [] as YieldPosition[];
              },
            )
          : Promise.resolve([] as YieldPosition[]),
      ]);
      return { positions: [...kamino, ...aave], failed };
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
  return useRead("scheduled", getScheduledPayments);
}

/* ── Whose supplied money is whose ────────────────────────────────── */

/** One live protocol position, valued by the venue that holds it. */
export interface SuppliedPosition {
  /** Ticker, any case. */
  token: string;
  /** `solana`, `base`, `polygon`, or null when the offer did not say. */
  chain: string | null;
  /** Current value including accrued interest. */
  balanceUsd: number;
}

/** The container that owns anything the ledger cannot attribute. */
export const UNATTRIBUTED_SLUG = "savings";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Splits every supplied position across the containers that own it.
 *
 * There is exactly ONE on-chain position per (chain, token, venue): Aave
 * reports a single aToken balance against a single address and Kamino a single
 * kToken ATA, and neither has any idea that Main, Savings and eight pockets
 * exist — containers are our bookkeeping, not theirs. The LEDGER can answer
 * it: `subaccount_balances` carries one row per (subaccount, chain, token,
 * placement), and the yield rows are the split. What the ledger cannot do is
 * value it, since it holds principal and the protocol holds principal plus
 * whatever has accrued.
 *
 * So the VALUE comes from the protocol and the SHARES from the ledger, which
 * is the only combination where both halves come from the side that knows.
 * Accrued interest is distributed in proportion to principal, which is not an
 * approximation: one pooled position at one rate earns exactly in proportion
 * to what each share put in.
 *
 * Value with no matching row goes to Savings. Every supply before the pocket
 * routing landed was made from Savings and has been shown under Savings the
 * whole time, so that is not a guess — and it is the safe direction for the
 * failure case, where everything falls back to Savings rather than vanishing
 * from a total on a network blip.
 *
 * The venue is deliberately not part of the match: there is one venue per
 * chain in this product, and two spellings of one fact is how they come to
 * disagree.
 *
 * Pure and cheap. Safe to call on every render.
 */
export function suppliedUsdBySlug(input: {
  rows: readonly SubaccountBalanceRow[];
  positions: readonly SuppliedPosition[];
}): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (key: string, usd: number) => {
    if (!key || !(usd > 0)) return;
    out[key] = (out[key] ?? 0) + usd;
  };

  const yieldRows = input.rows.filter((r) => r.placement === "yield" && Number(r.balanceRaw) > 0 && !!r.slug);

  for (const position of input.positions) {
    const amount = position.balanceUsd;
    if (!(amount > 0)) continue;
    const token = norm(position.token);
    const chain = norm(position.chain);

    const matching = yieldRows.filter((r) => {
      if (norm(r.tokenId) !== token) return false;
      // A position that did not name its chain matches on token alone: better
      // a split across chains than the whole amount falling to the fallback.
      if (!chain) return true;
      return norm(r.chain) === chain;
    });

    const totalRaw = matching.reduce((sum, r) => sum + Number(r.balanceRaw), 0);
    if (totalRaw <= 0) {
      add(UNATTRIBUTED_SLUG, amount);
      continue;
    }

    // Distributed by principal share, with the float remainder handed to the
    // largest share: a hero built from these has to add up to the figure above it.
    let assigned = 0;
    let largest: { key: string; raw: number } | null = null;
    for (const row of matching) {
      const raw = Number(row.balanceRaw);
      const share = (amount * raw) / totalRaw;
      add(row.slug, share);
      assigned += share;
      if (!largest || raw > largest.raw) largest = { key: row.slug, raw };
    }
    const remainder = amount - assigned;
    if (largest && Math.abs(remainder) > 1e-9) add(largest.key, remainder);
  }

  return out;
}

/** What one container has liquid, what it has working, and what that makes it worth. */
export interface ContainerSplit {
  /** Value earning at a venue, including accrued interest. */
  workingUsd: number;
  /** Value that can be spent right now. */
  liquidUsd: number;
  /** The two of them: what the container is worth. */
  totalUsd: number;
  /** True when any of it is working — "does this earn", answered. */
  isWorking: boolean;
}

/**
 * `liquidUsd` is passed in rather than derived from the ledger rows on
 * purpose: the spendable figure every other screen uses comes from the
 * on-chain read, and mixing the two sources in one line would make the split
 * disagree with the balance printed above it.
 */
export function splitForContainer(input: {
  slug: string;
  liquidUsd: number;
  suppliedBySlug: Record<string, number>;
}): ContainerSplit {
  const workingUsd = input.suppliedBySlug[norm(input.slug)] ?? input.suppliedBySlug[input.slug] ?? 0;
  const liquidUsd = input.liquidUsd > 0 ? input.liquidUsd : 0;
  return { workingUsd, liquidUsd, totalUsd: workingUsd + liquidUsd, isWorking: workingUsd > 0 };
}

/**
 * Our share of the interest one position earns, blended across the containers
 * that own it.
 *
 * Read from `lib/rates.config` — the published page IS the source, and the
 * app's `containerYield.ts` says so in as many words ("Keep the two in sync;
 * the web page is the published one"). Money left lazy in Main pays the higher
 * share; money the person deliberately set aside in Savings or a pocket pays
 * the lower one, and a pocket is priced with Savings.
 *
 * It is here because the line under the hero says what a container EARNED, and
 * a gross figure would mean that number shrinks the moment they withdraw —
 * the single worst moment to surprise somebody about a fee.
 */
export function perfFeeForPosition(input: {
  rows: readonly SubaccountBalanceRow[];
  chain: string | null;
  token: string;
}): number {
  const mainFee = HOLD_KEEPS.mainInterestShareBps / 10_000;
  const setAsideFee = HOLD_KEEPS.savingsInterestShareBps / 10_000;
  const chain = norm(input.chain);
  const token = norm(input.token);
  if (!token) return mainFee;

  let mainRaw = 0;
  let setAsideRaw = 0;
  for (const row of input.rows) {
    if (row.placement !== "yield") continue;
    const raw = Number(row.balanceRaw);
    if (!(raw > 0)) continue;
    if (norm(row.tokenId) !== token) continue;
    // A position that could not name its chain blends across chains rather
    // than falling to the fallback.
    if (chain && norm(row.chain) !== chain) continue;
    if (norm(row.slug) === "main") mainRaw += raw;
    else setAsideRaw += raw;
  }
  const total = mainRaw + setAsideRaw;
  if (total <= 0) return mainFee;
  return (mainRaw * mainFee + setAsideRaw * setAsideFee) / total;
}

/**
 * Interest earned on one position, net of our share — or null when we cannot
 * measure it.
 *
 * `principalBaseUnits` comes from our own cost-basis table and `null` is "we
 * do not know", which is not zero: a position we cannot measure contributes
 * nothing and the line stays silent, which is the right answer. A person who
 * has earned an unknown amount is better served by silence than by a confident
 * $0.00.
 */
function earnedUsdFor(p: YieldPosition, perfFee: number): number | null {
  if (!p.principalBaseUnits) return null;
  const supplied = Number(p.suppliedBaseUnits);
  const principal = Number(p.principalBaseUnits);
  if (!Number.isFinite(supplied) || !Number.isFinite(principal)) return null;
  if (supplied <= 0 || principal <= 0 || supplied <= principal) return null;
  return ((p.suppliedUsd * (supplied - principal)) / supplied) * (1 - perfFee);
}

export interface SuppliedAnswer {
  /** USD working, by container slug. A slug absent from it owns nothing supplied. */
  bySlug: Record<string, number>;
  /**
   * Interest earned, by container slug, net of our share. The same
   * distribution applied to a different number — which is exact, not an
   * approximation: a container's share of one pooled position is its principal
   * share, so the weights that split the balance are the only weights that can
   * split the gain. A FLOOR, because a position with no basis contributes 0.
   */
  earnedBySlug: Record<string, number>;
  /**
   * Whether the attribution has landed at all — a different question from
   * whether it returned anything. A container with its whole balance supplied
   * and one that is genuinely empty both produce no liquid rows, and only this
   * tells them apart, which is what a hero needs before it prints a zero.
   */
  loaded: boolean;
  /** Venues that would not answer. Their money is missing from `bySlug`, and the screen must say so. */
  failed: Venue[];
}

/** The two reads that turn one pooled protocol figure into a figure per container. */
export function useSuppliedBySlug(): SuppliedAnswer {
  const container = useContainer();
  const balances = useContainerBalances(container.data?.container.id ?? null);
  const venues = useYieldPositions();

  const rows = balances.data?.balances ?? [];
  const positions = venues.data?.positions ?? [];
  const priced = positions.map((p) => ({ token: p.token, chain: p.chain ?? null, balanceUsd: p.suppliedUsd }));
  const earned = positions.map((p) => ({
    token: p.token,
    chain: p.chain ?? null,
    balanceUsd: earnedUsdFor(p, perfFeeForPosition({ rows, chain: p.chain ?? null, token: p.token })) ?? 0,
  }));

  return {
    bySlug: suppliedUsdBySlug({ rows, positions: priced }),
    earnedBySlug: suppliedUsdBySlug({ rows, positions: earned }),
    loaded: balances.data !== undefined && venues.data !== undefined,
    failed: venues.data?.failed ?? [],
  };
}

/* ── What a holding was worth yesterday ───────────────────────────── */

/** Twenty-four hours, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Each symbol's price a day ago, for the hero's 24h delta.
 *
 * `/prices/history` is one call per symbol, so only the volatile ones are
 * asked: a dollar was a dollar yesterday. A symbol whose series does not come
 * back is left OUT of the answer rather than defaulted to today's price — the
 * caller reads a missing symbol as "we cannot say", and a delta that silently
 * treats an unknown as unchanged is a delta that lies about the one holding it
 * could not read.
 */
export function usePrices24hAgo(symbols: readonly string[]) {
  const volatile = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => !isStable(s)))].sort();
  return useRead<Record<string, number>>(
    volatile.length ? "prices-24h" : null,
    async () => {
      const cutoff = Date.now() - DAY_MS;
      const series = await Promise.all(
        volatile.map((symbol) => getPriceHistory(symbol, 7).then((a) => [symbol, a.prices] as const, () => [symbol, null] as const)),
      );
      const out: Record<string, number> = {};
      for (const [symbol, points] of series) {
        if (!points?.length) continue;
        // The last point at or before the cutoff; failing that the oldest we
        // were given, which is the closest thing to "a day ago" on offer.
        let best: [number, number] | null = null;
        for (const point of points) {
          if (point[0] <= cutoff && (!best || point[0] > best[0])) best = point;
        }
        const chosen = best ?? points[0];
        if (Number.isFinite(chosen[1])) out[symbol] = chosen[1];
      }
      return out;
    },
    volatile.join(","),
  );
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
