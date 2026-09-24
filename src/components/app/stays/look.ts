/**
 * How Stays looks and how it says a number — the app's
 * `src/features/travel/palette.ts`, on the web.
 *
 * WHY STAYS CARRIES ITS OWN TOKENS
 *
 * The rest of the product draws on the web's own palette (`globals.css`).
 * Travel does not: in the app it is a screen with its own ground, its own
 * green and one amber it spends exactly once, and every number on it is
 * formatted by the functions below. Copying the screens without copying these
 * would produce something that looks nearly right and reads wrong — a price
 * with the wrong decimals, a date with the wrong dash.
 *
 * The values are transcribed, not approximated. Where the app writes
 * `StyleSheet.hairlineWidth` this writes `0.5px`, which is what that resolves
 * to on the 2× screens the app is drawn on.
 *
 * THE THREE COLOUR RULES, WHICH ARE THE WHOLE SYSTEM
 *
 *   green   money coming back — points credited, a refund. Never a selection,
 *           never a confirm button.
 *   amber   this commits, or this needs your attention. Spent ONCE per route,
 *           on the button that charges.
 *   neutral selection. A chosen rate, a chosen day, a chosen card is
 *           near-white — it is not a mood, it is a cursor.
 *
 * And no red. Not for cancel, not for sold out, not for non-refundable. The
 * app has none and neither does this.
 */

import { t, type MessageKey } from "@/lib/app/i18n";
import { fmtDate, fmtFiat, fmtNumber } from "@/lib/app/i18n/format";

/* ── Colour ───────────────────────────────────────────────────────── */

export const P = {
  /** The screen's ground. */
  bg: "#0a1929",
  /** Sticky footers — deliberately the same as the ground. */
  footer: "#0a1929",
  /** The three stops of a sheet's surface gradient, head to foot. */
  sheetTop: "#122C36",
  sheetMid: "#0A1921",
  sheet: "#08151C",

  green: "#0E9B68",
  greenSoft: "rgba(14,155,104,0.14)",
  greenBorder: "rgba(14,155,104,0.34)",
  /** Green for TEXT on navy: flat green is too dark to read small. */
  greenText: "#2FBE8A",

  /** Glass: a surface sitting on the GROUND. */
  card: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.10)",
  cardRaised: "rgba(255,255,255,0.07)",
  /** Solid: a surface sitting on ANOTHER SURFACE. */
  cardSolid: "#142232",
  cardOnSheet: "#182534",

  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.62)",
  textDim: "rgba(255,255,255,0.42)",
  textFaint: "rgba(255,255,255,0.28)",

  /** The one amber, filled. Only ever on the button that charges. */
  ctaBg: "#FFB703",
  ctaText: "#0F0F1A",
  /** The near-white "advance" fill, and the chip over a photograph. */
  chipBg: "#F1F5F9",
  chipText: "#0A1420",
  select: "#F1F5F9",
  selectText: "#0A1420",
  /** The band between the two ends of a chosen range. */
  selectSoft: "rgba(255,255,255,0.10)",
  todayRing: "rgba(255,255,255,0.50)",

  /** The same amber as `ctaBg`, told apart by FORM: a tint, never a fill. */
  caution: "#FFB703",
  cautionSoft: "rgba(255,183,3,0.12)",
  cautionBorder: "rgba(255,183,3,0.22)",

  divider: "rgba(255,255,255,0.08)",
} as const;

/** A hairline, as the app's 2× screens resolve it. */
export const HAIR = "0.5px";

export const R = {
  card: 18,
  hero: 24,
  pill: 999,
  input: 16,
  /** Every thumbnail in travel, without exception. */
  thumb: 12,
} as const;

/**
 * The glass card, as one class — the shape nine screens repeat.
 *
 * `border-[0.5px]` and not `border`: the app draws a hairline, and a full
 * pixel around a 4 % fill reads as an outline rather than an edge.
 */
export const CARD = "rounded-[18px] border-[0.5px] border-white/10 bg-white/[0.04]";
export const CARD_HERO = "rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04]";

/* ── Money, dates, counts ─────────────────────────────────────────── */

/*
 * Every number and date here is formatted in the person's language
 * (lib/app/i18n/format). A component that calls these must call `useT()` so it
 * re-renders when the language or the currency changes.
 */

/**
 * Money, as the person reads it, in the currency the stay is QUOTED in
 * (`staysCurrency()`): never converted. Never a percentage we keep.
 *
 * Under a thousand it keeps both decimals; at a thousand and over it rounds
 * and groups, because "€1,284.00" is four characters of noise on a figure
 * nobody is checking to the cent.
 */
export function money(amount: number, currency: string): string {
  return fmtFiat(amount, currency, Math.abs(amount) >= 1000 ? { whole: true } : { digits: 2 });
}

/**
 * A whole-unit price, where the cents are noise.
 *
 * Rounded UP, deliberately: a "from" price is a floor, and rounding a floor
 * down advertises a price that does not exist.
 */
export function moneyWhole(amount: number, currency: string): string {
  return fmtFiat(Math.ceil(amount), currency, { whole: true });
}

/** Counts in the reader's own digit grouping. */
export function count(n: number): string {
  return fmtNumber(n);
}

