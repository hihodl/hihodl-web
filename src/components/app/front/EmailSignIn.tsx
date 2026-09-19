"use client";

/**
 * "Email" from the Continue with sheet: the app's email screen
 * (hihodl-wallet/app/onboarding/email.tsx), full screen, one step.
 *
 *   Email       "Continue with\nemail", the mail icon, "you@email.com",
 *               Continue. The app's next step is a password; the web signs in
 *               with a code, so the hint names the code.
 *   The code    the app's "Check your inbox" view ("Verify your\nemail", the
 *               green gradient, the mail icon in its circle, "Resend email",
 *               "Change email"), with the six digits typed here where the app
 *               waits for a link to be tapped.
 *
 * Contract unchanged: `sendSignInCode` / `verifySignInCode` (Supabase OTP),
 * `notePendingMethod("email")` so the welcome back knows the way in.
 */

import { useEffect, useState } from "react";

import { notePendingMethod } from "@/lib/auth/remember";
import { sendSignInCode, verifySignInCode } from "@/lib/creator/session";

import {
  ActionButton,
  Cta,
  ErrorBanner,
  InfoSheet,
  InputRow,
  inputFieldCls,
  Ion,
  NextHint,
  SkipButton,
  StepScreen,
  StepTitle,
} from "./step";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ACCENT = "#00C2FF";
const EMAIL_INFO = "Your email is used to create your HOLD account and for account recovery.";

export function EmailSignIn({
  initialEmail = "",
  sendNow = false,
  onClose,
}: {
  initialEmail?: string;
  /** The welcome back's "Email me a code": send as this opens, and open on the code. */
  sendNow?: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(to = email) {
    if (!EMAIL_RE.test(to.trim())) {
      setNotice("That does not look like an email address. Check it and try again.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await sendSignInCode(to);
      setSent(true);
      setCooldown(30);
    } catch (err) {
      // Supabase's own message is the useful one: only it knows whether this is a bad address, a blocked domain or a wait.
      setNotice(err instanceof Error ? err.message : "We could not send that code. Try again.");
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
          ? "That code has expired or is not the one we sent. Ask for a new one."
          : "We could not check that code. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const changeEmail = () => {
    setSent(false);
    setCode("");
    setNotice(null);
  };

  if (sent || (sendNow && busy)) {
    return (
      <StepScreen tone="ready" title={"Verify your\nemail"} onClose={changeEmail} closeIcon="back" closeLabel="Change email">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && code.trim().length >= 6) void verify();
          }}
        >
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[32px] border border-[rgba(52,211,153,0.15)] bg-[rgba(52,211,153,0.08)] text-[#34D399]">
            <Ion name="mail-unread-outline" size={32} />
          </span>
          <h2 className="mb-2 text-[20px] font-bold tracking-[-0.3px] text-white">Check your inbox</h2>
          <p className="mb-4 text-[15px] font-medium leading-[22px] text-white/60">
            We sent a code to <span className="break-all font-bold text-white">{email.trim()}</span>.
          </p>
          {notice ? <ErrorBanner onDismiss={() => setNotice(null)}>{notice}</ErrorBanner> : null}
          <InputRow prefix={<Ion name="keypad-outline" size={18} className="mr-2 shrink-0 text-[#34D399]" />}>
            <input
              // `one-time-code` makes a phone offer the digits from the notification.
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              placeholder="6-digit code"
              aria-label="Code from the email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
              className={`${inputFieldCls} tracking-[0.12em]`}
            />
          </InputRow>
          <div className="mt-5">
            <ActionButton type="submit" title={busy ? "Checking..." : "Continue"} disabled={busy || code.trim().length < 6} />
          </div>
          <div className="mt-1 flex flex-col">
            <SkipButton label={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"} disabled={busy || cooldown > 0} onClick={() => void send()} />
            <SkipButton label="Change email" disabled={busy} onClick={changeEmail} />
          </div>
        </form>
      </StepScreen>
    );
  }

  return (
    <StepScreen tone="username" title={"Continue with\nemail"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && email.trim()) void send();
        }}
      >
        <StepTitle icon="mail-outline" title="Email" accent={EMAIL_ACCENT} onInfo={() => setInfo(true)} />
        {notice ? <ErrorBanner onDismiss={() => setNotice(null)}>{notice}</ErrorBanner> : null}
        <InputRow prefix={<Ion name="mail-outline" size={18} className="mr-2 shrink-0" style={{ color: EMAIL_ACCENT }} />}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            placeholder="you@email.com"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className={inputFieldCls}
          />
        </InputRow>
        <NextHint icon="keypad-outline" title="Code" />
        <Cta>
          <ActionButton type="submit" title={busy ? "Sending..." : "Continue"} disabled={busy || !EMAIL_RE.test(email.trim())} />
        </Cta>
      </form>
      {info ? <InfoSheet title="Email" body={EMAIL_INFO} onClose={() => setInfo(false)} /> : null}
    </StepScreen>
  );
}
