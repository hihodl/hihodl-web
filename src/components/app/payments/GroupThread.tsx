"use client";

/**
 * One group, on one screen: the chat and the money together
 * (documentation/groups-splitwise-grade.md, and the app's group-expenses).
 *
 *   header        the name, "N people", "Crew"; Settings and People on the right
 *   balance strip "You're owed 12.00 USD" / "You owe 4.00 USD" / "All settled
 *                 up", stuck under the header so it never scrolls away; it
 *                 opens Balances, where debts are requests (GroupPanels)
 *   timeline      oldest at the top, newest at the foot, a day line where the
 *                 day turns; messages as bubbles (the payment chat's own
 *                 colours, Chat.tsx), expenses and settlements as cards, an
 *                 edit to an expense as a quiet line
 *   composer      text and Send, and "+" for an expense
 *
 * It polls every ten seconds while it is open (there is no socket for groups),
 * marks the thread read when it opens and whenever something new arrives while
 * it is on screen, and loads older items when the top of the thread is reached.
 *
 * A MESSAGE'S MENU
 *
 * The dots beside a bubble on hover, a right click, or a long press on a
 * touch screen open it: Edit (your own), Delete, which asks "Delete for me" or
 * "Delete for everyone" (everyone only on your own), and Seen by. An edited
 * message says "Edited" in small type under the bubble. Under your latest
 * message, the faces and names of who has seen it, from the thread's `reads`
 * (seen = read position at or after the message, author excluded).
 *
 * SETTLE UP ON THE WEB, AND WHY IT DOES NOT SEND
 *
 * The app's Settle up sends the money with the normal HOLD send to the
 * person's @handle and then records the settlement with that payment intent's
 * id, which the server checks. The web cannot do the first half: its only send
 * is the web wallet's withdrawal, a `withdrawal_requests` row and not a
 * payment intent, so the server would refuse it as `transfer_not_found`. So
 * what you owe offers the two honest things: pay in the HOLD app, or record
 * that you paid another way, which the thread shows as your word. The web
 * never sends a settlement with a transferId.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  absMinor,
  describeGroupError,
  eventText,
  expenseForMe,
  formatMinor,
  markRead,
  memberName,
  moneyText,
  namer,
  newClientKey,
  seenBy,
  seenLine,
  settlementText,
  useGroupBalances,
  useGroupInfo,
  useGroupMembers,
  useGroups,
  useGroupThread,
  type EventItem,
  type ExpenseItem,
  type GroupMember,
  type MessageItem,
  type Outgoing,
  type ReadMark,
  type SettlementItem,
  type ThreadItem,
} from "@/lib/app/groups";
import { HoldApiError } from "@/lib/app/hold-api";
import { useMe } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { BackHeader, btnGlass, Column, Notice } from "../hold";
import { Ion } from "../ion";
import { Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { AddExpenseFlow } from "./AddExpense";
import { ExpenseDetail, ReceiptViewer } from "./GroupExpense";
import { BalancesSheet, PeopleSheet, SettingsSheet } from "./GroupPanels";
import { FaceStack, GroupFace, PersonFace, pillGlass, plateCaution, plateWhite, Sheet } from "./group-kit";

type Names = ReturnType<typeof namer>;

/** The shell's top bar is sticky at 8px and 52px tall; the strip sits 8px under it. */
const UNDER_TOP_BAR = "top-[68px]";
const MESSAGE_MAX = 1000;
const LONG_PRESS_MS = 450;

