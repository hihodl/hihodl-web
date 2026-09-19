"use client";

/**
 * Spaces › Deliveries: everything owed after the money moved — artwork to
 * approve, sold spots to deliver, the listing's own promises — by event, then
 * by listing, then the items of one listing, one at a time.
 *
 *   /deliveries                  one card per event: what is due there
 *   /deliveries?event=<slug>     that event's listings
 *   /deliveries?listing=<id>     that listing's items; `&item=` opens one
 *
 * The detail pane is the console's own card for that item (`Review`,
 * `SoldSpot`, `PromiseCard` for the creator; `SlotRow`, `DeliverableRow` for
 * somebody on a team), so marking something delivered is the same call it
 * always was. `?item=<kind>:<id>` alone opens its listing with it chosen.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { ProductionSpot } from "@/components/creator/run/Production";
import { PromiseCard, Review, SoldSpot } from "@/components/creator/run/Work";
import { DeliverableRow, SlotRow } from "@/components/creator/team/TeamWork";
import {
  byEvent,
  byListing,
  memberDeliveries,
  NO_EVENT,
  ownerDeliveries,
  sortDeliveries,
  type DeliveryItem,
  type ListingRef,
} from "@/lib/app/spaces-model";
import { useListingViews, useRefresh } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { BackHeader } from "../hold";
import { IconDeliveries } from "../icons";
import { Ion, type IonName } from "../ion";
import { useShell } from "../Shell";
import { Skeleton } from "../ui";
import { countdownText, dueText, LIST_PANEL, MasterDetail, ReadError } from "./common";
import { Chip, ChipRow, Empty, SectionLabel, Tag } from "./kit";
import { CardGrid, DrillBar, EventCard, eventName, eventParam, ListingFigureCard, Pager, unknownListing, useListingRefs, usePaged } from "./cards";

type Show = "todo" | "done" | "all";

const KIND_TEXT: Record<DeliveryItem["kind"], string> = { artwork: "Artwork", spot: "Spot", promise: "Promise", production: "Production" };
const KIND_ICON: Record<DeliveryItem["kind"], IonName> = {
  artwork: "image-outline",
  spot: "megaphone-outline",
  promise: "checkbox-outline",
  production: "videocam-outline",
};
const STATE_TEXT: Record<DeliveryItem["state"], string> = {
  todo: "To do",
  overdue: "Late",
  waiting: "Artwork pending",
  done: "Delivered",
};

/** A production spot waiting on its brand says so, not "artwork pending". */
function stateText(i: DeliveryItem): string {
  if (i.kind === "production" && i.production) {
    if (i.state === "waiting") return "With the brand";
    if (i.production.state === "revision_requested") return "Revision";
  }
  return STATE_TEXT[i.state];
}

const open = (i: DeliveryItem) => i.state !== "done";

/** What is due in a set of items: the counts, and the nearest date. */
function due(items: readonly DeliveryItem[]) {
  const left = items.filter(open);
  const artwork = left.filter((i) => i.kind === "artwork").length;
  const waiting = left.filter((i) => i.state === "waiting" && i.kind !== "production").length;
  const withBrand = left.filter((i) => i.state === "waiting" && i.kind === "production").length;
  const deliver = left.length - artwork - waiting - withBrand;
  const next = left.map((i) => i.due).filter((d): d is string => !!d).sort()[0] ?? null;
  const late = left.some((i) => i.state === "overdue");
  const parts = [
    deliver ? `${deliver} to deliver` : "",
    artwork ? `${artwork} artwork to approve` : "",
    waiting ? `${waiting} waiting on artwork` : "",
    withBrand ? `${withBrand} with the brand` : "",
  ].filter(Boolean);
  return {
    open: left.length,
    text: parts.length ? parts.join(" · ") : "All delivered",
    next,
    late,
    note: next ? (dueText(next).endsWith("late") ? dueText(next) : `Due ${dueText(next)}`) : left.length ? "" : `${items.length} done`,
  };
}

