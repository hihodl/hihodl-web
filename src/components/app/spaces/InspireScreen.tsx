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
 * A campaign card wears the product it is on: the catalogue's own drawing for
 * the template the idea maps to (`templateForCampaign`), on a banner ground,
 * with that product's name on it — so the creator reads where "Use this idea"
 * lands before pressing it, and a dress opens the dress. A row we sell nothing
 * like says so on the card and opens the picker; it never opens the suitcase.
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
import { gradientCss } from "@/lib/ad-space/look";
import { SITE_URL } from "@/lib/ad-space/config";
import { eventLook, tintRgba } from "@/lib/app/event-look";
import { useInspireCampaigns, useInspireEvents, useTemplates } from "@/lib/app/spaces-data";
import {
  ANYTIME,
  ideaQuery,
  PRICING_LABEL,
  SURFACE_LABEL,
  templateForCampaign,
  type InspireCampaign,
  type InspireCredit,
  type InspireEvent,
  type SurfaceKind,
} from "@/lib/creator/inspire";
import type { Template } from "@/lib/creator/listing";

import { useHref } from "../base";
import { ctaPrimary } from "../hold";
import { Ion, type IonName } from "../ion";
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
    idea: (c: InspireCampaign, templateId: string | null) => `${href("/listings/new")}${ideaQuery(c, templateId)}`,
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

/**
 * The creator, in a round tile: their own picture on X when the read carries
 * one, and otherwise their initial on a colour that is always theirs.
 *
 * Nothing sends a picture yet (see `InspireCampaign.creator`), so what this
 * draws today is the tile. The colour comes from the same table the event
 * badge uses when it has no flag (`eventLook`), keyed by the handle: forty
 * cards of grey initials all read the same, forty coloured ones do not.
 */
function Avatar({ handle, url = null, big = false }: { handle: string; url?: string | null; big?: boolean }) {
  const size = big ? "h-11 w-11 rounded-[22px] text-[17px]" : "h-9 w-9 rounded-[18px] text-[14px]";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" loading="lazy" className={`shrink-0 border border-white/10 bg-white/[0.08] object-cover ${size}`} />
    );
  }
  const tint = eventLook({ key: handle, name: handle }).tint;
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center border font-extrabold uppercase text-white ${size}`}
      style={{ background: tintRgba(tint, 0.24), borderColor: tintRgba(tint, 0.48) }}
    >
      {handle.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "·"}
    </span>
  );
}

/* ── The product the idea is about ────────────────────────────────── */

/** The catalogue sends each product's outline with its template (ListingWizard draws the same one). */
type Outlined = Template & { views?: { viewBox: [number, number]; outline: string[] }[] };

interface ProductArt {
  /** What "Use this idea" opens the editor on, or null: we sell nothing like it. */
  templateId: string | null;
  /** That product's name, for the band's label. */
  name: string | null;
  /** Its first view, drawn stroke-only, exactly as the editor's picker draws it. */
  view: { viewBox: [number, number]; outline: string[] } | null;
  icon: IonName;
  /** The catalogue has not arrived: say nothing rather than "no product like it". */
  pending: boolean;
}

const NO_PRODUCT: ProductArt = { templateId: null, name: null, view: null, icon: "cube-outline", pending: false };

/**
 * Each campaign's product, from the live catalogue: the template it is really
 * about (lib/creator/inspire `templateForCampaign`) and that template's own
 * drawing. A template this server does not have counts as none, so a card
 * never offers a product the editor could not open.
 */
function useProductArt(): (c: InspireCampaign) => ProductArt {
  const templates = useTemplates();
  return useMemo(() => {
    const list = templates.data?.templates ?? [];
    const byId = new Map(list.map((t) => [t.id, t as Outlined]));
    const known = list.length ? new Set(byId.keys()) : null;
    return (c: InspireCampaign) => {
      const templateId = templateForCampaign(c, known);
      if (!templateId) return known ? NO_PRODUCT : { ...NO_PRODUCT, pending: true };
      const t = byId.get(templateId);
      return {
        templateId,
        name: t?.name ?? null,
        view: t?.views?.[0] ?? null,
        icon: t?.kind === "service" ? "videocam-outline" : "cube-outline",
        pending: !known,
      };
    };
  }, [templates.data]);
}

/** The five banner grounds; a campaign always gets the same one. */
const GROUNDS = ["steel", "sea", "slate", "ember", "night"] as const;

function hashOf(key: string): number {
  let n = 0;
  for (let i = 0; i < key.length; i += 1) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return n;
}

/**
 * The band across the top of a campaign: the product on offer, drawn from the
 * catalogue in our own blueprint line, on one of the banner grounds. Its
 * bottom-right label names the product "Use this idea" will open, so a creator
 * reads where the button goes before pressing it.
 */
function ProductBand({ campaign: c, art, tall = false }: { campaign: InspireCampaign; art: ProductArt; tall?: boolean }) {
  const ground = GROUNDS[hashOf(c.id) % GROUNDS.length];
  const stroke = art.view ? Math.max(0.6, art.view.viewBox[0] / 120) : 0;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-t-[18px] ${tall ? "h-[136px]" : "h-[92px] xl:h-[104px]"}`}
      style={{ background: gradientCss(ground) }}
    >
      {/* The drawing sits on the floor of the band and is inset, so a stroke is never cut in half. */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 top-[18px] flex items-end justify-center px-6 pb-1">
        {art.view ? (
          <svg viewBox={`0 0 ${art.view.viewBox[0]} ${art.view.viewBox[1]}`} preserveAspectRatio="xMidYMax meet" className="h-full w-full">
            {art.view.outline.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={stroke} />
            ))}
          </svg>
        ) : art.pending ? null : (
          <Ion name={art.icon} size={tall ? 44 : 34} className="mb-4 text-white/[0.45]" />
        )}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,20,0.42)_0%,rgba(4,12,20,0)_46%,rgba(4,12,20,0.62)_100%)]"
      />
      <span className="absolute left-3 top-3">
        <OriginTag origin={c.origin} />
      </span>
      <span className="absolute bottom-2.5 right-3 max-w-[70%] truncate text-[11.5px] font-extrabold tracking-[0.1px] text-white">
        {art.pending ? "" : art.name ?? "No product like it yet"}
      </span>
    </div>
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
  const artOf = useProductArt();
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
              <CampaignCard key={c.id} campaign={c} href={links.campaign(event.slug, c.id)} art={artOf(c)} />
            ))}
          </CardGrid>
          <Pager {...paged} />
        </>
      )}
      {event.indexCount > 0 ? <Credit credit={credit} /> : null}
    </div>
  );
}

