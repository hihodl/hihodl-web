import * as C from "./portfolio-curve";
let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) { fails++; console.log("FAIL", name, ja, "!=", jb); } else console.log("ok  ", name);
}
const H = 3_600_000;
const D = 24 * H;
const NOW = 1790228890000; // what production stamped "now" on 24-Sep-2026

// ── The wire ─────────────────────────────────────────────────────────
// Production's own shape (curl /api/v1/prices/history?symbol=SOL&days=7).
eq("objects in ms", C.normalisePriceSeries([{ timestamp: 1789624800000, price: 99.46 }, { timestamp: 1789628400000, price: 99.66 }]), [[1789624800000, 99.46], [1789628400000, 99.66]]);
eq("tuples", C.normalisePriceSeries([[1789624800000, 1], [1789628400000, 2]]), [[1789624800000, 1], [1789628400000, 2]]);
eq("seconds become ms", C.normalisePriceSeries([{ timestamp: 1789624800, price: 5 }]), [[1789624800000, 5]]);
eq("numeric strings", C.normalisePriceSeries([{ timestamp: "1789624800000", price: "99.5" }]), [[1789624800000, 99.5]]);
eq("iso timestamp", C.normalisePriceSeries([{ timestamp: "2026-09-24T00:00:00Z", price: 2 }]), [[Date.parse("2026-09-24T00:00:00Z"), 2]]);
eq("sorted, deduped (last wins)", C.normalisePriceSeries([[3000000000000, 3], [1000000000000, 1], [3000000000000, 4]]), [[1000000000000, 1], [3000000000000, 4]]);
eq("zero, negative, NaN, junk dropped", C.normalisePriceSeries([[1e12 + 1, 0], [1e12 + 2, -1], [1e12 + 3, NaN], null, "x", { price: 3 }, [1e12 + 4, 7]]), [[1e12 + 4, 7]]);
eq("a date-looking price is not a price", C.normalisePriceSeries([{ timestamp: 1789624800000, price: "Sep 2026" }]), []);
eq("not an array", C.normalisePriceSeries({ prices: [] }), []);
eq("undefined", C.normalisePriceSeries(undefined), []);

// ── The curve ────────────────────────────────────────────────────────
const hourly = (n: number, price: (i: number) => number, end = NOW - 30 * 60_000): C.PriceSeries =>
  Array.from({ length: n }, (_, i) => [end - (n - 1 - i) * H, price(i)] as [number, number]);

// SOL 100 → 110 over 7 days, BTC flat at 80,000. 2 SOL + 0.01 BTC.
const sol = hourly(168, (i) => 100 + (10 * i) / 167);
const btc = hourly(168, () => 80_000);
const legs = [{ symbol: "SOL", amount: 2, liveUsd: 2 * 111 }, { symbol: "BTC", amount: 0.01, liveUsd: 800 }];
const c1 = C.buildPortfolioCurve(legs, { SOL: sol, BTC: btc }, NOW);
eq("first point is amount × price then", c1.points[0].y, 2 * 100 + 800);
eq("final sample pinned to live charted value", c1.points[c1.points.length - 1], { t: NOW, y: 222 + 800 });
eq("168 samples, last replaced", c1.points.length, 168);
eq("nothing left out", [c1.unchartedUsd, c1.leftOut.length, c1.allFailed], [0, 0, false]);
eq("ascending time", c1.points.every((p, i) => i === 0 || p.t > c1.points[i - 1].t), true);

// A final sample older than 90 minutes: the live edge is appended, not swapped.
const oldEnd = C.buildPortfolioCurve([{ symbol: "SOL", amount: 1, liveUsd: 110 }], { SOL: hourly(10, () => 100, NOW - 3 * H) }, NOW);
eq("live edge appended after a 3h-old sample", [oldEnd.points.length, oldEnd.points[9].y, oldEnd.points[10]], [11, 100, { t: NOW, y: 110 }]);

// JUP on 24-Sep-2026: history said $0.000317, the mint said $0.2879.
const jup = hourly(168, () => 0.000317);
const c2 = C.buildPortfolioCurve([...legs, { symbol: "JUP", amount: 1000, liveUsd: 287.9 }], { SOL: sol, BTC: btc, JUP: jup }, NOW);
eq("a different coin is left out, named, and counted", [c2.leftOut, Math.round(c2.unchartedUsd * 100) / 100], [[{ symbol: "JUP", usd: 287.9, reason: "mismatch" }], 287.9]);
eq("and the line is the same as without it", c2.points[0].y, c1.points[0].y);
eq("right edge is the charted value, never the hero total", c2.points[c2.points.length - 1].y, 1022);

// A real move is not a mismatch: down 40% in the week is still the same coin.
const crash = C.buildPortfolioCurve([{ symbol: "WIF", amount: 10, liveUsd: 6 }], { WIF: hourly(168, (i) => 1 - (0.4 * i) / 167) }, NOW);
eq("a 40% fall is charted", crash.leftOut.length, 0);

