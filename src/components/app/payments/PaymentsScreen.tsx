"use client";

/**
 * Payments, as the HOLD app has it (src/payments/PaymentsHome.tsx): the search
 * row, the `All · Groups · Favourites` chips, and one row per counterparty
 * built by grouping `/transfers` — avatar or person placeholder, the name, the
 * last line, the time.
 *
 * WHAT IS MISSING AND WHY
 *
 * The app's list is the merge of two halves: transfers, and conversations from
 * `/payment-notes/conversations`. That half is NOT mounted on this backend (it
 * 404s), so the web builds the list from the money alone. Nothing pretends
 * otherwise: there is no chat, no thread composer and no pay links.
 *
 * The app also gates its Payments tab behind `useMasterWalletsLinked()`, which
 * needs the app's keys to pass. The web skips that gate — it only guards the
 * verify screen that links a wallet, which the web cannot do — or the page
 * would dead-end on a read every signed-in person is allowed to make.
 *
 * VIEW ONLY
 *
 * Nothing here sends, requests, accepts, rejects, cancels a schedule, revokes
 * an allowance or funds a payout. Where the app offers such an action the row
 * is drawn and the action is named as the app's. The one money action the web
 * has is receiving (/add), and the withdrawal flow on the Wallet page, which
 * is approved on the phone or signed with a passkey bound to that transaction.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Transfer } from "@/lib/app/hold-api";
import { useTransfers } from "@/lib/app/money";
import {
  groupTransfersIntoThreads,
  lastActivityLine,
  peerRows,
  threadDisplayName,
  threadTime,
  transferAmount,
  tokenTicker,
  type PaymentThread,
} from "@/lib/app/payments";

import { useProductHref } from "../base";
import { BackHeader, Column, SectionTitle } from "../hold";
import { Ion, type IonName } from "../ion";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";
import { PayoutsPanel, ScheduledPanel } from "./Standing";
import { TxDetails } from "./TxDetails";

type Filter = "all" | "groups" | "favs";

type View = { kind: "list" } | { kind: "thread"; id: string } | { kind: "tx"; id: string };

/** The app's rotating placeholders (payments:searchPh and its siblings). */
const PHRASES = ["Search", "Search @username", "Search contact", "Paste wallet address"];

export function PaymentsScreen() {
  const transfers = useTransfers(100);
  const [view, setView] = useState<View>({ kind: "list" });

  const threads = useMemo(
    () => (transfers.data ? groupTransfersIntoThreads(peerRows(transfers.data.transfers)) : []),
    [transfers.data],
  );

  if (view.kind === "thread") {
    const thread = threads.find((t) => t.id === view.id) ?? null;
    return (
      <Column>
        <ThreadView thread={thread} onBack={() => setView({ kind: "list" })} onOpenTx={(id) => setView({ kind: "tx", id })} />
      </Column>
    );
  }

  if (view.kind === "tx") {
    const row = threads.flatMap((t) => t.transfers).find((t) => t.id === view.id) ?? null;
    return (
      <Column>
        <TxDetails id={view.id} row={row} onBack={() => setView({ kind: "list" })} />
      </Column>
    );
  }

  return (
    <Column>
      <List
        threads={threads}
        loading={transfers.data === undefined && !transfers.error}
        failed={!!transfers.error}
        onRetry={() => void transfers.mutate()}
        onOpen={(id) => setView({ kind: "thread", id })}
      />
      <div className="mt-6 flex flex-col gap-4">
        <ScheduledPanel />
        <PayoutsPanel />
      </div>
    </Column>
  );
}

/* ── The list ─────────────────────────────────────────────────────── */

