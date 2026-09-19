import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SpacesGround } from "@/components/ad-space/ground";
import { BrandProductionPanel } from "@/components/ad-space/Production";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { Wordmark } from "@/components/site/Wordmark";
import { getProduction } from "@/lib/ad-space/server";

/**
 * /p/<token> — a content production spot, for the brand that paid with no HOLD
 * account (spaces-content-production-v0.md): the delivery, and Accept or one
 * revision.
 *
 * The token is the spot's only credential, so, like /b/, this page leaks it
 * nowhere: never cached (`force-dynamic` and `Cache-Control: no-store` from
 * next.config.js), never indexed (`noindex` here, `X-Robots-Tag`, and `/p/`
 * disallowed in robots.txt), never sent on as a Referer, never put in the title,
 * metadata or any analytics call.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your delivery",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  alternates: { canonical: null },
};

export default async function ProductionPage({ params }: { params: { token: string } }) {
  const found = await getProduction(params.token, headers());
  if (found.kind === "missing") notFound();

  return (
    <SpacesGround>
      <SlimHeader />
      <main className="container-page max-w-3xl py-10 md:py-16">
        {found.kind === "found" ? (
          <BrandProductionPanel token={params.token} initial={found.production} />
        ) : (
          <div className="flex min-h-[50vh] flex-col justify-center">
            <p className={`${eyebrow} text-amber`}>HiSpace</p>
            <h1 className="mt-5 font-display text-h3 font-light text-text md:text-h2">
              We couldn&rsquo;t load your delivery just now.
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
            Keep this link to yourself: anyone who has it can accept this delivery or ask for its revision.
          </p>
          <Wordmark className="h-5 w-auto self-start text-text-muted" />
        </div>
      </footer>
    </SpacesGround>
  );
}