// Failures, gaps, stale feeds.
const c3 = C.buildPortfolioCurve(
  [...legs, { symbol: "NOPE", amount: 5, liveUsd: 50 }, { symbol: "OLD", amount: 1, liveUsd: 10 }, { symbol: "DOWN", amount: 1, liveUsd: 7 }],
  { SOL: sol, BTC: btc, NOPE: [], OLD: hourly(24, () => 10, NOW - 5 * D), DOWN: "failed" },
  NOW,
  12.5,
);
eq("reasons", c3.leftOut.map((l) => [l.symbol, l.reason]), [["NOPE", "no-history"], ["OLD", "stale"], ["DOWN", "failed"]]);
eq("uncharted includes the supplied non-SOL money", c3.unchartedUsd, 50 + 10 + 7 + 12.5);
eq("partial failure is not allFailed", c3.allFailed, false);
eq("missing answer counts as failed", C.buildPortfolioCurve([{ symbol: "X", amount: 1, liveUsd: 1 }], {}, NOW).allFailed, true);
eq("all failed → no points", C.buildPortfolioCurve(legs, { SOL: "failed", BTC: "failed" }, NOW).points.length, 0);
eq("no legs", C.buildPortfolioCurve([], {}, NOW), { points: [], chartedUsd: 0, unchartedUsd: 0, leftOut: [], allFailed: false });
eq("zero amount ignored", C.buildPortfolioCurve([{ symbol: "SOL", amount: 0, liveUsd: 0 }], { SOL: sol }, NOW).points.length, 0);
eq("lower-case symbol reads the upper-case answer", C.buildPortfolioCurve([{ symbol: "sol", amount: 1, liveUsd: 111 }], { SOL: sol }, NOW).points.length, 168);

// Alignment: a coarse series is read at its last sample at or before each tick.
const daily: C.PriceSeries = [[NOW - 2 * D, 10], [NOW - D, 20], [NOW - H / 2, 30]];
const fine = hourly(48, () => 1);
const c4 = C.buildPortfolioCurve([{ symbol: "A", amount: 1, liveUsd: 1 }, { symbol: "B", amount: 1, liveUsd: 30 }], { A: fine, B: daily }, NOW);
eq("coarse leg steps, never interpolated", [c4.points[0].y, c4.points[24].y], [1 + 10, 1 + 20]);

// A younger coin: ticks before it existed are dropped, and the range is not covered.
const young = hourly(24, () => 5);
const c5 = C.buildPortfolioCurve([{ symbol: "SOL", amount: 1, liveUsd: 111 }, { symbol: "PUMP", amount: 1, liveUsd: 5 }], { SOL: sol, PUMP: young }, NOW);
eq("starts where the youngest leg starts", c5.points[0].t, young[0][0]);
eq("does not cover 7 days", C.coversRange(c5.points, 7, NOW), false);
eq("the full week does", C.coversRange(c1.points, 7, NOW), true);

// 1Y: daily candles plus a "now" sample hours after the last one.
const yearly: C.PriceSeries = [...Array.from({ length: 365 }, (_, i) => [NOW - 6 * H - (364 - i) * D, 100] as [number, number]), [NOW - 60_000, 120]];
const c6 = C.buildPortfolioCurve([{ symbol: "SOL", amount: 1, liveUsd: 121 }], { SOL: yearly }, NOW);
eq("1Y: 366 points, live edge pinned", [c6.points.length, c6.points[365]], [366, { t: NOW, y: 121 }]);
eq("1Y covers its range", C.coversRange(c6.points, 365, NOW), true);

eq("sameCoin", [C.sameCoin(0.2879, 0.000317), C.sameCoin(115, 99), C.sameCoin(1, 2), C.sameCoin(1, 2.01)], [false, true, true, false]);

// ── The 24h move ─────────────────────────────────────────────────────
eq("a day ago: the sample at or before the cutoff", C.priceADayAgo(hourly(168, (i) => i + 1), NOW), 144);
eq("a day ago: empty series", C.priceADayAgo([], NOW), null);
eq("a day ago: stale cache, nothing near the cutoff", C.priceADayAgo([[NOW - 9 * D, 1], [NOW - 8 * D, 2]], NOW), null);
eq("a day ago: young coin, first sample 12h ago", C.priceADayAgo([[NOW - 12 * H, 3], [NOW - H, 4]], NOW), null);
eq("a day ago: series starts just after the cutoff", C.priceADayAgo([[NOW - D + H, 5], [NOW - H, 6]], NOW), 5);
const r = (symbol: string, amount: number, usd: number | null, stable = false) => ({ symbol, amount, usd, stable });
eq("move: SOL 100 to 110 plus 100 USDC", C.dayMove([r("SOL", 1, 110), r("USDC", 100, 100, true)], { SOL: 100 }), { usd: 10, pct: 5, leftOut: [] });
eq("move: JUP with no price a day ago is left out, not a gain", C.dayMove([r("SOL", 1, 110), r("JUP", 100, 50)], { SOL: 100 }), { usd: 10, pct: 10, leftOut: ["JUP"] });
eq("move: JUP priced as the wrong coin is left out", C.dayMove([r("SOL", 1, 110), r("JUP", 100, 28.79)], { SOL: 100, JUP: 0.000317 }), { usd: 10, pct: 10, leftOut: ["JUP"] });
eq("move: unpriced now is left out", C.dayMove([r("SOL", 1, 110), r("BONK", 5, null)], { SOL: 100, BONK: 1 }), { usd: 10, pct: 10, leftOut: ["BONK"] });
eq("move: nothing volatile measurable is no move", C.dayMove([r("JUP", 100, 50), r("USDC", 10, 10, true)], {}), null);
eq("move: stables only is no move", C.dayMove([r("USDC", 10, 10, true)], {}), null);

console.log(fails ? `${fails} FAILED` : "all ok");
if (fails) process.exit(1);
