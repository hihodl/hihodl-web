"use client";

/**
 * The page the OLD address lands on after a login email change
 * (lib/account/undo-email). Opening it only asks; "Undo it" undoes.
 *
 * The token is read once from `?t=`, kept in this component's memory, and
 * dropped from the address bar straight away, so it is not left in the
 * history, a bookmark, a screenshot or a copied URL. It is also kept in this
 * tab's sessionStorage (gone when the tab closes, never in the URL) so that a
 * reload still works; it is removed once the undo is done.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { btnPrimary, card, eyebrow } from "@/components/ad-space/ui";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";
import {
  checkUndo,
  tokenFrom,
  undoEmailChange,
  viewFromCheck,
  viewFromCheckError,
  viewFromUndoError,
  type UndoNote,
  type UndoView,
} from "@/lib/account/undo-email";
import { UNDO_COPY, pickUndoLocale, type UndoKey, type UndoLocale } from "@/lib/account/undo-email-copy";

const TAB_KEY = "hold.undoEmail.token";

function rememberedToken(): string | null {
  try {
    return window.sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

function rememberToken(t: string | null): void {
  try {
    if (t) window.sessionStorage.setItem(TAB_KEY, t);
    else window.sessionStorage.removeItem(TAB_KEY);
  } catch {
    /* a reload then says the link is not valid; the email's link still works */
  }
}

const NOTE: Record<UndoNote, UndoKey> = {
  again: "noteAgain",
  later: "noteLater",
};

type T = (k: UndoKey, vars?: Record<string, string>) => string;

function translator(l: UndoLocale): T {
  return (k, vars = {}) => UNDO_COPY[l][k].replace(/\{(\w+)\}/g, (m, n: string) => vars[n] ?? m);
}

export function UndoEmail() {
  const token = useRef<string | null | undefined>(undefined);
  const [view, setView] = useState<UndoView>({ kind: "loading" });
  // The account's language from the email's `?l=`, else the browser's. Null
  // until read on the client, so the page is never drawn in English first.
  const [locale, setLocale] = useState<UndoLocale | null>(null);

  const check = useCallback(async () => {
    const t = token.current;
    if (!t) {
      setView({ kind: "invalid" });
      return;
    }
    setView({ kind: "loading" });
    try {
      setView(viewFromCheck(await checkUndo(t)));
    } catch (e) {
      setView(viewFromCheckError(e));
    }
  }, []);

  useEffect(() => {
    // Read once: a second run (React's dev double effect) finds the query gone.
    if (token.current !== undefined) return;
    const fromUrl = tokenFrom(window.location.search);
    setLocale(pickUndoLocale(window.location.search, navigator.languages ?? [navigator.language]));
    token.current = fromUrl ?? rememberedToken();
    if (fromUrl) rememberToken(fromUrl);
    try {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch {
      /* the address keeps the query; nothing else changes */
    }
    void check();
  }, [check]);

  const undo = async () => {
    const t = token.current;
    if (!t || view.kind !== "ask" || view.busy) return;
    const from = view;
    setView({ ...from, busy: true, note: null });
    try {
      await undoEmailChange(t);
      token.current = null;
      rememberToken(null);
      setView({ kind: "done" });
    } catch (e) {
      setView(viewFromUndoError(e, from));
    }
  };

  if (!locale) return <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-busy="true" />;
  const rtl = locale === "ar-AE";
  return (
    <section
      className={`${card} flex flex-col gap-4 p-5 md:p-6`}
      aria-live="polite"
      lang={rtl ? "ar" : locale}
      dir={rtl ? "rtl" : "ltr"}
    >
      <Body view={view} onUndo={undo} onRetry={check} t={translator(locale)} />
    </section>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-h3 font-light text-text">{children}</h1>;
}

function Line({ children }: { children: ReactNode }) {
  return <p className="break-words text-body text-text-muted [overflow-wrap:anywhere]">{children}</p>;
}

/** Attention is the amber tint, never red. */
function Note({ note, t }: { note: UndoNote; t: T }) {
  return (
    <p role="status" className="rounded-input border border-amber/40 bg-amber/10 px-4 py-3 text-small text-sp-amber">
      {t(NOTE[note])}
    </p>
  );
}

function Support({ t }: { t: T }) {
  return (
    <Line>
      {t("contact")}{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-text underline underline-offset-4 hover:text-amber">
        {SUPPORT_EMAIL}
      </a>
    </Line>
  );
}

function Body({ view, onUndo, onRetry, t }: { view: UndoView; onUndo: () => void; onRetry: () => void; t: T }) {
  switch (view.kind) {
    case "loading":
      return (
        <>
          <p className={`${eyebrow} text-text-faint`}>{t("eyebrow")}</p>
          <Line>{t("checking")}</Line>
        </>
      );
    case "ask":
      return (
        <>
          <Title>{t("askTitle")}</Title>
          {view.masked ? <Line>{t("changedTo", { email: view.masked })}</Line> : null}
          {view.note ? <Note note={view.note} t={t} /> : null}
          <div>
            <button type="button" className={btnPrimary} onClick={onUndo} disabled={view.busy} aria-busy={view.busy}>
              {view.busy ? t("undoing") : t("undoIt")}
            </button>
          </div>
        </>
      );
    case "unchecked":
      return (
        <>
          <Title>{t("askTitle")}</Title>
          <Note note={view.note} t={t} />
          {view.note === "again" ? (
            <div>
              <button type="button" className={btnPrimary} onClick={onRetry}>
                {t("tryAgain")}
              </button>
            </div>
          ) : null}
        </>
      );
    case "done":
      return (
        <>
          <Title>{t("doneTitle")}</Title>
          <Line>{t("doneLine")}</Line>
        </>
      );
    case "already":
      return <Title>{t("already")}</Title>;
    case "expired":
      return (
        <>
          <Title>{t("expired")}</Title>
          <Support t={t} />
        </>
      );
    case "taken":
      return (
        <>
          <Title>{t("taken")}</Title>
          <Support t={t} />
        </>
      );
    case "invalid":
      return <Title>{t("invalid")}</Title>;
  }
}
