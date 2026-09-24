/**
 * The rules of a payment request, with nothing that needs React or a network.
 *
 * The contract is documentation/hold-users-request-money.md (§1). Kept apart
 * from `payment-requests.ts` so `request-rules.check.ts` can run every rule
 * under sucrase-node, the way the group rules are checked.
 *
 * ── THE NAMES READ BACKWARDS, ONCE ──
 *
 * On a row, `fromUserId` is the person who ASKED and `toUserId` the person
 * asked to pay. On the create body, `from` is the person the money is asked
 * FROM. Everything below speaks in `requester` and `payer` and never in
 * from/to, so the backwards naming is paid for here and nowhere else.
 *
 * The words are the `requests` namespace (i18n/en/requests.ts), read in the
 * language on screen when a line is made. Pure apart from that: no React and
 * no `@/` imports.
 */

import { t, type MessageKey } from "./i18n";
import { fmtDate, fmtTime, fmtToken } from "./i18n/format";

/** `cancelled` and `declined` are both closed; an old row can say `cancelled` after a decline. */
export type RequestStatus = "requested" | "paid" | "cancelled" | "declined";

export interface RequestPerson {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
}

/** RequestDto (contract §1), read tolerantly: fields were only ever added. */
export interface PaymentRequest {
  id: string;
  /** Who asked (the requester). */
  fromUserId: string;
  /** Who was asked to pay (the payer). */
  toUserId: string | null;
  /** A decimal string in the token, "12.50". */
  amount: string;
  tokenId: string;
  chain: string;
  note: string | null;
  status: RequestStatus;
  createdAt: string;
  paidAt: string | null;
  transferId: string | null;
  withdrawalId: string | null;
  lastRemindedAt: string | null;
  requester: RequestPerson | null;
  payer: RequestPerson | null;
}

const STATUSES: readonly RequestStatus[] = ["requested", "paid", "cancelled", "declined"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function person(v: unknown): RequestPerson | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    username: str(o.username),
    displayName: str(o.displayName),
    avatarUrl: str(o.avatarUrl),
    avatarEmoji: str(o.avatarEmoji),
  };
}

/**
 * One row off the wire, or null when it is not one a thread can draw.
 *
 * An older server said `pending` for what is now `requested`, so that word is
 * read as open. Anything else unknown is dropped rather than guessed: a bubble
 * with a Pay button on a row we do not understand is worse than no bubble.
 */
export function toRequest(v: unknown): PaymentRequest | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id);
  const fromUserId = str(o.fromUserId);
  const createdAt = str(o.createdAt);
  if (!id || !fromUserId || !createdAt) return null;
  const raw = String(o.status ?? "").toLowerCase();
  const status: RequestStatus | null = raw === "pending" ? "requested" : (STATUSES as readonly string[]).includes(raw) ? (raw as RequestStatus) : null;
  if (!status) return null;
  const note = str(o.note);
  return {
    id,
    fromUserId,
    toUserId: str(o.toUserId),
    amount: String(o.amount ?? ""),
    tokenId: String(o.tokenId ?? "usdc").toLowerCase(),
    chain: String(o.chain ?? "solana").toLowerCase(),
    note: note ? note.trim() : null,
    status,
    createdAt,
    paidAt: str(o.paidAt),
    transferId: str(o.transferId),
    withdrawalId: str(o.withdrawalId),
    lastRemindedAt: str(o.lastRemindedAt),
    requester: person(o.requester),
    payer: person(o.payer),
  };
}

/**
 * The list, whichever way the server wraps it.
 *
 * The contract answers a bare `RequestDto[]`; the route answered
 * `{ requests, total }` before it. Both are read, so this ships ahead of the
 * backend and after it.
 */
export function toRequests(body: unknown): PaymentRequest[] {
  const list = Array.isArray(body) ? body : body && typeof body === "object" && Array.isArray((body as { requests?: unknown }).requests) ? (body as { requests: unknown[] }).requests : [];
  return list.map(toRequest).filter((r): r is PaymentRequest => r !== null);
}

export function isOpen(r: PaymentRequest): boolean {
  return r.status === "requested";
}

/**
 * Every request between you and one person, oldest first, closed ones too.
 *
 * Closed rows stay: the bubble keeps its place and its tag turns to Paid,
 * Declined or Cancelled, the way a payment's bubble never disappears once it
 * has been read.
 */
