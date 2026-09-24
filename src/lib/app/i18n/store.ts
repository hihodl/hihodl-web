/**
 * What the product is showing right now: the language, its words, the display
 * currency and the rates to reach it. One module-level store, so a plain
 * function in lib/ (an error message, a status line) reads the same language
 * as the screen that shows it, and React re-renders through
 * useSyncExternalStore (./react).
 *
 * The server always renders English in dollars: it has no idea who is asking.
 * The browser switches after mount (I18nProvider), before the shell has read
 * the session, so the switch lands before any account figure is drawn.
 *
 * Pure: no React, no `@/` imports.
 */

import { DEFAULT_LOCALE, type LocaleCode } from "./locales";

/** Where the display currency came from. Stays quotes in EUR, not USD, when nothing was chosen. */
export type CurrencySource = "server" | "saved" | "region" | "default";

export interface PrefsState {
  locale: LocaleCode;
  /** The chosen language's words, prefixed keys; English fills any gap. */
  dict: Readonly<Record<string, string>>;
  /** ISO 4217, upper case. */
  currency: string;
  currencySource: CurrencySource;
  /** Units of a currency per 1 USD (GET /fx/rates); null until read. */
  rates: Readonly<Record<string, number>> | null;
}

let state: PrefsState = {
  locale: DEFAULT_LOCALE,
  dict: {},
  currency: "USD",
  currencySource: "default",
  rates: null,
};
let version = 0;
const listeners = new Set<() => void>();

export function getPrefs(): PrefsState {
  return state;
}

export function setPrefs(patch: Partial<PrefsState>): void {
  state = { ...state, ...patch };
  version++;
  listeners.forEach((l) => l());
}

export function subscribePrefs(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function prefsVersion(): number {
  return version;
}
