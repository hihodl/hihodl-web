import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ApplyCta,
  BrandRecordCard,
  BriefHead,
  IfTheVenueSaysNo,
  WhatYouGet,
  When,
  Winners,
  moneyText,
  whereText,
} from "@/components/ad-space/brief";
import { SpacesGround } from "@/components/ad-space/ground";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { getPublicBrief } from "@/lib/ad-space/server";

/**
 * /brief/<slug> — one brand's open call, for anybody with the link.
 *
 * This is the page a brand posts. Somebody arrives from a post on X, has never
 * heard of HOLD, and wants four things: what is being asked, what they get for
 * it, by when, and whether it has already been decided. In that order, above
 * the fold as far as it goes, with one thing to do at the end.
 *
 * Server-rendered from `GET /public/briefs/:slug` and refreshed every ten
 * seconds, which is the rate at which the two things that change here change:
 * somebody entering, and the winner being named.
 *
 * An unreachable API renders as "we could not load it", never as a 404. A
 * withdrawn brief IS a 404, because the backend answers one: a brand that
 * takes its call down takes the page with it.
 */

type Params = { slug: string };

export const revalidate = 10;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPublicBrief(params.slug);
  if (found.kind !== "found") {
    return { title: "Brief · HiSpace", robots: { index: false, follow: false } };
  }
  const { brief } = found;
  const brand = brief.brand.name ?? "A brand";
  const pays = brief.budgetCents > 0 ? moneyText(brief.budgetCents) : brief.perks ?? "Costs covered";
  const decided = brief.winners.length > 0;
  const title = decided ? `${brand}: ${brief.title} — picked` : `${brand} is looking for ${brief.peopleWanted === 1 ? "one creator" : `${brief.peopleWanted} creators`}`;
  const description = decided
    ? `${brief.title}. ${brand} picked ${brief.winners.length === 1 ? "their creator" : `${brief.winners.length} creators`} on HiSpace.`
    : `${brief.title}. ${pays}${brief.budgetCents > 0 && brief.perks ? ` and ${brief.perks}` : ""}. ${whereText(brief)}. Apply on HiSpace.`;
  const path = `/brief/${brief.slug}`;
  const og = `/api/og/brief/${encodeURIComponent(brief.slug)}`;
  const alt = `${brand} on HiSpace`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      siteName: "HOLD",
      title,
      description,
      images: [{ url: og, width: 1200, height: 630, alt, type: "image/png" }],
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", site: "@hiihodl", title, description, images: [{ url: og, alt }] },
  };
}

export default async function BriefPage({ params }: { params: Params }) {
  const found = await getPublicBrief(params.slug);
  if (found.kind === "missing") notFound();

  if (found.kind === "unreachable") {
    return (
      <>
        <SlimHeader />
        <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
          <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
            We couldn&rsquo;t load this brief just now.
          </h1>
          <p className="mt-5 max-w-xl text-body text-sp-ink/85">
            This is on our side, not the link. Give it a moment and refresh the page.
          </p>
        </main>
      </>
    );
  }

  const { brief } = found;
  return (
    <SpacesGround>
      <main>
        <BriefHead brief={brief} />
        <div className="container-page">
          <Winners brief={brief} />
          <WhatYouGet brief={brief} />
          <When brief={brief} />
          <IfTheVenueSaysNo brief={brief} />
          <BrandRecordCard record={brief.record} brand={brief.brand.name ?? "This brand"} />
          <ApplyCta brief={brief} />
        </div>
      </main>
    </SpacesGround>
  );
}