/** "12.34 USDC". Records and receipts only — never a label on a payment screen. */
export function usdc(amount: number): string {
  return `${fmtNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

/** "Fri, 29 Aug". */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDate(d, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Friday 14 March" — the booking screen's own, where there is room for it. */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDate(d, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * "14–17 Sept", or "28 Aug – 3 Sept" when the stay crosses a month.
 *
 * The two dashes are different on purpose. A TIGHT en-dash means one month
 * span; a SPACED one means two dates in two months. The month is said once:
 * repeating it inside a range says nothing the reader did not already have.
 */
export function dateRange(checkin: string, checkout: string): string {
  const a = new Date(`${checkin}T00:00:00Z`);
  const b = new Date(`${checkout}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${checkin} – ${checkout}`;
  const full = (d: Date) => fmtDate(d, { day: "numeric", month: "short", timeZone: "UTC" });
  // A different calendar month — or the same month a YEAR apart.
  if (checkin.slice(0, 7) !== checkout.slice(0, 7)) return `${full(a)} – ${full(b)}`;
  const day = (d: Date) => fmtDate(d, { day: "numeric", timeZone: "UTC" });
  const dayFirst = full(b).startsWith(day(b));
  return dayFirst ? `${day(a)}–${full(b)}` : `${full(a)}–${day(b)}`;
}

export function nightsBetween(checkin: string, checkout: string): number {
  const a = Date.parse(`${checkin}T00:00:00Z`);
  const b = Date.parse(`${checkout}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

/** "2 nights", "1 night". */
export function nights(n: number): string {
  return t("stays.nights", { count: n });
}

export function guests(adults: number, children: number): string {
  const parts = [t("stays.adults", { count: adults })];
  if (children > 0) parts.push(t("stays.children", { count: children }));
  return parts.join(" · ");
}

/** "29 Aug – 31 Aug · 2 nights". */
export function stayRange(checkin: string, checkout: string): string {
  return `${dateRange(checkin, checkout)} · ${nights(nightsBetween(checkin, checkout))}`;
}

/** ISO day, UTC, offset from today. The one place a date is minted. */
export function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function shiftDay(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** How many days from today to an ISO day. Negative once it has passed. */
export function daysUntil(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return 0;
  return Math.round((t - Date.parse(`${isoDay()}T00:00:00Z`)) / 86_400_000);
}

/** The word for a 0–10 guest score. Nothing below 7: silence beats "Average". */
export function ratingLabel(rating: number | null): string | null {
  if (rating === null || !Number.isFinite(rating)) return null;
  if (rating >= 9) return t("stays.rating.exceptional");
  if (rating >= 8) return t("stays.rating.veryGood");
  if (rating >= 7) return t("stays.rating.good");
  return null;
}

/* ── Points ───────────────────────────────────────────────────────── */

/** Value of one point, in dollars. */
export const POINT_USD = 0.01;

/** "455 pts". The only way points are rendered as an earning. */
export function pointsEarned(points: number): string {
  return t("stays.points.pts", { points: fmtNumber(points) });
}

/** "455 pts off" — points as a DISCOUNT on a price. */
export function pointsOff(points: number): string {
  return t("stays.points.ptsOff", { points: fmtNumber(points) });
}

/* ── Odds and ends the screens share ──────────────────────────────── */

/**
 * Whether a struck-through public price may be shown.
 *
 * Two per cent, because a saving smaller than that is inside the noise of
 * which rate the supplier happened to quote, and a crossed-out price that
 * proves nothing is a claim we cannot stand behind.
 */
const MIN_UNDERCUT = 0.02;

export function provablyCheaper(rate: { publicPrice: number | null; savingVsPublic: number | null }): boolean {
  const { publicPrice, savingVsPublic } = rate;
  if (publicPrice === null || savingVsPublic === null) return false;
  if (publicPrice <= 0 || savingVsPublic <= 0) return false;
  return savingVsPublic / publicPrice >= MIN_UNDERCUT;
}

/** The supplier's board codes, said in words. */
export function boardLabel(board: string | null): string | null {
  if (!board) return null;
  const key = board.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const known: Record<string, MessageKey> = {
    roomonly: "stays.board.roomOnly",
    breakfast: "stays.board.breakfast",
    bedandbreakfast: "stays.board.breakfast",
    halfboard: "stays.board.halfBoard",
    fullboard: "stays.board.fullBoard",
    allinclusive: "stays.board.allInclusive",
  };
  return known[key] ? t(known[key]) : board;
}

/** Metres under a kilometre, one decimal over it. */
export function distance(km: number): string {
  return km < 1
    ? fmtNumber(Math.round(km * 1000), { style: "unit", unit: "meter" })
    : fmtNumber(km, { style: "unit", unit: "kilometer", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Room sizes come in four spellings of two units. */
export function roomSize(size: number | null, unit: string | null): string | null {
  if (size === null) return null;
  const symbols: Record<string, string> = { sqm: "m²", sqmt: "m²", sqft: "ft²", sqf: "ft²" };
  const u = unit ? (symbols[unit.toLowerCase()] ?? unit) : "m²";
  return `${fmtNumber(size)} ${u}`;
}
