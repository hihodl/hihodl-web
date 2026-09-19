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
 * Two things the web does differently, both because it has less, never more:
 * the chat half of the app's list (`/payment-notes/conversations`) is not
 * mounted on this backend, so a thread here is built from `/transfers` alone;
 * and symbols are printed as they are (`12.00 USDC`) rather than masked into
 * dollars, which is what every other money screen on the web already does.
 *
 * Nothing here writes. Payments on the web is view only: paying, requesting,
 * accepting, cancelling a schedule and funding a payout all stay in the app.
 */

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
    if (addr.startsWith("0x")) return "Wallet";
    if (addr.length >= 32 && addr.length <= 44) return "Wallet";
    if (/^[A-Z]{2}\d{2}/.test(addr)) return "IBAN";
    if (/^\d{13,19}$/.test(addr)) return "Card";
  }
  return "Unknown";
}

/** `0x378B87…A9B6`, never a bare 42-character address. */
function shortenCounterparty(addr: string | null | undefined): string {
  const a = (addr ?? "").trim();
  if (!a) return "Unknown";
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
 * The app's `formatLastActivity`, without the fiat masking — the web prints
 * the symbol it was paid in, like the rest of its money screens.
 */
export function lastActivityLine(raw: string): string {
  const msg = raw.trim();
  const minus = /^[–-]\s*([\d.,]+)\s*([A-Z]+)\b/.exec(msg);
  if (minus) return `You sent ${minus[1]} ${minus[2]}`;
  const plus = /^\+\s*([\d.,]+)\s*([A-Z]+)\b/.exec(msg);
  if (plus) return `You received ${plus[1]} ${plus[2]}`;
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
    return addr.length > 10 ? `Wallet • ${addr.slice(0, 6)}...${addr.slice(-4)}` : `Wallet • ${addr}`;
  }
  if (thread.kind === "iban") {
    const iban = thread.address || thread.alias || "";
    return iban.length > 8 ? `IBAN • ${iban.slice(0, 2)}...${iban.slice(-4)}` : `IBAN • ${iban}`;
  }
  if (thread.kind === "card") {
    const card = thread.address || thread.alias || "";
    return card.length >= 4 ? `Card • •••• ${card.slice(-4)}` : `Card • ${card}`;
  }
  return thread.name || thread.alias || "Unknown";
}

/** Today a time, yesterday the word, this week the weekday, then the date. */
export function threadTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startToday - startDay) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

/** "Yesterday, 21:17" — the app's `when` on the details sheet. */
export function whenLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startToday - startDay) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

/** The app's verb for a row: what happened, not what it is. */
export function actionTitle(direction: Transfer["direction"]): string {
  switch (direction) {
    case "in":
      return "Received";
    case "out":
      return "Sent";
    case "move":
      return "Moved";
    case "exchange":
      return "Swapped";
    default:
      return "Transaction";
  }
}

/** Succeeded / Pending / Failed, as the sheet words it. */
export function statusWord(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed" || s === "completed" || s === "success" || s === "succeeded") return "Succeeded";
  if (s === "failed" || s === "error") return "Failed";
  if (s === "cancelled" || s === "canceled") return "Canceled";
  if (!s) return "—";
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
  if (order.needsFunding) return "Not paid yet";
  switch (payoutState(order)) {
    case "settled":
      return "Arrived";
    case "sent":
      return "On its way";
    case "failed":
      return "Didn't go through";
    default:
      return "Processing";
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
  return `${(order.currency || "").toUpperCase()} payout`;
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
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** The line under the name. The rail is not on the order row, so it is not guessed. */
export const PAYOUT_METHOD_LINE = "Bank transfer";

/** Newest first, defensively: the server already orders by `createdAt DESC`. */
export function newestFirst(orders: readonly OfframpOrder[]): OfframpOrder[] {
  return [...orders].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
}

/* ── Standing payments (GET /scheduled-payments) ──────────────────── */

const CADENCE_LABEL: Record<string, string> = {
  once: "One-off",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export function cadenceLabel(cadence: string): string {
  return CADENCE_LABEL[cadence] ?? cadence;
}

/**
 * A status the person can act on, rather than the database's word for it.
 * `pending_authorization` matters most: the row exists and no signature
 * landed, so it will never pay, and a neutral label beside live schedules
 * would be a list that lies by omission.
 */
export function scheduleStatus(s: Schedule): { label: string; live: boolean } {
  if (s.status === "pending_authorization") return { label: "Not approved yet", live: false };
  if (s.status === "cancelled") return { label: "Cancelled", live: false };
  if (s.status === "completed") return { label: "Finished", live: false };
  if (s.status === "paused") return { label: "Paused", live: false };
  return { label: "Active", live: true };
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
  if (s.kind === "offramp") return `${(Number(s.amountMinor) / 100).toFixed(2)} ${s.amountCurrency}`;
  const units = Number(s.amountMinor) / 10 ** SCHEDULE_DECIMALS;
  return `${units.toFixed(2)} ${(s.token || "").toUpperCase()}`;
}

/** "Next 3 Oct", or an em dash when there is no next run. */
export function scheduleDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
