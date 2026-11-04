/**
 * The rules Payments is made of, which live on the client and not on the
 * server — so the web says what the app says about the same rows.
 *
 * Ported from the app, function for function:
 *   peerRows / keepAsPeerRow        src/hooks/usePaymentHistory.ts
 *   groupTransfersIntoThreads       same file — one row per counterparty
 *   lastActivityLine                src/payments/threadPreview.ts
 *   payout* / PAYOUT_STATE_*        src/send/payoutHistory.ts
 *   formatScheduleAmount            src/features/scheduledPayments/schedule.ts
 *
 * The list has two halves and `mergeInbox` at the foot of this file puts them
 * together: the money from `/transfers`, and the words from
 * `/payment-notes/conversations`. Built from the money alone — as this screen
 * was at first — a person you have only ever messaged has no row at all, and no
 * message ever moves the order.
 *
 * Symbols follow the display mode like every other money screen — `12.00 USD`
 * in fintech, `12.00 USDC` in hybrid and native. The mode arrives as a
 * parameter; nothing here decides it.
 *
 * No MONEY moves from here. Paying, requesting, cancelling a schedule and
 * funding a payout all stay in the app, because each of them needs a key that
 * never leaves the phone. Writing a message does not, which is why the chat is
 * whole on the web and the money is not.
 */

import { maskTokenSymbol, type DisplayMode } from "./display-mode";
import { t as tr } from "@/lib/app/i18n";
import { fmtDate, fmtNumber, fmtTime } from "@/lib/app/i18n/format";
import type { OfframpOrder, PayoutState, Schedule, Transfer } from "./hold-api";
import type { IonName } from "@/components/app/ion";

/* ── One counterparty's conversation ──────────────────────────────── */

export type CounterpartyKind = "hihodl" | "evm" | "sol" | "iban" | "card" | "merchant";

export interface PaymentThread {
  /** The thread key: the handle, the address, or `merchant:<name>`. */
  id: string;
  name: string;
  alias: string;
  kind: CounterpartyKind;
  address: string | null;
  chain: string | null;
  /** The second line: what last happened, already worded. */
  lastLine: string;
  lastTs: number;
  transfers: Transfer[];
}

/** A row with a field the web's Transfer type does not name but the server may still send. */
type Loose = Transfer & { moveKind?: string | null; account?: string | null };

/** The counterparty's address on this row, lower-cased for comparison. */
function counterpartyAddress(t: Transfer): string {
  const addr = t.direction === "in" ? t.fromAddress : t.toAddress;
  return String(addr ?? "").trim().toLowerCase();
}

/**
 * Hashes that belong to a swap, an exchange or an internal move. Any other row
 * carrying one is the same on-chain event seen from its other side — most
 * often a swap's output landing back in the person's own wallet, which reads
 * as a deposit from a stranger.
 */
function nonPeerTxHashesIn(transfers: readonly Transfer[]): Set<string> {
  const out = new Set<string>();
  for (const t of transfers) {
    if ((t.direction === "exchange" || t.direction === "move") && t.txHash) out.add(t.txHash);
  }
  return out;
}

/**
 * An address the server has already told us is a merchant's is a merchant's
 * address for every row in the window, labelled or not. Travel and eSIM settle
 * to a collection address of ours, and a screen made of people must not print
 * it as a friend.
 */
function merchantAddressesIn(transfers: readonly Transfer[]): Set<string> {
  const out = new Set<string>();
  for (const t of transfers) {
    if (!t.merchantName?.trim()) continue;
    const addr = counterpartyAddress(t);
    if (addr) out.add(addr);
  }
  return out;
}

/** Raw EVM base units read as a human amount, as the app's `parseTransferAmt` does. */
export function transferAmount(t: Transfer): number {
  const raw = String(t.amount ?? "0");
  let amt = parseFloat(raw) || 0;
  const chain = (t.chain || "").toLowerCase();
  if (["ethereum", "polygon", "base"].includes(chain) && !raw.includes(".")) {
    const token = (t.tokenId || t.symbol || "").toLowerCase();
    const stable = token.includes("usdc") || token.includes("usdt") || token.includes("dai");
    const threshold = stable ? 1_000_000 : 1e10;
    if (amt >= threshold) amt = amt / 10 ** (stable ? 6 : 18);
  }
  return amt;
}

