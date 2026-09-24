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
 *             joins with platform ios. No secret moves and no approver is
 *             added: the passkey keeps approving payments on the web
 *             (documentation/one-wallet-every-device.md, scenario 1).
 *   Computer  this page is for a phone: say so.
 */

import { useCallback, useEffect, useState } from "react";

import { t as tNow } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { getLinkState, joinLinkSession } from "@/lib/link/api";
import { androidIntentFor } from "@/lib/link/intent";
import { appleDeviceOf, phoneOf, type AppleDevice, type Phone } from "@/lib/link/ua";
import { PLAY_STORE_URL } from "@/lib/appLinks";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import { WalletApiError } from "@/lib/wallet/api";

import { Door } from "../front/Door";
import { btnGhost, btnLink, btnPrimary, DoorCard, HoldMark, Note, Warn } from "../front/kit";

export { androidIntentFor };

export type PhonePhase =
  | { kind: "reading" }
  | { kind: "android"; intent: string }
  | { kind: "computer" }
  | { kind: "ios-ready"; self: boolean; busy: boolean; notice?: string | null; name?: AppleDevice | null }
  | { kind: "ios-done" }
  | { kind: "expired" }
  | { kind: "other-account"; email: string | null };

export function PhoneLinkView({ phase, onJoin, onSignOut }: { phase: PhonePhase; onJoin: () => void; onSignOut: () => void }) {
  const t = useT();
  let title = t("link.linkYourPhone");
  let body: React.ReactNode = null;

  switch (phase.kind) {
    case "reading":
      body = <div className="h-11 animate-pulse rounded-[12px] bg-white/[0.06]" />;
      break;
    case "android":
      title = t("link.waiting.openInHold");
      body = (
        <>
          <Note>{t("link.phone.androidBody")}</Note>
          <div className="flex flex-col gap-2">
            <a href={phase.intent} className={`${btnPrimary} w-full`}>
              {t("link.waiting.openInHold")}
            </a>
            <a href={PLAY_STORE_URL} className={`${btnGhost} w-full`} rel="noopener">
              {t("link.getOnPlay")}
            </a>
          </div>
          <Note>{t("link.phone.noApp")}</Note>
        </>
      );
      break;
    case "computer":
      body = <Note>{t("link.phone.computer")}</Note>;
      break;
    case "ios-ready": {
      const name = phase.name ?? "iPhone";
      title = t("link.waiting.linkThis", { name });
      body = (
        <>
          <Note>
            {phase.self
              ? t("link.phone.appleSelf", { name })
              : t("link.phone.appleOther", { name })}
          </Note>
          {phase.notice ? <Warn>{phase.notice}</Warn> : null}
          <button type="button" className={`${btnPrimary} w-full`} disabled={phase.busy} onClick={onJoin}>
            {phase.busy ? t("link.phone.linking") : t("link.waiting.linkThis", { name })}
          </button>
        </>
      );
      break;
    }
    case "ios-done":
      title = t("link.phone.linked");
      body = <p className="text-small text-success">{t("link.phone.linkedBody")}</p>;
      break;
    case "expired":
      title = t("link.phone.expiredTitle");
      body = <Note>{t("link.phone.expiredBody")}</Note>;
      break;
    case "other-account":
      title = t("link.phone.otherAccountTitle");
      body = (
        <>
          <Note>
            {phase.email ? t("link.phone.otherAccountEmail", { email: phase.email }) : t("link.phone.otherAccount")}
          </Note>
          <div>
            <button type="button" className={btnLink} onClick={onSignOut}>
              {t("common.signOut")}
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
  useEffect(() => setPhone(phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)), []);

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
    const name = appleDeviceOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    getLinkState(sessionId).then(
      (s) => {
        if (!alive) return;
        if (s.status === "expired" || (s.expiresAt && Date.parse(s.expiresAt) < Date.now())) setPhase({ kind: "expired" });
        else if (s.status === "done" && s.platform === "ios") setPhase({ kind: "ios-done" });
        else setPhase({ kind: "ios-ready", self, busy: false, name });
      },
      (e) => alive && setPhase(refuse(e) ?? { kind: "ios-ready", self, busy: false, name }),
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
      setPhase(refuse(e) ?? { ...phase, busy: false, notice: tNow("link.phone.joinFailed") });
    }
  };

  return <PhoneLinkView phase={phase} onJoin={() => void join()} onSignOut={() => void signOut()} />;
}
