import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BackLink,
  GroupGrid,
  GroupHeader,
  KindPills,
  PAST,
  ProfileFooter,
  ProfileGround,
  SCREEN_LIMIT,
  TopBar,
  activeKind,
  cardKind,
  creatorPath,
  creatorScreenPath,
  findGroup,
  kindCounts,
  kindsIn,
  splitGroups,
} from "@/components/ad-space/creator";
import { SpaceCardGrid } from "@/components/ad-space/events";
import { SlimHeader } from "@/components/ad-space/sections";
import { btnSmallSecondary, eyebrow } from "@/components/ad-space/ui";
import { getPublicCreator } from "@/lib/ad-space/server";

/**
 * The screens under a creator's page:
 *
 *   /s/<handle>/events/<eventSlug>   what they sell at one event
 *   /s/<handle>/events/all-year      what they sell tied to no event
 *   /s/<handle>/events/past          the events that are over, as banners
 *
 * Same data as `/s/<handle>` (one fetch, same 30 s cache), cut to one group.
 * At most six listings show; a creator with more gets "Show all" (`?all=1`)
 * rather than a longer page by default. An event that is over reads as closed:
 * nothing on it can be bought, it is there as a record.
 *
 * Why this path is safe from listing slugs and event slugs: see `creator.tsx`.
 */

type Params = { handle: string; group: string };
type SearchParams = Record<string, string | string[] | undefined>;

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getPublicCreator(params.handle);
  if (found.kind !== "found") return { title: "HiSpace", robots: { index: false, follow: false } };

  const { creator, groups } = found.page;
  const name = creator.xName || `@${creator.xHandle}`;
  const og = `/api/og/c/${encodeURIComponent(creator.xHandle)}?d=${new Date().toISOString().slice(0, 10)}`;

  let title: string;
  let path: string;
  if (params.group.toLowerCase() === PAST) {
    title = `${name} · Past events`;
    path = creatorScreenPath(creator.xHandle, PAST);
  } else {
    const hit = findGroup(groups, params.group, Date.now());
    if (!hit) return { title: "HiSpace", robots: { index: false, follow: false } };
    const where = hit.group.event ? `at ${hit.group.event.name}` : "all year";
    title = `${name} ${where} · Sponsor them directly in USDC`;
    path = creatorScreenPath(creator.xHandle, hit.group.event ? hit.group.event.slug : params.group.toLowerCase());
  }

  return {
    title,
    alternates: { canonical: path },
    openGraph: { type: "profile", url: path, siteName: "HOLD", title, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", site: "@hiihodl", title, images: [{ url: og }] },
  };
}

export default async function CreatorGroupScreen({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
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
  const handle = creator.xHandle;
  const name = creator.xName || `@${handle}`;
  const home = creatorPath(handle);

  /* The past: a grid of the events that are over, each opening its own screen. */
  if (params.group.toLowerCase() === PAST) {
    const { past } = splitGroups(groups, now);
    if (past.length === 0) notFound();
    return (
      <ProfileGround>
        <TopBar left={<BackLink href={home} label={name} />} />
        <main className="container-page w-full">
          <h1 className="pb-6 pt-6 font-display text-[36px] font-light leading-[1.05] text-sp-ink md:pb-10 md:pt-10 md:text-h2">
            Past events
          </h1>
          <GroupGrid handle={handle} groups={past} kind={null} now={now} over />
        </main>
        <ProfileFooter />
      </ProfileGround>
    );
  }

  const hit = findGroup(groups, params.group, now);
  if (!hit) notFound();
  const { group, over } = hit;
  const { event } = group;

  const kinds = over ? [] : kindsIn(group.cards);
  const kind = activeKind(searchParams.kind, kinds);
  const cards = kind ? group.cards.filter((c) => cardKind(c) === kind) : group.cards;
  const showAll = searchParams.all === "1";
  const visible = showAll ? cards : cards.slice(0, SCREEN_LIMIT);
  const key = event ? event.slug : params.group.toLowerCase();
  const here = (k: string | null, all = false) => {
    const q = new URLSearchParams();
    if (k && k !== "spaces") q.set("kind", k);
    if (all) q.set("all", "1");
    const s = q.toString();
    return `${creatorScreenPath(handle, key)}${s ? `?${s}` : ""}`;
  };
  // Back goes where the reader came from: the past list for an event that is
  // over, the profile (on the same pill) for everything else.
  const back = over ? creatorScreenPath(handle, PAST) : kind === "services" ? `${home}?kind=services` : home;

  return (
    <ProfileGround>
      <TopBar
        left={<BackLink href={back} label={over ? "Past events" : name} />}
        right={<KindPills kinds={kinds} active={kind} counts={kindCounts(group.cards)} hrefFor={(k) => here(k)} />}
      />
      <main>
        <div className="container-page">
          <div className="mt-4 overflow-hidden rounded-card md:mt-6">
            <GroupHeader event={event} now={now} />
          </div>
        </div>
        <section className="container-page pt-6 md:pt-8" aria-label="Listings">
          <SpaceCardGrid cards={visible} event={event} tab={null} now={now} showCreator={false} readOnly={over} />
          {visible.length < cards.length && (
            <div className="mt-8 flex justify-center">
              <Link href={here(kind, true)} scroll={false} className={btnSmallSecondary}>
                Show all {cards.length}
              </Link>
            </div>
          )}
        </section>
      </main>
      <ProfileFooter note={event ? `HOLD is not affiliated with ${event.name}.` : undefined} />
    </ProfileGround>
  );
}