export function tokenTicker(t: Transfer): string {
  const id = (t.tokenId || "").trim();
  if (id && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id) && !id.startsWith("0x")) return id.toUpperCase();
  return (t.symbol || "USDC").toUpperCase();
}

/** Whether this row is a payment to somebody, from the whole window's point of view. */
function keepAsPeerRow(t: Transfer, nonPeerHashes: Set<string>, merchants: Set<string>): boolean {
  if (t.direction === "move" || t.direction === "exchange") return false;
  if (t.txHash && nonPeerHashes.has(t.txHash)) return false;
  // A leg of a Smart Send that pays somebody else IS the payment; every other
  // leg is plumbing the intent bubble already accounts for.
  if (t.parentIntentId && t.direction !== "out") return false;
  // A bridge is a route, not a counterparty.
  if ((t as Loose).moveKind === "bridge") return false;
  // A merchant is not somebody you can pay again — the record lives in Activity.
  if (t.merchantName?.trim()) return false;
  if (merchants.size) {
    const addr = counterpartyAddress(t);
    if (addr && merchants.has(addr)) return false;
  }
  return Math.abs(transferAmount(t)) >= 0.001;
}

/**
 * The rows Payments is made of, from a raw `/transfers` window.
 *
 * Both sets are built from the WHOLE window and then applied to each row —
 * that is what makes them work, which is why this is one function and not a
 * filter written at each call site.
 */
export function peerRows(transfers: readonly Transfer[]): Transfer[] {
  const hashes = nonPeerTxHashesIn(transfers);
  const merchants = merchantAddressesIn(transfers);
  return transfers.filter((t) => keepAsPeerRow(t, hashes, merchants));
}

function counterpartyKey(t: Transfer): string {
  const merchant = t.merchantName?.trim();
  if (merchant) return `merchant:${merchant.toLowerCase()}`;
  if (t.direction === "in") return t.fromAlias || t.fromAddress || t.id;
  return t.toAlias || t.toAddress || t.id;
}

function counterpartyName(t: Transfer): string {
  const merchant = t.merchantName?.trim();
  if (merchant) return merchant;
  if (t.direction === "in" && t.fromAlias?.startsWith("@")) return t.fromAlias;
  if (t.direction !== "in" && t.toAlias?.startsWith("@")) return t.toAlias;
  const addr = t.direction === "in" ? t.fromAddress : t.toAddress;
  if (addr) {
    if (addr.startsWith("0x")) return tr("payments.counterparty.wallet");
    if (addr.length >= 32 && addr.length <= 44) return tr("payments.counterparty.wallet");
    if (/^[A-Z]{2}\d{2}/.test(addr)) return "IBAN";
    if (/^\d{13,19}$/.test(addr)) return tr("payments.counterparty.card");
  }
  return tr("payments.counterparty.unknown");
}

