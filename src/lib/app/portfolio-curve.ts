/**
 * The Invest hero's curve, as pure arithmetic: no React, no fetch, so it can
 * be checked with `npx sucrase-node src/lib/app/portfolio-curve.check.ts`.
 *
 * WHAT THE WIRE SAYS (read off the route and off production, 24-Sep-2026)
 *
 * `GET /api/v1/prices/history?symbol=SOL&days=7` answers
 *
 *   { data: { symbol: "SOL", prices: [{ timestamp: 1789624800000, price: 99.46 }, …] } }
 *
 * — `server/api/prices.router.ts` wraps `getPriceHistory` from
 * `server/services/prices.service.ts`, which maps CoinGecko's `market_chart`
 * tuples into objects. The timestamps are MILLISECONDS and both fields are
 * numbers. `days` is the zod enum "7" | "30" | "90" | "365": 7, 30 and 90
 * come back hourly (168, 720 and 2160 points), 365 daily (366), and every
 * range ends on one extra sample stamped "now". A symbol the backend has no
 * CoinGecko id for answers 200 with `prices: []`, and so does an upstream
 * failure: the service catches it and returns an empty list.
 *
 * The normaliser below still takes tuples, seconds and numeric strings. They
 * are not what production sends today; they are what it sent, or what a
 * cached answer from another code path sends, and the first time the shape
 * moved it blanked the chart in production without a single error.
 *
 * WHAT THE LINE IS
 *
 *   y(t) = Σ over legs of (amount held now × that asset's price at t)
 *
 * the app's own semantic (`hooks/usePortfolioHistory`): what is held today,
 * priced backwards. Not a replay of the ledger, which no endpoint offers.
 *
 * A leg is left OUT of the line, and its dollars are counted so the hero can
 * say so, when:
 *
 *   - the request for its series failed,
 *   - the series has fewer than two points (no history for that symbol),
 *   - the series ends more than two days ago (a delisted feed would otherwise
 *     be priced flat to the right edge), or
 *   - the series' last price disagrees with the live price the hero used by
 *     more than 2× either way. That is not volatility, it is a different
 *     coin: on 24-Sep-2026 `JUP` resolved to CoinGecko's `jupiter` (the old
 *     Jupiter Project, $0.000317) while the holding is valued by mint at
 *     $0.2879. Charting it would draw JUP at a thousandth of its value and
 *     the range delta would inherit the error.
 *
 * The last point is then pinned to the live value of the legs that ARE in the
 * line, so the right edge is the same money the hero prints for them, and
 * never the hero total itself when something is left out: pinning a partial
 * line to the whole total invents a jump at the right edge that never
 * happened (the app learnt that one with xStocks).
 *
 * Ticks before a leg's series begins are dropped rather than priced at zero:
 * a coin that listed in March cannot be worth anything in January, and a zero
 * would draw a cliff. The curve then starts later than the range, `coversRange`
 * says so, so the hero labels the delta "since <date>" instead of "1y".
 */

/** One sample: [epoch milliseconds, price in dollars], oldest first. */
export type PriceSeries = [number, number][];

/** What a series request came back with. `"failed"` is a request that did not answer, never an empty history. */
export type SeriesAnswer = PriceSeries | "failed";

/** One asset in the line: how much is held now and what the hero says it is worth now. */
export interface ChartLeg {
  symbol: string;
  amount: number;
  liveUsd: number;
}

export interface CurvePoint {
  t: number;
  y: number;
}

export type LeftOutReason = "failed" | "no-history" | "stale" | "mismatch";

export interface PortfolioCurve {
  points: CurvePoint[];
  /** Live dollars of the legs the line is made of. The pinned right edge. */
  chartedUsd: number;
  /** Live dollars in the hero total that the line does not contain. */
  unchartedUsd: number;
  /** Which symbols were left out, and why. */
  leftOut: { symbol: string; usd: number; reason: LeftOutReason }[];
  /** True when every leg's request failed: a retry, not "no history". */
  allFailed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A series whose newest sample is older than this is a feed that stopped. */
const STALE_MS = 2 * DAY_MS;
/** Live price ÷ series price outside [1/2, 2] is a different coin, not a move. */
const MISMATCH_RATIO = 2;
/** A final sample this close to now is replaced by the live value; an older one is followed by it. */
const PIN_WINDOW_MS = 90 * 60 * 1000;
/** Below this, left-out value is rounding, not a disclosure. */
export const UNCHARTED_DUST_USD = 0.01;

function num(v: unknown, dateOk = false): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    // An ISO date is a timestamp too — and only a timestamp: "2026" is not a price.
    if (!dateOk) return null;
    const d = Date.parse(v);
    return Number.isFinite(d) ? d : null;
  }
  return null;
}

