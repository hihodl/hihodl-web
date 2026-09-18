/**
 * The wallet: the product's second module, in the same shell as Spaces.
 *
 * Served at app.hihodl.xyz/wallet (and /app/wallet elsewhere). The middleware
 * gives every page under here a strict, nonce-based Content-Security-Policy
 * (lib/wallet/csp.ts): keys are decrypted in this page's memory, so no script
 * we did not ship may run on it.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesApp } from "@/components/app/Shell";
import { spacesBaseFor } from "@/lib/app/paths";

export const metadata: Metadata = {
  title: { default: "Wallet", template: "%s · Wallet · HOLD" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WalletLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return <SpacesApp base={base}>{children}</SpacesApp>;
}
