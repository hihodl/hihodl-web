/**
 * The languages the product speaks: the app's 19 (hihodl-wallet
 * src/i18n/i18n.ts), with the app's own native names and flag countries
 * (settings/language.tsx, constants/languageToCountry.ts).
 *
 * THE THREE SPANISH ROWS SHARE ONE DICTIONARY
 *
 * es-ES, es-MX and es-AR are three rows in the picker, as in the app, and all
 * three read Spain Spanish words, as the app's groups namespace does on
 * purpose. What changes between them is the Intl locale: dates, decimal
 * separators and the order of day and month follow the country chosen.
 *
 * Pure: no React, no `@/` imports, so the .check.ts scripts can load it under
 * sucrase-node.
 */

export const LOCALE_CODES = [
  "en",
  "es-ES",
  "es-MX",
  "es-AR",
  "pt-BR",
  "fr",
  "de",
  "it",
  "nl",
  "tr",
  "ar-AE",
  "hi",
  "zh-CN",
  "ja",
  "ko",
  "th",
  "id",
  "vi",
  "sw",
] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

/** The dictionary a locale reads. Every Spanish row reads es-ES. */
export type DictionaryCode = Exclude<LocaleCode, "es-MX" | "es-AR">;

export const DICTIONARY_CODES = LOCALE_CODES.filter((c): c is DictionaryCode => c !== "es-MX" && c !== "es-AR");

export interface LocaleInfo {
  code: LocaleCode;
  /** The row's name, in the language itself (the app's wording). */
  native: string;
  /** The English name, searchable. */
  english: string;
  /** ISO 3166-1 alpha-2, for the round flag. */
  country: string;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: "en", native: "English (US)", english: "English", country: "US" },
  { code: "es-ES", native: "Español", english: "Spanish", country: "ES" },
  { code: "es-MX", native: "Español (México)", english: "Spanish (Mexico)", country: "MX" },
  { code: "es-AR", native: "Español (Argentina)", english: "Spanish (Argentina)", country: "AR" },
  { code: "pt-BR", native: "Português (Brasil)", english: "Portuguese (Brazil)", country: "BR" },
  { code: "fr", native: "Français", english: "French", country: "FR" },
  { code: "de", native: "Deutsch", english: "German", country: "DE" },
  { code: "it", native: "Italiano", english: "Italian", country: "IT" },
  { code: "nl", native: "Nederlands", english: "Dutch", country: "NL" },
  { code: "tr", native: "Türkçe", english: "Turkish", country: "TR" },
  { code: "ar-AE", native: "العربية", english: "Arabic", country: "AE" },
  { code: "hi", native: "हिन्दी", english: "Hindi", country: "IN" },
  { code: "zh-CN", native: "中文（简体）", english: "Chinese (Simplified)", country: "CN" },
  { code: "ja", native: "日本語", english: "Japanese", country: "JP" },
  { code: "ko", native: "한국어", english: "Korean", country: "KR" },
  { code: "th", native: "ไทย", english: "Thai", country: "TH" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian", country: "ID" },
  { code: "vi", native: "Tiếng Việt", english: "Vietnamese", country: "VN" },
  { code: "sw", native: "Kiswahili", english: "Swahili", country: "KE" },
];

export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocale(v: unknown): v is LocaleCode {
  return typeof v === "string" && (LOCALE_CODES as readonly string[]).includes(v);
}

export function dictionaryOf(code: LocaleCode): DictionaryCode {
  return code === "es-MX" || code === "es-AR" ? "es-ES" : code;
}

/** The tag Intl formats with: "ar-AE" keeps Latin digits, as the app's numbers do. */
export function intlTag(code: LocaleCode): string {
  if (code === "ar-AE") return "ar-AE-u-nu-latn";
  if (code === "hi") return "hi-IN-u-nu-latn";
  if (code === "th") return "th-TH-u-nu-latn-ca-gregory";
  return code;
}

/**
 * A language tag (a browser's "es-MX", a server's "pt", the app's "zh") as one
 * of ours, or null. The app's rule (resolveSupportedLang), except that a bare
 * "es" reads as Spain's Spanish, which is the words every Spanish row shows.
 */
export function matchLocale(tag: string | null | undefined): LocaleCode | null {
  if (!tag) return null;
  const clean = tag.trim().replace(/_/g, "-");
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const exact = LOCALE_CODES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split("-")[0];
  if (base === "es") return "es-ES";
  if (base === "pt") return "pt-BR";
  if (base === "zh") return "zh-CN";
  if (base === "ar") return "ar-AE";
  const byBase = LOCALE_CODES.find((c) => c.toLowerCase() === base || c.toLowerCase().startsWith(base + "-"));
  return byBase ?? null;
}

/** The first of the browser's languages we speak, or null. */
export function browserLocale(tags: readonly string[] | null | undefined): LocaleCode | null {
  for (const tag of tags ?? []) {
    const m = matchLocale(tag);
    if (m) return m;
  }
  return null;
}
