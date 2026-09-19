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
  getYieldAuthorization,
  pocketsOf,
  type Balance,
  type BalancesAnswer,
  type ContainerAnswer,
  type LedgerSubaccount,
  type SubaccountBalanceRow,
  type TransfersAnswer,
  type YieldAuthorization,
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

/** What the portfolio was worth at one moment, for the Invest hero's curve. */
export interface CurvePoint {
  t: number;
  y: number;
}

export interface PortfolioCurve {
  points: CurvePoint[];
  /** Holdings no series answered for. They are in the total and not in the line. */
  uncharted: number;
  unchartedUsd: number;
}

/**
 * The Invest hero's curve: Σ (amount held now × what that asset cost then).
 *
 * The app draws this from DefiLlama, called straight from the device. A browser
 * cannot — CORS and the rate limit are both in the way — so the web draws it
 * from our own `GET /prices/history`, which is the same shape one symbol at a
 * time. `days` is 7, 30, 90 or 365 and nothing else, which is the backend's own
 * enum, so the web has no 24H range where the app has one.
 *
 * Each asset's series is sampled at its own instants, so the longest one is the
 * clock and every other is read at its last price at or before each tick. A
 * symbol no series answered for is NOT dropped into the line at zero: it is
 * counted, and the hero says how much of the total the line leaves out.
 *
 * It is what is held NOW priced backwards, the same honest caveat the app
 * carries: an asset bought this morning did not live through the whole range.
 */
export function usePortfolioHistory(holdings: readonly { symbol: string; amount: number; usd: number }[], days: 7 | 30 | 90 | 365) {
  const key = holdings.map((h) => `${h.symbol}:${h.amount}`).sort().join(",");
  return useRead<PortfolioCurve>(
    holdings.length ? "portfolio-history" : null,
    async () => {
      const answers = await Promise.allSettled(holdings.map((h) => getPriceHistory(h.symbol, days)));
      const series: { amount: number; prices: [number, number][] }[] = [];
      let uncharted = 0;
      let unchartedUsd = 0;
      answers.forEach((a, i) => {
        const prices = a.status === "fulfilled" ? a.value.prices : [];
        if (!prices || prices.length < 2) {
          uncharted += 1;
          unchartedUsd += holdings[i].usd;
          return;
        }
        series.push({ amount: holdings[i].amount, prices: [...prices].sort((x, y) => x[0] - y[0]) });
      });
      if (!series.length) return { points: [], uncharted, unchartedUsd };

      const clock = series.reduce((longest, s) => (s.prices.length > longest.prices.length ? s : longest), series[0]);
      const cursors = series.map(() => 0);
      const points: CurvePoint[] = [];
      for (const [t] of clock.prices) {
        let y = 0;
        let complete = true;
        series.forEach((s, i) => {
          while (cursors[i] + 1 < s.prices.length && s.prices[cursors[i] + 1][0] <= t) cursors[i] += 1;
          const sample = s.prices[cursors[i]];
          // Before this asset's series begins there is no price to use, and a
          // zero would draw a step that never happened.
          if (sample[0] > t) complete = false;
          else y += s.amount * sample[1];
        });
        if (complete && Number.isFinite(y)) points.push({ t, y });
      }
      return { points, uncharted, unchartedUsd };
    },
    `${key}|${days}`,
  );
}

/* ── What moved ───────────────────────────────────────────────────── */

export function useTransfers(limit = 50, offset = 0) {
  return useRead<TransfersAnswer>("transfers", () => getTransfers(limit, offset), `${limit}:${offset}`);
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
    // Keyed on the addresses having ANSWERED, not on there being one. Somebody
    // with no wallet yet has nothing supplied, and a key that never resolves
    // would leave the screens that wait on this loading for ever.
    addrs.data ? "yield-positions" : null,
    async () => {
      const [kamino, aave] = await Promise.allSettled([
        // Kamino runs on Solana and nowhere else, and it does not say so in its
        // answer. The chain is what attributes a position to a container (the
        // split matches on chain and token), so it is written on here rather
        // than left for every reader to assume.
        solana ? getKaminoPositions(solana).then((a) => a.positions.map((p) => ({ ...p, chain: p.chain ?? "solana" }))) : Promise.resolve([]),
        evm ? getAavePositions(evm).then((a) => a.positions) : Promise.resolve([]),
      ]);
      // One venue down still has something true to say; both down does not.
      // The difference is what lets the Savings hero print "—" instead of a
      // fabricated "$0.00" — an empty read and a failed read are not the
      // same claim about somebody's money.
      if (kamino.status === "rejected" && aave.status === "rejected") throw kamino.reason;
      return [
        ...(kamino.status === "fulfilled" ? kamino.value : []),
        ...(aave.status === "fulfilled" ? aave.value : []),
      ];
    },
    `${solana ?? ""}:${evm ?? ""}`,
  );
}

/**
 * The standing authorization on one chain, for the renewal line.
 *
 * A read that fails shows nothing rather than a wrong state, and a 503 is the
 * table not being applied in this environment — both come back as null, which
 * the screen draws as no notice at all.
 */
