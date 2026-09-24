"use client";

/**
 * Payments, as the HOLD app has it (src/payments/PaymentsHome.tsx): the search
 * row, the `All · Groups · Favourites` chips, and one row per counterparty
 * built by grouping `/transfers` — avatar or person placeholder, the name, the
 * last line, the time.
 *
 * BOTH HALVES
 *
 * The app's list is the merge of transfers and conversations, and so is this
 * one — see `mergeInbox`. For a while the web had only the money, because a
 * stale checkout was read and the whole chat router was reported missing. It
 * was never missing. Sixteen routes, Giphy behind one of them, all of it plain
 * `requireAuth`, and none of it needing a key.
 *
 * WHICH IS WHY THE CHAT IS THE ONE THING HERE THAT IS NOT A LESSER COPY
 *
 * Paying needs a signature and the signature needs the phone, so every money
 * action on this screen is drawn and named and then handed to the app. A
 * sentence needs no signature. The conversation on the web is the whole
 * conversation: messages, GIFs, read receipts, requests.
 *
 * GROUPS ARE THE OTHER HALF OF THE CHIPS
 *
 * `Groups` used to land on an empty state that sent people to the app. A group
 * is a conversation with its money in it (lib/app/groups.ts), and its words,
 * expenses and people need no key, so the chip now lists them and each opens
 * its thread at /payments/groups/<id>. Settling up is the one part the web
 * hands to the app (see GroupThread).
 *
 * The app also gates its Payments tab behind `useMasterWalletsLinked()`, which
 * needs the app's keys to pass. The web skips that gate — it only guards the
 * verify screen that links a wallet, which the web cannot do — or the page
 * would dead-end on a read every signed-in person is allowed to make.
 *
 * VIEW ONLY, FOR THE MONEY
 *
 * Nothing here sends, requests, cancels a schedule, revokes an allowance or
 * funds a payout. The one money action the web has is receiving (/add), and the
 * withdrawal flow on the Wallet page, which is approved on the phone or signed
 * with a passkey bound to that one transaction.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useConversations } from "@/lib/app/chat";
import type { DisplayMode } from "@/lib/app/display-mode";
import { askFor, requestAmount, resolveHandle, usePaymentRequests, type PaymentRequest } from "@/lib/app/payment-requests";
import { storefrontOf, useSpotsBoughtFrom } from "@/lib/app/sponsor";
import { useTransfers } from "@/lib/app/money";
import {
  groupTransfersIntoThreads,
  lastActivityLine,
  mergeInbox,
  peerRows,
  threadTime,
  type InboxRow,
} from "@/lib/app/payments";

import { SponsorFlow } from "../sponsor/SponsorFlow";
import { useProductHref } from "../base";
import { BackHeader, Column } from "../hold";
import { Ion, type IonName } from "../ion";
import { useLinkGate } from "../link/LinkGate";
import { useShellPrefs } from "../Shell";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";
import { Conversation, SafetyMenu } from "./Chat";
import { GroupsList } from "./Groups";
import { ChatRequests } from "./Requests";
import { PayoutsPanel, ScheduledPanel } from "./Standing";
import { TxDetails } from "./TxDetails";

type Filter = "all" | "groups" | "favs";

/**
 * A transaction is opened FROM somewhere, and back means that somewhere. It is
 * reached from inside a thread, so `from` carries the thread it was tapped in
 * and Back returns to the conversation, not to the list of conversations.
 */
type View = { kind: "list" } | { kind: "thread"; id: string } | { kind: "tx"; id: string; from: string | null };

/** The app's rotating placeholders (payments:searchPh and its siblings). */
const PHRASES = ["Search", "Search @username", "Search contact", "Paste wallet address"];

