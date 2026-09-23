"use client";

/**
 * Paying from a wallet made in the app, with no phone linked: one sheet,
 * wherever the payment starts.
 *
 * Such a wallet's keys are on the Android phone, so the web cannot pay from it
 * at all until that phone is linked (`canPayFromWeb` link_first on
 * GET /wallet-backup/status; documentation/one-wallet-every-device.md). Every
 * way into a payment (Home's Send, the Wallet's Send, Payments' Send and "Pay"
 * on a request, a Spaces spot, a Stay's checkout) asks through this sheet
 * instead of an inline card or a button that does nothing:
 *
 *   "Link your phone to pay from here"   [Link your phone]   Not now
 *
 * "Link your phone" is a full page load to /wallet/link (the link screen
 * carries the wallet pages' strict CSP) with `?next=` the page the payment was
 * started from, so the person comes back to it and carries on; on an iPhone or
 * iPad with `&show=android`, since only the Android phone approves this
 * wallet and it scans the code off this screen.
 *
 * A web wallet (web_passkey) or a phone that approves already (app) is never
 * blocked: `blocked` is false and nothing is drawn. Neither while the status
 * is still loading or failed to load: the payment screen then answers for
 * itself, as it did before.
 *
 * The sheet copies the app's AccountProtectionSheet (badge, title, subtitle,
 * amber CTA, "Not now").
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useWalletStatus } from "@/lib/app/spaces-data";
import { thisDevice, type AppleDevice } from "@/lib/link/ua";
import { payerOf } from "@/lib/wallet/api";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { linkHref, usePhone } from "./in-app";

export type GateDevice = "android" | AppleDevice | "computer";

/** Which device this page is on; "computer" until read. */
export function useGateDevice(): GateDevice {
  const phone = usePhone();
  const [apple, setApple] = useState<AppleDevice | null>(null);
  useEffect(() => setApple(thisDevice().apple), []);
  return phone === "android" ? "android" : phone === "ios" ? (apple ?? "iPhone") : "computer";
}

/** The page this is, as `?next=` wants it: path and query on this origin. */
export function hereNow(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * The link screen, coming back to `next`. On an iPhone or iPad the screen opens
 * on its QR (`show=android`), for the Android app to scan.
 */
export function linkToPay(productHref: (p?: string) => string, next: string | undefined, device: GateDevice): string {
  const base = linkHref(productHref, next ?? productHref("/"));
  return device === "iPhone" || device === "iPad" ? `${base}&show=android` : base;
}

/** The words, by device. */
export function payWords(device: GateDevice): { title: string; body: string } {
  const title = "Link your phone to pay from here";
  if (device === "android") {
    return { title, body: "Your wallet was made in the HOLD app. Link this phone once, and the app approves every payment you start here. Until then, nothing can be paid from here." };
  }
  if (device === "iPhone" || device === "iPad") {
    // Linking this iPhone adds no approver: the keys are on the Android phone.
    return {
      title,
      body: "Your wallet was made in the HOLD app on your Android phone, and its keys stay there. Show a code here, scan it with HOLD on that phone, and you can pay from here. Until then, nothing can be paid from here.",
    };
  }
  return {
    title,
    body: "Your wallet was made in the HOLD app, and its keys stay on your phone. Link the phone once, and it approves and signs every payment you start here. Until then, nothing can be paid from here.",
  };
}

/* ── The sheet ─────────────────────────────────────────────────────── */

/**
 * The modal. Drawn into document.body, over any other sheet (a spot's
 * checkout is one), so a transformed parent never clips it.
 */
export function LinkToPaySheet({ open, device, href, onClose }: { open: boolean; device: GateDevice; href: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const w = payWords(device);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="link-to-pay-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-t-[28px] bg-[linear-gradient(180deg,#12324a,#0a1929)] px-6 pb-5 pt-3 sm:m-3 sm:rounded-[28px]">
        <div className="mx-auto mb-5 h-1 w-10 rounded-[2px] bg-white/25 sm:hidden" />
        <span className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[rgba(255,183,3,0.18)] text-amber">
          <Ion name="phone-portrait-outline" size={28} />
        </span>
        <h2 id="link-to-pay-title" className="mt-4 text-center text-[22px] font-bold text-white">
          {w.title}
        </h2>
        <p className="mt-2.5 text-center text-[15px] leading-[21px] text-white/65">{w.body}</p>
        {/* A plain anchor: the link screen is a full page load, for its CSP. */}
        <a
          href={href}
          className="mt-6 flex h-[52px] items-center justify-center rounded-[26px] bg-amber text-[16px] font-bold text-[#0F0F1A] transition-opacity hover:opacity-90"
        >
          Link your phone
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center py-3.5 text-[15px] font-semibold text-white/60 transition-colors hover:text-white/80"
        >
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ── The gate ──────────────────────────────────────────────────────── */

export interface LinkGate {
  /** A wallet made in the app with no phone linked: paying from here opens the sheet. */
  blocked: boolean;
  /** Opens the sheet. `next`: where linking comes back to, the payment's own page (default: this page). */
  ask: (next?: string) => void;
  /**
   * Run `pay` unless blocked, in which case the sheet opens instead. For a
   * handler: `onClick={gate.guard(() => start(), next)}`.
   */
  guard: (pay: () => void, next?: string) => () => void;
  /** The sheet: render it once, anywhere in the screen. */
  sheet: ReactNode;
}

export function useLinkGate(): LinkGate {
  const status = useWalletStatus();
  const productHref = useProductHref();
  const device = useGateDevice();
  const [next, setNext] = useState<string | null>(null);

  // Only a status that answered, and said so: a read still loading or failed never blocks.
  const blocked = status.data !== undefined && !status.error && payerOf(status.data) === "link_first";

  const ask = useCallback((to?: string) => setNext(to ?? hereNow() ?? productHref("/")), [productHref]);
  const guard = useCallback(
    (pay: () => void, to?: string) => () => {
      if (blocked) ask(to);
      else pay();
    },
    [blocked, ask],
  );
  const close = useCallback(() => setNext(null), []);

  return {
    blocked,
    ask,
    guard,
    sheet: <LinkToPaySheet open={next !== null} device={device} href={linkToPay(productHref, next ?? undefined, device)} onClose={close} />,
  };
}