export function useYieldAuthorization(chain: string | null, token = "usdc") {
  return useRead<YieldAuthorization | null>(
    chain ? "yield-authorization" : null,
    () => getYieldAuthorization(chain!, token).catch(() => null),
    `${chain ?? ""}:${token}`,
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

/* ── Which container owns the supplied money ──────────────────────── */

/**
 * The app's `containerSplit`, ported whole.
 *
 * There is exactly ONE on-chain position per (chain, token): Aave reports a
 * single aToken balance against a single address and Kamino a single kToken
 * account, and neither has heard of Main, Savings or a pocket — containers are
 * our bookkeeping, not theirs. So the protocol read is per ADDRESS, and a
 * screen that prints it as "Savings" is printing the pockets too.
 *
 * The ledger can answer whose it is (`/ledger/containers/:id/balances`, one row
 * per subaccount, chain, token and placement) but cannot value it, because it
 * holds principal and the venue holds principal plus what has accrued. So the
 * VALUE comes from the venue and the SHARES from the ledger, and the interest
 * is distributed in proportion to principal — not an approximation: one pooled
 * position at one rate earns exactly in proportion to what each share put in.
 *
 * Value the ledger cannot attribute goes to Savings, which is where every
 * supply made before pocket routing came from, and therefore what is already on
 * screen. It is also the safe direction when the container read fails or lands
 * empty: everything falls back to Savings rather than money vanishing from a
 * total on a network blip.
 */
export const UNATTRIBUTED_SLUG = "savings";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function suppliedUsdBySlug(
  rows: readonly SubaccountBalanceRow[],
  positions: readonly YieldPosition[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (key: string, usd: number) => {
    if (!key || !(usd > 0)) return;
    out[key] = (out[key] ?? 0) + usd;
  };

  const yieldRows = rows.filter((r) => r.placement === "yield" && Number(r.balanceRaw) > 0 && !!r.slug);

  for (const position of positions) {
    const amount = position.suppliedUsd;
    if (!(amount > 0)) continue;

    const token = norm(position.token);
    const chain = norm(position.chain);

    // The venue is deliberately not part of the match: there is one venue per
    // chain in this product (Kamino on Solana, Aave on EVM), and two spellings
    // of one fact is how they come to disagree. A position that did not name
    // its chain matches on token alone — better a split across chains than the
    // whole amount falling to the fallback.
    const matching = yieldRows.filter((r) => {
      if (norm(r.tokenId) !== token) return false;
      if (!chain) return true;
      return norm(r.chain) === chain;
    });

    const totalRaw = matching.reduce((sum, r) => sum + Number(r.balanceRaw), 0);
    if (!(totalRaw > 0)) {
      add(UNATTRIBUTED_SLUG, amount);
      continue;
    }

    // Shares by principal, then the float remainder goes to the largest share:
    // a hero built from these has to add up to the figure above it.
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

/**
 * What each container holds at a venue right now.
 *
 * The container read is fetched here because a screen that needs the split
 * needs it to render, not as an optimisation. An unanswered read attributes
 * everything to Savings, which is the behaviour that shipped before the split
 * existed: the worst case is the old screen, never a balance that dropped.
 */
export function useSuppliedBySlug(positions: readonly YieldPosition[] | undefined) {
  const container = useContainer();
  const balances = useContainerBalances(container.data?.container.id ?? null);
  const rows = balances.data?.balances ?? [];
  return { bySlug: suppliedUsdBySlug(rows, positions ?? []), rows };
}

/* ── What our cut of the interest is ──────────────────────────────── */

/**
 * Our share of the interest on money deliberately set aside — SAVINGS_FEE_BPS
 * (1500) on the backend, `SAVINGS_PERF_FEE` in the app. We never touch
 * principal, so the cut is exactly a haircut on the rate.
 */
export const SAVINGS_PERF_FEE = 0.15;

/**
 * Our share of the interest on an idle Main balance — `mainInterestShareBps`
 * (4000) in this repo's rates.config, which is the published number.
 */
export const MAIN_PERF_FEE = 0.4;

/**
 * The fee on one pooled position, blended across the containers that own it.
 *
 * A position is per address and has no container of its own, so a flat savings
 * rate here would quietly charge the Savings price on money sitting in Main. An
 * unanswered read prices at MAIN, matching the server's own fallback: showing
 * 15% while the server charges 40% surprises the user with a fee at the moment
 * they withdraw, which is the worst moment for it.
 */
export function perfFeeForPosition(
  rows: readonly SubaccountBalanceRow[],
  position: { chain?: string | null; token: string },
): number {
  const chain = norm(position.chain);
  const token = norm(position.token);
  if (!token) return MAIN_PERF_FEE;

  let mainRaw = 0;
  let setAsideRaw = 0;
  for (const row of rows) {
    if (row.placement !== "yield") continue;
    const raw = Number(row.balanceRaw);
    if (!(raw > 0)) continue;
    if (norm(row.tokenId) !== token) continue;
    if (chain && norm(row.chain) !== chain) continue;
    if (norm(row.slug) === "main") mainRaw += raw;
    else setAsideRaw += raw;
  }

  const total = mainRaw + setAsideRaw;
  if (!(total > 0)) return MAIN_PERF_FEE;
  return (mainRaw * MAIN_PERF_FEE + setAsideRaw * SAVINGS_PERF_FEE) / total;
}

/** A gross reserve rate → the net rate the person keeps. Never show the gross one. */
export function netApy(grossApy: number): number {
  return grossApy * (1 - SAVINGS_PERF_FEE);
}

/** 0.051 → "5.1%". The app's `formatApy`. */
export function formatApy(apy: number): string {
  return `${(apy * 100).toFixed(1)}%`;
}

/* ── What it cost ─────────────────────────────────────────────────── */

export function useCostBasis() {
  return useRead("cost-basis", getCostBasis);
}

/* ── Standing payments ────────────────────────────────────────────── */

export function useScheduledPayments() {
  return useRead("scheduled", getScheduledPayments);
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
