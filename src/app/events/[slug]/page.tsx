import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProfileFooter } from "@/components/ad-space/creator";
import { EventBanner, EventTabs, SpaceCardGrid, TAB_NAME, eventPath } from "@/components/ad-space/events";
import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";
import { SLUG_RE } from "@/lib/ad-space/config";
import { EVENT_TABS, eventDates, openSpots } from "@/lib/ad-space/format";
import { getPublicEvent } from "@/lib/ad-space/server";
import type { SpaceTab } from "@/lib/ad-space/types";

/**
 * /events/<slug> — every creator going to one event, as a sponsor looking for
 * creators there sees it.
 *
 * Server-rendered from `GET /public/events/:slug`, refreshed every 30 s like the
 * API's own cache. Three tabs, named from the buyer's side: things a creator
 * carries (on the ground), content they make (on the feed) and their time in
 * person (in the room). The tab lives in the URL (`?tab=room`) so a link to one
 * of them can be shared; without it the page opens on the API's `defaultTab`.
 *
 * A merged event's old slug answers a 308 to the event it was merged into, so a
 * link already posted on X never breaks.
 */

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function tabParam(searchParams: SearchParams): SpaceTab | null {
  const t = searchParams.tab;
  return t === "ground" || t === "feed" || t === "room" ? t : null;
}

/** Today in UTC: the X card's cache key, so the countdown on it is never a day stale. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPublicEvent(params.slug);
  if (found.kind !== "found") {
    return { title: "HiSpace", robots: { index: false, follow: false } };
  }

  const { event, tabs } = found.page;
  const path = eventPath(event.slug);
  const og = `/api/og/e/${encodeURIComponent(event.slug)}?d=${today()}`;
  const title = `${event.name}, ${event.city} · Sponsor creators going`;
  const offers =
    tabs.room.length > 0
      ? "your logo on what they carry, content from inside the event, or their time in person"
      : "your logo on what they carry, or content from inside the event";
  const description = `Sponsor creators going to ${event.name} in ${event.city}, ${eventDates(
    event.startsOn,
    event.endsOn,
  )}: ${offers}. You pay the creator directly in USDC.`;
  const alt = `${event.name}, ${event.city}, ${eventDates(event.startsOn, event.endsOn)}`;
  const hasSpaces = EVENT_TABS.some((t) => tabs[t].length > 0);

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
  // Slugs are lowercase. "/events/TOKEN2049-Singapore-2026", typed from a
  // poster, is the same event: send it to the one address that exists.
  const lower = params.slug.toLowerCase();
  if (lower !== params.slug && SLUG_RE.test(lower)) {
    const tab = tabParam(searchParams);
    permanentRedirect(`${eventPath(lower)}${tab ? `?tab=${tab}` : ""}`);
  }

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
          <p className={`${eyebrow} text-amber`}>HiSpace</p>
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

  const { event, tabs, defaultTab } = found.page;
  const active = tabParam(searchParams) ?? defaultTab;
  const now = Date.now();
  const total = EVENT_TABS.reduce((sum, t) => sum + tabs[t].length, 0);
  const openElsewhere = EVENT_TABS.some((t) => t !== active && openSpots(tabs[t]) > 0);

  return (
    <>
      <SlimHeader />
      <main>
        <EventBanner event={event} now={now} />
        <section className="container-page py-10 md:py-14" aria-label="Spaces">
          {total === 0 && (
            <p className="mb-6 max-w-2xl break-words text-body text-text-muted [overflow-wrap:anywhere]">
              Nobody has opened a space for {event.name} yet.
            </p>
          )}
          <EventTabs slug={event.slug} eventName={event.name} active={active} tabs={tabs} />
          <div className="mt-8" role="region" aria-label={TAB_NAME[active]}>
            <SpaceCardGrid cards={tabs[active]} event={event} tab={active} now={now} />
          </div>
          {/* Visible only when the other tab is where the spots are, so nobody misses it. */}
          {tabs[active].length > 0 && openSpots(tabs[active]) === 0 && openElsewhere && (
            <p className="mt-6 text-small text-text-muted">
              Everything here is taken. Another tab still has open spots.
            </p>
          )}
        </section>
      </main>
      {/* The HOLD mark, and the one sentence that has to stay: this page uses the
          event's name and picture without being the event. */}
      <ProfileFooter note={`HOLD is not affiliated with ${event.name}.`} />
    </>
  );
}
