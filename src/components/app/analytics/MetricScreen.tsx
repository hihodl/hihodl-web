"use client";

/**
 * Per-metric detail, the app's `spending-analytics/metric/[key].tsx`, VIEW ONLY.
 *
 *   the figure       Spent, Income or Net cashflow for the range, with its
 *                    change against the prior period
 *   the chart        the right shape per metric (MetricChart): the cumulative
 *                    line against last period for Spent, bars for Income,
 *                    paired in/out bars for Cashflow
 *   1W 1M 6M 1Y      the timeframe pills
 *   the breakdown    Spent by category (a row opens it), Income by source,
 *                    Cashflow as Money in + Money out
 *
 * The range arrives in the address, as the app passes it through params.
 */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { computeSpendingAnalytics } from "@/lib/app/spending/analytics";
import { currentMonthRange, isMonthRange, rollingRange, type SpendRange } from "@/lib/app/spending/range";
import type { IonName } from "../ion";

import { useProductHref } from "../base";
import { BackHeader } from "../hold";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Skeleton } from "../ui";
import { GREEN, MetricChart, Note, WHITE, fmt, glassCard, rangeFromQuery, rangeQuery, signed, useSpendingRows, type MetricKind } from "./parts";

type MetricKey = "spend" | "income" | "cashflow";

const META: Record<MetricKey, { title: string; kind: MetricKind; color: string }> = {
  spend: { title: "Spent", kind: "spend", color: WHITE },
  income: { title: "Income", kind: "income", color: GREEN },
  cashflow: { title: "Net cashflow", kind: "cashflow", color: GREEN },
};

const PILLS: { id: string; label: string; make: () => SpendRange }[] = [
  { id: "1w", label: "1W", make: () => rollingRange(7) },
  { id: "1m", label: "1M", make: () => currentMonthRange() },
  { id: "6m", label: "6M", make: () => rollingRange(182) },
  { id: "1y", label: "1Y", make: () => rollingRange(365) },
];

