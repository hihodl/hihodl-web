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
 *   /sales                 one card per event, and "Not tied to an event"
 *   /sales?event=<slug>    that event's listings
 *   /sales?listing=<id>    that listing's sales
 */

import { useMemo } from "react";

import type { PositionView } from "@/lib/creator/listing";
import { byEvent, byListing, cents, kindsText, NO_EVENT, paidSales, receivedCents, type SaleRow } from "@/lib/app/spaces-model";
import { useListing, useSales } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { IconSales } from "../icons";
import { dollars, EmptyState, Panel, Skeleton } from "../ui";
import { ReadError, shortDay } from "./common";
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

export function SalesScreen({ event, listing }: { event: string | null; listing: string | null }) {
  const sales = useSales();
  const refs = useListingRefs();
  const rows = useMemo(() => paidSales(sales.data), [sales.data]);

  if (!sales.data) {
    return sales.error ? <ReadError error={sales.error} /> : <Skeleton className="h-[260px]" />;
  }
  // `recent` is the server's latest orders, not all of them: say so when it is cut.
  const partial = rows.length < sales.data.orders;
  const refOf = (id: string, row?: SaleRow) => refs.get(id) ?? unknownListing(id, row?.serviceName || row?.spaceTitle || "Listing");

  if (listing) return <ListingSales spaceId={listing} rows={rows.filter((r) => r.spaceId === listing)} refOf={refOf} />;
  if (event) return <EventSales eventKey={event} rows={rows} refOf={refOf} />;

  const groups = byEvent(rows, (r) => r.spaceId, refs).sort(
    (a, b) => Number(a.key === NO_EVENT) - Number(b.key === NO_EVENT) || receivedCents(b.items) - receivedCents(a.items),
  );
  return <EventGrid groups={groups} refOf={refOf} received={sales.data.receivedUsdc} partial={partial} />;
}

type RefOf = (id: string, row?: SaleRow) => ReturnType<typeof unknownListing>;

function EventGrid({
  groups,
  refOf,
  received,
  partial,
}: {
  groups: { key: string; items: SaleRow[] }[];
  refOf: RefOf;
  received: string;
  partial: boolean;
}) {
  const href = useHref();
  const paged = usePaged(groups, groups.length);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

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
        received · {salesText(total)}
        {partial ? ` · the cards add up your latest ${total}` : ""}
      </p>
      <CardGrid>
        {paged.shown.map((g) => {
          const listings = byListing(g.items, (r) => r.spaceId).map((l) => refOf(l.key, l.items[0]));
          return (
            <EventCard
              key={g.key}
              href={`${href("/sales")}?${eventParam(g.key)}`}
              event={listings[0]?.event ?? null}
              icon={IconSales}
              lines={[kindsText(listings.map((l) => l.kind)) || "Listings"]}
              value={dollars(receivedCents(g.items))}
              note={salesText(g.items.length)}
            />
          );
        })}
      </CardGrid>
      <Pager {...paged} />
    </div>
  );
}

function EventSales({ eventKey, rows, refOf }: { eventKey: string; rows: SaleRow[]; refOf: RefOf }) {
  const href = useHref();
  const here = rows.filter((r) => (refOf(r.spaceId, r).event?.key ?? NO_EVENT) === eventKey);
  const listings = byListing(here, (r) => r.spaceId).sort((a, b) => receivedCents(b.items) - receivedCents(a.items));
  const paged = usePaged(listings, eventKey);
  const event = here[0] ? refOf(here[0].spaceId, here[0]).event : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={href("/sales")}
        crumb="Sales"
        title={eventName(event)}
        right={here.length ? <p className="text-tiny tabular-nums text-[#9FB7C2]">{dollars(receivedCents(here))} received</p> : null}
      />
      {listings.length === 0 ? (
        <Panel>
          <EmptyState title="No sales here." />
        </Panel>
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((l) => {
              const ref = refOf(l.key, l.items[0]);
              return (
                <ListingFigureCard
                  key={l.key}
                  href={`${href("/sales")}?listing=${encodeURIComponent(l.key)}`}
                  listing={ref}
                  line={ref.kind ? KIND_NAME[ref.kind] : "Listing"}
                  value={dollars(receivedCents(l.items))}
                  note={salesText(l.items.length)}
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

function ListingSales({ spaceId, rows, refOf }: { spaceId: string; rows: SaleRow[]; refOf: RefOf }) {
  const href = useHref();
  const ref = refOf(spaceId, rows[0]);
  // Who paid and for what live on the listing's positions, not on the order.
  const space = useListing(spaceId);
  const positions = useMemo(() => new Map((space.data?.positions ?? []).map((p) => [p.zoneKey, p])), [space.data]);
  const paged = usePaged(rows, spaceId, ROWS);

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={`${href("/sales")}?${eventParam(ref.event?.key ?? NO_EVENT)}`}
        crumb={eventName(ref.event)}
        title={ref.title}
      />
      <Panel title="Sales" meta={rows.length ? `${salesText(rows.length)} · ${dollars(receivedCents(rows))} received` : ""}>
        {rows.length === 0 ? (
          <EmptyState title="No sales on this listing." />
        ) : (
          <ul className="flex flex-col">
            {paged.shown.map((r) => (
              <SaleLine key={r.orderId} row={r} position={positions.get(r.zoneKey) ?? null} loading={!space.data && !space.error} />
            ))}
          </ul>
        )}
      </Panel>
      <Pager {...paged} />
    </div>
  );
}

function SaleLine({ row, position, loading }: { row: SaleRow; position: PositionView | null; loading: boolean }) {
  // A spot taken over since: this order paid, and the next sponsor holds it now.
  const sponsor = row.status === "outbid" ? "Outbid since" : position?.sponsor?.name ?? (loading ? "…" : "Sponsor");
  const what = position?.title ?? position?.label ?? row.zoneKey;
  return (
    <li className="flex min-w-0 items-center gap-3 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-small text-text">{sponsor}</p>
        <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{what}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-small tabular-nums text-text">{row.receivedUsdc} USDC</p>
        <p className="mt-0.5 text-tiny text-[#9FB7C2]">{shortDay(row.paidAt)}</p>
      </div>
    </li>
  );
}
