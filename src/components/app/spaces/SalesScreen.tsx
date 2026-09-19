"use client";

/**
 * Spaces › Sales: money that arrived, by event, then by listing, then the
 * sales of one listing.
 *
 * A sale is an order that paid (`SALE_STATUSES`); nothing waiting to be paid
 * is here. `receivedUsdc` is the server's own figure for the creator's leg of
 * each order — not what sponsors were charged — so every total says
 * "received".
 *
 * Every total is the server's (`listings`, over all the creator's sales), not
 * a sum of the latest orders the page happens to hold. An event's figure is
 * its listings' totals added; a listing's page reads all of its own sales.
 *
 *   /sales                 one card per event, and "Not tied to an event"
 *   /sales?event=<slug>    that event's listings
 *   /sales?listing=<id>    that listing's sales
 *   /sales?listing=<id>&offer=<orderId>
 *                          "Offer them content": a message for the brand behind
 *                          that sale, to copy (./ContentOffer)
 */

import Link from "next/link";
import { useMemo } from "react";

import type { PositionView, SalesListing } from "@/lib/creator/listing";
import { byEvent, cents, kindsText, listingTotals, NO_EVENT, paidSales, type SaleRow } from "@/lib/app/spaces-model";
import { useListing, useListingSales, useSales } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { IconSales } from "../icons";
import { dollars, EmptyState, Panel, Skeleton } from "../ui";
import { ReadError, shortDay } from "./common";
import { ContentOfferScreen, midSentence, useOffersContent, useTemplateFormats, type ContentLead } from "./ContentOffer";
import {
  CardGrid,
  DrillBar,
  EventCard,
  eventName,
  eventParam,
  KIND_NAME,
  ListingFigureCard,
  Pager,
  unknownListing,
  useListingRefs,
  usePaged,
} from "./cards";

const salesText = (n: number) => `${n} ${n === 1 ? "sale" : "sales"}`;

/** Server totals added across listings: an event is the listings under it. */
const sumReceived = (ls: readonly SalesListing[]) => ls.reduce((n, l) => n + cents(l.receivedUsdc), 0);
const sumOrders = (ls: readonly SalesListing[]) => ls.reduce((n, l) => n + l.orders, 0);

export function SalesScreen({ event, listing, offer = null }: { event: string | null; listing: string | null; offer?: string | null }) {
  const sales = useSales();
  const refs = useListingRefs();
  const totals = useMemo(() => listingTotals(sales.data), [sales.data]);

  if (!sales.data) {
    return sales.error ? <ReadError error={sales.error} /> : <Skeleton className="h-[260px]" />;
  }
  const refOf: RefOf = (id, named) => refs.get(id) ?? unknownListing(id, named?.serviceName || named?.spaceTitle || "Listing");

  if (listing) return <ListingSales spaceId={listing} total={totals.find((l) => l.spaceId === listing) ?? null} refOf={refOf} offer={offer} />;
  if (event) return <EventSales eventKey={event} totals={totals} refOf={refOf} />;

  const groups = byEvent(totals, (l) => l.spaceId, refs).sort(
    (a, b) => Number(a.key === NO_EVENT) - Number(b.key === NO_EVENT) || sumReceived(b.items) - sumReceived(a.items),
  );
  return <EventGrid groups={groups} refOf={refOf} received={sales.data.receivedUsdc} orders={sales.data.orders} />;
}

type RefOf = (id: string, named?: { spaceTitle: string; serviceName: string | null }) => ReturnType<typeof unknownListing>;

