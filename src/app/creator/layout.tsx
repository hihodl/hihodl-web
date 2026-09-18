/**
 * /creator — the console a creator sets their account up in.
 *
 * NOINDEX, DELIBERATELY
 *
 * Nothing under here is a page to be found: it is one person's account, and
 * the half of it that renders for a signed-out reader is a sign-in form. The
 * pages that are meant to rank are the public space pages at /s/<handle>/<slug>
 * and the event pages, and a console competing with them in search would send
 * sponsors to a login screen.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/site/Footer";
import { TopNav } from "@/components/site/TopNav";

export const metadata: Metadata = {
  title: "Creator console",
  description:
    "Publish and run a HiSpace listing from the browser: what a brand can buy, where you get paid, and the X account you publish under.",
  robots: { index: false, follow: false },
};

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-abyss">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
