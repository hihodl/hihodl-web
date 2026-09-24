"use client";

/**
 * The phone's side of "Link your phone": app.hihodl.xyz/link/<sessionId>?k=…
 * (documentation/link-your-phone-and-approved-withdrawals.md).
 *
 * The HOLD app normally opens this address itself: an App Link on Android
 * (/.well-known/assetlinks.json), a universal link on an iPhone
 * (/.well-known/apple-app-site-association, `/link/*`). The app joins with its
 * device key, both screens show the same six-digit code, and the computer
 * confirms it. When the browser shows this page instead, the app is not
 * installed or the link was opened from inside the browser:
 *
 *   Android   "Open in HOLD" hands it to the app as an intent (Google Play
 *             when it is missing)
 *   iPhone    "Open in HOLD" goes through the site's opener on hihodl.xyz,
 *             which the app claims too: Safari does not hand a link to an
 *             app on the same host it is already showing. The App Store when
 *             it is missing. The browser does not link an iPhone by itself
 *             any more: that only recorded the device and approved nothing
 *   Computer  this page is for a phone: say so
 *
 * After installing and signing in, the app finds the same session through
 * GET /device-link/pending.
 */

import { useEffect, useState } from "react";

import { androidIntentFor, openLinkFromBrowser } from "@/lib/link/intent";
import { phoneOf, type Phone } from "@/lib/link/ua";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

import { btnGhost, btnPrimary, DoorCard, HoldMark, Note } from "../front/kit";

export { androidIntentFor };

export type PhonePhase = { kind: "reading" } | { kind: "phone"; phone: Phone; open: string } | { kind: "computer" };

export function PhoneLinkView({ phase }: { phase: PhonePhase }) {
  let title = "Link your phone";
  let body: React.ReactNode = null;

  switch (phase.kind) {
    case "reading":
      body = <div className="h-11 animate-pulse rounded-[12px] bg-white/[0.06]" />;
      break;
    case "phone": {
      const ios = phase.phone === "ios";
      title = "Open in HOLD";
      body = (
        <>
          <Note>Your phone links in the HOLD app. It opens on a six-digit code: check it matches the one on your computer.</Note>
          <div className="flex flex-col gap-2">
            <a href={phase.open} className={`${btnPrimary} w-full`}>
              Open in HOLD
            </a>
            <a href={ios ? APP_STORE_URL : PLAY_STORE_URL} className={`${btnGhost} w-full`} rel="noopener">
              {ios ? "Get HOLD on the App Store" : "Get HOLD on Google Play"}
            </a>
          </div>
          <Note>No HOLD app yet? Install it, sign in with the same account, and it picks up this link where you left it.</Note>
        </>
      );
      break;
    }
    case "computer":
      body = <Note>This page is for your phone. Scan the code on your computer with your phone&apos;s camera.</Note>;
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
  const [phase, setPhase] = useState<PhonePhase>({ kind: "reading" });
  useEffect(() => {
    const phone = phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    if (!phone) return setPhase({ kind: "computer" });
    let open: string;
    try {
      open = openLinkFromBrowser(window.location.href, phone);
    } catch {
      open = window.location.href;
    }
    setPhase({ kind: "phone", phone, open });
  }, [sessionId]);
  return <PhoneLinkView phase={phase} />;
}
