import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  EventBanner,
  EventTabs,
  SpaceCardGrid,
  defaultTab,
  eventPath,
  openSpots,
} from "@/components/ad-space/events";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";
import { eventDates } from "@/lib/ad-space/format";
import { getPublicEvent } from "@/lib/ad-space/server";
import type { SpaceTab } from "@/lib/ad-space/types";

/**
 * /events/<slug> — every creator going to one event, as a sponsor looking for
 * creators there sees it.
 *
 * Server-rendered from `GET /public/events/:slug`, refreshed every 30 s like the
 * API's own cache. Two tabs, named from the sponsor's side: things a creator
 * carries (on the ground) and content they make (on the feed). The tab lives in
 * the URL (`?tab=feed`) so a link to one of them can be shared; without it the
 * page opens on whichever has more open spots.
 *
 * A merged event's old slug answers a 308 to the event it was merged into, so a
 * link already posted on X never breaks.
 */

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function tabParam(searchParams: SearchParams): SpaceTab | null {
  const t = searchParams.tab;
  return t === "ground" || t === "feed" ? t : null;
}

/** Today in UTC: the X card's cache key, so the countdown on it is never a day stale. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPublicEvent(params.slug);
  if (found.kind !== "found") {
    return { title: "Ad Space", robots: { index: false, follow: false } };
  }

  const { event, tabs } = found.page;
  const path = eventPath(event.slug);
  const og = `/api/og/e/${encodeURIComponent(event.slug)}?d=${today()}`;
  const title = `${event.name}, ${event.city} · Sponsor creators going`;
  const description = `Sponsor creators going to ${event.name} in ${event.city}, ${eventDates(
    event.startsOn,
    event.endsOn,
  )}: your logo on what they carry, or content from inside the event. You pay the creator directly in USDC.`;
  const alt = `${event.name}, ${event.city}, ${eventDates(event.startsOn, event.endsOn)}`;
  const hasSpaces = tabs.ground.length + tabs.feed.length > 0;

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
    // An event page with nothing on it is a thin page; it still passes link equity.
    robots: hasSpaces ? undefined : { index: false, follow: true },
  };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const found = await getPublicEvent(params.slug);
  if (found.kind === "missing") notFound();
  if (found.kind === "moved") {
    const tab = tabParam(searchParams);
    permanentRedirect(`${eventPath(found.slug)}${tab ? `?tab=${tab}` : ""}`);
  }

  if (found.kind === "unreachable") {
    return (
      <>
        <SlimHeader />
        <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
          <p className={`${eyebrow} text-amber`}>Ad Space</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
            We couldn&rsquo;t load this event just now.
          </h1>
          <p className="mt-5 max-w-xl text-body text-text-muted">
            This is on our side, not the link. Give it a moment and refresh the page.
          </p>
        </main>
      </>
    );
  }

  const { event, tabs } = found.page;
  const active = tabParam(searchParams) ?? defaultTab(tabs);
  const now = Date.now();
  const total = tabs.ground.length + tabs.feed.length;

  return (
    <>
      <SlimHeader />
      <main>
        <EventBanner event={event} now={now} />
        <section className="container-page py-10 md:py-14" aria-label="Spaces">
          <p className="mb-6 max-w-2xl text-body text-text-muted">
            {total === 0
              ? `Nobody has opened a space for ${event.name} yet.`
              : `Creators going to ${event.name} sell space to sponsors here. Open a card to see what is left and pay the creator directly in USDC.`}
          </p>
          <EventTabs slug={event.slug} eventName={event.name} active={active} tabs={tabs} />
          <div className="mt-8" role="region" aria-label={active === "ground" ? "On the ground" : "On the feed"}>
            <SpaceCardGrid cards={tabs[active]} event={event} tab={active} now={now} />
          </div>
          {/* Visible only when the other tab is where the spots are, so nobody misses it. */}
          {tabs[active].length > 0 && openSpots(tabs[active]) === 0 && openSpots(tabs[active === "ground" ? "feed" : "ground"]) > 0 && (
            <p className="mt-6 text-small text-text-muted">
              Everything here is taken. The other tab still has open spots.
            </p>
          )}
        </section>
      </main>
      <footer className="hairline">
        <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-md flex-col gap-3">
            <Wordmark className="h-5 w-auto self-start text-text" />
            <p className="text-small text-text-muted">
              Powered by HOLD. Sponsors pay creators directly in USDC, and HOLD never holds the money. HOLD is not
              affiliated with {event.name}.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-small" aria-label="Ad Space">
            <DownloadLink className="text-text-muted transition-colors duration-180 hover:text-text">
              Open your own space
            </DownloadLink>
          </nav>
        </div>
      </footer>
    </>
  );
}
