"use client";

/**
 * A group's three sheets: Balances (settle up), People, and Settings.
 *
 * BALANCES: NOBODY IS MADE TO PAY
 *
 * The contract's product rule (groups-splitwise-grade.md, top): a debt is a
 * pending request and nothing more. So every line here reads as a request,
 * never as a charge, and the creditor has exactly two things they can do
 * about "@bea owes you 15.00":
 *
 *   Mark as paid   they were paid another way (cash, a bank transfer). Prefilled
 *                  with what the plan says is owed; a smaller amount is fine.
 *                  The thread shows it as the creditor's word.
 *   Remind         one push to the debtor, at most once a day for this pair,
 *                  never written to the thread. After it is sent, or when it is
 *                  too soon, the line says when it can be sent again.
 *
 * What YOU owe keeps today's two honest ways (see GroupThread's header): pay
 * in the HOLD app, which checks the payment, or record that you paid another
 * way. The web does not send a group payment.
 */

import { useState, type ReactNode } from "react";

import {
  addMember,
  absMinor,
  deleteGroup,
  deleteGroupPhoto,
  describeGroupError,
  markPaid,
  memberName,
  moneyText,
  minorToInput,
  newClientKey,
  parseMajorToMinor,
  recordPaidElsewhere,
  remind,
  removeMember,
  toBig,
  updateGroup,
  uploadGroupPhoto,
  type GroupBalances,
  type GroupMember,
  type GroupRow,
  type NameOf,
  type Person,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";

import { btnGlass, Notice, Switch } from "../hold";
import { Ion } from "../ion";
import { Modal } from "../Modal";
import { inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { DirectoryPicker } from "./DirectoryPicker";
import { CurrencyInput, FacePicker, LoadFailed, PersonFace, pillGlass, pillWhite, plateCaution, plateWhite, sectionLabel, Sheet } from "./group-kit";

type Names = { name: NameOf; subject: NameOf };
type Transfer = GroupBalances["transfers"][number];

/* ── Balances ─────────────────────────────────────────────────────── */

export function BalancesSheet({
  groupId,
  balances,
  loadError,
  onRetry,
  members,
  meId,
  names,
  onClose,
  onChanged,
}: {
  groupId: string;
  balances: GroupBalances | undefined;
  loadError: unknown;
  onRetry: () => void;
  members: GroupMember[] | undefined;
  meId: string | null;
  names: Names;
  onClose: () => void;
  onChanged: () => void;
}) {
  const byId = new Map((members ?? []).map((m) => [m.userId, m]));
  const cur = balances?.currency ?? "USD";
  const iOwe = balances?.transfers.filter((t) => t.fromUserId === meId) ?? [];
  const owedMe = balances?.transfers.filter((t) => t.toUserId === meId) ?? [];
  const others = balances?.transfers.filter((t) => t.fromUserId !== meId && t.toUserId !== meId) ?? [];

  return (
    <Sheet title="Balances" onClose={onClose} wide>
      {balances === undefined && !loadError ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-[14px]" />
          <Skeleton className="h-16 rounded-[14px]" />
        </div>
      ) : null}
      {loadError && !balances ? <LoadFailed words={describeGroupError(loadError)} onRetry={onRetry} /> : null}

      {balances ? (
        <>
          {balances.transfers.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.05] px-3 py-3">
              <Ion name="checkmark-circle-outline" size={20} className="text-[#2FBE8A]" />
              <p className="text-[14px] font-bold text-white">Everyone is settled up.</p>
            </div>
          ) : null}

          {owedMe.length ? <p className={sectionLabel}>Owed to you</p> : null}
          {owedMe.map((t) => (
            <OwedRow key={`o:${t.fromUserId}`} groupId={groupId} currency={cur} transfer={t} person={byId.get(t.fromUserId)} names={names} onChanged={onChanged} />
          ))}

          {iOwe.length ? <p className={sectionLabel}>You owe</p> : null}
          {iOwe.map((t) => (
            <OweRow key={`i:${t.toUserId}`} groupId={groupId} currency={cur} transfer={t} person={byId.get(t.toUserId)} names={names} onRecorded={onChanged} />
          ))}

          {others.length ? <p className={sectionLabel}>Between others</p> : null}
          {others.map((t) => (
            <div key={`x:${t.fromUserId}:${t.toUserId}`} className="flex min-w-0 items-center gap-2.5 rounded-[14px] bg-white/[0.04] px-3 py-2.5">
              <PersonFace person={byId.get(t.fromUserId)} size={26} />
              <p className="min-w-0 flex-1 text-[13.5px] text-white/[0.82]">
                {names.subject(t.fromUserId)} owes {names.name(t.toUserId)} <span className="font-bold tabular-nums text-white">{moneyText(t.amountMinor, cur)}</span>
              </p>
            </div>
          ))}

          <p className="px-1 text-[12px] leading-[17px] text-white/55">
            {balances.smartSettle ? "Debts are simplified across the group, so there are as few payments as possible. " : ""}
            Nobody is made to pay. A debt stays a request until it is paid or marked as paid.
          </p>
        </>
      ) : null}
    </Sheet>
  );
}

