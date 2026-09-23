"use client";

/**
 * One group, on one screen: the chat and the money together
 * (documentation/groups-thread-v0.md, and the shared UI spec the app is built
 * to at the same time).
 *
 *   header        the emoji and name, "N people", "Crew"; People on the right
 *   balance strip "You're owed 12.00 USD" / "You owe 4.00 USD" / "All settled
 *                 up", stuck under the header so it never scrolls away, with
 *                 Settle up when you owe
 *   timeline      oldest at the top, newest at the foot, a day line where the
 *                 day turns; messages as bubbles (the payment chat's own
 *                 colours, Chat.tsx), expenses and settlements as cards
 *   composer      text and Send, and "+" for an expense
 *
 * It polls every ten seconds while it is open (there is no socket for groups),
 * marks the thread read when it opens and whenever something new arrives while
 * it is on screen, and loads older items when the top of the thread is reached.
 *
 * SETTLE UP ON THE WEB, AND WHY IT DOES NOT SEND
 *
 * The spec's Settle up sends the money with the normal HOLD send to the
 * person's @handle and then records the settlement with that payment intent's
 * id, which the server checks. The web cannot do the first half. Its only send
 * is the web wallet's withdrawal (Wallet › Send): Solana only, to an address,
 * approved on a linked phone or with an iPhone passkey, and recorded as a
 * `withdrawal_requests` row. A settlement needs a `payment_intents` id, so the
 * server would refuse a withdrawal's id as `transfer_not_found`, and nothing on
 * the web makes a payment intent that a real transfer stands behind.
 *
 * So each row says so, and offers the two honest things: pay in the HOLD app,
 * where the send and the record are one tap, or record that you paid another
 * way, after a confirm, which the thread then shows as your word and never as
 * "Paid in HOLD". The web never sends a settlement with a transferId.
 */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  absMinor,
  addExpense,
  describeGroupError,
  expenseForMe,
  markRead,
  memberName,
  moneyText,
  formatMinor,
  namer,
  newClientKey,
  parseMajorToMinor,
  recordPaidElsewhere,
  settlementText,
  useGroupBalances,
  useGroupInfo,
  useGroupMembers,
  useGroups,
  useGroupThread,
  type GroupMember,
  type Outgoing,
  type ThreadItem,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";
