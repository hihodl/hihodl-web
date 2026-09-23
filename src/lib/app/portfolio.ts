/**
 * The app's portfolio arithmetic, ported so the web cannot disagree with it.
 *
 * Two files in the app, one here:
 *
 *   src/features/invest/performance.ts  unrealised: what you hold, what it
 *                                       cost, what it is worth now; the ring
 *   src/features/invest/taxYear.ts      realised: what left, per tax year
 *
 * Kept as pure functions with no React in them, the same split the app makes,
 * because they are money calculations and a screen is the wrong place to
 * decide that a network fee is not a sale or that a chain we cannot cost is
 * absent from an average rather than averaged in at zero.
 *
 * Every rule below is the app's. When one changes there, it changes here.
 */

import type { RealizedDisposal, RealizedReport } from "./hold-api";

/* ── Unrealised ───────────────────────────────────────────────────── */

/** One (chain, token) holding. */
export interface HoldingLeg {
  symbol: string;
  chain: string;
  balance: number;
  valueUsd: number;
  /** False when no feed answered — `valueUsd` is then 0 for that reason. */
  priceKnown: boolean;
  wacUsd: number | null;
  hasBasis: boolean;
}

/** One ticker, its chains folded together. */
export interface HoldingRow {
  key: string;
  symbol: string;
  chains: string[];
  balance: number;
  valueUsd: number;
  priceNow: number | null;
  avgCost: number | null;
  costUsd: number | null;
  gainUsd: number | null;
  gainPct: number | null;
  share: number;
  /** Some chains of this ticker carry a basis and others do not. */
  partialBasis: boolean;
}

export interface PerformanceSummary {
  rows: HoldingRow[];
  totalValueUsd: number;
  costedValueUsd: number;
  costUsd: number;
  gainUsd: number | null;
  gainPct: number | null;
  uncostedRows: number;
  unpricedRows: number;
}

const EPS = 1e-12;

/**
 * Folding chains means summing MONEY, never averaging averages:
 * cost = Σ balance × wac over the chains that HAVE a basis, and the gain is
 * taken over that costed balance only. A chain we cannot cost is absent from
 * the average, not averaged in at zero — that would invent a gain.
 */
export function summarisePerformance(legs: readonly HoldingLeg[]): PerformanceSummary {
  interface Acc {
    symbol: string;
    balance: number;
    valueUsd: number;
    basisBalance: number;
    cost: number;
    priced: boolean;
    usdByChain: Map<string, number>;
  }
  const acc = new Map<string, Acc>();

  for (const leg of legs) {
    const symbol = (leg.symbol ?? "").trim().toUpperCase();
    if (!symbol || !(leg.balance > 0)) continue;
    let a = acc.get(symbol);
    if (!a) {
      a = { symbol, balance: 0, valueUsd: 0, basisBalance: 0, cost: 0, priced: false, usdByChain: new Map() };
      acc.set(symbol, a);
    }
    a.balance += leg.balance;
    if (leg.priceKnown) {
      a.priced = true;
      a.valueUsd += leg.valueUsd;
    }
    if (leg.hasBasis && leg.wacUsd != null && leg.wacUsd > 0) {
      a.basisBalance += leg.balance;
      a.cost += leg.balance * leg.wacUsd;
    }
    if (leg.chain) a.usdByChain.set(leg.chain, (a.usdByChain.get(leg.chain) ?? 0) + leg.valueUsd);
  }

  const totalValueUsd = [...acc.values()].reduce((s, a) => s + a.valueUsd, 0);

  const rows: HoldingRow[] = [...acc.values()].map((a) => {
    const priceNow = a.priced && a.balance > EPS ? a.valueUsd / a.balance : null;
    const costed = a.basisBalance > EPS;
    const costUsd = costed ? a.cost : null;
    const costedValue = costed && priceNow != null ? a.basisBalance * priceNow : null;
    const gainUsd = costedValue != null && costUsd != null ? costedValue - costUsd : null;
    const gainPct = gainUsd != null && costUsd != null && costUsd > EPS ? gainUsd / costUsd : null;
    return {
      key: a.symbol,
      symbol: a.symbol,
      chains: [...a.usdByChain.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c),
      balance: a.balance,
      valueUsd: a.valueUsd,
      priceNow,
      avgCost: costed ? a.cost / a.basisBalance : null,
      costUsd,
      gainUsd,
      gainPct,
      share: totalValueUsd > EPS ? a.valueUsd / totalValueUsd : 0,
      partialBasis: costed && a.basisBalance < a.balance - EPS,
    };
  });
  rows.sort((x, y) => y.valueUsd - x.valueUsd);

  let costedValueUsd = 0;
  let costUsd = 0;
  let anyCosted = false;
  for (const r of rows) {
    if (r.costUsd == null || r.gainUsd == null) continue;
    anyCosted = true;
    costUsd += r.costUsd;
    costedValueUsd += r.costUsd + r.gainUsd;
  }
  const gainUsd = anyCosted ? costedValueUsd - costUsd : null;
  return {
    rows,
    totalValueUsd,
    costedValueUsd,
    costUsd,
    gainUsd,
    gainPct: gainUsd != null && costUsd > EPS ? gainUsd / costUsd : null,
    uncostedRows: rows.filter((r) => r.costUsd == null).length,
    unpricedRows: rows.filter((r) => r.priceNow == null).length,
  };
}

