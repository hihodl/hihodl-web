"use client";

/**
 * The parts Spending Analytics' three screens share, ported from the app's
 * `app/(drawer)/(internal)/spending-analytics/_components` (SpendingDonut,
 * MetricChart, RangeSheet, SubscriptionTiles) and its white-glass cards.
 *
 * VIEW MODE. The app's tiles open a sheet to re-tag a recurring payment or
 * hide it, and its category rows take a budget; all of that writes to the
 * phone's own storage, so here the same shapes are drawn and those taps are
 * not offered.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { currentIntl, t as tr } from "@/lib/app/i18n";
import { effectiveCurrency, fmtDate, fmtFiat, fmtPercent, fmtUsd, usdToDisplay, weekdayName } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { useTransfers } from "@/lib/app/money";
import { currentMonthRange, customRange, rangeFromParams, rangeLabel, rangeToParams, rollingRange, type SpendRange } from "@/lib/app/spending/range";
import { SPENDING_SELECTED } from "@/lib/app/spending/categories";
import type { MetricPoint } from "@/lib/app/spending/analytics";
import { subscriptionCategoryDef } from "@/lib/app/spending/subscriptionCategories";
import type { Subscription } from "@/lib/app/spending/subscriptions";
import { asSpendTransfers, type SpendTransfer } from "@/lib/app/spending/types";

import { Ion } from "../ion";

/* ── Tokens, traced from the app ─────────────────────────────────── */

/** 2a "you saved" number + positive deltas. */
export const GREEN = "#4ADE80";
/** Money out: WHITE, never red. */
export const WHITE = "rgba(255,255,255,0.92)";
/** The "transfers, not spend" ring. */
export const TRANSFER_GREY = "rgba(255,255,255,0.22)";

/** GlassCardSecondary: colors.secondaryGlassBg / secondaryGlassBorder, hairline. */
export const glassCard = "border-[0.5px] border-white/[0.22] bg-white/10";
/** GlassCardSecondaryHero. */
export const glassHero = "border-[0.5px] border-white/[0.24] bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))]";

/**
 * The app's `formatFiatAmount`: a dollar figure worked out from activity,
 * shown in the display currency. Every figure on these screens is one.
 */
export const fmt = (usd: number) => fmtUsd(usd);
export const signed = (usd: number) => `${usd >= 0 ? "+" : "−"}${fmt(Math.abs(usd))}`;
/** A whole percentage of a 0..1 fraction: "12%". */
export const pct0 = (fraction: number) => fmtPercent(Math.round(fraction * 100) / 100, 0);

/* ── The one read ────────────────────────────────────────────────── */

/**
 * `GET /transfers?limit=500`, the app's one generous page (useSpendingAnalytics
 * `useTransfers({ limit: 500 })`). Every number on these screens is computed
 * from it in the browser, as the app computes them on the phone.
 */
export function useSpendingRows(): {
  rows: SpendTransfer[];
  hasMore: boolean;
  loaded: boolean;
  failed: boolean;
  retry: () => void;
} {
  const read = useTransfers(500, 0);
  const rows = useMemo(() => asSpendTransfers(read.data?.transfers ?? []), [read.data]);
  const { mutate } = read;
  const retry = useCallback(() => void mutate(), [mutate]);
  return {
    rows,
    hasMore: read.data?.hasMore ?? false,
    loaded: read.data !== undefined,
    // A failed read with nothing cached is a failure, never an empty month.
    failed: !!read.error && read.data === undefined,
    retry,
  };
}

/* ── The range in the address ────────────────────────────────────── */

export function rangeQuery(r: SpendRange, extra: Record<string, string> = {}): string {
  return new URLSearchParams({ ...rangeToParams(r), ...extra }).toString();
}

/**
 * The app's `rangeFromParams`, with one guard the app never needed: its
 * screens are only ever pushed WITH the range, while an address can be typed
 * or bookmarked bare. There `Number("")` is 0, a day in 1970, so an address
 * without a usable range opens on this month instead.
 */
