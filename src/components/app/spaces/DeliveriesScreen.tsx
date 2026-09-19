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
import { IconArrowLeft, IconDeliveries } from "../icons";
import { useShell } from "../Shell";
import { EmptyState, FilterPills, Panel, RowLink, Skeleton } from "../ui";
import { countdownText, dueText, LIST_PANEL, MasterDetail, ReadError } from "./common";
import { CardGrid, DrillBar, EventCard, eventName, eventParam, ListingFigureCard, Pager, unknownListing, useListingRefs, usePaged } from "./cards";

type Show = "todo" | "done" | "all";

const KIND_TEXT: Record<DeliveryItem["kind"], string> = { artwork: "Artwork", spot: "Spot", promise: "Promise", production: "Production" };
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
    return (
      <Panel>
        <EmptyState title="Nothing to deliver." />
      </Panel>
    );
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
        <Panel>
          <EmptyState title="Nothing to deliver here." />
        </Panel>
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

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={`${href("/deliveries")}?${eventParam(listing.event?.key ?? NO_EVENT)}`}
        crumb={eventName(listing.event)}
        title={listing.title}
        right={
          <FilterPills
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: "todo", label: "To do", count: items.filter((i) => inView(i, "todo")).length },
              { value: "done", label: "Delivered", count: items.filter((i) => inView(i, "done")).length },
              { value: "all", label: "All", count: items.length },
            ]}
          />
        }
      />
      <ReadError error={error} />

      <MasterDetail
        showDetail={!!selected && !!current}
        list={
          <Panel
            title={show === "done" ? "Delivered" : show === "all" ? "All" : "To do"}
            meta={`${list.length}`}
            className={LIST_PANEL}
            bodyClassName="min-h-0 overflow-y-auto"
          >
            {list.length === 0 ? (
              <EmptyState title={show === "todo" ? "Nothing to deliver." : "Nothing here."} />
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((i) => (
                  <li key={i.id}>
                    <RowLink
                      href={itemHref(i)}
                      selected={i.id === current?.id}
                      title={i.title}
                      sub={i.sub === KIND_TEXT[i.kind] ? i.sub : `${KIND_TEXT[i.kind]} · ${i.sub}`}
                      right={
                        <span className={`text-[11px] ${i.state === "overdue" || (i.kind === "artwork" && role === "creator") ? "text-amber" : "text-[#9FB7C2]"}`}>
                          {i.kind === "production" && i.production
                            ? i.state === "todo" || i.state === "overdue"
                              ? i.production.state === "revision_requested"
                                ? stateText(i)
                                : countdownText(i.production.dueAt)
                              : stateText(i)
                            : i.state === "done"
                              ? STATE_TEXT.done
                              : i.due
                                ? dueText(i.due)
                                : STATE_TEXT[i.state]}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        }
        detail={
          current ? (
            <Detail item={current} backHref={`${base}&view=${show}`} />
          ) : (
            <Panel>
              <EmptyState title="Nothing selected." />
            </Panel>
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
    <div className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text lg:hidden">
        <IconArrowLeft className="h-3.5 w-3.5" />
        {item.listing}
      </Link>
      <Panel
        title={item.listing}
        meta={KIND_TEXT[item.kind]}
        action={
          canOpen ? (
            <Link href={href(`/listings/${item.spaceId}?tab=deliveries`)} className="text-tiny text-[#9FB7C2] hover:text-text">
              Open listing
            </Link>
          ) : null
        }
      >
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
      </Panel>
    </div>
  );
}
