"use client";

/**
 * Spaces › Inspire: what other creators have sold ad space on, by event.
 *
 * Three screens, each a card that opens the next with its own Back:
 *
 *   hub       event cards, each with its count ("TOKEN2049 Singapore 41")
 *   ?event=   that event's campaigns, filtered by surface
 *   &c=       one campaign: what it was, the creator's own links, and
 *             "Use this idea", which opens the listing editor on the closest
 *             template and credits the creator as "Inspired by @handle"
 *
 * Two sources on the same cards: every published HOLD listing, marked "On
 * HOLD", and campaigns imported once from the public sponsor me index by
 * @emilylai, marked "via sponsorme index" and credited on every screen that
 * shows one. Those creators are not on HOLD and nothing here says they are.
 * No amounts raised, no spots left: what a campaign IS, never how it went.
 */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { eventDates } from "@/lib/ad-space/format";
import { SITE_URL } from "@/lib/ad-space/config";
import { useInspireCampaigns, useInspireEvents } from "@/lib/app/spaces-data";
import {
  ANYTIME,
  ideaQuery,
  PRICING_LABEL,
  SURFACE_LABEL,
  type InspireCampaign,
  type InspireCredit,
  type InspireEvent,
  type SurfaceKind,
} from "@/lib/creator/inspire";

import { useHref } from "../base";
import { IconCalendar, IconInspire } from "../icons";
import { EmptyState, FilterPills, Panel, Skeleton } from "../ui";
import { cardCls, CardGrid, DrillBar, Pager, usePaged } from "./cards";
import { ReadError } from "./common";

export function InspireScreen({ event, campaign }: { event: string | null; campaign: string | null }) {
  if (!event) return <Hub />;
  if (campaign) return <CampaignScreen slug={event} id={campaign} />;
  return <EventScreen slug={event} />;
}

/* ── Links ────────────────────────────────────────────────────────── */

function useInspireHref() {
  const href = useHref();
  return {
    hub: href("/inspire"),
    event: (slug: string) => `${href("/inspire")}?event=${encodeURIComponent(slug)}`,
    campaign: (slug: string, id: string) => `${href("/inspire")}?event=${encodeURIComponent(slug)}&c=${encodeURIComponent(id)}`,
    idea: (c: InspireCampaign) => `${href("/listings/new")}${ideaQuery(c)}`,
  };
}