export function requestsWith(rows: readonly PaymentRequest[] | undefined, peerId: string | null): PaymentRequest[] {
  if (!peerId) return [];
  return (rows ?? [])
    .filter((r) => r.fromUserId === peerId || r.toUserId === peerId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** True when THEY asked YOU: the only direction that gets Pay and Decline. */
export function theyAsked(r: PaymentRequest, peerId: string): boolean {
  return r.fromUserId === peerId;
}

/** The figure, or null when it does not read as a positive number (no "NaN USDC" bubble). */
export function requestAmount(r: Pick<PaymentRequest, "amount">): number | null {
  const n = Number(String(r.amount ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The word on the bubble's tag. */
export function requestTag(status: RequestStatus): "Requested" | "Paid" | "Declined" | "Cancelled" {
  return status === "paid" ? "Paid" : status === "declined" ? "Declined" : status === "cancelled" ? "Cancelled" : "Requested";
}

/* ── Paying one from the web ──────────────────────────────────────── */

/**
 * Whether the web's Send can pay this request, and in what.
 *
 * The web sends USDC and SOL on Solana and nothing else (wallet/Withdraw). A
 * request made on the phone can name another chain, and the answer then is
 * the HOLD app, said as such, rather than a Send screen that could not do it.
 */
export function webCanPay(r: Pick<PaymentRequest, "tokenId" | "chain">): { token: "USDC" | "SOL" } | { app: string } {
  const chain = r.chain.toLowerCase();
  const token = r.tokenId.toLowerCase().split(".")[0];
  if (chain === "solana" || chain === "sol") {
    if (token === "usdc") return { token: "USDC" };
    if (token === "sol") return { token: "SOL" };
  }
  return { app: CHAIN_NAME[chain] ?? chain };
}

export const CHAIN_NAME: Record<string, string> = { solana: "Solana", sol: "Solana", base: "Base", polygon: "Polygon", ethereum: "Ethereum" };

/* ── Errors, in words ─────────────────────────────────────────────── */

/**
 * `retryAt` from `429 remind_too_soon`, as a time somebody can plan around.
 *
 * "You can remind them again at 14:05 tomorrow", never the ISO string, and
 * never a countdown: a reminder is a nudge between friends, not a timer.
 */
export function remindAgainText(retryAt: string | null | undefined, now: Date = new Date()): string {
  const at = retryAt ? new Date(retryAt) : null;
  if (!at || Number.isNaN(at.getTime())) return t("requests.remind.tomorrow");
  const time = fmtTime(at, { hour: "2-digit", minute: "2-digit" });
  const day = new Date(now);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(day);
  tomorrow.setDate(day.getDate() + 1);
  if (sameDay(at, day)) return t("requests.remind.at", { time });
  if (sameDay(at, tomorrow)) return t("requests.remind.tomorrowAt", { time });
  return t("requests.remind.on", { date: fmtDate(at, { day: "numeric", month: "short" }), time });
}

const WORDS: Record<string, MessageKey> = {
  request_needs_a_hold_user: "requests.error.needsHoldUser",
  request_to_self: "requests.error.toSelf",
  invalid_amount: "requests.error.invalidAmount",
  too_many_open_requests: "requests.error.tooManyOpen",
  request_rate_limited: "requests.error.rateLimited",
  request_not_open: "requests.error.notOpen",
  proof_required: "requests.error.proofRequired",
  transfer_amount_unknown: "requests.error.amountUnknown",
};

/**
 * What went wrong with a request call, in words.
 *
 * `code` is the server's `error.message` (the reason, as groups send it) or
 * its `error.code`; whichever carries one of the contract's names is used.
 */
export function describeRequestError(e: { status: number; code?: string | null; detail?: string | null; details?: Record<string, unknown> | null }): string {
  const name = [e.detail, e.code].find((c) => c && (c in WORDS || c === "remind_too_soon"));
  if (name === "remind_too_soon") return remindAgainText(typeof e.details?.retryAt === "string" ? e.details.retryAt : null);
  if (name) return t(WORDS[name]);
  if (e.status === 0) return t("requests.error.offline");
  if (e.status === 404) return t("requests.error.notFound");
  if (e.status === 401) return t("requests.error.sessionEnded");
  if (e.status === 429) return t("requests.error.tooMany");
  return t("requests.error.generic");
}

/* ── The inbox ────────────────────────────────────────────────────── */

/**
 * The people you have requests with, as rows for the Payments list.
 *
 * A request can be the FIRST thing between two people: no payment, no
 * message. Without this, the person asked would get a push and then find no
 * thread to open. So each peer becomes a conversation-shaped row, and
 * `mergeInbox` joins it to the thread they already have when there is one.
 *
 * The line is the newest request, worded from the reader's side; the time is
 * when it was made.
 */
export function requestPeers(
  rows: readonly PaymentRequest[] | undefined,
  meId: string | null,
): {
  peerId: string;
  aliasHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastBody: string;
  lastHasMedia: boolean;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
}[] {
  if (!meId) return [];
  const newest = new Map<string, PaymentRequest>();
  for (const r of rows ?? []) {
    const mine: boolean = r.fromUserId === meId;
    const peerId: string | null = mine ? r.toUserId : r.fromUserId;
    if (!peerId || peerId === meId || (!mine && r.toUserId !== meId)) continue;
    const seen = newest.get(peerId);
    if (!seen || Date.parse(r.createdAt) > Date.parse(seen.createdAt)) newest.set(peerId, r);
  }
  return [...newest.entries()].map(([peerId, r]) => {
    const mine = r.fromUserId === meId;
    const who = mine ? r.payer : r.requester;
    const amount = requestAmount(r);
    const ticker = r.tokenId.split(".")[0].toUpperCase();
    const figure = amount === null ? `${r.amount} ${ticker}` : fmtToken(amount, ticker);
    return {
      peerId,
      aliasHandle: who?.username ?? null,
      displayName: who?.displayName ?? null,
      avatarUrl: who?.avatarUrl ?? null,
      lastBody: mine ? t("requests.inbox.youRequested", { amount: figure }) : t("requests.inbox.theyAsked", { amount: figure }),
      lastHasMedia: false,
      // "You: Requested…" would say it twice; the body already has the voice.
      lastFromMe: false,
      lastAt: r.createdAt,
      unread: 0,
    };
  });
}