export function PaymentsScreen({ initialFilter = "all" }: { initialFilter?: Filter } = {}) {
  const { displayMode } = useShellPrefs();
  const transfers = useTransfers(100);
  const conversations = useConversations();
  const [view, setView] = useState<View>({ kind: "list" });

  /**
   * The money half is what this screen waits for; the words half is allowed to
   * be late or to fail. A chat read that 500s must not take the payment history
   * down with it — somebody opened this to check a number.
   */
  const rows = useMemo(
    () =>
      transfers.data
        ? mergeInbox(groupTransfersIntoThreads(peerRows(transfers.data.transfers)), conversations.data ?? [])
        : [],
    [transfers.data, conversations.data],
  );

  if (view.kind === "thread") {
    const row = rows.find((r) => r.id === view.id) ?? null;
    return (
      <Column>
        <ThreadView
          row={row}
          mode={displayMode}
          onBack={() => setView({ kind: "list" })}
          onOpenTx={(id) => setView({ kind: "tx", id, from: view.id })}
        />
      </Column>
    );
  }

  if (view.kind === "tx") {
    const row = rows.flatMap((r) => r.transfers).find((t) => t.id === view.id) ?? null;
    const from = view.from;
    /** The thread can have gone (a reload that lands straight here): then back is the list. */
    const back = from && rows.some((r) => r.id === from) ? { kind: "thread" as const, id: from } : { kind: "list" as const };
    const backTo = back.kind === "thread" ? rows.find((r) => r.id === back.id)?.name ?? null : null;
    return (
      <Column>
        <TxDetails id={view.id} row={row} mode={displayMode} backTo={backTo} onBack={() => setView(back)} />
      </Column>
    );
  }

  return (
    <Column>
      <ChatRequests onAnswered={() => void conversations.mutate()} />
      <List
        initialFilter={initialFilter}
        rows={rows}
        mode={displayMode}
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
  initialFilter,
  rows,
  mode,
  loading,
  failed,
  onRetry,
  onOpen,
}: {
  initialFilter: Filter;
  rows: InboxRow[];
  mode: DisplayMode;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      // A favourite is a flag in the app's local store, on that phone, and is
      // not readable from here, so that filter lands on its empty state rather
      // than on a wrong list. Groups are not rows of this list at all: that
      // chip draws GroupsList instead.
      if (filter !== "all") return false;
      if (!q) return true;
      const t = r.thread;
      return `${r.name} ${t?.alias ?? ""} ${t?.address ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

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

      {filter === "groups" ? <GroupsList /> : null}

      {loading && filter !== "groups" ? <RowSkeletons /> : null}

      {!loading && failed && filter !== "groups" ? (
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

      {!loading && !failed && shown.length === 0 && filter === "all" ? (
        query.trim() ? (
          <Empty icon="search-outline" title="Nothing matches that" body="Try a name, a username or an address." />
        ) : (
          <EmptyHistory />
        )
      ) : null}

      {shown.map((r) => (
        <ThreadRow key={r.id} row={r} mode={mode} onOpen={() => onOpen(r.id)} />
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
function ThreadRow({ row, mode, onOpen }: { row: InboxRow; mode: DisplayMode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${cardClass} mb-3 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#1A3B49]`}
    >
      <Avatar kind={row.kind} avatarUrl={row.avatarUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{row.name}</span>
        <span className="mt-0.5 block truncate text-[13px] text-white/75">
          {/* A message is already a sentence; a money line still has to be worded. */}
          {row.lineIsMessage ? row.line : lastActivityLine(row.line, mode)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[12px] text-white/70">{threadTime(row.ts)}</span>
        {row.unread > 0 ? (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-amber px-1.5 text-[11px] font-extrabold tabular-nums text-[#0F0F1A]">
            {row.unread > 99 ? "99+" : row.unread}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * The app's avatar rules, minus the photograph: `/transfers` carries no
 * counterparty picture on this backend, so a HOLD person wears the app's mark
 * and everybody else the icon their kind gets on the phone.
 */
function Avatar({ kind, avatarUrl }: { kind: InboxRow["kind"]; avatarUrl?: string | null }) {
  // The conversations half carries a picture where transfers never did, so a
  // person you have talked to wears their own face instead of the app's mark.
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
    );
  }
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
 * The app's thread screen: the payments with this person, and the conversation.
 *
 * MONEY ABOVE, WORDS BELOW
 *
 * The app's order, and for the app's reason: this is a money screen, and a
 * composer that pushed the history down would make it read as a chat that
 * happens to move money rather than the other way round.
 *
 * PAYING FROM HERE IS NOT THE APP'S ANY MORE
 *
 * It was, and the screen said so: "Paying X again happens in the HOLD app."
 * A payment started here is approved and signed on the linked phone, iPhone
 * or Android, in the HOLD app (2026-09-24: the web never pays by itself).
 * Send is a screen this product already has: components/app/wallet/Withdraw.tsx.
 *
 * REQUEST IS THE OTHER HALF, AND IT WAS SIMPLY MISSING
 *
 * The app's thread has had Request beside Send since the beginning; the web
 * had Send alone. `POST /payments/request` has existed the whole time — the
 * gap was here, not on the server. A request moves no money and needs no key,
 * so it is the one MONEY write a browser can make on its own: it writes a row
 * and puts a Pay button on somebody else's screen.
 *
 * THE RECIPIENT IS RESOLVED NOW, WHEN IT CAN BE
 *
 * A thread knows a person and Send wants a Solana address. `GET /alias/
 * resolve/:handle` turns the one into the other for anybody with a public
 * handle, so Send opens filled in. When it does not resolve — a private alias,
 * somebody who never chose one — Send opens empty rather than guessing. What
 * this screen must never do again is tell somebody to go and fetch an app to
 * do a thing their browser can do.
 */
function ThreadView({
  row,
  mode,
  onBack,
  onOpenTx,
}: {
  row: InboxRow | null;
  mode: DisplayMode;
  onBack: () => void;
  onOpenTx: (id: string) => void;
}) {
  const productHref = useProductHref();
  const requests = usePaymentRequests();
  const [asking, setAsking] = useState(false);
  const spots = useSpotsBoughtFrom(row?.peerId ?? null);
  // A wallet made in the app with no phone linked: Send and Pay open the sheet (link/LinkGate).
  const gate = useLinkGate();
  /*
   * THE THIRD DOOR, AND ONLY THE THIRD.
   *
   * A brand's home is the board (Spaces › Find a spot), and the offer card is
   * where a price is already on screen. This is a shortcut for the one case
   * neither covers: you are mid-conversation with somebody and you decide now.
   *
   * It appears only when they actually sell something — `storefrontOf` answers
   * null otherwise — so it is never a button that opens an empty page.
   */
  const [shop, setShop] = useState<{ handle: string; live: number } | null>(null);
  const [booking, setBooking] = useState(false);
  const peerId = row?.peerId ?? null;
  useEffect(() => {
    if (!peerId) return;
    let alive = true;
    storefrontOf(peerId).then(
      (r) => alive && setShop(r.storefront),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [peerId]);
  if (!row) {
    return (
      <>
        <BackHeader title="Payments" onBack={onBack} />
        <Empty icon="cloud-offline-outline" title="That conversation is not loaded" body="Go back and open it again." />
      </>
    );
  }
  const payments = [...row.transfers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const handle = row.thread?.alias ?? null;

  /**
   * Send, with as much of the answer as we honestly have.
   *
   * The handle resolves to an address for anybody who chose a public one; when
   * it does not, Send opens on its own first step and asks. Never a guess: the
   * one thing worse than typing an address is being handed the wrong one.
   */
  const openSend = async (prefill?: { amount?: string; token?: string; requestId?: string }) => {
    const resolved = handle ? await resolveHandle(handle) : null;
    const q = new URLSearchParams();
    if (resolved?.chain === "solana" && resolved.address) q.set("to", resolved.address);
    if (prefill?.amount) q.set("amount", prefill.amount);
    if (prefill?.token) q.set("token", prefill.token.toUpperCase());
    // So the send, once confirmed, closes this request (Withdraw → /payments/requests/:id/settle).
    if (prefill?.requestId) q.set("request", prefill.requestId);
    // /wallet/send, a full load (the wallet pages' CSP): it answers a wallet made in the app, and no wallet, too.
    const query = q.toString();
    const to = `${productHref("/wallet/send")}${query ? `?${query}` : ""}`;
    // Linking comes back to this very send, filled in, and it carries on there.
    if (gate.blocked) return gate.ask(to);
    window.location.assign(to);
  };

  const payTheirRequest = (r: PaymentRequest) => {
    const amount = requestAmount(r);
    void openSend({ amount: amount === null ? undefined : String(amount), token: r.tokenId, requestId: r.id });
  };

  return (
    <>
      <BackHeader
        title={row.name}
        subtitle={payments.length ? `${payments.length} ${payments.length === 1 ? "payment" : "payments"}` : "No payments yet"}
        onBack={onBack}
        // Only where there is somebody to block: a thread that is an address
        // and nothing else has no account on the other side.
        right={row.peerId ? <SafetyMenu peerId={row.peerId} peerName={row.name} onBlocked={onBack} /> : undefined}
      />

      <Conversation
        peerId={row.peerId}
        peerName={row.name}
        payments={payments}
        mode={mode}
        onOpenTx={onOpenTx}
        onPayRequest={payTheirRequest}
        spots={spots}
      />

      {/* The app's own row, in the app's own order: Request on the left in the
          quieter shape, Send on the right as the filled amber. Both are real
          here now — a request needs no key, and a send is approved with the
          passkey or on a linked phone. */}
      <div className="mt-3 flex items-center gap-2 px-1">
        <button
          type="button"
          disabled={!row.peerId}
          title={row.peerId ? undefined : "There is no HOLD account on the other side of this thread."}
          onClick={() => setAsking(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-strong text-white transition-colors hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ion name="download-outline" size={14} />
          Request
        </button>
        <button
          type="button"
          onClick={() => void openSend()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-amber px-3.5 text-[12.5px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow"
        >
          <Ion name="arrow-up" size={14} />
          Send
        </button>
        {shop ? (
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-strong text-white transition-colors hover:bg-white/[0.16]"
          >
            <Ion name="megaphone-outline" size={14} />
            Book a spot
          </button>
        ) : null}
        <p className="min-w-0 flex-1 text-[12px] leading-[17px] text-white/60">
          Approved and signed on your linked phone, in the HOLD app.
        </p>
      </div>

      {gate.sheet}

      {booking && shop ? (
        <SponsorFlow
          handle={shop.handle}
          creatorName={row.name}
          onClose={() => setBooking(false)}
          onBought={() => setBooking(false)}
        />
      ) : null}

      {asking && row.peerId ? (
        <AskSheet
          peerId={row.peerId}
          peerName={row.name}
          onClose={() => setAsking(false)}
          onAsked={() => {
            setAsking(false);
            void requests.mutate();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * "How much?" — and nothing else.
 *
 * The app's QuickRequestScreen picks a token and a chain from the balances,
 * because on a phone somebody may be holding five things. Here the wallet is
 * Solana USDC, so asking which one would be a question with one answer. If
 * that stops being true this grows a picker; until then it does not pretend.
 */
function AskSheet({
  peerId,
  peerName,
  onClose,
  onAsked,
}: {
  peerId: string;
  peerName: string;
  onClose: () => void;
  onAsked: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = Number(amount.replace(",", "."));
  const ok = Number.isFinite(value) && value > 0;

  const submit = async () => {
    if (!ok || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await askFor({ payerUserId: peerId, amount: String(value) });
      onAsked();
    } catch {
      setFailed(true);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      {/* The backdrop closes it; the sheet must not, or every tap inside shuts it. */}
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative w-full max-w-[420px] rounded-[20px] border border-white/[0.12] bg-[#0E2430] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <p className="text-[15px] font-extrabold tracking-[-0.2px] text-white">Ask {peerName} for</p>
        <p className="mt-1 text-[12.5px] leading-[17px] text-white/65">
          They see it in this conversation with a Pay button. Nothing moves until they pay it.
        </p>

        <label className="mt-3 flex h-12 items-center gap-2 rounded-[16px] border border-white/[0.15] bg-white/[0.06] px-3.5 focus-within:border-white/30">
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 12))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="0.00"
            aria-label="Amount in USDC"
            className="h-full min-w-0 flex-1 bg-transparent text-[20px] font-extrabold tabular-nums text-white outline-none placeholder:text-white/40"
          />
          <span className="shrink-0 text-[13px] font-bold text-white/80">USDC</span>
        </label>

        {failed ? <p className="mt-2 text-[12px] leading-[17px] text-white/75">That did not go through. Try again.</p> : null}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!ok || sending}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-[12px] bg-amber text-[14px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:bg-white/[0.12] disabled:text-white/50"
          >
            {sending ? "Asking…" : "Send request"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white/10 px-4 text-[14px] font-strong text-white/85 transition-colors hover:bg-white/[0.16]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
