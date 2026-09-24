/**
 * The HOLD product: app.hihodl.xyz.
 *
 * Its own tree, so nothing of the website (header, footer, banners) is ever
 * drawn around it. The middleware serves this tree at the root of the app
 * host; on any other host it answers under /app.
 *
 * Nothing here is meant to be found by search: it is one person's account.
 */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { I18nProvider } from "@/lib/app/i18n/react";
import { IOS_APP_ID } from "@/lib/appLinks";

/**
 * Everything the website's root layout sets for sharing and search is unset
 * here: a canonical pointing at hihodl.xyz and the website's link card would
 * tell a crawler (and anyone pasting a link into a chat) that an account page
 * is the homepage. The host's robots.txt is disallow-all (middleware), so the
 * root layout's JSON-LD, which a metadata export cannot remove, is never
 * crawled here.
 */
export const metadata: Metadata = {
  title: { default: "HOLD", template: "%s · HOLD" },
  description: "Your HOLD account.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
  // Safari's smart app banner: the product is opened by people who have the
  // HOLD app (the wallet is made there), so an iPhone offers to open it.
  // Only on the product, never on the public token pages brands open.
  itunes: { appId: IOS_APP_ID },
};

/**
 * The phone's page is the screen's width and stays there. Without a maximum
 * scale, iOS zooms in on any field set under 16px the moment it is focused,
 * and a zoomed page is a page that slides sideways. iOS still lets a person
 * pinch to zoom on purpose: it ignores maximum-scale for that since iOS 10.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function ProductLayout({ children }: { children: ReactNode }) {
  // The person's language and display currency (lib/app/i18n): every page of
  // the product, signed in or not, speaks the same one.
  return <I18nProvider>{children}</I18nProvider>;
}
