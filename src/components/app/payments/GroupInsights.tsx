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
import { useMemo, useState } from "react";

import {
  absMinor,
  CATEGORY_LABEL,
  fractions,
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
import { rampColor } from "@/lib/app/spending/categories";
import { useMe } from "@/lib/app/spaces-data";

import { SectionCard, SectionLabel, Note, SpendingDonut, glassCard, glassHero, GREEN } from "../analytics/parts";
import { useProductHref } from "../base";
import { BackHeader, Column } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { money } from "./AddExpense";
import { ExpenseDetail } from "./GroupExpense";
import { CATEGORY_ICON, LoadFailed, PersonFace } from "./group-kit";

const RANGES = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
  { months: 36, label: "3 years" },
] as const;

const TOTAL_BAR = "rgba(255,255,255,0.22)";

export function GroupInsights({ groupId }: { groupId: string }) {
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
  const nameOf = (id: string) => (id === meId ? "You" : byId.get(id) ? memberName(byId.get(id)) : members.data ? "Former member" : "Someone");
  const s = stats.data;
  const cur = s?.currency ?? (info.data?.currency ?? "USD").toUpperCase();

  return (
    <Column>
      <BackHeader title="Insights" subtitle={info.data?.name ?? undefined} backHref={href(`/payments/groups/${encodeURIComponent(groupId)}`)} />

      <div role="radiogroup" aria-label="Range" className="mt-1 flex gap-2">
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
              {r.label}
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
          <LoadFailed words="Insights didn't load. If this keeps happening, HOLD's servers may not have them yet." onRetry={() => void stats.mutate()} />
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
              <p className="py-4 text-center text-[13.5px] text-white/60">No expenses in this range yet.</p>
            </SectionCard>
          )}
          <Plan s={s} cur={cur} byId={byId} nameOf={nameOf} meId={meId} threadHref={href(`/payments/groups/${encodeURIComponent(groupId)}`)} />
          {s.topExpenses.length ? (
            <SectionCard>
              <SectionLabel>BIGGEST EXPENSES</SectionLabel>
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
                          <span className="truncate text-[14px] font-bold text-white">{e.description?.trim() || "Expense"}</span>
                          <span className="truncate text-[12px] text-white/55">
                            {nameOf(e.payerUserId)} paid{e.spentAt ? ` · ${new Date(e.spentAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
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
          <Note>Every amount is in {cur}, from live expenses and settlements. Balances are all time; the rest is the range above.</Note>
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
  return (
    <>
      <section className={`${glassHero} mt-3 rounded-[24px] px-5 py-5`}>
        <p className="text-[11px] font-bold tracking-[1.5px] text-white/65">
          {s.from && s.to ? `${monthLabel(s.from, true)} – ${monthLabel(s.to, true)}`.toUpperCase() : "SPENT"}
        </p>
        <p className="mt-2 whitespace-nowrap text-[clamp(32px,11vw,44px)] font-bold leading-[1.1] tabular-nums text-white">{money(s.totalMinor, cur)}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-white/55">
          Spent together · {s.expenseCount} {s.expenseCount === 1 ? "expense" : "expenses"}
        </p>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile label="Average per person" value={money(s.averagePerPersonMinor, cur)} />
        <Tile label="Biggest month" value={s.biggestMonth ? monthLabel(s.biggestMonth, true) : "–"} />
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
  const net = toBig(s.you.netMinor);
  const pairs = pairLines(s.you.withEach);
  return (
    <SectionCard>
      <SectionLabel>YOU</SectionLabel>
      <p className="mt-2 text-[24px] font-bold tracking-[-0.5px] tabular-nums" style={{ color: net > 0n ? GREEN : "#fff" }}>
        {net > 0n ? `You're owed ${money(s.you.netMinor, cur)}` : net < 0n ? `You owe ${money(absMinor(s.you.netMinor), cur)}` : "All settled up"}
      </p>
      <div className="mt-2 flex justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold text-white/55">You paid</p>
          <p className="mt-px truncate text-[15px] font-bold tabular-nums text-white">{money(s.you.paidMinor, cur)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11.5px] font-semibold text-white/55">Your share</p>
          <p className="mt-px truncate text-[15px] font-bold tabular-nums text-white">{money(s.you.shareMinor, cur)}</p>
        </div>
      </div>

      {pairs.owesYou.length || pairs.youOwe.length ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-3">
          {pairs.owesYou.length ? (
            <PairList title={`Owe you · ${money(pairs.owed, cur)}`} rows={pairs.owesYou} cur={cur} byId={byId} nameOf={nameOf} green />
          ) : null}
          {pairs.youOwe.length ? <PairList title={`You owe · ${money(pairs.owe, cur)}`} rows={pairs.youOwe} cur={cur} byId={byId} nameOf={nameOf} /> : null}
          <p className="text-[12px] leading-[17px] text-white/50">Pair by pair, between you and each person. Settling up may net these across the group.</p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function PairList({ title, rows, cur, byId, nameOf, green = false }: { title: string; rows: { userId: string; minor: string }[]; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf; green?: boolean }) {
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
        <SectionLabel>BY MONTH</SectionLabel>
        <button type="button" onClick={() => setAsList((v) => !v)} className="text-[12px] font-bold text-white/70 hover:text-white">
          {asList ? "Chart" : "List"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11.5px] font-semibold text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TOTAL_BAR }} />
          The group
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
          Your share
        </span>
      </div>

      {asList ? (
        <ul className="mt-3 flex flex-col">
          {[...rows].reverse().map((m) => (
            <li key={m.month} className="flex min-h-[36px] items-center gap-3 border-b border-white/[0.06] text-[13px] last:border-0">
              <span className="w-20 shrink-0 font-semibold text-white/80">{monthLabel(m.month, true)}</span>
              <span className="min-w-0 flex-1 text-white/55">{m.count} {m.count === 1 ? "expense" : "expenses"}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-bold text-white">{money(m.totalMinor, cur)}</span>
                <span className="block text-[11.5px] text-white/55">yours {money(m.yourShareMinor, cur)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="relative mt-3 h-5 text-[12px] tabular-nums text-white/80" aria-live="polite">
            {shown ? (
              <span>
                <b className="text-white">{monthLabel(shown.month, true)}</b> · {money(shown.totalMinor, cur)} · yours {money(shown.yourShareMinor, cur)} · {shown.count} {shown.count === 1 ? "expense" : "expenses"}
              </span>
            ) : (
              <span className="text-white/45">Tap a month for its numbers</span>
            )}
          </div>
          <div className="mt-2 flex items-end gap-[2px] border-b border-white/[0.1]" style={{ height: H }} onPointerLeave={() => setHover(null)} role="img" aria-label="Spent per month, with your share">
            {rows.map((m, i) => (
              <button
                key={m.month}
                type="button"
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${monthLabel(m.month, true)}: ${money(m.totalMinor, cur)}, your share ${money(m.yourShareMinor, cur)}`}
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
      <SectionLabel>BY CATEGORY</SectionLabel>
      <div className="mt-3 flex items-center gap-[18px]">
        <SpendingDonut slices={slices} size={112} thickness={24} centerValue={money(s.totalMinor, cur)} centerLabel="Spent" selectedId={sel} onSlicePress={(id) => setSel((c) => (c === id ? null : id))} />
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
      <Note className="!mt-3">Expenses with no category count as Other.</Note>
    </SectionCard>
  );
}

/* ── People ──────────────────────────────────────────────────────── */

function People({ s, cur, byId, nameOf, meId }: { s: GroupStats; cur: string; byId: Map<string, GroupMember>; nameOf: NameOf; meId: string | null }) {
  const rows = [...s.byMember].sort((a, b) => (a.userId === meId ? -1 : b.userId === meId ? 1 : toBig(b.paidMinor) > toBig(a.paidMinor) ? 1 : -1));
  const f = fractions(rows.flatMap((r) => [r.paidMinor, r.shareMinor]));
  if (!rows.length) return null;
  return (
    <SectionCard>
      <SectionLabel>WHO PAID, WHO SHARED</SectionLabel>
      <div className="mt-2 flex items-center gap-4 text-[11.5px] font-semibold text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white/85" />
          Paid
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREEN }} />
          Their share
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
                    {net > 0n ? `is owed ${money(r.netMinor, cur)}` : net < 0n ? `owes ${money(absMinor(r.netMinor), cur)}` : "settled"}
                  </span>
                </span>
                <Bar frac={f[i * 2]} color="rgba(255,255,255,0.85)" label={`Paid ${money(r.paidMinor, cur)}`} />
                <Bar frac={f[i * 2 + 1]} color={GREEN} label={`Share ${money(r.shareMinor, cur)}`} />
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
  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <SectionLabel>TO SETTLE UP</SectionLabel>
        {s.plan.length ? (
          <Link href={threadHref} className="inline-flex items-center gap-1 text-[12px] font-bold text-white/70 hover:text-white">
            In the group
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
                  <b className="text-white">{nameOf(p.fromUserId)}</b> {p.fromUserId === meId ? "pay" : "pays"} <b className="text-white">{p.toUserId === meId ? "you" : nameOf(p.toUserId)}</b>
                </span>
                <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-white">{money(p.amountMinor, cur)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-white/70">
          <Ion name="checkmark-circle-outline" size={17} style={{ color: GREEN }} />
          Everyone is settled up.
        </p>
      )}
      {s.plan.length ? <p className="mt-2 text-[12px] text-white/50">Nobody is made to pay: these are requests until paid or marked as paid.</p> : null}
    </SectionCard>
  );
}