export function rangeFromQuery(q: Record<string, string | string[] | undefined>): SpendRange {
  const r = rangeFromParams(q);
  if (!(r.start > 0) || !(r.end >= r.start) || !r.label) return currentMonthRange();
  return r;
}

/* ── Cards and small pieces ──────────────────────────────────────── */

export function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${glassCard} mt-3 rounded-[18px] p-4 ${className}`}>{children}</section>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-bold tracking-[1.4px] text-white/[0.55]">{children}</p>;
}

export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-2 px-1 text-[12px] leading-[17px] text-white/55 ${className}`}>{children}</p>;
}

/* ── Spending donut ──────────────────────────────────────────────── */

export interface DonutSlice {
  id: string;
  color: string;
  /** 0..1 fraction of the whole. */
  pct: number;
  /** For the hover title. */
  label?: string;
}

/**
 * SpendingDonut: a green/white ring. A tapped slice pops (thicker, solid
 * green) while the rest dim; tapping the centre clears it.
 */
export function SpendingDonut({
  slices,
  centerValue,
  centerLabel,
  size = 132,
  thickness = 20,
  selectedId = null,
  onSlicePress,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  selectedId?: string | null;
  onSlicePress?: (id: string) => void;
}) {
  const t = useT();
  const label = centerLabel ?? t("analytics.donut.spent");
  const r = (size - thickness) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const GAP = slices.length > 1 ? 2 : 0;

  const segments = useMemo(() => {
    let acc = 0;
    return slices
      .filter((s) => s.pct > 0)
      .map((s) => {
        const startFrac = acc;
        acc += s.pct;
        const len = Math.max(s.pct * C - GAP, 0.5);
        return { ...s, startAngle: startFrac * 360 - 90, len };
      });
  }, [slices, C, GAP]);

  const anySelected = !!selectedId;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* The pop is 5px wider than the ring, so the canvas leaves room for it. */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" role="img" aria-label={`${centerValue} ${label}`}>
        <circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} fill="none" />
        {segments.map((seg) => {
          const isSel = selectedId === seg.id;
          const dim = anySelected && !isSel;
          return (
            <circle
              key={seg.id}
              cx={c}
              cy={c}
              r={r}
              transform={`rotate(${seg.startAngle} ${c} ${c})`}
              stroke={isSel ? SPENDING_SELECTED : seg.color}
              strokeOpacity={dim ? 0.32 : 1}
              strokeWidth={isSel ? thickness + 5 : thickness}
              fill="none"
              strokeDasharray={`${seg.len} ${C - seg.len}`}
              onClick={onSlicePress ? () => onSlicePress(seg.id) : undefined}
              className={onSlicePress ? "cursor-pointer transition-[stroke-width,stroke-opacity] duration-150" : undefined}
            >
              {seg.label ? <title>{`${seg.label} · ${pct0(seg.pct)}`}</title> : null}
            </circle>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {/* 15px as the app draws it, smaller when the figure is wider than the hole. */}
        <span className="whitespace-nowrap font-bold tracking-[-0.4px] tabular-nums text-white" style={{ fontSize: Math.min(15, ((size - 2 * thickness) * 1.55) / Math.max(centerValue.length, 1)) }}>
          {centerValue}
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.6px] text-white/55">{label}</span>
      </div>
      {onSlicePress && selectedId ? (
        <button type="button" aria-label={t("analytics.donut.clearSelection")} onClick={() => onSlicePress(selectedId)} className="absolute inset-[26%] rounded-full" />
      ) : null}
    </div>
  );
}

/* ── Metric chart ────────────────────────────────────────────────── */

export type MetricKind = "spend" | "income" | "cashflow";

const OUT = "rgba(255,255,255,0.85)";
const GHOST = "rgba(255,255,255,0.18)";
const GRID = "rgba(255,255,255,0.08)";

const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PAD_RIGHT = 44;

function cumulative(points: MetricPoint[], pick: (p: MetricPoint) => number): number[] {
  let run = 0;
  return points.map((p) => (run += pick(p)));
}

/** Smooth-ish path through points (simple Catmull-Rom → cubic), the app's. */
function linePath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)];
    const y0 = ys[Math.max(0, i - 1)];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[Math.min(xs.length - 1, i + 2)];
    const y3 = ys[Math.min(ys.length - 1, i + 2)];
    d += ` C ${x1 + (x2 - x0) / 6} ${y1 + (y2 - y0) / 6}, ${x2 - (x3 - x1) / 6} ${y2 - (y3 - y1) / 6}, ${x2} ${y2}`;
  }
  return d;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => setW(entries[0]?.contentRect.width ?? 0));
    ro.observe(node);
    setW(node.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * MetricChart: one component, three honest shapes, as the app draws them.
 *   spend    the CUMULATIVE line for the range, the prior period ghosted behind
 *   income   bars per bucket (money arrives in lumps, not a curve)
 *   cashflow paired in (green) / out (white) bars per bucket
 *
 * The web adds what a pointer can do: a crosshair and a readout for the bucket
 * under it, so every bucket's number is readable without a table.
 */
export function MetricChart({
  kind,
  series,
  priorSeries,
  color,
  height = 190,
}: {
  kind: MetricKind;
  series: MetricPoint[];
  priorSeries?: MetricPoint[];
  color: string;
  height?: number;
}) {
  const t = useT();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const n = Math.max(series.length, 1);
    if (kind === "spend") {
      const cur = cumulative(series, (p) => p.spend);
      const prior = priorSeries ? cumulative(priorSeries, (p) => p.spend) : [];
      const peak = Math.max(1, cur[cur.length - 1] ?? 0, prior[prior.length - 1] ?? 0);
      return { kind, cur, prior, peak, n } as const;
    }
    if (kind === "income") {
      const vals = series.map((p) => p.income);
      return { kind, vals, peak: Math.max(1, ...vals), n } as const;
    }
    const inV = series.map((p) => p.income);
    const outV = series.map((p) => p.spend);
    return { kind, inV, outV, peak: Math.max(1, ...inV, ...outV), n } as const;
  }, [kind, series, priorSeries]);

  const plotW = Math.max(0, w - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number, n: number) => (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD_TOP + plotH * (1 - v / model.peak);

  const labelIdx = useMemo(() => {
    const n = series.length;
    if (n <= 1) return new Set([0]);
    return new Set([0, Math.floor((n - 1) / 2), n - 1]);
  }, [series.length]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (series.length === 0 || plotW <= 0) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const n = series.length;
    const i = n <= 1 ? 0 : Math.round((Math.min(Math.max(x, 0), plotW) / plotW) * (n - 1));
    setHover(i);
  };

  const readout = (() => {
    if (hover === null || !series[hover]) return null;
    const p = series[hover];
    if (model.kind === "spend") {
      const prior = model.prior[hover];
      return {
        label: p.label,
        lines: [
          t("analytics.chart.spentSoFar", { amount: fmt(model.cur[hover] ?? 0) }),
          ...(prior !== undefined ? [t("analytics.chart.lastPeriod", { amount: fmt(prior) })] : []),
        ],
      };
    }
    if (model.kind === "income") return { label: p.label, lines: [t("analytics.chart.in", { amount: fmt(p.income) })] };
    return { label: p.label, lines: [t("analytics.chart.in", { amount: fmt(p.income) }), t("analytics.chart.out", { amount: fmt(p.spend) })] };
  })();
  const hoverX = hover !== null ? xAt(hover, series.length) : 0;

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {w > 0 ? (
        <svg
          width={w}
          height={height}
          className="block touch-pan-y"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={kind === "spend" ? t("analytics.chart.ariaSpend") : kind === "income" ? t("analytics.chart.ariaIncome") : t("analytics.chart.ariaCashflow")}
        >
          <line x1={0} y1={PAD_TOP} x2={plotW} y2={PAD_TOP} stroke={GRID} strokeDasharray="2 4" />
          <line x1={0} y1={PAD_TOP + plotH} x2={plotW} y2={PAD_TOP + plotH} stroke={GRID} />

          {model.kind === "spend" ? (
            <>
              {model.prior.length > 1 ? (
                <path d={linePath(model.prior.map((_, i) => xAt(i, model.prior.length)), model.prior.map(yAt))} stroke={GHOST} strokeWidth={2} fill="none" />
              ) : null}
              <path
                d={linePath(model.cur.map((_, i) => xAt(i, model.cur.length)), model.cur.map(yAt))}
                stroke={color}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
              />
              {model.cur.length > 0 ? (
                <circle cx={xAt(model.cur.length - 1, model.cur.length)} cy={yAt(model.cur[model.cur.length - 1])} r={4} fill={color} />
              ) : null}
            </>
          ) : null}

          {model.kind === "income"
            ? model.vals.map((v, i) => {
                if (v <= 0) return null;
                const bw = Math.min(18, (plotW / Math.max(model.n, 1)) * 0.55);
                const y = yAt(v);
                return <rect key={i} x={xAt(i, model.n) - bw / 2} y={y} width={bw} height={Math.max(PAD_TOP + plotH - y, 1)} rx={3} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />;
              })
            : null}

          {model.kind === "cashflow"
            ? model.inV.map((iv, i) => {
                const slot = plotW / Math.max(model.n, 1);
                const bw = Math.min(9, slot * 0.32);
                const cx = xAt(i, model.n);
                const ov = model.outV[i];
                const iy = yAt(iv);
                const oy = yAt(ov);
                const o = hover === null || hover === i ? 1 : 0.55;
                return (
                  <g key={i} opacity={o}>
                    {iv > 0 ? <rect x={cx - bw - 1.5} y={iy} width={bw} height={Math.max(PAD_TOP + plotH - iy, 1)} rx={2} fill={GREEN} /> : null}
                    {ov > 0 ? <rect x={cx + 1.5} y={oy} width={bw} height={Math.max(PAD_TOP + plotH - oy, 1)} rx={2} fill={OUT} /> : null}
                  </g>
                );
              })
            : null}

          {hover !== null ? (
            <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="rgba(255,255,255,0.35)" strokeWidth={1} pointerEvents="none" />
          ) : null}
          {/* The whole plot is the hit target, not the thin marks. */}
          <rect x={0} y={0} width={plotW} height={height} fill="transparent" />
        </svg>
      ) : null}

      <span className="pointer-events-none absolute right-0 text-right text-[11px] font-bold tabular-nums text-white/55" style={{ top: PAD_TOP - 8, width: PAD_RIGHT - 4 }}>
        {compactFiat(model.peak)}
      </span>

      <div className="pointer-events-none absolute bottom-0.5 left-0 h-4" style={{ width: plotW }}>
        {series.map((p, i) =>
          labelIdx.has(i) ? (
            <span key={i} className="absolute w-10 truncate text-center text-[10.5px] font-semibold text-white/55" style={{ left: xAt(i, series.length) - 20 }}>
              {p.label}
            </span>
          ) : null,
        )}
      </div>

      {readout && w > 0 ? (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-[10px] border border-white/[0.14] bg-[#0E2430]/95 px-2.5 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
          style={{ left: Math.min(Math.max(hoverX - 70, 0), Math.max(w - 150, 0)), width: 140 }}
        >
          <p className="text-[11px] font-bold text-white/55">{readout.label}</p>
          {readout.lines.map((l) => (
            <p key={l} className="text-[12.5px] font-bold tabular-nums text-white">
              {l}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The axis cap fits 40px: "$1,240" whole, "$12.4K" beyond, "$124K" past a
 * hundred thousand. In the display currency, so the cut is on the drawn figure.
 */
function compactFiat(usd: number): string {
  const v = usdToDisplay(usd);
  const cur = effectiveCurrency();
  if (v >= 100_000) {
    try {
      return new Intl.NumberFormat(currentIntl(), { style: "currency", currency: cur, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 0 }).format(v);
    } catch {
      return fmtFiat(v, cur, { compact: true });
    }
  }
  if (v >= 10_000) return fmtFiat(v, cur, { compact: true });
  return fmtFiat(Math.round(v), cur, { whole: true });
}

/* ── Range sheet ─────────────────────────────────────────────────── */

const PILLS: { key: string; days: number }[] = [
  { key: "30", days: 30 },
  { key: "90", days: 90 },
  { key: "365", days: 365 },
];
/** The calendar's columns, Monday first (0 = Sunday for weekdayName). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function pillLabel(days: number): string {
  return days === 365 ? tr("analytics.rangeSheet.oneYear") : tr("analytics.rangeSheet.days", { count: days });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * RangeSheet: four pills on one line (30 days, 90 days, 1 year, Custom), a
 * month calendar where each selected day is its own amber circle, and Apply.
 * First tap on a day is the start, the second the end.
 */
export function RangeSheet({ initial, onApply, onClose }: { initial: SpendRange; onApply: (r: SpendRange) => void; onClose: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"rolling" | "custom">(initial.mode === "custom" ? "custom" : "rolling");
  const [days, setDays] = useState(initial.mode === "rolling" ? (initial.rollingDays ?? 30) : 30);
  const [start, setStart] = useState<number | null>(initial.start);
  const [end, setEnd] = useState<number | null>(initial.end);
  const [cal, setCal] = useState(() => {
    const d = new Date(initial.end);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickPill = (d: number) => {
    const r = rollingRange(d);
    setMode("rolling");
    setDays(d);
    setStart(r.start);
    setEnd(r.end);
    const anchor = new Date(r.end);
    setCal({ year: anchor.getFullYear(), month: anchor.getMonth() });
  };

  const onDay = (ms: number) => {
    setMode("custom");
    const d = startOfDay(ms);
    if (start == null || end != null) {
      setStart(d);
      setEnd(null);
    } else if (d < start) {
      setStart(d);
      setEnd(start);
    } else {
      setEnd(d);
    }
  };

  const grid = useMemo(() => {
    const first = new Date(cal.year, cal.month, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(cal.year, cal.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= count; d++) cells.push(new Date(cal.year, cal.month, d).getTime());
    return cells;
  }, [cal]);

  // Drawn fresh each render, so the words follow a change of language.
  const summary = (() => {
    if (mode === "rolling") return { label: rangeLabel(rollingRange(days)), days };
    if (start != null) {
      const r = customRange(start, end ?? start);
      return { label: rangeLabel(r), days: r.rollingDays ?? 1 };
    }
    return { label: t("analytics.rangeSheet.pickStart"), days: 0 };
  })();

  const apply = () => {
    if (mode === "rolling") onApply(rollingRange(days));
    else if (start != null) onApply(customRange(start, end ?? start));
    onClose();
  };

  const lo = start != null ? startOfDay(start) : null;
  const hi = end != null ? startOfDay(end) : lo;
  const shiftCal = (delta: number) =>
    setCal((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const pill = (on: boolean) =>
    `flex h-[34px] min-w-0 flex-1 items-center justify-center rounded-[17px] border-[0.5px] text-[12px] font-bold transition-colors ${
      on ? "border-amber bg-amber text-[#0F0F1A]" : "border-white/[0.09] bg-white/[0.07] text-white/70 hover:bg-white/[0.1]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("analytics.rangeSheet.title")}>
      <button type="button" aria-label={t("common.close")} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-y-auto rounded-t-[22px] border border-white/[0.12] bg-[#0E2430] px-4 pb-5 pt-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:rounded-[22px]">
        <span className="mx-auto mb-3 h-1 w-9 rounded-[2px] bg-white/25 sm:hidden" aria-hidden />
        <p className="mb-[18px] text-center text-[18px] font-bold tracking-[-0.3px] text-white">{t("analytics.rangeSheet.title")}</p>

        <div className="mb-5 flex gap-2">
          {PILLS.map((p) => (
            <button key={p.key} type="button" aria-pressed={mode === "rolling" && days === p.days} onClick={() => pickPill(p.days)} className={pill(mode === "rolling" && days === p.days)}>
              {pillLabel(p.days)}
            </button>
          ))}
          <button type="button" aria-pressed={mode === "custom"} onClick={() => setMode("custom")} className={pill(mode === "custom")}>
            {t("analytics.rangeSheet.custom")}
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label={t("analytics.previousMonth")} onClick={() => shiftCal(-1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-white/[0.06] text-white/70 hover:bg-white/10">
            <Ion name="chevron-back" size={16} />
          </button>
          <p className="text-[15px] font-bold text-white">
            {fmtDate(new Date(cal.year, cal.month, 1), { month: "long", year: "numeric" })}
          </p>
          <button type="button" aria-label={t("analytics.nextMonth")} onClick={() => shiftCal(1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-white/[0.06] text-white/70 hover:bg-white/10">
            <Ion name="chevron-forward" size={16} />
          </button>
        </div>

        <div className="mb-1.5 grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-center text-[11px] font-bold text-white/[0.45]">
              {weekdayName(w, "narrow")}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((ms, i) => {
            if (ms == null) return <span key={i} className="h-11" />;
            const d = startOfDay(ms);
            const endpoint = (lo != null && d === lo) || (hi != null && d === hi);
            const inRange = lo != null && hi != null && d >= lo && d <= hi;
            return (
              <button key={i} type="button" onClick={() => onDay(ms)} className="flex h-11 items-center justify-center" aria-pressed={inRange}>
                <span
                  className={`flex h-[38px] w-[38px] items-center justify-center rounded-[19px] text-[13px] ${
                    endpoint ? "bg-amber font-bold text-[#0F0F1A]" : inRange ? "bg-amber/[0.18] font-semibold text-white" : "font-semibold text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {new Date(ms).getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          <div className="mb-3.5 text-center">
            <p className="text-[11px] font-bold tracking-[0.5px] text-white/55">{t("analytics.rangeSheet.selected")}</p>
            <p className="mt-0.5 text-[15px] font-bold text-white">
              {summary.days > 0 && mode === "custom" ? t("analytics.rangeSheet.summaryDays", { label: summary.label, count: summary.days }) : summary.label}
            </p>
          </div>
          <button type="button" onClick={apply} className={`${glassCard} flex h-[54px] w-full items-center justify-center rounded-[16px] text-[16px] font-bold tracking-[-0.2px] text-white transition-colors hover:bg-white/[0.14]`}>
            {t("analytics.rangeSheet.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Recurring payments ──────────────────────────────────────────── */

/** "In 3 days" / "Tomorrow" / "Today" / a date. */
function whenLabel(daysUntil: number, nextChargeAt: number): string {
  if (daysUntil <= 0) return tr("common.today");
  if (daysUntil === 1) return tr("analytics.subTile.tomorrow");
  if (daysUntil <= 14) return tr("analytics.subTile.inDays", { count: daysUntil });
  return fmtDate(nextChargeAt, { day: "numeric", month: "short" });
}

/** SubscriptionTiles: a horizontal strip of 150×150 tiles, amber accent. */
export function SubscriptionTiles({ subscriptions }: { subscriptions: Subscription[] }) {
  const t = useT();
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {subscriptions.map((sub) => {
        const def = subscriptionCategoryDef(sub.subCategory);
        return (
          <div
            key={sub.key}
            className="flex h-[150px] w-[150px] shrink-0 snap-start flex-col justify-between rounded-[18px] border-[0.5px] border-amber/[0.22] bg-white/[0.05] p-3.5"
            aria-label={t("analytics.subTile.aria", { name: sub.label })}
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-amber/[0.16] text-amber">
                <Ion name={def.icon} size={18} />
              </span>
              <span className="text-[11px] font-bold text-white/55">{t("analytics.subTile.billingDay", { day: sub.billingDay })}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-[-0.2px] text-white">{sub.label}</p>
              <p className="mt-1 text-[18px] font-bold tracking-[-0.4px] tabular-nums text-white">{fmt(sub.expectedUsd)}</p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-amber">{whenLabel(sub.daysUntil, sub.nextChargeAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The day, local midnight, the app's `todayStartMs` for the detector. */
export function todayStartMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

