"use client";

/**
 * Stays' front door — the app's travel tab, on the web.
 *
 * The order is the app's and it is an argument: the search bar first, because
 * somebody who knows where they are going should never have to scroll past
 * inspiration to say so; then the shelf, for everybody else; then the trips
 * they already have, because "where am I staying next week" is the second
 * most common reason to open this.
 *
 * THE SHELF IS PRICED, AND THAT IS THE POINT
 *
 * Every tile carries a real total for a real window the server picked, not a
 * "from" price. A destination tile with no number is a poster; one with a
 * number is a decision. The window is stated once above the grid rather than
 * on each tile, because it is the same window for all of them.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";

import { Banner, Card, Empty, Photo, PointsHeadline, Screen, SectionLabel, Spinner } from "./kit";
import { P, dateRange, money, nights as nightsWord, stayRange } from "./look";
import { SearchBar, blankStay, sane, stayToParams, type Stay } from "./SearchControls";
import { useFeatured, useStaysConfig, useTrips } from "@/lib/app/stays-data";
import type { Booking, FeaturedCard } from "@/lib/app/stays";

export function StaysScreen() {
  const href = useProductHref();
  const router = useRouter();
  const config = useStaysConfig();
  const [stay, setStay] = useState<Stay>(blankStay);

  function go(next: Stay) {
    router.push(`${href("/travel/search")}?${stayToParams(sane(next))}`);
  }

  // The supplier is not configured: the product is off, and saying so beats a
  // search box that answers nothing.
  if (config.data && !config.data.available) {
    return (
      <Screen className="py-8">
        <Empty
          icon="bed-outline"
          title="Stays isn't live yet"
          body="We're finishing the connection to our booking partner. It'll be here soon."
        />
      </Screen>
    );
  }

  return (
    <Screen className="gap-5">
      {config.data?.sandbox ? (
        <Banner icon="flask-outline">Test mode — nothing you book here is a real reservation</Banner>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.7px]" style={{ color: P.text }}>
              Where to?
            </h1>
            <p className="mt-1 text-[13.5px] font-semibold" style={{ color: P.textMuted }}>
              Hotels at the rate we are quoted, paid in USDC, with HiPoints back on every night.
            </p>
          </div>
          {config.data ? <PointsHeadline pct={config.data.headlineEarnRatePct} /> : null}
        </div>

        <SearchBar value={stay} onChange={setStay} onSearch={() => go(stay)} />
      </header>

      <Shelf
        title="Close to home"
        set="near"
        onOpen={(card) =>
          go({
            where: { label: card.search.cityName, query: card.search.cityName, countryCode: card.search.countryCode },
            checkin: card.checkin,
            checkout: card.checkout,
            adults: stay.adults,
            children: stay.children,
          })
        }
      />
      <Shelf
        title="Worth the flight"
        set="longhaul"
        onOpen={(card) =>
          go({
            where: { label: card.search.cityName, query: card.search.cityName, countryCode: card.search.countryCode },
            checkin: card.checkin,
            checkout: card.checkout,
            adults: stay.adults,
            children: stay.children,
          })
        }
      />

      <YourTrips />
    </Screen>
  );
}

/* ── The shelf ────────────────────────────────────────────────────── */

function Shelf({ title, set, onOpen }: { title: string; set: "near" | "longhaul"; onOpen: (card: FeaturedCard) => void }) {
  const { data, isLoading, error } = useFeatured(set);

  // A shelf that could not be built says nothing at all. It is inspiration:
  // an error message where a photograph should be is worse than a shorter page.
  if (error || (data && data.stays.length === 0)) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {data ? (
          <p className="text-[11.5px] font-semibold tracking-[-0.1px]" style={{ color: P.textDim }}>
            {`${dateRange(data.checkin, data.checkout)} · ${nightsWord(data.nights)}`}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading && !data
          ? Array.from({ length: 5 }, (_, i) => <TileSkeleton key={i} />)
          : (data?.stays ?? []).slice(0, 10).map((card) => <Tile key={card.hotelId} card={card} onOpen={() => onOpen(card)} />)}
      </div>
    </section>
  );
}

function Tile({ card, onOpen }: { card: FeaturedCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex aspect-[0.86] flex-col justify-end overflow-hidden rounded-[18px] border-[0.5px] border-white/10 text-left transition-opacity active:opacity-90"
      style={{ background: P.card }}
    >
      <span className="absolute inset-0">
        <Photo image={card.photo} alt={card.city ?? card.name} iconSize={26} sizes="(min-width: 1024px) 20vw, 45vw" />
      </span>
      {/* Two stops, starting at 42 %, so the top of the photograph is untouched. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(6,14,24,0) 42%, rgba(6,14,24,0.82) 100%)" }}
      />
      <span className="relative flex flex-col gap-0.5 px-[13px] pb-3">
        <span className="truncate text-[17px] font-black leading-tight tracking-[-0.5px]" style={{ color: P.text }}>
          {card.city ?? card.search.cityName}
        </span>
        <span className="flex items-baseline gap-2">
          <span
            className="min-w-0 flex-1 truncate text-[11.5px] font-semibold"
            // Not `textDim`: over a photograph 42 % white drops below readable.
            style={{ color: "rgba(255,255,255,0.74)" }}
          >
            {card.countryName ?? card.countryCode ?? ""}
          </span>
          <span className="shrink-0 text-[14px] font-extrabold tabular-nums tracking-[-0.3px]" style={{ color: P.text }}>
            {money(card.price, card.currency)}
          </span>
        </span>
      </span>
    </button>
  );
}

function TileSkeleton() {
  return (
    <div className="flex aspect-[0.86] flex-col justify-end overflow-hidden rounded-[18px] border-[0.5px] border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
      <span className="flex flex-col px-[13px] pb-3">
        <span className="block rounded-[5px]" style={{ width: "58%", height: 13, background: "rgba(255,255,255,0.09)" }} />
        <span className="mt-1.5 block rounded-[5px]" style={{ width: "34%", height: 9, background: "rgba(255,255,255,0.09)" }} />
      </span>
    </div>
  );
}

/* ── What you already booked ──────────────────────────────────────── */

function YourTrips() {
  const href = useProductHref();
  const { bookings, loading } = useTrips();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.checkout >= today && b.status !== "cancelled").slice(0, 3);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={20} color={P.greenText} />
      </div>
    );
  }
  if (upcoming.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Your trips</SectionLabel>
        <Link href={href("/travel/trips")} className="text-[12.5px] font-bold" style={{ color: P.greenText }}>
          See all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {upcoming.map((b) => (
          <TripPreview key={b.id} booking={b} href={href(`/travel/trips/${b.id}`)} />
        ))}
      </div>
    </section>
  );
}

function TripPreview({ booking, href }: { booking: Booking; href: string }) {
  return (
    <Link href={href} className="block transition-opacity active:opacity-85">
      <Card className="flex items-center gap-3 p-[14px]">
        <span className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: P.card }}>
          <Photo image={booking.hotel.photo} alt={booking.hotel.name} iconSize={18} sizes="58px" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[14.5px] font-bold leading-[19px] tracking-[-0.3px]" style={{ color: P.text }}>
            {booking.hotel.name}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] font-medium" style={{ color: P.textMuted }}>
            {stayRange(booking.checkin, booking.checkout)}
          </span>
        </span>
        <span className="shrink-0" style={{ color: P.textDim }} aria-hidden>
          <Ion name="chevron-forward" size={16} />
        </span>
      </Card>
    </Link>
  );
}
