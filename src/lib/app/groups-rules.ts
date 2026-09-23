/**
 * Groups, the arithmetic and the rules, with nothing React in it so it can be
 * checked on its own with `npx sucrase-node`.
 *
 * The split previews copy the server's rules (hihodl-backend
 * server/services/groups-rules.ts, documentation/groups-splitwise-grade.md
 * §4.2) unit for unit, so what the form shows before Add is what the server
 * will write. The server still has the last word, and the screens show its
 * shares after a save, never these.
 *
 * MONEY IS A STRING OF MINOR UNITS, END TO END: read with BigInt, printed with
 * `formatMinor`, never through a float.
 */

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

export function toBig(minor: string | bigint | null | undefined): bigint {
  if (typeof minor === "bigint") return minor;
  return typeof minor === "string" && /^-?\d+$/.test(minor) ? BigInt(minor) : 0n;
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

/** "1200" in USD as "12.00" with no grouping, to prefill an input. */
export function minorToInput(minor: string | bigint, currency: string): string {
  return formatMinor(minor, currency).replace(/,/g, "");
}

/**
 * What somebody typed, in minor units: "12.5" in USD is "1250". A comma is
 * read as the decimal point ("12,5"), spaces are dropped, and more decimals
 * than the currency has is refused rather than rounded: money nobody typed is
 * not added or taken away. Null for anything that is not a positive amount.
 */
export function parseMajorToMinor(text: string, currency: string): string | null {
  const minor = parseMajorAllowZero(text, currency);
  return minor !== null && BigInt(minor) > 0n ? minor : null;
}

/** As `parseMajorToMinor`, but "0" is an amount (an exact split may give someone nothing). Empty is null. */
export function parseMajorAllowZero(text: string, currency: string): string | null {
  const exp = minorExponent(currency);
  const clean = text.replace(/\s/g, "").replace(",", ".");
  const m = /^(\d{0,15})(?:\.(\d*))?$/.exec(clean);
  if (!m || (!m[1] && !m[2])) return null;
  const frac = m[2] ?? "";
  if (frac.length > exp) return null;
  return BigInt(`${m[1] || "0"}${frac.padEnd(exp, "0")}` || "0").toString();
}

/** abs(), as a string, for "You owe 4.00" from a net of -400. */
export function absMinor(minor: string): string {
  const n = toBig(minor);
  return (n < 0n ? -n : n).toString();
}

/* ── Splits (the server's rules, copied) ──────────────────────────── */

export type SplitMode = "equal" | "percent" | "exact";
export type PreviewShare = { userId: string; shareMinor: bigint };

/** Each person gets floor(total·w/W); the units left go one each to the largest remainders, ties to the lowest userId. */
export function largestRemainder(total: bigint, weights: { userId: string; weight: bigint }[]): PreviewShare[] {
  const W = weights.reduce((a, w) => a + w.weight, 0n);
  if (!weights.length || W <= 0n) return [];
  const rows = weights.map((w) => ({ userId: w.userId, base: (total * w.weight) / W, rem: (total * w.weight) % W }));
  let left = total - rows.reduce((a, r) => a + r.base, 0n);
  const order = [...rows].sort((a, b) =>
    a.rem === b.rem ? (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0) : a.rem > b.rem ? -1 : 1,
  );
  const extra = new Set<string>();
  for (const r of order) {
    if (left <= 0n) break;
    extra.add(r.userId);
    left -= 1n;
  }
  return rows.map((r) => ({ userId: r.userId, shareMinor: r.base + (extra.has(r.userId) ? 1n : 0n) }));
}

/** The remainder goes to the payer when they share, else to the first participant by id. */
export function splitEqual(total: bigint, participants: readonly string[], payerUserId: string): PreviewShare[] {
  const people = [...new Set(participants)].sort();
  if (!people.length) return [];
  const n = BigInt(people.length);
  const base = total / n;
  const remainder = total - base * n;
  const carrier = people.includes(payerUserId) ? payerUserId : people[0];
  return people.map((userId) => ({ userId, shareMinor: base + (userId === carrier ? remainder : 0n) }));
}

/** "33.33" as 3333 hundredths; null when it is not 0 to 100 with at most two decimals. Empty is 0. */
export function parsePercent(text: string): bigint | null {
  const s = text.trim().replace(",", ".");
  if (!s) return 0n;
  const m = /^(\d{1,3})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const bp = BigInt(m[1]) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return bp > 10000n ? null : bp;
}

/** 3333 hundredths as "33.33", 5000 as "50". */
export function bpText(bp: bigint): string {
  const neg = bp < 0n;
  const a = neg ? -bp : bp;
  const whole = a / 100n;
  const frac = (a % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export interface SplitDraft {
  mode: SplitMode;
  /** In the paid currency. Null while the amount is not a valid positive amount. */
  totalMinor: string | null;
  currency: string;
  payerUserId: string | null;
  /** Who shares it, in the order the form lists them. */
  people: readonly string[];
  /** Per person, what was typed: a percent in percent mode, an amount in exact mode. */
  inputs: Readonly<Record<string, string>>;
}

export type SplitCheck =
  | { ok: true; shares: PreviewShare[] }
  | { ok: false; reason: "no_amount" | "no_people" | "bad_input" | "percent_left" | "percent_over" | "amount_left" | "amount_over" | "all_zero"; shares: PreviewShare[]; leftMinor?: bigint; leftBp?: bigint; badUserIds?: string[] };

/**
 * The form's live check and per-person preview, in the PAID currency.
 *
 *   equal    the people chosen, the server's remainder rule
 *   percent  must total exactly 100.00; shares by largest remainder
 *   exact    must total exactly the amount; the shares ARE the amounts
 *
 * A different paid currency is converted on the server; the preview is then
 * in the paid currency, and the screen says so.
 */
export function checkSplit(d: SplitDraft): SplitCheck {
  if (!d.people.length) return { ok: false, reason: "no_people", shares: [] };
  const total = d.totalMinor !== null ? toBig(d.totalMinor) : null;

  if (d.mode === "equal") {
    if (total === null || total <= 0n) return { ok: false, reason: "no_amount", shares: [] };
    return { ok: true, shares: splitEqual(total, d.people, d.payerUserId ?? "") };
  }

  if (d.mode === "percent") {
    const bad: string[] = [];
    const weights = d.people.map((userId) => {
      const bp = parsePercent(d.inputs[userId] ?? "");
      if (bp === null) bad.push(userId);
      return { userId, weight: bp ?? 0n };
    });
    if (bad.length) return { ok: false, reason: "bad_input", shares: [], badUserIds: bad };
    const sum = weights.reduce((a, w) => a + w.weight, 0n);
    // The preview of a partial entry uses each person's own percent of the whole, not a rescale.
    const partial = total !== null && total > 0n ? weights.map((w) => ({ userId: w.userId, shareMinor: (total * w.weight) / 10000n })) : [];
    if (sum === 0n) return { ok: false, reason: "all_zero", shares: partial, leftBp: 10000n };
    if (sum < 10000n) return { ok: false, reason: "percent_left", shares: partial, leftBp: 10000n - sum };
    if (sum > 10000n) return { ok: false, reason: "percent_over", shares: partial, leftBp: 10000n - sum };
    if (total === null || total <= 0n) return { ok: false, reason: "no_amount", shares: [] };
    return { ok: true, shares: largestRemainder(total, weights) };
  }

  const bad: string[] = [];
  const amounts = d.people.map((userId) => {
    const raw = (d.inputs[userId] ?? "").trim();
    const v = raw ? parseMajorAllowZero(raw, d.currency) : "0";
    if (v === null) bad.push(userId);
    return { userId, shareMinor: toBig(v ?? "0") };
  });
  if (bad.length) return { ok: false, reason: "bad_input", shares: amounts, badUserIds: bad };
  if (total === null || total <= 0n) return { ok: false, reason: "no_amount", shares: amounts };
  const sum = amounts.reduce((a, x) => a + x.shareMinor, 0n);
  if (sum === 0n) return { ok: false, reason: "all_zero", shares: amounts, leftMinor: total };
  if (sum < total) return { ok: false, reason: "amount_left", shares: amounts, leftMinor: total - sum };
  if (sum > total) return { ok: false, reason: "amount_over", shares: amounts, leftMinor: total - sum };
  return { ok: true, shares: amounts };
}

/** What the server is sent for a checked draft. Percents go as strings, amounts as minor-unit strings. */
export function splitBody(d: SplitDraft, everyone: boolean):
  | { mode: "equal"; participants?: string[] }
  | { mode: "percent"; percents: { userId: string; percent: string }[] }
  | { mode: "exact"; amounts: { userId: string; amountMinor: string }[] } {
  if (d.mode === "equal") return everyone ? { mode: "equal" } : { mode: "equal", participants: [...d.people] };
  if (d.mode === "percent") {
    return { mode: "percent", percents: d.people.map((userId) => ({ userId, percent: bpText(parsePercent(d.inputs[userId] ?? "") ?? 0n) })) };
  }
  return {
    mode: "exact",
    amounts: d.people.map((userId) => ({ userId, amountMinor: (parseMajorAllowZero((d.inputs[userId] ?? "").trim() || "0", d.currency) ?? "0") })),
  };
}

/** Everyone gets the same percent, the rest of 100.00 on the first ones, so the preset always sums. */
export function evenPercents(people: readonly string[]): Record<string, string> {
  if (!people.length) return {};
  const n = BigInt(people.length);
  const base = 10000n / n;
  let left = 10000n - base * n;
  const out: Record<string, string> = {};
  for (const id of people) {
    const extra = left > 0n ? 1n : 0n;
    left -= extra;
    out[id] = bpText(base + extra);
  }
  return out;
}

/* ── The thread ───────────────────────────────────────────────────── */

/**
 * Who has seen a message: every member whose read position is at or after it,
 * except its author. Instants, not strings (the server's `seenBy`).
 */
export function seenBy(item: { userId: string; at: string }, reads: readonly { userId: string; lastReadAt: string }[]): string[] {
  const at = Date.parse(item.at);
  if (!Number.isFinite(at)) return [];
  return reads
    .filter((r) => r.userId !== item.userId && Date.parse(r.lastReadAt) >= at)
    .map((r) => r.userId)
    .sort();
}

/** "Seen by Ana", "Seen by Ana and Luis", "Seen by Ana, Luis and 2 more", "Seen by everyone". */
export function seenLine(seen: readonly string[], othersCount: number, name: (id: string) => string): string | null {
  if (!seen.length) return null;
  if (othersCount > 1 && seen.length >= othersCount) return "Seen by everyone";
  const names = seen.map(name);
  if (names.length === 1) return `Seen by ${names[0]}`;
  if (names.length === 2) return `Seen by ${names[0]} and ${names[1]}`;
  return `Seen by ${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/* ── Faces ────────────────────────────────────────────────────────── */

export type Face = { kind: "photo"; url: string } | { kind: "emoji"; emoji: string } | { kind: "initials"; text: string } | { kind: "hold" };

/** The contract's order: the photo, else the emoji, else initials (or the HOLD mark for a private person). */
export function faceOf(p: { avatarUrl?: string | null; avatarEmoji?: string | null; displayName?: string | null; aliasHandle?: string | null; profileVisibility?: string | null }): Face {
  if (p.avatarUrl) return { kind: "photo", url: p.avatarUrl };
  if (p.avatarEmoji?.trim()) return { kind: "emoji", emoji: p.avatarEmoji.trim() };
  if (p.profileVisibility === "private") return { kind: "hold" };
  const source = (p.displayName?.trim() || (p.aliasHandle ?? "").replace(/^@+/, "")).trim();
  const text =
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { kind: "initials", text };
}

/* ── Dates ────────────────────────────────────────────────────────── */

/** Today as YYYY-MM-DD in the viewer's own calendar (not UTC's). */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The day an ISO instant falls on, for a date input. A `YYYY-MM-DD` stored at 12:00 UTC reads as that day everywhere. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return todayLocal(new Date(t));
}
