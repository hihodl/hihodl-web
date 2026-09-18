import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { OfferPanel } from "@/components/ad-space/OfferPanel";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { Wordmark } from "@/components/site/Wordmark";
import { getOffer, getPublicSpaceById } from "@/lib/ad-space/server";

/**
 * /o/<token> — an offer or a bid, for a sponsor with no HOLD account
 * (hispace-offers-v0.md).
 *
 * The token is the offer's only credential, so this page is built to leak it
 * nowhere:
 *   - never cached, by us or by anything in between (`force-dynamic`, and
 *     `Cache-Control: no-store` from next.config.js);
 *   - never indexed (`noindex` here, `X-Robots-Tag` from next.config.js, and
 *     `/o/` disallowed in robots.txt);
 *   - never sent on as a Referer (`referrer: no-referrer`);
 *   - never logged or put in the title, metadata or any analytics call.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your offer",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  // The layout's canonical points at the home page; a private page names none.
  alternates: { canonical: null },
};

export default async function OfferPage({ params }: { params: { token: string } }) {
  const found = await getOffer(params.token, headers());
  if (found.kind === "missing") notFound();

  // The full space carries what the checkout needs (chains, fee, the spot).
  const space = found.kind === "found" ? await getPublicSpaceById(found.thread.space.id) : null;

  return (
    <>
      <SlimHeader />
      <main className="container-page max-w-3xl py-10 md:py-16">
        {found.kind === "found" ? (
          <OfferPanel
            token={params.token}
            initial={found.thread}
            space={space?.kind === "found" ? space.space : null}
          />
        ) : (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-amber`}>HiSpace</p>
            <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">
              We couldn&rsquo;t load your offer just now.
            </h1>
            <p className="mt-5 max-w-xl text-body text-text-muted">
              This is on our side, not your link. Give it a moment and refresh the page.
            </p>
          </div>
        )}
      </main>
      <footer className="hairline">
        <div className="container-page flex flex-col gap-3 py-10">
          <Wordmark className="h-5 w-auto self-start text-text" />
          <p className="max-w-xl text-small text-text-muted">
            Powered by HOLD. Nothing you offer is paid or locked; if it&rsquo;s accepted, you pay the creator directly in
            USDC and HOLD never holds the money. Keep this link to yourself: anyone who has it can manage this offer.
          </p>
        </div>
      </footer>
    </>
  );
}
