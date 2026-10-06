import type { Metadata } from "next";

import { ClaimIt } from "@/components/ad-space/ClaimIt";
import { ProfileFooter } from "@/components/ad-space/creator";
import { BannerFrame, EventMiniCard, eventBanner } from "@/components/ad-space/events";
import { SpacesGround } from "@/components/ad-space/ground";
import {
  CalendarEvents,
  CreatorsGoing,
  HostLine,
  OrganiserPackages,
  SponsorTheWeek,
  hostName,
} from "@/components/ad-space/organiser";
import { SlimHeader } from "@/components/ad-space/sections";
import { btnPrimary, eyebrow } from "@/components/ad-space/ui";
import { DownloadLink } from "@/components/site/DownloadLink";
import { eventDates } from "@/lib/ad-space/format";
import { getPackageSpaces, getSponsorPage } from "@/lib/ad-space/server";
import type { LumaTeaser, SponsorPage as SponsorPageData } from "@/lib/ad-space/types";
import { t, type LocaleCode } from "@/lib/app/i18n";
import { applyRequestLocale, inEnglish } from "@/lib/app/i18n/server";
import { lumaKeyOf, lumaUrlOf } from "@/lib/app/organiser-rules";

/**
 * /sponsor/<lumaKey> — the link a Luma host puts where their page asks who
 * wants to sponsor (organiser-sells-its-event-contract.md). `lumaKey` is the
 * Luma path: `luma.com/breakpoint2026` is `/sponsor/breakpoint2026`.
 *
 * Server-rendered from `GET /public/sponsor/:lumaKey`, refreshed every 30 s
 * like the event page. The event, its verified host, the host's packages with
 * Buy, Make an offer and Get a quote right on each row, then the creators going,
 * counted per tab and linking into the event page.
 *
 * A Luma event that is not selling on HOLD, and any 404 from a backend older
 * than this page, shows the invitation to the host instead: never an error.
 * The path stays on the web; the app's associated domains do not claim it.
 */

type Params = { lumaKey: string };

/** Today in UTC: the X card's cache key, as on the event page. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sponsorPath(lumaKey: string): string {
  return `/sponsor/${encodeURIComponent(lumaKey)}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await getSponsorPage(params.lumaKey);
  if (found.kind !== "found") {
    const name = found.kind === "notOnHold" ? found.luma?.name : null;
    return {
      title: name ? `${name} · Sponsor it on HOLD` : "Sponsor on HOLD",
      robots: { index: false, follow: false },
    };
  }
  return inEnglish(() => sponsorMetadata(params.lumaKey, found.page));
}

/** The title and link card, in English (see `inEnglish`). */
function sponsorMetadata(lumaKey: string, { event, packages, kind }: SponsorPageData): Metadata {
  const path = sponsorPath(lumaKey);
  const og = `/api/og/sponsor/${encodeURIComponent(lumaKey)}?d=${today()}`;
  const host = event.organiser ? hostName(event.organiser) : null;
  const dates = eventDates(event.startsOn, event.endsOn);
  const calendar = kind === "calendar";
  const title = calendar ? `Sponsor the week: ${event.name}` : `Sponsor ${event.name}, ${event.city}`;
  const description = calendar
    ? `Sponsor packages from ${host ?? "the host"} across ${event.name}, ${dates}. Pay in USDC and your brand is on the whole week.`
    : `${packages.length > 0 ? `Sponsor packages from ${host ?? "the host"}` : "Sponsor the creators going"} at ${event.name} in ${event.city}, ${dates}. Pay in USDC and your brand is in.`;
  const alt = `${event.name}, ${event.city}, ${dates}`;
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
  };
}

