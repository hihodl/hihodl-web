"use client";

/**
 * The cards every Spaces grid is built from: the listings grid, and the
 * drill-downs of Sales, Deliveries and Offers & bids (event, then listing,
 * then that listing's own screen). One look, one page size, one Back.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

import { eventDates } from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
import type { SpaceCard, TemplateKind } from "@/lib/creator/listing";
import { listingRefs, NO_EVENT, type EventRef, type ListingRef } from "@/lib/app/spaces-model";
import { useTemplates } from "@/lib/app/spaces-data";

import { IconArrowLeft, IconCalendar } from "../icons";
import { useShell } from "../Shell";
import { glass } from "../ui";
import { StatusPill } from "./common";

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
  const btn =
    "inline-flex h-8 items-center rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny text-[#CFE3EC] transition-colors hover:bg-white/10 disabled:opacity-40";
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2">
      <span className="text-tiny tabular-nums text-[#9FB7C2]">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </span>
      <button type="button" className={btn} disabled={page === 0} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
        Next
      </button>
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

export const cardCls = `${glass} flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:bg-white/[0.06]`;

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

/* ── The drill-down ───────────────────────────────────────────────── */

/** Back, where you are, and one control on the right. */
export function DrillBar({ back, crumb, title, right }: { back: string; crumb: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={back}
          scroll={false}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[#9FB7C2]">{crumb}</p>
          <h2 className="truncate text-body font-medium text-text">{title}</h2>
        </div>
      </div>
      {right}
    </div>
  );
}

export function eventName(event: EventRef | null | undefined): string {
  return event?.name ?? "Not tied to an event";
}

function eventWhere(event: EventRef | null): string {
  if (!event) return "No event";
  const when = event.startsOn && event.endsOn ? eventDates(event.startsOn, event.endsOn) : "";
  return [event.city, when].filter(Boolean).join(" · ");
}

/** The figure a card is about: big, amber when it waits on you. */
function Figure({ value, note, attention }: { value: ReactNode; note?: ReactNode; attention?: boolean }) {
  return (
    <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
      <p className={`text-[26px] font-medium leading-none tabular-nums xl:text-[30px] ${attention ? "text-amber" : "text-text"}`}>{value}</p>
      {note ? <p className="truncate text-tiny tabular-nums text-[#9FB7C2]">{note}</p> : null}
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
  icon: Icon = IconCalendar,
}: {
  href: string;
  event: EventRef | null;
  /** One or two short lines: what is under it. */
  lines: ReactNode[];
  value: ReactNode;
  note?: ReactNode;
  attention?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <li>
      <Link href={href} scroll={false} className={`${cardCls} min-h-[176px] gap-4 p-4 sm:p-5 xl:min-h-[200px]`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[#CFE3EC]">
            <Icon />
          </span>
          <div className="min-w-0">
            <p className="truncate text-small font-medium text-text">{eventName(event)}</p>
            <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{eventWhere(event)}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          {lines.map((l, i) => (
            <p key={i} className="truncate text-tiny text-[#CFE3EC]">
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
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-small font-medium text-text">{listing.title}</p>
            <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{line}</p>
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
