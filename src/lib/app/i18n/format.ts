/**
 * Numbers, dates and money, in the person's language and currency.
 *
 * MONEY: WHICH FUNCTION
 *
 *   fmtUsd(usd)               a value the product knows in US dollars (a
 *                             balance, a total, a price, a gain): shown in the
 *                             DISPLAY CURRENCY, converted at GET /fx/rates.
 *                             Without a rate for it, it stays in dollars: a
 *                             missing rate is never guessed.
 *   fmtFiat(amount, "EUR")    an amount that IS in a currency (a group's
 *                             expense, a stay quoted in pesos): that currency,
 *                             never converted, formatted for the language.
 *   fmtToken(amount, "USDC")  an amount that is actually paid: stays in the
 *                             token. "12.50 USDC".
 *
 * Every function reads the store at call time. A component that shows these
 * must call useT() or useFormat() (./react) so it re-renders when the
 * language, the currency or the rates change.
 *
 * Pure: no React, no `@/` imports.
 */

import { intlTag } from "./locales";
import { getPrefs } from "./store";

function tag(): string {
  return intlTag(getPrefs().locale);
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = tag() + JSON.stringify(options);
  let f = nfCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(tag(), options);
    } catch {
      f = new Intl.NumberFormat("en-US", options);
    }
    nfCache.set(key, f);
  }
  return f;
}

const dfCache = new Map<string, Intl.DateTimeFormat>();
function df(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tag() + JSON.stringify(options);
  let f = dfCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(tag(), options);
    } catch {
      f = new Intl.DateTimeFormat("en-US", options);
    }
    dfCache.set(key, f);
  }
  return f;
}

/* ── Numbers ──────────────────────────────────────────────────────── */

/** 1234.5 → "1,234.5" / "1.234,5". */
export function fmtNumber(n: number, options: Intl.NumberFormatOptions = {}): string {
  return nf(options).format(n);
}

/** 0.0523 → "5.23%" (a FRACTION in). Pass digits to fix the decimals. */
export function fmtPercent(fraction: number, digits?: number): string {
  return nf({
    style: "percent",
    ...(digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  }).format(fraction);
}

/** 12500 → "12.5K" / "12,5 mil". */
export function fmtCompact(n: number): string {
  return nf({ notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/* ── Dates ────────────────────────────────────────────────────────── */

type DateIn = Date | string | number;
const asDate = (d: DateIn) => (d instanceof Date ? d : new Date(d));

/** A date in the language. Default: "Sep 24, 2026" / "24 sept 2026". */
export function fmtDate(d: DateIn, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const date = asDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return df(options).format(date);
}

/** "14:05" / "2:05 PM", as the language writes a time. */
export function fmtTime(d: DateIn, options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }): string {
  return fmtDate(d, options);
}

/** "Sep 24, 2026, 2:05 PM". */
export function fmtDateTime(d: DateIn): string {
  return fmtDate(d, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "3 days ago" / "hace 3 días" / "in 2 hours". */
export function fmtRelative(d: DateIn, now: number = Date.now()): string {
  const date = asDate(d);
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 864e5],
    ["month", 30 * 864e5],
    ["week", 7 * 864e5],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(tag(), { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "minute");
}

/** A month's name, "September" / "septiembre" (0-based month). */
export function monthName(month: number, style: "long" | "short" = "long"): string {
  return df({ month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2000, month, 1)));
}

/** A weekday's name, 0 = Sunday. */
export function weekdayName(day: number, style: "long" | "short" | "narrow" = "short"): string {
  return df({ weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + day)));
}

/* ── Money ────────────────────────────────────────────────────────── */

/** The minor digits a currency is written with (JPY 0, BHD 3, most 2). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export interface MoneyOptions {
  /** Force a sign: "+$5.00" for a gain, "−$5.00" for a loss. */
  signed?: boolean;
  /** Drop the minor units ("$1,235"). */
  whole?: boolean;
  /** Fixed decimals, overriding the currency's own. */
  digits?: number;
  /** "$12.5K". */
  compact?: boolean;
  /** Absolute value (the caller draws the sign itself). */
  abs?: boolean;
}

/** An amount in its own currency: a group's EUR 12.00, a stay's MXN 1,250. Never converted. */
export function fmtFiat(amount: number, currency: string, o: MoneyOptions = {}): string {
  const value = o.abs ? Math.abs(amount) : amount;
  const code = (currency || "USD").toUpperCase();
  const options: Intl.NumberFormatOptions = { style: "currency", currency: code, currencyDisplay: "narrowSymbol" };
  if (o.compact) {
    options.notation = "compact";
    options.maximumFractionDigits = 1;
  } else if (o.whole) {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 0;
  } else if (o.digits !== undefined) {
    options.minimumFractionDigits = o.digits;
    options.maximumFractionDigits = o.digits;
  }
  if (o.signed) options.signDisplay = "exceptZero";
  try {
    return nf(options).format(value);
  } catch {
    // An ISO code Intl does not know (XAU, a new code): the number and the code.
    const n = nf({ minimumFractionDigits: o.whole ? 0 : 2, maximumFractionDigits: o.whole ? 0 : 2, ...(o.signed ? { signDisplay: "exceptZero" as const } : {}) }).format(value);
    return `${n} ${code}`;
  }
}

/** The currency figures are shown in (the person's choice, or USD). */
export function displayCurrency(): string {
  return getPrefs().currency;
}

/**
 * The display currency a dollar value is actually drawn in right now: the
 * chosen one when there is a rate for it, otherwise USD.
 */
export function effectiveCurrency(): string {
  const { currency, rates } = getPrefs();
  if (currency === "USD") return "USD";
  return rates && rates[currency] > 0 ? currency : "USD";
}

/** A dollar value in the display currency, as a number; the dollar value when there is no rate. */
export function usdToDisplay(usd: number): number {
  const { currency, rates } = getPrefs();
  if (currency === "USD") return usd;
  const r = rates?.[currency];
  return r && r > 0 ? usd * r : usd;
}

/** An amount in the display currency back to dollars (what a typed figure is worth). */
export function displayToUsd(amount: number): number {
  const { currency, rates } = getPrefs();
  if (currency === "USD") return amount;
  const r = rates?.[currency];
  return r && r > 0 ? amount / r : amount;
}

/** A dollar value, shown in the display currency: "$1,234.56" / "1.141,23 €". */
export function fmtUsd(usd: number, o: MoneyOptions = {}): string {
  return fmtFiat(usdToDisplay(usd), effectiveCurrency(), o);
}

/**
 * Units of `currency` per US dollar, when known: to show an amount that is
 * in some other currency (a group's) converted to the display one.
 */
export function unitsPerUsd(currency: string): number | null {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  const r = getPrefs().rates?.[code];
  return r && r > 0 ? r : null;
}

/** An amount in `currency` shown in the display currency; null when either rate is missing. */
export function fmtConverted(amount: number, currency: string, o: MoneyOptions = {}): string | null {
  const from = unitsPerUsd(currency);
  if (from === null) return null;
  return fmtUsd(amount / from, o);
}

/** An amount that is paid in a token: "12.50 USDC". Never converted. */
export function fmtToken(amount: number, symbol: string, maxDigits = 6): string {
  const digits = Math.abs(amount) >= 1 ? Math.min(maxDigits, 2) : maxDigits;
  return `${fmtNumber(amount, { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })} ${symbol}`;
}

/** The symbol the display currency is written with: "$", "€", "R$". */
export function currencySymbol(currency: string = effectiveCurrency()): string {
  try {
    const part = nf({ style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}
