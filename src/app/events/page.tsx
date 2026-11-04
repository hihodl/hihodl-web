import type { Metadata } from "next";
import Link from "next/link";

import { ProfileFooter } from "@/components/ad-space/creator";
import { BannerFrame, eventBanner, eventPath } from "@/components/ad-space/events";
import { SpacesGround } from "@/components/ad-space/ground";
import { VerifiedHostPill } from "@/components/ad-space/organiser";
import { SlimHeader } from "@/components/ad-space/sections";
import { card as cardClass, eyebrow } from "@/components/ad-space/ui";
import { eventCountdown, eventDates } from "@/lib/ad-space/format";
import { listUpcomingEvents } from "@/lib/ad-space/server";
import type { ListedEvent } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";
import { applyRequestLocale } from "@/lib/app/i18n/server";

/**
 * /events — upcoming events with something a sponsor can buy: the host's own
 * packages, or creators going with open spots.
 *
 * Server-rendered from `GET /public/events`, refreshed every minute. Two
 * filters, both in the URL so a filtered list can be shared: `?packages=1`
 * (only events whose verified host sells packages, `hasPackages=true` on the
 * API) and `?city=<name>`, drawn from the cities in the list itself.
 */

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Events to sponsor",
  description: "Upcoming events with packages from the host or creators going. Sponsor them on HOLD, paid in USDC.",
  alternates: { canonical: "/events" },
  openGraph: { type: "website", url: "/events", siteName: "HOLD", title: "Events to sponsor", locale: "en_US" },
};

function one(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}

/** Something to buy there: a package, or an open spot on a creator's space. */
function sellsSomething(e: ListedEvent): boolean {
  return (e.packages ?? 0) > 0 || (typeof e.openSpots === "number" ? e.openSpots > 0 : true);
}

function href(packagesOnly: boolean, city: string | null): string {
  const q = new URLSearchParams();
  if (packagesOnly) q.set("packages", "1");
  if (city) q.set("city", city);
  const s = q.toString();
  return s ? `/events?${s}` : "/events";
}

export default async function EventsIndex({ searchParams }: { searchParams: SearchParams }) {
  const language = await applyRequestLocale();
  const packagesOnly = one(searchParams.packages) === "1";
  const rows = await listUpcomingEvents({ hasPackages: packagesOnly });
  const now = Date.now();

  const listed = (rows ?? []).filter(sellsSomething);
  const cities = Array.from(new Set(listed.map((e) => e.city).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const asked = one(searchParams.city);
  const city = asked && cities.includes(asked) ? asked : null;
  const events = city ? listed.filter((e) => e.city === city) : listed;

  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-[18px] border px-3.5 text-small transition-colors duration-180 ${
      on
        ? "border-amber/50 bg-amber/[0.1] text-sp-amber"
        : "border-[color:var(--color-hairline-strong)] text-sp-ink hover:bg-sp-ink/[0.06]"
    }`;

  return (
    <SpacesGround>
      <SlimHeader language={language} />
      <main className="container-page py-10 md:py-14">
        <p className={`${eyebrow} text-sp-amber`}>HOLD</p>
        <h1 className="mt-4 font-display text-h3 font-light text-sp-ink md:text-h2">{t("publicPages.eventsIndex.title")}</h1>
        <p className="mt-3 max-w-2xl text-body text-sp-ink/85">{t("publicPages.eventsIndex.sub")}</p>

        <nav aria-label={t("publicPages.eventsIndex.filter")} className="mt-8 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href={href(false, city)} className={chip(!packagesOnly)} aria-current={!packagesOnly ? "page" : undefined}>
              {t("publicPages.eventsIndex.all")}
            </Link>
            <Link href={href(true, city)} className={chip(packagesOnly)} aria-current={packagesOnly ? "page" : undefined}>
              {t("publicPages.eventsIndex.withPackages")}
            </Link>
          </div>
          {cities.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              <Link href={href(packagesOnly, null)} className={chip(!city)}>
                {t("publicPages.eventsIndex.everyCity")}
              </Link>
              {cities.map((c) => (
                <Link key={c} href={href(packagesOnly, c)} className={chip(city === c)}>
                  {c}
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="mt-8">
          {rows === null ? (
            <p className="text-body text-sp-ink/85">{t("publicPages.eventsIndex.unreachable")}</p>
          ) : events.length === 0 ? (
            <p className="text-body text-sp-ink/85">{t("publicPages.eventsIndex.empty")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <li key={e.id ?? e.slug} className="flex min-w-0">
                  <EventTile event={e} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <ProfileFooter />
    </SpacesGround>
  );
}

function EventTile({ event: e, now }: { event: ListedEvent; now: number }) {
  const countdown = eventCountdown(e.startsOn, e.endsOn, now);
  const packages = e.packages ?? 0;
  const counts = [
    packages > 0 ? t("publicPages.eventsIndex.packages", { count: packages }) : null,
    typeof e.openSpots === "number" && e.openSpots > 0 ? t("publicPages.eventsIndex.openSpots", { count: e.openSpots }) : null,
  ].filter(Boolean);
  return (
    <Link
      href={eventPath(e.slug)}
      className={`${cardClass} group flex w-full min-w-0 flex-col overflow-hidden transition-colors duration-180 hover:border-[color:var(--color-hairline-strong)] hover:bg-sp-ink/[0.05]`}
    >
      <BannerFrame banner={eventBanner(e)} className="aspect-[16/9] w-full shrink-0">
        <span
          className={`absolute left-3 top-3 inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-[#141F2E]/70 px-2.5 text-tiny backdrop-blur-md ${
            countdown.phase === "now" ? "text-sp-amber" : "text-white"
          }`}
        >
          {countdown.phase === "upcoming"
            ? t("offers.events.starts", { when: countdown.text })
            : countdown.text.charAt(0).toUpperCase() + countdown.text.slice(1)}
        </span>
      </BannerFrame>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <h2 className="line-clamp-2 break-words text-body text-sp-ink [overflow-wrap:anywhere] group-hover:text-sp-amber">{e.name}</h2>
        <p className="truncate text-small text-sp-ink/85">
          {e.city} · {eventDates(e.startsOn, e.endsOn)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
          {e.organiser && <VerifiedHostPill organiser={e.organiser} />}
          {counts.length > 0 && <span className="text-tiny tabular-nums text-sp-ink/80">{counts.join(" · ")}</span>}
        </div>
      </div>
    </Link>
  );
}