/**
 * Whether a unit price off a series can be the same coin as the live unit
 * price the hero values the holding at. Outside 2× either way it is a symbol
 * resolved to the wrong feed (see JUP above), and anything read off it — the
 * line, the range delta, the 24h row move — is wrong by that factor.
 */
export function sameCoin(liveUnit: number, seriesPrice: number): boolean {
  const ratio = liveUnit / seriesPrice;
  return ratio <= MISMATCH_RATIO && ratio >= 1 / MISMATCH_RATIO;
}

/**
 * Any series the server has sent or may send → ms-stamped, oldest first, one
 * sample per instant, positive prices only.
 *
 * A timestamp under 10^12 is seconds (10^12 ms is September 2001, so nothing
 * we chart is below it in ms, and nothing in seconds is above it until the
 * year 33658). A zero or negative price is a gap in the feed, not a price.
 */
export function normalisePriceSeries(raw: unknown): PriceSeries {
  if (!Array.isArray(raw)) return [];
  const byT = new Map<number, number>();
  for (const p of raw as unknown[]) {
    let tRaw: unknown;
    let vRaw: unknown;
    if (Array.isArray(p)) {
      tRaw = p[0];
      vRaw = p[1];
    } else if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      tRaw = o.timestamp ?? o.t ?? o.time;
      vRaw = o.price ?? o.p ?? o.value;
    } else continue;
    let t = num(tRaw, true);
    const v = num(vRaw);
    if (t === null || v === null || t <= 0 || !(v > 0)) continue;
    if (t < 1e12) t *= 1000;
    byT.set(Math.round(t), v);
  }
  return [...byT].sort((a, b) => a[0] - b[0]);
}

/**
 * Legs → curve. `answers` is keyed by upper-case symbol; a symbol with no
 * entry is treated as a failed request. `extraUnchartedUsd` is money the
 * caller counts in the hero and cannot put in the line at all (supplied
 * tokens other than SOL), so the disclosure covers it too.
 */
export function buildPortfolioCurve(
  legs: readonly ChartLeg[],
  answers: Readonly<Record<string, SeriesAnswer>>,
  now: number,
  extraUnchartedUsd = 0,
): PortfolioCurve {
  const leftOut: PortfolioCurve["leftOut"] = [];
  const charted: { amount: number; liveUsd: number; series: PriceSeries }[] = [];
  let requested = 0;
  let failed = 0;

  for (const leg of legs) {
    if (!(leg.amount > 0) || !Number.isFinite(leg.liveUsd)) continue;
    const symbol = leg.symbol.toUpperCase();
    const answer = answers[symbol] ?? "failed";
    requested += 1;
    const out = (reason: LeftOutReason) => leftOut.push({ symbol, usd: leg.liveUsd, reason });
    if (answer === "failed") {
      failed += 1;
      out("failed");
      continue;
    }
    if (answer.length < 2) {
      out("no-history");
      continue;
    }
    const [lastT, lastP] = answer[answer.length - 1];
    if (now - lastT > STALE_MS) {
      out("stale");
      continue;
    }
    if (!sameCoin(leg.liveUsd / leg.amount, lastP)) {
      out("mismatch");
      continue;
    }
    charted.push({ amount: leg.amount, liveUsd: leg.liveUsd, series: answer });
  }

  const unchartedUsd = leftOut.reduce((s, l) => s + l.usd, 0) + Math.max(0, extraUnchartedUsd);
  const chartedUsd = charted.reduce((s, c) => s + c.liveUsd, 0);
  const allFailed = requested > 0 && failed === requested;
  if (!charted.length) return { points: [], chartedUsd: 0, unchartedUsd, leftOut, allFailed };

  // The densest series is the clock; every other leg is read at its last
  // sample at or before each tick.
  const clock = charted.reduce((best, c) => (c.series.length > best.series.length ? c : best), charted[0]).series;
  const cursors = charted.map(() => 0);
  const points: CurvePoint[] = [];
  for (const [t] of clock) {
    let y = 0;
    let complete = true;
    charted.forEach((c, i) => {
      const s = c.series;
      while (cursors[i] + 1 < s.length && s[cursors[i] + 1][0] <= t) cursors[i] += 1;
      const [st, sp] = s[cursors[i]];
      if (st > t) complete = false;
      else y += c.amount * sp;
    });
    if (complete && Number.isFinite(y)) points.push({ t, y });
  }
  if (!points.length) return { points, chartedUsd, unchartedUsd, leftOut, allFailed };

  // The right edge is the live value of exactly these legs.
  const last = points[points.length - 1];
  if (now - last.t <= PIN_WINDOW_MS) points[points.length - 1] = { t: Math.max(last.t, now), y: chartedUsd };
  else points.push({ t: now, y: chartedUsd });

  return { points, chartedUsd, unchartedUsd, leftOut, allFailed };
}

