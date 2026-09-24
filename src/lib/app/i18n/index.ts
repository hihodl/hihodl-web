/**
 * The product's words, in the person's language.
 *
 *   t("menu.settings.title")                      "Settings" / "Ajustes"
 *   t("groups.members", { count: 3 })             ICU plural, see ./icu
 *
 * In a component, call `useT()` from ./react instead: it is the same function,
 * and it re-renders the component when the language changes. Here, for lib/
 * code (an error message, a status line), it reads whatever language is on
 * screen at the moment it is called.
 *
 * English is the source (./en), typed: a key that does not exist is a type
 * error. A key a translation lacks reads English, never the key.
 *
 * Pure apart from dynamic imports: no React, no `@/` imports.
 */

import { EN, type MessageKey } from "./en";
import { formatMessage, type Vars } from "./icu";
import { dictionaryOf, intlTag, isLocale, type LocaleCode } from "./locales";
import { LOADERS } from "./locales/load";
import { getPrefs, setPrefs } from "./store";

export type { MessageKey } from "./en";
export type { Vars } from "./icu";
export { LOCALES, LOCALE_CODES, matchLocale, browserLocale, isLocale, type LocaleCode } from "./locales";

const EN_DICT = EN as Readonly<Record<string, string>>;

/** The message for `key` in the current language, English where it has none. */
export function t(key: MessageKey, vars?: Vars): string {
  const { dict, locale } = getPrefs();
  const raw = dict[key] ?? EN_DICT[key];
  if (raw === undefined) return key;
  return formatMessage(raw, vars, intlTag(locale));
}

/** The raw message, unformatted: for rich text, which formats around tags. */
export function rawMessage(key: MessageKey): string {
  const { dict } = getPrefs();
  return dict[key] ?? EN_DICT[key] ?? key;
}

/** Whether `key` exists: for a key built from data (a category id, a status). */
export function hasMessage(key: string): key is MessageKey {
  return key in EN_DICT;
}

/** `t` for a key built from data, with a fallback when there is no such key. */
export function tMaybe(key: string, fallback: string, vars?: Vars): string {
  return hasMessage(key) ? t(key, vars) : fallback;
}

export function currentLocale(): LocaleCode {
  return getPrefs().locale;
}

/** The tag to hand Intl for the current language. */
export function currentIntl(): string {
  return intlTag(getPrefs().locale);
}

let loading: Promise<void> | null = null;
let wanted: LocaleCode | null = null;

/**
 * Switch the language: load its words (a separate chunk per language), then
 * switch everything at once, so nothing is ever drawn half in one language.
 */
export async function applyLocale(code: LocaleCode): Promise<void> {
  if (!isLocale(code)) return;
  wanted = code;
  const dictCode = dictionaryOf(code);
  if (dictCode === "en") {
    if (wanted === code) setPrefs({ locale: code, dict: {} });
    return;
  }
  const run = (async () => {
    try {
      const mod = await LOADERS[dictCode]();
      if (wanted === code) setPrefs({ locale: code, dict: mod.default });
    } catch {
      // A chunk that did not load leaves the page in the language it was in.
    }
  })();
  loading = run;
  await run;
  if (loading === run) loading = null;
}

/** Plain-language list: "Ana, Luis and Marta" / "Ana, Luis y Marta". */
export function listText(items: readonly string[], type: "conjunction" | "disjunction" = "conjunction"): string {
  try {
    // ListFormat is ES2021; typed loosely so an older lib setting still compiles.
    const LF = (Intl as unknown as { ListFormat?: new (l: string, o: object) => { format(i: readonly string[]): string } }).ListFormat;
    if (LF) return new LF(currentIntl(), { style: "long", type }).format(items);
  } catch {
    /* fall through */
  }
  return items.join(", ");
}
