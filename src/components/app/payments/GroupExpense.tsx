"use client";

/**
 * An expense, added, opened and edited (groups-splitwise-grade.md §4).
 *
 * THE FORM (add and edit)
 *
 *   amount and currency   the currency it was PAID in; the group keeps its own,
 *                         converted once at that day's rate by the server
 *   title, place, date    the date is today unless changed
 *   receipt               optional, uploaded after the expense exists
 *   who paid              you by default (add only: the payer is fixed after)
 *   who shares it         everyone, or the people chosen
 *   how                   Equal, Percent or Exact amounts
 *
 * The check runs as the person types (groups-rules `checkSplit`): percentages
 * must total exactly 100, amounts exactly the total, and each person's part is
 * previewed with the server's own rounding. The server has the final word, and
 * what is shown after a save is what it wrote.
 *
 * EDITING, AND THE LOCK
 *
 * Only the payer edits. Title, place and date can always change. Amount,
 * currency and split can't once somebody settled up against the expense after
 * it was added (`409 expense_locked_by_settlement`): that settlement was made
 * against the expense as it was. The form says so in those words and offers
 * the honest way out, delete it and add it again, which it does in place with
 * what the person had typed.
 */

import { useMemo, useState } from "react";

import {
  addExpense,
  bpText,
  checkSplit,
  deleteExpense,
  deleteReceipt,
  describeGroupError,
  evenPercents,
  expenseForMe,
  isoToDateInput,
  memberName,
  minorToInput,
  moneyText,
  newClientKey,
  parseMajorToMinor,
  splitBody,
  todayLocal,
  updateExpense,
  uploadReceipt,
  useExpense,
  type Expense,
  type GroupMember,
  type SplitMode,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";

import { btnGlass, Notice } from "../hold";
import { Ion } from "../ion";
import { Chip, ChipRow, inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { CurrencyInput, LoadFailed, PersonFace, PhotoButton, plateCaution, plateWhite, sectionLabel, Sheet, useObjectUrl } from "./group-kit";

const MODES: { value: SplitMode; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "percent", label: "Percent" },
  { value: "exact", label: "Exact amounts" },
];

interface Draft {
  amount: string;
  currency: string;
  title: string;
  place: string;
  date: string;
  payer: string | null;
  everyone: boolean;
  chosen: string[];
  mode: SplitMode;
  inputs: Record<string, string>;
}

/** The form's starting point for an existing expense: what was entered, from `splitInputs`, else from `shares`. */
function draftFrom(e: Expense, members: readonly GroupMember[], groupCurrency: string): Draft {
  const all = members.map((m) => m.userId);
  const base = {
    amount: minorToInput(e.amountMinor, e.currency),
    currency: e.currency.toUpperCase(),
    title: e.description ?? "",
    place: e.place ?? "",
    date: isoToDateInput(e.spentAt),
    payer: e.payerUserId,
  };
  const s = e.splitInputs;
  if (e.splitMode === "percent" && s && "percents" in s) {
    return { ...base, everyone: false, chosen: s.percents.map((p) => p.userId), mode: "percent", inputs: Object.fromEntries(s.percents.map((p) => [p.userId, p.percent])) };
  }
  if (e.splitMode === "exact" && s && "amounts" in s) {
    return {
      ...base,
      everyone: false,
      chosen: s.amounts.map((a) => a.userId),
      mode: "exact",
      inputs: Object.fromEntries(s.amounts.map((a) => [a.userId, minorToInput(a.amountMinor, e.currency)])),
    };
  }
  if (e.splitMode === "equal" && s && "participants" in s) {
    const everyone = all.length > 0 && all.every((id) => s.participants.includes(id)) && s.participants.length === all.length;
    return { ...base, everyone, chosen: s.participants, mode: "equal", inputs: {} };
  }
  // An older row: only the shares, in the group's currency. As exact amounts
  // they are right only when it was paid in the group's currency.
  const holders = e.shares.filter((x) => x.shareMinor !== "0").map((x) => x.userId);
  if (e.currency.toUpperCase() === groupCurrency.toUpperCase()) {
    return { ...base, everyone: false, chosen: e.shares.map((x) => x.userId), mode: "exact", inputs: Object.fromEntries(e.shares.map((x) => [x.userId, minorToInput(x.shareMinor, e.currency)])) };
  }
  return { ...base, everyone: false, chosen: holders, mode: "equal", inputs: {} };
}

/** A split, written the same way whatever order its people were listed in. */
function canonical(split: ReturnType<typeof splitBody>): string {
  const byId = <T extends { userId: string }>(xs: T[]) => [...xs].sort((a, b) => (a.userId < b.userId ? -1 : 1));
  if (split.mode === "equal") return JSON.stringify({ mode: "equal", participants: [...(split.participants ?? [])].sort() });
  if (split.mode === "percent") return JSON.stringify({ mode: "percent", percents: byId(split.percents) });
  return JSON.stringify({ mode: "exact", amounts: byId(split.amounts) });
}

export function ExpenseForm({
  groupId,
  groupCurrency,
  members,
  meId,
  existing,
  onCancel,
  onSaved,
}: {
  groupId: string;
  groupCurrency: string;
  members: GroupMember[];
  meId: string | null;
  /** Editing this one; absent to add. */
  existing?: Expense;
  onCancel: () => void;
  /** Saved: the expense's id (a new one after delete-and-re-add). */
  onSaved: (expenseId: string) => void;
}) {
  const initial = useMemo<Draft>(
    () =>
      existing
        ? draftFrom(existing, members, groupCurrency)
        : {
            amount: "",
            currency: groupCurrency,
            title: "",
            place: "",
            date: todayLocal(),
            payer: meId,
            everyone: true,
            chosen: members.map((m) => m.userId),
            mode: "equal",
            inputs: {},
          },
    // The form is made once per open; a poll that re-reads members must not wipe what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [d, setD] = useState<Draft>(initial);
  const [editing, setEditing] = useState<Expense | undefined>(existing);
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [receiptProblem, setReceiptProblem] = useState<{ id: string; words: string } | null>(null);
  // One key per open form: a second tap after a lost answer is the same expense, not a second one.
  const [key, setKey] = useState(() => newClientKey("expense"));
  const receiptUrl = useObjectUrl(receipt);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const cur = d.currency.trim().toUpperCase();
  const curOk = /^[A-Z]{3}$/.test(cur);
  const minor = curOk ? parseMajorToMinor(d.amount, cur) : null;
  const ids = members.map((m) => m.userId);
  // Members first, in the group's order; then anyone in a stored split who has since left, so an edit shows them honestly.
  const people = d.everyone && d.mode === "equal" ? ids : [...ids.filter((id) => d.chosen.includes(id)), ...d.chosen.filter((id) => !ids.includes(id))];
  const check = checkSplit({ mode: d.mode, totalMinor: minor, currency: cur || groupCurrency, payerUserId: d.payer, people, inputs: d.inputs });
  const byId = new Map(members.map((m) => [m.userId, m]));
  const preview = new Map(check.shares.map((s) => [s.userId, s.shareMinor]));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(d.date);
  const ready = !!minor && !!d.payer && check.ok && dateOk && !busy;
  const isEdit = !!editing;

  const choose = (id: string) => {
    const has = d.chosen.includes(id);
    const chosen = has ? d.chosen.filter((x) => x !== id) : [...d.chosen, id];
    set({ chosen, everyone: false });
  };

  const setMode = (mode: SplitMode) => {
    if (mode === d.mode) return;
    const list = d.everyone ? ids : people;
    // Percent starts even (and always sums); exact starts empty with the total in view.
    set({ mode, everyone: mode === "equal" ? d.everyone : false, chosen: list, inputs: mode === "percent" ? evenPercents(list) : {} });
  };

  const remainderLine = (() => {
    if (check.ok || !curOk) return null;
    switch (check.reason) {
      case "percent_left":
        return `${bpText(check.leftBp ?? 0n)}% left to give. It has to be exactly 100%.`;
      case "percent_over":
        return `${bpText(-(check.leftBp ?? 0n))}% too much. It has to be exactly 100%.`;
      case "all_zero":
        return d.mode === "percent" ? "100% required." : minor ? `${moneyText(minor, cur)} left to give.` : null;
      case "amount_left":
        return `${moneyText(check.leftMinor ?? 0n, cur)} left to give.`;
      case "amount_over":
        return `${moneyText(-(check.leftMinor ?? 0n), cur)} more than the total.`;
      case "bad_input":
        return d.mode === "percent" ? "A percentage is 0 to 100, with at most two decimals." : `An amount in ${cur} has at most the decimals ${cur} has.`;
      case "no_people":
        return "Choose at least one person.";
      default:
        return null;
    }
  })();

  const body = () => ({
    amountMinor: minor!,
    currency: cur,
    description: d.title.trim() || null,
    place: d.place.trim() || null,
    spentAt: d.date,
    split: splitBody({ mode: d.mode, totalMinor: minor, currency: cur, payerUserId: d.payer, people, inputs: d.inputs }, d.everyone && d.mode === "equal" && !isEdit),
  });

  const putReceipt = async (id: string, blob: Blob) => {
    try {
      await uploadReceipt(groupId, id, blob);
      onSaved(id);
    } catch (e) {
      setReceiptProblem({ id, words: describeGroupError(e) });
    }
  };

  const submit = async () => {
    if (!ready || !minor || !d.payer) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!editing) {
        const b = body();
        const { expense } = await addExpense(groupId, { ...b, ...(d.payer !== meId ? { payerUserId: d.payer } : {}) }, key);
        if (receipt) await putReceipt(expense.id, receipt);
        else onSaved(expense.id);
        return;
      }
      const b = body();
      const was = draftFrom(editing, members, groupCurrency);
      const wasSplit = canonical(splitBody({ mode: was.mode, totalMinor: parseMajorToMinor(was.amount, was.currency), currency: was.currency, payerUserId: was.payer, people: was.chosen, inputs: was.inputs }, false));
      // Compared in a fixed order: the form lists people in the group's order, the server stores them sorted.
      const moneyChanged = b.amountMinor !== editing.amountMinor || b.currency !== editing.currency.toUpperCase() || canonical(b.split) !== wasSplit;
      const patch: Parameters<typeof updateExpense>[2] = {};
      if ((editing.description ?? "") !== (b.description ?? "")) patch.description = b.description;
      if ((editing.place ?? "") !== (b.place ?? "")) patch.place = b.place;
      if (isoToDateInput(editing.spentAt) !== b.spentAt) patch.spentAt = b.spentAt;
      if (moneyChanged) {
        patch.amountMinor = b.amountMinor;
        patch.currency = b.currency;
        patch.split = b.split;
      }
      if (Object.keys(patch).length === 0) {
        onSaved(editing.id);
        return;
      }
      await updateExpense(groupId, editing.id, patch);
      onSaved(editing.id);
    } catch (e) {
      if (e instanceof HoldApiError && e.detail === "expense_locked_by_settlement") setLocked(true);
      setNotice(describeGroupError(e));
    } finally {
      setBusy(false);
    }
  };

  /** The way out of the lock: delete it, then the same form adds it again with what was typed. */
  const deleteAndReAdd = async () => {
    if (!editing) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteExpense(groupId, editing.id);
      setEditing(undefined);
      setLocked(false);
      setKey(newClientKey("expense"));
      setNotice(null);
    } catch (e) {
      setNotice(describeGroupError(e));
    } finally {
      setBusy(false);
    }
  };

  if (receiptProblem) {
    return (
      <Sheet title="Expense added" onClose={() => onSaved(receiptProblem.id)} busy={busy}>
        <Notice>The expense is in the group, but the receipt didn&apos;t upload. {receiptProblem.words}</Notice>
        <div className="flex gap-2">
          <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => onSaved(receiptProblem.id)}>
            Skip the receipt
          </button>
          <button
            type="button"
            className={`${plateWhite} flex-1`}
            disabled={busy || !receipt}
            onClick={() => {
              if (!receipt) return;
              setBusy(true);
              setReceiptProblem(null);
              void putReceipt(receiptProblem.id, receipt).finally(() => setBusy(false));
            }}
          >
            {busy ? "Uploading…" : "Retry receipt"}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={isEdit ? "Edit expense" : existing ? "Add it again" : "Add expense"} onClose={onCancel} busy={busy} wide>
      {!isEdit && existing ? <Notice tone="calm">The old one is deleted. Check the details and add it again.</Notice> : null}

      <div className="flex gap-2">
        <input
          value={d.amount}
          onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, "").slice(0, 18) })}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          autoFocus={!isEdit}
          disabled={busy}
          className={`${inputCls} font-extrabold tabular-nums`}
        />
        <div className="w-[84px] shrink-0">
          <CurrencyInput value={d.currency} onChange={(v) => set({ currency: v })} disabled={busy} label="Currency it was paid in" />
        </div>
      </div>
      {d.amount && !minor ? (
        <p className="-mt-1.5 px-1 text-[12px] text-amber">{curOk ? `Type an amount in ${cur}, with at most the decimals it has.` : "A currency is a three-letter code, like USD or EUR."}</p>
      ) : curOk && cur !== groupCurrency ? (
        <p className="-mt-1.5 px-1 text-[12px] text-white/55">The group keeps {groupCurrency}. This is converted once, at the rate of the day it is added.</p>
      ) : null}

      <input value={d.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} placeholder="Title, like Dinner" aria-label="Title" disabled={busy} className={inputCls} />
      <div className="flex gap-2">
        <input value={d.place} onChange={(e) => set({ place: e.target.value.slice(0, 120) })} placeholder="Place (optional)" aria-label="Place" disabled={busy} className={inputCls} />
        <input
          type="date"
          value={d.date}
          max={todayLocal()}
          onChange={(e) => set({ date: e.target.value })}
          aria-label="Date"
          disabled={busy}
          className={`${inputCls} w-[150px] shrink-0 [color-scheme:dark]`}
        />
      </div>

      {!isEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <PhotoButton label={receipt ? "Change receipt" : "Add receipt photo"} icon="receipt-outline" onPicked={setReceipt} onError={setNotice} disabled={busy} />
          {receiptUrl ? (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Receipt" className="h-9 w-9 rounded-[8px] object-cover" />
              <button type="button" onClick={() => setReceipt(null)} className="rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-white/70 hover:bg-white/10 hover:text-white">
                Remove
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <p className={sectionLabel}>Who paid</p>
      {isEdit ? (
        <div className="flex items-center gap-2">
          <PersonFace person={byId.get(editing!.payerUserId)} size={26} />
          <span className="text-[14px] font-bold text-white">{editing!.payerUserId === meId ? "You" : memberName(byId.get(editing!.payerUserId))}</span>
        </div>
      ) : (
        <ChipRow label="Who paid">
          {members.map((m) => (
            <Chip key={m.userId} label={m.userId === meId ? "Me" : memberName(m)} selected={d.payer === m.userId} onClick={() => set({ payer: m.userId })} disabled={busy} />
          ))}
        </ChipRow>
      )}

      <p className={sectionLabel}>Split</p>
      <ChipRow label="How to split">
        {MODES.map((m) => (
          <Chip key={m.value} label={m.label} selected={d.mode === m.value} onClick={() => setMode(m.value)} disabled={busy} />
        ))}
      </ChipRow>
      {d.mode === "equal" ? (
        <ChipRow label="Who shares it">
          <Chip label="Everyone" selected={d.everyone} onClick={() => set({ everyone: true, chosen: ids })} disabled={busy} />
          <Chip label="Choose people" selected={!d.everyone} onClick={() => set({ everyone: false, chosen: d.everyone ? ids : d.chosen })} disabled={busy} />
        </ChipRow>
      ) : null}

      <div className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/[0.04] p-1.5">
        {[...ids, ...d.chosen.filter((id) => !ids.includes(id))].map((id) => {
          const m = byId.get(id);
          const inSplit = people.includes(id);
          const showToggle = !(d.mode === "equal" && d.everyone);
          const share = preview.get(id);
          const bad = !check.ok && check.reason === "bad_input" && check.badUserIds?.includes(id);
          return (
            <div key={id} className={`flex min-w-0 items-center gap-2 rounded-[10px] px-1.5 py-1.5 ${inSplit ? "" : "opacity-55"}`}>
              {showToggle ? (
                <button
                  type="button"
                  onClick={() => choose(id)}
                  disabled={busy}
                  aria-pressed={inSplit}
                  aria-label={`${inSplit ? "Leave out" : "Include"} ${id === meId ? "you" : memberName(m)}`}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] ${inSplit ? "bg-[#F1F5F9] text-[#0A1420]" : "bg-white/[0.08] text-transparent"}`}
                >
                  <Ion name="checkmark" size={15} />
                </button>
              ) : null}
              <PersonFace person={m} size={28} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">
                {id === meId ? "You" : m ? memberName(m) : "Left the group"}
              </span>
              {inSplit && d.mode === "percent" ? (
                <span className={`flex h-9 w-[88px] shrink-0 items-center rounded-[10px] border bg-white/[0.06] px-2 ${bad ? "border-amber" : "border-white/[0.12]"}`}>
                  <input
                    value={d.inputs[id] ?? ""}
                    onChange={(e) => set({ inputs: { ...d.inputs, [id]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) } })}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Percent for ${id === meId ? "you" : memberName(m)}`}
                    disabled={busy}
                    className="min-w-0 flex-1 bg-transparent text-right text-[14px] font-bold tabular-nums text-white outline-none"
                  />
                  <span className="pl-1 text-[13px] text-white/60">%</span>
                </span>
              ) : null}
              {inSplit && d.mode === "exact" ? (
                <input
                  value={d.inputs[id] ?? ""}
                  onChange={(e) => set({ inputs: { ...d.inputs, [id]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 18) } })}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Amount for ${id === meId ? "you" : memberName(m)}`}
                  disabled={busy}
                  className={`h-9 w-[104px] shrink-0 rounded-[10px] border bg-white/[0.06] px-2 text-right text-[14px] font-bold tabular-nums text-white outline-none ${bad ? "border-amber" : "border-white/[0.12]"}`}
                />
              ) : null}
              {inSplit && d.mode !== "exact" ? (
                <span className="w-[76px] shrink-0 text-right text-[13px] tabular-nums text-white/70">{share !== undefined && curOk ? moneyText(share, cur).replace(` ${cur}`, "") : "–"}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className={`px-1 text-[12.5px] ${remainderLine && !check.ok && check.reason !== "no_amount" ? "text-amber" : "text-white/55"}`}>
        {remainderLine ??
          (check.ok
            ? `${people.length} ${people.length === 1 ? "person" : "people"}${curOk ? `, shown in ${cur}` : ""}. The server confirms the split when it is saved.`
            : "Type the amount to see each part.")}
      </p>

      {notice ? <Notice>{notice}</Notice> : null}
      {locked && editing ? (
        <button type="button" className={plateCaution} disabled={busy} onClick={() => void deleteAndReAdd()}>
          <Ion name="trash-outline" size={16} />
          Delete it and add it again
        </button>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`${plateWhite} flex-1`} onClick={() => void submit()} disabled={!ready}>
          {busy ? "Saving…" : isEdit ? "Save" : "Add expense"}
        </button>
      </div>
    </Sheet>
  );
}

/* ── The detail ───────────────────────────────────────────────────── */

const MODE_WORDS: Record<string, string> = { equal: "Split equally", percent: "Split by percent", exact: "Split by exact amounts" };

export function ExpenseDetail({
  groupId,
  expenseId,
  groupCurrency,
  members,
  meId,
  onClose,
  onChanged,
}: {
  groupId: string;
  expenseId: string;
  groupCurrency: string;
  members: GroupMember[];
  meId: string | null;
  onClose: () => void;
  /** Something moved money or text: the thread and balances re-read. */
  onChanged: () => void;
}) {
  const ex = useExpense(groupId, expenseId);
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const byId = new Map(members.map((m) => [m.userId, m]));
  const e = ex.data;
  const gone = ex.error instanceof HoldApiError && (ex.error.detail === "expense_deleted" || ex.error.status === 404);

  if (e && mode === "edit") {
    return (
      <ExpenseForm
        groupId={groupId}
        groupCurrency={groupCurrency}
        members={members}
        meId={meId}
        existing={e}
        onCancel={() => setMode("view")}
        onSaved={(id) => {
          onChanged();
          if (id !== e.id) onClose();
          else {
            setMode("view");
            void ex.mutate();
          }
        }}
      />
    );
  }

  const mine = !!e && e.payerUserId === meId;
  const part = e ? expenseForMe({ userId: e.payerUserId, groupMinor: e.groupMinor, shares: e.shares }, meId) : null;

  const receiptAction = (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    fn()
      .then(() => void ex.mutate())
      .catch((err) => setNotice(describeGroupError(err)))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet title={e?.description?.trim() || "Expense"} onClose={onClose} busy={busy} wide>
      {ex.data === undefined && !ex.error ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-40 rounded-[10px]" />
          <Skeleton className="h-24 rounded-[14px]" />
        </div>
      ) : null}
      {gone ? <Notice tone="calm">This expense was deleted.</Notice> : null}
      {ex.error && !gone && !e ? <LoadFailed words={describeGroupError(ex.error)} onRetry={() => void ex.mutate()} /> : null}

      {e ? (
        <>
          <div className="flex flex-col gap-0.5">
            <p className="text-[28px] font-extrabold tabular-nums tracking-[-0.6px] text-white">{moneyText(e.amountMinor, e.currency)}</p>
            {e.currency.toUpperCase() !== groupCurrency ? (
              <p className="text-[12.5px] text-white/60">
                {moneyText(e.groupMinor, groupCurrency)} in the group{e.fxAsOf ? `, at the rate of ${e.fxAsOf}` : ""}
              </p>
            ) : null}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/75">
              <span>
                {e.payerUserId === meId ? "You" : memberName(byId.get(e.payerUserId))} paid · {new Date(e.spentAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {e.place ? (
                <span className="inline-flex items-center gap-1">
                  <Ion name="location-outline" size={13} />
                  {e.place}
                </span>
              ) : null}
              {e.edited ? <Tag label="Edited" tone="dim" /> : null}
            </p>
            {part && part.kind !== "none" ? (
              <p className="mt-1 text-[14px] font-bold tabular-nums text-white">
                {part.kind === "share" ? `Your part ${moneyText(part.minor, groupCurrency)}` : `You lent ${moneyText(part.minor, groupCurrency)}`}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/[0.04] p-2">
            <p className="px-1 pb-1 text-[12px] font-bold text-white/60">{e.splitMode ? MODE_WORDS[e.splitMode] : "The split"}</p>
            {e.shares.map((s) => {
              const pct = e.splitMode === "percent" && e.splitInputs && "percents" in e.splitInputs ? e.splitInputs.percents.find((p) => p.userId === s.userId)?.percent : null;
              return (
                <div key={s.userId} className="flex min-w-0 items-center gap-2 px-1 py-1">
                  <PersonFace person={byId.get(s.userId)} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{s.userId === meId ? "You" : byId.get(s.userId) ? memberName(byId.get(s.userId)) : "Left the group"}</span>
                  {pct ? <span className="text-[12.5px] tabular-nums text-white/55">{pct}%</span> : null}
                  <span className="shrink-0 text-[14px] tabular-nums text-white">{moneyText(s.shareMinor, groupCurrency)}</span>
                </div>
              );
            })}
          </div>

          {e.receiptUrl ? (
            <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[14px] border border-white/10" aria-label="Open the receipt">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.receiptUrl} alt="Receipt" className="max-h-[320px] w-full bg-black/20 object-contain" />
            </a>
          ) : null}

          {mine ? (
            <div className="flex flex-wrap items-center gap-2">
              <PhotoButton
                label={e.receiptUrl ? "Replace receipt" : "Add receipt photo"}
                icon="receipt-outline"
                disabled={busy}
                onError={setNotice}
                onPicked={(b) => receiptAction(() => uploadReceipt(groupId, e.id, b))}
              />
              {e.receiptUrl ? (
                <button type="button" disabled={busy} onClick={() => receiptAction(() => deleteReceipt(groupId, e.id))} className="rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-white/70 hover:bg-white/10 hover:text-white">
                  Remove receipt
                </button>
              ) : null}
            </div>
          ) : null}

          {notice ? <Notice>{notice}</Notice> : null}

          {mine && mode === "delete" ? (
            <div className="flex flex-col gap-2 rounded-[14px] bg-amber/[0.08] p-3">
              <p className="text-[13.5px] text-white/[0.86]">Delete this expense for everyone? The balances change at once. It stays in the thread as removed.</p>
              <div className="flex gap-2">
                <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => setMode("view")}>
                  Keep it
                </button>
                <button
                  type="button"
                  className={`${plateCaution} flex-1`}
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setNotice(null);
                    deleteExpense(groupId, e.id)
                      .then(() => {
                        onChanged();
                        onClose();
                      })
                      .catch((err) => setNotice(describeGroupError(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : null}

          {mine && mode === "view" ? (
            <div className="flex gap-2 pt-1">
              <button type="button" className={`${plateCaution} flex-1`} disabled={busy} onClick={() => setMode("delete")}>
                <Ion name="trash-outline" size={16} />
                Delete
              </button>
              <button type="button" className={`${plateWhite} flex-1`} disabled={busy} onClick={() => setMode("edit")}>
                <Ion name="create-outline" size={16} />
                Edit
              </button>
            </div>
          ) : null}
          {!mine ? <p className="text-[12px] text-white/55">Only the person who paid can edit or delete it.</p> : null}
        </>
      ) : null}
    </Sheet>
  );
}
