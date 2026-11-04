// src/lib/app/spending/analytics.ts: the app's useSpendingAnalytics
// (hihodl-wallet src/features/spending/useSpendingAnalytics.ts) with the React
// binding taken off, so the same maths run as a pure function over the rows
// `GET /transfers?limit=500` answered.
//
// Everything between the interfaces and the returned object is the app's code,
// line for line. What is not here, and why:
//   • the per-transaction overrides and learned rules: they live in the phone's
//     storage (spendingCategories.store), so the web resolves with EMPTY maps,
//     which is exactly what the app does for somebody who never re-categorised
//   • custom categories and renames: same, the phone's storage; the web shows
//     the built-in taxonomy
//   • `loading`: the screen owns the read and says loading / failed itself
//
// The app's own header, kept:
//
//   income   = direction 'in'
//   spend    = direction 'out' via a spending rail (card/crypto) — real consumption
//   payouts  = direction 'out' via a fiat off-ramp (iban/pix/mercadopago) — money
//              moved to a bank, NOT consumption
//   excluded = move / swap / exchange — moving your own money is never in/out
//
//   you saved / net kept = income − spend   (payouts sit apart, per the design)

import { fmtDate, monthName } from "../i18n/format";

import { parseAmt, transferUsd as txUsd } from "./amounts";
import { rampColor, type CategoryDef } from "./categories";
import { getCategoryDef } from "./catalog";
import {
  resolveCategory,
  isPayoutTransfer,
  counterpartyKey,
  counterpartyLabel,
  type CategoryOverrideMaps,
} from "./categorize";
import { priorRange, type SpendRange } from "./range";
import type { SpendTransfer as Transfer } from "./types";

/** The app with nothing re-categorised: no per-tx overrides, no learned rules. */
export const NO_OVERRIDES: CategoryOverrideMaps = { tx: {}, learned: {} };

export interface CategorySlice {
  id: string;
  def: CategoryDef;
  amount: number; // USD
  pct: number; // 0..1 of total spend
  color: string; // green→white ramp by rank
  rank: number;
  txCount: number;
}

/** One income sender, grouped for the Income detail breakdown ("by source"). */
export interface SourceSlice {
  key: string;
  label: string;
  amount: number; // USD
  pct: number; // 0..1 of total income
  txCount: number;
}

/** One bucket of the metric time-series (a day / week / month of the range). */
export interface MetricPoint {
  /** Bucket start, epoch ms. */
  t: number;
  income: number; // USD in this bucket
  spend: number; // USD in this bucket
  /** Short axis label ("6", "6 Jun", "Jun"). */
  label: string;
}

const DAY_MS = 86_400_000;

interface BucketPlan {
  count: number;
  sizeMs: number;
  kind: "day" | "week" | "month";
}

/** Choose a bucket granularity from the range span (daily → weekly → monthly). */
function planBuckets(range: SpendRange): BucketPlan {
  const span = Math.max(DAY_MS, range.end - range.start);
  const days = span / DAY_MS;
  const sizeMs = days <= 45 ? DAY_MS : days <= 182 ? 7 * DAY_MS : 30 * DAY_MS;
  const kind = days <= 45 ? "day" : days <= 182 ? "week" : "month";
  return { count: Math.max(1, Math.ceil(span / sizeMs)), sizeMs, kind };
}

function bucketLabel(startMs: number, kind: BucketPlan["kind"]): string {
  const d = new Date(startMs);
  if (kind === "day") return fmtDate(d, { day: "numeric" }) || String(d.getDate());
  if (kind === "week") return fmtDate(d, { day: "numeric", month: "short" }) || `${d.getDate()}/${d.getMonth() + 1}`;
  return monthName(d.getMonth(), "short");
}

/** Bucket a window's peers into an income/spend time-series for the detail chart. */
function buildSeries(
  peers: Transfer[],
  range: SpendRange,
  plan: BucketPlan,
): MetricPoint[] {
  const points: MetricPoint[] = Array.from({ length: plan.count }, (_, i) => {
    const t = range.start + i * plan.sizeMs;
    return { t, income: 0, spend: 0, label: bucketLabel(t, plan.kind) };
  });
  for (const tr of peers) {
    const ts = Date.parse(tr.createdAt);
    if (!Number.isFinite(ts) || ts < range.start || ts > range.end) continue;
    const usd = txUsd(tr);
    if (usd <= 0) continue;
    const idx = Math.min(plan.count - 1, Math.max(0, Math.floor((ts - range.start) / plan.sizeMs)));
    if (tr.direction === "in") points[idx].income += usd;
    else if (!isPayoutTransfer(tr)) points[idx].spend += usd;
  }
  return points;
}

