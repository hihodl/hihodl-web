"use client";

/**
 * Invest, as the HOLD app draws it.
 *
 * Ported from `app/(drawer)/(internal)/invest/index.tsx` in its order: the
 * hero (`(tabs)/earn/_components/EarnHero`) with the invested value and its
 * curve, the coverage note that says what the total leaves out, the primary
 * action, the Solana earning row (`features/invest/components/SolEarnRow`),
 * the Assets card, then Buy (`_components/CoinTiles`) and Stocks
 * (`_components/StockTiles`). Empty is the app's `EmptyHero`.
 *
 * WHAT COUNTS, AND WHAT THE TOTAL LEAVES OUT
 *
 * Stablecoins are excluded (`isInvestable`): a USDC balance is spendable cash
 * on Home, not an investment. Somebody holding only dollars therefore sees an
 * honest empty Invest and a full shelf of things they could buy, which is most
 * of our creators and so is the path that has to look good.
 *
 * A holding no feed could price is NOT deleted from the screen: it is listed
 * with "—" for its value and counted in the note under the hero. Hiding money
 * because a feed is down is the one thing this screen must never do.
 *
 * WHERE THE CURVE COMES FROM
 *
 * The app calls DefiLlama straight from the device. A browser cannot — CORS
 * and the rate limit are both in the way — so this draws the same shape from
 * our own `GET /prices/history` (see `usePortfolioHistory`). Two consequences,
 * both deliberate: there is no 24H range here, because the backend's `days` is
 * 7, 30, 90 or 365 and nothing else; and an asset with no series is disclosed
 * under the chart rather than folded into the line.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * Performance, the realised-gains report and the cost-basis lot editor are not
 * built: `/portfolio/lots`, `/portfolio/realized` and `/stocks/availability`
 * are not mounted on this backend and would 404. The Fear & Greed card on
 * Performance is a third-party call from the device, which a page cannot make
 * either. `GET /portfolio/cost-basis` does exist, and it is what puts the move
 * against what you paid under each value.
 *
 * VIEW ONLY. Buying, exchanging and supplying are signatures; every row that
 * offers one in the app says here where it happens.
 */

import { useMemo, useState } from "react";

import type { Balance } from "@/lib/app/hold-api";
import {
  formatApy,
  isStable,
  perfFeeForPosition,
  useAllBalances,
  useContainer,
  useCostBasis,
  usePortfolioHistory,
  usePrices,
  useSuppliedBySlug,
  useYieldPositions,
  useYieldReserves,
  usdOf,
  type CurvePoint,
} from "@/lib/app/money";

import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { money } from "../wallet/app-kit";
import { DISCOVER_COINS, tileSubtitle, discoverableFor } from "./discover-coins";
import { AssetMark, InAppNote } from "./kit";

/** theme/colors `invest`: gain green, and a loss in neutral white. Never red. */
const UP = "#3DDC84";
const DOWN = "#FFFFFF";

/** Below this the move is a rounding artifact, not a direction. */
const FLAT_PCT = 0.005;

/** The app's dust threshold, applied only where a feed produced a number. */
const INVEST_DUST_USD = 0.01;

const RANGES = [
  { label: "7D", short: "7d", days: 7 },
  { label: "30D", short: "30d", days: 30 },
  { label: "90D", short: "90d", days: 90 },
  { label: "1Y", short: "1y", days: 365 },
] as const;

type Range = (typeof RANGES)[number];

/** One holding, aggregated across chains and accounts the way a fintech view reads it. */
interface Holding {
  symbol: string;
  amount: number;
  /** Null when no feed answered. Not zero — that is a different claim. */
  usd: number | null;
}

/** Token units: more precision under 1, tidy for whole coins. */
function units(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 4 : 6 });
}

function symbolOf(b: Balance): string {
  return (b.symbol ?? b.tokenId ?? "").toUpperCase();
}

