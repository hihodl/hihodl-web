/**
 * Sign in, with a code sent to an email address.
 *
 * WHY A CODE AND NOT A PASSWORD
 *
 * There is no password to have: most creators reading this have no HOLD
 * account at all, and the point of this console is that they never had to make
 * one in an app that is not on their phone's store. `signInWithOtp` creates
 * the account and signs them in with the same six digits, so "sign in" and
 * "sign up" are one screen and one step.
 *
 * WHY THE FORM ALSO SURVIVES THE LINK
 *
 * Supabase's default email carries a magic link; a template with `{{ .Token }}`
 * carries six digits. We do not control which this project sends, so both work:
 * the form takes the digits, and `detectSessionInUrl` (see lib/creator/session)
 * catches a creator who clicked the link and came back here instead.
 */

"use client";

import { useState } from "react";

import { btnPrimary, btnSmallSecondary, input } from "@/components/ad-space/ui";
import { creatorDemoEnabled, DEMO_PEOPLE, demoState } from "@/lib/creator/demo";
import { sendSignInCode, verifySignInCode } from "@/lib/creator/session";

import { Notice } from "./parts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignIn({ configured }: { configured: boolean }) {
  // Local demo mode signs straight in on the first click; the box is filled so that click is all it takes.
  const [email, setEmail] = useState(() => (creatorDemoEnabled() ? DEMO_PEOPLE[demoState().role].email : ""));
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h4 font-light text-text">Sign in</h1>
        <Notice>Sign-in is not set up on this deployment.</Notice>
      </div>
    );
  }

  async function send() {
    if (!EMAIL_RE.test(email.trim())) {
      setNotice("That does not look like an email address. Check it and try again.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await sendSignInCode(email);
      setSent(true);
    } catch (err) {
      // Supabase's own message is the useful one here: it is the only party
      // that knows whether this is a bad address, a blocked domain or a wait.
      setNotice(err instanceof Error ? err.message : "We could not send that code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setNotice(null);
    try {
      await verifySignInCode(email, code);
      // Nothing to do on success: the session change re-renders the console.
    } catch (err) {
      setNotice(
        err instanceof Error && /expired|invalid/i.test(err.message)
          ? "That code has expired or is not the one we sent. Ask for a new one."
          : "We could not check that code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-h4 font-light text-text">Sign in</h1>
      <p className="mt-1 text-small text-text-muted">Email code. No app, no wallet.</p>

      {!sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          className="mt-6 flex flex-col gap-4"
        >
          <p className="text-small text-text-muted">
            Code sent to <span className="break-all text-text">{email.trim()}</span>
          </p>
          <div className="flex flex-col gap-3">
            <input
              // `one-time-code` is what makes a phone offer the digits from the
              // notification instead of making them switch to the mail app.
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="6-digit code"
              className={input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className={btnPrimary} disabled={busy || code.trim().length < 6}>
              {busy ? "Checking…" : "Sign in"}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={btnSmallSecondary}
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                setNotice(null);
              }}
            >
              Other email
            </button>
            <button type="button" className={btnSmallSecondary} disabled={busy} onClick={() => void send()}>
              Resend
            </button>
          </div>
        </form>
      )}

      {notice ? (
        <div className="mt-4">
          <Notice>{notice}</Notice>
        </div>
      ) : null}
    </div>
  );
}
