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

export const metadata: Metadata = {
  title: { default: "HOLD", template: "%s · HOLD" },
  robots: { index: false, follow: false },
};

/**
 * The phone's page is the screen's width and stays there. Without a maximum
 * scale, iOS zooms in on any field set under 16px the moment it is focused,
 * and a zoomed page is a page that slides sideways. iOS still lets a person
 * pinch to zoom on purpose: it ignores maximum-scale for that since iOS 10.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children;
}
