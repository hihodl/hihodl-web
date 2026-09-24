"use client";

/**
 * Groups: a group is a conversation, and its money is part of it.
 *
 * The contract is documentation/groups-splitwise-grade.md (it replaces
 * groups-thread-v0.md). One thread per group: messages, expenses, settlements
 * and events in one order, newest first on the wire, plus every member's read
 * position. There is no separate chat screen and no separate ledger screen, on
 * the phone or here, and the same thread opens from Payments › Groups and, for
 * a crew, from Spaces › Crew.
 *
 * The arithmetic (minor units, split previews, seen by, faces) is in
 * groups-rules.ts, which has nothing React in it and is re-exported here.
 *
 * WHAT THE WEB WRITES, AND WHAT IT DOES NOT
 *
 * Words, expenses (add, edit, delete, receipt), members, the group's name,
 * emoji, photo and currency, "mark as paid" and "remind" are writes with no
 * wallet key behind them. A settlement that says "Paid in HOLD" is different:
 * the server checks it against a payment intent, and the web's only send is a
 * Solana withdrawal (lib/link/api.ts), a `withdrawal_requests` row and not a
 * payment intent, so the server would refuse it as `transfer_not_found`. The
 * web therefore never records a settlement WITH a transferId. It records the
 * payer's word ("I paid another way"), after a confirm, and sends the person to
 * the app for the real payment.
 *
 * THE IDEMPOTENCY KEY AND THE WORKER
 *
 * Every write that the contract keys (message, expense, settlement, mark-paid)
 * carries a client key made per user action, and the optimistic bubble is
 * matched by it. Whether it travels as the `Idempotency-Key` header is a
 * separate question, answered by the Cloudflare Worker in front of
 * api.hihodl.xyz: its preflight allowed only `Content-Type, Authorization`
 * until 2026-09-23, when `Idempotency-Key` was added (checked with an OPTIONS
 * on /api/v1/groups). A browser that sends a header the preflight did not
 * allow never sends the request at all, so if the Worker ever drops it again,
 * set `SEND_IDEMPOTENCY_HEADER` back to false or every message breaks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { getWithdrawal } from "@/lib/link/api";

import { listText, t, type MessageKey } from "@/lib/app/i18n";
import { fmtFiat, type MoneyOptions } from "@/lib/app/i18n/format";

import { HoldApiError, read } from "./hold-api";
import { asCategory, minorExponent, moneyText, toBig, type ExpenseCategory, type ItemBody, type Rates, type SourceKind, type SplitMode } from "./groups-rules";
import { normaliseAllStats, normaliseGroupStats, type AllGroupsStats, type GroupStats } from "./group-insights";

export * from "./groups-rules";
export * from "./group-insights";

/* ── What the server says ─────────────────────────────────────────── */

export type MessageItem = {
  kind: "message";
  id: string;
  at: string;
  userId: string;
  body: string | null;
  deleted: boolean;
  edited?: boolean;
  editedAt?: string | null;
};

export type ExpenseItem = {
  kind: "expense";
  id: string;
  at: string;
  /** The payer. */
  userId: string;
  description: string | null;
  place?: string | null;
  spentAt?: string | null;
  /** As paid, in `currency`. */
  amountMinor: string;
  currency: string;
  /** Converted into the group's currency, frozen when it was added. */
  groupMinor: string;
  groupCurrency?: string;
  splitMode?: SplitMode | null;
  shares: { userId: string; shareMinor: string }[];
  receiptUrl?: string | null;
  edited?: boolean;
  editedAt?: string | null;
  deleted: boolean;
  /** What was split: the payer's own transfers, stays or card spend, when it came from them. */
  sources?: ExpenseSource[];
  /** Several bills in one expense (§10.1); absent or [] for a single amount. */
  items?: ExpenseBill[];
  /** §10.2; absent on an older answer, null for none (shown as Other). */
  category?: ExpenseCategory | string | null;
};

/** One bill inside an expense (§10.1), in its own currency and converted into the expense's. */
export interface ExpenseBill {
  label: string;
  amountMinor: string;
  currency: string;
  /** In the expense's currency; the items' converted values sum exactly to its amount. */
  convertedMinor?: string | null;
  sourceKind?: SourceKind | null;
  sourceRef?: string | null;
}

/** A thing from the payer's own activity that an expense splits (POST expense `sources`). */
export interface ExpenseSource {
  kind: SourceKind;
  /** The transfer id or booking id. */
  ref: string;
  label?: string | null;
  amountMinor?: string | null;
  currency?: string | null;
  occurredAt?: string | null;
}

/** A source already split somewhere, so the picker greys it out ("Split in Lisbon trip"). */
export interface UsedSource {
  kind: SourceKind;
  ref: string;
  groupId: string;
  groupName: string;
  expenseId: string;
}

