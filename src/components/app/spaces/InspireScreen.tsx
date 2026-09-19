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
import { ctaPrimary } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { cardCls, CardGrid, DrillBar, Pager, usePaged } from "./cards";
import { ReadError } from "./common";
import { Body, Card, Divider, Empty, emptyBtn, h2, KV, Pills, SectionLabel, Tag } from "./kit";

export function InspireScreen({
  event,
  campaign,
  surface = null,
}: {
  event: string | null;
  campaign: string | null;
  /** `&surface=vehicle`: the event opens already filtered (a shared link). */
  surface?: string | null;
}) {
  if (!event) return <Hub />;
  if (campaign) return <CampaignScreen slug={event} id={campaign} />;
  return <EventScreen key={`${event}:${surface ?? ""}`} slug={event} initialSurface={surface} />;
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

/** "On HOLD" or "via sponsorme index": where a campaign comes from, as the app's Tag. */
function OriginTag({ origin }: { origin: InspireCampaign["origin"] }) {
  return origin === "hold" ? <Tag label="On HOLD" tone="good" /> : <Tag label="via sponsorme index" />;
}

/** Their initial in a round tile: we never show someone else's photo. */
function Avatar({ handle, big = false }: { handle: string; big?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.08] font-extrabold uppercase text-white ${
        big ? "h-11 w-11 rounded-[22px] text-[17px]" : "h-9 w-9 rounded-[18px] text-[14px]"
      }`}
    >
      {handle.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "·"}
    </span>
  );
}

/** An outside link, as the app's Chip with the open icon. */
function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white/[0.62] transition-colors hover:bg-white/10"
    >
      <Ion name="open-outline" size={14} />
      {children}
    </a>
  );
}

/** The credit, wherever a campaign from the index is shown. */
function Credit({ credit, children }: { credit: InspireCredit; children?: ReactNode }) {
  return (
    <p className="text-[12px] leading-[17px] text-white/55">
      Campaigns marked &ldquo;via sponsorme index&rdquo; are from the{" "}
      <a href={credit.url} target="_blank" rel="noreferrer noopener" className="text-white/[0.62] underline underline-offset-2 hover:text-white">
        {credit.name}
      </a>{" "}
      by{" "}
      <a href={credit.byUrl} target="_blank" rel="noreferrer noopener" className="text-white/[0.62] underline underline-offset-2 hover:text-white">
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
    <div className="flex flex-col gap-3.5">
      <Body dim className="max-w-[640px]">
        What creators have sold ad space on, event by event: suitcases, dresses, cars, laptop lids, content. Open one, then start your own
        from an idea that worked.
      </Body>
      {events.length === 0 ? (
        <Empty icon="bulb-outline" title="Nothing here yet" body="When a creator publishes a listing on HOLD, it shows up under its event, ready to borrow from." />
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
  return (
    <li>
      <Card href={href} className="h-full !gap-3 sm:min-h-[150px]">
        <div className="flex min-w-0 items-start gap-2.5">
          <Ion name={event.slug === ANYTIME ? "bulb-outline" : "calendar-outline"} size={18} className="mt-0.5 shrink-0 text-white/[0.62]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold text-white">{event.name}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-white/55">{where(event)}</p>
          </div>
          <Tag label={String(event.count)} />
        </div>
        <div className="mt-auto flex min-w-0 flex-col gap-0.5 text-[12.5px] font-strong">
          {event.holdCount > 0 ? <p className="truncate text-white/[0.62]">{event.holdCount} on HOLD</p> : null}
          {event.indexCount > 0 ? <p className="truncate text-white/55">{event.indexCount} via sponsorme index</p> : null}
        </div>
      </Card>
    </li>
  );
}

/* ── One event ────────────────────────────────────────────────────── */

type SurfaceFilter = "all" | SurfaceKind;

function isSurface(v: string | null): v is SurfaceKind {
  return v !== null && Object.prototype.hasOwnProperty.call(SURFACE_LABEL, v);
}

function EventScreen({ slug, initialSurface }: { slug: string; initialSurface: string | null }) {
  const read = useInspireCampaigns(slug);
  const links = useInspireHref();
  const [surface, setSurface] = useState<SurfaceFilter>(isSurface(initialSurface) ? initialSurface : "all");
  const all = useMemo(() => read.data?.campaigns ?? [], [read.data]);
  const shown = useMemo(() => (surface === "all" ? all : all.filter((c) => c.surface.kind === surface)), [all, surface]);
  const paged = usePaged(shown, `${slug}:${surface}`);

  if (read.error) {
    return (
      <div className="flex flex-col gap-3.5">
        <DrillBar back={links.hub} crumb="Inspire" title="Event" />
        <ReadError error={read.error} />
      </div>
    );
  }
  if (!read.data) return <Skeleton className="h-72" />;
  const { event, facets, credit } = read.data;

  return (
    <div className="flex flex-col gap-3.5">
      <DrillBar back={links.hub} crumb={["Inspire", where(event)].filter(Boolean).join(" · ")} title={event.name} />
      {facets.surfaces.length > 1 ? (
        <Pills<SurfaceFilter>
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
        <Empty
          icon="bulb-outline"
          title={all.length === 0 ? "No campaigns at this event yet" : `Nothing on ${surface === "all" ? "this" : SURFACE_LABEL[surface].toLowerCase()} here yet`}
          body={all.length === 0 ? "Yours could be the first one other creators borrow from." : undefined}
          action={
            surface !== "all" ? (
              <button type="button" onClick={() => setSurface("all")} className={emptyBtn}>
                Show all
              </button>
            ) : undefined
          }
        />
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
      <article className={`${cardCls} gap-2.5 p-3.5`}>
        <Link href={href} scroll={false} className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar handle={c.creator.handle} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-white">@{c.creator.handle}</p>
              <p className="truncate text-[12.5px] text-white/55">{c.creator.name ?? "\u00a0"}</p>
            </div>
          </div>
          <p className="line-clamp-2 min-h-[40px] text-[14.5px] leading-5 text-white">{c.title}</p>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[12.5px] font-strong text-white/[0.62]">{[what, PRICING_LABEL[c.pricing.model]].filter(Boolean).join(" · ")}</p>
            {c.offer ? <p className="truncate text-[12.5px] text-white/55">{c.offer}</p> : null}
          </div>
        </Link>
        <Divider />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {c.links.post ? <External href={c.links.post}>See the post</External> : null}
          {c.links.website ? <External href={c.links.website}>Website</External> : null}
          {c.links.holdPage ? <External href={`${SITE_URL}${c.links.holdPage}`}>Their page</External> : null}
          <span className="ml-auto">
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
      <div className="flex flex-col gap-3.5">
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
      <div className="flex flex-col gap-3.5">
        <DrillBar back={links.event(slug)} crumb={`Inspire · ${event.name}`} title="Campaign" />
        <Empty icon="bulb-outline" title="This campaign is no longer listed here" />
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
    <div className="flex flex-col gap-3.5">
      <DrillBar back={links.event(event.slug)} crumb={`Inspire · ${event.name}`} title={`@${c.creator.handle}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <Card className="!gap-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar handle={c.creator.handle} big />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-white">@{c.creator.handle}</p>
              {c.creator.name ? <p className="truncate text-[12.5px] text-white/55">{c.creator.name}</p> : null}
            </div>
            <OriginTag origin={c.origin} />
          </div>
          <h3 className={h2}>{c.title}</h3>
          {c.description ? <Body dim className="max-w-[640px]">{c.description}</Body> : null}
          <Divider />
          <div className="flex flex-col gap-2.5">
            {facts.map(([k, v]) => (
              <KV key={k} k={k} v={v} />
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-2.5">
          <SectionLabel>Make it yours</SectionLabel>
          <Card>
            <Body dim>
              {c.suggestedTemplateId ? "Opens a new listing on the closest product we have" : "Opens a new listing; pick the product that fits"}
              {credited ? `, crediting @${c.creator.handle} as “Inspired by”.` : "."}
            </Body>
            <Link href={links.idea(c)} className={ctaPrimary}>
              Use this idea
            </Link>
            <div className="flex flex-wrap gap-2">
              {c.links.post ? <External href={c.links.post}>See the post</External> : null}
              {c.links.website ? <External href={c.links.website}>Website</External> : null}
              {c.links.holdPage ? <External href={`${SITE_URL}${c.links.holdPage}`}>Their page on HOLD</External> : null}
              {c.source ? <External href={c.source.url}>On the sponsor me index</External> : null}
            </div>
            {c.origin === "sponsorme_index" ? (
              <>
                <Divider />
                <Credit credit={credit} />
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