function EventGrid({
  groups,
  refOf,
  received,
  orders,
}: {
  groups: { key: string; items: SalesListing[] }[];
  refOf: RefOf;
  received: string;
  orders: number;
}) {
  const href = useHref();
  const paged = usePaged(groups, groups.length);

  if (groups.length === 0) {
    return (
      <Panel>
        <EmptyState title="No sales yet." />
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-baseline gap-x-2 text-tiny text-[#9FB7C2]">
        <span className="text-[18px] font-medium tabular-nums text-text">{dollars(cents(received))}</span>
        received · {salesText(orders)}
      </p>
      <CardGrid>
        {paged.shown.map((g) => {
          const listings = g.items.map((l) => refOf(l.spaceId, l));
          return (
            <EventCard
              key={g.key}
              href={`${href("/sales")}?${eventParam(g.key)}`}
              event={listings[0]?.event ?? null}
              icon={IconSales}
              lines={[kindsText(listings.map((l) => l.kind)) || "Listings"]}
              value={dollars(sumReceived(g.items))}
              note={salesText(sumOrders(g.items))}
            />
          );
        })}
      </CardGrid>
      <Pager {...paged} />
    </div>
  );
}

function EventSales({ eventKey, totals, refOf }: { eventKey: string; totals: SalesListing[]; refOf: RefOf }) {
  const href = useHref();
  const here = totals
    .filter((l) => (refOf(l.spaceId, l).event?.key ?? NO_EVENT) === eventKey)
    .sort((a, b) => cents(b.receivedUsdc) - cents(a.receivedUsdc));
  const paged = usePaged(here, eventKey);
  const event = here[0] ? refOf(here[0].spaceId, here[0]).event : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={href("/sales")}
        crumb="Sales"
        title={eventName(event)}
        right={here.length ? <p className="text-tiny tabular-nums text-[#9FB7C2]">{dollars(sumReceived(here))} received</p> : null}
      />
      {here.length === 0 ? (
        <Panel>
          <EmptyState title="No sales here." />
        </Panel>
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((l) => {
              const ref = refOf(l.spaceId, l);
              return (
                <ListingFigureCard
                  key={l.spaceId}
                  href={`${href("/sales")}?listing=${encodeURIComponent(l.spaceId)}`}
                  listing={ref}
                  line={ref.kind ? KIND_NAME[ref.kind] : "Listing"}
                  value={dollars(cents(l.receivedUsdc))}
                  note={salesText(l.orders)}
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

/** Eight rows: a listing's sales page like its cards do, and never scroll. */
const ROWS = 8;

function ListingSales({ spaceId, total, refOf, offer }: { spaceId: string; total: SalesListing | null; refOf: RefOf; offer: string | null }) {
  const href = useHref();
  const { listings } = useShell();
  const offersContent = useOffersContent();
  const { nameOf } = useTemplateFormats();
  const ref = refOf(spaceId, total ?? undefined);
  // Every sale of this one listing, not the latest across all of them.
  const sales = useListingSales(spaceId);
  const rows = useMemo(() => paidSales(sales.data).filter((r) => r.spaceId === spaceId), [sales.data, spaceId]);
  // What each sale bought lives on the listing's positions, not on the order.
  const space = useListing(spaceId);
  const positions = useMemo(() => new Map((space.data?.positions ?? []).map((p) => [p.zoneKey, p])), [space.data]);
  const paged = usePaged(rows, spaceId, ROWS);
  const here = `${href("/sales")}?listing=${encodeURIComponent(spaceId)}`;

  // A brand that paid for a spot, by name, still holding it: someone to offer content to.
  const card = listings.find((l) => l.id === spaceId);
  const canOffer = offersContent(card);
  const kind = ref.kind ?? "placement";
  const product = midSentence((card && nameOf(card.templateId)) || card?.serviceName || (kind === "placement" ? "product" : "content"));
  const leads: ContentLead[] = canOffer
    ? rows
        .filter((r) => r.status === "paid" && r.sponsorName)
        .map((r) => {
          const p = positions.get(r.zoneKey);
          return {
            key: r.orderId,
            brand: r.sponsorName!,
            bought: p?.title ?? p?.label ?? r.zoneKey,
            kind,
            product,
            listing: ref.title,
            event: ref.event ? { slug: ref.event.key, name: ref.event.name, city: ref.event.city, startsOn: ref.event.startsOn, endsOn: ref.event.endsOn } : null,
          };
        })
    : [];

  if (offer) {
    if (!sales.data || (!space.data && !space.error)) return sales.error ? <ReadError error={sales.error} /> : <Skeleton className="h-[320px]" />;
    return <ContentOfferScreen back={here} crumb={ref.title} leads={leads} initial={offer} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={`${href("/sales")}?${eventParam(ref.event?.key ?? NO_EVENT)}`}
        crumb={eventName(ref.event)}
        title={ref.title}
      />
      <Panel
        className="w-full max-w-[760px]"
        title="Sales"
        meta={total ? `${salesText(total.orders)} · ${dollars(cents(total.receivedUsdc))} received` : ""}
      >
        {!sales.data ? (
          sales.error ? <ReadError error={sales.error} /> : <Skeleton className="h-[200px]" />
        ) : rows.length === 0 ? (
          <EmptyState title="No sales on this listing." />
        ) : (
          <ul className="flex flex-col">
            {paged.shown.map((r) => (
              <SaleLine
                key={r.orderId}
                row={r}
                position={positions.get(r.zoneKey) ?? null}
                loading={!space.data && !space.error}
                offerHref={leads.some((l) => l.key === r.orderId) ? `${here}&offer=${encodeURIComponent(r.orderId)}` : null}
              />
            ))}
          </ul>
        )}
      </Panel>
      <div className="w-full max-w-[760px]">
        <Pager {...paged} />
      </div>
    </div>
  );
}

function SaleLine({
  row,
  position,
  loading,
  offerHref,
}: {
  row: SaleRow;
  position: PositionView | null;
  loading: boolean;
  /** "Offer them content", on a sale to a named brand that still holds its spot. */
  offerHref: string | null;
}) {
  // The name comes with the sale. The position's is only a fallback for a
  // server older than that, and only while this order still holds the spot.
  const outbid = row.status === "outbid";
  const sponsor = row.sponsorName ?? (outbid ? null : position?.sponsor?.name) ?? (loading && row.sponsorName === undefined ? "…" : "Sponsor");
  const what = position?.title ?? position?.label ?? row.zoneKey;
  return (
    <li className="flex min-w-0 items-center gap-3 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-small text-text">{sponsor}</p>
        <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{outbid ? `${what} · outbid since` : what}</p>
      </div>
      {offerHref ? (
        <Link
          href={offerHref}
          scroll={false}
          className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
        >
          Offer them content
        </Link>
      ) : null}
      <div className="shrink-0 text-right">
        <p className="text-small tabular-nums text-text">{row.receivedUsdc} USDC</p>
        <p className="mt-0.5 text-tiny text-[#9FB7C2]">{shortDay(row.paidAt)}</p>
      </div>
    </li>
  );
}
