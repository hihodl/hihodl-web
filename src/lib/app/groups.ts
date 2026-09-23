"use client";

/**
 * Groups: a group is a conversation, and its money is part of it.
 *
 * The contract is the backend's documentation/groups-thread-v0.md. One thread
 * per group: messages, expenses and settlements in one order, newest first on
 * the wire. There is no separate chat screen and no separate ledger screen, on
 * the phone or here, and the same thread opens from Payments › Groups and, for
 * a crew, from Spaces › Crew.
 *
 * MONEY IS A STRING OF MINOR UNITS, END TO END
 *
 * `amountMinor`, `groupMinor`, `shareMinor`, `netMinor`: all strings, all
 * integers in the currency's smallest unit. They are read with BigInt and
 * printed with `formatMinor`, never through a float: a float that is off by a
 * cent in a split is a group that never settles to zero. The exponent is the
 * backend's `minorExponent` table (JPY 0, KWD 3, everything else 2), copied
 * here so a yen amount is not printed as hundredths.
 *
 * WHAT THE WEB WRITES, AND WHAT IT DOES NOT
 *
 * Words, expenses, members and read markers are writes with no key behind
 * them, like the payment chat (lib/app/chat.ts). A settlement is different:
 * "Paid in HOLD" is a claim that money moved, and the server checks it against
 * a payment intent. The web's only send is a Solana withdrawal
 * (lib/link/api.ts), which is a `withdrawal_requests` row and not a payment
 * intent, so the server would refuse it as `transfer_not_found`. The web
 * therefore never records a settlement WITH a transferId. It records the
 * payer's word ("I paid another way"), after a confirm, and sends the person to
 * the app for the real payment. See GroupThread's Settle up.
 *
 * THE IDEMPOTENCY KEY AND THE WORKER
 *
 * Every write here carries a client key, and the key is what the optimistic
 * bubble is matched by. Whether it travels as the `Idempotency-Key` header is
 * a separate question, answered by the Cloudflare Worker in front of
 * api.hihodl.xyz: its preflight allowed only `Content-Type, Authorization`
 * until 2026-09-23, when `Idempotency-Key` was added (checked with an OPTIONS
 * on /api/v1/groups). A browser that sends a header the preflight did not
 * allow never sends the request at all, so if the Worker ever drops it again,
 * set `SEND_IDEMPOTENCY_HEADER` back to false or every message breaks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { HoldApiError, read } from "./hold-api";

/* ── What the server says ─────────────────────────────────────────── */

export type ThreadItem =
  | { kind: "message"; id: string; at: string; userId: string; body: string | null; deleted: boolean }
  | {
      kind: "expense";
      id: string;
      at: string;
      /** The payer. */
      userId: string;
      description: string | null;
      /** As paid, in `currency`. */
      amountMinor: string;
      currency: string;
      /** Converted into the group's currency, frozen when it was added. */
      groupMinor: string;
      shares: { userId: string; shareMinor: string }[];
      deleted: boolean;
    }
  | {
      kind: "settlement";
      id: string;
      at: string;
      /** Who paid. */
      userId: string;
      toUserId: string;
      amountMinor: string;
      currency: string;
      /** Paid through HOLD and checked against that payment; false is the payer's word. */
      viaHold: boolean;
      transferId: string | null;
    };

/** A row of GET /groups: the group itself plus what happened last. */
export interface GroupRow {
  id: string;
  name: string;
  emoji: string | null;
  /** What the book is kept in. Older rows may not carry it; the balances read always does. */
  currency?: string | null;
  crew: { id: string; name: string } | null;
  last: ThreadItem | null;
  lastAt: string | null;
  unread: number;
}