function whenText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "tomorrow";
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

/** "@bea owes you 15.00": Mark as paid, and Remind. */
function OwedRow({
  groupId,
  currency,
  transfer,
  person,
  names,
  onChanged,
}: {
  groupId: string;
  currency: string;
  transfer: Transfer;
  person: GroupMember | undefined;
  names: Names;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<"idle" | "mark">("idle");
  const [amount, setAmount] = useState(() => minorToInput(transfer.amountMinor, currency));
  const [busy, setBusy] = useState<"mark" | "remind" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reminded, setReminded] = useState<{ next: string; delivered: boolean | null } | null>(null);
  // One key per "mark as paid" the person opens: a retry after a lost answer is the same settlement.
  const [key, setKey] = useState(() => newClientKey("markpaid"));
  const who = names.name(transfer.fromUserId);
  const minor = parseMajorToMinor(amount, currency);
  const over = minor !== null && toBig(minor) > toBig(transfer.amountMinor);

  const doMark = () => {
    if (!minor || over) return;
    setBusy("mark");
    setNotice(null);
    markPaid(groupId, { fromUserId: transfer.fromUserId, amountMinor: minor }, key)
      .then(() => {
        setStep("idle");
        setKey(newClientKey("markpaid"));
        onChanged();
      })
      .catch((e) => {
        if (e instanceof HoldApiError && e.detail === "amount_exceeds_debt" && typeof e.details?.owedMinor === "string") {
          setNotice(`That's more than they owe you now, which is ${moneyText(e.details.owedMinor, currency)}.`);
          setAmount(minorToInput(e.details.owedMinor, currency));
        } else setNotice(describeGroupError(e));
        if (e instanceof HoldApiError && e.detail === "nothing_owed") onChanged();
      })
      .finally(() => setBusy(null));
  };

  const doRemind = () => {
    setBusy("remind");
    setNotice(null);
    remind(groupId, transfer.fromUserId)
      .then((r) => setReminded({ next: r.nextAllowedAt, delivered: r.delivered }))
      .catch((e) => {
        if (e instanceof HoldApiError && e.status === 429 && typeof e.details?.nextAllowedAt === "string") {
          setReminded({ next: e.details.nextAllowedAt, delivered: null });
        } else setNotice(describeGroupError(e));
        if (e instanceof HoldApiError && e.detail === "nothing_owed") onChanged();
      })
      .finally(() => setBusy(null));
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <PersonFace person={person} size={30} />
        <p className="min-w-0 flex-1 text-[14.5px] font-bold text-white">
          {names.subject(transfer.fromUserId)} owes you <span className="tabular-nums">{moneyText(transfer.amountMinor, currency)}</span>
        </p>
        <Tag label="Pending" tone="dim" />
      </div>

      {step === "idle" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={pillWhite} disabled={!!busy} onClick={() => setStep("mark")}>
            <Ion name="checkmark" size={14} />
            Mark as paid
          </button>
          {reminded ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[18px] bg-white/[0.05] px-3 text-[12.5px] text-white/70">
              <Ion name="notifications-outline" size={14} />
              Reminded · again after {whenText(reminded.next)}
            </span>
          ) : (
            <button type="button" className={pillGlass} disabled={!!busy} onClick={doRemind}>
              <Ion name="notifications-outline" size={14} />
              {busy === "remind" ? "Sending…" : "Remind"}
            </button>
          )}
        </div>
      ) : null}
      {reminded && reminded.delivered === false ? (
        <p className="text-[12px] text-white/55">{who} has no device that takes HOLD notifications right now, so they may not see it. It still counts for today.</p>
      ) : null}

      {step === "mark" ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-[18px] text-white/[0.82]">
            {who === "Someone" ? "They" : who} paid you another way, in cash or by transfer? Everyone sees it as your word, and they&apos;re told. Less than the full amount is fine.
          </p>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 18))}
              inputMode="decimal"
              aria-label="Amount paid"
              disabled={!!busy}
              className={`${inputCls} font-extrabold tabular-nums`}
            />
            <span className="flex w-[64px] shrink-0 items-center justify-center text-[14px] font-bold text-white/75">{currency}</span>
          </div>
          {over ? <p className="text-[12px] text-amber">That&apos;s more than {moneyText(transfer.amountMinor, currency)}, what they owe you.</p> : null}
          <div className="flex gap-2">
            <button type="button" className={`${btnGlass} flex-1`} disabled={!!busy} onClick={() => setStep("idle")}>
              Cancel
            </button>
            <button type="button" className={`${plateWhite} flex-1`} disabled={!!busy || !minor || over} onClick={doMark}>
              {busy === "mark" ? "Saving…" : "Mark as paid"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/**
 * One payment the viewer owes. The web offers the app (where HOLD checks the
 * payment) and "another way", and never a send.
 */
function OweRow({
  groupId,
  currency,
  transfer,
  person,
  names,
  onRecorded,
}: {
  groupId: string;
  currency: string;
  transfer: Transfer;
  person: GroupMember | undefined;
  names: Names;
  onRecorded: () => void;
}) {
  const [step, setStep] = useState<"idle" | "app" | "confirm">("idle");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [key] = useState(() => newClientKey("settle"));
  const who = names.name(transfer.toUserId);
  const amount = moneyText(transfer.amountMinor, currency);

  const record = () => {
    setBusy(true);
    setNotice(null);
    recordPaidElsewhere(groupId, { toUserId: transfer.toUserId, amountMinor: transfer.amountMinor }, key)
      .then(() => {
        setStep("idle");
        onRecorded();
      })
      .catch((e) => setNotice(describeGroupError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <PersonFace person={person} size={30} />
        <p className="min-w-0 flex-1 text-[14.5px] font-bold text-white">
          You owe {who} <span className="tabular-nums">{amount}</span>
        </p>
        <Tag label="Request" tone="dim" />
      </div>

      {step === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pillWhite} onClick={() => setStep("app")}>
            <Ion name="phone-portrait-outline" size={14} />
            Pay in the HOLD app
          </button>
          <button type="button" className={pillGlass} onClick={() => setStep("confirm")}>
            I paid another way
          </button>
        </div>
      ) : null}

      {step === "app" ? (
        <>
          <p className="text-[13px] leading-[18px] text-white/[0.82]">
            Open this group in the HOLD app and tap Settle up. The app sends {amount} to {who} and records it here as Paid in HOLD, checked against the payment.
          </p>
          <p className="text-[12px] leading-[17px] text-white/55">Sending from the web isn&apos;t connected to groups yet, so a payment made here couldn&apos;t be checked against this group.</p>
          <button type="button" className={`${pillGlass} self-start`} onClick={() => setStep("idle")}>
            Back
          </button>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <p className="text-[13px] leading-[18px] text-white/[0.82]">
            Record that you paid {who} {amount} outside HOLD, in cash or another app? Everyone in the group sees it as your word, not as a payment HOLD checked, and {who} is told.
          </p>
          {notice ? <Notice>{notice}</Notice> : null}
          <div className="flex gap-2">
            <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => setStep("idle")}>
              Cancel
            </button>
            <button type="button" className={`${plateWhite} flex-1`} disabled={busy} onClick={record}>
              {busy ? "Recording…" : "Record it"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── People ───────────────────────────────────────────────────────── */

/**
 * Who is in the group, adding people, and leaving.
 *
 * THE RULES, SAID WHERE THEY APPLY
 *
 *   The group admin is the person who made the group (the API's "creator";
 *   never called that on screen, where "creator" is the Spaces product). The
 *   admin row carries an "Admin" badge.
 *   Only the admin sees Remove on other people's rows (`403 only_creator_removes`).
 *   Anyone else can leave; the admin can't (`409 creator_cannot_leave`), and is
 *   offered Delete group instead.
 *   Nobody goes while their balance is not zero (`409 member_has_balance`):
 *   a sheet explains it, with the amount, and points at Balances.
 */
export function PeopleSheet({
  groupId,
  groupName,
  members,
  membersError,
  onRetry,
  meId,
  adminId,
  onClose,
  onAdded,
  onLeft,
  onOpenBalances,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[] | undefined;
  membersError: unknown;
  onRetry: () => void;
  meId: string | null;
  /** The person who made the group. */
  adminId: string | null;
  onClose: () => void;
  onAdded: () => void;
  /** You left, or deleted the group: the thread is no longer yours. */
  onLeft: () => void;
  onOpenBalances: () => void;
}) {
  const [picked, setPicked] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ text: string; good: boolean }[]>([]);
  const [ask, setAsk] = useState<null | { kind: "remove"; member: GroupMember } | { kind: "leave" } | { kind: "delete" } | { kind: "balance"; who: string; you: boolean; minor: string | null; currency: string | null }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const exclude = [...(members ?? []).map((m) => m.userId), ...(meId ? [meId] : [])];
  const iAmAdmin = !!meId && meId === adminId;
  const byId = new Map((members ?? []).map((m) => [m.userId, m]));

  const add = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    const out: { text: string; good: boolean }[] = [];
    const left: Person[] = [];
    // One at a time: each is its own write, and one refusal must not hide the others.
    for (const p of picked) {
      try {
        await addMember(groupId, p.id);
        out.push({ text: `${memberName(p)} is in the group.`, good: true });
      } catch (e) {
        out.push({ text: `${memberName(p)}: ${describeGroupError(e)}`, good: false });
        left.push(p);
      }
    }
    setLines(out);
    setPicked(left);
    setBusy(false);
    if (out.some((l) => l.good)) onAdded();
  };

  /** Remove somebody (the admin), or leave (your own id). */
  const takeOut = async (userId: string) => {
    setBusy(true);
    setNotice(null);
    const you = userId === meId;
    try {
      await removeMember(groupId, userId);
      setAsk(null);
      if (you) onLeft();
      else {
        setLines([{ text: `${memberName(byId.get(userId))} is out of the group.`, good: true }]);
        onAdded();
      }
    } catch (e) {
      if (e instanceof HoldApiError && e.detail === "member_has_balance") {
        const d = (e.details ?? {}) as { balanceMinor?: string; currency?: string };
        setAsk({ kind: "balance", who: you ? "You" : memberName(byId.get(userId)), you, minor: typeof d.balanceMinor === "string" ? d.balanceMinor : null, currency: typeof d.currency === "string" ? d.currency : null });
      } else {
        setAsk(null);
        setNotice(describeGroupError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await deleteGroup(groupId);
      setAsk(null);
      onLeft();
    } catch (e) {
      setAsk(null);
      setNotice(describeGroupError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = (title: string, body: ReactNode, action: string, run: () => void) => (
    <Modal
      title={title}
      onClose={() => setAsk(null)}
      busy={busy}
      size="sm"
      footer={
        <div className="flex gap-2">
          <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => setAsk(null)}>
            Cancel
          </button>
          <button type="button" className={`${plateCaution} flex-1`} disabled={busy} onClick={run}>
            {busy ? "One moment…" : action}
          </button>
        </div>
      }
    >
      {body}
    </Modal>
  );

  return (
    <Sheet title="People" onClose={onClose} busy={busy} wide>
      {members === undefined && !membersError ? <Skeleton className="h-10 rounded-[12px]" /> : null}
      {membersError && !members ? <LoadFailed words="Could not load who's in the group." onRetry={onRetry} /> : null}
      <div className="flex flex-col gap-2">
        {members?.map((m) => {
          const admin = m.userId === adminId || !!m.isCreator;
          return (
            <div key={m.userId} className="flex min-h-[44px] min-w-0 items-center gap-2.5">
              <PersonFace person={m} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14.5px] font-bold text-white">{m.displayName?.trim() || memberName(m)}</span>
                {m.aliasHandle ? <span className="truncate text-[12px] text-white/55">@{m.aliasHandle.replace(/^@+/, "")}</span> : null}
              </span>
              {admin ? <Tag label="Admin" tone="dim" /> : null}
              {m.userId === meId ? <Tag label="You" tone="dim" /> : null}
              {iAmAdmin && m.userId !== meId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAsk({ kind: "remove", member: m })}
                  className="rounded-[12px] px-2.5 py-1.5 text-[12.5px] font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={`Remove ${memberName(m)}`}
                >
                  Remove
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {!iAmAdmin && members?.length ? <p className="text-[12px] text-white/50">Only the group admin can remove people.</p> : null}

      <p className={`${sectionLabel} pt-1`}>Add people</p>
      <DirectoryPicker selected={picked} onChange={setPicked} exclude={exclude} disabled={busy} />
      {lines.map((l, i) =>
        l.good ? (
          <Notice key={i} tone="good" icon="checkmark-circle-outline">
            {l.text}
          </Notice>
        ) : (
          <Notice key={i}>{l.text}</Notice>
        ),
      )}
      {picked.length ? (
        <button type="button" className={plateWhite} disabled={busy} onClick={() => void add()}>
          {busy ? "Adding…" : `Add ${picked.length === 1 ? memberName(picked[0]) : `${picked.length} people`}`}
        </button>
      ) : null}

      {notice ? <Notice>{notice}</Notice> : null}

      {members && meId ? (
        <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
          {iAmAdmin ? (
            <>
              <p className="text-[12.5px] leading-[17px] text-white/55">You&apos;re the group admin. The admin can&apos;t leave; delete the group instead.</p>
              <button type="button" className={plateCaution} disabled={busy} onClick={() => setAsk({ kind: "delete" })}>
                <Ion name="trash-outline" size={16} />
                Delete group
              </button>
            </>
          ) : (
            <button type="button" className={plateCaution} disabled={busy} onClick={() => setAsk({ kind: "leave" })}>
              <Ion name="log-out-outline" size={16} />
              Leave group
            </button>
          )}
        </div>
      ) : null}

      {ask?.kind === "remove"
        ? confirm(
            `Remove ${memberName(ask.member)}?`,
            <p className="text-[14px] leading-[20px] text-white/[0.78]">They leave {groupName} and stop seeing it. Their expenses stay in the conversation. Someone who still owes or is owed money can&apos;t be removed until it&apos;s settled.</p>,
            "Remove",
            () => void takeOut(ask.member.userId),
          )
        : null}
      {ask?.kind === "leave"
        ? confirm(
            "Leave the group?",
            <p className="text-[14px] leading-[20px] text-white/[0.78]">You stop seeing {groupName}. You can only leave once your balance here is zero. Someone in it can add you back.</p>,
            "Leave",
            () => meId && void takeOut(meId),
          )
        : null}
      {ask?.kind === "delete"
        ? confirm(
            "Delete the group?",
            <p className="text-[14px] leading-[20px] text-white/[0.78]">{groupName} goes for everyone: the conversation, the expenses and the balances. This can&apos;t be undone.</p>,
            "Delete group",
            () => void removeGroup(),
          )
        : null}
      {ask?.kind === "balance" ? (
        <Modal
          title={ask.you ? "Settle up before you leave" : "Settle up first"}
          onClose={() => setAsk(null)}
          size="sm"
          footer={
            <div className="flex gap-2">
              <button type="button" className={`${btnGlass} flex-1`} onClick={() => setAsk(null)}>
                OK
              </button>
              <button
                type="button"
                className={`${plateWhite} flex-1`}
                onClick={() => {
                  setAsk(null);
                  onOpenBalances();
                }}
              >
                See balances
              </button>
            </div>
          }
        >
          <p className="text-[14px] leading-[20px] text-white/[0.78]">
            {ask.you ? "You" : ask.who}{" "}
            {ask.minor && ask.currency
              ? toBig(ask.minor) < 0n
                ? `${ask.you ? "still owe" : "still owes"} ${moneyText(absMinor(ask.minor), ask.currency)} in this group.`
                : `${ask.you ? "are" : "is"} still owed ${moneyText(absMinor(ask.minor), ask.currency)} in this group.`
              : `${ask.you ? "still have" : "still has"} money owed in this group, one way or the other.`}
          </p>
          <p className="text-[14px] leading-[20px] text-white/[0.78]">
            Nobody leaves a group with an open balance, so nothing is lost. Once it&apos;s settled (paid in HOLD, or marked as paid by the person owed) it&apos;s one tap.
          </p>
        </Modal>
      ) : null}
    </Sheet>
  );
}

/* ── Settings ─────────────────────────────────────────────────────── */

/**
 * Name, emoji, photo, currency and "simplify debts", for any member. The
 * currency can only change while the group has no expense and no settlement;
 * the server is the one that knows, so a refusal (`currency_locked`) is said in
 * words and the rest of the change still saves.
 */
export function SettingsSheet({ groupId, group, onClose, onSaved }: { groupId: string; group: GroupRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji ?? "👥");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [currency, setCurrency] = useState((group.currency ?? "USD").toUpperCase());
  const [smart, setSmart] = useState(!!group.smartSettle);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const curOk = /^[A-Z]{3}$/.test(currency);
  const ready = !!name.trim() && curOk && !busy;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setNotice(null);
    setSaved(false);
    const problems: string[] = [];
    const patch: Parameters<typeof updateGroup>[1] = {};
    if (name.trim() !== group.name) patch.name = name.trim();
    if (emoji !== (group.emoji ?? "")) patch.emoji = emoji;
    if (smart !== !!group.smartSettle) patch.smartSettle = smart;
    const currencyChanged = currency !== (group.currency ?? "USD").toUpperCase();
    try {
      if (Object.keys(patch).length) await updateGroup(groupId, patch);
    } catch (e) {
      problems.push(describeGroupError(e));
    }
    // Apart, so a locked currency never takes the name and emoji down with it.
    if (currencyChanged) {
      try {
        await updateGroup(groupId, { currency });
      } catch (e) {
        problems.push(describeGroupError(e));
        if (e instanceof HoldApiError && e.detail === "currency_locked") setCurrency((group.currency ?? "USD").toUpperCase());
      }
    }
    try {
      if (photo) await uploadGroupPhoto(groupId, photo);
      else if (removePhoto && group.photoUrl) await deleteGroupPhoto(groupId);
    } catch (e) {
      problems.push(`The photo: ${describeGroupError(e)}`);
    }
    setBusy(false);
    onSaved();
    if (problems.length) setNotice(problems.join(" "));
    else {
      setPhoto(null);
      setRemovePhoto(false);
      setSaved(true);
    }
  };

  return (
    <Sheet title="Group settings" onClose={onClose} busy={busy} wide>
      <FacePicker
        name={name}
        emoji={emoji}
        onEmoji={setEmoji}
        photo={photo}
        onPhoto={(b) => {
          setPhoto(b);
          if (b) setRemovePhoto(false);
        }}
        photoUrl={removePhoto ? null : group.photoUrl}
        onRemovePhoto={() => setRemovePhoto(true)}
        disabled={busy}
      />
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} aria-label="Group name" disabled={busy} className={inputCls} />

      <div className="flex items-center gap-3">
        <div className="w-[84px] shrink-0">
          <CurrencyInput value={currency} onChange={setCurrency} disabled={busy} label="The group's currency" />
        </div>
        <p className="min-w-0 flex-1 text-[12px] leading-[17px] text-white/55">The currency balances are kept in. It can change until the first expense or settlement.</p>
      </div>

      <div className="flex items-center gap-3 rounded-[14px] bg-white/[0.04] px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-bold text-white">Simplify debts</span>
          <span className="text-[12px] text-white/55">Fewer payments, netted across the group.</span>
        </span>
        <Switch checked={smart} onChange={setSmart} label="Simplify debts" disabled={busy} />
      </div>

      {notice ? <Notice>{notice}</Notice> : null}
      {saved ? (
        <Notice tone="good" icon="checkmark-circle-outline">
          Saved.
        </Notice>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onClose} disabled={busy}>
          Close
        </button>
        <button type="button" className={`${plateWhite} flex-1`} onClick={() => void save()} disabled={!ready}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}
