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

const NOTE: Record<UndoNote, string> = {
  again: "That did not go through. Try again.",
  later: "Too many tries. Try again later.",
};

export function UndoEmail() {
  const token = useRef<string | null | undefined>(undefined);
  const [view, setView] = useState<UndoView>({ kind: "loading" });

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

  return (
    <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-live="polite">
      <Body view={view} onUndo={undo} onRetry={check} />
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
function Note({ note }: { note: UndoNote }) {
  return (
    <p role="status" className="rounded-input border border-amber/40 bg-amber/10 px-4 py-3 text-small text-sp-amber">
      {NOTE[note]}
    </p>
  );
}

function Support() {
  return (
    <Line>
      Contact{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-text underline underline-offset-4 hover:text-amber">
        {SUPPORT_EMAIL}
      </a>
    </Line>
  );
}

function Body({ view, onUndo, onRetry }: { view: UndoView; onUndo: () => void; onRetry: () => void }) {
  switch (view.kind) {
    case "loading":
      return (
        <>
          <p className={`${eyebrow} text-text-faint`}>Login email</p>
          <Line>Checking the link…</Line>
        </>
      );
    case "ask":
      return (
        <>
          <Title>Undo the login email change?</Title>
          {view.masked ? <Line>Your login email was changed to {view.masked}.</Line> : null}
          {view.note ? <Note note={view.note} /> : null}
          <div>
            <button type="button" className={btnPrimary} onClick={onUndo} disabled={view.busy} aria-busy={view.busy}>
              {view.busy ? "Undoing…" : "Undo it"}
            </button>
          </div>
        </>
      );
    case "unchecked":
      return (
        <>
          <Title>Undo the login email change?</Title>
          <Note note={view.note} />
          {view.note === "again" ? (
            <div>
              <button type="button" className={btnPrimary} onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : null}
        </>
      );
    case "done":
      return (
        <>
          <Title>Change undone. Every device was signed out.</Title>
          <Line>Sign in again with this address in HOLD.</Line>
        </>
      );
    case "already":
      return <Title>This change was already undone.</Title>;
    case "expired":
      return (
        <>
          <Title>This link expired.</Title>
          <Support />
        </>
      );
    case "taken":
      return (
        <>
          <Title>This change can&rsquo;t be undone here.</Title>
          <Support />
        </>
      );
    case "invalid":
      return <Title>This link is not valid.</Title>;
  }
}
