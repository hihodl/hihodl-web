"use client";

/**
 * Spending Analytics: the app's own screen, on the web, VIEW ONLY.
 *
 * Copied from `app/(drawer)/(internal)/spending-analytics/index.tsx`, in its
 * order:
 *
 *   header        back, the title, and ONE round button top-right that flips
 *                 to Recurring payments (and back)
 *   period        the Range chip, which opens the range sheet; the month
 *                 lives on the hero and changes by swiping it (and here, by
 *                 its two chevrons too, which a mouse can press)
 *   hero          the month, "+$X You saved", the delta vs last month, the
 *                 amber split bar, Money in / Spent
 *   tiles         Income and Spend, each opening its metric detail. The app
 *                 dropped Saved (it is the hero) and Payouts (it sits apart,
 *                 as a note on the detail) from this grid; so does the web
 *   spending      the donut, always drawn, with its legend; a slice selects,
 *                 a legend row opens the category
 *   budgets       the app's card. Budgets are set on the phone and stored
 *                 there, so the web says so instead of inventing a cap
 *   assets        the entry into Invest
 *   notes         internal transfers excluded; the page cap
 *
 * Every figure is computed in the browser from `GET /transfers?limit=500`
 * (lib/app/spending, the app's code ported). Nothing here writes.
 */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { useT } from "@/lib/app/i18n/react";
import { NO_OVERRIDES, computeSpendingAnalytics } from "@/lib/app/spending/analytics";
import { categoryName } from "@/lib/app/spending/categories";
import { currentMonthRange, isMonthRange, rangeLabel, shiftMonth, type SpendRange } from "@/lib/app/spending/range";
import { detectSubscriptions, monthlyUsd } from "@/lib/app/spending/subscriptions";

import { useProductHref } from "../base";
import { BackHeader } from "../hold";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Skeleton } from "../ui";
import {
  GREEN,
  Note,
  RangeSheet,
  SectionCard,
  SectionLabel,
  SpendingDonut,
  SubscriptionTiles,
  TRANSFER_GREY,
  fmt,
  glassCard,
  glassHero,
  pct0,
  rangeQuery,
  signed,
  todayStartMs,
  useSpendingRows,
  type DonutSlice,
} from "./parts";

const AMBER_FILL = "linear-gradient(90deg,#FFD234,#FFB703)";