/**
 * One campaign: the product it is on as a band, then who offered it and what
 * it was. The whole card is the link, and the creator's own links live one
 * screen in, where there is room for them — a row of chips on every card
 * cost a third of a screenful and said what the screen behind it says.
 */
function CampaignCard({ campaign: c, href, art }: { campaign: InspireCampaign; href: string; art: ProductArt }) {
  const what = c.surface.product ?? (c.surface.kind ? SURFACE_LABEL[c.surface.kind] : null);
  return (
    <li>
      <Link href={href} scroll={false} className={cardCls}>
        <ProductBand campaign={c} art={art} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar handle={c.creator.handle} url={c.creator.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-white">@{c.creator.handle}</p>
              <p className="truncate text-[12.5px] text-white/[0.62]">{c.creator.name ?? "\u00a0"}</p>
            </div>
          </div>
          <p className="line-clamp-2 min-h-[40px] text-[14.5px] leading-5 text-white">{c.title}</p>
          <p className="mt-auto truncate text-[12.5px] font-strong text-white/[0.62]">
            {[what, PRICING_LABEL[c.pricing.model]].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>
    </li>
  );
}

/* ── One campaign ─────────────────────────────────────────────────── */

function CampaignScreen({ slug, id }: { slug: string; id: string }) {
  const read = useInspireCampaigns(slug);
  const links = useInspireHref();
  const artOf = useProductArt();

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

  const art = artOf(c);
  const facts: [string, ReactNode][] = [
    ["On", [c.surface.product, c.surface.kind ? SURFACE_LABEL[c.surface.kind] : null].filter(Boolean).join(" · ") || "Not stated"],
    ["What a sponsor gets", c.offer ?? "Not stated"],
    ["How it sells", [PRICING_LABEL[c.pricing.model], c.pricing.text].filter(Boolean).join(": ")],
    ["Event", event.slug === ANYTIME ? "Not tied to an event" : `${event.name}${where(event) ? ` · ${where(event)}` : ""}`],
    ["Launched", day(c.launchedOn) ?? "Not known"],
    ["Closest product we sell", art.pending ? " " : art.name ?? "None yet"],
  ];
  const credited = c.origin === "hold" || c.creator.platform === "x";

  return (
    <div className="flex flex-col gap-3.5">
      <DrillBar back={links.event(event.slug)} crumb={`Inspire · ${event.name}`} title={`@${c.creator.handle}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <Card className="!gap-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar handle={c.creator.handle} url={c.creator.avatarUrl} big />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold text-white">@{c.creator.handle}</p>
              {c.creator.name ? <p className="truncate text-[12.5px] text-white/[0.62]">{c.creator.name}</p> : null}
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
            <div className="overflow-hidden rounded-[14px]">
              <ProductBand campaign={c} art={art} tall />
            </div>
            <Body dim>
              {art.pending
                ? "Opens a new listing on the closest product we have"
                : art.name
                  ? `Opens a new listing on ${art.name}, our closest product to this one`
                  : "We sell nothing like this yet, so this opens the product picker"}
              {credited ? `, crediting @${c.creator.handle} as “Inspired by”.` : "."}
            </Body>
            <Link href={links.idea(c, art.templateId)} className={ctaPrimary}>
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
