/**
 * Everything inside the product shell: Dashboard, Wallet, Benefits and its
 * products, Account, Settings, and Spaces. One layout, so moving between them
 * keeps the sidebar, the session and what was already read.
 *
 * The base path is decided here, from the host the request came in on, and
 * handed to the client so every link is right on both hosts (lib/app/paths).
 * Reading the host also makes every page under here dynamic, which they are
 * anyway: each is one signed-in person's account.
 */

import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesApp } from "@/components/app/Shell";
import { DemoBadge } from "@/components/creator/DemoBadge";
import { creatorDemoEnabled } from "@/lib/creator/demo";
import { spacesBaseFor } from "@/lib/app/paths";

export default function ShellLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return (
    <SpacesApp base={base} badge={creatorDemoEnabled() ? <DemoBadge /> : null}>
      {children}
    </SpacesApp>
  );
}
