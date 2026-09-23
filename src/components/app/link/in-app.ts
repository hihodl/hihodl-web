"use client";

/**
 * Which phone this page is on, and the address that opens a HOLD screen from
 * it. For the honest "do this in the app" answers (a spot or a stay paid from a
 * wallet made in the app, a wallet that is made in the app): on a phone they
 * carry a link that opens the app there, on a computer they say where to look.
 */

import { useEffect, useState } from "react";

import { PLAY_STORE_URL } from "@/lib/appLinks";
import { appIntent, openInAppUrl } from "@/lib/link/intent";
import { phoneOf, type Phone } from "@/lib/link/ua";

/** undefined until read in the browser; null on a computer. */
export function usePhone(): Phone | null | undefined {
  const [phone, setPhone] = useState<Phone | null | undefined>(undefined);
  useEffect(() => setPhone(phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)), []);
  return phone;
}

/**
 * The address that opens `hihodl://<path>` from this phone: an intent on
 * Android (Google Play when the app is missing), the site's opener on an
 * iPhone. null on a computer, where there is no app to open.
 */
export function inAppHref(path: string, phone: Phone | null | undefined): string | null {
  if (phone === "android") return appIntent(path);
  if (phone === "ios") return openInAppUrl(path);
  return null;
}

/** "Get HOLD on Google Play": the app when it is installed on this Android phone, the store otherwise. */
export function playHref(phone: Phone | null | undefined): string {
  return phone === "android" ? appIntent("") : PLAY_STORE_URL;
}

/**
 * The link screen (/wallet/link), coming back to `next` after. Always a full
 * load: it carries the wallet pages' strict CSP (LinkScreen).
 */
export function linkHref(productHref: (p?: string) => string, next?: string): string {
  return `${productHref("/wallet/link")}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
}
