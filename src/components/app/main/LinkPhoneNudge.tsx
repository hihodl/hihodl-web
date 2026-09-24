"use client";

/**
 * Home asks to link a phone, once it matters and never while it is unsure.
 *
 * Until now the web only asked inside onboarding and in the Menu, so somebody
 * signed in with no linked phone was never asked again
 * (documentation/one-wallet-every-device.md, rules 4 and 5).
 *
 * WHEN. The person has a wallet (lib/app/hold-wallet) and:
 *
 *   link_first   no phone linked (iPhone or Android). The web does not pay by
 *                itself, so nothing can be paid from here at all: the strong
 *                card (amber), and a one-time sheet the first time Home opens.
 *   app          a phone approves already: nothing.
 *
 * Nothing is drawn while any read is loading, or when one failed: a nudge
 * built on a guess is a nudge that lies.
 *
 * HOW. The card copies the app's AccountProtectionBanner (calm or amber,
 * icon tile, title, subtitle, chevron); the sheet copies its
 * AccountProtectionSheet (badge, title, subtitle, amber CTA, "Not now").
 * The action is the link screen, as a full page load (it carries the wallet
 * pages' strict CSP), coming back to Home, where a phone opens the HOLD app
 * on itself and a computer shows a code to scan. "Later" hides the card for
 * seven days in this browser.
 */

import { useCallback, useEffect, useState } from "react";

import { useHoldWallet } from "@/lib/app/hold-wallet";
import { useWalletStatus } from "@/lib/app/spaces-data";
import { thisDevice, type AppleDevice } from "@/lib/link/ua";
import { payerOf } from "@/lib/wallet/api";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { LinkToPaySheet } from "../link/LinkGate";
import { linkHref, usePhone } from "../link/in-app";
import { useShell } from "../Shell";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/* ── This browser's memory of what was asked ─────────────────────── */

const laterKey = (uid: string) => `hold.linkNudge.later.${uid}`;
const sheetKey = (uid: string) => `hold.linkNudge.sheet.${uid}`;

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: it asks again next time, which is fine.
  }
}

interface Memory {
  /** "Later" was tapped less than a week ago. */
  snoozed: boolean;
  /** The link_first sheet has been shown. */
  sheetSeen: boolean;
}

/* ── What to ask, if anything ─────────────────────────────────────── */

export type LinkNudgeCase = "pay";

export interface LinkNudge {
  /** null: ask nothing (loading, a read failed, a phone approves already, or put off). */
  kind: LinkNudgeCase | null;
  /** The device this page is on: Android, iPhone or iPad, or a computer. */
  device: "android" | AppleDevice | "computer";
  /** Where the card and the sheet go: the link screen, back to Home after. */
  href: string;
  /** Show the one-time sheet now. */
  sheet: boolean;
  later: () => void;
  closeSheet: () => void;
}

export function useLinkNudge(): LinkNudge {
  const { session } = useShell();
  const uid = session.user.id;
  const productHref = useProductHref();
  const wallet = useHoldWallet();
  const status = useWalletStatus();
  const phone = usePhone();

  const [memory, setMemory] = useState<Memory | null>(null);
  const [apple, setApple] = useState<AppleDevice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const at = Number(readItem(laterKey(uid)));
    setMemory({
      snoozed: Number.isFinite(at) && at > 0 && Date.now() - at < WEEK,
      sheetSeen: readItem(sheetKey(uid)) === "1",
    });
    setApple(thisDevice().apple);
  }, [uid]);

  const payer = payerOf(status.data);
  const settled =
    !wallet.loading &&
    status.data !== undefined &&
    !status.error &&
    phone !== undefined &&
    memory !== null;

  let which: LinkNudgeCase | null = null;
  if (settled) {
    if (wallet.kind !== "none" && payer === "link_first") which = "pay";
  }

  const device: LinkNudge["device"] = phone === "android" ? "android" : phone === "ios" ? (apple ?? "iPhone") : "computer";
  const cardKind = which && !hidden && !memory?.snoozed ? which : null;

  // The sheet, once, for a wallet that cannot pay from here until it links.
  useEffect(() => {
    if (which === "pay" && memory && !memory.sheetSeen) {
      writeItem(sheetKey(uid), "1");
      setMemory((m) => (m ? { ...m, sheetSeen: true } : m));
      setSheetOpen(true);
    }
  }, [which, memory, uid]);

  const later = useCallback(() => {
    writeItem(laterKey(uid), String(Date.now()));
    setHidden(true);
  }, [uid]);

  const href = linkHref(productHref, productHref());

  return {
    kind: cardKind,
    device,
    href,
    sheet: sheetOpen,
    later,
    closeSheet: useCallback(() => setSheetOpen(false), []),
  };
}

/* ── The words ─────────────────────────────────────────────────────── */

interface Words {
  title: string;
  body: string;
}

function wordsFor(device: LinkNudge["device"]): Words {
  if (device === "computer") {
    return {
      title: "Link your phone to pay from here",
      body: "Your wallet's keys stay on your phone. Link it once and the HOLD app approves every payment you start here.",
    };
  }
  return {
    title: "Link your phone to pay from here",
    body: "Open HOLD on this phone to link it. From then on, the app approves every payment you start here.",
  };
}

/* ── The card ──────────────────────────────────────────────────────── */

/**
 * The app's AccountProtectionBanner, amber: the web cannot pay without it.
 * "Later" sits under the text.
 */
export function LinkPhoneCard({ nudge }: { nudge: LinkNudge }) {
  if (!nudge.kind) return null;
  const strong = nudge.kind === "pay";
  const w = wordsFor(nudge.device);

  const face = (
    <>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
          strong ? "bg-[rgba(255,183,3,0.14)] text-amber" : "bg-white/[0.08] text-white"
        }`}
      >
        <Ion name="phone-portrait-outline" size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-white">{w.title}</span>
        <span className="mt-0.5 block text-[13px] leading-[18px] text-white/60">{w.body}</span>
      </span>
      <Ion name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
    </>
  );

  return (
    <section
      aria-label={w.title}
      className={`mt-[18px] rounded-[18px] border p-3.5 ${
        strong ? "border-[rgba(255,183,3,0.28)] bg-[rgba(255,183,3,0.09)]" : "border-white/10 bg-white/[0.05]"
      }`}
    >
      {/* A plain anchor: the link screen is a full page load, for its CSP. */}
      <a href={nudge.href} className="flex items-center gap-3 transition-opacity hover:opacity-90">
        {face}
      </a>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-14">
        <button
          type="button"
          onClick={nudge.later}
          className="inline-flex h-8 items-center rounded-[16px] px-3 text-[13px] font-bold text-white/55 transition-colors hover:text-white/80"
        >
          Later
        </button>
      </div>
    </section>
  );
}

/* ── The one-time sheet ────────────────────────────────────────────── */

/**
 * The first time Home opens on the web for a wallet made in the app: the
 * same sheet every payment opens (link/LinkGate), coming back to Home. Shown
 * once; the card stays for later.
 */
export function LinkPhoneSheet({ nudge }: { nudge: LinkNudge }) {
  return <LinkToPaySheet open={nudge.sheet} device={nudge.device} href={nudge.href} onClose={nudge.closeSheet} />;
}
