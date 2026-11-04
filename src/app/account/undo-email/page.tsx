import type { Metadata } from "next";

import { UndoEmail } from "@/components/account/UndoEmail";
import { SlimHeader } from "@/components/ad-space/sections";

/**
 * /account/undo-email?t=<token> — the link in the email the OLD address gets
 * when a HOLD login email is changed (change-your-login-email-spec, B and D).
 *
 * Opening it never undoes anything, because mail scanners open links: the page
 * checks the link, then asks, and only "Undo it" sends the undo. The token is
 * the only key: never indexed (here, robots.txt and X-Robots-Tag), never
 * cached, never sent on as a Referer (next.config.js), and dropped from the
 * address bar once read (components/account/UndoEmail).
 *
 * English only, like the email that links here and the pay receipt.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login email",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  // The layout's canonical points at the home page; a private page names none.
  alternates: { canonical: null },
  // No link card: this URL is never meant to be shared.
  openGraph: null,
  twitter: null,
};

export default function UndoEmailPage() {
  return (
    <>
      <SlimHeader />
      <main className="container-page max-w-xl py-10 md:py-16">
        <UndoEmail />
      </main>
    </>
  );
}
