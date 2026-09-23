/**
 * A group's numbers (GET /groups/:id/stats) and yours across every group
 * (GET /groups/stats), contract §10.5, read tolerantly: the backend for these
 * is being built alongside this screen, so every field may be absent from an
 * older answer and reads as zero or empty, never as a crash.
 *
 * Every amount is minor units in ONE currency: the group's for a group, and
 * per currency across groups. Nothing here ever adds two currencies together.
 *
 * Nothing React and only type imports, so `npx sucrase-node` can check it.
 */

import { asCategory, toBig, type ExpenseCategory } from "./groups-rules";

export interface MonthRow {
  /** YYYY-MM, UTC. */
  month: string;
  totalMinor: string;
  count: number;
  yourShareMinor: string;
}

export interface CategoryRow {
  category: ExpenseCategory;
  totalMinor: string;
  count: number;
}

export interface MemberRow {
  userId: string;
  paidMinor: string;
  shareMinor: string;
  settledOutMinor: string;
  settledInMinor: string;
  /** > 0: the group owes them. All time. */
  netMinor: string;
}

export interface TopExpense {
  expenseId: string;
  description: string | null;
  groupMinor: string;
  spentAt: string | null;
  payerUserId: string;
  category: ExpenseCategory | null;
}

export interface GroupStats {
  currency: string;
  from: string | null;
  to: string | null;
  totalMinor: string;
  expenseCount: number;
  byMonth: MonthRow[];
  byCategory: CategoryRow[];
  byMember: MemberRow[];
  you: { paidMinor: string; shareMinor: string; netMinor: string; withEach: { userId: string; netMinor: string }[] };
  plan: { fromUserId: string; toUserId: string; amountMinor: string }[];
  topExpenses: TopExpense[];
  averagePerPersonMinor: string;
  biggestMonth: string | null;
}

export interface AllGroupsStats {
  totals: { currency: string; youOweMinor: string; owedToYouMinor: string; yourShareMinor: string; paidMinor: string }[];
  groups: { groupId: string; name: string; currency: string; netMinor: string; lastActivityAt: string | null }[];
  byMonth: { month: string; currency: string; yourShareMinor: string }[];
}

/* ── Reading the wire ─────────────────────────────────────────────── */

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Minor units as a string; a number is accepted (an older or sloppier answer), anything else is "0". */
const minor = (v: unknown): string => {
  if (typeof v === "string" && /^-?\d+$/.test(v)) return v;
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  return "0";
};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);
const ccy = (v: unknown, fallback = "USD"): string => (typeof v === "string" && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : fallback);
const monthKey = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? v : null);

export function normaliseGroupStats(raw: unknown, groupCurrency = "USD"): GroupStats {
  const r = obj(raw);
  const you = obj(r.you);
  return {
    currency: ccy(r.currency, groupCurrency),
    from: monthKey(r.from),
    to: monthKey(r.to),
    totalMinor: minor(r.totalMinor),
    expenseCount: int(r.expenseCount),
    byMonth: arr(r.byMonth)
      .map(obj)
      .filter((m) => monthKey(m.month))
      .map((m) => ({ month: m.month as string, totalMinor: minor(m.totalMinor), count: int(m.count), yourShareMinor: minor(m.yourShareMinor) }))
      .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0)),
    byCategory: arr(r.byCategory)
      .map(obj)
      .map((c) => ({ category: asCategory(c.category) ?? "other", totalMinor: minor(c.totalMinor), count: int(c.count) }))
      // Unknown categories and "other" fold together, so "Other" is listed once.
      .reduce<CategoryRow[]>((out, c) => {
        const same = out.find((x) => x.category === c.category);
        if (same) {
          same.totalMinor = (toBig(same.totalMinor) + toBig(c.totalMinor)).toString();
          same.count += c.count;
        } else out.push({ ...c });
        return out;
      }, [])
      .filter((c) => toBig(c.totalMinor) > 0n)
      .sort((a, b) => cmpDesc(a.totalMinor, b.totalMinor)),
    byMember: arr(r.byMember)
      .map(obj)
      .filter((m) => str(m.userId))
      .map((m) => ({
        userId: m.userId as string,
        paidMinor: minor(m.paidMinor),
        shareMinor: minor(m.shareMinor),
        settledOutMinor: minor(m.settledOutMinor),
        settledInMinor: minor(m.settledInMinor),
        netMinor: minor(m.netMinor),
      })),
    you: {
      paidMinor: minor(you.paidMinor),
      shareMinor: minor(you.shareMinor),
      netMinor: minor(you.netMinor),
      withEach: arr(you.withEach)
        .map(obj)
        .filter((w) => str(w.userId))
        .map((w) => ({ userId: w.userId as string, netMinor: minor(w.netMinor) })),
    },
    plan: arr(r.plan)
      .map(obj)
      .filter((p) => str(p.fromUserId) && str(p.toUserId))
      .map((p) => ({ fromUserId: p.fromUserId as string, toUserId: p.toUserId as string, amountMinor: minor(p.amountMinor) }))
      .filter((p) => toBig(p.amountMinor) > 0n),
    topExpenses: arr(r.topExpenses)
      .map(obj)
      .filter((e) => str(e.expenseId))
      .map((e) => ({
        expenseId: e.expenseId as string,
        description: str(e.description),
        groupMinor: minor(e.groupMinor),
        spentAt: str(e.spentAt),
        payerUserId: str(e.payerUserId) ?? "",
        category: asCategory(e.category),
      })),
    averagePerPersonMinor: minor(r.averagePerPersonMinor),
    biggestMonth: monthKey(r.biggestMonth),
  };
}

