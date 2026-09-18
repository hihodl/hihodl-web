"use client";

/**
 * Spaces › Offers & bids: what sponsors put on the table, by event, then by
 * listing, then the inbox of one listing.
 *
 *   /offers                   one card per event: what waits on you there
 *   /offers?event=<slug>      that event's listings
 *   /offers?listing=<id>      that listing's offers and bids; `&id=` opens one
 *
 * One listing's inbox is a list on the left and the one you picked on the
 * right, answered with the same card the listing page uses (`OfferCard`), so
 * an answer here is the same call with the same version pin. `?id=<offer>`
 * alone opens its listing with it chosen, which is where the Overview's
 * "Needs you" rows land; `&from=listing` sends Back to the listing's hub.
 *
 * A manager's inbox is read listing by listing: `offers/received` is the
 * owner's only.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { OfferCard } from "@/components/creator/run/Offers";
import { timeLeft } from "@/lib/ad-space/format";
import type { OfferView } from "@/lib/creator/listing";
import { byEvent, byListing, NO_EVENT, OPEN_OFFER, type ListingRef } from "@/lib/app/spaces-model";
import { useListing, useManagedOffers, useOffers, useRefresh } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { IconArrowLeft, IconOffers } from "../icons";
import { useShell } from "../Shell";
import { EmptyState, FilterPills, Panel, RowLink, Skeleton } from "../ui";
import { LIST_PANEL, MasterDetail, ReadError } from "./common";
import { CardGrid, DrillBar, EventCard, eventName, eventParam, ListingFigureCard, Pager, unknownListing, useListingRefs, usePaged } from "./cards";

type Show = "waiting" | "open" | "all";
type Kind = "all" | "offer" | "bid";

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting on you",
  countered: "Countered",
  accepted: "Accepted",
  paid: "Paid",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
  lapsed: "Lapsed",
  superseded: "Outbid",
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What waits on you in a set of offers: "2 offers · 1 bid waiting". */
function waiting(offers: readonly OfferView[]) {
  const pending = offers.filter((o) => o.status === "pending");
  const bids = pending.filter((o) => o.kind === "bid").length;
  const plain = pending.length - bids;
  const open = offers.filter((o) => OPEN_OFFER.includes(o.status)).length;
  const parts = [plain ? count(plain, "offer", "offers") : "", bids ? count(bids, "bid", "bids") : ""].filter(Boolean);
  return {
    count: pending.length,
    text: parts.length ? `${parts.join(" · ")} waiting` : "Nothing waiting on you",
    note: open > pending.length ? `${open - pending.length} with the sponsor` : `${offers.length} in total`,
  };
}

export function OffersScreen({
  event,
  listing,
  selected,
  view,
  from,
}: {
  event: string | null;
  listing: string | null;
  selected: string | null;
  view: string | null;
  from: string | null;
}) {
  const { role, managed } = useShell();
  const ids = useMemo(() => managed.map((m) => m.spaceId), [managed]);
  const own = useOffers(role === "creator");
  const theirs = useManagedOffers(role === "manager" ? ids : null);
  const read = role === "creator" ? own : theirs;
  const offers = useMemo(() => read.data ?? (role === "manager" && ids.length === 0 ? [] : null), [read.data, role, ids.length]);
  const refs = useListingRefs();
  const refOf = (id: string, o?: OfferView) => refs.get(id) ?? unknownListing(id, o ? o.serviceName || o.spaceTitle : "Listing");

  if (offers === null) return read.error ? <ReadError error={read.error} /> : <Skeleton className="h-[260px]" />;

  const spaceId = listing ?? offers.find((o) => o.id === selected)?.spaceId ?? null;
  if (spaceId) {
    const here = offers.filter((o) => o.spaceId === spaceId);
    return (
      <ListingOffers
        listing={refOf(spaceId, here[0])}
        offers={here}
        selected={selected}
        view={view}
        fromHub={from === "listing"}
        error={read.error}
      />
    );
  }

  const groups = byEvent(offers, (o) => o.spaceId, refs).sort(
    (a, b) =>
      Number(a.key === NO_EVENT) - Number(b.key === NO_EVENT) ||
      waiting(b.items).count - waiting(a.items).count ||
      b.items.length - a.items.length,
  );
  if (event) {
    return <EventOffers eventKey={event} offers={groups.find((g) => g.key === event)?.items ?? []} refOf={refOf} />;
  }
  return (
    <>
      <ReadError error={read.error} />
      <EventGrid groups={groups} refOf={refOf} />
    </>
  );
}

type RefOf = (id: string, o?: OfferView) => ListingRef;

