"use client";

/**
 * The phone's side of "Link your phone": app.hihodl.xyz/link/<sessionId>?k=…
 * (documentation/link-your-phone-and-approved-withdrawals.md).
 *
 *   Android   the HOLD app normally opens this address itself (App Link,
 *             /.well-known/assetlinks.json). When the browser shows it
 *             instead, the app is not installed or the link was opened from
 *             inside the browser: "Open in HOLD" hands it to the app, and
 *             "Get HOLD on Google Play" is for somebody without it. After
 *             installing and signing in, the app finds the same session
 *             through GET /device-link/pending.
 *   iPhone    sign in (the same door as everywhere), then "Link this iPhone"
 *             joins with platform ios. No secret moves: an iPhone approves
 *             withdrawals with a passkey on the web.
 *   Computer  this page is for a phone: say so.
 */

import { useCallback, useEffect, useState } from "react";

import { getLinkState, joinLinkSession } from "@/lib/link/api";
import { phoneOf, type Phone } from "@/lib/link/ua";
import { PLAY_STORE_URL } from "@/lib/appLinks";
import { demoParam } from "@/lib/creator/demo";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import { WalletApiError } from "@/lib/wallet/api";

import { Door } from "../front/Door";
import { btnGhost, btnLink, btnPrimary, DoorCard, HoldMark, Note, Warn } from "../front/kit";

const ANDROID_PACKAGE = "com.sayhihodl.hihodlai";

/** An Android intent for this exact https address: the app if installed, Google Play if not. */
export function androidIntentFor(href: string): string {
  const u = new URL(href);
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export type PhonePhase =
  | { kind: "reading" }
  | { kind: "android"; intent: string }
  | { kind: "computer" }
  | { kind: "ios-ready"; self: boolean; busy: boolean; notice?: string | null }
  | { kind: "ios-done" }
  | { kind: "expired" }
  | { kind: "other-account"; email: string | null };

export function PhoneLinkView({ phase, onJoin, onSignOut }: { phase: PhonePhase; onJoin: () => void; onSignOut: () => void }) {
  let title = "Link your phone";
  let body: React.ReactNode = null;

  switch (phase.kind) {
    case "reading":
      body = <div className="h-11 animate-pulse rounded-[12px] bg-white/[0.06]" />;
      break;
    case "android":
      title = "Open in HOLD";
      body = (
        <>
          <Note>Your phone links in the HOLD app. It opens on a six-digit code: check it matches the one on your computer.</Note>
          <div className="flex flex-col gap-2">
            <a href={phase.intent} className={`${btnPrimary} w-full`}>
              Open in HOLD
            </a>
            <a href={PLAY_STORE_URL} className={`${btnGhost} w-full`} rel="noopener">
              Get HOLD on Google Play
            </a>
          </div>
          <Note>No HOLD app yet? Install it, sign in with the same account, and it picks up this link where you left it.</Note>
        </>
      );
      break;
    case "computer":
      body = <Note>This page is for your phone. Scan the code on your computer with your phone&apos;s camera.</Note>;
      break;
    case "ios-ready":
      title = "Link this iPhone";
      body = (
        <>
          <Note>
            {phase.self
              ? "This is the iPhone you started on. Link it, and it approves every withdrawal from your wallet with your passkey."
              : "Link this iPhone to your HOLD account. From now on it approves every withdrawal from your wallet with your passkey."}
          </Note>
          {phase.notice ? <Warn>{phase.notice}</Warn> : null}
          <button type="button" className={`${btnPrimary} w-full`} disabled={phase.busy} onClick={onJoin}>
            {phase.busy ? "Linking…" : "Link this iPhone"}
          </button>
        </>
      );
      break;
    case "ios-done":
      title = "Linked";
      body = <p className="text-small text-success">Linked. You can close this.</p>;
      break;
    case "expired":
      title = "This code expired";
      body = <Note>Codes last five minutes. Show a new one on your computer and scan it again.</Note>;
      break;
    case "other-account":
      title = "Another account";
      body = (
        <>
          <Note>
            This code belongs to another HOLD account{phase.email ? `, not ${phase.email}` : ""}. Sign in with the account
            you use on your computer.
          </Note>
          <div>
            <button type="button" className={btnLink} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </>
      );
      break;
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-8">
      <DoorCard>
        <HoldMark className="h-4 w-auto" />
        <h1 className="mt-6 text-h4 font-light text-text">{title}</h1>
        <div className="mt-4 flex flex-col gap-4">{body}</div>
      </DoorCard>
    </div>
  );
}

export function PhoneLink({ sessionId }: { sessionId: string }) {
  const [phone, setPhone] = useState<Phone | null | undefined>(undefined);
  useEffect(() => {
    // DEMO BRANCH: ?phone=android|ios|computer shows the page as that device would.
    const forced = demoParam("phone");
    if (forced === "android" || forced === "ios") return setPhone(forced);
    if (forced === "computer") return setPhone(null);
    setPhone(phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0));
  }, []);

  if (phone === undefined) return <PhoneLinkView phase={{ kind: "reading" }} onJoin={() => undefined} onSignOut={() => undefined} />;
  if (phone === "android") {
    return <PhoneLinkView phase={{ kind: "android", intent: androidIntentFor(window.location.href) }} onJoin={() => undefined} onSignOut={() => undefined} />;
  }
  if (phone === null) return <PhoneLinkView phase={{ kind: "computer" }} onJoin={() => undefined} onSignOut={() => undefined} />;
  return <IPhone sessionId={sessionId} />;
}

