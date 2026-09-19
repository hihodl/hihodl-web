import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CreatorHero,
  GroupGrid,
  KindPills,
  PAST,
  PastEventsLink,
  ProfileFooter,
  ProfileGround,
  TopBar,
  activeKind,
  creatorPath,
  creatorScreenPath,
  kindCounts,
  kindsIn,
  openNowIn,
  splitGroups,
} from "@/components/ad-space/creator";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { creatorTotalsText } from "@/lib/ad-space/format";
import { getPublicCreator } from "@/lib/ad-space/server";

/**
 * /s/<handle> — one creator: who they are, then one banner per event they sell
 * at (and one for what they sell all year). The link a creator pins to their
 * profile, and it sells them and nobody else.
 *
 * Server-rendered from `GET /public/creators/:handle`, refreshed every 30 s. The
 * order of the groups is the server's and is kept. Events that are over go
 * behind "Past events" (top right); a banner opens that event's own screen
 * (`/s/<handle>/events/<slug>`), so this page never lists every listing at once.
 * A creator who sells both placements and services gets Spaces / Services pills
 * (`?kind=services`).
 */

type Params = { handle: string };
type SearchParams = Record<string, string | string[] | undefined>;

/** Today in UTC: the X card's cache key, so the countdowns on it are never a day stale. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// The hub's own cache, matching the fetch inside `getPublicCreator`.
export const revalidate = 30;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPublicCreator(params.handle);
  if (found.kind !== "found") {
    return { title: "HiSpace", robots: { index: false, follow: false } };
  }

  const { creator, groups, totals } = found.page;
  // The handle as the backend holds it, so a link typed in any casing still
  // names one canonical address.
  const path = creatorPath(creator.xHandle);
  const og = `/api/og/c/${encodeURIComponent(creator.xHandle)}?d=${today()}`;
  const name = creator.xName || `@${creator.xHandle}`;
  // Only where they are going: an event that is over is not something to sell.
  const events = splitGroups(groups, Date.now())
    .current.map((g) => g.event?.name)
    .filter((n): n is string => Boolean(n));
  const going = events.length > 0 ? ` Going to ${events.slice(0, 3).join(", ")}${events.length > 3 ? " and more" : ""}.` : "";
  const title = `${name} · Sponsor them directly in USDC`;
  const description = `${name} on HiSpace: ${creatorTotalsText(
    totals,
  )}. Your logo on what they carry, content they make, or their time in person.${going} You pay them directly in USDC.`;
  const alt = `${name} on HiSpace`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
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
  };
}

export default async function CreatorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const found = await getPublicCreator(params.handle);
  if (found.kind === "missing") notFound();

  if (found.kind === "unreachable") {
    return (
      <>
        <SlimHeader />
        <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
          <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
            We couldn&rsquo;t load this creator just now.
          </h1>
          <p className="mt-5 max-w-xl text-body text-sp-ink/85">
            This is on our side, not the link. Give it a moment and refresh the page.
          </p>
        </main>
      </>
    );
  }

  const { creator, groups } = found.page;
  const now = Date.now();
  const { current, past } = splitGroups(groups, now);
  const cards = current.flatMap((g) => g.cards);
  const kinds = kindsIn(cards);
  const kind = activeKind(searchParams.kind, kinds);
  const home = creatorPath(creator.xHandle);

  return (
    <ProfileGround ground={creator.pageGround ?? null}>
      <TopBar
        left={
          <KindPills
            kinds={kinds}
            active={kind}
            counts={kindCounts(cards)}
            hrefFor={(k) => (k === "spaces" ? home : `${home}?kind=${k}`)}
          />
        }
        right={past.length > 0 ? <PastEventsLink href={creatorScreenPath(creator.xHandle, PAST)} /> : null}
      />
      <main>
        <CreatorHero creator={creator} openNow={openNowIn(current)} />
        <section className="container-page" aria-label="Where they sell">
          {current.length > 0 ? (
            <GroupGrid handle={creator.xHandle} groups={current} kind={kind} now={now} />
          ) : (
            <p className="text-body text-sp-ink/85">Nothing on sale right now.</p>
          )}
        </section>
      </main>
      <ProfileFooter />
    </ProfileGround>
  );
}
