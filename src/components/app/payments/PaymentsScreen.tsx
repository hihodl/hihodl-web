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
 * THE MONEY, FROM A THREAD
 *
 * A thread's Send and Request are Quick Send (wallet/QuickSend), with the
 * person locked in. Request writes a row with the session and moves nothing;
 * Send, and Pay on a request made of you, go through the web's one payment
 * path, /wallet/send, approved with the passkey or on the linked phone. The
 * rest of the money here (schedules, allowances, payouts) is still read only.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useConversations } from "@/lib/app/chat";
import type { DisplayMode } from "@/lib/app/display-mode";
import { useLocale, useT } from "@/lib/app/i18n/react";
import { HoldApiError } from "@/lib/app/hold-api";
import {
  askFor,
  describeRequestError,
  resolveHandle,
  usePaymentRequests,
  webCanPay,
  type PaymentRequest,
} from "@/lib/app/payment-requests";
import { requestPeers } from "@/lib/app/request-rules";
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
import { useShell, useShellPrefs } from "../Shell";
import { Skeleton } from "../ui";
import { cardClass } from "../wallet/app-kit";
import { QuickSendView, type QuickOption } from "../wallet/QuickSend";
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
const PHRASES = [
  "payments.search.phrase.search",
  "payments.search.phrase.username",
  "payments.search.phrase.contact",
  "payments.search.phrase.address",
] as const;

