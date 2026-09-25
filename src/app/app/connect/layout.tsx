/**
 * HOLD Connect for the computer: app.hihodl.xyz/connect (and /app/connect
 * elsewhere), the window a site opens from its Connect button
 * (documentation/hold-connect-v0.md, "The fourth door").
 *
 * Outside the shell, on the same ground: one card in a 420×640 popup. Never
 * framed (the site-wide X-Frame-Options: DENY stands), so a site cannot draw
 * it under its own page.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesGround } from "@/components/ad-space/ground";
import { SpacesBaseProvider } from "@/components/app/base";
import { spacesBaseFor } from "@/lib/app/paths";

export const metadata: Metadata = {
  title: "Connect",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConnectLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return (
    <SpacesBaseProvider base={base}>
      <SpacesGround>{children}</SpacesGround>
    </SpacesBaseProvider>
  );
}
