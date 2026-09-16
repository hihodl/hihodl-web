import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpaceBoard } from "@/components/ad-space/SpaceBoard";
import {
  SlimHeader,
  SpaceFooter,
  SpaceHero,
  SpaceInvite,
  SpacePromises,
  SpaceTakeover,
  SpaceUnavailable,
  SpaceUpdates,
} from "@/components/ad-space/sections";
import { getPublicSpace } from "@/lib/ad-space/server";

/**
 * /s/<handle>/<slug> — a creator's Ad Space, as a sponsor arriving from X
 * sees it.
 *
 * Server-rendered from `GET /public/spaces/by-path/:handle/:slug`, refreshed
 * every 10 s like the API's own cache. Everything interactive (the board, the
 * spots, the checkout) is one client island; the rest is plain HTML so the
 * page is readable before any JavaScript arrives.
 *
 * `?m=<sold>` is the milestone the link was shared at. It only changes the
 * og:image URL, which is what makes X fetch a fresh card for each milestone.
 */

type Params = { handle: string; slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function milestone(searchParams: SearchParams, fallback: number): string {
  const m = searchParams.m;
  return typeof m === "string" && /^\d{1,4}$/.test(m) ? m : String(fallback);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const found = await getPublicSpace(params.handle, params.slug);
  if (found.kind !== "found") {
    return { title: "Ad Space", robots: { index: false, follow: false } };
  }

  const s = found.space;
  const handle = s.creator.xHandle;
  const path = `/s/${encodeURIComponent(handle)}/${encodeURIComponent(s.slug)}`;
  const og = `/api/og${path}?m=${milestone(searchParams, s.totals.sold)}`;
  const noun = s.kind === "service" ? "slots" : "spots";
  const soldOut = s.totals.positions > 0 && s.totals.sold >= s.totals.positions;
  const progress = soldOut
    ? `Sold out: all ${s.totals.positions} ${noun} taken`
    : `${s.totals.sold} of ${s.totals.positions} ${noun} sold`;
  const where = s.eventName ? ` for ${s.eventName}` : "";
  const title = `${s.title} · @${handle}`;
  const description = `${progress} on @${handle}'s ${s.template.name.toLowerCase()}${where}. Sponsors pay the creator directly in USDC.`;
  const alt = `${s.title}: ${progress}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: "HOLD",
      title,
      description,
      images: [{ url: og, width: 1200, height: 630, alt, type: "image/png" }],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      site: "@hiihodl",
      title,
      description,
      images: [{ url: og, alt }],
    },
    robots: s.status === "live" ? undefined : { index: false, follow: true },
  };
}

export default async function AdSpacePage({ params }: { params: Params }) {
  const found = await getPublicSpace(params.handle, params.slug);
  if (found.kind === "missing") notFound();

  return (
    <>
      <SlimHeader />
      {found.kind === "unreachable" ? (
        <main>
          <SpaceUnavailable />
        </main>
      ) : (
        <>
          <main>
            <SpaceHero space={found.space} />
            <section className="container-page py-12 md:py-16" aria-label="Spots">
              <SpaceTakeover space={found.space} />
              <SpaceBoard space={found.space} />
            </section>
            <SpacePromises space={found.space} />
            <SpaceUpdates space={found.space} />
            <SpaceInvite space={found.space} />
          </main>
          <SpaceFooter space={found.space} />
        </>
      )}
    </>
  );
}
