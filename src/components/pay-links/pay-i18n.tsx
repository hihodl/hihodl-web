"use client";

/**
 * The pay page's language: this browser's choice for the page, else its own
 * languages, else English, among the product's languages and the page's
 * eight extra ones (@/lib/pay-links/pay-locales).
 *
 * A product language goes through the product's own switch (applyLocale),
 * so every namespace follows. An extra one loads its dictionary and sets the
 * product's words to it with English underneath and its own Intl tag.
 *
 * The page is held invisible while a dictionary loads (at most 1.5 s), so it
 * is never drawn in English first. Arabic and Urdu turn the page right to
 * left.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { applyLocale } from "@/lib/app/i18n";
import { dictionaryOf } from "@/lib/app/i18n/locales";
import { setPrefs } from "@/lib/app/i18n/store";
import { EXTRA_LOCALES, browserPayLocale, isExtra, isPayLocale, isRtl, type ExtraCode, type PayLocale } from "@/lib/pay-links/pay-locales";

const KEY = "hold.payLocale";
const APP_KEY = "hold.locale";

const LOADERS: Record<ExtraCode, () => Promise<{ default: Readonly<Record<string, string>> }>> = {
  fil: () => import("@/lib/pay-links/locales/fil.json"),
  am: () => import("@/lib/pay-links/locales/am.json"),
  ru: () => import("@/lib/pay-links/locales/ru.json"),
  bn: () => import("@/lib/pay-links/locales/bn.json"),
  ha: () => import("@/lib/pay-links/locales/ha.json"),
  yo: () => import("@/lib/pay-links/locales/yo.json"),
  ur: () => import("@/lib/pay-links/locales/ur.json"),
  pl: () => import("@/lib/pay-links/locales/pl.json"),
};

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
    /* a private window: the choice holds for this visit */
  }
}

let wanted: PayLocale | null = null;

async function apply(code: PayLocale): Promise<void> {
  wanted = code;
  if (!isExtra(code)) {
    await applyLocale(code);
    return;
  }
  try {
    const mod = await LOADERS[code]();
    if (wanted !== code) return;
    const intl = EXTRA_LOCALES.find((l) => l.code === code)?.intl ?? code;
    setPrefs({ locale: "en", dict: mod.default, intl });
  } catch {
    // A chunk that did not load leaves the page in the language it was in.
  }
}

const Ctx = createContext<{ locale: PayLocale; choose: (c: PayLocale) => void }>({ locale: "en", choose: () => undefined });

export function usePayLocale() {
  return useContext(Ctx);
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function PayI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<PayLocale>("en");
  const [hidden, setHidden] = useState(false);

  useIsoLayoutEffect(() => {
    const saved = read(KEY);
    const appSaved = read(APP_KEY);
    const tags = navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : [];
    const code: PayLocale =
      (isPayLocale(saved) ? saved : null) ?? (isPayLocale(appSaved) ? appSaved : null) ?? browserPayLocale(tags) ?? "en";
    setLocale(code);
    if (code === "en" || (!isExtra(code) && dictionaryOf(code) === "en")) {
      void apply(code);
      return;
    }
    setHidden(true);
    const timer = window.setTimeout(() => setHidden(false), 1500);
    void apply(code).finally(() => {
      window.clearTimeout(timer);
      setHidden(false);
    });
  }, []);

  const choose = useCallback((code: PayLocale) => {
    write(KEY, code);
    // A product language is also the product's choice, as the app's picker makes it.
    if (!isExtra(code)) write(APP_KEY, code);
    setLocale(code);
    void apply(code);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = isRtl(locale) ? "rtl" : "ltr";
    return () => {
      el.dir = "ltr";
    };
  }, [locale]);

  return (
    <Ctx.Provider value={{ locale, choose }}>
      <div dir={isRtl(locale) ? "rtl" : "ltr"} style={hidden ? { display: "contents", visibility: "hidden" } : { display: "contents" }}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
