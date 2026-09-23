"use client";

/**
 * An expense, opened (groups-splitwise-grade.md §4): the amount, who paid,
 * its category, each person's part, what it was split from, and the receipt,
 * which opens full screen in the receipt viewer. The payer edits it (the
 * add-expense flow, opened on Split bill: AddExpense.tsx) or deletes it, after
 * a sheet that says what deleting does.
 *
 * An expense of several bills (§10.1) says "N bills", which opens BillsModal:
 * every bill with its amount, the total, and what each person owes, yours
 * picked out. The thread's card opens the same modal.
 */

import { useState } from "react";

import {
  CATEGORY_LABEL,
  deleteExpense,
  deleteReceipt,
  describeGroupError,
  expenseBills,
  expenseCategory,
  expenseForMe,
  memberName,
  moneyText,
  toBig,
  uploadReceipt,
  useExpense,
  type Expense,
  type ExpenseBill,
  type ExpenseItem,
  type ExpenseSource,
  type GroupMember,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";

import { btnGlass, Notice } from "../hold";
import { Ion, type IonName } from "../ion";
import { Modal } from "../Modal";
import { Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { AddExpenseFlow } from "./AddExpense";
import { CATEGORY_ICON, LoadFailed, PersonFace, PhotoButton, plateCaution, plateWhite, Sheet } from "./group-kit";

/* ── The receipt, full screen ─────────────────────────────────────── */

/**
 * A receipt photo, as big as the screen allows, on black. Escape, the backdrop
 * or the close button shut it; on a phone it can be dragged down. The link is
 * signed for about an hour, so "Open original" opens that same link.
 */
export function ReceiptViewer({ url, title, onClose }: { url: string; title?: string | null; onClose: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <Modal onClose={onClose} title={title?.trim() ? `Receipt · ${title.trim()}` : "Receipt"} hideTitle bare size="full" showClose={false}>
      <div className="relative flex h-full min-h-[70dvh] flex-1 flex-col bg-black/90 sm:rounded-[24px]">
        <div className="flex shrink-0 items-center justify-between gap-2 p-3">
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[20px] bg-white/[0.1] px-3.5 text-[13.5px] font-bold text-white hover:bg-white/[0.16]">
            <Ion name="open-outline" size={15} />
            Open original
          </a>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.1] text-white hover:bg-white/[0.16]">
            <Ion name="close" size={20} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-3 pt-0">
          {broken ? (
            <p className="max-w-[300px] text-center text-[14px] text-white/70">This link has expired. Close it and open the expense again for a fresh one.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title?.trim() ? `Receipt for ${title.trim()}` : "Receipt"} onError={() => setBroken(true)} className="max-h-full max-w-full rounded-[12px] object-contain" />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── The bills of one expense ─────────────────────────────────────── */

/** What the bills modal needs, from the thread's item or the full expense. */
export interface BillsSeed {
  description: string | null;
  payerUserId: string;
  amountMinor: string;
  currency: string;
  groupMinor: string;
  shares: { userId: string; shareMinor: string }[];
  items?: ExpenseBill[];
  sources?: ExpenseSource[];
  spentAt?: string | null;
}

export function seedOf(e: ExpenseItem | Expense): BillsSeed {
  return {
    description: e.description,
    payerUserId: "payerUserId" in e ? e.payerUserId : e.userId,
    amountMinor: e.amountMinor,
    currency: e.currency,
    groupMinor: e.groupMinor,
    shares: e.shares,
    items: e.items,
    sources: e.sources,
    spentAt: e.spentAt,
  };
}

/** How many bills an expense is made of: its items, else (an older expense) its sources; 0 or 1 is a single amount. */
export function billCount(e: { items?: ExpenseBill[] | null; sources?: ExpenseSource[] | null }): number {
  const items = expenseBills(e).length;
  return items || (e.sources?.length ?? 0);
}

const SOURCE_ICON = { transfer: "arrow-forward", card: "card-outline", stay: "bed-outline" } as const;

/**
 * Every bill of one expense, the total, and what each person owes the payer
 * for it, yours picked out. Opens straight from what the thread already holds
 * and refreshes from GET expense (the thread item may carry no items on an
 * older server, the full expense does).
 */
export function BillsModal({
  groupId,
  expenseId,
  seed,
  groupCurrency,
  members,
  meId,
  onClose,
}: {
  groupId: string;
  expenseId: string;
  seed?: BillsSeed;
  groupCurrency: string;
  members: GroupMember[];
  meId: string | null;
  onClose: () => void;
}) {
  const ex = useExpense(groupId, expenseId);
  const e: BillsSeed | undefined = ex.data ? seedOf(ex.data) : seed;
  const byId = new Map(members.map((m) => [m.userId, m]));
  const nameOf = (id: string) => (id === meId ? "You" : byId.get(id) ? memberName(byId.get(id)) : "A former member");

  if (!e) {
    return (
      <Modal title="Bills" onClose={onClose} size="md">
        {ex.error ? <LoadFailed words={describeGroupError(ex.error)} onRetry={() => void ex.mutate()} /> : <Skeleton className="h-40 rounded-[14px]" />}
      </Modal>
    );
  }

  const cur = e.currency.toUpperCase();
  const items = expenseBills(e);
  const rows: { key: string; label: string; icon: IonName; amount: string | null; ccy: string | null; converted: string | null }[] = items.length
    ? items.map((it, i) => ({
        key: `i${i}`,
        label: it.label,
        icon: it.sourceKind ? SOURCE_ICON[it.sourceKind] : "document-text-outline",
        amount: it.amountMinor,
        ccy: it.currency.toUpperCase(),
        converted: it.currency.toUpperCase() !== cur && it.convertedMinor ? it.convertedMinor : null,
      }))
    : (e.sources ?? []).map((src) => ({
        key: `${src.kind}:${src.ref}`,
        label: src.label?.trim() || SOURCE_WORDS[src.kind] || "Payment",
        icon: SOURCE_ICON[src.kind] ?? "arrow-forward",
        amount: src.amountMinor ?? null,
        ccy: src.currency ? src.currency.toUpperCase() : null,
        converted: null,
      }));
  const payer = e.payerUserId;
  const mine = e.shares.find((x) => x.userId === meId);
  const part = expenseForMe({ userId: payer, groupMinor: e.groupMinor, shares: e.shares }, meId);
  const sorted = [...e.shares].sort((a, b) => (a.userId === meId ? -1 : b.userId === meId ? 1 : a.userId === payer ? -1 : b.userId === payer ? 1 : 0));

  return (
    <Modal title={e.description?.trim() || "Bills"} onClose={onClose} size="md">
      <p className="-mt-1 text-center text-[13px] text-white/60">
        {nameOf(payer)} paid {rows.length} {rows.length === 1 ? "bill" : "bills"}
        {e.spentAt ? ` · ${new Date(e.spentAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
      </p>

      <ul className="flex flex-col rounded-[16px] bg-white/[0.05] py-1" aria-label="Bills">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-[52px] items-center gap-3 px-3.5 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08] text-white/80">
              <Ion name={r.icon} size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">{r.label}</span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="text-[14.5px] tabular-nums text-white">{r.amount && r.ccy ? moneyText(r.amount, r.ccy) : "–"}</span>
              {r.converted ? <span className="text-[12px] tabular-nums text-white/50">≈ {moneyText(r.converted, cur)}</span> : null}
            </span>
          </li>
        ))}
        <li className="mx-3.5 mt-1 flex items-baseline justify-between gap-3 border-t border-white/[0.08] pb-2 pt-2.5">
          <span className="text-[14px] font-bold text-white/70">Total</span>
          <span className="text-right">
            <span className="block text-[17px] font-extrabold tabular-nums text-white">{moneyText(e.amountMinor, cur)}</span>
            {cur !== groupCurrency.toUpperCase() ? <span className="block text-[12px] tabular-nums text-white/55">{moneyText(e.groupMinor, groupCurrency)} in the group</span> : null}
          </span>
        </li>
      </ul>

      <div className="flex flex-col gap-1.5">
        <p className="px-1 text-[12.5px] font-bold text-white/[0.82]">What each person owes</p>
        {part.kind !== "none" ? (
          <p className="rounded-[14px] bg-amber/[0.12] px-3.5 py-2.5 text-[14px] font-bold tabular-nums text-amber">
            {part.kind === "share" ? `You owe ${nameOf(payer)} ${moneyText(part.minor, groupCurrency)} for this` : `The others owe you ${moneyText(part.minor, groupCurrency)} for this`}
          </p>
        ) : (
          <p className="px-1 text-[13px] text-white/60">{mine ? "Your part of this is nothing." : "You're not part of this one."}</p>
        )}
        <ul className="flex flex-col gap-1" aria-label="Shares">
          {sorted.map((sh) => {
            const you = sh.userId === meId;
            const isPayer = sh.userId === payer;
            return (
              <li key={sh.userId} className={`flex min-w-0 items-center gap-2.5 rounded-[12px] px-2.5 py-2 ${you ? "bg-white/[0.1]" : ""}`}>
                <PersonFace person={byId.get(sh.userId)} size={28} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-[14px] text-white ${you ? "font-extrabold" : "font-bold"}`}>{nameOf(sh.userId)}</span>
                  <span className="text-[12px] text-white/55">{isPayer ? "Paid, and keeps their part" : toBig(sh.shareMinor) > 0n ? `Owes ${payer === meId ? "you" : nameOf(payer)}` : "Nothing to pay"}</span>
                </span>
                <span className={`shrink-0 text-[14px] tabular-nums ${you ? "font-extrabold text-white" : "text-white/90"}`}>{moneyText(sh.shareMinor, groupCurrency)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

/* ── The detail ───────────────────────────────────────────────────── */

const MODE_WORDS: Record<string, string> = { equal: "Split equally", percent: "Split by percent", exact: "Split by amount", shares: "Split by shares" };
const SOURCE_WORDS: Record<string, string> = { transfer: "Payment", card: "Card", stay: "Stay" };

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
  const [mode, setMode] = useState<"view" | "edit" | "delete" | "receipt" | "bills">("view");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const byId = new Map(members.map((m) => [m.userId, m]));
  const e = ex.data;
  const gone = ex.error instanceof HoldApiError && (ex.error.detail === "expense_deleted" || ex.error.status === 404);

  if (e && mode === "edit") {
    return (
      <AddExpenseFlow
        groupId={groupId}
        groupCurrency={groupCurrency}
        members={members}
        meId={meId}
        existing={e}
        onClose={() => setMode("view")}
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
            {(() => {
              const c = expenseCategory(e) ?? "other";
              return (
                <span className="mt-1 inline-flex items-center gap-1.5 self-start rounded-[12px] bg-white/[0.08] px-2.5 py-1 text-[12.5px] font-bold text-white/80">
                  <Ion name={CATEGORY_ICON[c]} size={13} />
                  {CATEGORY_LABEL[c]}
                </span>
              );
            })()}
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

          {billCount(e) > 1 ? (
            <button
              type="button"
              onClick={() => setMode("bills")}
              className="flex min-h-[52px] items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 text-left transition-colors hover:bg-white/[0.1]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08] text-white/80">
                <Ion name="receipt-outline" size={15} />
              </span>
              <span className="min-w-0 flex-1 text-[14.5px] font-bold text-white">{billCount(e)} bills</span>
              <span className="text-[13px] text-white/60">See each one</span>
              <Ion name="chevron-forward" size={15} className="text-white/45" />
            </button>
          ) : null}
          {mode === "bills" ? <BillsModal groupId={groupId} expenseId={e.id} seed={seedOf(e)} groupCurrency={groupCurrency} members={members} meId={meId} onClose={() => setMode("view")} /> : null}

          {e.sources?.length && !expenseBills(e).length ? (
            <div className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/[0.04] p-2">
              <p className="px-1 pb-1 text-[12px] font-bold text-white/60">Split from</p>
              {e.sources.map((src) => (
                <div key={`${src.kind}:${src.ref}`} className="flex min-w-0 items-center gap-2 px-1 py-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.08] text-white/80">
                    <Ion name={src.kind === "stay" ? "bed-outline" : src.kind === "card" ? "card-outline" : "arrow-forward"} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-white">{src.label?.trim() || SOURCE_WORDS[src.kind] || "Payment"}</span>
                  {src.amountMinor && src.currency ? <span className="shrink-0 text-[13px] tabular-nums text-white/70">{moneyText(src.amountMinor, src.currency)}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {e.receiptUrl ? (
            <button type="button" onClick={() => setMode("receipt")} className="group relative block overflow-hidden rounded-[14px] border border-white/10" aria-label="Open the receipt full screen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.receiptUrl} alt="Receipt" className="max-h-[240px] w-full bg-black/20 object-cover transition-opacity group-hover:opacity-90" />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[12px] bg-black/60 px-2 py-1 text-[12px] font-bold text-white">
                <Ion name="receipt-outline" size={13} />
                Receipt
              </span>
            </button>
          ) : null}
          {mode === "receipt" && e.receiptUrl ? <ReceiptViewer url={e.receiptUrl} title={e.description} onClose={() => setMode("view")} /> : null}

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
            <Modal
              title="Delete this expense?"
              onClose={() => setMode("view")}
              busy={busy}
              size="sm"
              footer={
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
                        .catch((err) => {
                          setNotice(describeGroupError(err));
                          setMode("view");
                        })
                        .finally(() => setBusy(false));
                    }}
                  >
                    {busy ? "Deleting…" : "Delete for everyone"}
                  </button>
                </div>
              }
            >
              <p className="text-[14px] leading-[20px] text-white/[0.78]">The balances change at once. It stays in the conversation as removed, so everyone can see what happened.</p>
            </Modal>
          ) : null}

          {mine && mode !== "edit" ? (
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
