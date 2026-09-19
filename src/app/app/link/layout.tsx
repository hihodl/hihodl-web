/**
 * The phone's side of "Link your phone": app.hihodl.xyz/link/<sessionId>
 * (and /app/link/<sessionId> elsewhere). Outside the shell, on the same
 * ground: one card, and a person who may not be signed in on this phone yet.
 *
 * The address is what the QR on the computer carries, and what the HOLD
 * app's App Link claims on Android (/.well-known/assetlinks.json).
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesGround } from "@/components/ad-space/ground";
import { SpacesBaseProvider } from "@/components/app/base";
import { spacesBaseFor } from "@/lib/app/paths";

export const metadata: Metadata = {
  title: "Link your phone",
  robots: { index: false, follow: false },
  // The address carries the session's public key: no Referer takes it elsewhere.
  referrer: "no-referrer",
};

export default function LinkLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return (
    <SpacesBaseProvider base={base}>
      <SpacesGround>{children}</SpacesGround>
    </SpacesBaseProvider>
  );
}