/**
 * Whether the line covers the range it is labelled with. Under 90% of it —
 * a coin younger than the range — the delta is labelled by its real start.
 */
export function coversRange(points: readonly CurvePoint[], days: number, now: number): boolean {
  if (points.length < 2) return false;
  return now - points[0].t >= days * DAY_MS * 0.9;
}

/* ── The 24h move ─────────────────────────────────────────────────── */

/**
 * How far from "24 hours ago" a sample may sit and still be read as the price
 * a day ago. The 7-day series is hourly, so a healthy one always has a sample
 * within the hour. A series whose nearest sample is further off is a stale
 * cache or a coin younger than a day, and a price read off it would put a
 * week's move (or a jump from nothing) under a "24h" label.
 */
export const DAY_AGO_TOLERANCE_MS = 6 * 60 * 60 * 1000;

/**
 * A normalised series → the price at 24 hours before `now`, or null when the
 * series cannot say: empty, or with nothing within `DAY_AGO_TOLERANCE_MS` of
 * the cutoff. The last sample at or before the cutoff wins; failing that, the
 * first one after it.
 */
export function priceADayAgo(series: PriceSeries, now: number): number | null {
  const cutoff = now - DAY_MS;
  let before: [number, number] | null = null;
  let after: [number, number] | null = null;
  for (const point of series) {
    if (point[0] <= cutoff) {
      if (!before || point[0] > before[0]) before = point;
    } else if (!after || point[0] < after[0]) after = point;
  }
  const chosen =
    before && cutoff - before[0] <= DAY_AGO_TOLERANCE_MS
      ? before
      : after && after[0] - cutoff <= DAY_AGO_TOLERANCE_MS
        ? after
        : null;
  return chosen && Number.isFinite(chosen[1]) && chosen[1] > 0 ? chosen[1] : null;
}

/** One holding as the 24h move reads it. `usd` null is a holding we cannot price now. */
export interface DayMoveRow {
  symbol: string;
  amount: number;
  usd: number | null;
  stable: boolean;
}

export interface DayMove {
  usd: number;
  pct: number;
  /** Tickers held but not in the move: no price a day ago, no price now, or a feed that is another coin. */
  leftOut: string[];
}

/**
 * The 24h move over the holdings that can be priced on both days.
 *
 * A holding with no price a day ago (the history read failed, came back stale,
 * or is a different coin — JUP on 24-Sep-2026) is left out of BOTH sides,
 * never valued at zero yesterday: that would print the whole holding as a
 * gain. Dollars count on both sides unchanged. With no volatile holding left
 * to measure there is no move to show, so the answer is null rather than a
 * 0.00% that only says the stablecoins held their peg.
 */
export function dayMove(rows: readonly DayMoveRow[], ago: Readonly<Record<string, number>>): DayMove | null {
  let then = 0;
  let now = 0;
  let measured = 0;
  const leftOut: string[] = [];
  for (const row of rows) {
    if (row.stable) {
      then += row.usd ?? 0;
      now += row.usd ?? 0;
      continue;
    }
    const was = ago[row.symbol];
    if (
      was === undefined ||
      !(was > 0) ||
      row.usd === null ||
      !(row.amount > 0) ||
      !sameCoin(row.usd / row.amount, was)
    ) {
      leftOut.push(row.symbol);
      continue;
    }
    then += row.amount * was;
    now += row.usd;
    measured += 1;
  }
  if (measured === 0 || !(then > 0)) return null;
  return { usd: now - then, pct: ((now - then) / then) * 100, leftOut };
}