function where(e: Pick<InspireEvent, "city" | "startsOn" | "endsOn" | "slug">): string {
  if (e.slug === ANYTIME) return "Any day, anywhere";
  const when = e.startsOn && e.endsOn ? eventDates(e.startsOn, e.endsOn) : "";
  return [e.city, when].filter(Boolean).join(" · ");
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/* ── Pieces ───────────────────────────────────────────────────────── */

/** A count on a card: 24px high, 12px radius. Not selectable. */
function CountChip({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-[12px] bg-white/[0.1] px-2 text-tiny font-medium tabular-nums text-text">
      {n}
    </span>
  );
}

/** "On HOLD" or "via sponsorme index": where a campaign comes from, on every card. */
function OriginTag({ origin }: { origin: InspireCampaign["origin"] }) {
  return origin === "hold" ? (
    <span className="inline-flex h-5 shrink-0 items-center rounded-[10px] bg-[#5B7CFF]/25 px-2 text-[11px] font-medium text-[#DCE3FF]">On HOLD</span>
  ) : (
    <span className="inline-flex h-5 shrink-0 items-center rounded-[10px] bg-white/[0.07] px-2 text-[11px] text-[#CFE3EC]">via sponsorme index</span>
  );
}

/** Their initial on a tile: we never show someone else's photo. */
function Avatar({ handle, size = "h-9 w-9 text-small" }: { handle: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-[linear-gradient(135deg,rgba(91,124,255,0.35),rgba(20,40,60,0.6))] font-medium uppercase text-text ${size}`}
    >
      {handle.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "·"}
    </span>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2 text-tiny text-[#CFE3EC] transition-colors hover:bg-white/[0.06] hover:text-text"
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  );
}

/** The credit, wherever a campaign from the index is shown. */
function Credit({ credit, children }: { credit: InspireCredit; children?: ReactNode }) {
  return (
    <p className="text-tiny leading-relaxed text-[#9FB7C2]">
      Campaigns marked “via sponsorme index” are from the{" "}
      <a href={credit.url} target="_blank" rel="noreferrer noopener" className="text-[#CFE3EC] underline underline-offset-2 hover:text-text">
        {credit.name}
      </a>{" "}
      by{" "}
      <a href={credit.byUrl} target="_blank" rel="noreferrer noopener" className="text-[#CFE3EC] underline underline-offset-2 hover:text-text">
        {credit.by}
      </a>
      . Those creators are not on HOLD: we show what they offered, never how it went. {children}
    </p>
  );
}

/* ── The hub ──────────────────────────────────────────────────────── */

function Hub() {
  const read = useInspireEvents();
  const links = useInspireHref();
  const events = useMemo(() => read.data?.events ?? [], [read.data]);
  const paged = usePaged(events, events.length);

  if (read.error) return <ReadError error={read.error} />;
  if (!read.data) return <Skeleton className="h-72" />;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[640px] text-small text-[#CFE3EC]">
        What creators have sold ad space on, event by event: suitcases, dresses, cars, laptop lids, content. Open one, then start your own from an idea that worked.
      </p>
      {events.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing here yet. When a creator publishes a listing on HOLD, it shows up under its event, ready to borrow from." />
        </Panel>
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((e) => (
              <EventTile key={e.slug} event={e} href={links.event(e.slug)} />
            ))}
          </CardGrid>
          <Pager {...paged} />
        </>
      )}
      {events.some((e) => e.indexCount > 0) ? <Credit credit={read.data.credit} /> : null}
    </div>
  );
}

function EventTile({ event, href }: { event: InspireEvent; href: string }) {
  const Icon = event.slug === ANYTIME ? IconInspire : IconCalendar;
  return (
    <li>
      <Link href={href} scroll={false} className={`${cardCls} gap-4 p-4 sm:min-h-[168px] sm:p-5`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[#CFE3EC]">
            <Icon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text">{event.name}</p>
            <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{where(event)}</p>
          </div>
          <CountChip n={event.count} />
        </div>
        <div className="mt-auto flex min-w-0 flex-col gap-0.5 text-tiny text-[#CFE3EC]">
          {event.holdCount > 0 ? <p className="truncate">{event.holdCount} on HOLD</p> : null}
          {event.indexCount > 0 ? <p className="truncate text-[#9FB7C2]">{event.indexCount} via sponsorme index</p> : null}
        </div>
      </Link>
    </li>
  );
}

/* ── One event ────────────────────────────────────────────────────── */

type SurfaceFilter = "all" | SurfaceKind;

function EventScreen({ slug }: { slug: string }) {
  const read = useInspireCampaigns(slug);
  const links = useInspireHref();
  const [surface, setSurface] = useState<SurfaceFilter>("all");
  const all = useMemo(() => read.data?.campaigns ?? [], [read.data]);
  const shown = useMemo(() => (surface === "all" ? all : all.filter((c) => c.surface.kind === surface)), [all, surface]);
  const paged = usePaged(shown, `${slug}:${surface}`);

  if (read.error) {
    return (
      <div className="flex flex-col gap-4">
        <DrillBar back={links.hub} crumb="Inspire" title="Event" />
        <ReadError error={read.error} />
      </div>
    );
  }
  if (!read.data) return <Skeleton className="h-72" />;
  const { event, facets, credit } = read.data;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={links.hub}
        crumb="Inspire"
        title={event.name}
        right={<span className="text-tiny text-[#9FB7C2]">{where(event)}</span>}
      />
      {facets.surfaces.length > 1 ? (
        <FilterPills<SurfaceFilter>
          label="What it is on"
          value={surface}
          onChange={setSurface}
          options={[
            { value: "all", label: "All", count: all.length },
            ...facets.surfaces.map((f) => ({ value: f.kind, label: SURFACE_LABEL[f.kind], count: f.count })),
          ]}
        />
      ) : null}
      {shown.length === 0 ? (
        <Panel>
          <EmptyState
            title={
              all.length === 0
                ? "No campaigns at this event yet. Yours could be the first one other creators borrow from."
                : `Nothing on ${surface === "all" ? "this" : SURFACE_LABEL[surface].toLowerCase()} here yet.`
            }
            action={
              surface !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSurface("all")}
                  className="inline-flex h-9 items-center rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10"
                >
                  Show all
                </button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((c) => (
              <CampaignCard key={c.id} campaign={c} href={links.campaign(event.slug, c.id)} />
            ))}
          </CardGrid>
          <Pager {...paged} />
        </>
      )}
      {event.indexCount > 0 ? <Credit credit={credit} /> : null}
    </div>
  );
}

function CampaignCard({ campaign: c, href }: { campaign: InspireCampaign; href: string }) {
  const what = c.surface.product ?? (c.surface.kind ? SURFACE_LABEL[c.surface.kind] : null);
  return (
    <li>
      <article className={`${cardCls} p-4`}>
        <Link href={href} scroll={false} className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar handle={c.creator.handle} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-medium text-text">@{c.creator.handle}</p>
              <p className="truncate text-[11px] text-[#9FB7C2]">{c.creator.name ?? " "}</p>
            </div>
          </div>
          <p className="line-clamp-2 min-h-[40px] text-small text-text">{c.title}</p>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-tiny text-[#CFE3EC]">{[what, PRICING_LABEL[c.pricing.model]].filter(Boolean).join(" · ")}</p>
            {c.offer ? <p className="truncate text-tiny text-[#9FB7C2]">{c.offer}</p> : null}
          </div>
        </Link>
        <div className="-mx-2 mt-3 flex min-h-[32px] flex-wrap items-center gap-1 border-t border-white/[0.06] pt-2">
          {c.links.post ? <External href={c.links.post}>See the post</External> : null}
          {c.links.website ? <External href={c.links.website}>Website</External> : null}
          {c.links.holdPage ? <External href={`${SITE_URL}${c.links.holdPage}`}>Their page</External> : null}
          <span className="ml-auto pr-2">
            <OriginTag origin={c.origin} />
          </span>
        </div>
      </article>
    </li>
  );
}

/* ── One campaign ─────────────────────────────────────────────────── */

function CampaignScreen({ slug, id }: { slug: string; id: string }) {
  const read = useInspireCampaigns(slug);
  const links = useInspireHref();

  if (read.error) {
    return (
      <div className="flex flex-col gap-4">
        <DrillBar back={links.event(slug)} crumb="Inspire" title="Campaign" />
        <ReadError error={read.error} />
      </div>
    );
  }
  if (!read.data) return <Skeleton className="h-72" />;
  const { event, credit } = read.data;
  const c = read.data.campaigns.find((x) => x.id === id);
  if (!c) {
    return (
      <div className="flex flex-col gap-4">
        <DrillBar back={links.event(slug)} crumb={`Inspire · ${event.name}`} title="Campaign" />
        <Panel>
          <EmptyState title="This campaign is no longer listed here." />
        </Panel>
      </div>
    );
  }

  const facts: [string, ReactNode][] = [
    ["On", [c.surface.product, c.surface.kind ? SURFACE_LABEL[c.surface.kind] : null].filter(Boolean).join(" · ") || "Not stated"],
    ["What a sponsor gets", c.offer ?? "Not stated"],
    ["How it sells", [PRICING_LABEL[c.pricing.model], c.pricing.text].filter(Boolean).join(": ")],
    ["Event", event.slug === ANYTIME ? "Not tied to an event" : `${event.name}${where(event) ? ` · ${where(event)}` : ""}`],
    ["Launched", day(c.launchedOn) ?? "Not known"],
  ];
  const credited = c.origin === "hold" || c.creator.platform === "x";

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={links.event(event.slug)} crumb={`Inspire · ${event.name}`} title={`@${c.creator.handle}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <Panel>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar handle={c.creator.handle} size="h-11 w-11 text-body" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-medium text-text">@{c.creator.handle}</p>
              {c.creator.name ? <p className="truncate text-tiny text-[#9FB7C2]">{c.creator.name}</p> : null}
            </div>
            <OriginTag origin={c.origin} />
          </div>
          <h3 className="mt-5 text-[22px] font-medium leading-snug tracking-tight text-text">{c.title}</h3>
          {c.description ? <p className="mt-3 max-w-[640px] text-small leading-relaxed text-[#CFE3EC]">{c.description}</p> : null}
          <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] text-[#9FB7C2]">{k}</dt>
                <dd className="mt-0.5 text-small text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Make it yours">
          <p className="text-tiny leading-relaxed text-[#CFE3EC]">
            {c.suggestedTemplateId ? "Opens a new listing on the closest product we have" : "Opens a new listing; pick the product that fits"}
            {credited ? `, crediting @${c.creator.handle} as “Inspired by”.` : "."}
          </p>
          <Link
            href={links.idea(c)}
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-amber px-4 text-small font-medium text-text-on-amber transition-colors hover:bg-amber-glow"
          >
            Use this idea
          </Link>
          <div className="-mx-2 mt-4 flex flex-wrap gap-1 border-t border-white/[0.06] pt-3">
            {c.links.post ? <External href={c.links.post}>See the post</External> : null}
            {c.links.website ? <External href={c.links.website}>Website</External> : null}
            {c.links.holdPage ? <External href={`${SITE_URL}${c.links.holdPage}`}>Their page on HOLD</External> : null}
            {c.source ? <External href={c.source.url}>On the sponsor me index</External> : null}
          </div>
          {c.origin === "sponsorme_index" ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <Credit credit={credit} />
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