import { useMe } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { BackHeader, btnGlass, Column, Notice } from "../hold";
import { Ion } from "../ion";
import { Chip, ChipRow, inputCls, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { AddPeople } from "./Groups";

type Names = ReturnType<typeof namer>;
type Expense = Extract<ThreadItem, { kind: "expense" }>;
type Settlement = Extract<ThreadItem, { kind: "settlement" }>;

/** The shell's top bar is sticky at 8px and 52px tall; the strip sits 8px under it. */
const UNDER_TOP_BAR = "top-[68px]";
const MESSAGE_MAX = 1000;

/* Buttons at the sizes this screen needs, each with its radius at half its
   height where it is a pill, written whole rather than by overriding the kit's
   (two height classes on one element is a coin toss on which one wins). */
/** Settle up: the screen's one amber plate. */
const pillAmber =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] bg-amber px-4 text-[13.5px] font-extrabold text-[#0F0F1A] transition-opacity hover:opacity-90";
/** A white plate the height of the kit's btnGlass, to sit beside it. */
const plateWhite =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-[#F1F5F9] px-4 text-[14px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/60";
/** A small glass pill: Load older. */
const pillGlass =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] border border-white/[0.22] bg-white/10 px-4 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:opacity-50";

export function GroupThread({ groupId, backPath, backLabel }: { groupId: string; backPath: string; backLabel?: string }) {
  const productHref = useProductHref();
  const backHref = productHref(backPath);
  const me = useMe();
  const meId = me.data?.id ?? null;
  const list = useGroups();
  const info = useGroupInfo(groupId);
  const members = useGroupMembers(groupId);
  const balances = useGroupBalances(groupId);
  const thread = useGroupThread(groupId);
  const names = useMemo(() => namer(members.data, meId), [members.data, meId]);

  const row = list.data?.find((g) => g.id === groupId) ?? null;
  const name = row?.name ?? info.data?.name ?? "Group";
  const emoji = row?.emoji ?? info.data?.emoji ?? null;
  const crew = row?.crew ?? null;
  const currency = (balances.data?.currency ?? row?.currency ?? info.data?.currency ?? "USD").toUpperCase();
  const count = members.data?.length ?? 0;

  const [panel, setPanel] = useState<"none" | "people" | "settle">("none");
  const [adding, setAdding] = useState(false);

  /* Read when it opens, and again whenever something new lands while it is
     open and the tab is in front. The list's unread count follows. */
  const newest = thread.items.length ? `${thread.items[thread.items.length - 1].kind}:${thread.items[thread.items.length - 1].id}` : "";
  const refreshBalances = balances.mutate;
  const refreshList = list.mutate;
  useEffect(() => {
    if (!newest || typeof document === "undefined" || document.visibilityState !== "visible") return;
    markRead(groupId).then(
      () => void refreshList(),
      () => {
        /* non-fatal: the next open marks it */
      },
    );
    // A new expense or settlement moves the numbers: read them with it.
    void refreshBalances();
  }, [groupId, newest, refreshBalances, refreshList]);

  const notFound = thread.error instanceof HoldApiError && thread.error.status === 404;

  const refreshAll = useCallback(() => {
    void thread.refresh();
    void balances.mutate();
    void list.mutate();
  }, [thread, balances, list]);

  const header = (
    <BackHeader
      title={`${emoji ? `${emoji} ` : ""}${name}`}
      subtitle={notFound ? undefined : `${count || "…"} ${count === 1 ? "person" : "people"}${crew ? " · Crew" : ""}`}
      backHref={backHref}
      right={
        notFound ? undefined : (
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "people" ? "none" : "people"))}
            aria-label="People"
            aria-expanded={panel === "people"}
            className="flex h-9 items-center gap-1.5 rounded-[18px] px-3 text-[13px] font-bold text-white transition-colors hover:bg-white/10"
          >
            <Ion name="people-outline" size={18} />
            <span className="hidden sm:inline">People</span>
          </button>
        )
      }
    />
  );

  if (notFound) {
    return (
      <Column>
        {header}
        <div className="flex flex-col items-center px-4 pt-12 text-center">
          <Ion name="people-outline" size={48} className="text-white/40" />
          <p className="mt-3 text-[14px] text-white/[0.62]">This group isn&apos;t here any more, or you&apos;re not in it.</p>
          <Link href={backHref} className={`${btnGlass} mt-4`}>
            {backLabel ? `Back to ${backLabel}` : "Back"}
          </Link>
        </div>
      </Column>
    );
  }

  return (
    <Column>
      {header}

      <BalanceStrip
        loading={balances.data === undefined && !balances.error}
        net={balances.data?.balances.find((b) => b.userId === meId)?.netMinor ?? null}
        currency={currency}
        canSettle={!!meId && !!balances.data?.transfers.some((t) => t.fromUserId === meId)}
        settling={panel === "settle"}
        onSettle={() => setPanel((p) => (p === "settle" ? "none" : "settle"))}
        crew={crew?.name ?? null}
      />

      {panel === "people" ? (
        <PeopleSheet
          groupId={groupId}
          members={members.data}
          meId={meId}
          onClose={() => setPanel("none")}
          onAdded={() => {
            void members.mutate();
            refreshAll();
          }}
        />
      ) : null}

      {panel === "settle" && balances.data && meId ? (
        <SettleUp
          groupId={groupId}
          currency={balances.data.currency}
          transfers={balances.data.transfers.filter((t) => t.fromUserId === meId)}
          names={names}
          onClose={() => setPanel("none")}
          onRecorded={() => {
            setPanel("none");
            refreshAll();
          }}
        />
      ) : null}

      <Timeline
        items={thread.items}
        outgoing={thread.outgoing}
        loading={thread.loading || me.data === undefined}
        failed={!!thread.error}
        onRetryLoad={() => void thread.refresh()}
        meId={meId}
        names={names}
        groupCurrency={currency}
        nextBefore={thread.nextBefore}
        loadingOlder={thread.loadingOlder}
        onLoadOlder={() => void thread.loadOlder()}
        onRetry={(key) => thread.retry(key, meId)}
        onDelete={thread.remove}
      />

      {adding && members.data ? (
        <AddExpense
          groupId={groupId}
          currency={currency}
          members={members.data}
          meId={meId}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refreshAll();
          }}
        />
      ) : null}

      <Composer
        disabled={!meId}
        adding={adding}
        onToggleAdd={() => setAdding((a) => !a)}
        onSend={(body) => void thread.send(body, newClientKey("msg"), meId)}
      />
    </Column>
  );
}

