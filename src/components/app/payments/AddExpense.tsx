"use client";

/**
 * Adding an expense, the way Revolut splits a bill, in three screens inside
 * one full-height modal (a pushed screen on a phone, a tall dialog on a
 * desktop):
 *
 *   Select bill      your own money going out, grouped Today / Yesterday /
 *                    the day: transfers and card spend from GET /transfers,
 *                    paid stays from GET /travel/bookings (lib/app/group-bills).
 *                    Tick one or several; what you picked, and any bill you
 *                    typed, sits as chips across the top with an ×. Anything
 *                    already split in a group is greyed out with "Split in
 *                    <group>" (GET /groups/sources/used). Continue · N
 *   Custom bill      a big amount with a caret, the currency pill (a picker
 *                    sheet), "Add description", Continue, and a calculator
 *                    keypad (+ − × ÷ =) over the digits, with the locale's
 *                    decimal separator. On a desktop the keyboard types too
 *   Split bill       the bill, "Paid by you ▾" (a sheet of the members), the
 *                    tabs Amount | Percent | Share, a row per member with a
 *                    tick, the face and the value underlined on the right, a
 *                    live "left to assign", and then place, date and an
 *                    optional receipt photo. "Split with group" wakes only when
 *                    the split adds up
 *
 * SEVERAL BILLS, ONE EXPENSE (contract §10.1)
 *
 * The person who paid everything adds it all at once: bills picked from their
 * activity, and as many typed ones as they like ("Add another bill" on Split
 * bill opens the keypad and comes back). Split bill lists every bill with its
 * amount, a × to take it out, and the running total. One currency adds up in
 * it; several are converted into the group's currency with GET /groups/fx and
 * shown with "≈" (billsTotal), the server having the last word. They go as
 * `items`, a picked one naming its `sources` entry so nothing is split twice.
 * An expense holds up to 50 bills and names up to 20 payments; past that the
 * screen says to add another expense, of which there is no limit.
 *
 * Select bill reads your activity 200 at a time with "Load older" for more,
 * and says how many payments in a token with no recorded dollar value were
 * left out rather than priced by a guess.
 *
 * A category (§10.2) is a row of chips on Split bill; a stay bill makes it
 * Stay until somebody picks another.
 *
 * Amount, the Revolut way: a typed amount stays, and what is left is shared
 * equally between the rest (autoFillAmounts). Untouched, it is sent as an
 * equal split (so the server's own remainder rule applies); touched, as exact
 * amounts. Percent must reach 100; Share is whole-number weights.
 *
 * Editing opens straight on Split bill, prefilled from `splitInputs` and its
 * bills (`items`); the same list, keypad and activity picker change it. Only
 * the payer edits, and the payer is fixed. A lock by settlement (`409
 * expense_locked_by_settlement`) is explained in a sheet that offers to delete
 * it and add it again with what was typed.
 *
 * The three screens stay mounted once seen (only the one in front is shown),
 * so going to the keypad for another bill and back keeps the split, the
 * details and the older activity already loaded.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { billsFrom, groupByDay, searchBills, unpricedCount, type BillRow } from "@/lib/app/group-bills";
import {
  addExpense,
  autoFillAmounts,
  billsTitle,
  billsTotal,
  bpText,
  CATEGORY_LABEL,
  EXPENSE_CATEGORIES,
  expenseBills,
  expenseCategory,
  itemsBody,
  MAX_ITEMS,
  MAX_SOURCES,
  useFxRates,
  type BillsTotal,
  type ExpenseCategory,
  checkSplit,
  deleteExpense,
  describeGroupError,
  displayExpression,
  evaluate,
  evenPercents,
  formatMinor,
  hasOperator,
  isoToDateInput,
  memberName,
  minorExponent,
  minorToInput,
  minorToPlain,
  newClientKey,
  parseMajorAllowZero,
  pressKey,
  splitBody,
  toBig,
  todayLocal,
  updateExpense,
  uploadReceipt,
  useUsedSources,
  type Bill,
  type CalcKey,
  type Expense,
  type ExpenseSource,
  type GroupMember,
  type SplitMode,
  type UsedSource,
} from "@/lib/app/groups";
import { getTransfers, HoldApiError, type Transfer } from "@/lib/app/hold-api";
import { useTransfers } from "@/lib/app/money";
import { useTrips } from "@/lib/app/stays-data";

import { Notice } from "../hold";
import { Ion, type IonName } from "../ion";
import { Modal, ModalChoice } from "../Modal";
import { Skeleton } from "../ui";
import { CATEGORY_ICON, COMMON_CURRENCIES, PersonFace, PhotoButton, pillGlass, plateCaution, plateWhite, useObjectUrl } from "./group-kit";

/** Your activity is read this many at a time; "Load older" reads the next. */
const PAGE = 200;

/* ── Money on screen ──────────────────────────────────────────────── */

/** The browser's decimal separator: "," in Spain, "." in the US. */
function useDecimal(): string {
  return useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
    } catch {
      return ".";
    }
  }, []);
}