export function InvestScreen() {
  const container = useContainer();
  const accounts = useMemo(() => (container.data?.subaccounts ?? []).map((s) => s.slug), [container.data]);
  const balances = useAllBalances(accounts);

  const rows = useMemo(() => Object.values(balances.data ?? {}).flatMap((a) => a.balances), [balances.data]);
  const symbols = useMemo(() => [...new Set(rows.map(symbolOf).filter(Boolean))], [rows]);
  const mints = useMemo(() => [...new Set(rows.map((b) => b.mint).filter((m): m is string => !!m))], [rows]);
  const prices = usePrices(symbols, mints);
  const basis = useCostBasis();

  /* Supplied money is not in `/balances`, which is liquid by design. The app
   * folds the working SOL back into the hero for exactly that reason: without
   * it the two screens print different totals for the same money. */
  const positions = useYieldPositions();
  const reserves = useYieldReserves();
  const { rows: placementRows } = useSuppliedBySlug(positions.data);
  const working = useMemo(() => {
    const invested = (positions.data ?? []).filter((p) => !isStable(p.token));
    const usd = invested.reduce((s, p) => s + p.suppliedUsd, 0);
    const sol = invested
      .filter((p) => p.token.toUpperCase() === "SOL")
      .reduce((s, p) => s + Number(p.suppliedBaseUnits) / 1e9, 0);
    const rated = invested
      .map((p) => {
        const reserve = (reserves.data ?? []).find((r) => (r.token || r.symbol || "").toLowerCase() === p.token.toLowerCase());
        return { usd: p.suppliedUsd, apy: (reserve?.supplyApy ?? 0) * (1 - perfFeeForPosition(placementRows, p)) };
      })
      .filter((r) => r.apy > 0 && r.usd > 0);
    const apy = rated.length ? rated.reduce((s, r) => s + r.apy * r.usd, 0) / rated.reduce((s, r) => s + r.usd, 0) : null;
    return { usd, sol, apy, failed: !!positions.error };
  }, [positions.data, positions.error, reserves.data, placementRows]);

  /* Investable holdings: real balances, stablecoins excluded, biggest first.
   * A holding we could not VALUE is not a holding worth nothing, so the dust
   * threshold only applies where a price actually answered. */
  const holdings = useMemo<Holding[]>(() => {
    const bySymbol = new Map<string, { amount: number; usd: number; priced: boolean }>();
    for (const b of rows) {
      const symbol = symbolOf(b);
      if (!symbol || isStable(symbol)) continue;
      const amount = Number(b.balance);
      if (!Number.isFinite(amount)) continue;
      const usd = prices.data ? usdOf(b, prices.data.prices) : null;
      const prev = bySymbol.get(symbol) ?? { amount: 0, usd: 0, priced: true };
      bySymbol.set(symbol, {
        amount: prev.amount + amount,
        usd: prev.usd + (usd ?? 0),
        priced: prev.priced && usd !== null,
      });
    }
    return [...bySymbol]
      .map(([symbol, v]) => ({ symbol, amount: v.amount, usd: v.priced ? v.usd : null }))
      .filter((h) => (h.usd === null ? h.amount > 0 : h.usd >= INVEST_DUST_USD))
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  }, [rows, prices.data]);

  const unvalued = holdings.filter((h) => h.usd === null).length;
  const investValue = holdings.reduce((s, h) => s + (h.usd ?? 0), 0) + working.usd;
  const hasInvestments = holdings.length > 0 || working.usd > 0;

  const [range, setRange] = useState<Range>(RANGES[0]);
  const charted = useMemo(
    () => holdings.filter((h) => h.usd !== null).map((h) => ({ symbol: h.symbol, amount: h.amount, usd: h.usd ?? 0 })),
    [holdings],
  );
  const history = usePortfolioHistory(charted, range.days);

  /* What the person paid, from our own ledger — the move against weighted
   * average cost, summed per (chain, token) because that is the grain the
   * basis is computed at. A holding where ANY leg has no tracked basis shows
   * no move at all: half a move is a wrong number, and `hasBasis:false` is
   * missing history, never a $0 cost we invented for it. */
  const moveFor = useMemo(() => {
    const wac = new Map<string, number>();
    for (const p of basis.data?.positions ?? []) {
      if (!p.hasBasis || p.wacUsd == null || !(p.wacUsd > 0)) continue;
      wac.set(`${p.chain.toLowerCase()}|${p.tokenId.toUpperCase()}`, p.wacUsd);
    }
    const out = new Map<string, number>();
    const incomplete = new Set<string>();
    for (const b of rows) {
      const symbol = symbolOf(b);
      if (!symbol || isStable(symbol)) continue;
      const amount = Number(b.balance);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const paid = wac.get(`${(b.chain ?? "").toLowerCase()}|${symbol}`) ?? wac.get(`${(b.chainLegacy ?? "").toLowerCase()}|${symbol}`);
      const usd = prices.data ? usdOf(b, prices.data.prices) : null;
      if (paid === undefined || usd === null) {
        incomplete.add(symbol);
        continue;
      }
      out.set(symbol, (out.get(symbol) ?? 0) + (usd - amount * paid));
    }
    for (const symbol of incomplete) out.delete(symbol);
    return out;
  }, [basis.data, rows, prices.data]);

  /* Loading until every read that can change the total has answered one way or
   * the other. A failed read is an answer; a read still out is not, and
   * drawing a total before the prices land prints a portfolio of em dashes for
   * a second and then replaces it. */
  const loading =
    (!container.data && !container.error) ||
    (accounts.length > 0 && !balances.data && !balances.error) ||
    (symbols.length > 0 && !prices.data && !prices.error);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col">
        {loading ? (
          <Skeleton className="h-[248px]" />
        ) : hasInvestments ? (
          <Hero
            totalValue={investValue}
            points={history.data?.points ?? []}
            loading={history.isLoading && !history.data}
            unchartedUsd={history.data?.unchartedUsd ?? 0}
            range={range}
            onRange={setRange}
          />
        ) : (
          <EmptyHero />
        )}

        {/* Says what the total leaves out. Only when something is missing, and
            only ever about the feed — never about the holding, which is
            perfectly real and sitting on chain. */}
        {!loading && unvalued > 0 ? (
          <p className="mt-2.5 px-1 text-[13px] font-strong text-white/[0.8]">
            {unvalued === 1
              ? "1 holding is not in this total — no price available right now."
              : `${unvalued} holdings are not in this total — no price available right now.`}
          </p>
        ) : null}

        {/* The app's inline primary action, drawn as the app draws it. On the
            web it is a statement rather than a tap: an exchange is a signature. */}
        <div className="mt-3.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[26px] border border-white/[0.22] bg-white/10">
          <Ion name="trending-up-outline" size={18} className="text-white" />
          <span className="text-[16px] font-extrabold tracking-[-0.2px] text-white">Invest</span>
        </div>
        <div className="mt-2.5">
          <InAppNote>Buying and exchanging happen in the HOLD app, where the trade is signed on your own device.</InAppNote>
        </div>

        {working.sol > 0 || working.failed ? (
          <SolEarnRow workingSol={working.sol} apy={working.apy} failed={working.failed} />
        ) : null}

        {!loading && holdings.length ? (
          <section className="mt-[26px]">
            <h2 className="px-1 text-[22px] font-bold tracking-[-0.4px] text-white">Assets</h2>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,27,40,0.72),rgba(6,18,30,0.64))] shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              {holdings.map((h, i) => (
                <div key={h.symbol}>
                  {i > 0 ? <div className="ml-16 h-px bg-white/[0.06]" /> : null}
                  <AssetRow holding={h} move={moveFor.get(h.symbol) ?? null} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <BuySection held={holdings} />
        <StocksSection />
      </div>
    </div>
  );
}

/* ── EarnHero ─────────────────────────────────────────────────────── */

interface Delta {
  abs: number;
  pct: number;
  dir: -1 | 0 | 1;
}

/** Change across the drawn range: first real sample → last. */
function deltaOverRange(points: readonly CurvePoint[]): Delta | null {
  if (points.length < 2) return null;
  const first = points[0].y;
  const last = points[points.length - 1].y;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;
  const abs = last - first;
  const pct = (abs / first) * 100;
  return { abs, pct, dir: pct > FLAT_PCT ? 1 : pct < -FLAT_PCT ? -1 : 0 };
}

function Hero({
  totalValue,
  points,
  loading,
  unchartedUsd,
  range,
  onRange,
}: {
  totalValue: number;
  points: CurvePoint[];
  loading: boolean;
  unchartedUsd: number;
  range: Range;
  onRange: (r: Range) => void;
}) {
  // The delta comes off the real curve and nowhere else: a percentage read off
  // an invented series would be an invented percentage. No curve, no delta.
  const delta = deltaOverRange(points);
  const arrow = delta ? (delta.dir > 0 ? " ▲" : delta.dir < 0 ? " ▼" : "") : "";
  const sign = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;
  const deltaText = delta ? `${range.short}  ${sign(delta.abs)}${arrow} ${Math.abs(delta.pct).toFixed(2)}%` : "";

  return (
    <section
      className="min-h-[248px] rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,27,40,0.72),rgba(6,18,30,0.64))] px-[22px] pb-4 pt-[22px] shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl"
      aria-label="Invested value"
    >
      <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-white/[0.55]">Invested value</p>
      <p className="mt-1 truncate text-[44px] font-strong leading-[1.1] tracking-[-1.2px] tabular-nums text-white">{money(totalValue)}</p>

      {/* One sub-line at a fixed height, so it never nudges the chart. Green
          only for a real gain: flat and down are both neutral white. */}
      <p
        className="mt-2 h-[18px] truncate text-[13.5px] font-bold tracking-[-0.1px] tabular-nums"
        style={{ color: delta && delta.dir > 0 ? UP : DOWN }}
      >
        {deltaText}
      </p>

      <div className="relative mt-2.5 h-[160px]">
        {points.length > 1 ? (
          <Curve points={points} up={!delta || delta.dir >= 0} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[14px] font-strong text-white/[0.55]">
              {loading ? "Loading…" : "No price history for these assets"}
            </p>
          </div>
        )}
      </div>

      {unchartedUsd > 0.01 ? (
        <p className="mt-2 truncate text-[11.5px] font-strong tracking-[-0.1px] text-white/[0.8]">
          Chart excludes {money(unchartedUsd)} with no price history
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
        {RANGES.map((r) => {
          const on = r.label === range.label;
          return (
            <button
              key={r.label}
              type="button"
              aria-pressed={on}
              onClick={() => onRange(r)}
              // The pill's radius is half its height, and choosing one changes
              // a COLOUR — never a border width.
              className={`inline-flex h-[26px] min-w-[38px] shrink-0 items-center justify-center rounded-[13px] border px-2.5 text-[12px] tracking-[0.4px] transition-colors ${
                on ? "border-white/[0.28] bg-white/[0.16] font-bold text-white" : "border-transparent font-strong text-white/[0.55] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The portfolio line: one path over a soft fill, in the colour of the move. */
function Curve({ points, up }: { points: readonly CurvePoint[]; up: boolean }) {
  const W = 1000;
  const H = 160;
  const ys = points.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - lo) / span) * (H - 16);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const ink = up ? UP : DOWN;
  const id = `curve-${up ? "up" : "flat"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Portfolio value over the chosen range">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.22" />
          <stop offset="100%" stopColor={ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={ink} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── EmptyHero ────────────────────────────────────────────────────── */

function EmptyHero() {
  return (
    <section className="flex min-h-[150px] flex-col justify-center rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,27,40,0.72),rgba(6,18,30,0.64))] p-[22px] shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <h2 className="text-[26px] font-bold tracking-[-0.6px] text-white">Grow your wealth</h2>
      <p className="mt-2 text-[14px] leading-5 text-white/[0.8]">
        Turn your dollars into Bitcoin, Solana and more — right from your balance.
      </p>
    </section>
  );
}

/* ── AssetRow ─────────────────────────────────────────────────────── */

/**
 * One ticker, one number, and what the money did — the app's row, cut to two
 * facts on purpose.
 *
 * The app's second line is the last 24 hours in dollars, off the same series
 * its hero draws. Our own history endpoint starts at seven days, so there is no
 * 24h window to read and inventing one is not an option. What the line carries
 * instead is the other figure the app puts under a holding, on its cost screen:
 * the move against what this person paid, from `GET /portfolio/cost-basis`. A
 * holding with no tracked basis shows nothing rather than a guess, and a loss is
 * neutral white, never red.
 */
function AssetRow({ holding, move }: { holding: Holding; move: number | null }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-3.5">
      <AssetMark symbol={holding.symbol} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold tracking-[-0.2px] text-white">{holding.symbol}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        {/* An em dash, never "$0.00": a zero here is a claim about somebody's
            money and we do not have the price to make it. */}
        <p className="text-[15px] font-bold tracking-[-0.2px] tabular-nums text-white">
          {holding.usd === null ? "—" : money(holding.usd)}
        </p>
        {move !== null ? (
          <p className="truncate text-[12.5px] font-strong tracking-[-0.1px] tabular-nums" style={{ color: move >= 0 ? UP : DOWN }}>
            {move >= 0 ? "+" : "−"}
            {money(Math.abs(move))} since you bought
          </p>
        ) : (
          <p className="truncate text-[12.5px] tabular-nums text-white/[0.8]">{units(holding.amount)}</p>
        )}
      </div>
    </div>
  );
}

/* ── SolEarnRow ───────────────────────────────────────────────────── */

/** SOL amounts at a width that does not move. */
const sol = (n: number) => n.toFixed(4);

function SolEarnRow({ workingSol, apy, failed }: { workingSol: number; apy: number | null; failed: boolean }) {
  const working = workingSol > 0;
  // A zero we cannot vouch for. The row must not pitch over it.
  const standing = working ? `${sol(workingSol)} earning` : failed ? "Couldn't check your position" : "Put your Solana to work";
  return (
    <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-3.5">
      <AssetMark symbol="SOL" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-white">Solana</p>
        <p className="mt-px truncate text-[12.5px] leading-[17px] tabular-nums text-white/[0.8]">{standing}</p>
      </div>
      <div className="flex flex-col items-end">
        {/* A rate we could not read is a dash, never 0.0%. */}
        <p className="text-[15px] font-bold tabular-nums text-white">{apy != null && apy > 0 ? formatApy(apy) : "—"}</p>
        <p className="text-[11px] text-white/[0.8]">a year</p>
      </div>
    </div>
  );
}

/* ── CoinTiles ────────────────────────────────────────────────────── */

/**
 * What you can buy — the question nothing on this screen could answer before,
 * because Assets comes from what you already hold. Coins you own are dropped:
 * a tile offering to discover something you own reads as a bug.
 */
function BuySection({ held }: { held: readonly Holding[] }) {
  const coins = useMemo(() => discoverableFor(held, DISCOVER_COINS), [held]);
  if (!coins.length) return null;
  return (
    <section className="mt-[26px]">
      <h2 className="px-1 text-[22px] font-bold tracking-[-0.4px] text-white">Buy</h2>
      <div className="-mx-1 mt-3.5 flex gap-3 overflow-x-auto px-1 pb-1">
        {coins.map((c) => (
          <div
            key={c.id}
            className="flex h-32 w-32 shrink-0 flex-col justify-between rounded-[18px] border border-white/10 bg-white/[0.05] p-3.5"
            aria-label={c.wrappedBy ? `${c.name}, wrapped by ${c.wrappedBy}` : c.name}
          >
            <AssetMark symbol={c.symbol} size={38} />
            <div className="min-w-0">
              <p className="mt-1.5 truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{c.symbol}</p>
              <p className="truncate text-[12px] text-white/[0.8]">{tileSubtitle(c)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <InAppNote>Every one of these is one tap from a filled order in the HOLD app. The trade is signed on your phone.</InAppNote>
      </div>
    </section>
  );
}

/* ── StockTiles ───────────────────────────────────────────────────── */

/**
 * Tokenized US equities. The app gates this on `GET /stocks/availability`,
 * which is not mounted on this backend — so the web cannot know whether this
 * person is somewhere we are cleared to offer them, and it says that rather
 * than drawing a shelf of tickers it cannot stand behind.
 */
function StocksSection() {
  return (
    <section className="mt-[26px]">
      <h2 className="px-1 text-[22px] font-bold tracking-[-0.4px] text-white">Stocks</h2>
      <p className="mt-0.5 px-1 text-[13px] font-strong text-white/[0.8]">Tokenized US stocks · buy with your dollars</p>
      <div className="mt-3.5 flex items-center gap-3.5 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.07]">
          <Ion name="bar-chart-outline" size={19} className="text-white/80" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-[18px] text-white/[0.8]">
          Browsing and buying stocks happens in the HOLD app, which is also where we can tell whether they are offered where you are.
        </p>
      </div>
    </section>
  );
}
