// Server-only by construction: no "use client" file imports this module.
import payPageEn from "@/lib/app/i18n/en/payPage";
import { formatMessage } from "@/lib/app/i18n/icu";
import { dictionaryOf, intlTag, isLocale } from "@/lib/app/i18n/locales";

import type { OgCopy, OgFormat } from "./og-copy";
import { EXTRA_LOCALES, isExtra, payLocaleFrom, type PayLocale } from "./pay-locales";

/**
 * The link card's words in the reader's language.
 *
 * The page itself picks its language in the browser (./pay-i18n: the page's
 * own choice, else the browser's languages, else English). A link card is
 * drawn before any browser runs, so the only hint is the request's
 * Accept-Language: the same languages, matched by the same rule. A crawler
 * that sends none reads English.
 */

const OG_KEYS = ["personalTitle", "linkDescription", "cardApplePay", "byCard", "plain", "genericTitle"] as const;

async function payPageWords(locale: PayLocale): Promise<Record<string, string> | null> {
  try {
    if (isExtra(locale)) {
      const d = (await import(`./locales/${locale}.json`)).default as Record<string, string>;
      return Object.fromEntries(Object.entries(d).map(([k, v]) => [k.replace(/^payPage\./, ""), v]));
    }
    if (!isLocale(locale)) return null;
    const code = dictionaryOf(locale);
    if (code === "en") return null;
    return (await import(`@/lib/app/i18n/locales/${code}/payPage.json`)).default as Record<string, string>;
  } catch {
    return null;
  }
}

export async function ogCopyFor(acceptLanguage: string | null | undefined): Promise<{ copy: OgCopy; fmt: OgFormat; intl: string; lang: PayLocale }> {
  const lang = payLocaleFrom(acceptLanguage);
  const words = lang === "en" ? null : await payPageWords(lang);
  const en = payPageEn as Record<string, string>;
  const copy = Object.fromEntries(OG_KEYS.map((k) => [k, words?.[`og.${k}`] || en[`og.${k}`]])) as unknown as OgCopy;
  const intl = isExtra(lang) ? EXTRA_LOCALES.find((l) => l.code === lang)?.intl ?? "en" : isLocale(lang) ? intlTag(lang) : "en";
  const fmt: OgFormat = (message, vars) => formatMessage(message, vars, intl);
  return { copy, fmt, intl, lang };
}