export function AnalyticsScreen({ initialTab }: { initialTab?: string }) {
  const t = useT();
  const productHref = useProductHref();
  const [tab, setTab] = useState<"overview" | "subscriptions">(initialTab === "subscriptions" ? "subscriptions" : "overview");
  const onRecurring = tab === "subscriptions";

  const [range, setRange] = useState<SpendRange>(() => currentMonthRange());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const data = useSpendingRows();
  const a = useMemo(() => computeSpendingAnalytics(data.rows, range, data.hasMore), [data.rows, data.hasMore, range]);

  const isMonth = isMonthRange(range);
  const atCurrentMonth = isMonth && range.start === currentMonthRange().start;

  // Never into the future.
  const goMonth = (delta: number) =>
    setRange((r) => {
      if (r.mode !== "month") return r;
      if (delta > 0 && r.start >= currentMonthRange().start) return r;
      return shiftMonth(r, delta);
    });

  // Swipe LEFT advances toward the present, RIGHT goes back (the app's carousel).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(e.clientY - s.y) > Math.abs(dx)) return;
    if (dx <= -45) goMonth(1);
    else if (dx >= 45) goMonth(-1);
  };

  const hasSpend = a.categories.length > 0 && a.spend > 0;
  const showTransfersRing = !hasSpend && a.excludedInternal > 0;
  const slices: DonutSlice[] = hasSpend
    ? a.categories.map((c) => ({ id: c.id, color: c.color, pct: c.pct, label: categoryName(c.id) }))
    : showTransfersRing
      ? [{ id: "transfers", color: TRANSFER_GREY, pct: 1, label: categoryName("transfers") }]
      : [];

  const label = rangeLabel(range);
  const pctStr = (p: number | null) => (p == null ? null : `${p >= 0 ? "↑" : "↓"} ${pct0(Math.abs(p))}`);
  const q = rangeQuery(range);
  const categoryHref = (id: string) => productHref(`/analytics/category/${encodeURIComponent(id)}?${q}`);
  const metricHref = (key: "spend" | "income" | "cashflow") => productHref(`/analytics/metric/${key}?${q}`);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col pb-8">
      <BackHeader
        title={onRecurring ? t("analytics.recurring.title") : t("analytics.title")}
        backHref={productHref()}
        right={
          <button
            type="button"
            onClick={() => setTab(onRecurring ? "overview" : "subscriptions")}
            aria-label={onRecurring ? t("analytics.header.backToAnalytics") : t("analytics.header.recurringPayments")}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[17px] border-[0.5px] border-white/[0.08] bg-white/[0.06] text-white transition-colors hover:bg-white/10"
          >
            <Ion name={onRecurring ? "stats-chart" : "repeat"} size={17} />
          </button>
        }
      />

      {data.failed ? (
        <div className={`${glassCard} mt-2 rounded-[18px]`}>
          <ReadFailed title={t("analytics.readFailed.title")} body={t("analytics.readFailed.overview")} onRetry={data.retry} />
        </div>
      ) : !data.loaded ? (
        <div className="mt-2 flex flex-col gap-3" aria-busy>
          <Skeleton className="h-[200px] rounded-[24px]" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-[76px]" />
            <Skeleton className="h-[76px]" />
          </div>
          <Skeleton className="h-[170px]" />
        </div>
      ) : onRecurring ? (
        <Recurring rows={data.rows} />
      ) : (
        <>
          {/* Period row: the active range's label (rolling / custom only) and the Range chip. */}
          <div className="mb-3 mt-1 flex items-center justify-between gap-3 px-1">
            {isMonth ? <span /> : <p className="min-w-0 flex-1 truncate text-[14px] font-bold capitalize text-white/[0.85]">{label}</p>}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={`${glassCard} inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[16px] px-3 text-[12px] font-bold text-white/[0.85] transition-colors hover:bg-white/[0.14]`}
            >
              <Ion name="calendar-outline" size={14} className="text-white/80" />
              {t("analytics.rangeButton")}
            </button>
          </div>

          {/* HERO */}
          <section
            className={`${glassHero} relative touch-pan-y rounded-[24px] px-[34px] pb-4 pt-[18px]`}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
          >
            {isMonth ? (
              <>
                <button type="button" aria-label={t("analytics.previousMonth")} onClick={() => goMonth(-1)} className="absolute left-1 top-1/2 flex h-8 w-7 -translate-y-1/2 items-center justify-center text-white/[0.28] hover:text-white/60">
                  <Ion name="chevron-back" size={16} />
                </button>
                {!atCurrentMonth ? (
                  <button type="button" aria-label={t("analytics.nextMonth")} onClick={() => goMonth(1)} className="absolute right-1 top-1/2 flex h-8 w-7 -translate-y-1/2 items-center justify-center text-white/[0.28] hover:text-white/60">
                    <Ion name="chevron-forward" size={16} />
                  </button>
                ) : null}
              </>
            ) : null}

            <p className="text-[11px] font-bold tracking-[1.5px] text-white/65">{(label || "").toLocaleUpperCase()}</p>
            <p
              className="mt-2 whitespace-nowrap text-[clamp(32px,11vw,44px)] font-bold leading-[1.1] tabular-nums"
              style={{ color: a.netKept < 0 ? "#fff" : GREEN }}
            >
              {signed(a.netKept)}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-white/55">{isMonth ? t("analytics.hero.youSaved") : t("analytics.hero.saved")}</p>
            {Math.abs(a.netKeptDelta) >= 0.01 ? (
              <p className="mt-2 text-[13px] font-bold" style={{ color: a.netKeptDelta < 0 ? "rgba(255,255,255,0.6)" : GREEN }}>
                {t("analytics.hero.delta", { arrow: a.netKeptDelta >= 0 ? "↑" : "↓", amount: fmt(Math.abs(a.netKeptDelta)), period: isMonth ? "month" : "other" })}
              </p>
            ) : null}

            <SplitBar income={a.income} spend={a.spend} />

            <div className="mt-[11px] flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-white/55">{t("analytics.hero.moneyIn")}</p>
                <p className="mt-px truncate text-[15px] font-bold tracking-[-0.3px] tabular-nums text-white">{fmt(a.income)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[11.5px] font-semibold text-white/55">{t("analytics.hero.spent")}</p>
                <p className="mt-px truncate text-[15px] font-bold tracking-[-0.3px] tabular-nums text-white">{fmt(a.spend)}</p>
              </div>
            </div>
          </section>

          {/* Income + Spend */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Bucket label={t("analytics.bucket.income")} value={fmt(a.income)} delta={pctStr(a.incomeDeltaPct)} deltaGreen={(a.incomeDeltaPct ?? 0) >= 0} href={metricHref("income")} />
            <Bucket label={t("analytics.bucket.spend")} value={fmt(a.spend)} delta={pctStr(a.spendDeltaPct)} deltaGreen={false} href={metricHref("spend")} />
          </div>

          {/* SPENDING */}
          <SectionCard>
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>{t("analytics.spending.label")}</SectionLabel>
              <Link href={metricHref("spend")} className="inline-flex items-center gap-1 text-[12px] font-bold text-white/70 hover:text-white">
                {t("common.seeAll")}
                <Ion name="chevron-forward" size={13} />
              </Link>
            </div>
            <div className="flex items-center gap-[18px]">
              <SpendingDonut
                slices={slices}
                size={112}
                thickness={24}
                centerValue={fmt(a.spend)}
                centerLabel={t("analytics.hero.spent")}
                selectedId={hasSpend ? selectedId : null}
                onSlicePress={hasSpend ? (id) => setSelectedId((cur) => (cur === id ? null : id)) : undefined}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
                {hasSpend ? (
                  a.categories.map((c) => {
                    const active = selectedId === c.id;
                    const dim = selectedId != null && !active;
                    return (
                      <Link
                        key={c.id}
                        href={categoryHref(c.id)}
                        className={`-mx-1.5 flex items-center gap-2 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-white/[0.06] ${active ? "bg-[rgba(61,220,132,0.10)]" : ""}`}
                      >
                        <span
                          className={`shrink-0 ${active ? "h-[11px] w-[11px] rounded-[4px]" : "h-[9px] w-[9px] rounded-[2px]"}`}
                          style={{ backgroundColor: c.color, opacity: dim ? 0.4 : 1 }}
                        />
                        <span className={`min-w-0 flex-1 truncate text-[13px] ${active ? "font-bold text-white" : "font-semibold text-white/[0.85]"} ${dim ? "opacity-50" : ""}`}>{categoryName(c.id)}</span>
                        <span className={`shrink-0 text-[13px] font-bold tabular-nums text-white ${dim ? "opacity-50" : ""}`}>{fmt(c.amount)}</span>
                      </Link>
                    );
                  })
                ) : showTransfersRing ? (
                  <>
                    <Link href={categoryHref("transfers")} className="-mx-1.5 flex items-center gap-2 rounded-[10px] px-1.5 py-1 hover:bg-white/[0.06]">
                      <span className="h-[9px] w-[9px] shrink-0 rounded-[2px]" style={{ backgroundColor: TRANSFER_GREY }} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/[0.85]">{categoryName("transfers")}</span>
                      <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">{fmt(a.excludedInternal)}</span>
                      <Ion name="chevron-forward" size={14} className="ml-1 shrink-0 text-white/35" />
                    </Link>
                    <p className="mt-0.5 text-[12px] leading-[17px] text-white/55">{t("analytics.spending.transfersNote")}</p>
                  </>
                ) : (
                  <p className="mt-0.5 text-[12px] leading-[17px] text-white/55">{t("analytics.spending.empty")}</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* BUDGETS: set and kept on the phone. */}
          <SectionCard>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>{t("analytics.budgets.label")}</SectionLabel>
            </div>
            <div className="flex items-center gap-2.5 rounded-[14px] border-[0.5px] border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.06)] p-3.5">
              <Ion name="phone-portrait-outline" size={18} className="shrink-0 text-white/60" />
              <p className="flex-1 text-[12.5px] leading-[17px] text-white/70">{t("analytics.budgets.inApp")}</p>
            </div>
          </SectionCard>

          {/* Assets: the entry into Invest. */}
          <Link href={productHref("/invest")} className={`${glassCard} mt-3 flex items-center gap-3 rounded-[18px] bg-white/[0.14] p-4 transition-colors hover:bg-white/[0.18]`}>
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-amber text-[#0A121A]">
              <Ion name="trending-up-outline" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-white/55">{t("analytics.assets.label")}</span>
              <span className="block truncate text-[18px] font-bold tracking-[-0.4px] text-white">{t("analytics.assets.title")}</span>
            </span>
            <Ion name="chevron-forward" size={18} className="shrink-0 text-white/40" />
          </Link>

          {a.excludedInternal > 0 && hasSpend ? (
            <Note>{t("analytics.note.excludedTransfers", { amount: fmt(a.excludedInternal) })}</Note>
          ) : null}
          {a.capped ? <Note>{t("analytics.note.capped")}</Note> : null}
        </>
      )}

      {sheetOpen ? <RangeSheet initial={range} onApply={setRange} onClose={() => setSheetOpen(false)} /> : null}
    </div>
  );
}

/* ── Recurring payments ──────────────────────────────────────────── */

function Recurring({ rows }: { rows: Parameters<typeof detectSubscriptions>[0] }) {
  const t = useT();
  const subs = useMemo(() => detectSubscriptions(rows, { maps: NO_OVERRIDES, nowMs: todayStartMs() }), [rows]);
  const monthly = subs.reduce((sum, s) => sum + monthlyUsd(s), 0);

  if (subs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-9 text-center">
        <Ion name="repeat-outline" size={26} className="text-white/30" />
        <p className="text-[14px] font-semibold text-white/55">{t("analytics.recurring.emptyTitle")}</p>
        <p className="px-10 text-[12.5px] leading-[18px] text-white/55">{t("analytics.recurring.emptyBody")}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="px-1 pb-[18px] pt-1.5">
        <p className="text-[13px] font-semibold text-white/55">{t("analytics.recurring.monthly")}</p>
        <p className="mt-1 text-[36px] font-bold leading-[42px] tracking-[-1px] tabular-nums text-white">{fmt(monthly)}</p>
        <p className="mt-1 text-[12.5px] font-semibold text-white/55">
          {t("analytics.recurring.count", { count: subs.length })}
        </p>
      </div>
      <SubscriptionTiles subscriptions={subs} />
      <Note className="mt-3">{t("analytics.recurring.note")}</Note>
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────── */

function SplitBar({ income, spend }: { income: number; spend: number }) {
  const total = Math.max(income, spend, 1);
  const savedFrac = income > 0 ? Math.max(0, Math.min(1, (income - spend) / total)) : 0;
  const spentFrac = income > 0 ? Math.max(0, Math.min(1, spend / total)) : spend > 0 ? 1 : 0;
  return (
    <div className="mt-4 flex h-3.5 overflow-hidden rounded-[7px] bg-white/[0.06]" aria-hidden>
      {savedFrac > 0 ? <span className="h-full" style={{ flex: savedFrac, background: AMBER_FILL }} /> : null}
      {savedFrac > 0 && spentFrac > 0 ? <span className="h-full w-px bg-[#0A121A]" /> : null}
      {spentFrac > 0 ? <span className="h-full bg-white/[0.16]" style={{ flex: spentFrac }} /> : null}
    </div>
  );
}

function Bucket({ label, value, delta, deltaGreen, href }: { label: string; value: string; delta: string | null; deltaGreen: boolean; href: string }) {
  const green = delta != null && deltaGreen;
  return (
    <Link href={href} className={`${glassCard} min-w-0 rounded-[16px] p-3.5 transition-colors hover:bg-white/[0.14]`}>
      <span className="flex min-h-5 items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/55">{label}</span>
        {delta ? (
          <span className={`inline-flex h-[18px] shrink-0 items-center rounded-[6px] px-1.5 text-[11px] font-bold ${green ? "bg-[rgba(61,220,132,0.12)]" : "bg-white/[0.07] text-white/70"}`} style={green ? { color: GREEN } : undefined}>
            {delta}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block truncate text-[22px] font-bold tracking-[-0.5px] tabular-nums text-white">{value}</span>
    </Link>
  );
}