export type PerformanceMood = "up" | "down" | "flat" | "unknown" | "empty";

export function moodFor(summary: PerformanceSummary): PerformanceMood {
  if (summary.rows.length === 0) return "empty";
  if (summary.gainUsd == null) return "unknown";
  if (Math.abs(summary.gainUsd) < 0.005) return "flat";
  return summary.gainUsd > 0 ? "up" : "down";
}

/** A coin that passed through and left: sold, spent, or sent elsewhere. */
export interface PastHolding {
  symbol: string;
  lots: number;
  provisionalLots: number;
  /** The owner's own date where they gave one, ours where they did not. */
  lastAt: string;
}

export function pastHoldings(
  lots: ReadonlyArray<{ tokenId: string; arrivedAt: string; acquiredAt?: string | null; confirmed: boolean }>,
  heldSymbols: Iterable<string>,
  isStable: (symbol: string) => boolean,
): PastHolding[] {
  const held = new Set([...heldSymbols].map((s) => s.toUpperCase()));
  const acc = new Map<string, PastHolding>();
  for (const l of lots) {
    const symbol = (l.tokenId ?? "").toUpperCase();
    // A dollar that left is not a disposal anybody reviews.
    if (!symbol || held.has(symbol) || isStable(symbol)) continue;
    const at = l.acquiredAt ?? l.arrivedAt;
    const cur = acc.get(symbol);
    if (!cur) {
      acc.set(symbol, { symbol, lots: 1, provisionalLots: l.confirmed ? 0 : 1, lastAt: at });
      continue;
    }
    cur.lots += 1;
    if (!l.confirmed) cur.provisionalLots += 1;
    if (at > cur.lastAt) cur.lastAt = at;
  }
  return [...acc.values()].sort((x, y) => (x.lastAt < y.lastAt ? 1 : -1));
}

/** The ring, folded: at most four names and then "Others", ring and legend together. */
export const RING_NAMED_MAX = 4;

export interface RingSlice {
  key: string;
  label: string;
  share: number;
  others: boolean;
}

export function ringSlices(rows: ReadonlyArray<{ key: string; symbol: string; share: number }>, namedMax = RING_NAMED_MAX): RingSlice[] {
  const visible = rows.filter((r) => r.share > 0);
  // One over the line is not a crowd: five holdings show five names.
  if (visible.length <= namedMax + 1) return visible.map((r) => ({ key: r.key, label: r.symbol, share: r.share, others: false }));
  const out: RingSlice[] = visible.slice(0, namedMax).map((r) => ({ key: r.key, label: r.symbol, share: r.share, others: false }));
  out.push({ key: "__others__", label: "Others", share: visible.slice(namedMax).reduce((s, r) => s + r.share, 0), others: true });
  return out;
}

