"use client";

/**
 * An expense, opened (groups-splitwise-grade.md §4): the amount, who paid,
 * each person's part, what it was split from, and the receipt, which opens
 * full screen in the receipt viewer. The payer edits it (the add-expense flow,
 * opened on Split bill: AddExpense.tsx) or deletes it, after a sheet that says
 * what deleting does.
 */

import { useState } from "react";

import {
  deleteExpense,
  deleteReceipt,
  describeGroupError,
  expenseForMe,
  memberName,
  moneyText,
  uploadReceipt,
  useExpense,
  type GroupMember,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";

import { btnGlass, Notice } from "../hold";
import { Ion } from "../ion";
import { Modal } from "../Modal";
import { Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { AddExpenseFlow } from "./AddExpense";
import { LoadFailed, PersonFace, PhotoButton, plateCaution, plateWhite, Sheet } from "./group-kit";

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
  const [mode, setMode] = useState<"view" | "edit" | "delete" | "receipt">("view");
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

          {e.sources?.length ? (
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