export function MetricScreen({ metric, query }: { metric: string; query: Record<string, string | string[] | undefined> }) {
  const productHref = useProductHref();
  const key: MetricKey = metric === "income" ? "income" : metric === "cashflow" ? "cashflow" : "spend";
  const meta = META[key];

  const [range, setRange] = useState<SpendRange>(() => rangeFromQuery(query));
  const data = useSpendingRows();
  const a = useMemo(() => computeSpendingAnalytics(data.rows, range, data.hasMore), [data.rows, data.hasMore, range]);

  const value = key === "income" ? a.income : key === "cashflow" ? a.netKept : a.spend;
  const deltaPct = key === "income" ? a.incomeDeltaPct : key === "cashflow" ? null : a.spendDeltaPct;

  const activePill = isMonthRange(range)
    ? "1m"
    : range.rollingDays === 7
      ? "1w"
      : range.rollingDays === 182
        ? "6m"
        : range.rollingDays === 365
          ? "1y"
          : "";

  const categoryHref = (id: string) => productHref(`/analytics/category/${encodeURIComponent(id)}?${rangeQuery(range)}`);

  const subtitle =
    key === "cashflow"
      ? `${signed(a.income)} in · −${fmt(a.spend)} out`
      : deltaPct != null
        ? `${deltaPct >= 0 ? "↑" : "↓"} ${Math.abs(Math.round(deltaPct * 100))}% vs last period`
        : range.label;

  const txs = (n: number) => `${n} ${n === 1 ? "transaction" : "transactions"}`;

  const byCategory = a.categories.map((c) => (
    <BreakdownRow key={c.id} icon={c.def.icon} color={c.color} label={c.def.label} sub={txs(c.txCount)} amount={`−${fmt(c.amount)}`} pct={c.pct} href={categoryHref(c.id)} />
  ));
  const bySource = a.incomeSources.map((s) => (
    <BreakdownRow key={s.key} icon="arrow-down-outline" color={GREEN} label={s.label} sub={txs(s.txCount)} amount={`+${fmt(s.amount)}`} pct={s.pct} />
  ));

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col pb-8">
      <BackHeader title={meta.title} backHref={productHref("/analytics")} />

      {data.failed ? (
        <div className={`${glassCard} mt-2 rounded-[18px]`}>
          <ReadFailed title="We couldn't load your activity" body="This is worked out from your activity, and it did not answer. Nothing has changed." onRetry={data.retry} />
        </div>
      ) : !data.loaded ? (
        <div className="mt-2 flex flex-col gap-3" aria-busy>
          <Skeleton className="h-[64px] w-[220px]" />
          <Skeleton className="h-[218px] rounded-[20px]" />
          <Skeleton className="h-[34px]" />
          <Skeleton className="h-[160px]" />
        </div>
      ) : (
        <>
          <div className="px-1 pb-4 pt-2.5">
            <p className="whitespace-nowrap text-[clamp(30px,10vw,40px)] font-bold leading-[1.15] tracking-[-1px] tabular-nums text-white">
              {key === "cashflow" ? signed(value) : fmt(value)}
            </p>
            <p className="mt-1 text-[13.5px] font-semibold text-white/55">{subtitle}</p>
          </div>

          <section className={`${glassCard} mb-3.5 rounded-[20px] p-3.5`}>
            <MetricChart kind={meta.kind} series={a.series} priorSeries={a.priorSeries} color={meta.color} />
          </section>

          <div className="mb-1.5 flex gap-2" role="group" aria-label="Timeframe">
            {PILLS.map((p) => {
              const on = activePill === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRange(p.make())}
                  className={`flex h-[34px] flex-1 items-center justify-center rounded-[17px] border-[0.5px] text-[13px] font-bold transition-colors ${
                    on ? "border-white/90 bg-white/90 text-[#0A121A]" : "border-white/[0.22] bg-white/10 text-white/70 hover:bg-white/[0.14]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {key === "spend" ? <Section title="BY CATEGORY">{byCategory.length ? byCategory : <Empty text="No spending in this period." />}</Section> : null}
          {key === "income" ? <Section title="BY SOURCE">{bySource.length ? bySource : <Empty text="No money in during this period." />}</Section> : null}
          {key === "cashflow" ? (
            <>
              <Section title="MONEY IN" right={`+${fmt(a.income)}`}>
                {bySource.length ? bySource : <Empty text="No money in." />}
              </Section>
              <Section title="MONEY OUT" right={`−${fmt(a.spend)}`}>
                {byCategory.length ? byCategory : <Empty text="No spending." />}
              </Section>
            </>
          ) : null}

          {a.payouts > 0 && key !== "income" ? (
            <Note className="mt-[18px]">
              {fmt(a.payouts)} in bank payouts (off-ramps) is tracked separately — money sent to a bank isn&apos;t consumption.
            </Note>
          ) : null}
          {a.capped ? <Note>Showing your most recent activity. Older transactions in a long range may not be included yet.</Note> : null}
        </>
      )}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
  return (
    <section className="pt-[22px]">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <p className="text-[12px] font-bold tracking-[1.4px] text-white/55">{title}</p>
        {right ? <p className="text-[13px] font-bold tabular-nums text-white/75">{right}</p> : null}
      </div>
      <div className={`${glassCard} rounded-[16px] px-3 py-1`}>{children}</div>
    </section>
  );
}

function BreakdownRow({ icon, color, label, sub, amount, pct, href }: { icon: IonName; color: string; label: string; sub: string; amount: string; pct: number; href?: string }) {
  const inner = (
    <>
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[19px] bg-white/[0.06]" style={{ color }}>
        <Ion name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-white">{label}</span>
        <span className="mt-0.5 block truncate text-[12px] text-white/55">{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-bold tabular-nums text-white">{amount}</span>
        <span className="mt-0.5 block text-[12px] font-semibold text-white/55">{Math.round(pct * 100)}%</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 py-[11px]";
  return href ? (
    <Link href={href} className={`${cls} -mx-2 rounded-[12px] px-2 transition-colors hover:bg-white/[0.05]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-3.5 text-[13px] text-white/55">{text}</p>;
}