/**
 * The ring's colours — ONE HUE PER ASSET, never per rank, so the legend
 * cannot teach a colour the ring then reassigns. The app's picks (Polygon
 * lila and Ethereum white are Alex's; Solana sky because green here means
 * profit). No red in any tint.
 */
const ASSET_HUE: Readonly<Record<string, string>> = {
  SOL: "#4CC3FF",
  ETH: "#FFFFFF",
  POL: "#A47BFF",
  MATIC: "#A47BFF",
  BTC: "#F7931A",
  CBBTC: "#F7931A",
  WBTC: "#F7931A",
  LINK: "#5B8DEF",
  USDC: "#8FA3BF",
  EURC: "#8FA3BF",
};
const RAMP = ["#FFB703", "#2DD4BF", "#B79CFF", "#E8B4C8", "#DCE3F0"];
const OTHERS_HUE = "#7C8CA3";

export function ringColours(ring: readonly RingSlice[]): Map<string, string> {
  const m = new Map<string, string>();
  const taken = new Set<string>();
  ring.forEach((sl, i) => {
    let c = OTHERS_HUE;
    if (!sl.others) {
      c = ASSET_HUE[sl.label.toUpperCase()] ?? "";
      if (!c) {
        c = RAMP[i % RAMP.length];
        for (let k = 0; k < RAMP.length; k += 1) {
          const cand = RAMP[(i + k) % RAMP.length];
          if (!taken.has(cand)) {
            c = cand;
            break;
          }
        }
      }
    }
    m.set(sl.key, c);
    taken.add(c);
  });
  return m;
}

/* ── Realised ─────────────────────────────────────────────────────── */

/** Pegged to the US dollar — the app's STABLE_TO_FIAT, USD rows only. EURC is NOT here: its dollar value moves. */
const USD_PEGGED = new Set(["USDC", "USDT", "USDE", "PYUSD", "RLUSD", "USDM", "SUSDS", "DAI", "USDG"]);

export const FEE_TX = "fee_charge";

/** A network fee is a disposal and it is not a sale. */
export function isFee(d: Pick<RealizedDisposal, "txType">): boolean {
  return d.txType === FEE_TX;
}

/** Spending a dollar is not selling an investment: its gain is zero by construction. */
export function isDollar(d: Pick<RealizedDisposal, "tokenId">): boolean {
  return USD_PEGGED.has((d.tokenId ?? "").trim().toUpperCase());
}

export interface TaxYearHeadline {
  kind: "made" | "lost" | "even" | "dollarsOnly" | "nothing";
  /** Always positive; `kind` carries the direction. */
  amountUsd: number;
  sales: number;
}

export interface TaxYearSummary {
  year: number;
  disposals: RealizedDisposal[];
  gainsUsd: number;
  lossesUsd: number;
  netUsd: number;
  proceedsUsd: number;
  costUsd: number;
  incomeUsd: number;
  exclusions: string[];
  excludedCount: number;
  sales: RealizedDisposal[];
  fees: { count: number; costUsd: number };
  spending: { count: number; amountUsd: number };
  headline: TaxYearHeadline;
}

export function headlineFor(netUsd: number, sales: number, dollarPayments = 0): TaxYearHeadline {
  if (sales === 0) return { kind: dollarPayments > 0 ? "dollarsOnly" : "nothing", amountUsd: 0, sales: 0 };
  if (Math.abs(netUsd) < 0.005) return { kind: "even", amountUsd: 0, sales };
  return { kind: netUsd > 0 ? "made" : "lost", amountUsd: Math.abs(netUsd), sales };
}

