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
  getAliases,
  getBalances,
  getContainer,
  getContainerBalances,
  getCostBasis,
  getKaminoPositions,
  getKaminoReserves,
  getLots,
  getOfframpOrders,
  getPriceHistory,
  getPrices,
  getRailAccounts,
  getRealized,
  getScheduledPayments,
  getTransferDetails,
  getTransfers,
  getYieldAuthorization,
  pocketsOf,
  type AcquisitionLot,
  type AliasRecord,
  type Balance,
  type BalancesAnswer,
  type ContainerAnswer,
  type LedgerSubaccount,
  type OfframpOrder,
  type RailAccount,
  type RealizedReport,
  type Schedule,
  type SubaccountBalanceRow,
  type TransferDetails,
  type TransfersAnswer,
  type YieldAuthorization,
  type YieldPosition,
  type YieldReserve,
} from "./hold-api";
import { useMyAddresses } from "./spaces-data";

const OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 30_000,
  /* A couple of retries so a cold start on the API does not stick as an
   * error; after that the screen says so and offers its own Retry. */
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 3_000,
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

/** One transfer, expanded — what the app's details sheet is drawn from. */
export function useTransferDetails(id: string | null) {
  return useRead<TransferDetails>(id ? "transfer-details" : null, () => getTransferDetails(id!), id ?? "");
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
    // Keyed on the addresses having ANSWERED, not on there being one. Somebody
    // with no wallet yet has nothing supplied, and a key that never resolves
    // would leave the screens that wait on this loading for ever.
    addrs.data ? "yield-positions" : null,
    async () => {
      // A venue that did not answer is NAMED, not swallowed. A Kamino 502 is
      // common enough (it 502s on call size), and a hero that quietly adds up
      // what is left states a total smaller than the person's, confidently.
      // With `failed` the screens can print "-" or say what the figure leaves
      // out: an empty read and a failed read are not the same claim about
      // somebody's money.
      const failed: Venue[] = [];
      const [kamino, aave] = await Promise.all([
        solana
          ? getKaminoPositions(solana).then(
              // Kamino runs on Solana and nowhere else, and does not say so in
              // its answer. The chain is what attributes a position to a
              // container (the split matches on chain and token), so it is
              // written on here rather than left for every reader to assume.
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

/**
 * A rate on offer, with the venue that offers it written on.
 *
 * Neither endpoint says which protocol answered it — it has no need to, each
 * one only ever answers for itself. Native mode DOES need it: there the shelf
 * is one card per protocol ("Aave · Base"), and a venue derived at the point
 * of drawing from the chain is a second spelling of a fact this read already
 * knows, which is how two spellings come to disagree.
 */
export interface RatedReserve extends YieldReserve {
  venue: Venue;
}

/** The rates on offer, for the line that says what money would earn. Open to anyone. */
export function useYieldReserves() {
  return useRead<RatedReserve[]>("yield-reserves", async () => {
    const tag = (venue: Venue) => (reserves: YieldReserve[]) => reserves.map((r) => ({ ...r, venue }));
    const [kamino, aave] = await Promise.allSettled([
      getKaminoReserves().then((a) => tag("kamino")(a.reserves)),
      getAaveReserves().then((a) => tag("aave")(a.reserves)),
    ]);
    /* One venue down still shows the other. Both down is a failed read, never
     * an empty shelf: an empty shelf reads as "Savings is coming soon". */
    if (kamino.status === "rejected" && aave.status === "rejected") throw kamino.reason;
    return [
      ...(kamino.status === "fulfilled" ? kamino.value : []),
      ...(aave.status === "fulfilled" ? aave.value : []),
    ];
  });
}

/** What a venue is called on screen. */
export const VENUE_NAME: Record<Venue, string> = { kamino: "Kamino", aave: "Aave" };

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

/**
 * Realised disposals for one tax year, or all of them (`"all"`) — the second
 * is what the year picker and the Performance "Sold" card read.
 */
export function useRealized(year: number | "all") {
  return useRead<RealizedReport>("realized", () => getRealized(year === "all" ? null : year), String(year));
}

/** The acquisitions behind one ticker, or every lot when `token` is omitted. */
export function useLots(token?: string) {
  return useRead<AcquisitionLot[]>("lots", () => getLots(token ? { token } : {}), token ?? "*");
}

/* ── Standing payments ────────────────────────────────────────────── */

export function useScheduledPayments() {
  return useRead<{ schedules: Schedule[] }>("scheduled", getScheduledPayments);
}

/** Bank payouts and where each of them got to. */
export function usePayouts(limit = 20) {
  return useRead<{ orders: OfframpOrder[]; hasMore?: boolean }>("payouts", () => getOfframpOrders(limit), String(limit));
}

/* ── Where money can arrive ───────────────────────────────────────── */

/** The virtual accounts a bank transfer can land in. A row means there is one. */
export function useRailAccounts() {
  return useRead<{ accounts: RailAccount[] }>("rails", getRailAccounts);
}

/* ── The person's own name ────────────────────────────────────────── */

/** `@alex` and the address behind it, for the hi.me link. */
export function useAliases() {
  return useRead<AliasRecord[]>("aliases", getAliases);
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
  /** The ledger's own split rows, for a screen that prices a position itself. */
  rows: SubaccountBalanceRow[];
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
    rows,
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
