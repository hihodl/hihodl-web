"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Ion } from "@/components/app/ion";
import { Flag, LanguageSheet, useFlags } from "@/components/pay-links/pay-parts";
import { LOCALES, applyLocale, isLocale, type LocaleCode } from "@/lib/app/i18n";
import { chooseLocale, useLocale, useT } from "@/lib/app/i18n/react";

/**
 * The language of a public page (a space, a creator, an event, a guest's
 * conversation), and the switch in its header.
 *
 * The server already drew its own parts in `serverLocale`: the viewer's
 * choice on these pages (the `hold.locale` cookie) or, with none, their
 * browser's Accept-Language (lib/app/i18n/server.ts). Here the browser
 * follows: the client parts load the same words. A choice this browser made
 * before (the app's own `hold.locale` in storage) wins over the browser's
 * language, and is handed to the server with a refresh.
 *
 * Choosing writes both (storage for the client, the cookie for the server)
 * and refreshes the server parts in place: nothing reloads, and what was
 * typed (a reply, a question) stays where it was.
 */

const COOKIE = "hold.locale";
const STORAGE = "hold.locale";
const YEAR = 60 * 60 * 24 * 365;

function writeCookie(code: LocaleCode): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
  } catch {
    /* cookies refused: this page still switches, the next one starts from the browser's language */
  }
}

function savedChoice(): LocaleCode | null {
  try {
    const v = window.localStorage.getItem(STORAGE);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export function PublicLanguage({ serverLocale, chosen }: { serverLocale: LocaleCode; chosen: boolean }) {
  const t = useT();
  const router = useRouter();
  const locale = useLocale();
  const flags = useFlags();
  const [open, setOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = chosen ? null : savedChoice();
    if (saved && saved !== serverLocale) {
      // Chosen here before, in the app or on another page: the server learns it.
      writeCookie(saved);
      void applyLocale(saved);
      router.refresh();
      return;
    }
    void applyLocale(serverLocale);
  }, [chosen, serverLocale, router]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const pick = (code: LocaleCode) => {
    writeCookie(code);
    void chooseLocale(code);
    router.refresh();
  };

  const info = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("payPage.language")}
        aria-haspopup="dialog"
        dir="ltr"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-[18px] border border-sp-ink/[0.14] bg-sp-ink/[0.08] pe-2.5 ps-1.5 text-[13px] font-semibold text-sp-ink transition-colors duration-180 hover:bg-sp-ink/[0.14]"
      >
        <Flag country={info.country} fallback={info.code} flags={flags} size={24} />
        <span>{info.code.split("-")[0].toUpperCase()}</span>
        <Ion name="chevron-down" size={12} className="text-sp-ink/60" />
      </button>
      {open ? <LanguageSheet locales={LOCALES} current={locale} onPick={pick} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
