"use client";

/**
 * The React side of the product's language and currency.
 *
 *   const t = useT();                 t("menu.settings.title")
 *   const f = useFormat();            f.fmtUsd(12.5), f.fmtDate(iso)
 *   <Rich k="home.linkHint" tags={{ b: (c) => <b>{c}</b> }} />
 *
 * Both hooks re-render the component when the language, the currency or the
 * rates change. They return the same module functions lib/ code imports from
 * `@/lib/app/i18n` and `@/lib/app/i18n/format`.
 *
 * WHICH LANGUAGE, WHICH CURRENCY
 *
 *   language   GET /me `locale` → this browser's saved choice → the browser's
 *              languages → English
 *   currency   GET /me `displayCurrency` → this browser's saved choice → the
 *              browser's region → US dollars
 *
 * I18nProvider (the /app layout) does the browser's part before first paint;
 * useServerPrefs (the shell, once /me is read) lets the server's win. Either
 * field missing from /me (an API that predates it) simply does not count.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { API_BASE } from "@/lib/ad-space/config";

import { EN } from "./en";
import { applyLocale, rawMessage, t, type MessageKey } from "./index";
import { isDisplayCurrency, regionCurrency } from "./currencies";
import * as format from "./format";
import { formatMessage, splitTags, type Vars } from "./icu";
import { browserLocale, dictionaryOf, intlTag, isLocale, matchLocale, type LocaleCode } from "./locales";
import { getPrefs, prefsVersion, setPrefs, subscribePrefs, type CurrencySource } from "./store";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function usePrefsVersion(): number {
  return useSyncExternalStore(subscribePrefs, prefsVersion, () => 0);
}

/** `t`, re-rendering this component when the language changes. */
export function useT(): typeof t {
  usePrefsVersion();
  return t;
}

/** The number, date and money formatters, re-rendering on a change of language, currency or rates. */
export function useFormat(): typeof format {
  usePrefsVersion();
  return format;
}

export function useLocale(): LocaleCode {
  usePrefsVersion();
  return getPrefs().locale;
}

/** The chosen display currency (ISO 4217) and whether a rate for it has been read. */
export function useDisplayCurrency(): { currency: string; source: CurrencySource; effective: string } {
  usePrefsVersion();
  const p = getPrefs();
  return { currency: p.currency, source: p.currencySource, effective: format.effectiveCurrency() };
}

/**
 * A message with tags: "Tap <b>Pay</b> to finish" and `tags={{ b: … }}`.
 * Every tag the message uses must be given; an unknown one prints its text.
 */
export function Rich({ k, vars, tags }: { k: MessageKey; vars?: Vars; tags: Record<string, (chunk: ReactNode) => ReactNode> }) {
  usePrefsVersion();
  const tagFor = intlTag(getPrefs().locale);
  const chunks = splitTags(rawMessage(k));
  return (
    <>
      {chunks.map((c, i) => {
        const text = formatMessage(c.text, vars, tagFor);
        const wrap = c.tag ? tags[c.tag] : undefined;
        return <Fragment key={i}>{wrap ? wrap(text) : text}</Fragment>;
      })}
    </>
  );
}

/* ── What this browser remembers ──────────────────────────────────── */

const LOCALE_KEY = "hold.locale";
const CURRENCY_KEY = "hold.displayCurrency";
const RECENT_LOCALES_KEY = "hold.recentLocales";
const RECENT_CURRENCIES_KEY = "hold.recentCurrencies";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the choice holds for this visit */
  }
}