export function DeliveriesScreen({
  event,
  listing,
  selected,
  view,
}: {
  event: string | null;
  listing: string | null;
  selected: string | null;
  view: string | null;
}) {
  const { role, listings, work } = useShell();
  const running = useMemo(
    () => (role === "creator" ? listings.filter((l) => l.status !== "draft").map((l) => l.id) : null),
    [role, listings],
  );
  const views = useListingViews(running);
  const own = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);
  const refs = useListingRefs();

  const items = useMemo(
    () => sortDeliveries([...ownerDeliveries(views.data ?? []), ...memberDeliveries(work, own)]),
    [views.data, work, own],
  );
  const loading = role === "creator" && !views.data && !views.error;
  const refOf = (id: string, i?: DeliveryItem) => refs.get(id) ?? unknownListing(id, i?.listing ?? "Listing");

  // An item on its own (the Overview's "needs you") opens on its listing.
  const spaceId = listing ?? items.find((i) => i.id === selected)?.spaceId ?? null;

  if (loading) return <Skeleton className="h-[260px]" />;
  if (spaceId) {
    return (
      <ListingDeliveries
        listing={refOf(spaceId, items.find((i) => i.spaceId === spaceId))}
        items={items.filter((i) => i.spaceId === spaceId)}
        selected={selected}
        view={view}
        error={views.error}
      />
    );
  }

  const groups = byEvent(items, (i) => i.spaceId, refs).sort(
    (a, b) =>
      Number(a.key === NO_EVENT) - Number(b.key === NO_EVENT) ||
      Number(due(a.items).open === 0) - Number(due(b.items).open === 0) ||
      (due(a.items).next ?? "9999").localeCompare(due(b.items).next ?? "9999"),
  );

  if (event) {
    const here = groups.find((g) => g.key === event)?.items ?? [];
    return <EventDeliveries eventKey={event} items={here} refOf={refOf} />;
  }
  return (
    <>
      <ReadError error={views.error} />
      <EventGrid groups={groups} refOf={refOf} />
    </>
  );
}

type RefOf = (id: string, i?: DeliveryItem) => ListingRef;

function EventGrid({ groups, refOf }: { groups: { key: string; items: DeliveryItem[] }[]; refOf: RefOf }) {
  const href = useHref();
  const paged = usePaged(groups, groups.length);
  if (groups.length === 0) {
    return <Empty icon="checkmark-done" title="Nothing to deliver" body="When a brand pays for a spot, what you owe them shows here." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <CardGrid>
        {paged.shown.map((g) => {
          const d = due(g.items);
          return (
            <EventCard
              key={g.key}
              href={`${href("/deliveries")}?${eventParam(g.key)}`}
              event={refOf(g.items[0].spaceId, g.items[0]).event}
              icon={IconDeliveries}
              lines={[d.text]}
              value={d.open}
              note={d.note}
              attention={d.open > 0}
            />
          );
        })}
      </CardGrid>
      <Pager {...paged} />
    </div>
  );
}

function EventDeliveries({ eventKey, items, refOf }: { eventKey: string; items: DeliveryItem[]; refOf: RefOf }) {
  const href = useHref();
  const listings = byListing(items, (i) => i.spaceId).sort((a, b) => due(b.items).open - due(a.items).open);
  const paged = usePaged(listings, eventKey);
  const event = items[0] ? refOf(items[0].spaceId, items[0]).event : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={href("/deliveries")} crumb="Deliveries" title={eventName(event)} />
      {listings.length === 0 ? (
        <Empty icon="checkmark-done" title="Nothing to deliver" />
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((l) => {
              const d = due(l.items);
              return (
                <ListingFigureCard
                  key={l.key}
                  href={`${href("/deliveries")}?listing=${encodeURIComponent(l.key)}`}
                  listing={refOf(l.key, l.items[0])}
                  line={d.text}
                  value={d.open}
                  note={d.note}
                  attention={d.open > 0}
                />
              );
            })}
          </CardGrid>
          <Pager {...paged} />
        </>
      )}
    </div>
  );
}

