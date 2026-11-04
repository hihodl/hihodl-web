"use client";

/**
 * Spaces › Offers & bids: what sponsors put on the table, by event, then by
 * listing, then the inbox of one listing.
 *
 *   /offers                   one card per event: what waits on you there
 *   /offers?event=<slug>      that event's listings
 *   /offers?listing=<id>      that listing's offers and bids; `&id=` opens one
 *
 * One listing's inbox is the app's Offers tab (ReceivedOffersList): "Waiting
 * on you", then "Earlier", each thread a card under the spot it is on,
 * answered with the same thread the listing page uses (`OfferCard`), so an
 * answer here is the same call with the same version pin. `?id=<offer>` alone
 * opens its listing with that thread outlined and in view, which is where the
 * Overview's "Needs you" rows land; `&from=listing` sends Back to the
 * listing's hub.
 *
 * A manager's inbox is read listing by listing: `offers/received` is the
 * owner's only.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { OfferCard } from "@/components/creator/run/Offers";
import type { OfferView } from "@/lib/creator/listing";
import { byEvent, byListing, NO_EVENT, OPEN_OFFER, type ListingRef } from "@/lib/app/spaces-model";
import { useListing, useManagedOffers, useOffers, useRefresh } from "@/lib/app/spaces-data";
import { t } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { Ion } from "../ion";
import { useShell } from "../Shell";
import { Skeleton } from "../ui";
import { ReadError } from "./common";
import { Card, Chip, ChipRow, Divider, Empty, SectionLabel } from "./kit";
import { CardGrid, DrillBar, EventCard, eventName, eventParam, ListingFigureCard, Pager, unknownListing, useListingRefs, usePaged } from "./cards";

type Show = "waiting" | "open" | "all";
type Kind = "all" | "offer" | "bid";

/** What waits on you in a set of offers: "2 offers · 1 bid waiting". */
function waiting(offers: readonly OfferView[]) {
  const pending = offers.filter((o) => o.status === "pending");
  const bids = pending.filter((o) => o.kind === "bid").length;
  const plain = pending.length - bids;
  const open = offers.filter((o) => OPEN_OFFER.includes(o.status)).length;
  const parts = [plain ? t("creator.offers.countOffers", { count: plain }) : "", bids ? t("creator.offers.countBids", { count: bids }) : ""].filter(Boolean);
  return {
    count: pending.length,
    text: parts.length ? t("creator.offers.waitingParts", { parts: parts.join(" · ") }) : t("creator.offers.nothingWaiting"),
    note: open > pending.length ? t("creator.offers.withSponsor", { count: open - pending.length }) : t("creator.offers.inTotal", { count: offers.length }),
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
  const t = useT();
  const { role, managed } = useShell();
  const ids = useMemo(() => managed.map((m) => m.spaceId), [managed]);
  const own = useOffers(role === "creator");
  const theirs = useManagedOffers(role === "manager" ? ids : null);
  const read = role === "creator" ? own : theirs;
  const offers = useMemo(() => read.data ?? (role === "manager" && ids.length === 0 ? [] : null), [read.data, role, ids.length]);
  const refs = useListingRefs();
  const refOf = (id: string, o?: OfferView) => refs.get(id) ?? unknownListing(id, o ? o.serviceName || o.spaceTitle : t("creator.offers.listingFallback"));

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
  const t = useT();
  const href = useHref();
  const paged = usePaged(groups, groups.length);
  if (groups.length === 0) {
    return (
      <Empty
        icon="pricetags-outline"
        title={t("creator.offers.emptyTitle")}
        body={t("creator.offers.emptyBody")}
      />
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
              lines={[w.text, t("creator.offers.countListings", { count: listings })]}
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
  const t = useT();
  const href = useHref();
  const listings = byListing(offers, (o) => o.spaceId).sort((a, b) => waiting(b.items).count - waiting(a.items).count);
  const paged = usePaged(listings, eventKey);
  const event = offers[0] ? refOf(offers[0].spaceId, offers[0]).event : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={href("/offers")} crumb={t("creator.offers.title")} title={eventName(event)} />
      {listings.length === 0 ? (
        <Empty icon="pricetags-outline" title={t("creator.offers.emptyTitle")} />
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
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const href = useHref();
  const space = useListing(listing.id);
  const refresh = useRefresh();
  const [kind, setKind] = useState<Kind>("all");

  const inView = (o: OfferView, s: Show) =>
    s === "all" ? true : s === "open" ? OPEN_OFFER.includes(o.status) : o.status === "pending";
  // Nothing waiting: open on everything rather than an empty list.
  const show: Show =
    view === "open" || view === "all" || view === "waiting" ? view : offers.some((o) => inView(o, "waiting")) ? "waiting" : "all";
  const keep = `listing=${encodeURIComponent(listing.id)}${fromHub ? "&from=listing" : ""}`;
  const setShow = (v: Show) => router.replace(`${pathname}?${keep}&view=${v}${selected ? `&id=${selected}` : ""}`, { scroll: false });

  const list = offers.filter((o) => inView(o, show) && (kind === "all" || o.kind === kind));
  // The app's Offers tab: what needs an answer first, then the rest.
  const open = list.filter((o) => OPEN_OFFER.includes(o.status));
  const earlier = list.filter((o) => !OPEN_OFFER.includes(o.status));
  const hasBoth = offers.some((o) => o.kind === "bid") && offers.some((o) => o.kind === "offer");

  // Arriving on one thread (the Overview's "Needs you"): bring it into view.
  useEffect(() => {
    if (!selected) return;
    document.getElementById(`offer-${selected}`)?.scrollIntoView({ block: "center" });
  }, [selected, space.data]);

  const row = (o: OfferView) => (
    <div key={o.id} id={`offer-${o.id}`}>
      <Card className={o.id === selected ? "!border-[rgba(241,245,249,0.45)]" : ""}>
        <Link href={href(`/listings/${o.spaceId}?tab=offers`)} scroll={false} className="flex items-center gap-2.5 hover:opacity-80">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15.5px] font-strong tracking-[-0.2px] text-white">{o.serviceName || o.spaceTitle || listing.title}</span>
            {o.positionLabel ? <span className="truncate text-[12.5px] font-strong text-white/55">{o.positionLabel}</span> : null}
          </span>
          <Ion name="chevron-forward" size={16} className="shrink-0 text-white/55" />
        </Link>
        <Divider />
        {space.data ? (
          <OfferCard offer={o} space={space.data} onChanged={() => void refresh("offers", "managed-offers", "listing", "listings", "views")} />
        ) : space.error ? (
          <ReadError error={space.error} />
        ) : (
          <Skeleton className="h-32" />
        )}
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <DrillBar
        back={fromHub ? href(`/listings/${listing.id}`) : `${href("/offers")}?${eventParam(listing.event?.key ?? NO_EVENT)}`}
        crumb={fromHub ? listing.title : eventName(listing.event)}
        title={fromHub ? t("creator.offers.title") : listing.title}
      />
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
        <ChipRow label={t("creator.offers.show")}>
          <Chip label={t("creator.offers.waitingOnYou")} count={offers.filter((o) => inView(o, "waiting")).length} selected={show === "waiting"} onClick={() => setShow("waiting")} />
          <Chip label={t("creator.offers.open")} count={offers.filter((o) => inView(o, "open")).length} selected={show === "open"} onClick={() => setShow("open")} />
          <Chip label={t("common.all")} count={offers.length} selected={show === "all"} onClick={() => setShow("all")} />
        </ChipRow>
        {hasBoth ? (
          <ChipRow label={t("creator.offers.kind")}>
            <Chip label={t("creator.offers.both")} selected={kind === "all"} onClick={() => setKind("all")} />
            <Chip label={t("creator.offers.offers")} selected={kind === "offer"} onClick={() => setKind("offer")} />
            <Chip label={t("creator.offers.bids")} selected={kind === "bid"} onClick={() => setKind("bid")} />
          </ChipRow>
        ) : null}
        <ReadError error={error} />
        {list.length === 0 ? (
          <Empty
            icon="pricetags-outline"
            title={show === "waiting" ? t("creator.offers.nothingWaiting") : t("creator.offers.emptyTitle")}
            body={t("creator.offers.emptyBody")}
          />
        ) : null}
        {open.length ? (
          <>
            <SectionLabel>{t("creator.offers.waitingOnYou")}</SectionLabel>
            {open.map(row)}
          </>
        ) : null}
        {earlier.length ? (
          <>
            <SectionLabel>{t("creator.offers.earlier")}</SectionLabel>
            {earlier.map(row)}
          </>
        ) : null}
      </div>
    </div>
  );
}
