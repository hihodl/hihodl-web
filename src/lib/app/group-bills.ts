/**
 * What a person can split: their own money going out, read from what the web
 * already reads for Activity and Spending (`GET /transfers`) and for Stays
 * (`GET /travel/bookings`), turned into bills.
 *
 * Nothing React and only type imports, so `npx sucrase-node` can check it.
 *
 *   transfer  money that left, to a person, an address or a bank; a stablecoin
 *             is its peg's currency (USDC is dollars, EURC euros), any other
 *             token is its frozen dollar value, and a token with neither is
 *             left out rather than priced by a guess
 *   card      the same, when the counterparty is a card merchant
 *   stay      a booking that was paid (confirmed or completed), in the
 *             currency it was priced in
 *
 * A move between your own accounts, a swap, money coming in and anything that
 * failed is never a bill.
 */

import type { Transfer } from "./hold-api";
import type { Booking } from "./stays";
import { getStableFiatCurrency, parseAmt } from "./spending/amounts";
import type { SpendTransfer } from "./spending/types";
import { decimalToMinor, minorExponent, type Bill, type SourceKind } from "./groups-rules";

/** A bill the person can pick, with what the row prints under its name. */
export interface BillRow extends Bill {
  kind: SourceKind;
  ref: string;
  occurredAt: string;
  /** "Card", "Sent to @demo_creator", "Stay · Lisbon". */
  sub: string;
  /** A photo or emoji of the counterparty, when the ledger has one. */
  avatarUrl?: string | null;
  emoji?: string | null;
}

const DEAD = new Set(["failed", "cancelled", "canceled", "rejected", "expired", "reverted"]);

function shortAddress(a: string | null | undefined): string | null {
  if (!a) return null;
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function handle(alias: string | null | undefined): string | null {
  const v = (alias ?? "").trim().replace(/^@+/, "");
  return v ? `@${v}` : null;
}

function tickerOf(tokenId: string | null | undefined): string {
  return (tokenId ?? "").split(".")[0]?.toUpperCase() ?? "";
}

/**
 * What a transfer is to the picker:
 *   bill      money you spent, with a value
 *   unpriced  money you spent in a token that is not a stablecoin and has no
 *             frozen dollar value: left out, never priced by a guess, and
 *             counted so the screen can say how many
 *   no        not money you spent (in, a move, a swap, failed)
 */
export function classifyTransfer(t: Transfer): { kind: "bill"; bill: BillRow } | { kind: "unpriced" } | { kind: "no" } {
  if (t.direction !== "out") return { kind: "no" };
  if (DEAD.has((t.status ?? "").toLowerCase())) return { kind: "no" };
  if (t.moveKind) return { kind: "no" };

  const amount = parseAmt(t as unknown as SpendTransfer);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "no" };
  const peg = getStableFiatCurrency(t.symbol || tickerOf(t.tokenId));
  const usd = typeof t.usdValueAtTx === "number" && Number.isFinite(t.usdValueAtTx) && t.usdValueAtTx > 0 ? Math.abs(t.usdValueAtTx) : null;

  let currency: string;
  let amountMinor: string | null;
  if (peg) {
    currency = peg;
    amountMinor = decimalToMinor(amount.toFixed(8), peg);
  } else if (usd !== null) {
    currency = "USD";
    amountMinor = decimalToMinor(usd.toFixed(8), "USD");
  } else return { kind: "unpriced" };
  if (!amountMinor) return { kind: "unpriced" };

  const usdCents = currency === "USD" ? amountMinor : usd !== null ? decimalToMinor(usd.toFixed(8), "USD") : null;
  const card = t.counterpartyType === "card";
  const who = handle(t.toAlias);
  const label = t.merchantName?.trim() || who || shortAddress(t.toAddress) || "Payment";
  const sub = card ? "Card" : t.note?.trim() || (t.actionLabel?.trim() || (who ? "Sent" : "Payment"));

  const bill: BillRow = {
    key: `${card ? "card" : "transfer"}:${t.id}`,
    kind: card ? "card" : "transfer",
    ref: t.id,
    label,
    amountMinor,
    currency,
    usdCents,
    occurredAt: t.createdAt,
    sub,
    avatarUrl: t.counterpartyAvatar ?? null,
    emoji: t.profileEmoji ?? null,
  };
  return { kind: "bill", bill };
}

/** One transfer as a bill, or null when it is not money you spent (or has no value to split). */
export function billFromTransfer(t: Transfer): BillRow | null {
  const c = classifyTransfer(t);
  return c.kind === "bill" ? c.bill : null;
}

/** How many of these are money you spent in a token with no recorded value: the picker says so rather than hiding it. */
export function unpricedCount(transfers: readonly Transfer[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const t of transfers) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (classifyTransfer(t).kind === "unpriced") n++;
  }
  return n;
}

/** A paid booking as a bill. */
export function billFromBooking(b: Booking): BillRow | null {
  if (b.status !== "confirmed" && b.status !== "completed") return null;
  if (b.isSandbox) return null;
  const currency = (b.currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || !(b.price > 0)) return null;
  const amountMinor = decimalToMinor(b.price.toFixed(minorExponent(currency) + 2), currency);
  if (!amountMinor) return null;
  return {
    key: `stay:${b.id}`,
    kind: "stay",
    ref: b.id,
    label: b.hotel.name,
    amountMinor,
    currency,
    usdCents: currency === "USD" ? amountMinor : null,
    occurredAt: b.createdAt,
    sub: b.hotel.city ? `Stay · ${b.hotel.city}` : "Stay",
    avatarUrl: b.hotel.photo?.url ?? null,
  };
}

/** Every bill, newest first, each source once. */
export function billsFrom(transfers: readonly Transfer[], bookings: readonly Booking[]): BillRow[] {
  const seen = new Set<string>();
  const out: BillRow[] = [];
  for (const b of [...transfers.map(billFromTransfer), ...bookings.map(billFromBooking)]) {
    if (!b || seen.has(b.key)) continue;
    seen.add(b.key);
    out.push(b);
  }
  return out.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

/** The ones matching a search: the name, the line under it, or the amount as typed. */
export function searchBills<T extends BillRow>(rows: readonly T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return [...rows];
  return rows.filter((r) => `${r.label} ${r.sub}`.toLowerCase().includes(s) || r.amountMinor.includes(s.replace(/[.,]/g, "")));
}

/** Rows grouped under "Today", "Yesterday", or the day ("21 September"), in order. */
export function groupByDay<T extends { occurredAt: string }>(rows: readonly T[], now: Date = new Date()): { label: string; rows: T[] }[] {
  const out: { label: string; rows: T[] }[] = [];
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yesterday = dayKey(y);
  for (const r of rows) {
    const d = new Date(r.occurredAt);
    const k = dayKey(d);
    const label =
      k === today
        ? "Today"
        : k === yesterday
          ? "Yesterday"
          : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}