function ListingDeliveries({
  listing,
  items,
  selected,
  view,
  error,
}: {
  listing: ListingRef;
  items: DeliveryItem[];
  selected: string | null;
  view: string | null;
  error: unknown;
}) {
  const { role } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const href = useHref();

  const inView = (i: DeliveryItem, s: Show) => (s === "all" ? true : s === "done" ? i.state === "done" : open(i));
  // Nothing left to do here: show what was delivered rather than an empty list.
  const show: Show = view === "done" || view === "all" || view === "todo" ? view : items.some(open) ? "todo" : "all";
  const base = `${href("/deliveries")}?listing=${encodeURIComponent(listing.id)}`;
  const setShow = (v: Show) => router.replace(`${pathname}?listing=${encodeURIComponent(listing.id)}&view=${v}`, { scroll: false });

  const list = items.filter((i) => inView(i, show));
  const current = items.find((i) => i.id === selected) ?? list[0] ?? null;
  const itemHref = (i: DeliveryItem) => `${base}&view=${show}&item=${encodeURIComponent(i.id)}`;

  const tone = (i: DeliveryItem) => (i.state === "overdue" || (i.kind === "artwork" && role === "creator") ? "caution" : i.state === "done" ? "good" : "calm");
  const status = (i: DeliveryItem) =>
    i.kind === "production" && i.production
      ? i.state === "todo" || i.state === "overdue"
        ? i.production.state === "revision_requested"
          ? stateText(i)
          : countdownText(i.production.dueAt)
        : stateText(i)
      : i.state === "done"
        ? STATE_TEXT.done
        : i.due
          ? dueText(i.due)
          : STATE_TEXT[i.state];

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={`${href("/deliveries")}?${eventParam(listing.event?.key ?? NO_EVENT)}`}
        crumb={eventName(listing.event)}
        title={listing.title}
      />
      <ReadError error={error} />

      <MasterDetail
        showDetail={!!selected && !!current}
        list={
          <div className={`flex flex-col gap-2.5 ${LIST_PANEL} lg:overflow-y-auto`}>
            <ChipRow label="Show">
              <Chip label="To do" count={items.filter((i) => inView(i, "todo")).length} selected={show === "todo"} onClick={() => setShow("todo")} />
              <Chip label="Delivered" count={items.filter((i) => inView(i, "done")).length} selected={show === "done"} onClick={() => setShow("done")} />
              <Chip label="All" count={items.length} selected={show === "all"} onClick={() => setShow("all")} />
            </ChipRow>
            {list.length === 0 ? (
              <Empty icon="checkmark-done" title={show === "todo" ? "Nothing to deliver" : "Nothing here"} />
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((i) => {
                  const selectedRow = i.id === current?.id;
                  return (
                    <li key={i.id}>
                      <Link
                        href={itemHref(i)}
                        scroll={false}
                        aria-current={selectedRow ? "true" : undefined}
                        className={`flex w-full min-w-0 items-center gap-2.5 rounded-[14px] border px-3 py-[11px] text-left transition-colors hover:bg-white/[0.09] ${
                          selectedRow ? "border-[rgba(241,245,249,0.45)] bg-white/[0.09]" : i.state === "overdue" ? "border-amber bg-white/[0.06]" : "border-white/10 bg-white/[0.06]"
                        }`}
                      >
                        <Ion name={KIND_ICON[i.kind]} size={18} className={`shrink-0 ${i.state === "overdue" ? "text-amber" : "text-white/[0.62]"}`} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[14.5px] font-strong text-white">{i.title}</span>
                          <span className="truncate text-[12.5px] text-white/55">{i.sub === KIND_TEXT[i.kind] ? i.sub : `${KIND_TEXT[i.kind]} · ${i.sub}`}</span>
                        </span>
                        <Tag label={status(i)} tone={tone(i)} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        }
        detail={
          current ? (
            <Detail item={current} backHref={`${base}&view=${show}`} />
          ) : (
            <Empty icon="checkmark-done" title="Nothing selected" />
          )
        }
      />
    </div>
  );
}

function Detail({ item, backHref }: { item: DeliveryItem; backHref: string }) {
  const href = useHref();
  const { listings } = useShell();
  const refresh = useRefresh();
  const changed = () => void refresh("views", "work", "listings", "listing");
  const canOpen = listings.some((l) => l.id === item.spaceId) || item.member?.listing.role === "manager";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="lg:hidden">
        <BackHeader title={item.listing} backHref={backHref} />
      </div>
      <SectionLabel
        right={
          canOpen ? (
            <Link href={href(`/listings/${item.spaceId}?tab=deliveries`)} className="inline-flex items-center gap-1 text-[13px] font-strong text-white/[0.62] hover:text-white">
              Open listing
              <Ion name="chevron-forward" size={14} />
            </Link>
          ) : null
        }
      >
        {KIND_TEXT[item.kind]} · {item.listing}
      </SectionLabel>
      <div className="flex flex-col gap-2.5">
        {item.kind === "production" && item.production ? (
          <ProductionSpot
            key={item.id}
            positionId={item.id.slice("production:".length)}
            production={item.production}
            canDeliver={item.owner ? true : item.member?.listing.status === "live" || item.member?.listing.status === "closed"}
            onChanged={changed}
          />
        ) : item.owner?.position && item.kind === "artwork" ? (
          <Review key={item.id} position={item.owner.position} onChanged={changed} />
        ) : item.owner?.position ? (
          <SoldSpot key={item.id} position={item.owner.position} onChanged={changed} />
        ) : item.owner?.deliverable ? (
          <PromiseCard key={item.id} deliverable={item.owner.deliverable} onChanged={changed} />
        ) : item.member?.slot ? (
          <SlotRow
            key={item.id}
            slot={item.member.slot}
            canDeliver={item.member.listing.status === "live" || item.member.listing.status === "closed"}
            onChanged={changed}
          />
        ) : item.member?.deliverable ? (
          <DeliverableRow
            key={item.id}
            deliverable={item.member.deliverable}
            canDeliver={item.member.listing.status === "live" || item.member.listing.status === "closed"}
            onChanged={changed}
          />
        ) : null}
      </div>
    </div>
  );
}