export type SettlementItem = {
  kind: "settlement";
  id: string;
  at: string;
  /** Who paid. */
  userId: string;
  toUserId: string;
  amountMinor: string;
  currency: string;
  /** Paid through HOLD and checked against that payment. */
  viaHold: boolean;
  transferId: string | null;
  recordedBy?: string | null;
  /** The creditor's word that it was paid ("mark as paid"). */
  markedByCreditor?: boolean;
};

export type EventItem = {
  kind: "event";
  id: string;
  at: string;
  /** Who did it. */
  userId: string;
  event: string;
  subjectId: string | null;
  /** expense_edited: changed, description. member_left: userId. member_removed: userId, byUserId (§10.4). crew_sale: spaceTitle, grossMinor, currency (§12). */
  data: {
    changed?: string[];
    description?: string | null;
    userId?: string | null;
    byUserId?: string | null;
    spaceId?: string | null;
    spaceTitle?: string | null;
    orderId?: string | null;
    grossMinor?: string | null;
    currency?: string | null;
  } | null;
};

export type ThreadItem = MessageItem | ExpenseItem | SettlementItem | EventItem;

export interface ReadMark {
  userId: string;
  lastReadAt: string;
}

/** A row of GET /groups: the group itself plus what happened last. */
export interface GroupRow {
  id: string;
  /** The creator. */
  userId?: string;
  name: string;
  emoji: string | null;
  /** A signed link, about an hour: never stored. */
  photoUrl?: string | null;
  /** What the book is kept in. */
  currency?: string | null;
  smartSettle?: boolean;
  /** §11.4: the daily friendly reminder; absent on an older server, which reads as on (its default). */
  autoRemind?: boolean;
  /** A crew's group (§12): the group object says `crewId`, the list row said `id`. */
  crew?: { id?: string; crewId?: string; name: string } | null;
  last?: ThreadItem | null;
  lastAt?: string | null;
  unread?: number;
}

export interface GroupMember {
  /** The membership id. */
  id?: string;
  userId: string;
  /** Stored with or without the "@": always strip before showing. */
  aliasHandle: string | null;
  displayName: string | null;
  /** A signed link, about an hour. */
  avatarUrl: string | null;
  avatarEmoji?: string | null;
  isCreator?: boolean;
  joinedAt?: string;
}

/** A person in the directory (search/users?mode=directory). */
export interface Person {
  id: string;
  aliasHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  profileVisibility?: "public" | "private";
  match?: "exact" | "prefix" | "contains";
}

export interface GroupBalances {
  currency: string;
  balances: { userId: string; netMinor: string }[];
  smartSettle: boolean;
  /** The payments that clear the book: "B owes A X" is from B to A. */
  transfers: { fromUserId: string; toUserId: string; amountMinor: string }[];
}

/** The full expense (GET one, PATCH, receipt). */
export interface Expense {
  id: string;
  groupId: string;
  payerUserId: string;
  description: string | null;
  place: string | null;
  amountMinor: string;
  currency: string;
  groupMinor: string;
  fxRate: string | null;
  fxAsOf: string | null;
  spentAt: string;
  createdAt: string;
  editedAt: string | null;
  edited: boolean;
  deletedAt: string | null;
  splitMode: SplitMode | null;
  splitInputs:
    | { participants: string[] }
    | { percents: { userId: string; percent: string }[] }
    | { amounts: { userId: string; amountMinor: string }[] }
    | { weights: { userId: string; weight: number }[] }
    | null;
  receiptUrl: string | null;
  shares: { userId: string; shareMinor: string }[];
  sources?: ExpenseSource[];
  items?: ExpenseBill[];
  category?: ExpenseCategory | string | null;
}

/** The bills of an expense as the server sent them, [] when it is a single amount or the answer is older. */
export function expenseBills(e: { items?: ExpenseBill[] | null }): ExpenseBill[] {
  return Array.isArray(e.items) ? e.items.filter((i) => i && typeof i.label === "string" && typeof i.amountMinor === "string") : [];
}

/** The category an expense shows: its own, else none (drawn as Other). */
export function expenseCategory(e: { category?: unknown }): ExpenseCategory | null {
  return asCategory(e.category);
}

export type SplitBody =
  | { mode: "equal"; participants?: string[] }
  | { mode: "percent"; percents: { userId: string; percent: string }[] }
  | { mode: "exact"; amounts: { userId: string; amountMinor: string }[] }
  | { mode: "shares"; weights: { userId: string; weight: number }[] };

/* ── Money ──────────────────────────────────────────────────────────── */

/**
 * A group's amount (minor units) in its own currency, for the language:
 * "€12.00", "12,00 €". Never converted (fmtFiat). The minor digits are the
 * backend's for the currency, so nothing is rounded away.
 */
export function groupMoney(minor: string | bigint, currency: string, o: MoneyOptions = {}): string {
  const code = (currency || "USD").toUpperCase();
  const exp = minorExponent(code);
  return fmtFiat(Number(toBig(minor)) / 10 ** exp, code, { digits: exp, ...o });
}

/* ── People ───────────────────────────────────────────────────────── */

export function bareHandle(h: string | null | undefined): string | null {
  const v = (h ?? "").trim().replace(/^@+/, "");
  return v || null;
}