export default async function SponsorPage({ params }: { params: Params }) {
  const language = await applyRequestLocale();
  const found = await getSponsorPage(params.lumaKey);

  if (found.kind === "unreachable") {
    return (
      <SpacesGround>
        <SlimHeader language={language} />
        <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
          <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
            {t("publicPages.event.unreachableTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-body text-sp-ink/85">{t("board.unavailable.body")}</p>
        </main>
      </SpacesGround>
    );
  }

  if (found.kind === "notOnHold") return <NotOnHold lumaKey={params.lumaKey} luma={found.luma} language={language} />;

  const { event, packages, creators, slug, kind, events, calendar } = found.page;
  const isCalendar = kind === "calendar";
  const organiser = event.organiser;
  const now = Date.now();
  const spaces = await getPackageSpaces(packages);

  return (
    <SpacesGround>
      <SlimHeader language={language} />
      <main>
        <BannerFrame banner={eventBanner(event)} className="flex min-h-[320px] sm:min-h-[380px] md:min-h-[440px]">
          <div className="container-page relative flex w-full flex-col justify-end gap-3 pb-10 pt-6">
            <p className={`${eyebrow} text-white/85`}>
              {isCalendar ? t("publicPages.sponsor.calendar.eyebrow") : t("publicPages.sponsor.eyebrow")}
            </p>
            <EventMiniCard event={event} now={now} as="h1" />
            {organiser && <HostLine organiser={organiser} />}
          </div>
        </BannerFrame>
        <div className="container-page flex flex-col gap-14 py-10 md:gap-16 md:py-14">
          {!isCalendar && <SponsorTheWeek calendar={calendar} />}
          {organiser && (
            <OrganiserPackages organiser={organiser} packages={packages} spaces={spaces} now={now} calendar={isCalendar} />
          )}
          {/* A calendar has no creators of its own: its events do, each on its own page. */}
          {isCalendar ? (
            <CalendarEvents calendarName={event.name} events={events} />
          ) : (
            <CreatorsGoing slug={slug} eventName={event.name} counts={creators} />
          )}
        </div>
      </main>
      <ProfileFooter />
    </SpacesGround>
  );
}

/**
 * Nobody sells this event on HOLD yet. What the backend knows of the Luma page
 * (name, cover, date, city) when it knows it, then the one line that matters to
 * the person most likely to land here: its host.
 */
function NotOnHold({
  lumaKey,
  luma,
  language,
}: {
  lumaKey: string;
  luma: LumaTeaser | null;
  language: { locale: LocaleCode; chosen: boolean };
}) {
  const day = luma?.startAt && /^\d{4}-\d{2}-\d{2}/.test(luma.startAt) ? luma.startAt.slice(0, 10) : null;
  const line = [luma?.city, day ? eventDates(day, day) : null].filter(Boolean).join(" · ");
  return (
    <SpacesGround>
      <SlimHeader language={language} />
      <main>
        {luma && (
          <BannerFrame banner={eventBanner({ coverUrl: luma.coverUrl })} className="flex min-h-[220px] md:min-h-[300px]">
            <div className="container-page relative flex w-full flex-col justify-end pb-8 pt-6">
              <p className="break-words font-display text-h4 font-light leading-tight text-white [overflow-wrap:anywhere]">
                {luma.name}
              </p>
              {line && <p className="mt-1 text-small text-white/85">{line}</p>}
            </div>
          </BannerFrame>
        )}
        <section className={`container-page flex flex-col items-start ${luma ? "py-12 md:py-16" : "min-h-[60vh] justify-center py-20"}`}>
          <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
          <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
            {t("publicPages.sponsor.notOnHold.title")}
          </h1>
          <p className="mt-4 max-w-xl text-body text-sp-ink/85">{t("publicPages.sponsor.notOnHold.body")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* The host signed in on the web claims it there; the app does it too. */}
            {lumaKeyOf(lumaUrlOf(lumaKey)) ? <ClaimIt lumaKey={lumaKey} /> : null}
            <DownloadLink className={btnPrimary}>{t("publicPages.sponsor.notOnHold.getHold")}</DownloadLink>
          </div>
        </section>
      </main>
      <ProfileFooter />
    </SpacesGround>
  );
}
