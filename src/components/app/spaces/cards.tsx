"use client";

/**
 * The cards every Spaces grid is built from: the listings grid, and the
 * drill-downs of Sales, Deliveries and Offers & bids (event, then listing,
 * then that listing's own screen). One look, one page size, one Back.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { eventDates } from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
import type { SpaceCard, TemplateKind } from "@/lib/creator/listing";
import { eventLook, tintRgba } from "@/lib/app/event-look";
import { listingRefs, NO_EVENT, type EventRef, type ListingRef } from "@/lib/app/spaces-model";
import { useTemplates } from "@/lib/app/spaces-data";

import { BackHeader } from "../hold";
import { useShell } from "../Shell";
import { StatusPill } from "./common";
import { Chip, money } from "./kit";

/** Two rows of four on a laptop: a page of cards never grows past one screen. */
export const PAGE = 8;

export function CardGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">{children}</ul>;
}

/** A page of `items`, back to the first page whenever `reset` changes. */
export function usePaged<T>(items: readonly T[], reset: unknown, size = PAGE) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [reset]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const at = Math.min(page, pages - 1);
  return { shown: items.slice(at * size, at * size + size), page: at, pages, total: items.length, size, setPage };
}

export function Pager({
  page,
  pages,
  total,
  size = PAGE,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  size?: number;
  setPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2">
      <span className="text-[12.5px] font-strong tabular-nums text-white/55">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </span>
      <Chip label="Previous" icon="chevron-back" disabled={page === 0} onClick={() => setPage(page - 1)} />
      <Chip label="Next" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
    </nav>
  );
}

/** The listing's own picture, or its gradient. Never the event's photo. */
export function Cover({ url, gradient, children }: { url?: string | null; gradient?: string | null; children?: ReactNode }) {
  return (
    <div
      className="relative h-[112px] shrink-0 overflow-hidden rounded-t-[18px] xl:h-[128px]"
      style={url ? undefined : { background: gradientCss(gradient) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,20,0)_40%,rgba(4,12,20,0.6)_100%)]" />
      <div className="absolute left-3 top-3">{children}</div>
    </div>
  );
}

/** The app's Card (ui.tsx): a 6% white wash, a 10% stroke, radius 18. */
export const cardCls = "flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.06] transition-colors hover:bg-white/[0.09]";

/**
 * Ad space or service, by the listing's template — the same rule as the
 * profile's Spaces / Services split. A listing whose template is unknown is a
 * service when it names one.
 */
export function useListingKind(): (l: SpaceCard) => TemplateKind {
  const templates = useTemplates();
  return useMemo(() => {
    const map = new Map((templates.data?.templates ?? []).map((t) => [t.id, t.kind]));
    return (l: SpaceCard) => map.get(l.templateId) ?? (l.serviceName ? "service" : "placement");
  }, [templates.data]);
}

export const KIND_NAME: Record<TemplateKind, string> = { placement: "Ad space", service: "Service" };

/** Every listing this person can see, with its event: their own and their team seats. */
export function useListingRefs(): ReadonlyMap<string, ListingRef> {
  const { listings, work } = useShell();
  const kindOf = useListingKind();
  return useMemo(() => listingRefs(listings, kindOf, work), [listings, kindOf, work]);
}

/**
 * The country of an event this creator has listed at, by slug or by name.
 *
 * The analytics read groups money by event but carries no country, and the
 * flag on an event's badge needs one. Their own listings know it, and every
 * event on that screen is one they listed at.
 */
export function useEventCountry(): (event: { key?: string | null; name?: string | null }) => string | null {
  const { listings } = useShell();
  return useMemo(() => {
    const bySlug = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const l of listings) {
      const e = l.event;
      if (!e?.country) continue;
      bySlug.set(e.slug, e.country);
      byName.set(e.name.toLowerCase(), e.country);
    }
    return (event) => (event.key ? bySlug.get(event.key) ?? null : null) ?? (event.name ? byName.get(event.name.toLowerCase()) ?? null : null);
  }, [listings]);
}

/* ── The drill-down ───────────────────────────────────────────────── */

/**
 * The app's GlassHeader on a drilled-in screen: a chevron back, the title, and
 * where you are under it. Inside the shell it is drawn in the top bar (the
 * BackHeader's header slot), so the section title is not said twice.
 */