/** "@bea", else the display name, else a word that does not pretend to know. */
export function memberName(m: { aliasHandle: string | null; displayName: string | null } | undefined): string {
  if (!m) return t("groupThread.names.someone");
  const h = bareHandle(m.aliasHandle);
  return h ? `@${h}` : m.displayName?.trim() || t("groupThread.names.someoneOnHold");
}

/** "Ana", the first word of the display name, else "@ana": for "Seen by Ana, Luis". */
export function shortName(m: { aliasHandle: string | null; displayName: string | null } | undefined): string {
  if (!m) return t("groupThread.names.someone");
  const first = m.displayName?.trim().split(/\s+/)[0];
  return first || memberName(m);
}

export type NameOf = (userId: string) => string;

/**
 * A lookup that says "You" for the viewer. `subject` for the start of a
 * sentence. Somebody no longer in the group (they left, or were removed) is
 * "a former member" once the member list has loaded, and "Someone" before.
 */
export function namer(members: readonly GroupMember[] | undefined, meId: string | null): { name: NameOf; subject: NameOf; short: NameOf } {
  const by = new Map((members ?? []).map((m) => [m.userId, m]));
  const gone = (id: string) => !!members && !by.has(id);
  return {
    name: (id) => (id === meId ? t("groupThread.names.you") : gone(id) ? t("groupThread.names.formerMember") : memberName(by.get(id))),
    subject: (id) => (id === meId ? t("groupThread.names.youSubject") : gone(id) ? t("groupThread.names.formerMemberSubject") : memberName(by.get(id))),
    short: (id) => (id === meId ? t("groupThread.names.youSubject") : gone(id) ? t("groupThread.names.formerMemberShort") : shortName(by.get(id))),
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
  item: { userId: string; groupMinor: string; shares: { userId: string; shareMinor: string }[] },
  meId: string | null,
): { kind: "share"; minor: string } | { kind: "lent"; minor: string } | { kind: "none" } {
  const mine = item.shares.find((s) => s.userId === meId);
  const share = mine && /^\d+$/.test(mine.shareMinor) ? BigInt(mine.shareMinor) : 0n;
  if (meId && item.userId === meId) {
    const lent = (/^\d+$/.test(item.groupMinor) ? BigInt(item.groupMinor) : 0n) - share;
    return lent > 0n ? { kind: "lent", minor: lent.toString() } : { kind: "none" };
  }
  return share > 0n ? { kind: "share", minor: share.toString() } : { kind: "none" };
}

type Names = { name: NameOf; subject: NameOf };

/**
 * "yes" when a name is the viewer's own "You": the `self` of a message whose
 * verb agrees with its subject ("You sent" / "Ana sent", "Hai inviato" /
 * "Ana ha inviato"), so no language has to say "You sends".
 */
export function selfOf(name: string): "yes" | "no" {
  return name === t("groupThread.names.youSubject") || name === t("groupThread.names.you") || name === t("common.you") ? "yes" : "no";
}

/** The list row's one line: "@bea: see you at 8", "Coffee · 12.00 USD", "@ana sent @bea 4.00 USD". */
export function lastLine(item: ThreadItem | null | undefined, names: Names): string {
  if (!item) return t("groupThread.preview.noMessages");
  switch (item.kind) {
    case "message":
      return item.deleted || item.body === null
        ? t("groupThread.preview.messageDeleted", { name: names.subject(item.userId) })
        : t("groupThread.preview.message", { name: names.subject(item.userId), body: item.body });
    case "expense":
      return t(item.deleted ? "groupThread.preview.expenseRemoved" : "groupThread.preview.expense", {
        what: item.description?.trim() || t("groupThread.expense.fallbackTitle"),
        amount: groupMoney(item.amountMinor, item.currency),
      });
    case "settlement":
      return settlementText(item, names);
    case "event":
      return eventText(item, names);
  }
}

/**
 * A settlement, said the way it happened. The three must never read alike:
 *   "@ana sent @bea 4.00 USD"                       HOLD checked the payment
 *   "@bea marked 4.00 USD from @ana as paid"        the creditor's word
 *   "@ana says they paid @bea 4.00 USD outside HOLD" the payer's word
 */
export function settlementText(item: SettlementItem, names: Names): string {
  const amount = groupMoney(item.amountMinor, item.currency);
  const who = names.subject(item.userId);
  const to = names.name(item.toUserId);
  if (item.viaHold) return t("groupThread.settlement.sent", { self: selfOf(who), from: who, to, amount });
  if (item.markedByCreditor) {
    const creditor = names.subject(item.toUserId);
    return t("groupThread.settlement.marked", { self: selfOf(creditor), creditor, amount, debtor: names.name(item.userId) });
  }
  return who === t("groupThread.names.youSubject")
    ? t("groupThread.settlement.youSaidYouPaid", { to, amount })
    : t("groupThread.settlement.saysPaid", { from: who, to, amount });
}

const CHANGED_WORDS: Record<string, MessageKey> = {
  amount: "groupThread.event.changed.amount",
  currency: "groupThread.event.changed.currency",
  split: "groupThread.event.changed.split",
  description: "groupThread.event.changed.description",
  place: "groupThread.event.changed.place",
  spentAt: "groupThread.event.changed.spentAt",
  sources: "groupThread.event.changed.sources",
  items: "groupThread.event.changed.items",
  category: "groupThread.event.changed.category",
};

/** "Ana edited Dinner", with what changed when it says; "Bea left the group"; "Ana removed Bea". */
export function eventText(item: EventItem, names: Names): string {
  const who = names.subject(item.userId);
  if (item.event === "member_left") {
    const gone = item.data?.userId || item.userId;
    const name = names.subject(gone);
    return t("groupThread.event.left", { self: selfOf(name), name });
  }
  if (item.event === "member_removed") {
    const by = item.data?.byUserId || item.userId;
    const gone = item.data?.userId || item.subjectId || "";
    return t("groupThread.event.removed", { self: selfOf(names.subject(by)), by: names.subject(by), name: gone ? names.name(gone) : t("groupThread.event.someone") });
  }
  if (item.event === "crew_sale") {
    const title = item.data?.spaceTitle?.trim() || t("groupThread.event.aSpot");
    // A crew sale is a Spaces price paid in USDC: said as paid ("25.00 USD"), never converted.
    return item.data?.grossMinor && /^\d+$/.test(item.data.grossMinor)
      ? t("groupThread.event.crewSale", { title, amount: moneyText(item.data.grossMinor, item.data.currency || "USD") })
      : t("groupThread.event.crewSaleNoAmount", { title });
  }
  if (item.event === "expense_edited") {
    const what = item.data?.description?.trim() || t("groupThread.event.anExpense");
    const changed = (item.data?.changed ?? []).map((c) => CHANGED_WORDS[c]).filter((k): k is MessageKey => !!k).map((k) => t(k));
    return changed.length ? t("groupThread.event.editedWhat", { self: selfOf(who), name: who, what, changes: listText(changed) }) : t("groupThread.event.edited", { self: selfOf(who), name: who, what });
  }
  return t("groupThread.event.updated", { self: selfOf(who), name: who });
}

/**
 * The thread, oldest first, from everything we hold about it.
 *
 * `pages` is the newest page first, then the older pages in the order they
 * were loaded, then the items this tab wrote and the server has not yet sent
 * back. The first copy of an item wins, so the newest page (re-read every ten
 * seconds) is what a change shows up in. `local` carries what this tab did to
 * messages that may sit on an older page that is never re-read: deleted for
 * everyone, edited, or hidden for me (dropped).
 */
export function mergeThread(
  pages: readonly (readonly ThreadItem[])[],
  local: { deleted?: ReadonlySet<string>; hidden?: ReadonlySet<string>; edited?: ReadonlyMap<string, { body: string; editedAt: string }> } = {},
): ThreadItem[] {
  const seen = new Map<string, ThreadItem>();
  for (const page of pages) {
    for (const item of page) {
      const key = `${item.kind}:${item.id}`;
      if (!seen.has(key)) seen.set(key, item);
    }
  }
  const out: ThreadItem[] = [];
  for (const i of seen.values()) {
    if (i.kind === "message") {
      if (local.hidden?.has(i.id)) continue;
      if (local.deleted?.has(i.id)) {
        out.push({ ...i, body: null, deleted: true });
        continue;
      }
      const e = local.edited?.get(i.id);
      if (e && !i.deleted && (!i.editedAt || Date.parse(i.editedAt) < Date.parse(e.editedAt))) {
        out.push({ ...i, body: e.body, edited: true, editedAt: e.editedAt });
        continue;
      }
    }
    out.push(i);
  }
  return out.sort((a, b) => {
    const ta = Date.parse(a.at);
    const tb = Date.parse(b.at);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
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
const enc = encodeURIComponent;

export const listGroups = () => read<{ groups: GroupRow[] }>("groups");

export const createGroup = (body: { name: string; emoji?: string | null; currency?: string; memberUserIds?: string[] }) =>
  read<{ group: GroupRow }>("groups", { json: body });

export const getGroup = (groupId: string) => read<{ group: GroupRow }>(g(groupId));

export const updateGroup = (groupId: string, body: { name?: string; emoji?: string | null; currency?: string; smartSettle?: boolean; autoRemind?: boolean }) =>
  read<{ group: GroupRow }>(g(groupId), { method: "PATCH", json: body });

export const uploadGroupPhoto = (groupId: string, image: Blob) => read<{ group: GroupRow }>(`${g(groupId)}/photo`, { raw: image });

export const deleteGroupPhoto = (groupId: string) => read<{ group: GroupRow }>(`${g(groupId)}/photo`, { method: "DELETE" });

export const deleteGroup = (groupId: string) => read<{ deleted: boolean }>(g(groupId), { method: "DELETE" });

export const listMembers = (groupId: string) => read<{ members: GroupMember[] }>(`${g(groupId)}/members`);

export const addMember = (groupId: string, userId: string) => read<{ added: boolean }>(`${g(groupId)}/members`, { json: { userId } });

export const addMemberByHandle = (groupId: string, handle: string) =>
  read<{ userId: string; added: boolean }>(`${g(groupId)}/members/by-handle`, { json: { handle: handle.trim().replace(/^@+/, "") } });

/**
 * Take somebody out, or leave (your own id). Only the group admin (the person
 * who made it) removes others (`403 only_creator_removes`); the admin can't
 * leave (`409 creator_cannot_leave`); and nobody goes while their balance is
 * not zero (`409 member_has_balance`, with `balanceMinor` and `currency`).
 */
export const removeMember = (groupId: string, userId: string) =>
  read<{ removed: boolean }>(`${g(groupId)}/members/${enc(userId)}`, { method: "DELETE" });

/** Every source of yours already split, in any group, since a day (ISO). */
export const getUsedSources = (since?: string | null) =>
  read<{ used: UsedSource[] }>(`groups/sources/used${since ? `?since=${enc(since)}` : ""}`);

export const getThread = (groupId: string, before?: string | null, limit = 50) =>
  read<{ items: ThreadItem[]; nextBefore: string | null; reads?: ReadMark[] }>(
    `${g(groupId)}/thread?limit=${limit}${before ? `&before=${enc(before)}` : ""}`,
  );

export const getBalances = (groupId: string) => read<GroupBalances>(`${g(groupId)}/balances`);

type MessageAnswer = { id: string; createdAt: string; body: string | null; userId: string; deleted?: boolean; edited?: boolean; editedAt?: string | null };

export const postMessage = (groupId: string, body: string, key: string) =>
  read<{ message: MessageAnswer }>(`${g(groupId)}/messages`, { json: { body }, headers: withKey(key) });

export const editMessage = (groupId: string, messageId: string, body: string) =>
  read<{ message: MessageAnswer }>(`${g(groupId)}/messages/${enc(messageId)}`, { method: "PATCH", json: { body } });

/** Delete for everyone: only your own. */
export const deleteMessage = (groupId: string, messageId: string) =>
  read<{ deleted: boolean }>(`${g(groupId)}/messages/${enc(messageId)}`, { method: "DELETE" });

/** Delete for me: any message, no undo. */
export const hideMessage = (groupId: string, messageId: string) =>
  read<{ hidden: boolean }>(`${g(groupId)}/messages/${enc(messageId)}/hide`, { json: {} });

export const markRead = (groupId: string) => read<{ read: boolean }>(`${g(groupId)}/read`, { json: {} });

export interface ExpenseBody {
  /** With `items` the server derives it; it is still sent, as the preview total, for an older server that ignores items. */
  amountMinor: string;
  currency: string;
  /** Several bills (§10.1), 1 to 50. [] on an edit turns it back into a single amount. */
  items?: ItemBody[];
  /** §10.2. */
  category?: ExpenseCategory | null;
  description?: string | null;
  place?: string | null;
  /** YYYY-MM-DD. */
  spentAt?: string;
  payerUserId?: string;
  split: SplitBody;
  /** At most 20. A source split before answers `409 source_already_split`. */
  sources?: ExpenseSource[];
}

export const addExpense = (groupId: string, body: ExpenseBody, key: string) =>
  read<{ expense: { id: string; duplicate?: boolean; shares?: { userId: string; shareMinor: string }[] } }>(`${g(groupId)}/expenses`, {
    json: body,
    headers: withKey(key),
  });

export const getExpense = (groupId: string, expenseId: string) => read<{ expense: Expense }>(`${g(groupId)}/expenses/${enc(expenseId)}`);

export const updateExpense = (groupId: string, expenseId: string, body: Partial<Omit<ExpenseBody, "payerUserId">>) =>
  read<{ expense: Expense; changed: string[] }>(`${g(groupId)}/expenses/${enc(expenseId)}`, { method: "PATCH", json: body });

export const deleteExpense = (groupId: string, expenseId: string) =>
  read<{ deleted: boolean }>(`${g(groupId)}/expenses/${enc(expenseId)}`, { method: "DELETE" });

export const uploadReceipt = (groupId: string, expenseId: string, image: Blob) =>
  read<{ expense: Expense }>(`${g(groupId)}/expenses/${enc(expenseId)}/receipt`, { raw: image });

export const deleteReceipt = (groupId: string, expenseId: string) =>
  read<{ expense: Expense }>(`${g(groupId)}/expenses/${enc(expenseId)}/receipt`, { method: "DELETE" });

/**
 * The payer's word that they paid, with no payment behind it. There is
 * deliberately no `transferId` parameter: see the header.
 */
export const recordPaidElsewhere = (groupId: string, body: { toUserId: string; amountMinor: string }, key: string) =>
  read<{ settlement: { id: string } }>(`${g(groupId)}/settlements`, { json: body, headers: withKey(key) });

/**
 * After a send from the web confirmed (the Pay on a debt, §11.2): record it
 * against the group with the withdrawal's id as proof (§13), so the thread
 * says "Paid in HOLD" (`viaHold: true`), as for an app payment.
 *
 *   409 transfer_not_confirmed   asked again every 3 s for about a minute,
 *                                as the app does
 *   transfer_already_used        already recorded: nothing to do
 *   400 (an older server that doesn't know `withdrawalId`), not_found,
 *   not_to_them, or still unconfirmed after a minute
 *                                recorded as the payer's word ("says they
 *                                paid"), which is true: the money did go
 *
 * Before every attempt it reads GET /withdrawals/:id: that read is what
 * checks the chain and moves the withdrawal from `submitted` to confirmed on
 * the server, and nothing else in Send is sure to make it. Without it the proof would stay "not
 * confirmed" for the whole minute. A failed read is ignored; the settlement
 * answers for itself.
 *
 * The amount (§13.1):
 *   422 transfer_amount_short    the payment proves less than the debt (a
 *                                converted USDC amount a little under, say):
 *                                recorded once more for `details.provenMinor`,
 *                                with the same proof, and the rest stays owed
 *   422 transfer_amount_unknown  the token paid can't be valued: the payer's
 *                                word, for the whole amount
 *
 * One key per withdrawal and amount, so a reload never records it twice.
 */
export async function recordSentPayment(groupId: string, body: { toUserId: string; amountMinor: string }, withdrawalId: string): Promise<"checked" | "word" | "already"> {
  const url = `${g(groupId)}/settlements`;
  const deadline = Date.now() + 60_000;
  let amountMinor = body.amountMinor;
  let shortened = false;
  for (;;) {
    await getWithdrawal(withdrawalId).catch(() => undefined);
    try {
      await read<{ settlement: { id: string } }>(url, {
        json: { toUserId: body.toUserId, amountMinor, withdrawalId },
        headers: withKey(`web-settle-${withdrawalId}${shortened ? `-${amountMinor}` : ""}`.slice(0, 128)),
      });
      return "checked";
    } catch (e) {
      if (!(e instanceof HoldApiError)) throw e;
      if (e.detail === "transfer_already_used") return "already";
      if (e.detail === "transfer_amount_short" && !shortened) {
        const proven = e.details?.provenMinor;
        if (typeof proven === "string" && /^\d+$/.test(proven) && BigInt(proven) > 0n && BigInt(proven) < BigInt(amountMinor)) {
          amountMinor = proven;
          shortened = true;
          continue;
        }
        break;
      }
      if (e.detail === "transfer_amount_unknown") break;
      if (e.detail === "transfer_not_confirmed" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (e.status === 400 || e.detail === "transfer_not_found" || e.detail === "transfer_not_to_them" || e.detail === "transfer_not_confirmed") break;
      throw e;
    }
  }
  await recordPaidElsewhere(groupId, body, `web-settle-word-${withdrawalId}`.slice(0, 128));
  return "word";
}

/** The creditor says a debt to them was paid another way. Capped by what the plan says is owed. */
export const markPaid = (groupId: string, body: { fromUserId: string; amountMinor: string }, key: string) =>
  read<{ settlement: { id: string }; duplicate: boolean }>(`${g(groupId)}/settlements/mark-paid`, { json: body, headers: withKey(key) });

export interface RemindAnswer {
  reminded: boolean;
  delivered: boolean;
  owedMinor: string;
  currency: string;
  sentAt: string;
  nextAllowedAt: string;
}

/** One push to the debtor, at most once a day per pair. Never written to the thread. */
export const remind = (groupId: string, toUserId: string) => read<RemindAnswer>(`${g(groupId)}/remind`, { json: { toUserId } });

/** Today's rates into `base` (§10.3): `rates[X]` turns one X into base. Unknown symbols are left out. */
export const getFx = (base: string, symbols: readonly string[]) =>
  read<{ base: string; asOf: string | null; rates: Record<string, string> }>(`groups/fx?base=${enc(base)}&symbols=${enc(symbols.slice(0, 20).join(","))}`);

/** A group's numbers (§10.5), read tolerantly. `from` and `to` are YYYY-MM; absent, the server's last 12 months. */
export const getGroupStats = async (groupId: string, range?: { from: string; to: string } | null, groupCurrency?: string): Promise<GroupStats> =>
  normaliseGroupStats(await read<unknown>(`${g(groupId)}/stats${range ? `?from=${enc(range.from)}&to=${enc(range.to)}` : ""}`), groupCurrency);

/** You across every group, per currency (§10.5). */
export const getAllGroupsStats = async (): Promise<AllGroupsStats> => normaliseAllStats(await read<unknown>("groups/stats"));

/** The directory: everyone whose handle or name matches, ranked, never resolved. */
export const searchDirectory = (q: string, signal?: AbortSignal) =>
  read<{ users: Person[] }>(`search/users?mode=directory&limit=20&q=${enc(q)}`, { signal });

/**
 * One exact @username, or null. The default (`resolve`) mode answers exactly
 * that person when the handle is theirs, and ranked rows otherwise; only a
 * row whose handle IS the text counts, so a near miss is never picked.
 */
export async function resolveExactHandle(handle: string): Promise<Person | null> {
  const bare = handle.trim().replace(/^@+/, "").toLowerCase();
  const r = await read<{ users: Person[] }>(`search/users?q=${enc(bare)}`);
  return (r?.users ?? []).find((p) => (p.aliasHandle ?? "").replace(/^@+/, "").toLowerCase() === bare) ?? null;
}

/* ── Errors, in words ─────────────────────────────────────────────── */

const WORDS: Record<string, MessageKey> = {
  user_not_found: "groupThread.errors.userNotFound",
  group_not_found: "groupThread.errors.groupNotFound",
  name_required: "groupThread.errors.nameRequired",
  invalid_currency: "groupThread.errors.invalidCurrency",
  too_many_members: "groupThread.errors.tooManyMembers",
  currency_locked: "groupThread.errors.currencyLocked",
  not_the_creator: "groupThread.errors.notTheCreator",
  cannot_remove_creator: "groupThread.errors.cannotRemoveCreator",
  only_creator_removes: "groupThread.errors.onlyCreatorRemoves",
  creator_cannot_leave: "groupThread.errors.creatorCannotLeave",
  member_has_balance: "groupThread.errors.memberHasBalance",
  source_already_split: "groupThread.errors.sourceAlreadySplit",
  invalid_weight: "groupThread.errors.invalidWeight",
  message_empty: "groupThread.errors.messageEmpty",
  message_too_long: "groupThread.errors.messageTooLong",
  message_not_found: "groupThread.errors.messageNotFound",
  message_deleted: "groupThread.errors.messageDeleted",
  message_is_a_caption: "groupThread.errors.messageIsACaption",
  not_your_message: "groupThread.errors.notYourMessage",
  description_too_long: "groupThread.errors.descriptionTooLong",
  not_a_member: "groupThread.errors.notAMember",
  fx_unavailable: "groupThread.errors.fxUnavailable",
  cannot_settle_with_yourself: "groupThread.errors.cannotSettleWithYourself",
  percents_do_not_sum: "groupThread.errors.percentsDoNotSum",
  invalid_percent: "groupThread.errors.invalidPercent",
  amounts_do_not_sum: "groupThread.errors.amountsDoNotSum",
  duplicate_participant: "groupThread.errors.duplicateParticipant",
  no_participants: "groupThread.errors.noParticipants",
  split_is_empty: "groupThread.errors.splitIsEmpty",
  negative_share: "groupThread.errors.negativeShare",
  shares_do_not_sum: "groupThread.errors.sharesDoNotSum",
  amount_must_be_positive: "groupThread.errors.amountMustBePositive",
  amount_too_small_after_conversion: "groupThread.errors.amountTooSmallAfterConversion",
  not_the_payer: "groupThread.errors.notThePayer",
  expense_not_found: "groupThread.errors.expenseNotFound",
  expense_deleted: "groupThread.errors.expenseDeleted",
  expense_locked_by_settlement: "groupThread.errors.expenseLockedBySettlement",
  split_required: "groupThread.errors.splitRequired",
  nothing_owed: "groupThread.errors.nothingOwed",
  amount_exceeds_debt: "groupThread.errors.amountExceedsDebt",
  cannot_remind_yourself: "groupThread.errors.cannotRemindYourself",
  reminder_too_soon: "groupThread.errors.reminderTooSoon",
  image_too_large: "groupThread.errors.imageTooLarge",
  image_type_not_supported: "groupThread.errors.imageTypeNotSupported",
  image_required: "groupThread.errors.imageRequired",
  storage_unavailable: "groupThread.errors.storageUnavailable",
  storage_not_configured: "groupThread.errors.storageNotConfigured",
  transfer_not_found: "groupThread.errors.transferNotFound",
  too_many_items: "groupThread.errors.tooManyItems",
  invalid_item: "groupThread.errors.invalidItem",
  item_source_unknown: "groupThread.errors.itemSourceUnknown",
  too_many_sources: "groupThread.errors.tooManySources",
  invalid_category: "groupThread.errors.invalidCategory",
  invalid_range: "groupThread.errors.invalidRange",
};

/** What went wrong with a group call, in words. */
export function describeGroupError(e: unknown): string {
  if (!(e instanceof HoldApiError)) return e instanceof Error && e.message.startsWith("image:") ? e.message.slice(6) : t("common.somethingWentWrong");
  if (e.status === 0) return t("groupThread.errors.unreachable");
  if (e.detail && WORDS[e.detail]) return t(WORDS[e.detail]);
  if (e.status === 429) return t("groupThread.errors.tooMany");
  if (e.status === 401) return t("groupThread.errors.sessionEnded");
  return t("common.somethingWentWrong");
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

/** Already-split sources, for greying them out in the bill picker. A failure reads as "none known", never as a block. */
export const useUsedSources = (on: boolean) =>
  useGroupRead(on ? "sources-used" : null, async () => (await getUsedSources(new Date(Date.now() - 400 * 86_400_000).toISOString())).used ?? []);

/**
 * Rates into `base` for the currencies given, for the "≈" preview of several
 * bills. Nothing is read for none. A failure (an older server has no
 * /groups/fx, or the rate source is down) is an error, never a made-up rate.
 */
export function useFxRates(base: string, symbols: readonly string[]) {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => s !== base.toUpperCase()))].sort();
  const r = useGroupRead(list.length ? "fx" : null, async () => (await getFx(base.toUpperCase(), list)).rates ?? {}, `${base.toUpperCase()}:${list.join(",")}`);
  return { rates: (r.data ?? null) as Rates | null, loading: list.length > 0 && r.data === undefined && !r.error, error: r.error as unknown, needed: list };
}

export const useGroupStats = (groupId: string | null, range: { from: string; to: string } | null, groupCurrency?: string) =>
  useGroupRead(groupId ? "stats" : null, () => getGroupStats(groupId!, range, groupCurrency), `${groupId ?? ""}:${range ? `${range.from}..${range.to}` : "default"}`);

export const useAllGroupsStats = (on = true) => useGroupRead(on ? "stats-all" : null, getAllGroupsStats, "", 60_000);

export const useExpense = (groupId: string, expenseId: string | null) =>
  useGroupRead(expenseId ? "expense" : null, async () => (await getExpense(groupId, expenseId!)).expense, `${groupId}:${expenseId ?? ""}`);

/**
 * The directory picker's search: 3+ characters (the contract answers "contains"
 * from 3), debounced, the older answer never overwriting a newer one.
 */
export function useDirectorySearch(query: string, minChars = 3) {
  const q = query.trim().replace(/^@+/, "");
  const [state, setState] = useState<{ q: string; users: Person[] | null; error: unknown; loading: boolean }>({ q: "", users: null, error: null, loading: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (q.length < minChars) {
      setState({ q, users: null, error: null, loading: false });
      return;
    }
    const ctl = new AbortController();
    setState((s) => ({ ...s, q, loading: true, error: null }));
    const t = window.setTimeout(() => {
      searchDirectory(q, ctl.signal).then(
        (r) => setState({ q, users: Array.isArray(r?.users) ? r.users : [], error: null, loading: false }),
        (e) => {
          if (ctl.signal.aborted) return;
          setState({ q, users: null, error: e, loading: false });
        },
      );
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q, minChars, attempt]);

  return { ...state, active: q.length >= minChars, retry: () => setAttempt((a) => a + 1) };
}

/** A message this tab sent and the server has not answered yet, or refused. */
export interface Outgoing {
  key: string;
  body: string;
  at: string;
  state: "sending" | "failed";
}

/**
 * The thread: the newest page, polled; older pages, loaded on demand; the
 * messages this tab is sending; and the read positions for "Seen by".
 *
 * A sent message moves from `outgoing` into `sent` (a real item with the
 * server's id) the moment the server answers, so it never blinks out between
 * the answer and the next poll; `mergeThread` drops the copy once the poll
 * brings the same id back.
 */
export function useGroupThread(groupId: string | null) {
  const latest = useGroupRead(groupId ? "thread" : null, () => getThread(groupId!), groupId ?? "", THREAD_POLL_MS);
  const [older, setOlder] = useState<{ items: ThreadItem[]; nextBefore: string | null }[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sent, setSent] = useState<ThreadItem[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [edited, setEdited] = useState<Map<string, { body: string; editedAt: string }>>(() => new Map());
  const busyOlder = useRef(false);

  // A different group is a different thread: nothing carries over.
  useEffect(() => {
    setOlder([]);
    setSent([]);
    setOutgoing([]);
    setDeleted(new Set());
    setHidden(new Set());
    setEdited(new Map());
  }, [groupId]);

  const items = useMemo(
    () => mergeThread([latest.data?.items ?? [], ...older.map((p) => p.items), sent], { deleted, hidden, edited }),
    [latest.data, older, sent, deleted, hidden, edited],
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
            edited: false,
            editedAt: null,
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

  /** Delete for everyone (own messages). */
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

  /** Delete for me (any message). */
  const hide = useCallback(
    async (messageId: string) => {
      if (!groupId) return;
      await hideMessage(groupId, messageId);
      setHidden((d) => new Set(d).add(messageId));
      void latest.mutate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  const edit = useCallback(
    async (messageId: string, body: string) => {
      if (!groupId) return;
      const { message } = await editMessage(groupId, messageId, body);
      setEdited((m) => new Map(m).set(messageId, { body: message.body ?? body, editedAt: message.editedAt ?? new Date().toISOString() }));
      void latest.mutate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId],
  );

  return {
    items,
    reads: latest.data?.reads ?? [],
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
    hide,
    edit,
  };
}