export function PaymentsScreen({ initialFilter = "all" }: { initialFilter?: Filter } = {}) {
  const { displayMode } = useShellPrefs();
  // The rows carry worded names ("Wallet • …", "You: …"), so they are rebuilt in a new language.
  const locale = useLocale();
  const transfers = useTransfers(100);
  const conversations = useConversations();
  const requests = usePaymentRequests();
  const { session } = useShell();
  const meId = session?.user?.id ?? null;
  const [view, setView] = useState<View>({ kind: "list" });

  /**
   * The money half is what this screen waits for; the words half is allowed to
   * be late or to fail. A chat read that 500s must not take the payment history
   * down with it — somebody opened this to check a number.
   */
  const rows = useMemo(() => {
    if (!transfers.data) return [];
    /*
     * A request can be the first thing between two people. Its peer joins the
     * conversations half, so the person asked finds a thread to open after the
     * push, and a peer who is already a conversation keeps that row.
     */
    const chats = conversations.data ?? [];
    const talking = new Set(chats.map((c) => c.peerId));
    const asked = requestPeers(requests.data, meId).filter((p) => !talking.has(p.peerId));
    return mergeInbox(groupTransfersIntoThreads(peerRows(transfers.data.transfers)), [...chats, ...asked]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfers.data, conversations.data, requests.data, meId, locale]);

  /*
   * ?thread=<id>: back from Quick Send, or from paying a request, lands in the
   * conversation it left and not on the list. Read once the rows are here,
   * then taken off the address, so Back to the list does not reopen it.
   */
  const [deepThread, setDeepThread] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("thread");
    if (id) setDeepThread(id);
  }, []);
  useEffect(() => {
    if (!deepThread || !rows.some((r) => r.id === deepThread)) return;
    setView({ kind: "thread", id: deepThread });
    setDeepThread(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("thread");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [deepThread, rows]);

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
  const t = useT();
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
      const th = r.thread;
      return `${r.name} ${th?.alias ?? ""} ${th?.address ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  return (
    <div className="flex flex-col">
      <SearchRow value={query} onChange={setQuery} />

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
        {(
          [
            { k: "all", label: t("common.all") },
            { k: "groups", label: t("payments.filter.groups") },
            { k: "favs", label: t("payments.filter.favourites") },
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
          <p className="mt-3 text-[14px] text-white/[0.62]">{t("payments.list.loadFailed")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-[12px] bg-white/10 px-5 py-2.5 text-[14px] font-strong text-white transition-colors hover:bg-white/[0.16]"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {!loading && !failed && shown.length === 0 && filter === "favs" ? (
        <Empty
          icon="star-outline"
          iconClass="text-amber/40"
          title={t("payments.list.noFavouritesTitle")}
          body={t("payments.list.noFavouritesBody")}
        />
      ) : null}

      {!loading && !failed && shown.length === 0 && filter === "all" ? (
        query.trim() ? (
          <Empty icon="search-outline" title={t("payments.list.noMatchTitle")} body={t("payments.list.noMatchBody")} />
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
  const t = useT();
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
        placeholder={t(value ? PHRASES[0] : PHRASES[phrase])}
        aria-label={t("payments.search.aria")}
        className="min-w-0 flex-1 bg-transparent text-[14px] tracking-[-0.2px] text-white outline-none placeholder:text-white/55"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label={t("payments.search.clear")} className="shrink-0 text-white/60 hover:text-white">
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
  useT();
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
  const t = useT();
  const href = useProductHref();
  return (
    <div className="flex flex-col items-center px-4 pt-12 text-center">
      <Ion name="chatbubbles-outline" size={48} className="text-white/40" />
      <p className="mt-3 text-[14px] text-white/[0.62]">{t("payments.list.emptyTitle")}</p>
      <p className="mt-1 text-[13px] text-white/55">{t("payments.list.emptyBody")}</p>
      <Link
        href={href("/add")}
        className="mt-5 rounded-[14px] bg-amber px-6 py-3 text-[15px] font-bold text-[#070C12] transition-opacity hover:opacity-90"
      >
        {t("payments.list.addMoney")}
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
  const t = useT();
  const productHref = useProductHref();
  const requests = usePaymentRequests();
  const [asking, setAsking] = useState(false);
  const [opening, setOpening] = useState(false);
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
        <BackHeader title={t("payments.thread.title")} onBack={onBack} />
        <Empty icon="cloud-offline-outline" title={t("payments.thread.notLoadedTitle")} body={t("payments.thread.notLoadedBody")} />
      </>
    );
  }
  const payments = [...row.transfers].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const handle = row.thread?.alias ?? null;
  // The name Quick Send locks in its header: the handle when there is one, which is what the app shows.
  const lockedName = handle ? `@${handle.replace(/^@/, "")}` : row.name;

  /**
   * Quick Send, with as much of the answer as we honestly have.
   *
   * The thread IS the recipient, so Send opens on the amount with the person
   * locked in the header (wallet/QuickSend) and Back returns here. That needs
   * their address, which a public handle resolves to; when it does not, Send
   * opens on its own first step and asks. Never a guess: the one thing worse
   * than typing an address is being handed the wrong one.
   *
   * It is /wallet/send and a full load (the wallet pages' CSP), because that is
   * where the web's one payment path lives: the passkey, or the linked phone.
   */
  const openSend = async (prefill?: { amount?: string; token?: string; requestId?: string; handle?: string | null }) => {
    const who = prefill?.handle ?? handle;
    const resolved = who ? await resolveHandle(who) : null;
    const q = new URLSearchParams();
    if (resolved && (resolved.chain === "solana" || resolved.chain === "sol") && resolved.address) {
      q.set("to", resolved.address);
      q.set("peer", who ? `@${who.replace(/^@/, "")}` : lockedName);
    }
    if (prefill?.amount) q.set("amount", prefill.amount);
    if (prefill?.token) q.set("token", prefill.token.toUpperCase());
    // So the send, once confirmed, closes this request with its withdrawal (Withdraw → settle {withdrawalId}).
    if (prefill?.requestId) {
      q.set("request", prefill.requestId);
      q.set("lock", "1");
    }
    q.set("back", `/payments?thread=${encodeURIComponent(row.id)}`);
    const to = `${productHref("/wallet/send")}?${q.toString()}`;
    // Linking comes back to this very send, filled in, and it carries on there.
    if (gate.blocked) return gate.ask(to);
    window.location.assign(to);
  };

  /** Pay on a request made of you: Quick Send with the person, the amount and the token locked. */
  const payTheirRequest = (r: PaymentRequest) => {
    const can = webCanPay(r);
    if (!("token" in can)) return;
    void openSend({ amount: r.amount, token: can.token, requestId: r.id, handle: r.requester?.username ?? handle });
  };

  // Request is Quick Send in request mode, drawn in place of the thread: no wallet, no passkey, no phone.
  if (asking && row.peerId) {
    return (
      <RequestScreen
        peerId={row.peerId}
        peerName={lockedName}
        onBack={() => setAsking(false)}
        onAsked={() => {
          setAsking(false);
          void requests.mutate();
        }}
      />
    );
  }

  return (
    <>
      <BackHeader
        title={row.name}
        subtitle={payments.length ? t("payments.thread.paymentCount", { count: payments.length }) : t("payments.thread.noPayments")}
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
          quieter shape, Send on the right as the filled amber. Both open Quick
          Send with this person locked in: Request in request mode, here, with
          no key; Send on /wallet/send, approved with the passkey or on a
          linked phone. It wraps on a phone rather than scrolling sideways. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          disabled={!row.peerId}
          title={row.peerId ? undefined : t("payments.thread.noAccount")}
          onClick={() => setAsking(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-strong text-white transition-colors hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ion name="download-outline" size={14} />
          {t("payments.thread.request")}
        </button>
        <button
          type="button"
          disabled={opening}
          onClick={() => {
            setOpening(true);
            void openSend().finally(() => setOpening(false));
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-amber px-3.5 text-[12.5px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:opacity-60"
        >
          <Ion name="arrow-up" size={14} />
          {opening ? t("payments.thread.opening") : t("common.send")}
        </button>
        {shop ? (
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-white/10 px-3.5 text-[12.5px] font-strong text-white transition-colors hover:bg-white/[0.16]"
          >
            <Ion name="megaphone-outline" size={14} />
            {t("payments.thread.bookSpot")}
          </button>
        ) : null}
        <p className="min-w-0 flex-1 text-[12px] leading-[17px] text-white/60">
          {t("payments.thread.approvedOnPhone")}
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

    </>
  );
}

/**
 * Request: Quick Send in request mode (the app's QuickRequestScreen).
 *
 * The same keypad and the same token and network selector, with a note the
 * other person reads on the bubble, and a Request button. It writes
 * `POST /payments/request` with the session and nothing else: there is no
 * passkey, no approval on the phone and no signature, because no money moves.
 * The money moves later, when they press Pay on the bubble.
 *
 * WHICH TOKENS
 *
 * USDC on the four chains HOLD runs on, and SOL. The person asked may pay
 * from the app, which pays any of them. The web pays the Solana ones; a
 * request on another chain says, on the payer's web bubble, to pay it in the
 * app, rather than being refused here.
 */
const REQUEST_OPTIONS: readonly QuickOption[] = [
  { token: "USDC", chain: "solana" },
  { token: "USDC", chain: "base" },
  { token: "USDC", chain: "polygon" },
  { token: "USDC", chain: "ethereum" },
  { token: "SOL", chain: "solana" },
];

function RequestScreen({
  peerId,
  peerName,
  onBack,
  onAsked,
}: {
  peerId: string;
  peerName: string;
  onBack: () => void;
  onAsked: () => void;
}) {
  const t = useT();
  const [amount, setAmount] = useState("");
  const [option, setOption] = useState<QuickOption>(REQUEST_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const clean = amount.replace(/\.$/, "");
  const value = Number(clean);
  const ok = Number.isFinite(value) && value > 0;

  const submit = async () => {
    if (!ok || sending) return;
    setSending(true);
    setNotice(null);
    try {
      await askFor({ payerUserId: peerId, amount: clean, tokenId: option.token, chain: option.chain, note });
      onAsked();
    } catch (e) {
      setNotice(e instanceof HoldApiError ? describeRequestError(e) : describeRequestError({ status: -1 }));
      setSending(false);
    }
  };

  return (
    <QuickSendView
      mode="request"
      recipient={{ name: peerName, locked: true }}
      onBack={onBack}
      amount={amount}
      onAmount={setAmount}
      decimals={option.token === "SOL" ? 9 : 6}
      option={option}
      options={REQUEST_OPTIONS}
      onOption={setOption}
      note={note}
      onNote={setNote}
      notice={notice}
      cta={{ label: sending ? t("requests.requesting") : t("requests.cta"), disabled: !ok || sending, onClick: () => void submit() }}
    />
  );
}
