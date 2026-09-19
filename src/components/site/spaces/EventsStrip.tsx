import Link from "next/link";

import { eventPath } from "@/components/ad-space/events";
import { card, eyebrow, pill } from "@/components/ad-space/ui";
import { SectionHairline } from "@/components/site/SectionHairline";
import { EVENT_TABS, eventDates, openSpots } from "@/lib/ad-space/format";
import { getPublicEvent } from "@/lib/ad-space/server";

/**
 * The events creators are going to next. Creators make events, so these pages
 * exist only once someone has opened one; the slugs are the backend's own
 * `eventSlug(name, city, startsOn)`. Each is looked up at render: a page that
 * answers is linked with its dates and open spots, one that does not becomes
 * an invitation to open the first space there. Never a link to a 404.
 */
const EVENTS = [
  { name: "TOKEN2049", city: "Singapore", slug: "token2049-singapore-2026" },
  { name: "Korea Blockchain Week", city: "Seoul", slug: "korea-blockchain-week-seoul-2026" },
  { name: "Breakpoint", city: "London", slug: "breakpoint-london-2026" },
  { name: "Devcon 8", city: "Mumbai", slug: "devcon-8-mumbai-2026" },
] as const;

type Tile =
  | { kind: "live"; name: string; city: string; href: string; dates: string | null; open: number | null }
  | { kind: "first"; name: string; city: string };

async function tileFor(e: (typeof EVENTS)[number]): Promise<Tile> {
  const found = await getPublicEvent(e.slug, 300);
  if (found.kind === "moved") {
    return { kind: "live", name: e.name, city: e.city, href: eventPath(found.slug), dates: null, open: null };
  }
  if (found.kind !== "found") return { kind: "first", name: e.name, city: e.city };
  const { event, tabs } = found.page;
  const open = EVENT_TABS.reduce((sum, t) => sum + openSpots(tabs[t]), 0);
  const total = EVENT_TABS.reduce((sum, t) => sum + tabs[t].length, 0);
  if (total === 0) return { kind: "first", name: e.name, city: e.city };
  return {
    kind: "live",
    name: event.name,
    city: event.city,
    href: eventPath(event.slug),
    dates: eventDates(event.startsOn, event.endsOn),
    open,
  };
}

export async function EventsStrip({ createHref }: { createHref: string }) {
  const tiles = await Promise.all(EVENTS.map(tileFor));

  return (
    <section id="events" className="relative scroll-mt-20 overflow-hidden bg-abyss">
      <SectionHairline tone="moonlight" />
      <div className="container-page section relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className={`${eyebrow} text-amber`}>Events</p>
            <h2 className="mt-6 font-display text-h3 font-light text-text md:text-h2">Where the hooks are going next.</h2>
          </div>
          <p className="max-w-sm text-small text-text-muted">
            One page per event with every creator going. Brands start here.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <li key={t.name}>
              {t.kind === "live" ? (
                <Link
                  href={t.href}
                  className={`${card} flex h-full flex-col p-6 transition-colors duration-180 hover:bg-white/[0.06]`}
                >
                  <EventHead name={t.name} city={t.city} />
                  {t.dates && <p className="mt-2 text-small text-text-muted">{t.dates}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-8">
                    {t.open !== null && t.open > 0 ? (
                      <span className={pill.open}>
                        {t.open} open {t.open === 1 ? "spot" : "spots"}
                      </span>
                    ) : (
                      <span className={pill.neutral}>Creators going</span>
                    )}
                    <span className="text-small text-amber">See the page</span>
                  </div>
                </Link>
              ) : (
                <a
                  href={createHref}
                  className={`${card} flex h-full flex-col border-dashed p-6 transition-colors duration-180 hover:bg-white/[0.06]`}
                >
                  <EventHead name={t.name} city={t.city} />
                  <p className="mt-2 text-small text-text-muted">Nobody has opened a space here yet.</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-8">
                    <span className={pill.attention}>Be first</span>
                    <span className="text-small text-amber">Create your space</span>
                  </div>
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EventHead({ name, city }: { name: string; city: string }) {
  return (
    <div>
      <p className={`${eyebrow} text-text-faint`}>{city}</p>
      <h3 className="mt-3 font-display text-h4 font-light text-text">{name}</h3>
    </div>
  );
}
