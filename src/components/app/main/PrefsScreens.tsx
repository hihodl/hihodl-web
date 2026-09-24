"use client";

/**
 * Language and Currency: the app's two pickers (settings/language.tsx,
 * settings/currency.tsx), under Menu › Settings › Appearance.
 *
 * The same shape as the app: one card holding the whole list, round flags,
 * the language in its own name, RECENT above ALL (three at most, hidden while
 * searching), the white search pill at the foot, and a tap that saves at once
 * and goes back. No radio buttons: the chosen row wears the white check.
 *
 * A choice is kept in this browser at once and sent to the account (PATCH /me
 * `locale` / `displayCurrency`), so the app and every other browser follow. An
 * API that does not take the field yet refuses it; the choice still holds here.
 *
 * Currencies with no rate on the server's book carry the app's `*`: choosing
 * one is allowed, and amounts stay in US dollars until a rate exists.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { CURRENCIES, CURRENCY_COUNTRY } from "@/lib/app/i18n/currencies";
import { LOCALES, type LocaleCode } from "@/lib/app/i18n/locales";
import {
  chooseCurrency,
  chooseLocale,
  ensureRates,
  recentCurrencies,
  recentLocales,
  useDisplayCurrency,
  useLocale,
  useT,
} from "@/lib/app/i18n/react";
import { getPrefs } from "@/lib/app/i18n/store";
import { updateMe } from "@/lib/app/me";

import { BackHeader, Column, HoldCard, SectionTitle } from "../hold";
import { Ion } from "../ion";

/* ── Flags ────────────────────────────────────────────────────────── */

let flagsPromise: Promise<Readonly<Record<string, string>>> | null = null;
function useFlags(): Readonly<Record<string, string>> | null {
  const [flags, setFlags] = useState<Readonly<Record<string, string>> | null>(null);
  useEffect(() => {
    let alive = true;
    flagsPromise ??= import("@/lib/app/i18n/flags").then((m) => m.FLAG_SVGS);
    flagsPromise.then(
      (f) => alive && setFlags(f),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  return flags;
}

/** The app's Flag: a 3:2 flag cropped to a circle; a code on a chip when there is no country. */
function Flag({ country, fallback, flags, size = 36 }: { country: string | null; fallback: string; flags: Readonly<Record<string, string>> | null; size?: number }) {
  const svg = country && flags ? flags[country] : undefined;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {svg ? (
        <span
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 [&>svg]:h-full [&>svg]:w-full"
          style={{ width: Math.round(size * 1.5), height: size }}
          // The artwork is a static, bundled string (./flags), never user input.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : country && !flags ? null : (
        <span className="text-[11px] font-extrabold text-amber">{fallback.slice(0, 3)}</span>
      )}
    </span>
  );
}

/* ── The parts both pickers share ─────────────────────────────────── */

function Check() {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white">
      <Ion name="checkmark" size={14} className="text-black" />
    </span>
  );
}

function Row({ children, selected, onClick, label, last }: { children: React.ReactNode; selected: boolean; onClick: () => void; label: string; last: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`flex w-full min-w-0 items-center gap-3 px-[14px] py-[14px] text-left transition-colors hover:bg-white/[0.04] ${
        last ? "" : "border-b border-white/[0.06]"
      }`}
    >
      {children}
      {selected ? <Check /> : null}
    </button>
  );
}

/** The app's floating search pill: white, dark ink, at the foot of the screen. */
function SearchPill({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="sticky bottom-4 z-10 mt-4">
      <label className="flex h-[52px] items-center gap-3 rounded-[26px] border border-[rgba(7,12,18,0.08)] bg-white/95 px-[18px] shadow-[0_8px_22px_rgba(0,0,0,0.45)] focus-within:border-[rgba(7,12,18,0.18)]">
        <Ion name="search" size={18} className="shrink-0 text-[rgba(7,12,18,0.55)]" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.2px] text-[#070C12] outline-none placeholder:text-[rgba(7,12,18,0.45)]"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              ref.current?.focus();
            }}
            aria-label={t("common.clearSearch")}
            className="shrink-0 text-[rgba(7,12,18,0.55)]"
          >
            <Ion name="close-circle" size={18} />
          </button>
        ) : null}
      </label>
    </div>
  );
}

function Empty() {
  const t = useT();
  return <p className="py-8 text-center text-[14px] text-[#9FB7C2]">{t("common.noResults")}</p>;
}

/* ── Language ─────────────────────────────────────────────────────── */

export function languageName(code: LocaleCode): string {
  return LOCALES.find((l) => l.code === code)?.native ?? code;
}

