import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SpacesGround } from "@/components/ad-space/ground";
import { BookingPanel } from "@/components/ad-space/SessionBooking";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { Wordmark } from "@/components/site/Wordmark";
import { getBooking } from "@/lib/ad-space/server";

/**
 * /b/<token> — a booked session, for a buyer with no HOLD account
 * (hispace-in-the-room-v0.md).
 *
 * The token is the booking's only credential, so this page is built to leak it
 * nowhere:
 *   - never cached, by us or by anything in between (`force-dynamic`, and
 *     `Cache-Control: no-store` from next.config.js);
 *   - never indexed (`noindex` here, `X-Robots-Tag` from next.config.js, and
 *     `/b/` disallowed in robots.txt);
 *   - never sent on as a Referer (`referrer: no-referrer`), so opening the
 *     transaction on an explorer does not hand it the link;
 *   - never logged or put in the title, metadata or any analytics call.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  // The layout's canonical points at the home page; a private page names none.
  alternates: { canonical: null },
};

export default async function BookingPage({ params }: { params: { token: string } }) {
  const found = await getBooking(params.token, headers());
  if (found.kind === "missing") notFound();

  return (
    <SpacesGround>
      <SlimHeader />
      <main className="container-page max-w-3xl py-10 md:py-16">
        {found.kind === "found" ? (
          <BookingPanel token={params.token} initial={found.booking} renderedAt={Date.now()} />
        ) : (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-amber`}>HiSpace</p>
            <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">
              We couldn&rsquo;t load your booking just now.
            </h1>
            <p className="mt-5 max-w-xl text-body text-text-muted">
              This is on our side, not your link. Give it a moment and refresh the page.
            </p>
          </div>
        )}
      </main>
      <footer className="hairline">
        <div className="container-page flex flex-col gap-6 py-10">
          <p className="max-w-xl text-tiny text-text-faint">
            Keep this link to yourself: anyone who has it can manage this booking.
          </p>
          <Wordmark className="h-5 w-auto self-start text-text-muted" />
        </div>
      </footer>
    </SpacesGround>
  );
}
