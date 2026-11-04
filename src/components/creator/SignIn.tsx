/**
 * The ways into HOLD on the web: Apple, Google, or a code sent to an email.
 *
 * WHY THREE WAYS AND ONE ACCOUNT
 *
 * Apple and Google are one tap for most people; the email code is for
 * everybody else. All three end in the same Supabase user when the email is
 * the same (Supabase links identities by verified email), so a creator who
 * started with a code and later presses "Continue with Google" is in the same
 * account. On an Apple device Apple goes first; elsewhere Google does.
 *
 * WHY A CODE AND NOT A PASSWORD
 *
 * There is no password to have. `signInWithOtp` creates the account and signs
 * in with the same six digits, so "sign in" and "sign up" are one screen.
 * Supabase's email may carry a magic link or the digits; both work (the link
 * is caught by `detectSessionInUrl`, see lib/creator/session).
 *
 * The full-screen door (welcome, welcome back) is components/app/front/Door;
 * `SignIn` here is the compact form a card can hold (a team invitation).
 */

"use client";

import { useEffect, useState } from "react";

import { btnGhost, btnLink, btnPrimary, inputCls, Warn } from "@/components/app/front/kit";
import { t as tNow } from "@/lib/app/i18n";
import { Rich, useT } from "@/lib/app/i18n/react";
import { continueWith, enabledProviders, onAppleDevice, type OAuthProvider } from "@/lib/auth/providers";
import { notePendingMethod } from "@/lib/auth/remember";
import { sendSignInCode, verifySignInCode } from "@/lib/creator/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The providers this project has on, Apple first on an Apple device; null while asking. */
export function useProviders(): OAuthProvider[] | null {
  const [providers, setProviders] = useState<OAuthProvider[] | null>(null);
  useEffect(() => {
    let alive = true;
    void enabledProviders().then((on) => {
      if (!alive) return;
      const order: OAuthProvider[] = onAppleDevice() ? ["apple", "google"] : ["google", "apple"];
      setProviders(order.filter((p) => on[p]));
    });
    return () => {
      alive = false;
    };
  }, []);
  return providers;
}

export const PROVIDER_NAME: Record<OAuthProvider, string> = { apple: "Apple", google: "Google" };

/** Leave for the provider; the promise only settles if leaving failed. */
export async function goWith(p: OAuthProvider): Promise<string | null> {
  try {
    await continueWith(p);
    return null;
  } catch {
    return tNow("front.signIn.providerFailed", { provider: PROVIDER_NAME[p] });
  }
}

export function SignIn({ configured }: { configured: boolean }) {
  const t = useT();
  const providers = useProviders();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!configured) return <NotConfigured />;

  const go = async (p: OAuthProvider) => {
    setBusy(p);
    setNotice(null);
    const failed = await goWith(p);
    if (failed) {
      setNotice(failed);
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h4 font-light text-text">{t("front.signIn.title")}</h1>
        <p className="mt-1 text-small text-[#9FB7C2]">{t("front.signIn.newHere")}</p>
      </div>

      {providers === null || providers.length > 0 ? (
        <>
          {/* Held at their height while the project's settings are read, so the form does not jump. */}
          <div className="flex min-h-[98px] flex-col gap-2.5">
            {(providers ?? []).map((p) => (
              <button key={p} type="button" className={`${btnGhost} w-full`} disabled={busy !== null} onClick={() => void go(p)}>
                <ProviderLogo provider={p} />
                {busy === p ? t("front.door.opening") : t("front.door.continueWithProvider", { provider: PROVIDER_NAME[p] })}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-tiny text-[#6B8A99]" aria-hidden>
            <span className="h-px flex-1 bg-white/10" />
            {t("front.signIn.orEmail")}
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      ) : null}

      {notice ? <Warn>{notice}</Warn> : null}
      <EmailCode />
    </div>
  );
}

export function NotConfigured() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h4 font-light text-text">{t("front.signIn.signIn")}</h1>
      <Warn>{t("front.callback.notSetUp")}</Warn>
    </div>
  );
}

/**
 * Email, then the six digits. `initialEmail` fills the address in; with
 * `sendNow` the code is sent as this opens (the welcome-back screen, where
 * the person already said "email me a code").
 */
export function EmailCode({ initialEmail = "", sendNow = false }: { initialEmail?: string; sendNow?: boolean }) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(to = email) {
    if (!EMAIL_RE.test(to.trim())) {
      setNotice(tNow("front.email.invalid"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await sendSignInCode(to);
      setSent(true);
    } catch (err) {
      // Supabase's own message is the useful one here: it is the only party
      // that knows whether this is a bad address, a blocked domain or a wait.
      setNotice(err instanceof Error ? err.message : tNow("front.email.sendFailed"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (sendNow && initialEmail) void send(initialEmail);
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    setBusy(true);
    setNotice(null);
    try {
      notePendingMethod("email");
      await verifySignInCode(email, code);
      // Nothing to do on success: the session change re-renders the product.
    } catch (err) {
      setNotice(
        err instanceof Error && /expired|invalid/i.test(err.message)
          ? tNow("front.email.codeExpired")
          : tNow("front.email.verifyFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-small text-[#9FB7C2]">
          <Rich k="front.signIn.sentTo" vars={{ email: email.trim() }} tags={{ b: (c) => <span className="break-all text-text">{c}</span> }} />
        </p>
        <input
          // `one-time-code` is what makes a phone offer the digits from the
          // notification instead of making them switch to the mail app.
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          placeholder={t("front.email.codePlaceholder")}
          aria-label={t("front.email.codeLabel")}
          className={inputCls}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className={btnPrimary} disabled={busy || code.trim().length < 6}>
          {busy ? t("front.signIn.checking") : t("front.signIn.signIn")}
        </button>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={btnLink}
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
              setNotice(null);
            }}
          >
            {t("front.signIn.anotherEmail")}
          </button>
          <button type="button" className={btnLink} disabled={busy} onClick={() => void send()}>
            {t("front.signIn.newCode")}
          </button>
        </div>
        {notice ? <Warn>{notice}</Warn> : null}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex flex-col gap-2.5"
    >
      <input
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        aria-label={t("front.door.email")}
        className={inputCls}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
      />
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? t("front.signIn.sending") : t("front.door.emailMeACode")}
      </button>
      {notice ? <Warn>{notice}</Warn> : null}
    </form>
  );
}

export function ProviderLogo({ provider, className = "h-4 w-4" }: { provider: OAuthProvider | "email"; className?: string }) {
  if (provider === "apple") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M16.37 12.64c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z" />
      </svg>
    );
  }
  if (provider === "google") {
    // Monochrome on purpose: the house has no red, and Google's mark in one colour is an allowed form.
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