/** "€", "$", "MX$": the narrow symbol, else the code. */
export function currencySymbol(currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Minor units in the viewer's own format: "1,29 €" in Spain, "€1.29" in the US. */
export function money(minor: string | bigint, currency: string, sign = ""): string {
  const plain = formatMinor(minor, currency).replace(/,/g, "");
  const exp = minorExponent(currency);
  try {
    return `${sign}${new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: exp, maximumFractionDigits: exp }).format(Number(plain))}`;
  } catch {
    return `${sign}${plain} ${currency}`;
  }
}

/* ── Pieces the three screens share ───────────────────────────────── */

const backBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-[22px] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.14]";
const bigTitle = "text-[32px] font-extrabold leading-[38px] tracking-[-0.8px] text-white";
const card = "rounded-[24px] bg-white/[0.06]";
const plateBig =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-[28px] bg-[#F1F5F9] text-[16.5px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/[0.12] disabled:text-white/45";

function Top({ onBack, title, backLabel = "Back" }: { onBack: () => void; title?: string; backLabel?: string }) {
  return (
    <div className="relative flex h-14 shrink-0 items-center">
      <button type="button" onClick={onBack} aria-label={backLabel} className={backBtn}>
        <Ion name="arrow-back" size={20} />
      </button>
      {title ? <p className="pointer-events-none absolute inset-x-14 truncate text-center text-[16.5px] font-extrabold text-white">{title}</p> : null}
    </div>
  );
}

function Tick({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] transition-colors ${
        on ? "bg-[#F1F5F9] text-[#0A1420]" : disabled ? "border-2 border-white/[0.12]" : "border-2 border-white/30"
      }`}
    >
      {on ? <Ion name="checkmark" size={16} /> : null}
    </span>
  );
}

const KIND_ICON: Record<Bill["kind"], IonName> = { transfer: "arrow-forward", card: "card-outline", stay: "bed-outline", custom: "document-text-outline" };

/** A bill's face: the counterparty's photo or emoji when the ledger has one, else an icon for what it is. */
function BillFace({ bill, size = 48 }: { bill: Bill & { avatarUrl?: string | null; emoji?: string | null }; size?: number }) {
  const [broken, setBroken] = useState(false);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (bill.avatarUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={bill.avatarUrl} alt="" style={round} onError={() => setBroken(true)} className="shrink-0 object-cover" />;
  }
  if (bill.emoji) {
    return (
      <span style={{ ...round, fontSize: size * 0.5 }} className="flex shrink-0 items-center justify-center bg-white/[0.1]" aria-hidden>
        {bill.emoji}
      </span>
    );
  }
  const custom = bill.kind === "custom";
  return (
    <span style={round} className={`flex shrink-0 items-center justify-center ${custom ? "bg-amber text-[#0A1420]" : "bg-white/[0.1] text-white"}`} aria-hidden>
      <Ion name={KIND_ICON[bill.kind]} size={Math.round(size * 0.44)} />
    </span>
  );
}

/* ── The flow ─────────────────────────────────────────────────────── */

type Step = "select" | "custom" | "split";

/** An expense's bills, as the flow holds them: its items, else its one amount as a typed bill. */
function billsOfExpense(e: Expense): Bill[] {
  const items = expenseBills(e);
  if (!items.length) {
    return [{ key: "custom:edit", kind: "custom", label: e.description?.trim() || "Expense", amountMinor: e.amountMinor, currency: e.currency.toUpperCase() }];
  }
  return items.map((it, i): Bill => {
    if (it.sourceKind && it.sourceRef) {
      const src = (e.sources ?? []).find((s) => s.kind === it.sourceKind && s.ref === it.sourceRef);
      return { key: `${it.sourceKind}:${it.sourceRef}`, kind: it.sourceKind, ref: it.sourceRef, label: it.label, amountMinor: it.amountMinor, currency: it.currency.toUpperCase(), occurredAt: src?.occurredAt ?? undefined };
    }
    return { key: `custom:item${i}`, kind: "custom", label: it.label, amountMinor: it.amountMinor, currency: it.currency.toUpperCase() };
  });
}

/** The bills' total, converted with today's rates when they are in several currencies. */
function useBillsTotal(bills: readonly Bill[], groupCurrency: string): { total: BillsTotal; converting: boolean; fxFailed: boolean } {
  const currencies = [...new Set(bills.map((b) => b.currency.toUpperCase()))];
  const fx = useFxRates(groupCurrency, currencies.length > 1 ? currencies : []);
  const total = billsTotal(bills, groupCurrency, fx.rates);
  return { total, converting: fx.loading, fxFailed: currencies.length > 1 && !!fx.error };
}

export function AddExpenseFlow({
  groupId,
  groupCurrency,
  members,
  meId,
  existing,
  onClose,
  onSaved,
}: {
  groupId: string;
  groupCurrency: string;
  members: GroupMember[];
  meId: string | null;
  /** Editing this one; absent to add. */
  existing?: Expense;
  onClose: () => void;
  /** Saved: the expense's id (a new one after delete-and-re-add). */
  onSaved: (expenseId: string) => void;
}) {
  const [editing, setEditing] = useState<Expense | undefined>(existing);
  const [step, setStep] = useState<Step>(existing ? "split" : "select");
  const [bills, setBills] = useState<Bill[]>(() => (existing ? billsOfExpense(existing) : []));
  /** The typed bill being changed; null for a new one. */
  const [customKey, setCustomKey] = useState<string | null>(null);
  /** Where the keypad and the activity picker go back to. */
  const [customReturn, setCustomReturn] = useState<"select" | "split">(existing ? "split" : "select");
  const [selectReturn, setSelectReturn] = useState<"close" | "split">(existing ? "split" : "close");
  const [seen, setSeen] = useState<{ select: boolean; split: boolean }>({ select: !existing, split: !!existing });
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);
  const [taken, setTaken] = useState<UsedSource[]>([]);
  const [selectNotice, setSelectNotice] = useState<string | null>(null);
  const totals = useBillsTotal(bills, groupCurrency);

  const go = (next: Step) => {
    setStep(next);
    if (next === "select" || next === "split") setSeen((v) => ({ ...v, [next]: true }));
  };

  const saveCustom = (b: { amountMinor: string; currency: string; label: string }) => {
    if (customKey) setBills((xs) => xs.map((x) => (x.key === customKey ? { ...x, ...b } : x)));
    else {
      counter.current += 1;
      setBills((xs) => [...xs, { key: `custom:${counter.current}`, kind: "custom", ...b }]);
    }
    setCustomKey(null);
    go(customReturn);
  };

  const openCustom = (key: string | null, from: "select" | "split") => {
    setCustomKey(key);
    setCustomReturn(from);
    go("custom");
  };

  const back = () => {
    if (busy) return;
    if (step === "custom") go(customReturn);
    else if (step === "select") (selectReturn === "split" ? go("split") : onClose());
    else if (step === "split" && !editing) go("select");
    else onClose();
  };

  const editingCustom = customKey ? bills.find((b) => b.key === customKey) : undefined;
  const toggle = (b: Bill) => setBills((xs) => (xs.some((x) => x.key === b.key) ? xs.filter((x) => x.key !== b.key) : [...xs, b]));
  const remove = (key: string) => setBills((xs) => xs.filter((x) => x.key !== key));

  return (
    <Modal onClose={onClose} title={editing ? "Edit expense" : "Add expense"} hideTitle size="full" showClose={false} busy={busy}>
      {seen.select ? (
        <div className={step === "select" ? "flex shrink-0 flex-1 flex-col" : "hidden"}>
          <SelectBill
            picked={bills}
            onToggle={toggle}
            onRemove={remove}
            onCustom={(key) => openCustom(key, "select")}
            onBack={back}
            backLabel={selectReturn === "split" ? "Back" : "Close"}
            onContinue={() => go("split")}
            taken={taken}
            notice={selectNotice}
            ownExpenseId={editing?.id ?? null}
            totals={totals}
          />
        </div>
      ) : null}
      {step === "custom" ? (
        <CustomBill
          initial={editingCustom}
          defaultCurrency={bills[bills.length - 1]?.currency ?? groupCurrency}
          title={editingCustom ? (editing && bills.length === 1 ? "Amount" : "Change bill") : bills.length ? "Add another bill" : "Create custom bill"}
          onBack={back}
          onDone={saveCustom}
        />
      ) : null}
      {seen.split ? (
        <div className={step === "split" ? "flex shrink-0 flex-1 flex-col" : "hidden"}>
          <SplitBill
            groupId={groupId}
            groupCurrency={groupCurrency}
            members={members}
            meId={meId}
            bills={bills}
            totals={totals}
            editing={editing}
            onBack={back}
            onChangeBill={(key) => openCustom(key, "split")}
            onAddBill={() => openCustom(null, "split")}
            onAddFromActivity={() => {
              setSelectReturn("split");
              setSelectNotice(null);
              go("select");
            }}
            onRemoveBill={remove}
            busy={busy}
            setBusy={setBusy}
            onSaved={onSaved}
            onReAdd={() => setEditing(undefined)}
            onSourceTaken={(used) => {
              setTaken((t) => [...t, used]);
              setBills((xs) => xs.filter((x) => x.ref !== used.ref));
              setSelectNotice("One of those was just split in a group, so it's been taken out. Pick again.");
              go("select");
            }}
          />
        </div>
      ) : null}
    </Modal>
  );
}

/* ── 1. Select bill ───────────────────────────────────────────────── */

/**
 * Your activity, the first page from the shared read and every older page
 * this screen asked for with "Load older". Pages are by offset, so a payment
 * that lands meanwhile can show twice across pages: billsFrom keeps each once.
 */
function useActivityPages() {
  const first = useTransfers(PAGE, 0);
  const [older, setOlder] = useState<{ transfers: Transfer[]; hasMore: boolean; next: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const all = useMemo(() => [...(first.data?.transfers ?? []), ...(older?.transfers ?? [])], [first.data, older]);
  const hasMore = older ? older.hasMore : !!first.data?.hasMore;
  const loadOlder = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    const offset = older?.next ?? PAGE;
    try {
      const page = await getTransfers(PAGE, offset);
      setOlder((o) => ({ transfers: [...(o?.transfers ?? []), ...(page.transfers ?? [])], hasMore: !!page.hasMore && (page.transfers ?? []).length > 0, next: offset + PAGE }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loading, older]);
  return { first, all, hasMore, loadOlder, loadingOlder: loading, olderFailed: failed };
}

/** What stops Continue, in words, or null. Nothing limits how many expenses anybody adds. */
function limitsText(bills: readonly Bill[]): string | null {
  if (bills.length > MAX_ITEMS) return `One expense holds up to ${MAX_ITEMS} bills, and this has ${bills.length}. Take some out and add them as another expense: there's no limit on expenses.`;
  const sources = bills.filter((b) => b.kind !== "custom").length;
  if (sources > MAX_SOURCES) return `One expense can name up to ${MAX_SOURCES} of your payments, and this names ${sources}. Add the rest as another expense.`;
  return null;
}

/** "Total ≈ 54.21 €" under a list of bills, or why there is no total yet. */
function TotalLine({ totals, bills }: { totals: ReturnType<typeof useBillsTotal>; bills: readonly Bill[] }) {
  const t = totals.total;
  if (!bills.length) return null;
  if (t.ok) {
    return (
      <p className="flex items-baseline justify-between gap-3 px-1 text-[15px] font-extrabold tabular-nums text-white">
        <span className="text-white/70">Total{bills.length > 1 ? ` · ${bills.length} bills` : ""}</span>
        <span>
          {t.basis !== "same" ? "≈ " : ""}
          {money(t.amountMinor, t.currency)}
        </span>
      </p>
    );
  }
  if (totals.converting) return <p className="px-1 text-[13px] text-white/60">Converting the bills to one currency…</p>;
  if (t.reason === "mixed_currencies") {
    return (
      <p className="rounded-[14px] bg-amber/[0.12] px-3 py-2 text-[12.5px] leading-[17px] text-amber">
        {totals.fxFailed ? "Today\u2019s rates didn\u2019t load" : "There\u2019s no rate today"} for {t.currencies.join(" and ")}, so these can&apos;t be added up. Try again in a moment, or split them one currency at a time.
      </p>
    );
  }
  return null;
}

function SelectBill({
  picked,
  onToggle,
  onRemove,
  onCustom,
  onBack,
  backLabel,
  onContinue,
  taken,
  notice,
  ownExpenseId,
  totals,
}: {
  picked: Bill[];
  onToggle: (b: Bill) => void;
  onRemove: (key: string) => void;
  onCustom: (key: string | null) => void;
  onBack: () => void;
  backLabel: string;
  onContinue: () => void;
  /** Sources this flow was just told are taken (409), on top of what the read says. */
  taken: UsedSource[];
  notice: string | null;
  /** Editing: this expense's own bills are not "split elsewhere". */
  ownExpenseId: string | null;
  totals: ReturnType<typeof useBillsTotal>;
}) {
  const [q, setQ] = useState("");
  const activity = useActivityPages();
  const trips = useTrips();
  const used = useUsedSources(true);

  const rows = useMemo(() => billsFrom(activity.all, trips.bookings), [activity.all, trips.bookings]);
  const unpriced = useMemo(() => unpricedCount(activity.all), [activity.all]);
  const usedBy = useMemo(() => {
    const m = new Map<string, UsedSource>();
    for (const u of [...(used.data ?? []), ...taken]) if (!ownExpenseId || u.expenseId !== ownExpenseId) m.set(`${u.kind}:${u.ref}`, u);
    return m;
  }, [used.data, taken, ownExpenseId]);
  const shown = useMemo(() => groupByDay(searchBills(rows, q)), [rows, q]);
  const pickedKeys = new Set(picked.map((b) => b.key));
  const loading = activity.first.data === undefined && !activity.first.error;
  const failed = !!activity.first.error && activity.first.data === undefined;
  const limit = limitsText(picked);
  const canGo = totals.total.ok && !limit;

  return (
    <div className="relative flex shrink-0 flex-1 flex-col pb-4">
      <Top onBack={onBack} backLabel={backLabel} />
      <h2 className={`${bigTitle} mt-3`}>Select bill</h2>

      <label className="mt-5 flex h-12 items-center gap-2.5 rounded-[24px] border border-white/[0.1] bg-white/[0.05] px-4 focus-within:border-white/30">
        <Ion name="search" size={19} className="shrink-0 text-white/70" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          aria-label="Search your activity"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/55"
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="text-white/60 hover:text-white">
            <Ion name="close" size={17} />
          </button>
        ) : null}
      </label>

      {picked.length ? (
        <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-1 pt-2" aria-label="Picked">
          {picked.map((b) => (
            <div key={b.key} className="flex w-[76px] shrink-0 flex-col items-center text-center">
              <span className="relative">
                <button
                  type="button"
                  onClick={() => (b.kind === "custom" ? onCustom(b.key) : undefined)}
                  aria-label={b.kind === "custom" ? `Change ${b.label}` : b.label}
                  className="rounded-[32px]"
                  tabIndex={b.kind === "custom" ? 0 : -1}
                >
                  <BillFace bill={b} size={60} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(b.key)}
                  aria-label={`Take out ${b.label}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-[12px] bg-[#F1F5F9] text-[#0A1420] shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                >
                  <Ion name="close" size={14} />
                </button>
              </span>
              <span className="mt-1.5 w-full truncate text-[13px] font-bold text-white">{b.label}</span>
              <span className="w-full truncate text-[12.5px] tabular-nums text-white/60">{money(b.amountMinor, b.currency, "-")}</span>
            </div>
          ))}
        </div>
      ) : null}

      <button type="button" onClick={() => onCustom(null)} className={`${card} mt-4 flex h-[76px] items-center gap-4 px-4 text-left transition-colors hover:bg-white/[0.09]`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] bg-amber/[0.14] text-amber">
          <Ion name="document-text-outline" size={22} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[17px] font-extrabold text-amber">{picked.length ? "Add another bill" : "Create a custom bill"}</span>
          <span className="text-[13px] text-white/55">Anything you paid outside HOLD. Add as many as you like.</span>
        </span>
      </button>

      {notice ? (
        <div className="mt-3">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-7 flex flex-col gap-3" aria-busy>
          <Skeleton className="h-6 w-24 rounded-[8px]" />
          <Skeleton className="h-[160px] rounded-[24px]" />
        </div>
      ) : null}
      {failed ? (
        <div className="mt-6">
          <Notice>
            Your activity didn&apos;t load, so there is nothing to pick from right now. A custom bill still works.{" "}
            <button type="button" className="font-extrabold underline" onClick={() => void activity.first.mutate()}>
              Retry
            </button>
          </Notice>
        </div>
      ) : null}
      {!loading && !failed && rows.length === 0 && !activity.hasMore ? (
        <p className="mt-8 px-2 text-center text-[14px] text-white/60">Nothing you paid shows up yet. Create a custom bill for anything you paid outside HOLD.</p>
      ) : null}
      {!loading && rows.length > 0 && shown.length === 0 ? <p className="mt-8 text-center text-[14px] text-white/60">Nothing matches “{q}” in what&apos;s loaded.</p> : null}

      {shown.map((day) => (
        <section key={day.label} className="mt-7">
          <h3 className="mb-3 text-[20px] font-extrabold tracking-[-0.3px] text-white">{day.label}</h3>
          <ul className={`${card} flex flex-col py-2`}>
            {day.rows.map((r) => (
              <BillLine key={r.key} row={r} on={pickedKeys.has(r.key)} used={usedBy.get(`${r.kind}:${r.ref}`)} onToggle={() => onToggle(r)} />
            ))}
          </ul>
        </section>
      ))}

      {!loading && !failed ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          {activity.hasMore ? (
            <button type="button" onClick={() => void activity.loadOlder()} disabled={activity.loadingOlder} className={pillGlass}>
              {activity.loadingOlder ? "Loading…" : "Load older"}
            </button>
          ) : null}
          {activity.olderFailed ? <p className="text-[12.5px] text-white/60">Older activity didn&apos;t load. Try again.</p> : null}
          {unpriced > 0 ? (
            <p className="max-w-[420px] px-2 text-center text-[12.5px] leading-[17px] text-white/55">
              {unpriced === 1 ? "1 payment" : `${unpriced} payments`} in a token with no recorded dollar value {unpriced === 1 ? "isn't" : "aren't"} listed: HOLD doesn&apos;t guess a price. Add {unpriced === 1 ? "it" : "them"} as a custom bill.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none sticky bottom-0 -mx-4 mt-auto bg-[linear-gradient(180deg,transparent,#08151C_40%)] px-4 pb-1 pt-8">
        {picked.length ? (
          <div className="pointer-events-auto mb-2 flex flex-col gap-2">
            <TotalLine totals={totals} bills={picked} />
            {limit ? <p className="rounded-[14px] bg-amber/[0.12] px-3 py-2 text-[12.5px] leading-[17px] text-amber">{limit}</p> : null}
          </div>
        ) : null}
        {picked.length ? (
          <button type="button" onClick={onContinue} disabled={!canGo} className={`${plateBig} pointer-events-auto shadow-[0_10px_30px_rgba(0,0,0,0.45)]`}>
            Continue · {picked.length}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BillLine({ row, on, used, onToggle }: { row: BillRow; on: boolean; used?: UsedSource; onToggle: () => void }) {
  const time = new Date(row.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const disabled = !!used && !on;
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onToggle}
        className={`flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors ${disabled ? "cursor-not-allowed" : "hover:bg-white/[0.04]"}`}
      >
        <span className="mt-3">
          <Tick on={on} disabled={disabled} />
        </span>
        <span className={disabled ? "opacity-45" : ""}>
          <BillFace bill={row} size={48} />
        </span>
        <span className={`flex min-w-0 flex-1 flex-col pt-0.5 ${disabled ? "opacity-55" : ""}`}>
          <span className="truncate text-[16.5px] font-extrabold text-white">{row.label}</span>
          <span className="line-clamp-2 text-[14px] text-white/60">
            {time} · {row.sub}
          </span>
          {used ? (
            <span className="mt-1 inline-flex items-center gap-1 self-start rounded-[10px] bg-white/[0.08] px-2 py-0.5 text-[12px] font-bold text-white/75">
              <Ion name="people-outline" size={12} />
              Split in {used.groupName}
            </span>
          ) : null}
        </span>
        <span className={`shrink-0 pt-0.5 text-[16px] font-bold tabular-nums text-white ${disabled ? "opacity-55" : ""}`}>{money(row.amountMinor, row.currency, "-")}</span>
      </button>
    </li>
  );
}

/* ── 2. Custom bill: the keypad ───────────────────────────────────── */

const MORE_CURRENCIES = ["NZD", "HKD", "CNY", "KRW", "INR", "SEK", "NOK", "DKK", "PLN", "CZK", "TRY", "ZAR", "ILS", "THB", "PHP", "IDR", "MYR", "UYU", "NGN", "KES"];

function CustomBill({
  initial,
  defaultCurrency,
  title,
  onBack,
  onDone,
}: {
  initial?: Bill;
  defaultCurrency: string;
  title: string;
  onBack: () => void;
  onDone: (b: { amountMinor: string; currency: string; label: string }) => void;
}) {
  const decimal = useDecimal();
  const [currency, setCurrency] = useState((initial?.currency ?? defaultCurrency).toUpperCase());
  const [expr, setExpr] = useState(() => (initial ? minorToPlain(toBig(initial.amountMinor), initial.currency) : ""));
  const [label, setLabel] = useState(initial && initial.label !== "Custom bill" ? initial.label : "");
  const [picking, setPicking] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  const value = evaluate(expr, currency);
  const ready = value !== null && value > 0n;
  const press = useCallback((k: CalcKey) => setExpr((e) => pressKey(e, k, currency)), [currency]);

  // A new currency with fewer decimals re-reads what is typed.
  useEffect(() => {
    setExpr((e) => {
      const v = evaluate(e, currency);
      return hasOperator(e) || v === null ? e : minorToPlain(v, currency);
    });
  }, [currency]);

  const done = useCallback(() => {
    if (!ready || value === null) return;
    onDone({ amountMinor: value.toString(), currency, label: label.trim() || "Custom bill" });
  }, [ready, value, currency, label, onDone]);

  // The keyboard on a desktop: digits, both decimal marks, the four operators, = and Enter, Backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picking || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === descRef.current) {
        if (e.key === "Enter") {
          e.preventDefault();
          done();
        }
        return;
      }
      const map: Record<string, CalcKey> = { "+": "+", "-": "-", "*": "*", x: "*", X: "*", "/": "/", "=": "=", ".": ".", ",": ".", Backspace: "back", Delete: "clear" };
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key as CalcKey);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (hasOperator(expr)) press("=");
        else done();
      } else if (map[e.key]) {
        e.preventDefault();
        press(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, press, expr, done]);

  const sym = currencySymbol(currency);
  const shown = expr ? displayExpression(expr, decimal) : "0";
  const preview = hasOperator(expr) && value !== null ? `= ${money(value, currency)}` : null;
  const keyCls = "flex h-[58px] items-center justify-center rounded-[18px] text-[28px] font-bold text-white transition-colors hover:bg-white/[0.06] active:bg-white/[0.1]";
  const opCls = "flex h-12 items-center justify-center rounded-[24px] border border-white/[0.08] bg-white/[0.06] text-[22px] font-bold text-white/85 transition-colors hover:bg-white/[0.1] active:bg-white/[0.14]";

  return (
    <div className="flex shrink-0 flex-1 flex-col">
      <Top onBack={onBack} title={title} />

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <p className="flex max-w-full items-baseline justify-center gap-1 px-2" aria-live="polite" aria-label={`Amount ${shown} ${currency}`}>
          <span className={`min-w-0 truncate font-extrabold tabular-nums tracking-[-1.5px] ${expr ? "text-white" : "text-white/45"} ${shown.length > 12 ? "text-[36px]" : "text-[56px]"} leading-none`}>
            {shown}
          </span>
          <span aria-hidden className="mx-0.5 inline-block h-[0.95em] w-[3px] translate-y-[0.1em] animate-pulse self-center rounded-[1.5px] bg-amber" style={{ height: shown.length > 12 ? 36 : 54 }} />
          <span className={`font-extrabold leading-none text-white/45 ${shown.length > 12 ? "text-[36px]" : "text-[56px]"}`}>{sym}</span>
        </p>
        <p className="mt-2 h-5 text-[15px] tabular-nums text-white/60">{preview}</p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-[22px] bg-white/[0.08] px-4 text-[16px] font-extrabold text-white transition-colors hover:bg-white/[0.12]"
          aria-label={`Currency ${currency}. Change it`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[12px] bg-white/[0.12] text-[12px]">{sym.length <= 2 ? sym : currency.slice(0, 1)}</span>
          {currency}
          <Ion name="chevron-down" size={15} />
        </button>
      </div>

      <input
        ref={descRef}
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 120))}
        placeholder="Add description"
        aria-label="Description"
        className="h-14 w-full rounded-[28px] bg-white/[0.07] px-5 text-[16.5px] text-white outline-none transition-colors placeholder:text-white/50 focus:bg-white/[0.1]"
      />

      <button type="button" onClick={done} disabled={!ready} className={`${plateBig} mt-5`}>
        Continue
      </button>

      <div className="mt-5 grid grid-cols-5 gap-2" role="group" aria-label="Calculator">
        {(
          [
            ["+", "+", "Plus"],
            ["-", "−", "Minus"],
            ["*", "×", "Times"],
            ["/", "÷", "Divided by"],
            ["=", "=", "Equals"],
          ] as const
        ).map(([k, glyph, name]) => (
          <button key={k} type="button" className={opCls} onClick={() => press(k)} aria-label={name}>
            {glyph}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Digits">
        {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((d) => (
          <button key={d} type="button" className={keyCls} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={keyCls} onClick={() => press(".")} aria-label="Decimal point" disabled={minorExponent(currency) === 0}>
          {minorExponent(currency) === 0 ? "" : decimal}
        </button>
        <button type="button" className={keyCls} onClick={() => press("0")}>
          0
        </button>
        <button type="button" className={keyCls} onClick={() => press("back")} aria-label="Delete">
          <svg width="30" height="24" viewBox="0 0 30 24" fill="none" aria-hidden>
            <path d="M9.5 3h16A2.5 2.5 0 0 1 28 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-16L2 12l7.5-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m13.5 8 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {picking ? <CurrencyPicker value={currency} onPick={setCurrency} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}

function CurrencyPicker({ value, onPick, onClose }: { value: string; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => [...new Set([value, ...COMMON_CURRENCIES, ...MORE_CURRENCIES])], [value]);
  const nameOf = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames(undefined, { type: "currency" });
      return (c: string) => dn.of(c) ?? c;
    } catch {
      return (c: string) => c;
    }
  }, []);
  const s = q.trim().toUpperCase();
  const list = all.filter((c) => !s || c.includes(s) || nameOf(c).toUpperCase().includes(s));
  const typed = /^[A-Z]{3}$/.test(s) && !all.includes(s) ? s : null;
  const choose = (c: string) => {
    onPick(c);
    onClose();
  };
  return (
    <Modal title="Currency" onClose={onClose} size="sm">
      <label className="flex h-11 items-center gap-2 rounded-[22px] bg-white/[0.07] px-3.5">
        <Ion name="search" size={17} className="text-white/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, or type a code"
          aria-label="Search currencies"
          data-autofocus
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/50"
        />
      </label>
      <div role="listbox" aria-label="Currencies" className="flex flex-col gap-1.5">
        {typed ? (
          <ModalChoice selected={false} onClick={() => choose(typed)} leading={<CurrencyDisc c={typed} />} label={typed} sub="Use this code" />
        ) : null}
        {list.map((c) => (
          <ModalChoice key={c} selected={c === value} onClick={() => choose(c)} leading={<CurrencyDisc c={c} />} label={c} sub={nameOf(c)} />
        ))}
      </div>
    </Modal>
  );
}

function CurrencyDisc({ c }: { c: string }) {
  const sym = currencySymbol(c);
  return <span className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.1] text-[15px] font-extrabold text-white">{sym.length <= 2 ? sym : c.slice(0, 2)}</span>;
}

/* ── 3. Split bill ────────────────────────────────────────────────── */

type Tab = "amount" | "percent" | "shares";
const TABS: { value: Tab; label: string }[] = [
  { value: "amount", label: "Amount" },
  { value: "percent", label: "Percent" },
  { value: "shares", label: "Share" },
];

interface SplitState {
  tab: Tab;
  people: string[];
  /** Amount tab: what was typed, as typed. */
  typed: Record<string, string>;
  percents: Record<string, string>;
  weights: Record<string, string>;
}

/** What an existing expense was split with, as the three tabs hold it. */
function stateFrom(e: Expense, members: readonly GroupMember[], groupCurrency: string): SplitState {
  const all = members.map((m) => m.userId);
  const empty = { typed: {}, percents: {}, weights: {} };
  const s = e.splitInputs;
  if (e.splitMode === "percent" && s && "percents" in s) return { ...empty, tab: "percent", people: s.percents.map((p) => p.userId), percents: Object.fromEntries(s.percents.map((p) => [p.userId, p.percent])) };
  if (e.splitMode === "shares" && s && "weights" in s) return { ...empty, tab: "shares", people: s.weights.map((w) => w.userId), weights: Object.fromEntries(s.weights.map((w) => [w.userId, String(w.weight)])) };
  if (e.splitMode === "exact" && s && "amounts" in s)
    return { ...empty, tab: "amount", people: s.amounts.map((a) => a.userId), typed: Object.fromEntries(s.amounts.map((a) => [a.userId, minorToInput(a.amountMinor, e.currency)])) };
  if (e.splitMode === "equal" && s && "participants" in s) return { ...empty, tab: "amount", people: [...s.participants] };
  // An older row: only shares, in the group's currency.
  if (e.currency.toUpperCase() === groupCurrency.toUpperCase())
    return { ...empty, tab: "amount", people: e.shares.map((x) => x.userId), typed: Object.fromEntries(e.shares.map((x) => [x.userId, minorToInput(x.shareMinor, e.currency)])) };
  const holders = e.shares.filter((x) => x.shareMinor !== "0").map((x) => x.userId);
  return { ...empty, tab: "amount", people: holders.length ? holders : all };
}

function SplitBill({
  groupId,
  groupCurrency,
  members,
  meId,
  bills,
  totals,
  editing,
  onBack,
  onChangeBill,
  onAddBill,
  onAddFromActivity,
  onRemoveBill,
  busy,
  setBusy,
  onSaved,
  onReAdd,
  onSourceTaken,
}: {
  groupId: string;
  groupCurrency: string;
  members: GroupMember[];
  meId: string | null;
  bills: Bill[];
  totals: ReturnType<typeof useBillsTotal>;
  editing?: Expense;
  onBack: () => void;
  /** Open a typed bill on the keypad. */
  onChangeBill: (key: string) => void;
  onAddBill: () => void;
  onAddFromActivity: () => void;
  onRemoveBill: (key: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSaved: (id: string) => void;
  onReAdd: () => void;
  onSourceTaken: (u: UsedSource) => void;
}) {
  const decimal = useDecimal();
  const ids = members.map((m) => m.userId);
  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const total = totals.total;
  const currency = total.ok ? total.currency : groupCurrency;
  const totalMinor = total.ok ? toBig(total.amountMinor) : 0n;
  const approx = total.ok && total.basis !== "same";
  const limit = limitsText(bills);

  const initial = useMemo<SplitState>(
    () => (editing ? stateFrom(editing, members, groupCurrency) : { tab: "amount", people: ids, typed: {}, percents: evenPercents(ids), weights: Object.fromEntries(ids.map((id) => [id, "1"])) }),
    // Made once per open: a poll that re-reads members must not wipe what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing?.id],
  );
  const [st, setSt] = useState<SplitState>(initial);
  const [payer, setPayer] = useState<string | null>(editing?.payerUserId ?? meId);
  const suggested = billsTitle(bills);
  const [description, setDescription] = useState(editing ? (editing.description ?? "") : "");
  // A category somebody picked wins; untouched, a stay bill makes it Stay (the server does the same when none is sent).
  const [category, setCategory] = useState<{ touched: boolean; value: ExpenseCategory | null }>({ touched: false, value: editing ? expenseCategory(editing) : null });
  const hasStay = bills.some((b) => b.kind === "stay");
  const effectiveCategory: ExpenseCategory | null = category.touched ? category.value : (category.value ?? (hasStay ? "stay" : null));
  const [place, setPlace] = useState(editing?.place ?? "");
  const [date, setDate] = useState(editing ? isoToDateInput(editing.spentAt) : latestDay(bills));
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const receiptUrl = useObjectUrl(receipt);
  const [sheet, setSheet] = useState<"none" | "payer" | "locked" | "receipt-failed">("none");
  const [notice, setNotice] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [key, setKey] = useState(() => newClientKey("expense"));

  // Everyone in the list: members, then anyone in a stored split who has since left.
  const rowsIds = [...ids, ...st.people.filter((id) => !ids.includes(id))];
  const people = rowsIds.filter((id) => st.people.includes(id));

  /* The check, per tab, in the paid currency. */
  const typedMinor: Record<string, bigint> = {};
  const badTyped: string[] = [];
  for (const id of people) {
    const raw = st.typed[id];
    if (raw === undefined) continue;
    const v = parseMajorAllowZero(raw.trim() || "0", currency);
    if (v === null) badTyped.push(id);
    else typedMinor[id] = BigInt(v);
  }
  const filled = autoFillAmounts(totalMinor, people, typedMinor, payer ?? "");
  const anyTyped = Object.keys(typedMinor).length > 0 || badTyped.length > 0;
  const mode: SplitMode = st.tab === "amount" ? (anyTyped ? "exact" : "equal") : st.tab === "percent" ? "percent" : "shares";
  const inputs: Record<string, string> =
    st.tab === "amount" ? Object.fromEntries(people.map((id) => [id, badTyped.includes(id) ? (st.typed[id] ?? "") : minorToInput(filled[id] ?? 0n, currency)])) : st.tab === "percent" ? st.percents : st.weights;
  const check = checkSplit({ mode, totalMinor: total.ok ? total.amountMinor : null, currency, payerUserId: payer, people, inputs });
  const preview = new Map(check.shares.map((s) => [s.userId, s.shareMinor]));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const valid = total.ok && totalMinor > 0n && !!payer && check.ok && dateOk && badTyped.length === 0 && !limit && bills.length > 0;

  const left = (() => {
    if (!bills.length) return { text: "Add a bill first.", warn: true };
    if (!total.ok) return { text: totals.converting ? "Converting the bills…" : "The bills can't be added up yet.", warn: true };
    if (!people.length) return { text: "Pick at least one person.", warn: true };
    if (check.ok) return { text: `All ${money(totalMinor, currency)} assigned`, warn: false };
    switch (check.reason) {
      case "amount_left":
        return { text: `${money(check.leftMinor ?? 0n, currency)} left to assign`, warn: true };
      case "amount_over":
        return { text: `${money(-(check.leftMinor ?? 0n), currency)} over the total`, warn: true };
      case "percent_left":
        return { text: `${bpText(check.leftBp ?? 0n)}% left to assign`, warn: true };
      case "percent_over":
        return { text: `${bpText(-(check.leftBp ?? 0n))}% over 100%`, warn: true };
      case "all_zero":
        return { text: st.tab === "shares" ? "Give at least one person a share." : st.tab === "percent" ? "100% left to assign" : `${money(totalMinor, currency)} left to assign`, warn: true };
      case "bad_input":
        return { text: st.tab === "percent" ? "A percentage is 0 to 100, with at most two decimals." : st.tab === "shares" ? "A share is a whole number from 0 to 1000." : `Amounts in ${currency} have at most ${minorExponent(currency)} decimals.`, warn: true };
      default:
        return { text: "", warn: false };
    }
  })();

  const toggle = (id: string) => {
    setSt((s) => {
      const on = s.people.includes(id);
      const next = on ? s.people.filter((x) => x !== id) : [...s.people, id];
      const typed = { ...s.typed };
      if (on) delete typed[id];
      // Percent starts even again for whoever is in; shares give a newcomer one.
      return { ...s, people: next, typed, percents: evenPercents(rowsIds.filter((x) => next.includes(x))), weights: on ? s.weights : { ...s.weights, [id]: s.weights[id] && s.weights[id] !== "0" ? s.weights[id] : "1" } };
    });
  };

  const setValue = (id: string, text: string) => {
    setSt((s) =>
      s.tab === "amount"
        ? { ...s, typed: { ...s.typed, [id]: text } }
        : s.tab === "percent"
          ? { ...s, percents: { ...s.percents, [id]: text } }
          : { ...s, weights: { ...s.weights, [id]: text } },
    );
  };

  const multi = bills.length > 1;
  const hadItems = !!editing && expenseBills(editing).length > 0;

  const body = () => {
    const everyone = mode === "equal" && !editing && people.length === ids.length && ids.every((id) => people.includes(id));
    const sources: ExpenseSource[] = bills
      .filter((b) => b.kind !== "custom" && b.ref)
      .map((b) => ({ kind: b.kind as ExpenseSource["kind"], ref: b.ref!, label: b.label.slice(0, 120), amountMinor: b.amountMinor, currency: b.currency, occurredAt: b.occurredAt ?? null }));
    return {
      // With items the server derives the amount; this preview total is what an older server, which ignores items, keeps.
      amountMinor: totalMinor.toString(),
      currency,
      description: editing ? description.trim() || null : description.trim() || suggested,
      place: place.trim() || null,
      spentAt: date,
      split: splitBody({ mode, totalMinor: totalMinor.toString(), currency, payerUserId: payer, people, inputs }, everyone),
      ...(multi ? { items: itemsBody(bills) } : {}),
      ...(sources.length ? { sources } : {}),
      ...(effectiveCategory ? { category: effectiveCategory } : {}),
    };
  };

  const putReceipt = async (id: string) => {
    if (!receipt) return onSaved(id);
    try {
      await uploadReceipt(groupId, id, receipt);
      onSaved(id);
    } catch (e) {
      setSavedId(id);
      setNotice(describeGroupError(e));
      setSheet("receipt-failed");
    }
  };

  const submit = async () => {
    if (!valid || busy || !payer) return;
    setBusy(true);
    setNotice(null);
    try {
      const b = body();
      if (!editing) {
        const { expense } = await addExpense(groupId, { ...b, ...(payer !== meId ? { payerUserId: payer } : {}) }, key);
        await putReceipt(expense.id);
        return;
      }
      const was = stateFrom(editing, members, groupCurrency);
      const wasItems = hadItems ? JSON.stringify(itemsBody(billsOfExpense(editing))) : "[]";
      const nowItems = multi ? JSON.stringify(itemsBody(bills)) : "[]";
      const itemsChanged = wasItems !== nowItems;
      const moneyChanged =
        itemsChanged ||
        b.amountMinor !== editing.amountMinor ||
        b.currency !== editing.currency.toUpperCase() ||
        canonical(b.split) !== canonical(splitOf(was, editing, payer)) ||
        st.tab !== was.tab;
      const patch: Parameters<typeof updateExpense>[2] = {};
      if ((editing.description ?? "") !== (b.description ?? "")) patch.description = b.description;
      if ((editing.place ?? "") !== (b.place ?? "")) patch.place = b.place;
      if (isoToDateInput(editing.spentAt) !== b.spentAt) patch.spentAt = b.spentAt;
      if ((expenseCategory(editing) ?? null) !== (effectiveCategory ?? null)) patch.category = effectiveCategory;
      if (moneyChanged) {
        patch.amountMinor = b.amountMinor;
        patch.currency = b.currency;
        patch.split = b.split;
        // Several bills replace the list; back to one bill, items: [] makes it a single amount again.
        if (multi || hadItems) patch.items = multi ? itemsBody(bills) : [];
        // A bill that names a payment must find it in `sources` in the same request (§10.1).
        if (multi && b.sources?.length) patch.sources = b.sources;
      }
      if (Object.keys(patch).length) await updateExpense(groupId, editing.id, patch);
      await putReceipt(editing.id);
    } catch (e) {
      if (e instanceof HoldApiError && e.detail === "expense_locked_by_settlement") setSheet("locked");
      else if (e instanceof HoldApiError && e.detail === "source_already_split") {
        const d = (e.details ?? {}) as { ref?: string; kind?: UsedSource["kind"]; expenseId?: string };
        if (d.ref) {
          setBusy(false);
          onSourceTaken({ kind: d.kind ?? "transfer", ref: d.ref, groupId: "", groupName: "a group", expenseId: d.expenseId ?? "" });
          return;
        }
        setNotice(describeGroupError(e));
      } else if (e instanceof HoldApiError && e.detail === "amounts_do_not_sum" && approx) {
        setNotice(`The bills are converted at today's rate, and HOLD's total came out a cent away from ${money(totalMinor, currency)}. Use Percent or Share, which always add up, or check the amounts.`);
      } else setNotice(describeGroupError(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteAndReAdd = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteExpense(groupId, editing.id);
      setKey(newClientKey("expense"));
      setSheet("none");
      onReAdd();
      setNotice(null);
    } catch (e) {
      setNotice(describeGroupError(e));
      setSheet("none");
    } finally {
      setBusy(false);
    }
  };

  const payerName = payer === meId ? "you" : memberName(byId.get(payer ?? ""));
  const canPickPayer = !editing && members.length > 1;
  const canEditAmount = bills.length === 1 && bills[0].kind === "custom";

  return (
    <div className="relative flex shrink-0 flex-1 flex-col pb-4">
      <Top onBack={onBack} backLabel={editing ? "Close" : "Back"} />
      <h2 className={`${bigTitle} mt-3`}>{editing ? "Edit expense" : "Split bill"}</h2>

      {/* The bill, or the bills */}
      <div className={`${card} mt-5 flex items-center gap-3.5 px-4 py-4`}>
        {bills.length > 1 ? (
          <span className="relative h-12 w-12 shrink-0">
            {bills.slice(0, 2).map((b, i) => (
              <span key={b.key} className="absolute" style={{ left: i * 12, top: i * 6 }}>
                <BillFace bill={b} size={36} />
              </span>
            ))}
          </span>
        ) : (
          <BillFace bill={bills[0] ?? { key: "x", kind: "custom", label: "", amountMinor: "0", currency }} size={48} />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-extrabold text-white">{description.trim() || suggested || (bills.length > 1 ? `${bills.length} bills` : "Expense")}</span>
          {canPickPayer ? (
            <button type="button" onClick={() => setSheet("payer")} className="inline-flex items-center gap-1 self-start text-[15px] font-bold text-amber hover:opacity-85" aria-haspopup="dialog">
              Paid by {payerName}
              <Ion name="chevron-down" size={15} />
            </button>
          ) : (
            <span className="text-[14.5px] text-white/60">Paid by {payerName}</span>
          )}
        </span>
        {canEditAmount ? (
          <button type="button" onClick={() => onChangeBill(bills[0].key)} className="shrink-0 rounded-[10px] px-1 text-right text-[17px] font-bold tabular-nums text-white underline decoration-white/30 underline-offset-4 hover:decoration-white/70" aria-label="Change the amount">
            {total.ok ? money(totalMinor, currency) : "–"}
          </button>
        ) : (
          <span className="shrink-0 text-[17px] font-bold tabular-nums text-white">{total.ok ? `${approx ? "≈ " : ""}${money(totalMinor, currency)}` : "–"}</span>
        )}
      </div>

      {/* Every bill, the running total, and more */}
      {bills.length > 1 ? (
        <div className={`${card} mt-3 flex flex-col py-1.5`}>
          <ul aria-label="Bills" className="flex flex-col">
            {bills.map((b, i) => {
              const conv = total.ok && b.currency.toUpperCase() !== total.currency ? total.converted[i] : null;
              return (
                <li key={b.key} className="flex min-h-[56px] items-center gap-3 px-4 py-1.5">
                  <BillFace bill={b} size={32} />
                  {b.kind === "custom" ? (
                    <button type="button" onClick={() => onChangeBill(b.key)} disabled={busy} className="flex min-w-0 flex-1 flex-col text-left" aria-label={`Change ${b.label}`}>
                      <span className="truncate text-[15px] font-bold text-white">{b.label}</span>
                      <span className="text-[12px] text-white/50">Typed · tap to change</span>
                    </button>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold text-white">{b.label}</span>
                      <span className="text-[12px] text-white/50">{b.kind === "stay" ? "Stay" : b.kind === "card" ? "Card" : "Payment"}</span>
                    </span>
                  )}
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[15px] font-bold tabular-nums text-white">{money(b.amountMinor, b.currency)}</span>
                    {conv !== null ? <span className="text-[12px] tabular-nums text-white/50">≈ {money(conv, total.ok ? total.currency : currency)}</span> : null}
                  </span>
                  <button type="button" onClick={() => onRemoveBill(b.key)} disabled={busy} aria-label={`Take out ${b.label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] text-white/55 hover:bg-white/10 hover:text-white">
                    <Ion name="close" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mx-4 mt-1 border-t border-white/[0.08] pt-2.5 pb-1.5">
            <TotalLine totals={totals} bills={bills} />
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAddBill} disabled={busy} className={pillGlass}>
          <Ion name="add" size={15} />
          Add another bill
        </button>
        <button type="button" onClick={onAddFromActivity} disabled={busy} className={pillGlass}>
          <Ion name="list-outline" size={15} />
          From your activity
        </button>
      </div>
      {limit ? <p className="mt-2 rounded-[14px] bg-amber/[0.12] px-3 py-2 text-[12.5px] leading-[17px] text-amber">{limit}</p> : null}
      {bills.length <= 1 && !total.ok ? (
        <div className="mt-2">
          <TotalLine totals={totals} bills={bills} />
        </div>
      ) : null}
      {total.ok && total.basis === "fx" ? (
        <p className="mt-2 px-1 text-[12.5px] text-white/55">Converted to {total.currency} at today&apos;s rate. HOLD works out the exact total when it&apos;s added.</p>
      ) : null}
      {total.ok && total.basis === "usd" ? (
        <p className="mt-2 px-1 text-[12.5px] text-white/55">No rate today for one of these, so they&apos;re added up in dollars, from each payment&apos;s value when it was made.</p>
      ) : null}
      {total.ok && currency !== groupCurrency.toUpperCase() ? (
        <p className="mt-2 px-1 text-[12.5px] text-white/55">The group keeps {groupCurrency}. HOLD converts this once, at the rate of the day it is added.</p>
      ) : null}

      {/* Category */}
      <div className="mt-5">
        <p className="px-1 pb-2 text-[13px] font-bold text-white/60">Category</p>
        <div role="radiogroup" aria-label="Category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EXPENSE_CATEGORIES.map((c) => {
            const on = effectiveCategory === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy}
                onClick={() => setCategory({ touched: true, value: on ? null : c })}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[18px] px-3.5 text-[13.5px] font-bold transition-colors ${
                  on ? "bg-[#F1F5F9] text-[#0A1420]" : "bg-white/[0.08] text-white/80 hover:bg-white/[0.12]"
                }`}
              >
                <Ion name={CATEGORY_ICON[c]} size={15} />
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount | Percent | Share */}
      <div role="tablist" aria-label="How to split" className="mt-5 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={st.tab === t.value}
            onClick={() => setSt((s) => ({ ...s, tab: t.value, percents: t.value === "percent" && s.tab !== "percent" ? evenPercents(people) : s.percents }))}
            className={`h-11 rounded-[22px] px-5 text-[16px] font-bold transition-colors ${st.tab === t.value ? "bg-white/[0.1] text-white ring-1 ring-inset ring-white/[0.14]" : "text-white/60 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className={`${card} mt-4 flex flex-col py-1.5`} aria-label="Members">
        {rowsIds.map((id) => {
          const m = byId.get(id);
          const inSplit = people.includes(id);
          const name = id === meId ? "You" : m ? memberName(m) : "Left the group";
          const bad = (!check.ok && check.reason === "bad_input" && check.badUserIds?.includes(id)) || badTyped.includes(id);
          const share = preview.get(id);
          return (
            <li key={id} className="flex min-h-[72px] items-center gap-3.5 px-4 py-2">
              <button type="button" role="checkbox" aria-checked={inSplit} aria-label={`${inSplit ? "Leave out" : "Include"} ${name}`} onClick={() => toggle(id)} disabled={busy}>
                <Tick on={inSplit} />
              </button>
              <span className={inSplit ? "" : "opacity-45"}>
                <PersonFace person={m} size={44} />
              </span>
              <span className={`flex min-w-0 flex-1 flex-col ${inSplit ? "" : "opacity-55"}`}>
                <span className="truncate text-[16.5px] font-bold text-white">{name}</span>
                {inSplit && st.tab !== "amount" && share !== undefined ? <span className="text-[13px] tabular-nums text-white/55">{money(share, currency)}</span> : null}
              </span>
              {inSplit ? (
                <ValueInput
                  tab={st.tab}
                  value={st.tab === "amount" ? (st.typed[id] ?? minorToInput(filled[id] ?? 0n, currency)) : st.tab === "percent" ? (st.percents[id] ?? "") : (st.weights[id] ?? "")}
                  auto={st.tab === "amount" && st.typed[id] === undefined}
                  bad={bad}
                  decimal={decimal}
                  suffix={st.tab === "amount" ? currencySymbol(currency) : st.tab === "percent" ? "%" : "×"}
                  label={`${st.tab === "amount" ? "Amount" : st.tab === "percent" ? "Percent" : "Shares"} for ${name}`}
                  onChange={(v) => setValue(id, v)}
                  onReset={st.tab === "amount" && st.typed[id] !== undefined ? () => setSt((s) => { const typed = { ...s.typed }; delete typed[id]; return { ...s, typed }; }) : undefined}
                  disabled={busy}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className={`mt-2.5 px-1 text-[13.5px] font-bold tabular-nums ${left.warn ? "text-amber" : "text-white/55"}`}>
        {left.text}
      </p>

      {/* Details */}
      <div className="mt-6 flex flex-col gap-2.5">
        <p className="px-1 text-[13px] font-bold text-white/60">Details (optional)</p>
        {bills.length > 1 || editing ? (
          <input value={description} onChange={(e) => setDescription(e.target.value.slice(0, 120))} placeholder={suggested ? `Description, like ${suggested}` : "Description, like Weekend in Lisbon"} aria-label="Description" disabled={busy} className={fieldCls} />
        ) : null}
        <div className="flex gap-2.5">
          <label className={`${fieldCls} flex flex-1 items-center gap-2`}>
            <Ion name="location-outline" size={17} className="shrink-0 text-white/55" />
            <input value={place} onChange={(e) => setPlace(e.target.value.slice(0, 120))} placeholder="Place" aria-label="Place" disabled={busy} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/50" />
          </label>
          <label className={`${fieldCls} flex w-[168px] shrink-0 items-center gap-2`}>
            <Ion name="calendar-outline" size={17} className="shrink-0 text-white/55" />
            <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} aria-label="Date" disabled={busy} className="min-w-0 flex-1 bg-transparent outline-none [color-scheme:dark]" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          {receiptUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Receipt" className="h-12 w-12 rounded-[12px] object-cover" />
              <PhotoButton label="Change receipt" icon="receipt-outline" onPicked={setReceipt} onError={setNotice} disabled={busy} />
              <button type="button" onClick={() => setReceipt(null)} className="rounded-[10px] px-2 py-1 text-[13px] font-bold text-white/65 hover:bg-white/10 hover:text-white">
                Remove
              </button>
            </>
          ) : (
            <PhotoButton label={editing?.receiptUrl ? "Replace receipt photo" : "Add receipt photo"} icon="receipt-outline" onPicked={setReceipt} onError={setNotice} disabled={busy} />
          )}
        </div>
        <p className="px-1 text-[12px] text-white/45">A receipt is proof for the group. Only its members can see it.</p>
      </div>

      {notice && sheet === "none" ? (
        <div className="mt-4">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      <div className="pointer-events-none sticky bottom-0 -mx-4 mt-auto bg-[linear-gradient(180deg,transparent,#08151C_40%)] px-4 pb-1 pt-8">
        <button type="button" onClick={() => void submit()} disabled={!valid || busy} className={`${plateBig} pointer-events-auto shadow-[0_10px_30px_rgba(0,0,0,0.45)]`}>
          {busy ? "Saving…" : editing ? "Save" : "Split with group"}
        </button>
      </div>

      {sheet === "payer" ? (
        <Modal title="Paid by" onClose={() => setSheet("none")} size="sm">
          <div role="listbox" aria-label="Paid by" className="flex flex-col gap-1.5">
            {members.map((m) => (
              <ModalChoice
                key={m.userId}
                selected={payer === m.userId}
                onClick={() => {
                  setPayer(m.userId);
                  setSheet("none");
                }}
                leading={<PersonFace person={m} size={48} />}
                label={m.userId === meId ? "You" : memberName(m)}
                sub={m.userId !== meId && m.displayName?.trim() ? m.displayName : undefined}
              />
            ))}
          </div>
        </Modal>
      ) : null}

      {sheet === "locked" && editing ? (
        <Modal
          title="This amount is settled against"
          onClose={() => setSheet("none")}
          busy={busy}
          size="sm"
          footer={
            <div className="flex flex-col gap-2">
              <button type="button" className={plateCaution} disabled={busy} onClick={() => void deleteAndReAdd()}>
                <Ion name="trash-outline" size={16} />
                {busy ? "Deleting…" : "Delete it and add it again"}
              </button>
              <button type="button" className={plateWhite} disabled={busy} onClick={() => setSheet("none")}>
                Keep it as it is
              </button>
            </div>
          }
        >
          <p className="text-[14px] leading-[20px] text-white/[0.78]">
            Someone settled up against this expense after it was added, so its amount and split can&apos;t change: that payment was made against it as it was. The description, place and date still can.
          </p>
          <p className="text-[14px] leading-[20px] text-white/[0.78]">If the amount is wrong, delete it and add it again. What you typed stays on this screen.</p>
        </Modal>
      ) : null}

      {sheet === "receipt-failed" && savedId ? (
        <Modal
          title="Split, without the receipt"
          onClose={() => onSaved(savedId)}
          busy={busy}
          size="sm"
          footer={
            <div className="flex gap-2">
              <button type="button" className={`${plateCaution} flex-1`} disabled={busy} onClick={() => onSaved(savedId)}>
                Skip it
              </button>
              <button
                type="button"
                className={`${plateWhite} flex-1`}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setSheet("none");
                  void putReceipt(savedId).finally(() => setBusy(false));
                }}
              >
                Try again
              </button>
            </div>
          }
        >
          <p className="text-[14px] leading-[20px] text-white/[0.78]">The expense is in the group. The receipt photo didn&apos;t upload: {notice}</p>
        </Modal>
      ) : null}
    </div>
  );
}

const fieldCls = "h-12 w-full rounded-[16px] bg-white/[0.06] px-3.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/50 focus-within:bg-white/[0.09] focus:bg-white/[0.09]";

/** The newest day among the bills, or today: an expense is dated when it was paid. */
function latestDay(bills: readonly Bill[]): string {
  const t = bills.map((b) => (b.occurredAt ? Date.parse(b.occurredAt) : NaN)).filter(Number.isFinite);
  return t.length ? todayLocal(new Date(Math.max(...t))) : todayLocal();
}

/** The split the stored expense had, written the way the form would send it. */
function splitOf(s: SplitState, e: Expense, payer: string | null) {
  const cur = e.currency.toUpperCase();
  if (s.tab === "percent") return splitBody({ mode: "percent", totalMinor: e.amountMinor, currency: cur, payerUserId: payer, people: s.people, inputs: s.percents }, false);
  if (s.tab === "shares") return splitBody({ mode: "shares", totalMinor: e.amountMinor, currency: cur, payerUserId: payer, people: s.people, inputs: s.weights }, false);
  const typed = Object.keys(s.typed).length > 0;
  return typed
    ? splitBody({ mode: "exact", totalMinor: e.amountMinor, currency: cur, payerUserId: payer, people: s.people, inputs: s.typed }, false)
    : splitBody({ mode: "equal", totalMinor: e.amountMinor, currency: cur, payerUserId: payer, people: s.people, inputs: {} }, false);
}

/** A split, written the same way whatever order its people were listed in. */
function canonical(split: ReturnType<typeof splitBody>): string {
  const byId = <T extends { userId: string }>(xs: T[]) => [...xs].sort((a, b) => (a.userId < b.userId ? -1 : 1));
  if (split.mode === "equal") return JSON.stringify({ mode: "equal", participants: [...(split.participants ?? [])].sort() });
  if (split.mode === "percent") return JSON.stringify({ mode: "percent", percents: byId(split.percents) });
  if (split.mode === "shares") return JSON.stringify({ mode: "shares", weights: byId(split.weights) });
  return JSON.stringify({ mode: "exact", amounts: byId(split.amounts) });
}

/** The value on the right of a member row, underlined, as Revolut draws it. */
function ValueInput({
  tab,
  value,
  auto,
  bad,
  decimal,
  suffix,
  label,
  onChange,
  onReset,
  disabled,
}: {
  tab: Tab;
  value: string;
  /** Worked out, not typed: drawn quieter until it is typed over. */
  auto: boolean;
  bad: boolean;
  decimal: string;
  suffix: ReactNode;
  label: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  disabled?: boolean;
}) {
  const shown = tab === "shares" ? value : value.replace(".", decimal);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {onReset ? (
        <button type="button" onClick={onReset} aria-label="Share the rest equally again" title="Share equally again" className="flex h-7 w-7 items-center justify-center rounded-[14px] text-white/45 hover:bg-white/10 hover:text-white">
          <Ion name="refresh" size={14} />
        </button>
      ) : null}
      <span className={`flex items-baseline gap-1 border-b-[1.5px] pb-0.5 ${bad ? "border-amber" : "border-white/35 focus-within:border-white"}`}>
        {tab === "shares" ? <span className="text-[15px] font-bold text-white/50">{suffix}</span> : null}
        <input
          value={shown}
          onChange={(e) => {
            const raw = e.target.value.replace(decimal, ".").replace(",", ".");
            onChange(tab === "shares" ? raw.replace(/\D/g, "").slice(0, 4) : raw.replace(/[^\d.]/g, "").slice(0, tab === "percent" ? 6 : 16));
          }}
          onFocus={(e) => e.currentTarget.select()}
          inputMode={tab === "shares" ? "numeric" : "decimal"}
          aria-label={label}
          aria-invalid={bad || undefined}
          disabled={disabled}
          size={Math.max(2, shown.length)}
          className={`w-auto min-w-[2ch] max-w-[9ch] bg-transparent text-right text-[17px] font-bold tabular-nums outline-none ${auto ? "text-white/70" : "text-white"}`}
        />
        {tab !== "shares" ? <span className="text-[15px] font-bold text-white/60">{suffix}</span> : null}
      </span>
    </span>
  );
}