export function DrillBar({ back, crumb, title, right }: { back: string; crumb: string; title: string; right?: ReactNode }) {
  return <BackHeader title={title} subtitle={crumb} backHref={back} right={right} />;
}

export function eventName(event: EventRef | null | undefined): string {
  return event?.name ?? "Not tied to an event";
}

function eventWhere(event: EventRef | null): string {
  // The title already says "Not tied to an event"; a blank line keeps the cards level.
  if (!event) return "\u00a0";
  const when = event.startsOn && event.endsOn ? eventDates(event.startsOn, event.endsOn) : "";
  return [event.city, when].filter(Boolean).join(" · ");
}

/**
 * An event in a 32 slot: the flag of the country it is in, on that country's
 * own colour. With no country, the same slot takes a colour picked from the
 * eSIM palette by the event's key and draws its initial (lib/app/event-look).
 *
 * Every event card carried the same chart glyph before this, so one event read
 * exactly like the next until you got to the words.
 */
export function EventBadge({ event, size = 32 }: { event: EventRef | null; size?: number }) {
  const look = eventLook(event);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] border"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: tintRgba(look.tint, 0.22),
        borderColor: tintRgba(look.tint, 0.45),
      }}
    >
      {look.flag ? (
        <span className="leading-none" style={{ fontSize: Math.round(size * 0.56) }}>
          {look.flag}
        </span>
      ) : (
        <span className="font-extrabold leading-none text-white" style={{ fontSize: Math.round(size * 0.44) }}>
          {look.initial}
        </span>
      )}
    </span>
  );
}

/** The figure a card is about: big, amber when it waits on you. */
function Figure({ value, note, attention }: { value: ReactNode; note?: ReactNode; attention?: boolean }) {
  return (
    <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
      <p className={`${money} leading-none ${attention ? "!text-amber" : ""}`}>{value}</p>
      {note ? <p className="truncate text-[12.5px] font-strong tabular-nums text-white/55">{note}</p> : null}
    </div>
  );
}

/** Level one: an event, what is under it, one big figure. */
export function EventCard({
  href,
  event,
  lines,
  value,
  note,
  attention,
}: {
  href: string;
  event: EventRef | null;
  /** One or two short lines: what is under it. */
  lines: ReactNode[];
  value: ReactNode;
  note?: ReactNode;
  attention?: boolean;
}) {
  return (
    <li>
      <Link href={href} scroll={false} className={`${cardCls} gap-2.5 p-3.5 sm:min-h-[168px] xl:min-h-[188px]`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <EventBadge event={event} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-strong tracking-[-0.2px] text-white">{eventName(event)}</p>
            <p className="mt-0.5 truncate text-[12.5px] font-strong text-white/55">{eventWhere(event)}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          {lines.map((l, i) => (
            <p key={i} className="truncate text-[13px] text-white/[0.62]">
              {l}
            </p>
          ))}
        </div>
        <Figure value={value} note={note} attention={attention} />
      </Link>
    </li>
  );
}

/** Level two: one listing, with its picture and one big figure. */
export function ListingFigureCard({
  href,
  listing,
  line,
  value,
  note,
  attention,
}: {
  href: string;
  listing: ListingRef;
  line: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  attention?: boolean;
}) {
  return (
    <li>
      <Link href={href} scroll={false} className={cardCls}>
        <Cover url={listing.bannerUrl} gradient={listing.bannerGradient}>
          <StatusPill status={listing.status} onPhoto />
        </Cover>
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-strong tracking-[-0.2px] text-white">{listing.title}</p>
            <p className="mt-0.5 truncate text-[12.5px] font-strong text-white/55">{line}</p>
          </div>
          <Figure value={value} note={note} attention={attention} />
        </div>
      </Link>
    </li>
  );
}

/** A listing the reads know nothing else about (a sale on a listing no longer in the list). */
export function unknownListing(id: string, title: string): ListingRef {
  return { id, title, event: null, kind: null, status: "closed", bannerUrl: null, bannerGradient: null };
}

/** `?event=` for a group key; the no-event group is `none`. */
export function eventParam(key: string): string {
  return `event=${encodeURIComponent(key || NO_EVENT)}`;
}
