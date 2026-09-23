"use client";

/**
 * HOLD's door on the web: the app's welcome screen for somebody new, and its
 * welcome back for somebody this browser has seen.
 *
 * WELCOME is hihodl-wallet/app/auth/choose.tsx: the HOLD wordmark in the
 * middle of the Benefits ground, "Your money, your rules" between two amber
 * hairlines, one amber "Let's go", and behind it a "Continue with" sheet of
 * Apple, Google and Email rows. The app's Passkey row and Import wallet are
 * not here: the web signs in with a passkey nowhere yet, and a wallet is
 * imported in the app.
 *
 * WELCOME BACK is the app's lock screen (app/auth/lock.tsx) without the PIN:
 * "Welcome Back, {name}" over the round initial, and one button that is the
 * way they came in last time (lib/auth/remember). Everything else is one tap
 * away, and "Not you?" forgets this browser's guess.
 *
 * EMAIL is the app's email screen (app/onboarding/email.tsx), full screen:
 * ./EmailSignIn. Map: documentation/web-copies-the-app-onboarding.md.
 */

import { useEffect, useState } from "react";

import type { OAuthProvider } from "@/lib/auth/providers";
import { forgetRemembered, readFace, readRemembered, type Remembered, type RememberedFace } from "@/lib/auth/remember";
import { takeSignedOutElsewhereNote } from "@/lib/app/sessions";
import { noteTermsShown, TERMS_VERSION } from "@/lib/app/terms";

import { goWith, NotConfigured, PROVIDER_NAME, ProviderLogo, useProviders } from "@/components/creator/SignIn";

import { EmailSignIn } from "./EmailSignIn";
import { btnLink, DEFAULT_AVATAR_EMOJI, EmojiAvatar, HoldMark, Warn } from "./kit";

type Sheet = null | "choose" | "email";

/** The app's own sign-in marks (hihodl-wallet/assets/icons), Google's in one colour: the house has no red. */
function Mark({ provider }: { provider: OAuthProvider | "email" }) {
  if (provider === "google") return <ProviderLogo provider="google" className="h-[26px] w-[26px] shrink-0 text-white" />;
  const src = provider === "apple" ? "/app/apple.png" : "/app/email.png";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden className={provider === "apple" ? "h-[26px] w-[22px] shrink-0 object-contain" : "h-[26px] w-[26px] shrink-0 object-contain"} />;
}

export function Door({ configured }: { configured: boolean }) {
  // Read after mount: the server draws the first-time welcome, and a stored
  // guess must not make the two paints differ.
  const [known, setKnown] = useState<Remembered | null | undefined>(undefined);
  useEffect(() => setKnown(readRemembered()), []);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [emailNow, setEmailNow] = useState(false);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Read after mount, like `known`: set by the shell when this browser's
  // session was removed from another device (lib/app/sessions).
  useEffect(() => {
    if (takeSignedOutElsewhereNote()) setNotice("This browser was signed out from another device");
  }, []);
  const providers = useProviders();

  if (!configured) {
    return (
      <Stage>
        <div className="w-full max-w-[400px]">
          <NotConfigured />
        </div>
      </Stage>
    );
  }

  const go = async (p: OAuthProvider) => {
    setBusy(p);
    setNotice(null);
    const failed = await goWith(p);
    if (failed) {
      setNotice(failed);
      setBusy(null);
    }
  };

  const back = known && known.method !== "email" && providers !== null && !providers.includes(known.method) ? null : known;

  // The app opens email as its own screen, not inside the sheet.
  if (sheet === "email") {
    return (
      <EmailSignIn
        initialEmail={emailNow ? (back?.email ?? "") : (known?.email ?? "")}
        sendNow={emailNow}
        onClose={() => {
          setSheet(emailNow ? null : "choose");
          setEmailNow(false);
        }}
      />
    );
  }

  return (
    <Stage>
      {back ? (
        <WelcomeBack
          known={back}
          busy={busy}
          onContinue={() => {
            if (back.method === "email") {
              setEmailNow(true);
              setSheet("email");
            } else void go(back.method);
          }}
          onOther={() => setSheet("choose")}
          onNotYou={() => {
            forgetRemembered();
            setKnown(null);
          }}
        />
      ) : (
        <Welcome onGo={() => setSheet("choose")} />
      )}

      {notice && !sheet ? (
        <div className="mt-4 w-full max-w-[400px]">
          <Warn>{notice}</Warn>
        </div>
      ) : null}

      {sheet === "choose" ? (
        <SheetPanel title="Continue with" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3">
            {(providers ?? []).map((p) => (
              <Row key={p} onClick={() => void go(p)} disabled={busy !== null}>
                <Mark provider={p} />
                {busy === p ? "Opening…" : PROVIDER_NAME[p]}
              </Row>
            ))}
            <Row onClick={() => setSheet("email")} disabled={busy !== null}>
              <Mark provider="email" />
              Email
            </Row>
            {notice ? <Warn>{notice}</Warn> : null}
            <Consent />
          </div>
        </SheetPanel>
      ) : null}
    </Stage>
  );
}

/**
 * Said where an account is made: every row in this sheet creates one for
 * somebody new. Recorded after the sign-in succeeds, with the version these
 * links point at (`POST /me/terms`, lib/app/terms `TERMS_VERSION`, sent from
 * lib/creator/session on SIGNED_IN). Not /verification/consent, which is the
 * KYC documents' own.
 * Absolute links: the product lives on app.hihodl.xyz, the documents on the
 * site, and a new tab keeps the sheet where it was.
 */