function IPhone({ sessionId }: { sessionId: string }) {
  const { session, configured } = useCreatorSession();
  const [phase, setPhase] = useState<PhonePhase>({ kind: "reading" });
  const email = session?.user.email ?? null;

  const refuse = useCallback(
    (e: unknown): PhonePhase | null => {
      if (e instanceof WalletApiError && (e.status === 404 || e.status === 410 || e.code === "SESSION_EXPIRED")) return { kind: "expired" };
      if (e instanceof WalletApiError && e.status === 403) return { kind: "other-account", email };
      return null;
    },
    [email],
  );

  useEffect(() => {
    if (!session) return;
    let alive = true;
    let self = false;
    try {
      self = window.localStorage.getItem("hold-link-session") === sessionId;
    } catch {
      self = false;
    }
    getLinkState(sessionId).then(
      (s) => {
        if (!alive) return;
        if (s.status === "expired" || (s.expiresAt && Date.parse(s.expiresAt) < Date.now())) setPhase({ kind: "expired" });
        else if (s.status === "done" && s.platform === "ios") setPhase({ kind: "ios-done" });
        else setPhase({ kind: "ios-ready", self, busy: false });
      },
      (e) => alive && setPhase(refuse(e) ?? { kind: "ios-ready", self, busy: false }),
    );
    return () => {
      alive = false;
    };
  }, [session, sessionId, refuse]);

  if (session === undefined) return <PhoneLinkView phase={{ kind: "reading" }} onJoin={() => undefined} onSignOut={() => undefined} />;
  // Signing in comes back here: an Apple or Google trip through /auth/callback's `next`, an email code in place.
  if (session === null) return <Door configured={configured} />;

  const join = async () => {
    if (phase.kind !== "ios-ready") return;
    setPhase({ ...phase, busy: true, notice: null });
    try {
      await joinLinkSession(sessionId, { platform: "ios" });
      setPhase({ kind: "ios-done" });
    } catch (e) {
      setPhase(refuse(e) ?? { ...phase, busy: false, notice: "That did not go through. Try again." });
    }
  };

  return <PhoneLinkView phase={phase} onJoin={() => void join()} onSignOut={() => void signOut()} />;
}
