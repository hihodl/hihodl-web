"use client";

/**
 * The public pay page's parts, drawn the app's way: the face with the HOLD
 * badge (Avatar.tsx: a photo, else initials on the brand amber gradient, and
 * the mini badge in a dark cutout ring), round flags, the language and
 * currency sheets (settings/language.tsx, settings/currency.tsx), the HOLD
 * sheet a computer shows, and the store badges.
 *
 * Pills are half their height round; a chosen row changes colour, never a
 * border. Nothing here is red.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Ion } from "@/components/app/ion";
import { Modal } from "@/components/app/Modal";
import { QrCode } from "@/components/ad-space/qr";
import { CURRENCIES, CURRENCY_COUNTRY } from "@/lib/app/i18n/currencies";
import { useLocale, useT } from "@/lib/app/i18n/react";
import { getPrefs } from "@/lib/app/i18n/store";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { initialsFor, safeAvatarUrl } from "@/lib/pay-links/page-rules";
import { PAY_LOCALES, type PayLocale } from "@/lib/pay-links/pay-locales";
import type { PayLinkOwner } from "@/lib/pay-links/types";

import { usePayLocale } from "./pay-i18n";

/* ── The face ───────────────────────────────────────────────────── */

/** The app's HOLD person circle: gold to brand amber, dark ink. */
const FACE_GRADIENT = "linear-gradient(135deg,#FFD25A 0%,#FFB703 100%)";
const FACE_INK = "#241A02";

