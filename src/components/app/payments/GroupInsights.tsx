"use client";

/**
 * A group's Insights (contract §10.5, GET /groups/:id/stats), drawn the way
 * Spending Analytics is (analytics/parts: the white-glass cards, the green and
 * white ramp, money out in white and never red):
 *
 *   range        3 months, 6 months, 1 year, 3 years (the server's cap is 36)
 *   hero         total spent, how many expenses, the average per person and
 *                the biggest month
 *   you          what you owe or are owed in all, what you paid and your
 *                share, and pair by pair who owes you and whom you owe
 *                (`you.withEach`, direct balances before any simplifying)
 *   by month     a bar per month, your share drawn inside it; hover or tap a
 *                bar for its numbers, or open the list
 *   by category  the donut and its legend, with icons
 *   people       each member's paid against their share, and where they stand;
 *                somebody who left is "Former member"
 *   settle plan  the payments that would clear the book (§5.1)
 *   top          the five biggest expenses, each opening its detail
 *
 * Every amount is in the group's currency. VIEW ONLY: nothing here writes.
 */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import {
  absMinor,
  CATEGORY_LABEL,
  fractions,
  groupMoney,
  labelledMonths,
  lastMonths,
  memberName,
  monthLabel,
  pairLines,
  toBig,
  useGroupInfo,
  useGroupMembers,
  useGroupStats,
  type GroupMember,
  type GroupStats,
} from "@/lib/app/groups";
import type { MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";
import { rampColor } from "@/lib/app/spending/categories";
import { useMe } from "@/lib/app/spaces-data";

import { SectionCard, SectionLabel, Note, SpendingDonut, glassCard, glassHero, GREEN } from "../analytics/parts";
import { useProductHref } from "../base";
import { BackHeader, Column } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { ExpenseDetail } from "./GroupExpense";
import { CATEGORY_ICON, LoadFailed, PersonFace } from "./group-kit";

const RANGES: readonly { months: number; labelKey: MessageKey }[] = [
  { months: 3, labelKey: "groupThread.insights.range.threeMonths" },
  { months: 6, labelKey: "groupThread.insights.range.sixMonths" },
  { months: 12, labelKey: "groupThread.insights.range.oneYear" },
  { months: 36, labelKey: "groupThread.insights.range.threeYears" },
];

/** A group's amount in the group's own currency (never converted). */
const money = (minor: string | bigint, currency: string) => groupMoney(minor, currency);

const TOTAL_BAR = "rgba(255,255,255,0.22)";

export function GroupInsights({ groupId }: { groupId: string }) {
  const t = useT();
  const href = useProductHref();
  const me = useMe();
  const meId = me.data?.id ?? null;
  const info = useGroupInfo(groupId);
  const members = useGroupMembers(groupId);
  const [months, setMonths] = useState<number>(12);
  const range = useMemo(() => lastMonths(months), [months]);
  const stats = useGroupStats(groupId, range, info.data?.currency ?? undefined);
  const [open, setOpen] = useState<string | null>(null);

  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.userId, m])), [members.data]);
  const nameOf = (id: string) =>
    id === meId
      ? t("groupThread.names.youSubject")
      : byId.get(id)
        ? memberName(byId.get(id))
        : members.data
          ? t("groupThread.names.formerMemberShort")
          : t("groupThread.names.someone");
  const s = stats.data;
  const cur = s?.currency ?? (info.data?.currency ?? "USD").toUpperCase();

  return (
    <Column>
      <BackHeader title={t("groupThread.insights.title")} subtitle={info.data?.name ?? undefined} backHref={href(`/payments/groups/${encodeURIComponent(groupId)}`)} />

      <div role="radiogroup" aria-label={t("groupThread.insights.rangeA11y")} className="mt-1 flex gap-2">
        {RANGES.map((r) => {
          const on = months === r.months;
          return (
            <button
              key={r.months}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMonths(r.months)}
              className={`flex h-[34px] min-w-0 flex-1 items-center justify-center rounded-[17px] text-[12.5px] font-bold transition-colors ${
                on ? "bg-[#F1F5F9] text-[#0A1420]" : "bg-white/[0.07] text-white/70 hover:bg-white/[0.1]"
              }`}
            >
              {t(r.labelKey)}
            </button>
          );
        })}
      </div>

      {s === undefined && !stats.error ? (
        <div className="mt-3 flex flex-col gap-3" aria-busy>
          <Skeleton className="h-[150px] rounded-[24px]" />
          <Skeleton className="h-[200px] rounded-[18px]" />
          <Skeleton className="h-[180px] rounded-[18px]" />
        </div>
      ) : null}
      {stats.error && !s ? (
        <div className="mt-4">
          <LoadFailed words={t("groupThread.insights.failed")} onRetry={() => void stats.mutate()} />
        </div>
      ) : null}

      {s ? (
        <>
          <Hero s={s} cur={cur} />
          <YouCard s={s} cur={cur} byId={byId} nameOf={nameOf} />
          {s.expenseCount > 0 ? (
            <>
              <Months s={s} cur={cur} />
              <Categories s={s} cur={cur} />
              <People s={s} cur={cur} byId={byId} nameOf={nameOf} meId={meId} />
            </>
          ) : (
            <SectionCard>
              <p className="py-4 text-center text-[13.5px] text-white/60">{t("groupThread.insights.empty")}</p>
            </SectionCard>
          )}
          <Plan s={s} cur={cur} byId={byId} nameOf={nameOf} meId={meId} threadHref={href(`/payments/groups/${encodeURIComponent(groupId)}`)} />
          {s.topExpenses.length ? (
            <SectionCard>
              <SectionLabel>{t("groupThread.insights.top")}</SectionLabel>
              <ul className="mt-2 flex flex-col">
                {s.topExpenses.map((e) => {
                  const c = e.category ?? "other";
                  return (
                    <li key={e.expenseId}>
                      <button type="button" onClick={() => setOpen(e.expenseId)} className="-mx-1.5 flex w-[calc(100%+12px)] min-w-0 items-center gap-3 rounded-[12px] px-1.5 py-2 text-left hover:bg-white/[0.06]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-white/[0.08] text-white/80">
                          <Ion name={CATEGORY_ICON[c]} size={16} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14px] font-bold text-white">{e.description?.trim() || t("groupThread.expense.fallbackTitle")}</span>
                          <span className="truncate text-[12px] text-white/55">
                            {e.spentAt
                              ? t("groupThread.insights.paidByOn", { name: nameOf(e.payerUserId), date: fmtDate(e.spentAt, { day: "numeric", month: "short" }) })
                              : t("groupThread.insights.paidBy", { name: nameOf(e.payerUserId) })}
                          </span>
                        </span>
                        <span className="shrink-0 text-[14px] font-bold tabular-nums text-white">{money(e.groupMinor, cur)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ) : null}
          <Note>{t("groupThread.insights.note", { currency: cur })}</Note>
        </>
      ) : null}

      {open && members.data ? (
        <ExpenseDetail groupId={groupId} expenseId={open} groupCurrency={cur} members={members.data} meId={meId} onClose={() => setOpen(null)} onChanged={() => void stats.mutate()} />
      ) : null}
    </Column>
  );
}

/* ── Hero ────────────────────────────────────────────────────────── */

function Hero({ s, cur }: { s: GroupStats; cur: string }) {
  const t = useT();
  return (
    <>
      <section className={`${glassHero} mt-3 rounded-[24px] px-5 py-5`}>
        <p className="text-[11px] font-bold tracking-[1.5px] text-white/65">
          {s.from && s.to ? t("groupThread.insights.heroRange", { from: monthLabel(s.from, true), to: monthLabel(s.to, true) }).toUpperCase() : t("groupThread.insights.heroSpent")}
        </p>
        <p className="mt-2 whitespace-nowrap text-[clamp(32px,11vw,44px)] font-bold leading-[1.1] tabular-nums text-white">{money(s.totalMinor, cur)}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-white/55">
          {t("groupThread.insights.spentTogether", { count: s.expenseCount })}
        </p>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile label={t("groupThread.insights.averagePerPerson")} value={money(s.averagePerPersonMinor, cur)} />
        <Tile label={t("groupThread.insights.biggestMonth")} value={s.biggestMonth ? monthLabel(s.biggestMonth, true) : "–"} />
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${glassCard} min-w-0 rounded-[16px] p-3.5`}>
      <span className="block truncate text-[12px] font-semibold text-white/55">{label}</span>
      <span className="mt-1.5 block truncate text-[20px] font-bold tracking-[-0.5px] tabular-nums text-white">{value}</span>
    </div>
  );
}

/* ── You ─────────────────────────────────────────────────────────── */

type NameOf = (id: string) => string;

function YouCard({ s, cur, byId, nameOf }: { s: GroupStats; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf }) {
  const t = useT();
  const net = toBig(s.you.netMinor);
  const pairs = pairLines(s.you.withEach);
  return (
    <SectionCard>
      <SectionLabel>{t("groupThread.insights.you")}</SectionLabel>
      <p className="mt-2 text-[24px] font-bold tracking-[-0.5px] tabular-nums" style={{ color: net > 0n ? GREEN : "#fff" }}>
        {net > 0n
          ? t("groupThread.balance.youreOwed", { amount: money(s.you.netMinor, cur) })
          : net < 0n
            ? t("groupThread.balance.youOwe", { amount: money(absMinor(s.you.netMinor), cur) })
            : t("groupThread.balance.settled")}
      </p>
      <div className="mt-2 flex justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold text-white/55">{t("groupThread.insights.youPaid")}</p>
          <p className="mt-px truncate text-[15px] font-bold tabular-nums text-white">{money(s.you.paidMinor, cur)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11.5px] font-semibold text-white/55">{t("groupThread.insights.yourShare")}</p>
          <p className="mt-px truncate text-[15px] font-bold tabular-nums text-white">{money(s.you.shareMinor, cur)}</p>
        </div>
      </div>

      {pairs.owesYou.length || pairs.youOwe.length ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-3">
          {pairs.owesYou.length ? (
            <PairList title={t("groupThread.insights.oweYou", { amount: money(pairs.owed, cur) })} rows={pairs.owesYou} cur={cur} byId={byId} nameOf={nameOf} green />
          ) : null}
          {pairs.youOwe.length ? <PairList title={t("groupThread.insights.youOwe", { amount: money(pairs.owe, cur) })} rows={pairs.youOwe} cur={cur} byId={byId} nameOf={nameOf} /> : null}
          <p className="text-[12px] leading-[17px] text-white/50">{t("groupThread.insights.pairNote")}</p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function PairList({ title, rows, cur, byId, nameOf, green = false }: { title: string; rows: { userId: string; minor: string }[]; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf; green?: boolean }) {
  useT();
  return (
    <div>
      <p className="mb-1 text-[12.5px] font-bold text-white/70">{title}</p>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.userId} className="flex min-h-[40px] items-center gap-2.5">
            <PersonFace person={byId.get(r.userId)} size={28} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white/90">{nameOf(r.userId)}</span>
            <span className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color: green ? GREEN : "#fff" }}>
              {money(r.minor, cur)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── By month ────────────────────────────────────────────────────── */

function Months({ s, cur }: { s: GroupStats; cur: string }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const [asList, setAsList] = useState(false);
  const rows = s.byMonth;
  const tot = fractions(rows.map((m) => m.totalMinor));
  // Your share on the same axis as the totals: its fraction of the tallest month.
  const max = rows.reduce((a, m) => (toBig(m.totalMinor) > a ? toBig(m.totalMinor) : a), 0n);
  const yours = rows.map((m) => (max > 0n ? Number((toBig(m.yourShareMinor) * 10000n) / max) / 10000 : 0));
  const labels = labelledMonths(rows.length);
  const H = 150;
  const shown = hover !== null ? rows[hover] : null;

  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <SectionLabel>{t("groupThread.insights.byMonth")}</SectionLabel>
        <button type="button" onClick={() => setAsList((v) => !v)} className="text-[12px] font-bold text-white/70 hover:text-white">
          {asList ? t("groupThread.insights.chart") : t("groupThread.insights.list")}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11.5px] font-semibold text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TOTAL_BAR }} />
          {t("groupThread.insights.theGroup")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
          {t("groupThread.insights.yourShare")}
        </span>
      </div>

      {asList ? (
        <ul className="mt-3 flex flex-col">
          {[...rows].reverse().map((m) => (
            <li key={m.month} className="flex min-h-[36px] items-center gap-3 border-b border-white/[0.06] text-[13px] last:border-0">
              <span className="w-20 shrink-0 font-semibold text-white/80">{monthLabel(m.month, true)}</span>
              <span className="min-w-0 flex-1 text-white/55">{t("groupThread.insights.expenses", { count: m.count })}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-bold text-white">{money(m.totalMinor, cur)}</span>
                <span className="block text-[11.5px] text-white/55">{t("groupThread.insights.yours", { amount: money(m.yourShareMinor, cur) })}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="relative mt-3 h-5 text-[12px] tabular-nums text-white/80" aria-live="polite">
            {shown ? (
              <span>
                <Rich
                  k="groupThread.insights.monthLine"
                  vars={{ month: monthLabel(shown.month, true), total: money(shown.totalMinor, cur), yours: money(shown.yourShareMinor, cur), count: shown.count }}
                  tags={{ b: (c) => <b className="text-white">{c}</b> }}
                />
              </span>
            ) : (
              <span className="text-white/45">{t("groupThread.insights.tapAMonth")}</span>
            )}
          </div>
          <div className="mt-2 flex items-end gap-[2px] border-b border-white/[0.1]" style={{ height: H }} onPointerLeave={() => setHover(null)} role="img" aria-label={t("groupThread.insights.chartA11y")}>
            {rows.map((m, i) => (
              <button
                key={m.month}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={t("groupThread.insights.barA11y", { month: monthLabel(m.month, true), total: money(m.totalMinor, cur), yours: money(m.yourShareMinor, cur) })}
                className="relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <span
                  className="relative w-full max-w-[28px] overflow-hidden rounded-t-[4px] transition-opacity"
                  style={{ height: `${Math.max(tot[i] * 100, toBig(m.totalMinor) > 0n ? 2 : 0)}%`, background: TOTAL_BAR, opacity: hover === null || hover === i ? 1 : 0.5 }}
                >
                  <span className="absolute inset-x-0 bottom-0 rounded-t-[4px]" style={{ height: tot[i] > 0 ? `${(yours[i] / tot[i]) * 100}%` : 0, background: GREEN }} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px]">
            {rows.map((m, i) => (
              <span key={m.month} className="min-w-0 flex-1 truncate text-center text-[10.5px] font-semibold text-white/50">
                {labels.has(i) ? monthLabel(m.month) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ── By category ─────────────────────────────────────────────────── */

function Categories({ s, cur }: { s: GroupStats; cur: string }) {
  const t = useT();
  const [sel, setSel] = useState<string | null>(null);
  const total = toBig(s.totalMinor);
  const cats = s.byCategory;
  if (!cats.length) return null;
  const slices = cats.map((c, i) => ({
    id: c.category,
    color: rampColor(i),
    pct: total > 0n ? Number((toBig(c.totalMinor) * 10000n) / total) / 10000 : 0,
    label: CATEGORY_LABEL[c.category],
  }));
  return (
    <SectionCard>
      <SectionLabel>{t("groupThread.insights.byCategory")}</SectionLabel>
      <div className="mt-3 flex items-center gap-[18px]">
        <SpendingDonut slices={slices} size={112} thickness={24} centerValue={money(s.totalMinor, cur)} centerLabel={t("groupThread.insights.spent")} selectedId={sel} onSlicePress={(id) => setSel((c) => (c === id ? null : id))} />
        <ul className="flex min-w-0 flex-1 flex-col gap-[7px]">
          {cats.map((c, i) => {
            const dim = sel !== null && sel !== c.category;
            return (
              <li key={c.category}>
                <button type="button" onClick={() => setSel((x) => (x === c.category ? null : c.category))} className={`-mx-1.5 flex w-[calc(100%+12px)] items-center gap-2 rounded-[10px] px-1.5 py-1 text-left hover:bg-white/[0.06] ${dim ? "opacity-50" : ""}`}>
                  <span className="h-[9px] w-[9px] shrink-0 rounded-[2px]" style={{ backgroundColor: rampColor(i) }} />
                  <Ion name={CATEGORY_ICON[c.category]} size={13} className="shrink-0 text-white/60" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/[0.85]">{CATEGORY_LABEL[c.category]}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">{money(c.totalMinor, cur)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <Note className="!mt-3">{t("groupThread.insights.otherNote")}</Note>
    </SectionCard>
  );
}

/* ── People ──────────────────────────────────────────────────────── */

function People({ s, cur, byId, nameOf, meId }: { s: GroupStats; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf; meId: string | null }) {
  const t = useT();
  const rows = [...s.byMember].sort((a, b) => (a.userId === meId ? -1 : b.userId === meId ? 1 : toBig(b.paidMinor) > toBig(a.paidMinor) ? 1 : -1));
  const f = fractions(rows.flatMap((r) => [r.paidMinor, r.shareMinor]));
  if (!rows.length) return null;
  return (
    <SectionCard>
      <SectionLabel>{t("groupThread.insights.byPerson")}</SectionLabel>
      <div className="mt-2 flex items-center gap-4 text-[11.5px] font-semibold text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white/85" />
          {t("groupThread.insights.paid")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
          {t("groupThread.insights.theirShare")}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-3.5">
        {rows.map((r, i) => {
          const net = toBig(r.netMinor);
          return (
            <li key={r.userId} className="flex min-w-0 items-center gap-3">
              <PersonFace person={byId.get(r.userId)} size={32} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className={`truncate text-[14px] text-white ${r.userId === meId ? "font-extrabold" : "font-bold"}`}>{nameOf(r.userId)}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-white/60">
                    {net > 0n
                      ? t("groupThread.insights.isOwed", { amount: money(r.netMinor, cur) })
                      : net < 0n
                        ? t("groupThread.insights.owes", { amount: money(absMinor(r.netMinor), cur) })
                        : t("groupThread.insights.settled")}
                  </span>
                </span>
                <Bar frac={f[i * 2]} color="rgba(255,255,255,0.85)" label={t("groupThread.insights.paidAmount", { amount: money(r.paidMinor, cur) })} />
                <Bar frac={f[i * 2 + 1]} color={GREEN} label={t("groupThread.insights.shareAmount", { amount: money(r.shareMinor, cur) })} />
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function Bar({ frac, color, label }: { frac: number; color: string; label: string }) {
  return (
    <span className="flex items-center gap-2" title={label}>
      <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-white/[0.06]">
        <span className="block h-full rounded-[3px]" style={{ width: `${Math.max(frac * 100, frac > 0 ? 1.5 : 0)}%`, background: color }} />
      </span>
      <span className="w-[112px] shrink-0 truncate text-right text-[11.5px] tabular-nums text-white/65">{label}</span>
    </span>
  );
}

/* ── Settle plan ─────────────────────────────────────────────────── */

function Plan({ s, cur, byId, nameOf, meId, threadHref }: { s: GroupStats; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf; meId: string | null; threadHref: string }) {
  const t = useT();
  const bold = { b: (c: ReactNode) => <b className="text-white">{c}</b> };
  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <SectionLabel>{t("groupThread.insights.plan")}</SectionLabel>
        {s.plan.length ? (
          <Link href={threadHref} className="inline-flex items-center gap-1 text-[12px] font-bold text-white/70 hover:text-white">
            {t("groupThread.insights.inTheGroup")}
            <Ion name="chevron-forward" size={13} />
          </Link>
        ) : null}
      </div>
      {s.plan.length ? (
        <ul className="mt-2 flex flex-col">
          {s.plan.map((p) => {
            const mine = p.fromUserId === meId || p.toUserId === meId;
            return (
              <li key={`${p.fromUserId}:${p.toUserId}`} className={`-mx-1.5 flex min-h-[42px] items-center gap-2 rounded-[10px] px-1.5 ${mine ? "bg-white/[0.07]" : ""}`}>
                <PersonFace person={byId.get(p.fromUserId)} size={24} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/85">
                  {p.fromUserId === meId ? (
                    <Rich k="groupThread.insights.youPay" vars={{ from: nameOf(p.fromUserId), to: nameOf(p.toUserId) }} tags={bold} />
                  ) : p.toUserId === meId ? (
                    <Rich k="groupThread.insights.paysYou" vars={{ from: nameOf(p.fromUserId) }} tags={bold} />
                  ) : (
                    <Rich k="groupThread.insights.pays" vars={{ from: nameOf(p.fromUserId), to: nameOf(p.toUserId) }} tags={bold} />
                  )}
                </span>
                <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-white">{money(p.amountMinor, cur)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-white/70">
          <Ion name="checkmark-circle-outline" size={17} style={{ color: GREEN }} />
          {t("groupThread.insights.planEmpty")}
        </p>
      )}
      {s.plan.length ? <p className="mt-2 text-[12px] text-white/50">{t("groupThread.insights.planNote")}</p> : null}
    </SectionCard>
  );
}