function List({
  threads,
  loading,
  failed,
  onRetry,
  onOpen,
}: {
  threads: PaymentThread[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      // Groups and favourites are both the app's own state: a group is a
      // `/groups` thread (not mounted here) and a favourite is a flag in the
      // app's local store, on that phone. Neither can be read from here, so
      // both filters land on their empty state rather than on a wrong list.
      if (filter !== "all") return false;
      if (!q) return true;
      return `${threadDisplayName(t)} ${t.alias} ${t.address ?? ""}`.toLowerCase().includes(q);
    });
  }, [threads, filter, query]);

  return (
    <div className="flex flex-col">
      <SearchRow value={query} onChange={setQuery} />

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
        {(
          [
            { k: "all", label: "All" },
            { k: "groups", label: "Groups" },
            { k: "favs", label: "Favourites" },
          ] as { k: Filter; label: string }[]
        ).map((c) => (
          <button
            key={c.k}
            type="button"
            aria-pressed={filter === c.k}
            onClick={() => setFilter(c.k)}
            className={`inline-flex h-[34px] shrink-0 items-center rounded-[10px] px-3 text-[12px] tracking-[-0.2px] text-white transition-colors ${
              filter === c.k ? "bg-white/[0.18] font-extrabold" : "bg-white/10 hover:bg-white/[0.14]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="my-3 h-px rounded-[1px] bg-white/[0.08]" />

      {loading ? <RowSkeletons /> : null}

      {!loading && failed ? (
        <div className="flex flex-col items-center px-4 pt-12 text-center">
          <Ion name="alert-circle-outline" size={48} className="text-white/40" />
          <p className="mt-3 text-[14px] text-white/[0.62]">Could not load payment history</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-[12px] bg-white/10 px-5 py-2.5 text-[14px] font-strong text-white transition-colors hover:bg-white/[0.16]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !failed && shown.length === 0 && filter === "favs" ? (
        <Empty
          icon="star-outline"
          iconClass="text-amber/40"
          title="No favourites yet"
          body="Favourites are marked in the HOLD app."
        />
      ) : null}

      {!loading && !failed && shown.length === 0 && filter === "groups" ? (
        <Empty icon="people-outline" title="No groups yet" body="Groups are made in the HOLD app." />
      ) : null}

      {!loading && !failed && shown.length === 0 && filter === "all" ? (
        query.trim() ? (
          <Empty icon="search-outline" title="Nothing matches that" body="Try a name, a username or an address." />
        ) : (
          <EmptyHistory />
        )
      ) : null}

      {shown.map((t) => (
        <ThreadRow key={t.id} thread={t} onOpen={() => onOpen(t.id)} />
      ))}
    </div>
  );
}

/**
 * The app's SearchBar, "input" size default: 36 high, radius 16, the glyph at
 * 60% white, the phrases cycling every two seconds until somebody types.
 *
 * On the phone this pill opens the SearchPalette. There is no palette here —
 * the shell has ⌘K — so it filters the list where it stands.
 */
function SearchRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhrase((i) => (i + 1) % PHRASES.length), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-9 items-center gap-2 rounded-[16px] border border-white/[0.08] bg-white/10 px-3">
      <Ion name="search" size={16} className="shrink-0 text-white/60" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value ? PHRASES[0] : PHRASES[phrase]}
        aria-label="Search payments"
        className="min-w-0 flex-1 bg-transparent text-[14px] tracking-[-0.2px] text-white outline-none placeholder:text-white/55"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear" className="shrink-0 text-white/60 hover:text-white">
          <Ion name="close-circle" size={16} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * SwipeablePaymentRow › GlassCard: the avatar, the name, the last line, the
 * time. The card's ink is a colour and not a wash, so hover lifts that colour
 * — a white overlay would replace #15313D and read as a dimmer card.
 */
function ThreadRow({ thread, onOpen }: { thread: PaymentThread; onOpen: () => void }) {
  const name = threadDisplayName(thread);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${cardClass} mb-3 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#1A3B49]`}
    >
      <Avatar kind={thread.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-white/75">{lastActivityLine(thread.lastLine)}</span>
      </span>
      <span className="shrink-0 text-[12px] text-white/55">{threadTime(thread.lastTs)}</span>
    </button>
  );
}

/**
 * The app's avatar rules, minus the photograph: `/transfers` carries no
 * counterparty picture on this backend, so a HOLD person wears the app's mark
 * and everybody else the icon their kind gets on the phone.
 */
function Avatar({ kind }: { kind: PaymentThread["kind"] }) {
  if (kind === "hihodl") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icon.png" alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-[7px] object-cover" />
    );
  }
  const face: Record<string, { icon: IonName; ink: string; bg: string; ring: string }> = {
    evm: { icon: "wallet-outline", ink: "#7CC6E8", bg: "rgba(124,198,232,0.12)", ring: "rgba(124,198,232,0.25)" },
    sol: { icon: "wallet-outline", ink: "#7CC6E8", bg: "rgba(124,198,232,0.12)", ring: "rgba(124,198,232,0.25)" },
    iban: { icon: "business-outline", ink: "#6EE7B7", bg: "rgba(110,231,183,0.12)", ring: "rgba(110,231,183,0.25)" },
    card: { icon: "card-outline", ink: "#FCD34D", bg: "rgba(252,211,77,0.12)", ring: "rgba(252,211,77,0.25)" },
    merchant: { icon: "storefront-outline", ink: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.08)", ring: "transparent" },
  };
  const f = face[kind] ?? { icon: "person-outline" as IonName, ink: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.08)", ring: "transparent" };
  return (
    <span
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border"
      style={{ backgroundColor: f.bg, borderColor: f.ring }}
    >
      <Ion name={f.icon} size={16} color={f.ink} />
    </span>
  );
}

/** The app's skeleton rows: the widths it uses, in its order. */
const SKELETON_ROWS = [
  ["w-[180px]", "w-[108px]"],
  ["w-[140px]", "w-[84px]"],
  ["w-[200px]", "w-[120px]"],
  ["w-[160px]", "w-[96px]"],
  ["w-[120px]", "w-[72px]"],
];

function RowSkeletons() {
  return (
    <div className="flex flex-col">
      {SKELETON_ROWS.map(([top, bottom], i) => (
        <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] py-3">
          <Skeleton className="h-[34px] w-[34px] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className={`h-3.5 rounded-[7px] ${top}`} />
            <Skeleton className={`h-[11px] rounded-[6px] ${bottom}`} />
          </div>
          <Skeleton className="h-[11px] w-8 rounded-[6px]" />
        </div>
      ))}
    </div>
  );
}