export function LanguageScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const current = useLocale();
  const flags = useFlags();
  const [query, setQuery] = useState("");
  const [recents] = useState(() => recentLocales());

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? LOCALES.filter((l) => l.native.toLowerCase().includes(q) || l.english.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)) : LOCALES),
    [q],
  );
  const recentItems = recents.map((c) => LOCALES.find((l) => l.code === c)).filter((l): l is (typeof LOCALES)[number] => !!l);
  const showRecents = !q && recentItems.length > 0;

  const pick = (code: LocaleCode) => {
    void chooseLocale(code);
    // The account keeps it too, so the app and other browsers follow.
    void updateMe({ locale: code }).catch(() => undefined);
    window.setTimeout(onBack, 140);
  };

  const rows = (items: readonly (typeof LOCALES)[number][]) =>
    items.map((l, i) => (
      <Row key={l.code} selected={l.code === current} onClick={() => pick(l.code)} label={l.native} last={i === items.length - 1}>
        <Flag country={l.country} fallback={l.code} flags={flags} />
        <span className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-[0.1px] text-white" lang={l.code}>
          {l.native}
        </span>
      </Row>
    ));

  return (
    <Column>
      <BackHeader title={t("prefs.language")} onBack={onBack} />
      {showRecents ? (
        <>
          <SectionTitle first>{t("prefs.recentLanguages")}</SectionTitle>
          <HoldCard>{rows(recentItems)}</HoldCard>
        </>
      ) : null}
      <SectionTitle first={!showRecents}>{t("prefs.allLanguages")}</SectionTitle>
      <HoldCard>{filtered.length ? rows(filtered) : <Empty />}</HoldCard>
      <SearchPill value={query} onChange={setQuery} placeholder={t("prefs.searchLanguage")} />
    </Column>
  );
}

/* ── Currency ─────────────────────────────────────────────────────── */

/** The currency's name in the language on screen, or the app's English name. */
function useCurrencyNames(): (code: string, fallback: string) => string {
  const locale = useLocale();
  return useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([locale], { type: "currency" });
    } catch {
      dn = null;
    }
    return (code: string, fallback: string) => {
      if (locale === "en" || !dn) return fallback;
      try {
        const n = dn.of(code);
        return n && n !== code ? n.charAt(0).toLocaleUpperCase(locale) + n.slice(1) : fallback;
      } catch {
        return fallback;
      }
    };
  }, [locale]);
}

export function CurrencyScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { currency } = useDisplayCurrency();
  const flags = useFlags();
  const nameOf = useCurrencyNames();
  const [query, setQuery] = useState("");
  const [recents] = useState(() => recentCurrencies());
  useEffect(() => {
    void ensureRates();
  }, []);
  const rates = getPrefs().rates;
  const hasRate = (code: string) => code === "USD" || !rates || (rates[code] ?? 0) > 0;

  const q = query.trim().toLowerCase();
  const all = useMemo(() => CURRENCIES.map(([code, name]) => ({ code, name: nameOf(code, name), english: name })), [nameOf]);
  const filtered = useMemo(
    () => (q ? all.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.english.toLowerCase().includes(q)) : all),
    [all, q],
  );
  const recentItems = recents.map((c) => all.find((x) => x.code === c)).filter((x): x is (typeof all)[number] => !!x);
  const showRecents = !q && recentItems.length > 0;
  const anyMissing = !!rates && filtered.some((c) => !hasRate(c.code));

  const pick = (code: string) => {
    chooseCurrency(code);
    void updateMe({ displayCurrency: code }).catch(() => undefined);
    window.setTimeout(onBack, 140);
  };

  const rows = (items: readonly (typeof all)[number][]) =>
    items.map((c, i) => {
      const rate = hasRate(c.code);
      return (
        <Row
          key={c.code}
          selected={c.code === currency}
          onClick={() => pick(c.code)}
          label={rate ? `${c.code} ${c.name}` : t("prefs.currencyNoRateLabel", { code: c.code, name: c.name })}
          last={i === items.length - 1}
        >
          <Flag country={CURRENCY_COUNTRY[c.code] ?? null} fallback={c.code} flags={flags} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold tracking-[0.1px] text-white">
              {c.code}
              {rate ? null : <span className="ml-1 text-amber">*</span>}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-white/65">{c.name}</span>
          </span>
        </Row>
      );
    });

  return (
    <Column>
      <BackHeader title={t("prefs.currency")} onBack={onBack} />
      <p className="mb-1 px-1 text-[13px] leading-[18px] text-[#9FB7C2]">{t("prefs.currencyIntro")}</p>
      {showRecents ? (
        <>
          <SectionTitle>{t("prefs.recentCurrencies")}</SectionTitle>
          <HoldCard>{rows(recentItems)}</HoldCard>
        </>
      ) : null}
      <SectionTitle>{t("prefs.allCurrencies")}</SectionTitle>
      <HoldCard>{filtered.length ? rows(filtered) : <Empty />}</HoldCard>
      {anyMissing ? <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">{t("prefs.currencyNoRate")}</p> : null}
      <SearchPill value={query} onChange={setQuery} placeholder={t("prefs.searchCurrency")} />
    </Column>
  );
}
