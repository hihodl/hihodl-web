import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CreatorGroups, CreatorHero, creatorPath } from "@/components/ad-space/creator";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";
import { creatorTotalsText } from "@/lib/ad-space/format";
import { getPublicCreator } from "@/lib/ad-space/server";

/**
 * /s/<handle> — one creator, everything they sell, grouped by where they are
 * going. The link a creator pins to their profile.
 *
 * Server-rendered from `GET /public/creators/:handle`, refreshed every 30 s like
 * the event page it sits beside. The order of the groups is the server's —
 * upcoming events, then past ones, then whatever is tied to no event — and this
 * page keeps it exactly as it arrives.
 *
 * Every event section ends with the way on to `/events/<slug>`. That is not a
 * footnote: a brand who scans this creator and is not convinced is one click
 * from the other creators going to the same event, and each hub shared on X
 * therefore advertises every event on it.
 */

type Params = { handle: string };

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
  const events = groups.map((g) => g.event?.name).filter((n): n is string => Boolean(n));
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

export default async function CreatorPage({ params }: { params: Params }) {
  const found = await getPublicCreator(params.handle);
  if (found.kind === "missing") notFound();

  if (found.kind === "unreachable") {
    return (
      <>
        <SlimHeader />
        <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
          <p className={`${eyebrow} text-amber`}>HiSpace</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
            We couldn&rsquo;t load this creator just now.
          </h1>
          <p className="mt-5 max-w-xl text-body text-text-muted">
            This is on our side, not the link. Give it a moment and refresh the page.
          </p>
        </main>
      </>
    );
  }

  const { creator, groups, totals } = found.page;
  const name = creator.xName || `@${creator.xHandle}`;
  const now = Date.now();

  return (
    <>
      <SlimHeader />
      <main>
        <CreatorHero creator={creator} totals={totals} />
        <CreatorGroups groups={groups} now={now} />
      </main>
      <footer className="hairline">
        <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-md flex-col gap-3">
            <Wordmark className="h-5 w-auto self-start text-text" />
            <p className="text-small text-text-muted">
              Powered by HOLD. You pay {name} directly in USDC, and HOLD never holds the money.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-small" aria-label="HiSpace">
            <DownloadLink className="text-text-muted transition-colors duration-180 hover:text-text">
              Open your own space
            </DownloadLink>
          </nav>
        </div>
      </footer>
    </>
  );
}