function readList(key: string): string[] {
  try {
    const v = JSON.parse(read(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** The app's recents: newest first, at most three. */
function pushRecent(key: string, value: string): void {
  write(key, JSON.stringify([value, ...readList(key).filter((v) => v !== value)].slice(0, 3)));
}

export function recentLocales(): LocaleCode[] {
  return readList(RECENT_LOCALES_KEY).filter(isLocale);
}

export function recentCurrencies(): string[] {
  return readList(RECENT_CURRENCIES_KEY).filter(isDisplayCurrency);
}

function browserTags(): string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : [];
}

/* ── Rates ────────────────────────────────────────────────────────── */

let ratesRead: Promise<void> | null = null;
let ratesAt = 0;
const RATES_TTL = 10 * 60_000;

/**
 * GET /fx/rates: the server's settlement book, the one the app reads. Public,
 * no sign-in. A failure leaves the rates as they were, and a currency without
 * a rate is drawn in dollars (format.fmtUsd), never at a guessed rate.
 */
export function ensureRates(): Promise<void> {
  if (ratesRead) return ratesRead;
  if (getPrefs().rates && Date.now() - ratesAt < RATES_TTL) return Promise.resolve();
  ratesRead = (async () => {
    try {
      const res = await fetch(`${API_BASE}/fx/rates`, { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { rates?: { currency: string; unitsPerUsd: number }[] } };
      const list = body?.data?.rates;
      if (!Array.isArray(list)) return;
      const rates: Record<string, number> = { USD: 1 };
      for (const r of list) {
        const n = Number(r?.unitsPerUsd);
        if (typeof r?.currency === "string" && Number.isFinite(n) && n > 0) rates[r.currency.toUpperCase()] = n;
      }
      ratesAt = Date.now();
      setPrefs({ rates });
    } catch {
      /* offline or refused: amounts stay in dollars */
    } finally {
      ratesRead = null;
    }
  })();
  return ratesRead;
}

/* ── Choosing ─────────────────────────────────────────────────────── */

/** Set the language on this browser (and remember it). The caller tells the server. */
export async function chooseLocale(code: LocaleCode): Promise<void> {
  write(LOCALE_KEY, code);
  pushRecent(RECENT_LOCALES_KEY, code);
  await applyLocale(code);
}

/** Set the display currency on this browser (and remember it). The caller tells the server. */
export function chooseCurrency(code: string): void {
  const c = code.toUpperCase();
  if (!isDisplayCurrency(c)) return;
  write(CURRENCY_KEY, c);
  pushRecent(RECENT_CURRENCIES_KEY, c);
  setPrefs({ currency: c, currencySource: "saved" });
  void ensureRates();
}

/* ── The provider ─────────────────────────────────────────────────── */

/**
 * The browser's part of the choice, before the first paint: a saved language
 * or the browser's own, and a saved currency or the region's. While a
 * language's words load, the page is held invisible (at most 1.5 s), so it is
 * never drawn in English first and then switched.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useIsoLayoutEffect(() => {
    const saved = read(LOCALE_KEY);
    const code = (isLocale(saved) ? saved : null) ?? browserLocale(browserTags()) ?? "en";
    if (code !== getPrefs().locale) {
      if (dictionaryOf(code) === "en") {
        void applyLocale(code);
      } else {
        setHidden(true);
        const done = () => setHidden(false);
        const timer = window.setTimeout(done, 1500);
        void applyLocale(code).finally(() => {
          window.clearTimeout(timer);
          done();
        });
      }
    }

    const savedCurrency = read(CURRENCY_KEY);
    if (isDisplayCurrency(savedCurrency)) {
      setPrefs({ currency: savedCurrency.toUpperCase(), currencySource: "saved" });
    } else {
      const region = regionCurrency(browserTags());
      if (region) setPrefs({ currency: region, currencySource: "region" });
    }
    if (getPrefs().currency !== "USD") void ensureRates();
  }, []);

  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useDocumentTitle(locale);

  return <div style={hidden ? { display: "contents", visibility: "hidden" } : { display: "contents" }}>{children}</div>;
}

/* ── The tab's title ──────────────────────────────────────────────── */

/** English page title → its key in the "titles" namespace. */
const TITLE_KEYS: Record<string, MessageKey> = Object.fromEntries(
  Object.entries(EN)
    .filter(([k]) => k.startsWith("titles."))
    .map(([k, v]) => [v, k as MessageKey]),
);

/**
 * The pages' titles come from server metadata, in English ("Menu · HOLD").
 * Once in the browser, the word is swapped for the person's language, and
 * swapped again whenever Next sets a new title on navigation.
 */
function useDocumentTitle(locale: LocaleCode): void {
  useEffect(() => {
    let english = document.title;
    let writing = false;
    const apply = () => {
      const [page, ...rest] = english.split(" · ");
      const key = TITLE_KEYS[page];
      const next = key ? [t(key), ...rest].join(" · ") : english;
      if (document.title !== next) {
        writing = true;
        document.title = next;
        writing = false;
      }
    };
    apply();
    const head = document.querySelector("head");
    if (!head) return;
    const obs = new MutationObserver(() => {
      if (writing) return;
      const now = document.title;
      const [page] = now.split(" · ");
      // A title we did not write: Next navigated. Remember its English.
      if (TITLE_KEYS[page] || !Object.values(TITLE_KEYS).some((k) => t(k) === page)) english = now;
      apply();
    });
    obs.observe(head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [locale]);
}

/**
 * The server's part: once GET /me is read, its `locale` and `displayCurrency`
 * win over this browser's, and are remembered here so the next visit starts
 * in them. A field the API does not send yet is skipped.
 */
export function useServerPrefs(me: { locale?: string | null; displayCurrency?: string | null } | null | undefined): void {
  const serverLocale = matchLocale(me?.locale ?? null);
  const serverCurrency = isDisplayCurrency(me?.displayCurrency) ? me!.displayCurrency!.toUpperCase() : null;

  useEffect(() => {
    if (!serverLocale) return;
    write(LOCALE_KEY, serverLocale);
    if (serverLocale !== getPrefs().locale) void applyLocale(serverLocale);
  }, [serverLocale]);

  useEffect(() => {
    if (!serverCurrency) return;
    write(CURRENCY_KEY, serverCurrency);
    if (serverCurrency !== getPrefs().currency || getPrefs().currencySource !== "server") {
      setPrefs({ currency: serverCurrency, currencySource: "server" });
    }
    if (serverCurrency !== "USD") void ensureRates();
  }, [serverCurrency]);
}

/** Refresh the rates while a page is open (they are the server's daily book; ten minutes is plenty). */
export function useRatesRefresh(): void {
  const refresh = useCallback(() => {
    if (getPrefs().currency !== "USD") void ensureRates();
  }, []);
  useEffect(() => {
    const id = window.setInterval(refresh, RATES_TTL);
    return () => window.clearInterval(id);
  }, [refresh]);
}