/** `0x378B87…A9B6`, never a bare 42-character address. */
function shortenCounterparty(addr: string | null | undefined): string {
  const a = (addr ?? "").trim();
  if (!a) return tr("payments.counterparty.unknown");
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function counterpartyAlias(t: Transfer): string {
  const merchant = t.merchantName?.trim();
  if (merchant) return merchant;
  const inbound = t.direction === "in";
  const alias = inbound ? t.fromAlias : t.toAlias;
  if (alias) return alias;
  return shortenCounterparty(inbound ? t.fromAddress : t.toAddress);
}

export function counterpartyKind(t: Transfer): CounterpartyKind {
  if (t.merchantName?.trim()) return "merchant";
  const addr = t.direction === "in" ? t.fromAddress : t.toAddress;
  if (t.toAlias?.startsWith("@")) return "hihodl";
  if (t.fromAlias?.startsWith("@")) return "hihodl";
  if (addr?.startsWith("0x")) return "evm";
  if (addr && addr.length >= 32 && addr.length <= 44) return "sol";
  if (addr && /^[A-Z]{2}\d{2}/.test(addr)) return "iban";
  if (addr && /^\d{13,19}$/.test(addr)) return "card";
  return "evm";
}

/** `–12.00 USDC` / `+12.00 USDC`, the app's `formatTransferMessage`. */
function transferMessage(t: Transfer): string {
  const sign = t.direction === "out" ? "–" : "+";
  const amt = transferAmount(t);
  const amount = Number.isFinite(amt) ? Math.abs(amt).toFixed(2) : "0";
  return `${sign}${amount} ${tokenTicker(t)}`;
}

/**
 * The second line of a thread row: "You sent 12.00 USDC".
 *
 * The app's `formatLastActivity`. The ticker is masked here rather than where
 * the line was built, so the same stored line reads as dollars or as its coin
 * depending only on the mode the reader is in.
 */
export function lastActivityLine(raw: string, mode: DisplayMode): string {
  const msg = raw.trim();
  // The stored line is `–12.00 USDC` (a machine shape, see transferMessage):
  // the figure is re-drawn with the language's separators, the ticker kept.
  const figure = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && /^\d+(\.\d+)?$/.test(raw) ? fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : raw;
  };
  const minus = /^[–-]\s*([\d.,]+)\s*([A-Z]+)\b/.exec(msg);
  if (minus) return tr("payments.line.youSent", { amount: figure(minus[1]), symbol: maskTokenSymbol(minus[2], mode) });
  const plus = /^\+\s*([\d.,]+)\s*([A-Z]+)\b/.exec(msg);
  if (plus) return tr("payments.line.youReceived", { amount: figure(plus[1]), symbol: maskTokenSymbol(plus[2], mode) });
  return msg;
}

/** One row per counterparty, newest first. */
export function groupTransfersIntoThreads(transfers: readonly Transfer[]): PaymentThread[] {
  const byKey = new Map<string, PaymentThread>();

  for (const transfer of transfers) {
    const key = counterpartyKey(transfer);
    const ts = new Date(transfer.createdAt).getTime();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: key,
        name: counterpartyName(transfer),
        alias: counterpartyAlias(transfer),
        kind: counterpartyKind(transfer),
        address: (transfer.direction === "in" ? transfer.fromAddress : transfer.toAddress) ?? null,
        chain: transfer.chain ?? null,
        lastLine: transferMessage(transfer),
        lastTs: Number.isFinite(ts) ? ts : 0,
        transfers: [transfer],
      });
      continue;
    }
    existing.transfers.push(transfer);
    if (Number.isFinite(ts) && ts > existing.lastTs) {
      existing.lastLine = transferMessage(transfer);
      existing.lastTs = ts;
      // The chain and the address are one fact about one counterparty, and the
      // app sets them together: the newest chain beside the oldest address is
      // half an identity from each end of the history.
      existing.chain = transfer.chain ?? existing.chain;
      const latest = transfer.direction === "in" ? transfer.fromAddress : transfer.toAddress;
      if (latest) existing.address = latest;
    }
  }

  return [...byKey.values()].sort((a, b) => b.lastTs - a.lastTs);
}

/** How a thread names its counterparty on the row. */
export function threadDisplayName(thread: PaymentThread): string {
  if (thread.kind === "hihodl" || thread.alias.startsWith("@")) return thread.alias || thread.name;
  if (thread.kind === "merchant") return thread.name;
  if (thread.kind === "evm" || thread.kind === "sol") {
    const addr = thread.address || thread.alias || "";
    return tr("payments.counterparty.walletShort", { address: addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr });
  }
  if (thread.kind === "iban") {
    const iban = thread.address || thread.alias || "";
    return tr("payments.counterparty.ibanShort", { iban: iban.length > 8 ? `${iban.slice(0, 2)}...${iban.slice(-4)}` : iban });
  }
  if (thread.kind === "card") {
    const card = thread.address || thread.alias || "";
    return tr("payments.counterparty.cardShort", { card: card.length >= 4 ? `•••• ${card.slice(-4)}` : card });
  }
  return thread.name || thread.alias || tr("payments.counterparty.unknown");
}

