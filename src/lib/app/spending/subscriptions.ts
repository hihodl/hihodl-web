// src/lib/app/spending/subscriptions.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/subscriptions.ts. Change the app first, then this.
//
// On-device subscription detection. From the transfer history we find recurring
// charges — the same counterparty billing on a regular cadence — and project the
// NEXT expected charge: which day it bills, and the amount to expect. This powers
// the dashboard "upcoming payment" card and a subscriptions view in Analytics.
//
// No backend needed: recurrence is a shape in the data. A charge is a
// subscription when EITHER its category is explicitly `subscriptions` (Netflix,
// Spotify… — trusted even from a single charge) OR it repeats on a monthly-ish
// cadence with a stable amount. We compute a billing day-of-month, an expected
// amount (median = robust to a one-off spike), and roll the next date forward to
// the first future occurrence.

import type { SpendTransfer as Transfer } from "./types";
import { counterpartyKey, counterpartyLabel, isSpendTransfer, resolveCategory, type CategoryOverrideMaps } from "./categorize";
import { transferUsd } from "./amounts";
import {
  inferSubscriptionCategory,
  type SubscriptionCategoryId,
} from "./subscriptionCategories";

const DAY = 86_400_000;

export type SubscriptionConfidence = "confirmed" | "likely" | "inferred";

export interface Subscription {
  /** Stable id = counterparty key (also the dismissal key). */
  key: string;
  label: string; // merchant/person name
  category: string; // coarse spending category id (built-in or custom)
  /** Fine recurring-payment kind (home/phone/music…), user-overridable. */
  subCategory: SubscriptionCategoryId;
  /** Expected charge in USD (median of observed charges). */
  expectedUsd: number;
  /** Days between charges (median gap); 30 assumed for a single subscription charge. */
  cadenceDays: number;
  /** Day-of-month it typically bills (1–31), from the most recent charge. */
  billingDay: number;
  /** Timestamp (ms) of the most recent observed charge. */
  lastChargedAt: number;
  /** Timestamp (ms) of the next expected charge (always today or later). */
  nextChargeAt: number;
  /** Whole days from now until the next charge (0 = today). */
  daysUntil: number;
  /** How many charges we've observed. */
  occurrences: number;
  confidence: SubscriptionConfidence;
  /** The most recent transfer, for opening tx details. */
  lastTransfer: Transfer;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Roll a base date forward by `cadence` days until it's today or later. */
function rollForward(baseMs: number, cadenceDays: number, nowMs: number): number {
  const step = Math.max(1, Math.round(cadenceDays)) * DAY;
  let next = baseMs + step;
  // Guard the loop (a stale history shouldn't spin more than a few years).
  let guard = 0;
  while (next < nowMs && guard < 400) {
    next += step;
    guard++;
  }
  return next;
}

// Cadence buckets we accept as "recurring", with the canonical period we snap to.
function classifyCadence(gapDays: number): number | null {
  if (gapDays >= 6 && gapDays <= 8) return 7; // weekly
  if (gapDays >= 12 && gapDays <= 16) return 14; // fortnightly
  if (gapDays >= 26 && gapDays <= 35) return 30; // monthly (the common case)
  if (gapDays >= 58 && gapDays <= 64) return 61; // bi-monthly
  if (gapDays >= 85 && gapDays <= 95) return 91; // quarterly
  if (gapDays >= 350 && gapDays <= 380) return 365; // yearly
  return null;
}

export interface DetectOptions {
  maps: CategoryOverrideMaps;
  /** Current time in ms (injected so callers control it / keep it stable). */
  nowMs: number;
  /** User overrides for the fine subscription category, keyed by counterparty. */
  subOverrides?: Record<string, SubscriptionCategoryId>;
}

/** Normalize a subscription's charge to a per-month figure (for a monthly total). */
export function monthlyUsd(sub: Subscription): number {
  if (sub.cadenceDays <= 0) return sub.expectedUsd;
  return sub.expectedUsd * (30 / sub.cadenceDays);
}

/**
 * Detect subscriptions across a transfer history. Returns them sorted by soonest
 * next charge first (the dashboard shows the head of this list).
 */
export function detectSubscriptions(transfers: Transfer[], opts: DetectOptions): Subscription[] {
  const { maps, nowMs, subOverrides } = opts;

  // Group outbound spend by counterparty.
  const groups = new Map<string, Transfer[]>();
  for (const t of transfers) {
    if (!isSpendTransfer(t)) continue;
    const usd = transferUsd(t);
    if (usd <= 0) continue;
    const key = counterpartyKey(t);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const out: Subscription[] = [];

  for (const [key, rawTxs] of groups.entries()) {
    const txs = rawTxs
      .filter((t) => Number.isFinite(Date.parse(t.createdAt)))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    if (txs.length === 0) continue;

    const last = txs[txs.length - 1];
    const category = resolveCategory(last, maps);
    const amounts = txs.map(transferUsd);
    const expectedUsd = median(amounts);
    const lastChargedAt = Date.parse(last.createdAt);

    // Gaps between consecutive charges (in days).
    const gaps: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      gaps.push((Date.parse(txs[i].createdAt) - Date.parse(txs[i - 1].createdAt)) / DAY);
    }
    const medianGap = gaps.length ? median(gaps) : 0;
    const snappedCadence = gaps.length ? classifyCadence(medianGap) : null;

    let cadenceDays: number;
    let confidence: SubscriptionConfidence;

    if (snappedCadence) {
      // Recurring shape detected. Amount must be reasonably stable to trust it.
      const spread = expectedUsd > 0
        ? Math.max(...amounts.map((a) => Math.abs(a - expectedUsd))) / expectedUsd
        : 1;
      const amountStable = spread <= 0.35; // ≤35% variance around the median
      if (!amountStable && category !== "subscriptions") continue;
      cadenceDays = snappedCadence;
      confidence = txs.length >= 3 ? "confirmed" : "likely";
    } else if (category === "subscriptions") {
      // Explicit subscription merchant (Netflix/Spotify…) but only one charge so
      // far, or an irregular gap — assume monthly and mark it inferred.
      cadenceDays = 30;
      confidence = txs.length >= 2 ? "likely" : "inferred";
    } else {
      // Not recurring and not a known subscription merchant → skip.
      continue;
    }

    const nextChargeAt = rollForward(lastChargedAt, cadenceDays, nowMs);
    const daysUntil = Math.max(0, Math.round((nextChargeAt - nowMs) / DAY));

    const subCategory = subOverrides?.[key] ?? inferSubscriptionCategory(last);

    out.push({
      key,
      label: counterpartyLabel(last),
      category,
      subCategory,
      expectedUsd,
      cadenceDays,
      billingDay: new Date(lastChargedAt).getDate(),
      lastChargedAt,
      nextChargeAt,
      daysUntil,
      occurrences: txs.length,
      confidence,
      lastTransfer: last,
    });
  }

  return out.sort((a, b) => a.nextChargeAt - b.nextChargeAt);
}

/**
 * The single next upcoming subscription payment for the dashboard card: the
 * soonest future charge that hasn't been dismissed. Returns null when there's
 * nothing to show.
 */
export function nextUpcoming(
  subs: Subscription[],
  dismissedKeys: Set<string>,
): Subscription | null {
  for (const s of subs) {
    if (dismissedKeys.has(s.key)) continue;
    return s;
  }
  return null;
}
