/**
 * Onboarding: app.hihodl.xyz/welcome (and /app/welcome elsewhere).
 *
 * Outside the shell (no sidebar: one step, one card), on the same ground.
 * It can create the web wallet, so the middleware gives it the wallet pages'
 * strict nonce-based Content-Security-Policy (lib/wallet/csp.ts): keys are
 * made in this page's memory.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesGround } from "@/components/ad-space/ground";
import { SpacesBaseProvider } from "@/components/app/base";
import { spacesBaseFor } from "@/lib/app/paths";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return (
    <SpacesBaseProvider base={base}>
      <SpacesGround>{children}</SpacesGround>
    </SpacesBaseProvider>
  );
}