export interface SpendingAnalytics {
  /** true when the backend page cap prevented loading the whole range. */
  capped: boolean;
  income: number;
  spend: number;
  payouts: number;
  netKept: number;
  /** netKept / income, or null when no income. */
  keptPct: number | null;
  incomeDeltaPct: number | null;
  spendDeltaPct: number | null;
  netKeptDelta: number; // vs prior window, USD
  excludedInternal: number; // internal moves total, USD (for the disclosure note)
  categories: CategorySlice[]; // spend only, sorted desc
  /** Spend transfers grouped by resolved category (for phase-2 drill-down). */
  transfersByCategory: Record<string, Transfer[]>;
  txCount: number; // number of spend transactions in range
  /** Income grouped by sender, largest first (Income detail "by source"). */
  incomeSources: SourceSlice[];
  /** Income transfers grouped by sender key (for the Income drill-down). */
  transfersBySource: Record<string, Transfer[]>;
  /** Bucketed income/spend series for the current window (detail charts). */
  series: MetricPoint[];
  /** Same buckets for the prior window (the "vs last period" ghost line). */
  priorSeries: MetricPoint[];
}

function isPayout(t: Transfer): boolean {
  return isPayoutTransfer(t);
}

// Drop rows that would double-count or aren't real consumption:
//  • not confirmed
//  • internal move/swap/exchange (handled separately as "excluded")
//  • a return-leg row sharing a txHash with a swap/move (phantom deposit)
//  • V3 payment-intent legs (rendered under the parent bubble)
//  • dust
function usableTransfers(all: readonly Transfer[]): {
  peers: Transfer[];
  internalTxs: Transfer[]; // confirmed internal moves/swaps, so we can drill in
} {
  const nonPeerTxHashes = new Set<string>();
  for (const t of all) {
    if ((t.direction === "swap" || t.direction === "exchange" || t.direction === "move") && t.txHash) {
      nonPeerTxHashes.add(t.txHash);
    }
  }
  const peers: Transfer[] = [];
  const internalTxs: Transfer[] = [];
  for (const t of all) {
    if (t.status !== "confirmed") continue;
    if (t.direction === "swap" || t.direction === "exchange" || t.direction === "move") {
      internalTxs.push(t);
      continue;
    }
    if (t.txHash && nonPeerTxHashes.has(t.txHash)) continue;
    if (t.parentIntentId) continue;
    if (Math.abs(parseAmt(t)) < 0.001) continue;
    peers.push(t);
  }
  return { peers, internalTxs };
}

// Synthetic category id for the internal-transfers drill-down (Analytics donut's
// "Transfers" ring taps into the category screen using this id).
export const TRANSFERS_CATEGORY_ID = "transfers";

// ── core aggregation for one window ──────────────────────────────────────────
interface WindowAgg {
  income: number;
  spend: number;
  payouts: number;
  byCategory: Map<string, { amount: number; txs: Transfer[] }>;
  bySource: Map<string, { label: string; amount: number; txs: Transfer[] }>;
}

function aggregateWindow(
  peers: Transfer[],
  range: SpendRange,
  maps: CategoryOverrideMaps,
): WindowAgg {
  let income = 0;
  let spend = 0;
  let payouts = 0;
  const byCategory = new Map<string, { amount: number; txs: Transfer[] }>();
  const bySource = new Map<string, { label: string; amount: number; txs: Transfer[] }>();

  for (const t of peers) {
    const ts = Date.parse(t.createdAt);
    if (!Number.isFinite(ts) || ts < range.start || ts > range.end) continue;
    const usd = txUsd(t);
    if (usd <= 0) continue;

    if (t.direction === "in") {
      income += usd;
      const key = counterpartyKey(t);
      const src = bySource.get(key) ?? { label: counterpartyLabel(t), amount: 0, txs: [] };
      src.amount += usd;
      src.txs.push(t);
      bySource.set(key, src);
      continue;
    }
    // outbound
    if (isPayout(t)) {
      payouts += usd;
      continue;
    }
    // real spend → categorize
    spend += usd;
    const cat = resolveCategory(t, maps);
    const bucket = byCategory.get(cat) ?? { amount: 0, txs: [] };
    bucket.amount += usd;
    bucket.txs.push(t);
    byCategory.set(cat, bucket);
  }

  return { income, spend, payouts, byCategory, bySource };
}