/** Today a time, yesterday the word, this week the weekday, then the date. */
export function threadTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startToday - startDay) / 86_400_000);
  if (days === 0) return fmtTime(d, { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return tr("common.yesterday");
  if (days > 1 && days < 7) return fmtDate(d, { weekday: "short" });
  if (d.getFullYear() === now.getFullYear()) return fmtDate(d, { day: "2-digit", month: "short" });
  return fmtDate(d, { day: "2-digit", month: "short", year: "numeric" });
}

/** "Yesterday, 21:17" — the app's `when` on the details sheet. */
export function whenLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = fmtTime(d, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startToday - startDay) / 86_400_000);
  if (days === 0) return tr("payments.when.today", { time });
  if (days === 1) return tr("payments.when.yesterday", { time });
  return tr("payments.when.date", { date: fmtDate(d, { day: "numeric", month: "short", year: "numeric" }), time });
}

/** The app's verb for a row: what happened, not what it is. */
export function actionTitle(direction: Transfer["direction"]): string {
  switch (direction) {
    case "in":
      return tr("payments.action.received");
    case "out":
      return tr("payments.action.sent");
    case "move":
      return tr("payments.action.moved");
    case "exchange":
      return tr("payments.action.swapped");
    default:
      return tr("payments.action.transaction");
  }
}

/** Which of the sheet's words a status is: what a colour is chosen by, never the word itself. */
export function statusKind(status: string | null | undefined): "succeeded" | "failed" | "canceled" | "other" {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed" || s === "completed" || s === "success" || s === "succeeded") return "succeeded";
  if (s === "failed" || s === "error") return "failed";
  if (s === "cancelled" || s === "canceled") return "canceled";
  return "other";
}

/** Succeeded / Pending / Failed, as the sheet words it. */
export function statusWord(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  const kind = statusKind(s);
  if (kind === "succeeded") return tr("payments.status.succeeded");
  if (kind === "failed") return tr("payments.status.failed");
  if (kind === "canceled") return tr("payments.status.canceled");
  if (!s) return "—";
  if (s === "pending") return tr("common.pending");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CHAIN_LABEL: Record<string, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  polygon: "Polygon",
  bitcoin: "Bitcoin",
};

export function chainLabel(chain: string | null | undefined): string {
  const c = (chain ?? "").toLowerCase();
  return CHAIN_LABEL[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : "—");
}

