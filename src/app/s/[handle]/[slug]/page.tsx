import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { creatorPath } from "@/components/ad-space/creator";
import { SpacesGround } from "@/components/ad-space/ground";
import { PartnersRow } from "@/components/ad-space/organiser";
import { SpaceBoard } from "@/components/ad-space/SpaceBoard";
import { StudioSections } from "@/components/ad-space/StudioSections";
import {
  BeforeYouPay,
  HowItWorks,
  ListingHead,
  SpaceFooter,
  SpaceInvite,
  SpaceStats,
  SpaceUnavailable,
  SlimHeader,
  SpaceUpdates,
} from "@/components/ad-space/sections";
import { btnPrimary, eyebrow } from "@/components/ad-space/ui";
import { t, type LocaleCode } from "@/lib/app/i18n";
import { applyRequestLocale, inEnglish } from "@/lib/app/i18n/server";
import type { Space } from "@/lib/ad-space/types";
import { isSessionSpace, serviceName, spaceProgressText, spaceSoldOut } from "@/lib/ad-space/format";
import { getPublicCreator, getPublicSpace } from "@/lib/ad-space/server";
import { effectOf } from "@/lib/ad-space/studio";

/**
 * /s/<handle>/<slug> — a creator's Ad Space, as a sponsor arriving from X
 * sees it.
 *
 * Server-rendered from `GET /public/spaces/by-path/:handle/:slug`, refreshed
 * every 10 s like the API's own cache. Everything interactive (the board, the
 * spots, the checkout) is one client island; the rest is plain HTML so the
 * page is readable before any JavaScript arrives.
 *
 * Laid out like the creator's own campaign page: the listing's own picture (the
 * creator's banner, else the product with its spots live on it, else their
 * gradient; never the event's photo), then the numbers in big type, what you
 * get, how it works, and every spot. A space for an event links back to it.
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
    return { title: "HiSpace", robots: { index: false, follow: false } };
  }

  return inEnglish(() => spaceMetadata(found.space, searchParams));
}

/** The space's title and link card, in English (see `inEnglish`). */
function spaceMetadata(s: Space, searchParams: SearchParams): Metadata {
  const handle = s.creator.xHandle;
  const path = `/s/${encodeURIComponent(handle)}/${encodeURIComponent(s.slug)}`;
  const og = `/api/og${path}?m=${milestone(searchParams, s.totals.sold)}`;
  // Counted as the hero counts it: a takeover board is not sold out while a spot can be taken.
  const progress = spaceProgressText(s);
  const name = s.template.service?.custom ? serviceName(s) : serviceName(s).toLowerCase();
  const where = s.event ? ` for ${s.event.name} in ${s.event.city}` : s.eventName ? ` for ${s.eventName}` : "";
  const title = `${s.title} · @${handle}`;
  const description = isSessionSpace(s)
    ? `Book @${handle}, ${name}${s.event ? ` at ${s.event.name} in ${s.event.city}` : s.eventName ? ` at ${s.eventName}` : ""}: ${progress.charAt(0).toLowerCase()}${progress.slice(1)}. You pay the creator directly in USDC.`
    : `${progress} on @${handle}'s ${name}${where}. Sponsors pay the creator directly in USDC.`;
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
  // The viewer's language, before anything below draws a word.
  const language = await applyRequestLocale();
  const found = await getPublicSpace(params.handle, params.slug);
  if (found.kind === "missing") {
    // Gone (sold, closed, taken down), but the creator still sells: their own page, never anyone else's.
    const hub = await getPublicCreator(params.handle);
    if (hub.kind !== "found") notFound();
    return <GoneToCreator handle={hub.page.creator.xHandle} language={language} />;
  }
  // Nothing more to take here: the creator's own page, when it has something open.
  const more =
    found.kind === "found" && (found.space.status !== "live" || spaceSoldOut(found.space))
      ? await hubPath(found.space.creator.xHandle)
      : null;

  return (
    <SpacesGround
      ground={found.kind === "found" ? found.space.pageGround ?? null : null}
      effect={found.kind === "found" ? effectOf(found.space.effect) : "none"}
    >
      {found.kind === "unreachable" ? (
        <>
          <SlimHeader language={language} />
          <main>
            <SpaceUnavailable />
          </main>
        </>
      ) : (
        <>
          <main className="overflow-x-clip">
            <SpaceBoard
              space={found.space}
              head={<ListingHead space={found.space} language={language} />}
              stats={<SpaceStats space={found.space} more={more} />}
              details={
                <>
                  {/* A partnership package's partners, once the host has taken some on. */}
                  {(found.space.partners?.length ?? 0) > 0 && (
                    <div className="container-page pt-8 md:pt-10">
                      <PartnersRow partners={found.space.partners} />
                    </div>
                  )}
                  <BeforeYouPay space={found.space} />
                  <StudioSections space={found.space} />
                  <HowItWorks space={found.space} />
                </>
              }
            />
            <SpaceUpdates space={found.space} />
            <SpaceInvite space={found.space} />
          </main>
          <SpaceFooter space={found.space} />
        </>
      )}
    </SpacesGround>
  );
}

/** The creator's own page, or null when it has nothing a brand could buy (it would answer 404). */
async function hubPath(handle: string): Promise<string | null> {
  const hub = await getPublicCreator(handle);
  return hub.kind === "found" ? creatorPath(hub.page.creator.xHandle) : null;
}

/**
 * A space the API no longer serves, from a creator who still sells. Like the
 * not-found it never says why (a delisted space's reason is between us and
 * its creator); it sends the brand to the creator's own page.
 */
function GoneToCreator({ handle, language }: { handle: string; language: { locale: LocaleCode; chosen: boolean } }) {
  return (
    <>
      <SlimHeader language={language} />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
          {t("publicPages.space.goneTitle")}
        </h1>
        <div className="mt-10">
          <Link href={creatorPath(handle)} className={btnPrimary}>
            {t("board.stats.seeMore", { handle })}
          </Link>
        </div>
      </main>
    </>
  );
}