function pct(part: number, whole: number): number | null {
  if (!whole || whole <= 0) return null;
  return (part - whole) / whole;
}

export function computeSpendingAnalytics(
  transfers: readonly Transfer[],
  range: SpendRange,
  hasMore: boolean,
  overrides: CategoryOverrideMaps = NO_OVERRIDES,
): SpendingAnalytics {
  const txOverrides = overrides.tx;
  const learned = overrides.learned;
  const maps: CategoryOverrideMaps = { tx: txOverrides, learned };
  const { peers, internalTxs } = usableTransfers(transfers);

  // Internal moves scoped to the selected window — powers both the excluded
  // total AND the "Transfers" ring drill-down (they must agree).
  const internalInRange = internalTxs
    .filter((t) => {
      const ts = Date.parse(t.createdAt);
      return Number.isFinite(ts) && ts >= range.start && ts <= range.end;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const internalUsd = internalInRange.reduce((sum, t) => sum + txUsd(t), 0);

  const prior = priorRange(range);
  const cur = aggregateWindow(peers, range, maps);
  const prev = aggregateWindow(peers, prior, maps);

  // Time-series for the metric detail charts (same bucket plan for both
  // windows so the "vs last period" ghost line lines up bucket-for-bucket).
  const plan = planBuckets(range);
  const series = buildSeries(peers, range, plan);
  const priorSeries = buildSeries(peers, prior, planBuckets(prior));

  const netKept = cur.income - cur.spend;
  const priorNetKept = prev.income - prev.spend;

  // Build sorted category slices (spend only).
  const entries = Array.from(cur.byCategory.entries()).sort(
    (a, b) => b[1].amount - a[1].amount,
  );
  const categories: CategorySlice[] = entries.map(([id, v], rank) => ({
    id,
    def: getCategoryDef(id),
    amount: v.amount,
    pct: cur.spend > 0 ? v.amount / cur.spend : 0,
    color: rampColor(rank),
    rank,
    txCount: v.txs.length,
  }));

  const transfersByCategory: Record<string, Transfer[]> = {};
  for (const [id, v] of cur.byCategory.entries()) {
    transfersByCategory[id] = v.txs
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  // Expose internal moves under the synthetic "transfers" id so the donut's
  // Transfers ring drills into the same category detail screen.
  if (internalInRange.length > 0) {
    transfersByCategory[TRANSFERS_CATEGORY_ID] = internalInRange;
  }

  // Income sources, largest first.
  const sourceEntries = Array.from(cur.bySource.entries()).sort(
    (a, b) => b[1].amount - a[1].amount,
  );
  const incomeSources: SourceSlice[] = sourceEntries.map(([key, v]) => ({
    key,
    label: v.label,
    amount: v.amount,
    pct: cur.income > 0 ? v.amount / cur.income : 0,
    txCount: v.txs.length,
  }));
  const transfersBySource: Record<string, Transfer[]> = {};
  for (const [key, v] of cur.bySource.entries()) {
    transfersBySource[key] = v.txs
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  const txCount = categories.reduce((n, c) => n + c.txCount, 0);

  return {
    capped: hasMore,
    income: cur.income,
    spend: cur.spend,
    payouts: cur.payouts,
    netKept,
    keptPct: cur.income > 0 ? netKept / cur.income : null,
    incomeDeltaPct: pct(cur.income, prev.income),
    spendDeltaPct: pct(cur.spend, prev.spend),
    netKeptDelta: netKept - priorNetKept,
    excludedInternal: internalUsd,
    categories,
    transfersByCategory,
    txCount,
    incomeSources,
    transfersBySource,
    series,
    priorSeries,
  };
}