export interface GroupMember {
  userId: string;
  /** Stored with or without the "@": always strip before showing. */
  aliasHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GroupBalances {
  currency: string;
  balances: { userId: string; netMinor: string }[];
  smartSettle: boolean;
  /** The payments that clear the book. */
  transfers: { fromUserId: string; toUserId: string; amountMinor: string }[];
}

/* ── Minor units ──────────────────────────────────────────────────── */

/** The backend's MINOR_EXPONENT table (group-expenses.service.ts), unchanged. */
const MINOR_EXPONENT: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

export function minorExponent(currency: string): number {
  return MINOR_EXPONENT[currency.toUpperCase()] ?? 2;
}

function toBig(minor: string | bigint): bigint {
  if (typeof minor === "bigint") return minor;
  return /^-?\d+$/.test(minor) ? BigInt(minor) : 0n;
}

/**
 * "12.00" from "1200" in USD, "1,200" from "1200" in JPY. Thousands are
 * grouped with commas, the sign is kept, and nothing passes through a float.
 */
export function formatMinor(minor: string | bigint, currency: string): string {
  const exp = minorExponent(currency);
  const n = toBig(minor);
  const neg = n < 0n;
  const digits = (neg ? -n : n).toString().padStart(exp + 1, "0");
  const whole = exp ? digits.slice(0, -exp) : digits;
  const frac = exp ? digits.slice(-exp) : "";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/** "12.00 USD". */
export function moneyText(minor: string | bigint, currency: string): string {
  return `${formatMinor(minor, currency)} ${currency.toUpperCase()}`;
}

/**
 * What somebody typed, in minor units: "12.5" in USD is "1250". A comma is
 * read as the decimal point ("12,5"), spaces are dropped, and more decimals
 * than the currency has is refused rather than rounded: money nobody typed is
 * not added or taken away. Null for anything that is not a positive amount.
 */
export function parseMajorToMinor(text: string, currency: string): string | null {
  const exp = minorExponent(currency);
  const clean = text.replace(/\s/g, "").replace(",", ".");
  const m = /^(\d{0,15})(?:\.(\d*))?$/.exec(clean);
  if (!m || (!m[1] && !m[2])) return null;
  const frac = m[2] ?? "";
  if (frac.length > exp) return null;
  const minor = BigInt(`${m[1] || "0"}${frac.padEnd(exp, "0")}` || "0");
  return minor > 0n ? minor.toString() : null;
}

/** abs(), as a string, for "You owe 4.00" from a net of -400. */
export function absMinor(minor: string): string {
  const n = toBig(minor);
  return (n < 0n ? -n : n).toString();
}

/* ── People ───────────────────────────────────────────────────────── */

export function bareHandle(h: string | null | undefined): string | null {
  const v = (h ?? "").trim().replace(/^@+/, "");
  return v || null;
}

/** "@bea", else the display name, else a word that does not pretend to know. */
export function memberName(m: GroupMember | undefined): string {
  if (!m) return "Someone";
  const h = bareHandle(m.aliasHandle);
  return h ? `@${h}` : m.displayName?.trim() || "Someone on HOLD";
}

export type NameOf = (userId: string) => string;

/** A lookup that says "You" for the viewer. `capital` for the start of a sentence. */
export function namer(members: readonly GroupMember[] | undefined, meId: string | null): { name: NameOf; subject: NameOf } {
  const by = new Map((members ?? []).map((m) => [m.userId, m]));
  return {
    name: (id) => (id === meId ? "you" : memberName(by.get(id))),
    subject: (id) => (id === meId ? "You" : memberName(by.get(id))),
  };
}

/* ── Reading the items ────────────────────────────────────────────── */

/**
 * What the viewer's part of an expense is, in the group's currency:
 *   share   they were in the split and someone else paid
 *   lent    they paid, and this is what the others owe them for it
 *   none    they paid nothing and were not in the split
 */
export function expenseForMe(
  item: Extract<ThreadItem, { kind: "expense" }>,
  meId: string | null,
): { kind: "share"; minor: string } | { kind: "lent"; minor: string } | { kind: "none" } {
  const mine = item.shares.find((s) => s.userId === meId);
  const share = mine ? toBig(mine.shareMinor) : 0n;
  if (meId && item.userId === meId) {
    const lent = toBig(item.groupMinor) - share;
    return lent > 0n ? { kind: "lent", minor: lent.toString() } : { kind: "none" };
  }
  return share > 0n ? { kind: "share", minor: share.toString() } : { kind: "none" };
}

/** The list row's one line: "@bea: see you at 8", "Coffee · 12.00 USD", "@ana sent @bea 4.00 USD". */
export function lastLine(item: ThreadItem | null, names: { name: NameOf; subject: NameOf }): string {
  if (!item) return "No messages yet";
  switch (item.kind) {
    case "message":
      return item.deleted || item.body === null ? `${names.subject(item.userId)}: Message deleted` : `${names.subject(item.userId)}: ${item.body}`;
    case "expense":
      return `${item.description?.trim() || "Expense"} · ${moneyText(item.amountMinor, item.currency)}${item.deleted ? " · Removed" : ""}`;
    case "settlement":
      return settlementText(item, names);
  }
}

/**
 * A settlement, said the way it happened: "@ana sent @bea 4.00 USD" when HOLD
 * checked the payment, "@ana says they paid @bea 4.00 USD outside HOLD" when
 * it is somebody's word. The two must never read alike.
 */
export function settlementText(item: Extract<ThreadItem, { kind: "settlement" }>, names: { name: NameOf; subject: NameOf }): string {
  const amount = moneyText(item.amountMinor, item.currency);
  const who = names.subject(item.userId);
  const to = names.name(item.toUserId);
  if (item.viaHold) return `${who} sent ${to} ${amount}`;
  return who === "You" ? `You said you paid ${to} ${amount} outside HOLD` : `${who} says they paid ${to} ${amount} outside HOLD`;
}

/**
 * The thread, oldest first, from everything we hold about it.
 *
 * `pages` is the newest page first, then the older pages in the order they
 * were loaded, then the items this tab wrote and the server has not yet sent
 * back. The first copy of an item wins, so the newest page (re-read every ten
 * seconds) is what a deletion shows up in. `deleted` carries the messages this
 * tab deleted, for the ones that sit on an older page that is never re-read.
 */
export function mergeThread(pages: readonly (readonly ThreadItem[])[], deleted: ReadonlySet<string> = new Set()): ThreadItem[] {
  const seen = new Map<string, ThreadItem>();
  for (const page of pages) {
    for (const item of page) {
      const key = `${item.kind}:${item.id}`;
      if (!seen.has(key)) seen.set(key, item);
    }
  }
  return [...seen.values()]
    .map((i) => (i.kind === "message" && deleted.has(i.id) ? { ...i, body: null, deleted: true } : i))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
}

/** A client key, 10 to 128 characters, as the server's idemKey() wants. */
export function newClientKey(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `web-${prefix}-${rand}`;
}

/* ── Calls ────────────────────────────────────────────────────────── */

/** See the header: on because the Worker's preflight allows `Idempotency-Key`. */
export const SEND_IDEMPOTENCY_HEADER = true;

function withKey(key: string | undefined): Record<string, string> | undefined {
  return SEND_IDEMPOTENCY_HEADER && key ? { "Idempotency-Key": key } : undefined;
}

const g = (groupId: string) => `groups/${encodeURIComponent(groupId)}`;

export const listGroups = () => read<{ groups: GroupRow[] }>("groups");

export const createGroup = (body: { name: string; emoji?: string | null }) => read<{ group: GroupRow }>("groups", { json: body });

export const getGroup = (groupId: string) => read<{ group: GroupRow }>(g(groupId));

export const listMembers = (groupId: string) => read<{ members: GroupMember[] }>(`${g(groupId)}/members`);

export const getThread = (groupId: string, before?: string | null, limit = 50) =>
  read<{ items: ThreadItem[]; nextBefore: string | null }>(
    `${g(groupId)}/thread?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
  );

export const getBalances = (groupId: string) => read<GroupBalances>(`${g(groupId)}/balances`);

export const postMessage = (groupId: string, body: string, key: string) =>
  read<{ message: { id: string; createdAt: string; body: string; userId: string } }>(`${g(groupId)}/messages`, {
    json: { body },
    headers: withKey(key),
  });

export const deleteMessage = (groupId: string, messageId: string) =>
  read<{ deleted: boolean }>(`${g(groupId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });

export const markRead = (groupId: string) => read<{ read: boolean }>(`${g(groupId)}/read`, { json: {} });

export const addExpense = (
  groupId: string,
  body: { amountMinor: string; currency: string; description?: string | null; payerUserId?: string; participants?: string[] },
  key: string,
) => read<{ expense: { id: string } }>(`${g(groupId)}/expenses`, { json: body, headers: withKey(key) });

/**
 * The payer's word that they paid, with no payment behind it. There is
 * deliberately no `transferId` parameter: see the header.
 */
export const recordPaidElsewhere = (groupId: string, body: { toUserId: string; amountMinor: string }, key: string) =>
  read<{ settlement: { id: string } }>(`${g(groupId)}/settlements`, { json: body, headers: withKey(key) });

export const addMemberByHandle = (groupId: string, handle: string) =>
  read<{ userId: string; added: boolean }>(`${g(groupId)}/members/by-handle`, { json: { handle: handle.trim().replace(/^@+/, "") } });

/** What went wrong with a group call, in words. */
export function describeGroupError(e: unknown): string {
  if (!(e instanceof HoldApiError)) return "Something went wrong. Try again.";
  if (e.status === 0) return "We could not reach HOLD. Check your connection and try again.";
  switch (e.detail) {
    case "user_not_found":
      return "No one on HOLD goes by that username. Check the spelling.";
    case "group_not_found":
      return "This group isn't here any more, or you're not in it.";
    case "message_too_long":
      return "That message is too long.";
    case "description_too_long":
      return "Keep what it was for under 120 characters.";
    case "not_your_message":
      return "You can only delete your own messages.";
    case "not_a_member":
      return "Everyone on an expense has to be in the group.";
    case "fx_unavailable":
      return "We can't convert that currency right now. Try the group's currency.";
    case "cannot_settle_with_yourself":
      return "You can't settle up with yourself.";
    default:
      return e.status === 429 ? "Too many at once. Wait a moment and try again." : "Something went wrong. Try again.";
  }
}

/* ── Hooks ────────────────────────────────────────────────────────── */

/** Every ten seconds while the thread is on screen: there is no socket for groups. */
export const THREAD_POLL_MS = 10_000;

function useGroupRead<T>(name: string | null, fetcher: () => Promise<T>, extra = "", refreshInterval = 0) {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<T>(uid && name ? ["groups", uid, name, extra] : null, fetcher, {
    revalidateOnFocus: true,
    focusThrottleInterval: 10_000,
    shouldRetryOnError: false,
    refreshInterval,
  });
}

export const useGroups = () => useGroupRead("list", async () => (await listGroups()).groups, "", 30_000);

export const useGroupMembers = (groupId: string | null) =>
  useGroupRead(groupId ? "members" : null, async () => (await listMembers(groupId!)).members, groupId ?? "");

export const useGroupBalances = (groupId: string | null) =>
  useGroupRead(groupId ? "balances" : null, () => getBalances(groupId!), groupId ?? "", THREAD_POLL_MS);

export const useGroupInfo = (groupId: string | null) =>
  useGroupRead(groupId ? "group" : null, async () => (await getGroup(groupId!)).group, groupId ?? "");

/** A message this tab sent and the server has not answered yet, or refused. */
export interface Outgoing {
  key: string;
  body: string;
  at: string;
  state: "sending" | "failed";
}

/**
 * The thread: the newest page, polled; older pages, loaded on demand; and the
 * messages this tab is sending.
 *
 * A sent message moves from `outgoing` into `sent` (a real item with the
 * server's id) the moment the server answers, so it never blinks out between
 * the answer and the next poll; `mergeThread` drops the copy once the poll
 * brings the same id back.
 */
export function useGroupThread(groupId: string | null) {
  const latest = useGroupRead(
    groupId ? "thread" : null,
    () => getThread(groupId!),
    groupId ?? "",
    THREAD_POLL_MS,
  );
  const [older, setOlder] = useState<{ items: ThreadItem[]; nextBefore: string | null }[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sent, setSent] = useState<ThreadItem[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set());
  const busyOlder = useRef(false);

  // A different group is a different thread: nothing carries over.
  useEffect(() => {
    setOlder([]);
    setSent([]);
    setOutgoing([]);
    setDeleted(new Set());
  }, [groupId]);

  const items = useMemo(
    () => mergeThread([latest.data?.items ?? [], ...older.map((p) => p.items), sent], deleted),
    [latest.data, older, sent, deleted],
  );

  const nextBefore = older.length ? older[older.length - 1].nextBefore : (latest.data?.nextBefore ?? null);

  const loadOlder = useCallback(async () => {
    if (!groupId || !nextBefore || busyOlder.current) return;
    busyOlder.current = true;
    setLoadingOlder(true);
    try {
      const page = await getThread(groupId, nextBefore);
      setOlder((o) => [...o, page]);
    } catch {
      /* the button stays; a second tap tries again */
    } finally {
      busyOlder.current = false;
      setLoadingOlder(false);
    }
  }, [groupId, nextBefore]);

  const send = useCallback(
    async (body: string, key = newClientKey("msg"), meId: string | null = null) => {
      if (!groupId) return;
      const at = new Date().toISOString();
      setOutgoing((o) => [...o.filter((x) => x.key !== key), { key, body, at, state: "sending" }]);
      try {
        const { message } = await postMessage(groupId, body, key);
        setOutgoing((o) => o.filter((x) => x.key !== key));
        setSent((s) => [
          ...s,
          {
            kind: "message",
            id: message.id,
            at: typeof message.createdAt === "string" ? message.createdAt : at,
            userId: message.userId ?? meId ?? "",
            body: message.body ?? body,
            deleted: false,
          },
        ]);
        void latest.mutate();
      } catch {
        setOutgoing((o) => o.map((x) => (x.key === key ? { ...x, state: "failed" } : x)));
      }
    },
    // `latest.mutate` is stable for the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  const retry = useCallback(
    (key: string, meId: string | null) => {
      const o = outgoing.find((x) => x.key === key);
      if (o) void send(o.body, key, meId);
    },
    [outgoing, send],
  );

  const discard = useCallback((key: string) => setOutgoing((o) => o.filter((x) => x.key !== key)), []);

  const remove = useCallback(
    async (messageId: string) => {
      if (!groupId) return;
      await deleteMessage(groupId, messageId);
      setDeleted((d) => new Set(d).add(messageId));
      void latest.mutate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  return {
    items,
    outgoing,
    loading: latest.data === undefined && !latest.error,
    error: latest.error as unknown,
    refresh: latest.mutate,
    nextBefore,
    loadingOlder,
    loadOlder,
    send,
    retry,
    discard,
    remove,
  };
}
