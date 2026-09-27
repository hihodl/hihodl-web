/**
 * The languages the public pay page speaks: every language of the product
 * (../app/i18n/locales), plus four more that the people paying our users
 * read: Russian, Bengali, Urdu, Polish. Filipino, Amharic, Hausa and Yoruba
 * were dropped (Alex, 2026-09-27): the Philippines and Nigeria read English
 * officially, and a line nobody native has checked is worse than English.
 *
 * The extra four exist on this page only. Their dictionaries
 * (./locales/<code>.json) hold the pay page's words (the payPage namespace)
 * and the few shared lines it shows (a payment refusal, a wallet's name);
 * anything else reads English. While one is on screen the product's locale
 * is English and `intl` carries the language's own tag, so numbers and
 * plurals still follow it.
 *
 * Pure: no React, no `@/` imports, so a .check.ts can load it.
 */

import { LOCALES, browserLocale, isLocale, matchLocale, type LocaleCode } from "../app/i18n/locales";

export const EXTRA_CODES = ["ru", "bn", "ur", "pl"] as const;
export type ExtraCode = (typeof EXTRA_CODES)[number];
export type PayLocale = LocaleCode | ExtraCode;

export interface PayLocaleInfo {
  code: PayLocale;
  /** The language in its own script. */
  native: string;
  english: string;
  /** ISO 3166-1 alpha-2, for the round flag. */
  country: string;
  /** The Intl tag it formats with. */
  intl: string;
}

export const EXTRA_LOCALES: readonly PayLocaleInfo[] = [
  { code: "ru", native: "Русский", english: "Russian", country: "RU", intl: "ru-RU" },
  { code: "bn", native: "বাংলা", english: "Bengali", country: "BD", intl: "bn-BD-u-nu-latn" },
  { code: "ur", native: "اردو", english: "Urdu", country: "PK", intl: "ur-PK-u-nu-latn" },
  { code: "pl", native: "Polski", english: "Polish", country: "PL", intl: "pl-PL" },
];

/** Every row of the page's language sheet: the product's languages, then the page's own. */
export const PAY_LOCALES: readonly PayLocaleInfo[] = [
  ...LOCALES.map((l) => ({ code: l.code as PayLocale, native: l.native, english: l.english, country: l.country, intl: l.code })),
  ...EXTRA_LOCALES,
];

export function isExtra(code: unknown): code is ExtraCode {
  return typeof code === "string" && (EXTRA_CODES as readonly string[]).includes(code);
}

export function isPayLocale(code: unknown): code is PayLocale {
  return isLocale(code) || isExtra(code);
}

/** Written right to left: Arabic and Urdu. */
export function isRtl(code: PayLocale): boolean {
  return code === "ar-AE" || code === "ur";
}

/**
 * A browser tag as a page language, or null. The page's own languages first
 * then the product's rule: "es-MX" is Mexican
 * Spanish, "ar-IQ" and "ar-MR" Arabic, "pt-PT" Portuguese.
 */
export function matchPayLocale(tag: string | null | undefined): PayLocale | null {
  if (!tag) return null;
  const base = tag.trim().replace(/_/g, "-").toLowerCase().split("-")[0];
  if (isExtra(base)) return base;
  return matchLocale(tag);
}

export function browserPayLocale(tags: readonly string[] | null | undefined): PayLocale | null {
  for (const tag of tags ?? []) {
    const m = matchPayLocale(tag);
    if (m) return m;
  }
  return browserLocale([]);
}

/**
 * The keys an extra language's dictionary carries: the whole payPage
 * namespace and the shared lines the page can show.
 */
export const EXTRA_KEY_PREFIXES = [
  "payPage.",
  "home.payLinks.pay.",
  "home.payLinks.owner.",
  "sponsor.wallets.",
  "sponsor.checkoutError.",
] as const;

export const EXTRA_KEYS_EXACT = ["common.close", "common.clearSearch", "common.noResults"] as const;

export function isExtraKey(key: string): boolean {
  return EXTRA_KEY_PREFIXES.some((p) => key.startsWith(p)) || (EXTRA_KEYS_EXACT as readonly string[]).includes(key);
}