/** `0x378B87…30A9B6`, the sheet's middle truncation. */
export function truncMid(s: string | null | undefined, keep = 6): string {
  if (!s) return "";
  return s.length <= keep * 2 + 3 ? s : `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

/** The app's explorers (src/lib/explorerUrls.ts), mainnet. */
const EXPLORER: Record<string, { name: string; base: string }> = {
  solana: { name: "Solscan", base: "https://solscan.io" },
  ethereum: { name: "Etherscan", base: "https://etherscan.io" },
  base: { name: "Basescan", base: "https://basescan.org" },
  polygon: { name: "Polygonscan", base: "https://polygonscan.com" },
};

export function explorerFor(chain: string | null | undefined, hash: string | null | undefined): { name: string; url: string } | null {
  const e = EXPLORER[(chain ?? "").toLowerCase()];
  if (!e || !hash) return null;
  return { name: e.name, url: `${e.base}/tx/${encodeURIComponent(hash)}` };
}

/* ── Payouts (GET /offramp/orders) ────────────────────────────────── */

/**
 * The colour a state wears. Never red — a failed payout is money the person
 * still has, and this product has no red. Amber carries attention; the palette
 * separates the states by WORD, not by hue.
 */
export const PAYOUT_STATE_TINT: Record<PayoutState, string> = {
  pending: "rgba(255,255,255,0.55)",
  sent: "#7CC6E8",
  settled: "#3ECF8E",
  failed: "#FFB703",
};

export const PAYOUT_STATE_ICON: Record<PayoutState, IonName> = {
  pending: "time-outline",
  sent: "paper-plane-outline",
  settled: "checkmark-circle-outline",
  failed: "alert-circle-outline",
};

/** Anything the server could not place is `pending`, and reads as such. */
export function payoutState(order: OfframpOrder): PayoutState {
  return order.state === "sent" || order.state === "settled" || order.state === "failed" ? order.state : "pending";
}

/**
 * What the row says about where the money is. `needsFunding` wins, because it
 * is the only one of these that is a job rather than news.
 */
export function payoutStatusText(order: OfframpOrder): string {
  if (order.needsFunding) return tr("payments.payouts.status.notPaid");
  switch (payoutState(order)) {
    case "settled":
      return tr("payments.payouts.status.arrived");
    case "sent":
      return tr("payments.payouts.status.onItsWay");
    case "failed":
      return tr("payments.payouts.status.failed");
    default:
      return tr("payments.payouts.status.processing");
  }
}

/** Who was paid. Falls back to the currency rather than to "Bank account". */
export function payoutRecipientName(order: OfframpOrder): string {
  const b = order.beneficiary;
  const alias = (b?.alias ?? "").trim();
  if (alias) return alias;
  const holder = (b?.holderName ?? "").trim();
  if (holder) return holder;
  const bank = (b?.bankName ?? "").trim();
  if (bank) return bank;
  return tr("payments.payouts.currencyPayout", { currency: (order.currency || "").toUpperCase() });
}

/**
 * "MX$2,000.00", the figure the person typed — never the stablecoin one. A
 * blank amount falls back to the bare currency code: `Number("")` is 0, which
 * is finite, so a missing field would otherwise render a payout of nothing.
 */
export function payoutAmountText(order: OfframpOrder): string {
  const currency = (order.currency || "").toUpperCase();
  const raw = String(order.amount ?? "").trim();
  if (!raw) return currency;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return currency;
  try {
    // In its own currency, never converted; only the language's way of writing it.
    return fmtNumber(value, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return `${fmtNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** The line under the name. The rail is not on the order row, so it is not guessed. */
export function payoutMethodLine(last4?: string | null): string {
  const l = (last4 ?? "").trim();
  return l ? tr("payments.payouts.methodWithLast4", { last4: l }) : tr("payments.payouts.method");
}

/** Newest first, defensively: the server already orders by `createdAt DESC`. */
export function newestFirst(orders: readonly OfframpOrder[]): OfframpOrder[] {
  return [...orders].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
}

/* ── Standing payments (GET /scheduled-payments) ──────────────────── */

export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case "once":
      return tr("payments.scheduled.cadence.once");
    case "weekly":
      return tr("payments.scheduled.cadence.weekly");
    case "biweekly":
      return tr("payments.scheduled.cadence.biweekly");
    case "monthly":
      return tr("payments.scheduled.cadence.monthly");
    default:
      return cadence;
  }
}

/**
 * A status the person can act on, rather than the database's word for it.
 * `pending_authorization` matters most: the row exists and no signature
 * landed, so it will never pay, and a neutral label beside live schedules
 * would be a list that lies by omission.
 */
export function scheduleStatus(s: Schedule): { label: string; live: boolean } {
  if (s.status === "pending_authorization") return { label: tr("payments.scheduled.status.notApproved"), live: false };
  if (s.status === "cancelled") return { label: tr("payments.scheduled.status.cancelled"), live: false };
  if (s.status === "completed") return { label: tr("payments.scheduled.status.finished"), live: false };
  if (s.status === "paused") return { label: tr("payments.scheduled.status.paused"), live: false };
  return { label: tr("payments.scheduled.status.active"), live: true };
}

/** Stablecoin base units. Six for USDC and USDT on every chain we support. */
const SCHEDULE_DECIMALS = 6;

/**
 * Two conversions, never one. An off ramp is denominated in real money and
 * carries cents; an on-chain payment is in token base units. Using either
 * divisor for both is the bug this exists to make impossible — a 50 dollar
 * rent once rendered as "50000000".
 */
export function formatScheduleAmount(s: Schedule): string {
  const two = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (s.kind === "offramp") return `${fmtNumber(Number(s.amountMinor) / 100, two)} ${s.amountCurrency}`;
  const units = Number(s.amountMinor) / 10 ** SCHEDULE_DECIMALS;
  return `${fmtNumber(units, two)} ${(s.token || "").toUpperCase()}`;
}

/** "Next 3 Oct", or an em dash when there is no next run. */
export function scheduleDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtDate(d, { day: "numeric", month: "short" });
}