/* ── The balance strip ────────────────────────────────────────────── */

function BalanceStrip({
  loading,
  net,
  currency,
  canSettle,
  settling,
  onSettle,
  crew,
}: {
  loading: boolean;
  net: string | null;
  currency: string;
  canSettle: boolean;
  settling: boolean;
  onSettle: () => void;
  crew: string | null;
}) {
  const n = net && /^-?\d+$/.test(net) ? BigInt(net) : 0n;
  const line = n > 0n ? `You're owed ${moneyText(absMinor(net!), currency)}` : n < 0n ? `You owe ${moneyText(absMinor(net!), currency)}` : "All settled up";
  return (
    <div className={`sticky ${UNDER_TOP_BAR} z-30 -mx-1 mb-2 px-1 pb-1`}>
      <div className="flex min-h-[56px] items-center gap-3 rounded-[18px] border border-white/10 bg-[rgba(10,27,36,0.94)] px-3.5 py-2.5 backdrop-blur-xl">
        {loading ? (
          <Skeleton className="h-4 w-40 rounded-[8px]" />
        ) : (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-extrabold tabular-nums tracking-[-0.2px] text-white">{line}</span>
            {crew ? <span className="truncate text-[12px] text-white/55">Crew · {crew}</span> : null}
          </span>
        )}
        {!loading && n < 0n && canSettle ? (
          <button type="button" onClick={onSettle} aria-expanded={settling} className={pillAmber}>
            Settle up
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Settle up ────────────────────────────────────────────────────── */

const sheetCls = "mb-3 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
const sheetTitle = "text-[18px] font-extrabold tracking-[-0.3px] text-white";

function SettleUp({
  groupId,
  currency,
  transfers,
  names,
  onClose,
  onRecorded,
}: {
  groupId: string;
  currency: string;
  transfers: { fromUserId: string; toUserId: string; amountMinor: string }[];
  names: Names;
  onClose: () => void;
  onRecorded: () => void;
}) {
  return (
    <div className={sheetCls}>
      <div className="flex items-center justify-between gap-2">
        <p className={sheetTitle}>Settle up</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white/75 hover:bg-white/10 hover:text-white">
          <Ion name="close" size={20} />
        </button>
      </div>
      {transfers.length === 0 ? <p className="text-[13.5px] text-white/[0.82]">You don&apos;t owe anyone in this group.</p> : null}
      {transfers.map((t) => (
        <SettleRow key={`${t.toUserId}:${t.amountMinor}`} groupId={groupId} currency={currency} transfer={t} names={names} onRecorded={onRecorded} />
      ))}
    </div>
  );
}

/**
 * One payment the viewer owes. See the file header for why the web offers the
 * app and "another way" here, and never a send.
 */
function SettleRow({
  groupId,
  currency,
  transfer,
  names,
  onRecorded,
}: {
  groupId: string;
  currency: string;
  transfer: { toUserId: string; amountMinor: string };
  names: Names;
  onRecorded: () => void;
}) {
  const [step, setStep] = useState<"idle" | "app" | "confirm">("idle");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per row for as long as the row is open: a second tap after a lost
  // answer is the same settlement, not a second one.
  const [key] = useState(() => newClientKey("settle"));
  const who = names.name(transfer.toUserId);
  const amount = moneyText(transfer.amountMinor, currency);

  const record = () => {
    setBusy(true);
    setNotice(null);
    recordPaidElsewhere(groupId, { toUserId: transfer.toUserId, amountMinor: transfer.amountMinor }, key)
      .then(onRecorded)
      .catch((e) => setNotice(describeGroupError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-3">
      <p className="text-[15px] font-extrabold tabular-nums text-white">
        Pay {who} {amount}
      </p>

      {step === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={plateWhite} onClick={() => setStep("app")}>
            <Ion name="phone-portrait-outline" size={16} />
            Pay in the HOLD app
          </button>
          <button type="button" className={btnGlass} onClick={() => setStep("confirm")}>
            I paid another way
          </button>
        </div>
      ) : null}

      {step === "app" ? (
        <>
          <p className="text-[13.5px] leading-[19px] text-white/[0.82]">
            Open this group in the HOLD app and tap Settle up. The app sends {amount} to {who} and records it here as Paid in HOLD, checked against
            the payment.
          </p>
          <p className="text-[12px] leading-[17px] text-white/55">
            Sending from the web isn&apos;t connected to groups yet, so a payment made here couldn&apos;t be checked against this group.
          </p>
          <button type="button" className={`${btnGlass} self-start`} onClick={() => setStep("idle")}>
            Back
          </button>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <p className="text-[13.5px] leading-[19px] text-white/[0.82]">
            Record that you paid {who} {amount} outside HOLD, in cash or another app? Everyone in the group sees it as your word, not as a payment
            HOLD checked, and {who} is told.
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

function PeopleSheet({
  groupId,
  members,
  meId,
  onClose,
  onAdded,
}: {
  groupId: string;
  members: GroupMember[] | undefined;
  meId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  return (
    <div className={sheetCls}>
      <div className="flex items-center justify-between gap-2">
        <p className={sheetTitle}>People</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white/75 hover:bg-white/10 hover:text-white">
          <Ion name="close" size={20} />
        </button>
      </div>
      {members === undefined ? <Skeleton className="h-10 rounded-[12px]" /> : null}
      <div className="flex flex-col gap-2">
        {members?.map((m) => (
          <div key={m.userId} className="flex items-center gap-2.5">
            <Face member={m} />
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">{memberName(m)}</span>
            {m.userId === meId ? <Tag label="You" tone="dim" /> : null}
          </div>
        ))}
      </div>
      <p className="-mb-1 text-[12.5px] font-bold text-white/[0.82]">Add by @username</p>
      <AddPeople groupId={groupId} onAdded={onAdded} />
    </div>
  );
}

function Face({ member }: { member: GroupMember }) {
  if (member.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatarUrl} alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 rounded-[15px] object-cover" />;
  }
  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[15px] bg-white/[0.08]">
      <Ion name="person-outline" size={15} className="text-white/60" />
    </span>
  );
}

/* ── The timeline ─────────────────────────────────────────────────── */

type Row = { kind: "day"; key: string; label: string } | { kind: "item"; key: string; item: ThreadItem };

function Timeline({
  items,
  outgoing,
  loading,
  failed,
  onRetryLoad,
  meId,
  names,
  groupCurrency,
  nextBefore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onDelete,
}: {
  items: ThreadItem[];
  outgoing: Outgoing[];
  loading: boolean;
  failed: boolean;
  onRetryLoad: () => void;
  meId: string | null;
  names: Names;
  groupCurrency: string;
  nextBefore: string | null;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (key: string) => void;
  onDelete: (messageId: string) => Promise<void>;
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let day = "";
    for (const item of items) {
      const ts = Date.parse(item.at);
      const label = Number.isFinite(ts) ? dayLabel(ts) : "";
      if (label && label !== day) {
        day = label;
        out.push({ kind: "day", key: `d:${label}:${item.id}`, label });
      }
      out.push({ kind: "item", key: `${item.kind}:${item.id}`, item });
    }
    return out;
  }, [items]);

  useScrollKeeper(items, outgoing.length, onLoadOlder, !!nextBefore && !loadingOlder);

  if (loading) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-12 w-[60%] rounded-[18px]" />
        <Skeleton className="ml-auto h-12 w-[50%] rounded-[18px]" />
        <Skeleton className="h-24 w-[78%] rounded-[16px]" />
      </div>
    );
  }

  if (failed && items.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 pt-10 text-center">
        <Ion name="alert-circle-outline" size={48} className="text-white/40" />
        <p className="mt-3 text-[14px] text-white/[0.62]">Could not load this group</p>
        <button type="button" onClick={onRetryLoad} className={`${btnGlass} mt-4`}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      {nextBefore ? (
        <button type="button" data-load-older onClick={onLoadOlder} disabled={loadingOlder} className={`${pillGlass} self-center`}>
          {loadingOlder ? "Loading…" : "Load older"}
        </button>
      ) : null}

      {rows.length === 0 && outgoing.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13px] leading-[18px] text-white/70">
          Nothing here yet. Say hello, or add the first expense with +.
        </p>
      ) : null}

      {rows.map((r) =>
        r.kind === "day" ? (
          <p key={r.key} className="mt-2 text-center text-[11.5px] text-white/45">
            {r.label}
          </p>
        ) : r.item.kind === "message" ? (
          <MessageBubble key={r.key} item={r.item} mine={r.item.userId === meId} names={names} onDelete={onDelete} />
        ) : r.item.kind === "expense" ? (
          <ExpenseCard key={r.key} item={r.item} meId={meId} names={names} groupCurrency={groupCurrency} />
        ) : (
          <SettlementCard key={r.key} item={r.item} mine={r.item.userId === meId} names={names} />
        ),
      )}

      {outgoing.map((o) => (
        <PendingBubble key={o.key} item={o} onRetry={() => onRetry(o.key)} />
      ))}

      <div data-thread-end />
    </div>
  );
}

/**
 * The page is the scroller (the shell scrolls the window), so this keeps the
 * reader where they were:
 *
 *   first load        jump to the foot, where the newest is
 *   something new     follow it down, but only if the reader was already near
 *                     the foot; somebody reading back is not yanked away
 *   older loaded      keep the same item under the reader's eye by moving the
 *                     page down by exactly what was added above
 *   top reached       load older, once the reader has scrolled themselves
 */
function useScrollKeeper(items: ThreadItem[], pending: number, loadOlder: () => void, canLoadOlder: boolean) {
  const first = items[0] ? `${items[0].kind}:${items[0].id}` : "";
  const last = items.length ? `${items[items.length - 1].kind}:${items[items.length - 1].id}` : "";
  const prev = useRef<{ first: string; last: string; height: number; nearBottom: boolean } | null>(null);
  const userScrolled = useRef(false);

  useEffect(() => {
    const mark = () => {
      userScrolled.current = true;
    };
    const measure = () => {
      if (prev.current) prev.current.nearBottom = isNearBottom();
    };
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", mark);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("keydown", mark);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  useLayoutEffect(() => {
    const height = document.documentElement.scrollHeight;
    const was = prev.current;
    if (!was || !was.last) {
      if (last) scrollToEnd();
    } else if (first !== was.first && last === was.last) {
      window.scrollBy(0, height - was.height);
    } else if ((last !== was.last || pending) && was.nearBottom) {
      scrollToEnd();
    }
    prev.current = { first, last, height: document.documentElement.scrollHeight, nearBottom: isNearBottom() };
  }, [first, last, pending]);

  useEffect(() => {
    if (!canLoadOlder) return;
    const el = document.querySelector("[data-load-older]");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && userScrolled.current) loadOlder();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadOlder, loadOlder, first]);
}

function isNearBottom(): boolean {
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
}

function scrollToEnd() {
  document.querySelector("[data-thread-end]")?.scrollIntoView({ block: "end" });
}

/**
 * A message, in the payment chat's colours (Chat.tsx `Bubble`): mine on the
 * right in white at 14%, theirs on the left in near-white with dark ink and
 * their name on top. A deleted one keeps its place.
 *
 * My own message has a menu (the dots beside it, or a right click / long
 * press on the bubble) with Delete, which asks once.
 */
function MessageBubble({
  item,
  mine,
  names,
  onDelete,
}: {
  item: Extract<ThreadItem, { kind: "message" }>;
  mine: boolean;
  names: Names;
  onDelete: (messageId: string) => Promise<void>;
}) {
  const [menu, setMenu] = useState<"closed" | "open" | "busy" | "failed">("closed");
  const deleted = item.deleted || item.body === null;
  const ink = mine ? "text-white/[0.92]" : "text-[rgba(13,24,32,0.92)]";
  const muted = mine ? "text-white/45" : "text-[rgba(13,24,32,0.5)]";
  const canMenu = mine && !deleted;

  return (
    <div className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[78%] items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <div
          onContextMenu={(e) => {
            if (!canMenu) return;
            e.preventDefault();
            setMenu("open");
          }}
          className={`min-w-0 rounded-[18px] px-3.5 pb-[7px] pt-2.5 ${mine ? "bg-white/[0.14]" : "bg-[rgba(232,240,244,0.92)]"}`}
        >
          {!mine ? <p className="mb-0.5 truncate text-[12px] font-bold text-[rgba(13,24,32,0.62)]">{names.subject(item.userId)}</p> : null}
          {deleted ? (
            <p className={`text-[15px] italic leading-[21px] ${muted}`}>Message deleted</p>
          ) : (
            <p className={`whitespace-pre-wrap break-words text-[15px] leading-[21px] ${ink}`}>{item.body}</p>
          )}
          <span className={`mt-[3px] flex justify-end text-[10.5px] ${muted}`}>{shortTime(item.at)}</span>
        </div>
        {canMenu && menu === "closed" ? (
          <button
            type="button"
            onClick={() => setMenu("open")}
            aria-label="Message options"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] text-white/55 opacity-60 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100"
          >
            <Ion name="ellipsis-horizontal" size={16} />
          </button>
        ) : null}
      </div>
      {canMenu && menu !== "closed" ? (
        <div className="mt-1 flex items-center gap-2 text-[12.5px]">
          <span className="text-white/[0.82]">{menu === "failed" ? "Could not delete it." : "Delete this message?"}</span>
          <button type="button" onClick={() => setMenu("closed")} className="rounded-[10px] px-2 py-1 font-bold text-white/75 hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={menu === "busy"}
            onClick={() => {
              setMenu("busy");
              onDelete(item.id).then(
                () => setMenu("closed"),
                () => setMenu("failed"),
              );
            }}
            className="inline-flex items-center gap-1 rounded-[10px] bg-white/10 px-2 py-1 font-bold text-white hover:bg-white/[0.16] disabled:opacity-50"
          >
            <Ion name="trash-outline" size={13} />
            {menu === "busy" ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A message on its way, or refused: "Sending…", or "Not sent · Retry". */
function PendingBubble({ item, onRetry }: { item: Outgoing; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-end">
      <div className={`max-w-[78%] rounded-[18px] bg-white/[0.14] px-3.5 pb-[7px] pt-2.5 ${item.state === "sending" ? "opacity-70" : ""}`}>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[21px] text-white/[0.92]">{item.body}</p>
        <span className="mt-[3px] flex justify-end text-[10.5px] text-white/45">{item.state === "sending" ? "Sending…" : shortTime(item.at)}</span>
      </div>
      {item.state === "failed" ? (
        <button type="button" onClick={onRetry} className="mt-1 inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-amber hover:bg-amber/[0.12]">
          <Ion name="refresh" size={13} />
          Not sent · Retry
        </button>
      ) : null}
    </div>
  );
}

/** The card an expense makes in the conversation, on the payer's side. */
function ExpenseCard({ item, meId, names, groupCurrency }: { item: Expense; meId: string | null; names: Names; groupCurrency: string }) {
  const mine = item.userId === meId;
  const part = expenseForMe(item, meId);
  const converted = item.currency.toUpperCase() !== groupCurrency ? ` (${moneyText(item.groupMinor, groupCurrency)})` : "";
  return (
    <Side mine={mine}>
      <div className={`flex flex-col gap-1.5 rounded-[16px] border border-white/10 px-3.5 py-3 ${item.deleted ? "bg-white/[0.03]" : "bg-white/[0.08]"}`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08]">
            <Ion name="receipt-outline" size={16} className="text-white/[0.82]" />
          </span>
          <span className={`min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.2px] ${item.deleted ? "text-white/55 line-through" : "text-white"}`}>
            {item.description?.trim() || "Expense"}
          </span>
          {item.deleted ? <Tag label="Removed" tone="dim" /> : null}
        </div>
        <p className={`text-[13.5px] tabular-nums ${item.deleted ? "text-white/45 line-through" : "text-white/[0.82]"}`}>
          {names.subject(item.userId)} paid {moneyText(item.amountMinor, item.currency)}
          {converted}
        </p>
        {!item.deleted ? (
          <p className="text-[14px] font-bold tabular-nums text-white">
            {part.kind === "share"
              ? `Your part ${formatMinor(part.minor, groupCurrency)}`
              : part.kind === "lent"
                ? `You lent ${formatMinor(part.minor, groupCurrency)}`
                : "Not part of this"}
          </p>
        ) : null}
        <span className="flex justify-end text-[10.5px] text-white/55">{shortTime(item.at)}</span>
      </div>
    </Side>
  );
}

/**
 * A settlement. Paid through HOLD carries a check and says so; the payer's
 * word says whose word it is. The two must never look alike.
 */
function SettlementCard({ item, mine, names }: { item: Settlement; mine: boolean; names: Names }) {
  return (
    <Side mine={mine}>
      <div className="flex flex-col gap-1.5 rounded-[16px] border border-white/10 bg-white/[0.08] px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08]">
            <Ion name={item.viaHold ? "swap-horizontal" : "cash-outline"} size={16} className="text-white/[0.82]" />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-[14px] font-bold leading-[19px] tabular-nums text-white">{settlementText(item, names)}</p>
        </div>
        {item.viaHold ? (
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#2FBE8A]">
            <Ion name="checkmark-circle" size={15} />
            Paid in HOLD
          </span>
        ) : null}
        <span className="flex justify-end text-[10.5px] text-white/55">{shortTime(item.at)}</span>
      </div>
    </Side>
  );
}

function Side({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="w-full max-w-[86%] sm:max-w-[78%]">{children}</div>
    </div>
  );
}

/* ── Add expense ──────────────────────────────────────────────────── */

/**
 * Amount, currency (the group's by default), what it was for, who paid (me by
 * default), and split equally among everyone or among the people chosen.
 *
 * The split itself is the server's: it divides in minor units and gives the
 * remainder to the payer, so nothing is lost to rounding. The "about X each"
 * line is only a preview, and it is only drawn when the amount is in the
 * group's own currency, where it is the same arithmetic.
 */
function AddExpense({
  groupId,
  currency: groupCurrency,
  members,
  meId,
  onCancel,
  onAdded,
}: {
  groupId: string;
  currency: string;
  members: GroupMember[];
  meId: string | null;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(groupCurrency);
  const [what, setWhat] = useState("");
  const [payer, setPayer] = useState<string | null>(meId);
  const [everyone, setEveryone] = useState(true);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [key] = useState(() => newClientKey("expense"));

  const cur = currency.trim().toUpperCase();
  const curOk = /^[A-Z]{3,8}$/.test(cur);
  const minor = curOk ? parseMajorToMinor(amount, cur) : null;
  const people = everyone ? members.map((m) => m.userId) : members.map((m) => m.userId).filter((id) => chosen.has(id));
  const each = minor && cur === groupCurrency && people.length > 0 ? (BigInt(minor) / BigInt(people.length)).toString() : null;
  const ready = !!minor && !!payer && people.length > 0 && !busy;

  const submit = () => {
    if (!ready || !minor || !payer) return;
    setBusy(true);
    setNotice(null);
    addExpense(
      groupId,
      {
        amountMinor: minor,
        currency: cur,
        description: what.trim() || null,
        ...(payer !== meId ? { payerUserId: payer } : {}),
        ...(everyone ? {} : { participants: people }),
      },
      key,
    )
      .then(onAdded)
      .catch((e) => setNotice(describeGroupError(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className={`${sheetCls} mt-3`}>
      <div className="flex items-center justify-between gap-2">
        <p className={sheetTitle}>Add expense</p>
        <button type="button" onClick={onCancel} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white/75 hover:bg-white/10 hover:text-white">
          <Ion name="close" size={20} />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 18))}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount"
            autoFocus
            className={`${inputCls} font-extrabold tabular-nums`}
          />
        </div>
        <div className="w-[92px] shrink-0">
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 8).toUpperCase())}
            aria-label="Currency"
            className={`${inputCls} text-center font-bold uppercase`}
          />
        </div>
      </div>
      {amount && !minor ? (
        <p className="-mt-1 text-[12px] text-amber">
          {curOk ? `Type an amount in ${cur}, with at most the decimals it has.` : "A currency is a code like USD or EUR."}
        </p>
      ) : null}

      <input
        value={what}
        onChange={(e) => setWhat(e.target.value.slice(0, 120))}
        placeholder="What for? (optional)"
        aria-label="What for?"
        className={inputCls}
      />

      <p className="-mb-1 text-[12.5px] font-bold text-white/[0.82]">Who paid</p>
      <ChipRow label="Who paid">
        {members.map((m) => (
          <Chip key={m.userId} label={m.userId === meId ? "Me" : memberName(m)} selected={payer === m.userId} onClick={() => setPayer(m.userId)} />
        ))}
      </ChipRow>

      <p className="-mb-1 text-[12.5px] font-bold text-white/[0.82]">Split equally</p>
      <ChipRow label="Split">
        <Chip label="Everyone" selected={everyone} onClick={() => setEveryone(true)} />
        <Chip label="Choose people" selected={!everyone} onClick={() => setEveryone(false)} />
      </ChipRow>
      {!everyone ? (
        <ChipRow label="Who shares it">
          {members.map((m) => (
            <Chip
              key={m.userId}
              icon={chosen.has(m.userId) ? "checkmark" : undefined}
              label={m.userId === meId ? "Me" : memberName(m)}
              selected={chosen.has(m.userId)}
              onClick={() =>
                setChosen((c) => {
                  const next = new Set(c);
                  if (next.has(m.userId)) next.delete(m.userId);
                  else next.add(m.userId);
                  return next;
                })
              }
            />
          ))}
        </ChipRow>
      ) : null}
      <p className="text-[12.5px] text-white/55">
        {people.length === 0
          ? "Choose at least one person."
          : each
            ? `${people.length} ${people.length === 1 ? "person" : "people"}, about ${moneyText(each, groupCurrency)} each.`
            : `Split between ${people.length} ${people.length === 1 ? "person" : "people"}${cur !== groupCurrency ? `, in ${groupCurrency} at today's rate` : ""}.`}
      </p>

      {notice ? <Notice>{notice}</Notice> : null}
      <div className="flex gap-2">
        <button type="button" className={`${btnGlass} flex-1`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`${plateWhite} flex-1`} onClick={submit} disabled={!ready}>
          {busy ? "Adding…" : "Add expense"}
        </button>
      </div>
    </div>
  );
}

/* ── The composer ─────────────────────────────────────────────────── */

/**
 * The payment chat's bar (Chat.tsx), with "+" for an expense where that one
 * has the GIF button. Enter sends, Shift+Enter breaks the line. Send is a
 * white plate here, not amber: on this screen the amber is Settle up's.
 */
function Composer({ disabled, adding, onToggleAdd, onSend }: { disabled: boolean; adding: boolean; onToggleAdd: () => void; onSend: (body: string) => void }) {
  const [text, setText] = useState("");
  const body = text.trim();
  const canSend = !disabled && body.length > 0 && body.length <= MESSAGE_MAX;

  const submit = () => {
    if (!canSend) return;
    onSend(body);
    setText("");
  };

  return (
    <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-[#0A1B24] via-[#0A1B24] to-transparent pb-1 pt-3">
      {body.length > MESSAGE_MAX ? <p className="mb-2 px-1 text-[12px] text-amber">Keep it under {MESSAGE_MAX} characters.</p> : null}
      <div className="flex items-end gap-2 rounded-[20px] border border-white/[0.12] bg-white/10 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleAdd}
          aria-label={adding ? "Close add expense" : "Add expense"}
          aria-expanded={adding}
          disabled={disabled}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-45 ${adding ? "bg-white/[0.14] text-white" : "text-white/75"}`}
        >
          <Ion name="add" size={22} />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX + 200))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Message the group…"
          aria-label="Message"
          disabled={disabled}
          className="max-h-32 min-h-[36px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-[20px] text-white outline-none placeholder:text-white/60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-[#F1F5F9] text-[#0A1420] transition-opacity disabled:bg-white/[0.12] disabled:text-white/50"
        >
          <Ion name="arrow-up" size={18} />
        </button>
      </div>
    </div>
  );
}

/* ── ─────────────────────────────────────────────────────────────── */

/** "Today", "Yesterday", else the date: the payment chat's day line. */
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
