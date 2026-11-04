// src/lib/app/spending/range.ts: ported VERBATIM from the app's
// hihodl-wallet src/features/spending/range.ts. Change the app first, then this.
//
// The period model for Spending Analytics. Three modes:
//   • month   — a calendar month (default), driven by the ‹ June › switcher.
//   • rolling — a trailing window (30d / 90d / 1y) from the range sheet pills.
//   • custom  — an explicit start–end the user picked on the calendar.
//
// Every range also knows how to produce the PRIOR window of equal length, so
// the UI can show honest "vs last period" deltas.

import { t } from "../i18n";
import { fmtDate } from "../i18n/format";

export type RangeMode = "month" | "rolling" | "custom";

export interface SpendRange {
  mode: RangeMode;
  /** Inclusive start, epoch ms (local 00:00). */
  start: number;
  /** Inclusive end, epoch ms (local 23:59:59.999). */
  end: number;
  /** Short human label, e.g. "June 2026", "Last 30 days", "5 – 22 Jun". */
  label: string;
  /** For rolling ranges: the window length in days (30/90/365). */
  rollingDays?: number;
}

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function monthLabel(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return fmtDate(d, { month: "long", year: "numeric" }) || `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function shortDay(ms: number): string {
  const d = new Date(ms);
  return fmtDate(d, { day: "numeric", month: "short" }) || `${d.getDate()}/${d.getMonth() + 1}`;
}

function rollingLabel(days: number): string {
  return days >= 360
    ? t("analytics.range.last12Months")
    : days >= 90
      ? t("analytics.range.last90Days")
      : t("analytics.range.lastDays", { count: days });
}

function customLabel(start: number, end: number): string {
  return startOfDay(start) === startOfDay(end) ? shortDay(start) : t("analytics.range.span", { start: shortDay(start), end: shortDay(end) });
}

// ─── Month ───────────────────────────────────────────────────────────────────
export function monthRange(year: number, monthIndex: number): SpendRange {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0); // day 0 of next month = last day
  return {
    mode: "month",
    start: startOfDay(first.getTime()),
    end: endOfDay(last.getTime()),
    label: monthLabel(year, monthIndex),
  };
}

export function currentMonthRange(nowMs: number = Date.now()): SpendRange {
  const d = new Date(nowMs);
  return monthRange(d.getFullYear(), d.getMonth());
}

/** Shift a month range by ±N months (used by the ‹ › switcher). */
export function shiftMonth(range: SpendRange, delta: number): SpendRange {
  const anchor = new Date(range.start);
  return monthRange(anchor.getFullYear(), anchor.getMonth() + delta);
}

// ─── Rolling ─────────────────────────────────────────────────────────────────
export function rollingRange(days: number, nowMs: number = Date.now()): SpendRange {
  const end = endOfDay(nowMs);
  const start = startOfDay(nowMs - (days - 1) * DAY);
  const label = rollingLabel(days);
  return { mode: "rolling", start, end, label, rollingDays: days };
}

// ─── Custom ──────────────────────────────────────────────────────────────────
export function customRange(startMs: number, endMs: number): SpendRange {
  const a = Math.min(startMs, endMs);
  const b = Math.max(startMs, endMs);
  const start = startOfDay(a);
  const end = endOfDay(b);
  const days = Math.round((end - start) / DAY) + 1;
  const label = customLabel(a, b);
  return { mode: "custom", start, end, label, rollingDays: days };
}

// ─── Prior window (for deltas) ───────────────────────────────────────────────
/** The immediately-preceding window of equal length. */
export function priorRange(range: SpendRange): SpendRange {
  if (range.mode === "month") {
    return shiftMonth(range, -1);
  }
  const span = range.end - range.start;
  const end = range.start - 1;
  const start = end - span;
  return { ...range, start, end };
}

export function rangeContains(range: SpendRange, tsMs: number): boolean {
  return tsMs >= range.start && tsMs <= range.end;
}

// ─── Route-param (de)serialization ───────────────────────────────────────────
// The category drill-down screen is a separate route, so the active range is
// passed through params and rebuilt there (it re-runs the same analytics hook).
export function rangeToParams(r: SpendRange): Record<string, string> {
  return {
    mode: r.mode,
    start: String(r.start),
    end: String(r.end),
    label: r.label,
    rollingDays: r.rollingDays != null ? String(r.rollingDays) : "",
  };
}

export function rangeFromParams(p: Record<string, string | string[] | undefined>): SpendRange {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const mode = (pick(p.mode) as RangeMode) || "month";
  const start = Number(pick(p.start));
  const end = Number(pick(p.end));
  const rollingDaysRaw = pick(p.rollingDays);
  return {
    mode,
    start: Number.isFinite(start) ? start : currentMonthRange().start,
    end: Number.isFinite(end) ? end : currentMonthRange().end,
    label: pick(p.label) || "",
    rollingDays: rollingDaysRaw ? Number(rollingDaysRaw) : undefined,
  };
}

/**
 * The range's label in the language on screen NOW. `range.label` is written
 * when the range is made (and travels in the address), so a screen draws this
 * instead: a change of language relabels a range already on screen.
 */
export function rangeLabel(range: SpendRange): string {
  if (range.mode === "month") {
    const d = new Date(range.start);
    return monthLabel(d.getFullYear(), d.getMonth());
  }
  if (range.mode === "rolling" && range.rollingDays) return rollingLabel(range.rollingDays);
  if (range.mode === "custom") return customLabel(range.start, range.end);
  return range.label;
}

/** Whether this range can be shifted month-by-month (only pure month ranges). */
export function isMonthRange(range: SpendRange): boolean {
  return range.mode === "month";
}