export function normaliseAllStats(raw: unknown): AllGroupsStats {
  const r = obj(raw);
  return {
    totals: arr(r.totals)
      .map(obj)
      .filter((t) => typeof t.currency === "string")
      .map((t) => ({
        currency: ccy(t.currency),
        youOweMinor: minor(t.youOweMinor),
        owedToYouMinor: minor(t.owedToYouMinor),
        yourShareMinor: minor(t.yourShareMinor),
        paidMinor: minor(t.paidMinor),
      })),
    groups: arr(r.groups)
      .map(obj)
      .filter((g) => str(g.groupId))
      .map((g) => ({ groupId: g.groupId as string, name: str(g.name) ?? "Group", currency: ccy(g.currency), netMinor: minor(g.netMinor), lastActivityAt: str(g.lastActivityAt) })),
    byMonth: arr(r.byMonth)
      .map(obj)
      .filter((m) => monthKey(m.month) && typeof m.currency === "string")
      .map((m) => ({ month: m.month as string, currency: ccy(m.currency), yourShareMinor: minor(m.yourShareMinor) })),
  };
}

/* ── What the screen draws ────────────────────────────────────────── */

function cmpDesc(a: string, b: string): number {
  const x = toBig(a);
  const y = toBig(b);
  return x === y ? 0 : x > y ? -1 : 1;
}

/** Each value as a fraction of the largest (0 to 1); all zero when nothing is above zero. */
export function fractions(values: readonly (string | bigint)[]): number[] {
  const big = values.map((v) => (typeof v === "bigint" ? v : toBig(v)));
  const max = big.reduce((m, v) => (v > m ? v : m), 0n);
  if (max <= 0n) return big.map(() => 0);
  // Four decimals of a fraction is plenty for a bar, and stays exact in BigInt until the last step.
  return big.map((v) => (v <= 0n ? 0 : Number((v * 10000n) / max) / 10000));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" as "Sep", or "Sep 2026" with the year. */
export function monthLabel(month: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const name = MONTHS[Number(m[2]) - 1] ?? m[2];
  return withYear ? `${name} ${m[1]}` : name;
}

/** The range the pills ask for: the last `months` months, this one included, as the server's YYYY-MM. */
export function lastMonths(months: number, now: Date = new Date()): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const start = new Date(Date.UTC(y, mo - (months - 1), 1));
  const k = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from: k(start), to: k(new Date(Date.UTC(y, mo, 1))) };
}

/**
 * The "You" card's pair-by-pair lines (you.withEach, direct balances, not the
 * smart-settle plan): who owes you, biggest first, then whom you owe, biggest
 * first. Zero pairs are left out. `owed` and `owe` are their sums.
 */
export function pairLines(withEach: readonly { userId: string; netMinor: string }[]): {
  owesYou: { userId: string; minor: string }[];
  youOwe: { userId: string; minor: string }[];
  owed: string;
  owe: string;
} {
  const owesYou = withEach.filter((w) => toBig(w.netMinor) > 0n).map((w) => ({ userId: w.userId, minor: w.netMinor }));
  const youOwe = withEach.filter((w) => toBig(w.netMinor) < 0n).map((w) => ({ userId: w.userId, minor: (-toBig(w.netMinor)).toString() }));
  owesYou.sort((a, b) => cmpDesc(a.minor, b.minor));
  youOwe.sort((a, b) => cmpDesc(a.minor, b.minor));
  return {
    owesYou,
    youOwe,
    owed: owesYou.reduce((a, x) => a + toBig(x.minor), 0n).toString(),
    owe: youOwe.reduce((a, x) => a + toBig(x.minor), 0n).toString(),
  };
}

/** Which month labels fit under the bars: every one up to 6, else every other, else about six evenly, always the last. */
export function labelledMonths(count: number): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const step = count <= 6 ? 1 : count <= 12 ? 2 : Math.ceil(count / 6);
  for (let i = count - 1; i >= 0; i -= step) out.add(i);
  return out;
}

/** Your share per month of one currency across groups, oldest first, as `fractions` wants it. */
export function monthsOf(byMonth: AllGroupsStats["byMonth"], currency: string): { month: string; yourShareMinor: string }[] {
  const by = new Map<string, bigint>();
  for (const m of byMonth) if (m.currency === currency) by.set(m.month, (by.get(m.month) ?? 0n) + toBig(m.yourShareMinor));
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, v]) => ({ month, yourShareMinor: v.toString() }));
}