function Empty({ icon, iconClass = "text-white/40", title, body }: { icon: IonName; iconClass?: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-4 pt-12 text-center">
      <Ion name={icon} size={48} className={iconClass} />
      <p className="mt-3 text-[14px] text-white/[0.62]">{title}</p>
      <p className="mt-1 text-[13px] text-white/55">{body}</p>
    </div>
  );
}

/** The app's global empty state: chat bubbles, and the way to put money in. */
function EmptyHistory() {
  const href = useProductHref();
  return (
    <div className="flex flex-col items-center px-4 pt-12 text-center">
      <Ion name="chatbubbles-outline" size={48} className="text-white/40" />
      <p className="mt-3 text-[14px] text-white/[0.62]">No payment history yet</p>
      <p className="mt-1 text-[13px] text-white/55">Top up your account to start sending and receiving.</p>
      <Link
        href={href("/add")}
        className="mt-5 rounded-[14px] bg-amber px-6 py-3 text-[15px] font-bold text-[#070C12] transition-opacity hover:opacity-90"
      >
        Add money
      </Link>
    </div>
  );
}

/* ── One counterparty ─────────────────────────────────────────────── */

/**
 * What the app's thread screen is once the chat is taken out of it: every
 * payment with this person, newest first. Tapping one opens the app's details.
 *
 * The app's thread also composes messages and starts payments. Neither is
 * here: the composer is chat (not mounted) and paying is the app's.
 */
function ThreadView({
  thread,
  onBack,
  onOpenTx,
}: {
  thread: PaymentThread | null;
  onBack: () => void;
  onOpenTx: (id: string) => void;
}) {
  if (!thread) {
    return (
      <>
        <BackHeader title="Payments" onBack={onBack} />
        <Empty icon="cloud-offline-outline" title="That conversation is not loaded" body="Go back and open it again." />
      </>
    );
  }
  const rows = [...thread.transfers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <>
      <BackHeader title={threadDisplayName(thread)} subtitle={`${rows.length} ${rows.length === 1 ? "payment" : "payments"}`} onBack={onBack} />
      <SectionTitle first>Payments</SectionTitle>
      <div className={`${cardClass} flex flex-col`}>
        {rows.map((t, i) => (
          <TransferRow key={t.id} row={t} first={i === 0} onOpen={() => onOpenTx(t.id)} />
        ))}
      </div>
      <p className="mt-3 px-1 text-[12px] leading-[17px] text-white/55">
        Messages and paying this person again happen in the HOLD app.
      </p>
    </>
  );
}

function TransferRow({ row, first, onOpen }: { row: Transfer; first: boolean; onOpen: () => void }) {
  const amount = transferAmount(row);
  const inbound = row.direction === "in";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] ${first ? "" : "border-t border-white/[0.06]"}`}
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
        <Ion name={inbound ? "arrow-down" : "arrow-up"} size={16} color={inbound ? "#20D690" : "#FFB703"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-strong text-white">{inbound ? "Received" : "Sent"}</span>
        <span className="mt-0.5 block truncate text-[12px] text-white/55">{threadTime(Date.parse(row.createdAt))}</span>
      </span>
      <span className={`shrink-0 text-[14px] font-strong tabular-nums ${inbound ? "text-[#20D690]" : "text-white"}`}>
        {inbound ? "+" : "-"}
        {Math.abs(amount).toFixed(2)} {tokenTicker(row)}
      </span>
    </button>
  );
}
