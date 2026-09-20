"use client";

/**
 * One property — the app's `stay.tsx`, on the web.
 *
 * THE TWO HALVES LOAD APART, AND PAINT APART
 *
 * The description and the photographs keep for hours; an `offerId` is good for
 * minutes. So the property and its rates are two requests, each drawn the
 * moment it lands. Waiting for both would hold a finished page behind the
 * slower half of it, and the slower half is always the prices.
 *
 * It also means the two failures are different and must read differently: a
 * property that will not load is an error, and a property with NO ROOMS for
 * these dates is an answer — the place is full, and the thing to do is change
 * the dates, not retry.
 *
 * RATES ARE GROUPED BY ROOM, NOT LISTED FLAT
 *
 * A property answers with twenty rates that are four rooms sold five ways.
 * Flat, that reads as twenty decisions; grouped, it reads as four. The join is
 * the supplier's own `roomId` and never the room's NAME — two rooms called
 * "Double Room" at one property is normal, and matching on the name puts a
 * sea-view rate under a room with no window.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";

import { Cta, Empty, Ground, ScorePill, SectionLabel, Spinner } from "./kit";
import { P, count, money, nights as nightsWord, nightsBetween, ratingLabel, stayRange } from "./look";
import { sane, stayFromParams, stayToParams } from "./SearchControls";
import { groupByRoom } from "./group";
import { About, CheckinTimes, Facilities, Gallery, GoodToKnow, Nearby, RateRow, ReviewSummary, RoomGroup } from "./StayParts";
import { useRates, useStay } from "@/lib/app/stays-data";
import type { Rate } from "@/lib/app/stays";

export function StayScreen({ hotelId }: { hotelId: string }) {
  const href = useProductHref();
  const router = useRouter();
  const params = useSearchParams();
  const search = useMemo(() => sane(stayFromParams(new URLSearchParams(params.toString()))), [params]);
  const nights = nightsBetween(search.checkin, search.checkout);

  const stay = useStay(hotelId);
  const rates = useRates(hotelId, {
    checkin: search.checkin,
    checkout: search.checkout,
    adults: search.adults,
    ...(search.children.length ? { children: search.children } : {}),
    currency: "EUR",
  });

  function book(rate: Rate) {
    const q = stayToParams(search);
    q.set("offer", rate.offerId);
    router.push(`${href(`/travel/stay/${hotelId}/book`)}?${q}`);
  }

  const groups = useMemo(() => groupByRoom(rates.data?.rates ?? [], stay.data?.rooms ?? []), [rates.data, stay.data]);
  const cheapest = rates.data?.rates[0] ?? null;

  if (stay.error) {
    return (
      <Ground className="rounded-[20px] p-6">
        <Empty
          icon="cloud-offline-outline"
          title="Couldn't load this property"
          body="Check your connection and try again."
          action="Try again"
          onAction={() => void stay.mutate()}
        />
      </Ground>
    );
  }

  return (
    <Ground className="gap-4 rounded-[20px] p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 self-start rounded-[8px] px-2 py-1 text-[12.5px] font-semibold transition-colors hover:bg-white/10"
        style={{ color: P.textMuted }}
      >
        <Ion name="chevron-back" size={14} />
        Back to results
      </button>

      {stay.isLoading || !stay.data ? (
        <div className="flex justify-center py-20">
          <Spinner size={22} color={P.greenText} />
        </div>
      ) : (
        <>
          <Gallery images={stay.data.gallery} alt={stay.data.name} />

          <header className="flex flex-col gap-2">
            <h1 className="text-[25px] font-extrabold leading-[29px] tracking-[-0.7px]" style={{ color: P.text }}>
              {stay.data.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {stay.data.guestRating !== null ? (
                <>
                  <ScorePill rating={stay.data.guestRating} />
                  {ratingLabel(stay.data.guestRating) ? (
                    <span className="text-[12.5px] font-medium" style={{ color: P.textMuted }}>
                      {ratingLabel(stay.data.guestRating)}
                    </span>
                  ) : null}
                  {stay.data.reviewCount ? (
                    <span className="text-[12px]" style={{ color: P.textDim }}>
                      {`· ${count(stay.data.reviewCount)} reviews`}
                    </span>
                  ) : null}
                </>
              ) : null}
              {stay.data.address || stay.data.city ? (
                <span className="flex items-center gap-1 text-[12.5px] font-medium" style={{ color: P.textDim }}>
                  <Ion name="location-outline" size={13} />
                  {[stay.data.address, stay.data.city].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </div>
            <p className="text-[12.5px] font-semibold tracking-[-0.1px]" style={{ color: P.textMuted }}>
              {stayRange(search.checkin, search.checkout)}
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <section className="mt-[22px] flex flex-col gap-2.5">
                <h2 className="text-[13.5px] font-extrabold tracking-[-0.1px]" style={{ color: P.text }}>
                  Rooms
                </h2>

                {rates.isLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner size={20} color={P.greenText} />
                  </div>
                ) : rates.error ? (
                  <Empty
                    icon="cloud-offline-outline"
                    title="Couldn't load prices"
                    body="The property is there; we just couldn't price it. Try again."
                    action="Try again"
                    onAction={() => void rates.mutate()}
                  />
                ) : groups.length === 0 ? (
                  <Empty
                    icon="bed-outline"
                    title="No rooms for these dates"
                    body="Try different dates — this property may be full."
                    action="Change dates"
                    onAction={() => router.push(`${href("/travel/search")}?${stayToParams(search)}`)}
                  />
                ) : (
                  groups.map((g) => (
                    <RoomGroup
                      key={g.key}
                      room={g.room}
                      rates={g.rates}
                      nights={nights}
                      picked={null}
                      onPick={book}
                    />
                  ))
                )}
              </section>

              <ReviewSummary stay={stay.data} />
              <About text={stay.data.description} />
              <Facilities facilities={stay.data.facilities} />
              <Nearby places={stay.data.nearby} />
              <CheckinTimes stay={stay.data} />
              <GoodToKnow stay={stay.data} />
            </div>

            {/* The price, kept in view while the page is read. */}
            {cheapest ? (
              <aside className="lg:sticky lg:top-4 lg:self-start">
                <div className="flex flex-col gap-3 rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04] p-4">
                  <SectionLabel className="!px-0">From</SectionLabel>
                  <div>
                    <p className="text-[26px] font-extrabold tabular-nums leading-none tracking-[-0.7px]" style={{ color: P.text }}>
                      {money(cheapest.price, cheapest.currency)}
                    </p>
                    <p className="mt-1 text-[11.5px] font-medium" style={{ color: P.textDim }}>
                      {`total for ${nightsWord(nights)}`}
                    </p>
                  </div>
                  <RateRow rate={cheapest} nights={nights} onPick={() => book(cheapest)} />
                  <Cta label="Book this rate" variant="primary" onClick={() => book(cheapest)} />
                  <p className="text-[11.5px] leading-[17px]" style={{ color: P.textFaint }}>
                    Rooms are supplied and reserved by our booking partner. You pay HOLD, and the stay is provided by the property under its own terms.
                  </p>
                </div>
              </aside>
            ) : null}
          </div>
        </>
      )}
    </Ground>
  );
}