function Consent() {
  useEffect(() => noteTermsShown(TERMS_VERSION), []);
  const link = "text-white/80 underline underline-offset-2 hover:text-text";
  return (
    <p className="mt-1 px-2 text-center text-[12px] leading-[17px] text-white/60">
      By continuing you agree to the{" "}
      <a href="https://hihodl.xyz/terms" target="_blank" rel="noopener noreferrer" className={link}>
        Terms
      </a>{" "}
      and{" "}
      <a href="https://hihodl.xyz/privacy" target="_blank" rel="noopener noreferrer" className={link}>
        Privacy Policy
      </a>
      .
    </p>
  );
}

/** The whole screen, one column, nothing to scroll. */
function Stage({ children }: { children: React.ReactNode }) {
  return <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-10">{children}</div>;
}

function Welcome({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex min-h-[70dvh] w-full max-w-[400px] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center pb-10">
        <HoldMark className="h-12 w-auto sm:h-14" />
        <div className="mt-5 flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-amber/25" />
          {/* The app draws it at 40 % white; 60 % is the floor for small text here (4.5:1). */}
          <span className="text-[13px] font-medium tracking-[0.5px] text-white/60">Your money, your rules</span>
          <span className="h-px flex-1 bg-amber/25" />
        </div>
      </div>
      <button
        type="button"
        onClick={onGo}
        className="h-[58px] w-full rounded-[29px] bg-amber text-[17px] font-extrabold tracking-[-0.2px] text-[#0A1117] shadow-[0_6px_20px_rgba(255,183,3,0.2)] transition-colors hover:bg-amber-glow"
      >
        Let&apos;s go
      </button>
    </div>
  );
}

function WelcomeBack({
  known,
  busy,
  onContinue,
  onOther,
  onNotYou,
}: {
  known: Remembered;
  busy: OAuthProvider | null;
  onContinue: () => void;
  onOther: () => void;
  onNotYou: () => void;
}) {
  const name = known.name?.trim() || null;
  // Read after mount: localStorage is not there on the server.
  const [face, setFace] = useState<RememberedFace | null | undefined>(undefined);
  useEffect(() => setFace(readFace(known.email)), [known.email]);
  const [photoBroken, setPhotoBroken] = useState(false);
  const how = known.method === "email" ? "Email me a code" : `Continue with ${PROVIDER_NAME[known.method]}`;
  return (
    <div className="flex min-h-[70dvh] w-full max-w-[400px] flex-col">
      {/* app/auth/lock.tsx: the greeting on top, the photo under it; no wordmark. */}
      <div className="flex flex-1 flex-col items-center pb-10 pt-4 text-center">
        <h1 className="text-[24px] font-semibold text-text">{name ? `Welcome Back, ${name}` : "Welcome Back"}</h1>
        {/* A circle: 100 px with a radius of half of it, as the app draws it. */}
        {face?.photo && !photoBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face.photo}
            alt=""
            onError={() => setPhotoBroken(true)}
            className="mt-6 h-[100px] w-[100px] rounded-[50px] border-2 border-[rgba(236,240,244,0.55)] bg-black/[0.28] object-cover"
          />
        ) : (
          // No photo: the emoji they chose in the app, else the app's default.
          <span className="mt-6">
            <EmojiAvatar emoji={face === undefined ? null : face?.emoji || DEFAULT_AVATAR_EMOJI} size={100} ring />
          </span>
        )}
        {known.email ? <p className="mt-4 break-all text-small text-[#9FB7C2]">{known.email}</p> : null}
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={busy !== null}
        className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[29px] bg-amber text-[17px] font-extrabold tracking-[-0.2px] text-[#0A1117] shadow-[0_6px_20px_rgba(255,183,3,0.2)] transition-colors hover:bg-amber-glow disabled:opacity-60"
      >
        <ProviderLogo provider={known.method} className="h-5 w-5" />
        {busy ? "Opening…" : how}
      </button>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" className={btnLink} onClick={onOther}>
          Other ways to sign in
        </button>
        <span className="text-white/20" aria-hidden>
          ·
        </span>
        <button type="button" className={btnLink} onClick={onNotYou}>
          Not you?
        </button>
      </div>
    </div>
  );
}

/** The app's bottom sheet: pinned to the foot on a phone, a card over the stage on a wide screen. */
function SheetPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#030b13]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-t-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(15,53,85,0.97),rgba(10,25,41,0.98))] px-5 pb-8 pt-3 shadow-[0_-20px_40px_rgba(0,0,0,0.35)] sm:rounded-[24px] sm:pb-6">
        <span className="mx-auto block h-1 w-10 rounded-[2px] bg-white/[0.22] sm:hidden" aria-hidden />
        <div className="relative mt-4 flex items-center justify-center">
          <h2 className="text-[18px] font-black tracking-[-0.5px] text-text">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-[16px] bg-white/[0.08] text-[#9FB7C2] hover:text-text"
          >
            ×
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Row({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center gap-3.5 rounded-[16px] border border-white/[0.12] bg-white/[0.08] px-4 text-left text-[16px] font-bold text-text transition-colors hover:bg-white/[0.12] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
