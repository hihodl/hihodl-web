"use client";

/**
 * Spaces › Inspire (the app's Inspire tab): start a listing from a template,
 * or see the events where other creators are selling.
 */

import Link from "next/link";

import { eventDates } from "@/lib/ad-space/format";
import { SITE_URL } from "@/lib/ad-space/config";
import type { EventSummary } from "@/lib/ad-space/types";
import type { Template } from "@/lib/creator/listing";
import { useTemplates } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { dollars, EmptyState, glass, LinkTabs, Panel, Skeleton } from "../ui";
import { ReadError } from "./common";

type Tab = "templates" | "events";

export function InspireScreen({ events, tab }: { events: EventSummary[]; tab: string | null }) {
  const href = useHref();
  const active: Tab = tab === "events" ? "events" : "templates";

  return (
    <div className="flex flex-col gap-4">
      <LinkTabs
        active={active}
        tabs={[
          { key: "templates", label: "Templates", href: href("/inspire") },
          { key: "events", label: "Events", count: events.length || undefined, href: `${href("/inspire")}?tab=events` },
        ]}
      />
      {active === "templates" ? <Templates /> : <Events events={events} />}
    </div>
  );
}

function Templates() {
  const templates = useTemplates();
  if (templates.error) return <ReadError error={templates.error} />;
  if (!templates.data) return <Skeleton className="h-72" />;
  const list = templates.data.templates;
  const services = list.filter((t) => t.kind === "service");
  const placements = list.filter((t) => t.kind === "placement");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      <Group title="Services" list={services} />
      <Group title="Spaces" list={placements} />
    </div>
  );
}

function Group({ title, list }: { title: string; list: readonly Template[] }) {
  const href = useHref();
  return (
    <Panel title={title} meta={`${list.length}`}>
      {list.length === 0 ? (
        <EmptyState title="None available." />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
          {list.map((t) => {
            const price = t.service?.suggestedPriceCents ?? t.zones.find((z) => z.suggestedPriceCents)?.suggestedPriceCents ?? null;
            return (
              <li key={t.id}>
                <Link
                  href={`${href("/listings/new")}?template=${encodeURIComponent(t.id)}`}
                  className="flex h-full min-w-0 flex-col gap-1 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.07]"
                >
                  <span className="truncate text-small text-text">{t.name}</span>
                  <span className="truncate text-[11px] text-[#9FB7C2]">
                    {t.kind === "service"
                      ? t.service?.format === "session"
                        ? "Session"
                        : "Content"
                      : `${t.zones.length} ${t.zones.length === 1 ? "spot" : "spots"}`}
                    {price ? ` · from ${dollars(price)}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Events({ events }: { events: EventSummary[] }) {
  if (events.length === 0) {
    return (
      <Panel>
        <EmptyState title="No events with live listings." />
      </Panel>
    );
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <a
            href={`${SITE_URL}/events/${e.slug}`}
            target="_blank"
            rel="noreferrer"
            className={`${glass} flex h-full min-w-0 flex-col gap-1 overflow-hidden transition-colors hover:bg-white/[0.06]`}
          >
            {e.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.coverUrl} alt="" className="h-24 w-full object-cover opacity-80" />
            ) : (
              <div className="h-24 w-full bg-[linear-gradient(135deg,rgba(91,124,255,0.25),rgba(255,183,3,0.12))]" />
            )}
            <div className="flex flex-col gap-1 p-3">
              <span className="truncate text-small text-text">{e.name}</span>
              <span className="truncate text-[11px] text-[#9FB7C2]">
                {e.city} · {eventDates(e.startsOn, e.endsOn)} · {e.spaceCount} {e.spaceCount === 1 ? "listing" : "listings"}
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
