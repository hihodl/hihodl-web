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
import { btnGlass } from "../hold";
import { Ion } from "../ion";
import { dollars, Skeleton } from "../ui";
import { ReadError, shortDay } from "./common";
import { Card, Empty, money, SectionLabel } from "./kit";
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
  return <EventGrid groups={groups} refOf={refOf} received={sales.data.receivedUsdc} spots={sales.data.soldSpots} spaces={sales.data.spaces} />;
}

type RefOf = (id: string, named?: { spaceTitle: string; serviceName: string | null }) => ReturnType<typeof unknownListing>;

function EventGrid({
  groups,
  refOf,
  received,
  spots,
  spaces,
}: {
  groups: { key: string; items: SalesListing[] }[];
  refOf: RefOf;
  received: string;
  spots: number;
  spaces: number;
}) {
  const href = useHref();
  const paged = usePaged(groups, groups.length);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
        <ReceivedCard received={received} sub={`${spots} ${spots === 1 ? "spot" : "spots"} sold across ${spaces} ${spaces === 1 ? "space" : "spaces"}`} />
        <TeamRow />
      </div>
      {groups.length === 0 ? (
        <Empty icon="cash-outline" title="No sales yet" body="When a brand pays for a spot on one of your spaces, it shows here." />
      ) : null}
      <CardGrid>
        {paged.shown.map((g) => {
          const listings = g.items.map((l) => refOf(l.spaceId, l));
          return (
            <EventCard
              key={g.key}
              href={`${href("/sales")}?${eventParam(g.key)}`}
              event={listings[0]?.event ?? null}
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

/** SalesView's first card: what reached the wallet, not what sponsors were charged. */
function ReceivedCard({ received, sub }: { received: string; sub: string }) {
  return (
    <Card>
      <p className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">Received</p>
      <p className={money}>{dollars(cents(received))}</p>
      <p className="text-[13px] font-strong leading-[18px] text-white/[0.62]">{sub}</p>
      <p className="text-[12px] leading-4 text-white/55">USDC, straight to your wallet when each brand paid.</p>
    </Card>
  );
}

/** SalesView's TeamRow: the way into the team, under the money a share is paid from. */
function TeamRow() {
  const href = useHref();
  return (
    <Card href={href("/team")}>
      <span className="flex items-center gap-3">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.08] text-white">
          <Ion name="people-outline" size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-strong tracking-[-0.2px] text-white">Your team</span>
          <span className="text-[13px] font-strong leading-[18px] text-white/[0.62]">
            Invite the people who sell for you or turn up at the event, and give them a share you pay yourself.
          </span>
        </span>
        <Ion name="chevron-forward" size={16} className="shrink-0 text-white/55" />
      </span>
    </Card>
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
        <Empty icon="cash-outline" title="No sales yet" body="When a brand pays for a spot on one of your spaces, it shows here." />
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
      <div className="flex w-full max-w-[760px] flex-col gap-2.5">
        {total ? <ReceivedCard received={total.receivedUsdc} sub={salesText(total.orders)} /> : null}
        {!sales.data ? (
          sales.error ? <ReadError error={sales.error} /> : <Skeleton className="h-[200px]" />
        ) : rows.length === 0 ? (
          <Empty icon="cash-outline" title="No sales yet" body="When a brand pays for a spot on one of your spaces, it shows here." />
        ) : (
          <>
          <SectionLabel>Recent sales</SectionLabel>
          <ul className="flex flex-col gap-2.5">
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
          </>
        )}
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
  // The app's recent sale: who and what on the left, what reached you in green on the right.
  return (
    <li>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{sponsor}</p>
            <p className="truncate text-[12.5px] font-strong text-white/55">{[what, shortDay(row.paidAt)].filter(Boolean).join(" · ")}</p>
          </div>
          <p className="shrink-0 text-[15px] font-strong tabular-nums text-[#2FBE8A]">{row.receivedUsdc} USDC</p>
        </div>
        {outbid ? <p className="text-[12.5px] font-strong text-white/55">Taken over since: the next brand repaid this one</p> : null}
        {offerHref ? (
          <Link href={offerHref} scroll={false} className={`${btnGlass} self-start`}>
            Offer them content
          </Link>
        ) : null}
      </Card>
    </li>
  );
}
