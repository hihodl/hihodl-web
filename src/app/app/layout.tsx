/**
 * The HOLD product: app.hihodl.xyz.
 *
 * Its own tree, so nothing of the website (header, footer, banners) is ever
 * drawn around it. The middleware serves this tree at the root of the app
 * host; on any other host it answers under /app.
 *
 * Nothing here is meant to be found by search: it is one person's account.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "HOLD", template: "%s · HOLD" },
  robots: { index: false, follow: false },
};

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children;
}
