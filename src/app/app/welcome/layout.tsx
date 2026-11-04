/**
 * Onboarding: app.hihodl.xyz/welcome (and /app/welcome elsewhere).
 *
 * Outside the shell (no sidebar: one step, one card), on the same ground.
 * It makes no wallet any more, but its link step can open an older web
 * wallet's secret to seal it to the phone, so the middleware still gives it
 * the wallet pages' strict nonce-based Content-Security-Policy
 * (lib/wallet/csp.ts).
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