function EventGrid({ groups, refOf }: { groups: { key: string; items: OfferView[] }[]; refOf: RefOf }) {
  const href = useHref();
  const paged = usePaged(groups, groups.length);
  if (groups.length === 0) {
    return (
      <Panel>
        <EmptyState title="No offers yet." />
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <CardGrid>
        {paged.shown.map((g) => {
          const w = waiting(g.items);
          const listings = byListing(g.items, (o) => o.spaceId).length;
          return (
            <EventCard
              key={g.key}
              href={`${href("/offers")}?${eventParam(g.key)}`}
              event={refOf(g.items[0].spaceId, g.items[0]).event}
              icon={IconOffers}
              lines={[w.text, count(listings, "listing", "listings")]}
              value={w.count}
              note={w.note}
              attention={w.count > 0}
            />
          );
        })}
      </CardGrid>
      <Pager {...paged} />
    </div>
  );
}

function EventOffers({ eventKey, offers, refOf }: { eventKey: string; offers: OfferView[]; refOf: RefOf }) {
  const href = useHref();
  const listings = byListing(offers, (o) => o.spaceId).sort((a, b) => waiting(b.items).count - waiting(a.items).count);
  const paged = usePaged(listings, eventKey);
  const event = offers[0] ? refOf(offers[0].spaceId, offers[0]).event : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={href("/offers")} crumb="Offers & bids" title={eventName(event)} />
      {listings.length === 0 ? (
        <Panel>
          <EmptyState title="No offers here." />
        </Panel>
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((l) => {
              const w = waiting(l.items);
              return (
                <ListingFigureCard
                  key={l.key}
                  href={`${href("/offers")}?listing=${encodeURIComponent(l.key)}`}
                  listing={refOf(l.key, l.items[0])}
                  line={w.text}
                  value={w.count}
                  note={w.note}
                  attention={w.count > 0}
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

function ListingOffers({
  listing,
  offers,
  selected,
  view,
  fromHub,
  error,
}: {
  listing: ListingRef;
  offers: OfferView[];
  selected: string | null;
  view: string | null;
  fromHub: boolean;
  error: unknown;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const href = useHref();
  const [kind, setKind] = useState<Kind>("all");

  const inView = (o: OfferView, s: Show) =>
    s === "all" ? true : s === "open" ? OPEN_OFFER.includes(o.status) : o.status === "pending";
  // Nothing waiting: open on everything rather than an empty list.
  const show: Show =
    view === "open" || view === "all" || view === "waiting" ? view : offers.some((o) => inView(o, "waiting")) ? "waiting" : "all";
  const keep = `listing=${encodeURIComponent(listing.id)}${fromHub ? "&from=listing" : ""}`;
  const base = `${href("/offers")}?${keep}`;
  const setShow = (v: Show) => router.replace(`${pathname}?${keep}&view=${v}${selected ? `&id=${selected}` : ""}`, { scroll: false });

  const list = offers.filter((o) => inView(o, show) && (kind === "all" || o.kind === kind));
  // Nothing picked: the first one is open beside the list on a wide screen,
  // and the list is what a phone shows.
  const current = offers.find((o) => o.id === selected) ?? list[0] ?? null;
  const rowHref = (o: OfferView) => `${base}&view=${show}&id=${o.id}`;
  const hasBoth = offers.some((o) => o.kind === "bid") && offers.some((o) => o.kind === "offer");

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={fromHub ? href(`/listings/${listing.id}`) : `${href("/offers")}?${eventParam(listing.event?.key ?? NO_EVENT)}`}
        crumb={fromHub ? listing.title : eventName(listing.event)}
        title={fromHub ? "Offers & bids" : listing.title}
        right={
          <div className="flex flex-wrap items-center gap-3">
            <FilterPills
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: "waiting", label: "Waiting on you", count: offers.filter((o) => inView(o, "waiting")).length },
                { value: "open", label: "Open", count: offers.filter((o) => inView(o, "open")).length },
                { value: "all", label: "All", count: offers.length },
              ]}
            />
            {hasBoth ? (
              <FilterPills
                label="Kind"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "Both" },
                  { value: "offer", label: "Offers" },
                  { value: "bid", label: "Bids" },
                ]}
              />
            ) : null}
          </div>
        }
      />
      <ReadError error={error} />

      <MasterDetail
        showDetail={!!selected && !!current}
        list={
          <Panel title="Inbox" meta={`${list.length}`} className={LIST_PANEL} bodyClassName="min-h-0 overflow-y-auto">
            {list.length === 0 ? (
              <EmptyState title={show === "waiting" ? "Nothing waiting on you." : "No offers."} />
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((o) => {
                  const left = o.expiresAt ? new Date(o.expiresAt).getTime() - Date.now() : null;
                  return (
                    <li key={o.id}>
                      <RowLink
                        href={rowHref(o)}
                        selected={o.id === current?.id}
                        title={`${o.sponsor.name} · ${o.amountUsdc} USDC`}
                        sub={`${o.kind === "bid" ? "Bid" : "Offer"}${o.positionLabel ? ` · ${o.positionLabel}` : ""}`}
                        right={
                          <span className={`text-[11px] ${o.status === "pending" ? "text-amber" : "text-[#9FB7C2]"}`}>
                            {o.status === "pending" && left !== null && left > 0 ? `${timeLeft(left)} left` : STATUS_TEXT[o.status] ?? o.status}
                          </span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        }
        detail={
          current ? (
            <OfferDetail offer={current} backHref={`${base}&view=${show}`} />
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

function OfferDetail({ offer, backHref }: { offer: OfferView; backHref: string }) {
  const href = useHref();
  const space = useListing(offer.spaceId);
  const refresh = useRefresh();

  return (
    <div className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="inline-flex w-fit items-center gap-1.5 text-tiny text-[#9FB7C2] hover:text-text lg:hidden">
        <IconArrowLeft className="h-3.5 w-3.5" />
        Inbox
      </Link>
      <Panel
        title={offer.serviceName || offer.spaceTitle}
        meta={offer.positionLabel ?? undefined}
        action={
          <Link href={href(`/listings/${offer.spaceId}?tab=offers`)} className="text-tiny text-[#9FB7C2] hover:text-text">
            Open listing
          </Link>
        }
      >
        {space.data ? (
          <OfferCard
            offer={offer}
            space={space.data}
            onChanged={() => void refresh("offers", "managed-offers", "listing", "listings", "views")}
          />
        ) : space.error ? (
          <ReadError error={space.error} />
        ) : (
          <Skeleton className="h-48" />
        )}
      </Panel>
    </div>
  );
}