/** Settle up: the screen's one amber plate. */
const pillAmber =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] bg-amber px-4 text-[13.5px] font-extrabold text-[#0F0F1A] transition-opacity hover:opacity-90";

type Panel = "none" | "people" | "balances" | "settings" | "add" | { expense: string } | { message: string } | { receipt: string; title: string | null };

export function GroupThread({ groupId, backPath, backLabel }: { groupId: string; backPath: string; backLabel?: string }) {
  const productHref = useProductHref();
  const router = useRouter();
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
  // The group read is the fresher one for the face (a photo link lasts an hour); the list row fills in while it loads.
  const group = info.data ? { ...row, ...info.data } : row;
  const name = group?.name ?? "Group";
  const emoji = group?.emoji ?? null;
  const crew = row?.crew ?? null;
  const currency = (balances.data?.currency ?? group?.currency ?? "USD").toUpperCase();
  const count = members.data?.length ?? 0;

  const [panel, setPanel] = useState<Panel>("none");
  const close = useCallback(() => setPanel("none"), []);

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
    void info.mutate();
  }, [thread, balances, list, info]);

  const headerBtn = "flex h-9 items-center gap-1.5 rounded-[18px] px-2.5 text-[13px] font-bold text-white transition-colors hover:bg-white/10";
  const header = (
    <BackHeader
      title={`${emoji && !group?.photoUrl ? `${emoji} ` : ""}${name}`}
      subtitle={notFound ? undefined : `${count || "…"} ${count === 1 ? "person" : "people"}${crew ? " · Crew" : ""}`}
      backHref={backHref}
      right={
        notFound ? undefined : (
          <span className="flex items-center">
            <button type="button" onClick={() => setPanel("settings")} aria-label="Group settings" className={headerBtn} disabled={!group}>
              {group?.photoUrl ? <GroupFace name={name} emoji={emoji} photoUrl={group.photoUrl} size={24} /> : <Ion name="settings-outline" size={18} />}
            </button>
            <button type="button" onClick={() => setPanel("people")} aria-label="People" className={headerBtn}>
              <Ion name="people-outline" size={18} />
              <span className="hidden sm:inline">People</span>
            </button>
          </span>
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

  const openItem = typeof panel === "object" && "message" in panel ? thread.items.find((i): i is MessageItem => i.kind === "message" && i.id === panel.message) : undefined;

  return (
    <Column>
      {header}

      <BalanceStrip
        loading={balances.data === undefined && !balances.error}
        failed={!!balances.error && balances.data === undefined}
        onRetry={() => void balances.mutate()}
        net={balances.data?.balances.find((b) => b.userId === meId)?.netMinor ?? null}
        currency={currency}
        onOpen={() => setPanel("balances")}
        crew={crew?.name ?? null}
      />

      {panel === "people" ? (
        <PeopleSheet
          groupId={groupId}
          groupName={name}
          adminId={members.data?.find((m) => m.isCreator)?.userId ?? group?.userId ?? null}
          onLeft={() => {
            void list.mutate();
            router.push(backHref);
          }}
          onOpenBalances={() => setPanel("balances")}
          members={members.data}
          membersError={members.error}
          onRetry={() => void members.mutate()}
          meId={meId}
          onClose={close}
          onAdded={() => {
            void members.mutate();
            refreshAll();
          }}
        />
      ) : null}

      {panel === "balances" ? (
        <BalancesSheet
          groupId={groupId}
          balances={balances.data}
          loadError={balances.error}
          onRetry={() => void balances.mutate()}
          members={members.data}
          meId={meId}
          names={names}
          onClose={close}
          onChanged={refreshAll}
        />
      ) : null}

      {panel === "settings" && group ? (
        <SettingsSheet
          groupId={groupId}
          group={{ ...group, id: groupId, name, emoji }}
          onClose={close}
          onSaved={() => {
            void info.mutate();
            void list.mutate();
            void balances.mutate();
          }}
        />
      ) : null}

      {panel === "add" && members.data ? (
        <AddExpenseFlow
          groupId={groupId}
          groupCurrency={currency}
          members={members.data}
          meId={meId}
          onClose={close}
          onSaved={() => {
            close();
            refreshAll();
          }}
        />
      ) : null}

      {typeof panel === "object" && "expense" in panel && members.data ? (
        <ExpenseDetail groupId={groupId} expenseId={panel.expense} groupCurrency={currency} members={members.data} meId={meId} onClose={close} onChanged={refreshAll} />
      ) : null}

      {openItem ? (
        <MessageActions
          item={openItem}
          mine={openItem.userId === meId}
          reads={thread.reads}
          members={members.data ?? []}
          names={names}
          onClose={close}
          onEdit={thread.edit}
          onDeleteForEveryone={thread.remove}
          onDeleteForMe={thread.hide}
        />
      ) : null}

      <Timeline
        items={thread.items}
        reads={thread.reads}
        members={members.data ?? []}
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
        onDiscard={thread.discard}
        onOpenMessage={(id) => setPanel({ message: id })}
        onOpenExpense={(id) => setPanel({ expense: id })}
        onOpenReceipt={(url, title) => setPanel({ receipt: url, title })}
      />

      {typeof panel === "object" && "receipt" in panel ? <ReceiptViewer url={panel.receipt} title={panel.title} onClose={close} /> : null}

      <Composer
        disabled={!meId}
        adding={panel === "add"}
        canAdd={!!members.data}
        onToggleAdd={() => setPanel((p) => (p === "add" ? "none" : "add"))}
        onSend={(body) => void thread.send(body, newClientKey("msg"), meId)}
      />
    </Column>
  );
}

/* ── The balance strip ────────────────────────────────────────────── */

function BalanceStrip({
  loading,
  failed,
  onRetry,
  net,
  currency,
  onOpen,
  crew,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  net: string | null;
  currency: string;
  onOpen: () => void;
  crew: string | null;
}) {
  const n = net && /^-?\d+$/.test(net) ? BigInt(net) : 0n;
  const line = n > 0n ? `You're owed ${moneyText(absMinor(net!), currency)}` : n < 0n ? `You owe ${moneyText(absMinor(net!), currency)}` : "All settled up";
  return (
    <div className={`sticky ${UNDER_TOP_BAR} z-30 -mx-1 mb-2 px-1 pb-1`}>
      <div className="flex min-h-[56px] items-center gap-3 rounded-[18px] border border-white/[0.12] bg-white/10 px-3.5 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {loading ? (
          <Skeleton className="h-4 w-40 rounded-[8px]" />
        ) : failed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/70">Balances didn&apos;t load</span>
            <button type="button" onClick={onRetry} className={pillGlass}>
              Retry
            </button>
          </>
        ) : (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-extrabold tabular-nums tracking-[-0.2px] text-white">{line}</span>
              {crew ? <span className="truncate text-[12px] text-white/55">Crew · {crew}</span> : null}
            </span>
            <button type="button" onClick={onOpen} className={n < 0n ? pillAmber : pillGlass}>
              {n < 0n ? "Settle up" : "Balances"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── The timeline ─────────────────────────────────────────────────── */

type Row = { kind: "day"; key: string; label: string } | { kind: "item"; key: string; item: ThreadItem };

function Timeline({
  items,
  reads,
  members,
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
  onDiscard,
  onOpenMessage,
  onOpenExpense,
  onOpenReceipt,
}: {
  onOpenReceipt: (url: string, title: string | null) => void;
  items: ThreadItem[];
  reads: ReadMark[];
  members: GroupMember[];
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
  onDiscard: (key: string) => void;
  onOpenMessage: (id: string) => void;
  onOpenExpense: (id: string) => void;
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

  // "Seen by" sits under your latest message that still has words in it.
  const lastMine = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "message" && it.userId === meId && !it.deleted && it.body !== null) return it;
    }
    return null;
  }, [items, meId]);
  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

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
    <div className="mt-1 flex min-w-0 flex-col gap-2">
      {nextBefore ? (
        <button type="button" data-load-older onClick={onLoadOlder} disabled={loadingOlder} className={`${pillGlass} self-center`}>
          {loadingOlder ? "Loading…" : "Load older"}
        </button>
      ) : null}
      {failed ? (
        <div className="flex items-center justify-center gap-2 text-[12.5px] text-white/60">
          New messages didn&apos;t load.
          <button type="button" onClick={onRetryLoad} className="rounded-[10px] px-2 py-1 font-bold text-white hover:bg-white/10">
            Retry
          </button>
        </div>
      ) : null}

      {rows.length === 0 && outgoing.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13px] leading-[18px] text-white/70">Nothing here yet. Say hello, or add the first expense with +.</p>
      ) : null}

      {rows.map((r) => {
        if (r.kind === "day") {
          return (
            <p key={r.key} className="mt-2 text-center text-[11.5px] text-white/45">
              {r.label}
            </p>
          );
        }
        const it = r.item;
        if (it.kind === "message") {
          const seen = lastMine && it.id === lastMine.id ? seenBy(it, reads) : null;
          return (
            <MessageBubble
              key={r.key}
              item={it}
              mine={it.userId === meId}
              names={names}
              onOpen={() => onOpenMessage(it.id)}
              seen={seen ? { ids: seen, people: seen.map((id) => byId.get(id)), line: seenLine(seen, Math.max(0, members.length - 1), names.short) } : null}
            />
          );
        }
        if (it.kind === "expense") return <ExpenseCard key={r.key} item={it} meId={meId} names={names} groupCurrency={groupCurrency} onOpen={() => onOpenExpense(it.id)} onReceipt={() => it.receiptUrl && onOpenReceipt(it.receiptUrl, it.description)} />;
        if (it.kind === "settlement") return <SettlementCard key={r.key} item={it} mine={it.userId === meId} names={names} />;
        return <EventLine key={r.key} item={it} names={names} onOpen={it.subjectId ? () => onOpenExpense(it.subjectId!) : undefined} />;
      })}

      {outgoing.map((o) => (
        <PendingBubble key={o.key} item={o} onRetry={() => onRetry(o.key)} onDiscard={() => onDiscard(o.key)} />
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
 * their name on top. A deleted one keeps its place. The menu opens from the
 * dots (hover), a right click, or a long press on a touch screen.
 */
function MessageBubble({
  item,
  mine,
  names,
  onOpen,
  seen,
}: {
  item: MessageItem;
  mine: boolean;
  names: Names;
  onOpen: () => void;
  seen: { ids: string[]; people: (GroupMember | undefined)[]; line: string | null } | null;
}) {
  const deleted = item.deleted || item.body === null;
  const ink = mine ? "text-white/[0.92]" : "text-[rgba(13,24,32,0.92)]";
  const muted = mine ? "text-white/45" : "text-[rgba(13,24,32,0.5)]";
  const press = useLongPress(onOpen);

  return (
    <div className={`group flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[86%] min-w-0 items-center gap-1 sm:max-w-[78%] ${mine ? "flex-row-reverse" : ""}`}>
        <div
          {...press}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpen();
          }}
          className={`min-w-0 select-text rounded-[18px] px-3.5 pb-[7px] pt-2.5 [-webkit-touch-callout:none] ${mine ? "bg-white/[0.14]" : "bg-[rgba(232,240,244,0.92)]"}`}
        >
          {!mine ? <p className="mb-0.5 truncate text-[12px] font-bold text-[rgba(13,24,32,0.62)]">{names.subject(item.userId)}</p> : null}
          {deleted ? (
            <p className={`text-[15px] italic leading-[21px] ${muted}`}>Message deleted</p>
          ) : (
            <p className={`whitespace-pre-wrap break-words text-[15px] leading-[21px] ${ink}`}>{item.body}</p>
          )}
          <span className={`mt-[3px] flex justify-end text-[10.5px] ${muted}`}>{shortTime(item.at)}</span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Message options"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] text-white/55 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden"
        >
          <Ion name="ellipsis-horizontal" size={16} />
        </button>
      </div>
      {item.edited && !deleted ? <span className="mt-0.5 px-2 text-[10.5px] text-white/50">Edited</span> : null}
      {seen && seen.line ? (
        <button type="button" onClick={onOpen} className="mt-1 flex max-w-full items-center gap-1.5 rounded-[10px] px-1.5 py-0.5 text-[11px] text-white/55 hover:bg-white/[0.06]">
          <FaceStack people={seen.people} size={16} />
          <span className="truncate">{seen.line}</span>
        </button>
      ) : null}
    </div>
  );
}

/** A long press on a touch screen, without stealing a scroll: moving the finger cancels it. */
function useLongPress(fn: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        clear();
        fn();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}

/**
 * What can be done with one message.
 *
 *   Edit                  your own, not deleted; "Edited" shows under it after
 *   Delete                asks: "Delete for me" (any message, gone from your
 *                         thread only, no undo) or "Delete for everyone" (your
 *                         own; it stays in its place as "Message deleted")
 *   Seen by               everyone whose read position is at or after it
 */
function MessageActions({
  item,
  mine,
  reads,
  members,
  names,
  onClose,
  onEdit,
  onDeleteForEveryone,
  onDeleteForMe,
}: {
  item: MessageItem;
  mine: boolean;
  reads: ReadMark[];
  members: GroupMember[];
  names: Names;
  onClose: () => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDeleteForEveryone: (id: string) => Promise<void>;
  onDeleteForMe: (id: string) => Promise<void>;
}) {
  const deleted = item.deleted || item.body === null;
  const [mode, setMode] = useState<"menu" | "edit" | "delete">("menu");
  const [text, setText] = useState(item.body ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const seen = seenBy(item, reads);
  const byId = new Map(members.map((m) => [m.userId, m]));
  const others = members.filter((m) => m.userId !== item.userId);
  const notSeen = others.filter((m) => !seen.includes(m.userId));
  const body = text.trim();

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    fn()
      .then(onClose)
      .catch((e) => setNotice(describeGroupError(e)))
      .finally(() => setBusy(false));
  };

  const rowCls = "flex h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-[14.5px] font-bold text-white transition-colors hover:bg-white/[0.08] disabled:opacity-50";

  return (
    <Sheet title={mode === "edit" ? "Edit message" : mode === "delete" ? "Delete message?" : "Message"} onClose={onClose} busy={busy}>
      {mode !== "edit" ? (
        <p className="line-clamp-3 whitespace-pre-wrap break-words rounded-[12px] bg-white/[0.05] px-3 py-2 text-[13.5px] text-white/[0.82]">
          {deleted ? <span className="italic text-white/55">Message deleted</span> : item.body}
        </p>
      ) : null}

      {mode === "menu" ? (
        <>
          <div className="flex flex-col">
            {mine && !deleted ? (
              <button type="button" className={rowCls} onClick={() => setMode("edit")}>
                <Ion name="create-outline" size={18} />
                Edit
              </button>
            ) : null}
            {!deleted && typeof navigator !== "undefined" && navigator.clipboard ? (
              <button
                type="button"
                className={rowCls}
                onClick={() => {
                  void navigator.clipboard.writeText(item.body ?? "").then(onClose, () => setNotice("Couldn't copy it."));
                }}
              >
                <Ion name="copy-outline" size={18} />
                Copy
              </button>
            ) : null}
            <button type="button" className={rowCls} onClick={() => setMode("delete")}>
              <Ion name="trash-outline" size={18} />
              Delete
            </button>
          </div>

          {mine || seen.length ? (
            <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
              <p className="text-[12.5px] font-bold text-white/[0.82]">{seen.length && seen.length >= others.length && others.length > 1 ? "Seen by everyone" : "Seen by"}</p>
              {seen.length === 0 ? <p className="text-[13px] text-white/55">No one yet.</p> : null}
              {seen.map((id) => (
                <div key={id} className="flex min-w-0 items-center gap-2.5">
                  <PersonFace person={byId.get(id)} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-white">{names.subject(id)}</span>
                  <Ion name="checkmark-done" size={16} className="text-white/55" />
                </div>
              ))}
              {mine && seen.length && notSeen.length ? <p className="text-[12px] text-white/50">Not yet: {notSeen.map((m) => names.subject(m.userId)).join(", ")}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "edit" ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX + 200))}
            rows={3}
            autoFocus
            aria-label="Message"
            disabled={busy}
            className="min-h-[88px] w-full resize-none rounded-[14px] border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-[15px] leading-[21px] text-white outline-none focus:border-white/30"
          />
          {body.length > MESSAGE_MAX ? <p className="text-[12px] text-amber">Keep it under {MESSAGE_MAX} characters.</p> : null}
          {notice ? <Notice>{notice}</Notice> : null}
          <div className="flex gap-2">
            <button type="button" className={`${btnGlass} flex-1`} disabled={busy} onClick={() => setMode("menu")}>
              Cancel
            </button>
            <button
              type="button"
              className={`${plateWhite} flex-1`}
              disabled={busy || !body || body.length > MESSAGE_MAX || body === (item.body ?? "").trim()}
              onClick={() => run(() => onEdit(item.id, body))}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : null}

      {mode === "delete" ? (
        <>
          <p className="text-[13px] leading-[18px] text-white/[0.72]">
            {mine && !deleted
              ? "Delete for everyone leaves “Message deleted” in its place for the whole group. Delete for me takes it out of your thread only."
              : "It goes from your thread only. Everyone else still sees it. This can't be undone."}
          </p>
          {notice ? <Notice>{notice}</Notice> : null}
          <div className="flex flex-col gap-2">
            {mine && !deleted ? (
              <button type="button" className={plateCaution} disabled={busy} onClick={() => run(() => onDeleteForEveryone(item.id))}>
                {busy ? "Deleting…" : "Delete for everyone"}
              </button>
            ) : null}
            <button type="button" className={mine && !deleted ? btnGlass : plateCaution} disabled={busy} onClick={() => run(() => onDeleteForMe(item.id))}>
              Delete for me
            </button>
            <button type="button" className={btnGlass} disabled={busy} onClick={() => setMode("menu")}>
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {mode === "menu" && notice ? <Notice>{notice}</Notice> : null}
    </Sheet>
  );
}

/** A message on its way, or refused: "Sending…", or "Not sent · Retry". */
function PendingBubble({ item, onRetry, onDiscard }: { item: Outgoing; onRetry: () => void; onDiscard: () => void }) {
  return (
    <div className="flex flex-col items-end">
      <div className={`max-w-[78%] rounded-[18px] bg-white/[0.14] px-3.5 pb-[7px] pt-2.5 ${item.state === "sending" ? "opacity-70" : ""}`}>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[21px] text-white/[0.92]">{item.body}</p>
        <span className="mt-[3px] flex justify-end text-[10.5px] text-white/45">{item.state === "sending" ? "Sending…" : shortTime(item.at)}</span>
      </div>
      {item.state === "failed" ? (
        <span className="mt-1 flex items-center gap-1">
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-amber hover:bg-amber/[0.12]">
            <Ion name="refresh" size={13} />
            Not sent · Retry
          </button>
          <button type="button" onClick={onDiscard} className="rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-white/60 hover:bg-white/10 hover:text-white">
            Discard
          </button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * The card an expense makes in the conversation, on the payer's side. It opens
 * the expense; its receipt, when there is one, shows as a thumbnail that opens
 * the receipt full screen.
 */
function ExpenseCard({
  item,
  meId,
  names,
  groupCurrency,
  onOpen,
  onReceipt,
}: {
  item: ExpenseItem;
  meId: string | null;
  names: Names;
  groupCurrency: string;
  onOpen: () => void;
  onReceipt: () => void;
}) {
  const mine = item.userId === meId;
  const part = expenseForMe(item, meId);
  const converted = item.currency.toUpperCase() !== groupCurrency ? ` (${moneyText(item.groupMinor, groupCurrency)})` : "";
  const [thumbBroken, setThumbBroken] = useState(false);
  const receipt = !item.deleted && item.receiptUrl && !thumbBroken ? item.receiptUrl : null;
  const sources = item.sources?.length ?? 0;
  return (
    <Side mine={mine}>
      <div className={`flex w-full min-w-0 items-stretch gap-2 rounded-[16px] border border-white/10 transition-colors ${item.deleted ? "bg-white/[0.03]" : "bg-white/[0.08] hover:bg-white/[0.11]"}`}>
        <button type="button" onClick={onOpen} disabled={item.deleted} className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[16px] px-3.5 py-3 text-left [-webkit-tap-highlight-color:transparent]">
          <span className="flex w-full min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08]">
              <Ion name="receipt-outline" size={16} className="text-white/[0.82]" />
            </span>
            <span className={`min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.2px] ${item.deleted ? "text-white/55 line-through" : "text-white"}`}>
              {item.description?.trim() || "Expense"}
            </span>
            {item.deleted ? <Tag label="Removed" tone="dim" /> : item.edited ? <Tag label="Edited" tone="dim" /> : null}
          </span>
          <span className={`text-[13.5px] tabular-nums ${item.deleted ? "text-white/45 line-through" : "text-white/[0.82]"}`}>
            {names.subject(item.userId)} paid {moneyText(item.amountMinor, item.currency)}
            {converted}
          </span>
          {!item.deleted && (item.place || sources > 1) ? (
            <span className="flex min-w-0 items-center gap-3 text-[12px] text-white/60">
              {item.place ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Ion name="location-outline" size={13} className="shrink-0" />
                  <span className="truncate">{item.place}</span>
                </span>
              ) : null}
              {sources > 1 ? <span className="shrink-0">{sources} bills</span> : null}
            </span>
          ) : null}
          {!item.deleted ? (
            <span className="text-[14px] font-bold tabular-nums text-white">
              {part.kind === "share" ? `Your part ${formatMinor(part.minor, groupCurrency)}` : part.kind === "lent" ? `You lent ${formatMinor(part.minor, groupCurrency)}` : "Not part of this"}
            </span>
          ) : null}
          <span className="flex justify-end text-[10.5px] text-white/55">{shortTime(item.at)}</span>
        </button>
        {receipt ? (
          <button type="button" onClick={onReceipt} aria-label="Open the receipt" className="my-3 mr-3 shrink-0 self-start overflow-hidden rounded-[12px] ring-1 ring-white/15 transition-opacity hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt} alt="" onError={() => setThumbBroken(true)} className="h-[64px] w-[52px] object-cover" />
          </button>
        ) : null}
      </div>
    </Side>
  );
}

/**
 * A settlement. Paid through HOLD carries a check and says so; the creditor's
 * word and the payer's word say whose word they are. The three never look alike.
 */
function SettlementCard({ item, mine, names }: { item: SettlementItem; mine: boolean; names: Names }) {
  return (
    <Side mine={mine}>
      <div className="flex flex-col gap-1.5 rounded-[16px] border border-white/10 bg-white/[0.08] px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08]">
            <Ion name={item.viaHold ? "swap-horizontal" : item.markedByCreditor ? "checkmark-done" : "cash-outline"} size={16} className="text-white/[0.82]" />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-[14px] font-bold leading-[19px] tabular-nums text-white">{settlementText(item, names)}</p>
        </div>
        {item.viaHold ? (
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#2FBE8A]">
            <Ion name="checkmark-circle" size={15} />
            Paid in HOLD
          </span>
        ) : (
          <span className="text-[12px] text-white/55">{item.markedByCreditor ? "Marked as paid, outside HOLD" : "Their word, outside HOLD"}</span>
        )}
        <span className="flex justify-end text-[10.5px] text-white/55">{shortTime(item.at)}</span>
      </div>
    </Side>
  );
}

/** "Ana edited Dinner: the amount and the split", a quiet line in the middle. */
function EventLine({ item, names, onOpen }: { item: EventItem; names: Names; onOpen?: () => void }) {
  const inner = (
    <>
      <Ion name="create-outline" size={12} className="shrink-0" />
      <span className="min-w-0 truncate">{eventText(item, names)}</span>
      <span className="shrink-0 text-white/40">· {shortTime(item.at)}</span>
    </>
  );
  const cls = "mx-auto flex max-w-full items-center gap-1.5 rounded-[12px] px-2.5 py-1 text-[12px] text-white/60";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} hover:bg-white/[0.06]`}>
      {inner}
    </button>
  ) : (
    <p className={cls}>{inner}</p>
  );
}

function Side({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 ${mine ? "justify-end" : "justify-start"}`}>
      <div className="w-full min-w-0 max-w-[86%] sm:max-w-[78%]">{children}</div>
    </div>
  );
}

/* ── The composer ─────────────────────────────────────────────────── */

/**
 * The payment chat's bar (Chat.tsx), with "+" for an expense where that one
 * has the GIF button. Enter sends, Shift+Enter breaks the line. Send is a
 * white plate here, not amber: on this screen the amber is Settle up's.
 */
function Composer({
  disabled,
  adding,
  canAdd,
  onToggleAdd,
  onSend,
}: {
  disabled: boolean;
  adding: boolean;
  canAdd: boolean;
  onToggleAdd: () => void;
  onSend: (body: string) => void;
}) {
  const [text, setText] = useState("");
  const body = text.trim();
  const canSend = !disabled && body.length > 0 && body.length <= MESSAGE_MAX;

  const submit = () => {
    if (!canSend) return;
    onSend(body);
    setText("");
  };

  return (
    // No floor under the bar: the page is a gradient, and a wrapper that faded
    // to one flat navy drew a dark square band behind the rounded bar (the 1:1
    // chat's Composer fixed the same thing). The bar blurs what passes under it.
    <div className="sticky bottom-0 mt-4 pb-1 pt-3">
      {body.length > MESSAGE_MAX ? <p className="mb-2 px-1 text-[12px] text-amber">Keep it under {MESSAGE_MAX} characters.</p> : null}
      <div className="flex items-end gap-2 rounded-[20px] border border-white/[0.12] bg-white/10 px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onToggleAdd}
          aria-label={adding ? "Close add expense" : "Add expense"}
          aria-expanded={adding}
          disabled={disabled || !canAdd}
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