/* ── The other half of the list: conversations ────────────────────── */

/**
 * A row in Payments, once the money and the words are put together.
 *
 * WHY THE LIST NEEDED A SECOND HALF
 *
 * Built from `/transfers` alone, this screen could not show a person you have
 * only ever messaged — they had never appeared in a transfer, so they had no
 * row — and no message ever changed its order. The backend's own note on
 * `/payment-notes/conversations` says exactly that: "this is the missing half".
 *
 * WHAT JOINS THEM
 *
 * The handle. A transfer carries `fromAlias`/`toAlias` and no user id; a
 * conversation carries the peer's user id and their handle. So the handle is
 * the only key both sides hold, which is also why the app resolves threads
 * through `/search/users` — same join, made at the other end.
 *
 * A thread with no conversation keeps its money row and gets no composer (there
 * is no user id to write to). A conversation with no thread becomes a row of
 * its own. Neither half is allowed to hide the other.
 */
export interface InboxRow {
  id: string;
  name: string;
  /** The peer's user id, when the conversations half knows it. Null = no chat. */
  peerId: string | null;
  avatarUrl: string | null;
  kind: CounterpartyKind;
  /** The second line, already worded — money or words, whichever is newer. */
  line: string;
  /** True when `line` came from the conversation rather than from a transfer. */
  lineIsMessage: boolean;
  ts: number;
  unread: number;
  /** The payments with this person. Empty for a conversation that never paid. */
  transfers: Transfer[];
  thread: PaymentThread | null;
}

/** `@alex` and `alex` are the same person. */
function handleKey(s: string | null | undefined): string {
  return String(s ?? "").trim().replace(/^@/, "").toLowerCase();
}

export interface ConversationLike {
  peerId: string;
  aliasHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastBody: string;
  lastHasMedia: boolean;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
}

/**
 * One list out of two.
 *
 * The second line is whichever half spoke last, so a message moves a row up the
 * list exactly as a payment does — the thing the money-only list could not do.
 */
export function mergeInbox(
  threads: readonly PaymentThread[],
  conversations: readonly ConversationLike[],
): InboxRow[] {
  const byHandle = new Map<string, ConversationLike>();
  for (const c of conversations) {
    const key = handleKey(c.aliasHandle);
    if (key) byHandle.set(key, c);
  }

  const used = new Set<string>();
  const rows: InboxRow[] = threads.map((t) => {
    const key = handleKey(t.alias);
    const c = key ? byHandle.get(key) : undefined;
    if (c) used.add(c.peerId);

    const chatTs = c ? Date.parse(c.lastAt) : NaN;
    const chatNewer = c && Number.isFinite(chatTs) && chatTs > t.lastTs;
    const body = c ? (c.lastHasMedia && !c.lastBody ? "GIF" : c.lastBody) : "";

    return {
      id: t.id,
      name: threadDisplayName(t),
      peerId: c?.peerId ?? null,
      avatarUrl: c?.avatarUrl ?? null,
      kind: t.kind,
      line: chatNewer ? (c!.lastFromMe ? tr("payments.line.youPrefix", { text: body }) : body) : t.lastLine,
      lineIsMessage: !!chatNewer,
      ts: chatNewer ? chatTs : t.lastTs,
      unread: c?.unread ?? 0,
      transfers: t.transfers,
      thread: t,
    };
  });

  for (const c of conversations) {
    if (used.has(c.peerId)) continue;
    const body = c.lastHasMedia && !c.lastBody ? "GIF" : c.lastBody;
    const ts = Date.parse(c.lastAt);
    rows.push({
      id: `peer:${c.peerId}`,
      name: c.displayName?.trim() || (c.aliasHandle ? `@${c.aliasHandle}` : tr("payments.someoneOnHold")),
      peerId: c.peerId,
      avatarUrl: c.avatarUrl,
      kind: "hihodl",
      line: c.lastFromMe ? tr("payments.line.youPrefix", { text: body }) : body,
      lineIsMessage: true,
      ts: Number.isFinite(ts) ? ts : 0,
      unread: c.unread,
      transfers: [],
      thread: null,
    });
  }

  return rows.sort((a, b) => b.ts - a.ts);
}
