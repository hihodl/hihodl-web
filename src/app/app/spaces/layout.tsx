/**
 * Spaces, the product's first module: the creator's side of HiSpace.
 *
 * The base path is decided here, from the host the request came in on, and
 * handed to the client so every link is right on both hosts (lib/app/paths).
 * Reading the host also makes every page under here dynamic, which they are
 * anyway: each is one signed-in person's account.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SpacesApp } from "@/components/app/Shell";
import { spacesBaseFor } from "@/lib/app/paths";

export const metadata: Metadata = {
  title: { default: "Spaces", template: "%s · Spaces · HOLD" },
  robots: { index: false, follow: false },
};

export default function SpacesLayout({ children }: { children: ReactNode }) {
  const base = spacesBaseFor(headers().get("host"));
  return <SpacesApp base={base}>{children}</SpacesApp>;
}