/** Every year with a disposal, plus this one. Newest first. */
export function taxYearsAvailable(disposals: readonly Pick<RealizedDisposal, "at">[], now: Date = new Date()): number[] {
  const years = new Set<number>([now.getUTCFullYear()]);
  for (const d of disposals) {
    const t = Date.parse(d.at);
    if (Number.isFinite(t)) years.add(new Date(t).getUTCFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

const EXCLUSION_COPY: Record<string, (n: number) => string> = {
  "unknown-decimals": (n) =>
    `${n} ${n === 1 ? "disposal is" : "disposals are"} of a token we can't measure precisely enough to value. Excluded rather than reported at the wrong scale.`,
  "incomplete-basis": (n) =>
    `${n} ${n === 1 ? "disposal has" : "disposals have"} no complete purchase history behind ${n === 1 ? "it" : "them"}, so there is nothing to measure the result against.`,
  "unpriced-disposal": (n) => `${n} ${n === 1 ? "disposal" : "disposals"} went out without a recorded market price.`,
};

/** One sentence per reason. An unrecognised reason is still reported. */
export function exclusionSentences(reasons: Record<string, number>): string[] {
  const out: string[] = [];
  for (const [reason, n] of Object.entries(reasons ?? {})) {
    if (!n) continue;
    const copy = EXCLUSION_COPY[reason];
    out.push(copy ? copy(n) : `${n} excluded (${reason}).`);
  }
  return out;
}

/** Roll a year up for reading. `report` is already windowed to the year by the server. */
export function summariseTaxYear(year: number, report: RealizedReport): TaxYearSummary {
  const disposals = [...(report.disposals ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  let gainsUsd = 0;
  let lossesUsd = 0;
  let proceedsUsd = 0;
  let costUsd = 0;
  for (const d of disposals) {
    // Only fully valued rows enter a total.
    if (d.gainUsd == null || d.proceedsUsd == null || d.costUsd == null) continue;
    if (d.gainUsd >= 0) gainsUsd += d.gainUsd;
    else lossesUsd += -d.gainUsd;
    proceedsUsd += d.proceedsUsd;
    costUsd += d.costUsd;
  }
  const feeRows = disposals.filter(isFee);
  const dollarRows = disposals.filter((d) => !isFee(d) && isDollar(d));
  const sales = disposals.filter((d) => !isFee(d) && !isDollar(d));
  const netUsd = gainsUsd - lossesUsd;
  return {
    year,
    disposals,
    sales,
    fees: { count: feeRows.length, costUsd: feeRows.reduce((s, d) => s + (d.costUsd ?? 0), 0) },
    spending: { count: dollarRows.length, amountUsd: dollarRows.reduce((s, d) => s + (d.proceedsUsd ?? 0), 0) },
    headline: headlineFor(netUsd, sales.length, dollarRows.length),
    gainsUsd,
    lossesUsd,
    netUsd,
    proceedsUsd,
    costUsd,
    incomeUsd: report.incomeUsd ?? 0,
    exclusions: exclusionSentences(report.unvalued?.reasons ?? {}),
    excludedCount: report.unvalued?.count ?? 0,
  };
}

/* ── Formatting the app uses on these three screens ──────────────── */

/** "$1,234.56", unsigned: the sign is always written by the caller. */
export const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A price needs finer resolution than a balance: $0.09 hides a 6% move in POL. */
export const unitPrice = (n: number) =>
  n >= 1 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${Number(n.toPrecision(3))}`;

export const pct = (f: number) => `${f >= 0 ? "+" : "−"}${(Math.abs(f) * 100).toFixed(1)}%`;

/** "0.3 SOL", not "0.300000 SOL". */
export function tokenUnits(n: number | null, wide = false): string {
  if (n == null) return "";
  if (!Number.isFinite(n) || n === 0) return "0";
  const dp = wide ? (Math.abs(n) >= 1 ? 4 : 6) : Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 4 : 6;
  return String(Number(n.toFixed(dp)));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