export function OwnerFace({ owner, size = 88 }: { owner: PayLinkOwner | null; size?: number }) {
  const url = safeAvatarUrl(owner?.face?.avatarUrl);
  const [failed, setFailed] = useState(false);
  const badge = Math.round(size * 0.3);
  const ring = 3;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {url && !failed ? (
        // A signed link that lapses (they last an hour) falls back to the initials.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full font-extrabold tracking-[-0.5px]"
          style={{ background: FACE_GRADIENT, color: FACE_INK, fontSize: Math.round(size * 0.34) }}
        >
          {initialsFor(owner?.displayName, owner?.handle)}
        </span>
      )}
      <span
        aria-hidden
        className="absolute flex items-center justify-center overflow-hidden rounded-full bg-[#0D1820]"
        style={{ width: badge + ring * 2, height: badge + ring * 2, right: -ring - 1, bottom: -ring + 1 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.png" alt="" width={badge} height={badge} className="rounded-full" style={{ width: badge, height: badge }} />
      </span>
    </span>
  );
}

/* ── Flags ──────────────────────────────────────────────────────── */

let flagsPromise: Promise<Readonly<Record<string, string>>> | null = null;

/** The flag artwork, loaded once and only when a flag is drawn. */
export function useFlags(): Readonly<Record<string, string>> | null {
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

/** The app's Flag: a 3:2 flag cropped to a circle; the code on a chip when there is no country. */
export function Flag({ country, fallback, flags, size = 22 }: { country: string | null; fallback: string; flags: Readonly<Record<string, string>> | null; size?: number }) {
  const svg = country && flags ? flags[country] : undefined;
  return (
    <span className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10" style={{ width: size, height: size }} aria-hidden>
      {svg ? (
        <span
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 [&>svg]:h-full [&>svg]:w-full"
          style={{ width: Math.round(size * 1.5), height: size }}
          // Static, bundled artwork (@/lib/app/i18n/flags), never user input.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : country && !flags ? null : (
        <span className="text-[9px] font-extrabold text-amber">{fallback.slice(0, 3)}</span>
      )}
    </span>
  );
}

function Check() {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white">
      <Ion name="checkmark" size={14} className="text-black" />
    </span>
  );
}

function SheetRow({ children, selected, onClick, last }: { children: ReactNode; selected: boolean; onClick: () => void; last: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full min-w-0 items-center gap-3 px-[14px] py-[13px] text-start transition-colors hover:bg-white/[0.04] ${
        selected ? "bg-white/[0.06]" : ""
      } ${last ? "" : "border-b border-white/[0.06]"}`}
    >
      {children}
      {selected ? <Check /> : null}
    </button>
  );
}

const sheetCard = "overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.04]";

/* ── Language ───────────────────────────────────────────────────── */

export function LanguageButton() {
  const t = useT();
  const { locale } = usePayLocale();
  const flags = useFlags();
  const [open, setOpen] = useState(false);
  const info = PAY_LOCALES.find((l) => l.code === locale) ?? PAY_LOCALES[0];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("payPage.language")}
        dir="ltr"
        className="flex h-9 items-center gap-1.5 rounded-[18px] border border-white/[0.12] bg-white/10 pe-2.5 ps-1.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14]"
      >
        <Flag country={info.country} fallback={info.code} flags={flags} size={24} />
        <span>{info.code.split("-")[0].toUpperCase()}</span>
        <Ion name="chevron-down" size={12} className="text-white/60" />
      </button>
      {open ? <LanguageSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LanguageSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { locale, choose } = usePayLocale();
  const flags = useFlags();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = PAY_LOCALES.filter((l) => !q || l.native.toLowerCase().includes(q) || l.english.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  const pick = (code: PayLocale) => {
    choose(code);
    onClose();
  };
  return (
    <Modal onClose={onClose} title={t("payPage.language")} size="sm">
      <SearchField value={query} onChange={setQuery} placeholder={t("payPage.searchLanguage")} />
      <div className={sheetCard}>
        {items.length ? (
          items.map((l, i) => (
            <SheetRow key={l.code} selected={l.code === locale} onClick={() => pick(l.code)} last={i === items.length - 1}>
              <Flag country={l.country} fallback={l.code} flags={flags} size={30} />
              {/* Plain English for every language (Alex, 2026-09-27): one line,
                  left to right, so Arabic and Urdu line up with the rest.
                  The search still finds a language by its own name. */}
              <span className="block min-w-0 flex-1 truncate text-[16px] font-bold text-white" dir="ltr">
                {l.english}
              </span>
            </SheetRow>
          ))
        ) : (
          <p className="py-8 text-center text-[14px] text-[#9FB7C2]">{t("payPage.noResults")}</p>
        )}
      </div>
    </Modal>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="flex h-11 shrink-0 items-center gap-2.5 rounded-[22px] bg-white/[0.94] px-4">
      <Ion name="search" size={17} className="shrink-0 text-[rgba(7,12,18,0.55)]" />
      <input
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[#070C12] outline-none placeholder:text-[rgba(7,12,18,0.45)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label={t("common.clearSearch")}
          className="shrink-0 text-[rgba(7,12,18,0.55)]"
        >
          <Ion name="close-circle" size={17} />
        </button>
      ) : null}
    </label>
  );
}

/* ── Currency ───────────────────────────────────────────────────── */

const ENGLISH_NAME: Record<string, string> = Object.fromEntries(CURRENCIES.map(([c, n]) => [c, n]));

function useCurrencyName(): (code: string) => string {
  const appLocale = useLocale();
  // An extra page language (Russian, Bengali…) names currencies in itself too.
  const locale = getPrefs().intl ?? appLocale;
  return useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([locale], { type: "currency" });
    } catch {
      dn = null;
    }
    return (code: string) => {
      const fallback = ENGLISH_NAME[code] ?? code;
      if (!dn) return fallback;
      try {
        const n = dn.of(code);
        return n && n !== code ? n.charAt(0).toLocaleUpperCase(locale) + n.slice(1) : fallback;
      } catch {
        return fallback;
      }
    };
  }, [locale]);
}

/** The pill under the amount: flag, code and chevron. Always a choice (USD or EUR). */
export function CurrencyPill({ currency, choices, onChange }: { currency: string; choices: readonly string[]; onChange: (c: string) => void }) {
  const t = useT();
  const flags = useFlags();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("payPage.chooseCurrency")}
        dir="ltr"
        className="flex h-9 items-center gap-2 rounded-[18px] bg-white/10 pe-3 ps-1.5 text-[15px] font-extrabold text-white transition-colors hover:bg-white/[0.14]"
      >
        <Flag country={CURRENCY_COUNTRY[currency] ?? null} fallback={currency} flags={flags} size={22} />
        <span>{currency}</span>
        <Ion name="chevron-down" size={13} className="text-[#AFC9D6]" />
      </button>
      {open ? (
        <CurrencySheet
          current={currency}
          choices={choices}
          onClose={() => setOpen(false)}
          onPick={(c) => {
            onChange(c);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function CurrencySheet({ current, choices, onClose, onPick }: { current: string; choices: readonly string[]; onClose: () => void; onPick: (c: string) => void }) {
  const t = useT();
  const flags = useFlags();
  const nameOf = useCurrencyName();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = choices
    .map((code) => ({ code, name: nameOf(code), english: ENGLISH_NAME[code] ?? code }))
    .filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.english.toLowerCase().includes(q));
  return (
    <Modal onClose={onClose} title={t("payPage.currency")} size="sm">
      {choices.length > 6 ? <SearchField value={query} onChange={setQuery} placeholder={t("payPage.searchCurrency")} /> : null}
      <div className={sheetCard}>
        {items.length ? (
          items.map((c, i) => (
            <SheetRow key={c.code} selected={c.code === current} onClick={() => onPick(c.code)} last={i === items.length - 1}>
              <Flag country={CURRENCY_COUNTRY[c.code] ?? null} fallback={c.code} flags={flags} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-white">{c.code}</span>
                <span className="block truncate text-[12.5px] text-white/65">{c.name}</span>
              </span>
            </SheetRow>
          ))
        ) : (
          <p className="py-8 text-center text-[14px] text-[#9FB7C2]">{t("payPage.noResults")}</p>
        )}
      </div>
    </Modal>
  );
}

/* ── Store badges ───────────────────────────────────────────────── */

/** Google Play's triangle in one colour: the badge carries no red. */
function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false" fill="currentColor">
      <path d="M4.2 2.1c-.3.2-.5.6-.5 1.1v17.6c0 .5.2.9.5 1.1L14 12 4.2 2.1Zm10.9 11-2.1-2.1 2.1-2.1 3.6 2c1.3.7 1.3 1.8 0 2.4l-3.6 2-.1-.1Zm-1.3 1.1L4.9 22.8c.4.2.9.2 1.4-.1l10.6-6-3.1-2.5Zm0-4.4 3.1-2.5-10.6-6c-.5-.3-1-.3-1.4-.1l8.9 8.6Z" />
    </svg>
  );
}

export function StoreBadges() {
  const t = useT();
  const badge =
    "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[10px] border border-white/25 bg-black px-3 text-start text-white transition-colors hover:bg-[#111]";
  return (
    <div className="flex w-full gap-2.5">
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={badge}>
        <Ion name="logo-apple" size={22} className="shrink-0" />
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[9.5px] font-medium">{t("payPage.downloadOn")}</span>
          <span className="block truncate text-[16px] font-bold tracking-[-0.2px]">App Store</span>
        </span>
      </a>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={badge}>
        <PlayMark />
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[9.5px] font-medium uppercase">{t("payPage.getItOn")}</span>
          <span className="block truncate text-[16px] font-bold tracking-[-0.2px]">Google Play</span>
        </span>
      </a>
    </div>
  );
}

/* ── The HOLD sheet, on a computer ──────────────────────────────── */

export function HoldSheet({ pageUrl, onClose }: { pageUrl: string; onClose: () => void }) {
  const t = useT();
  return (
    <Modal onClose={onClose} title={t("payPage.holdTitle")} size="sm">
      <div className="flex flex-col items-center gap-4 pb-1 pt-1 text-center">
        <div className="w-full max-w-[220px] rounded-[20px] bg-white p-3">
          <QrCode text={pageUrl} title={t("payPage.holdTitle")} className="h-auto w-full" />
        </div>
        <p className="max-w-[340px] text-[14px] leading-[20px] text-[#CFE3EC]">{t("payPage.holdScan")}</p>
        <p className="text-[13px] font-strong text-[#9FB7C2]">{t("payPage.holdGetApp")}</p>
        <StoreBadges />
      </div>
    </Modal>
  );
}
