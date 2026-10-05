/**
 * The language of a public page, chosen on the server for the viewer asking.
 *
 *   await applyRequestLocale();   at the top of a page, before anything calls t()
 *
 * Which language: the viewer's own choice on these pages (the `hold.locale`
 * cookie the language switcher writes) → their browser's Accept-Language →
 * English. Every `t()` a server component calls for the rest of this request
 * then reads that language (./store `setServerScope`). The scope is React's
 * `cache`, which is per request, so concurrent visitors never share it.
 *
 * Client components still render English on the server and switch once in the
 * browser (PublicLanguage), as the /app tree does.
 *
 * Server only: reads the request's cookies and headers.
 */

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { dictionaryOf, isLocale, acceptLanguageLocale, type LocaleCode } from "./locales";
import { LOADERS } from "./locales/load";
import { getPrefs, setServerScope, type PrefsState } from "./store";

/** The cookie the public pages' language switcher writes (one year, readable by the page). */
export const LOCALE_COOKIE = "hold.locale";

const scope = cache((): { prefs: PrefsState | null } => ({ prefs: null }));
setServerScope(() => scope().prefs);

/** The language this request should render in, and whether the viewer chose it themselves. */
export function requestLocale(): { locale: LocaleCode; chosen: boolean } {
  const saved = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return { locale: saved, chosen: true };
  return { locale: acceptLanguageLocale(headers().get("accept-language")) ?? "en", chosen: false };
}

/**
 * Pick the request's language and load its words for the server's `t()`.
 * Call it first in the page, before anything is rendered.
 */
export async function applyRequestLocale(): Promise<{ locale: LocaleCode; chosen: boolean }> {
  const picked = requestLocale();
  const box = scope();
  if (box.prefs?.locale === picked.locale) return picked;
  const code = dictionaryOf(picked.locale);
  let dict: Readonly<Record<string, string>> = {};
  if (code !== "en") {
    try {
      dict = (await LOADERS[code]()).default;
    } catch {
      dict = {};
    }
  }
  box.prefs = { ...getPrefs(), locale: picked.locale, dict, intl: null };
  return picked;
}

/**
 * Run `build` in English whatever this request's language: a page's
 * metadata (its title, its link card) is what X and search engines read, and
 * it stays one language however the viewer reads the page. `build` must be
 * synchronous, so nothing else of this request runs while it does.
 */
export function inEnglish<T>(build: () => T): T {
  const box = scope();
  const kept = box.prefs;
  box.prefs = null;
  try {
    return build();
  } finally {
    box.prefs = kept;
  }
}
