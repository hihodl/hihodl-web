"use client";

/**
 * Your trips — the app's `TripsList.tsx`.
 *
 * TWO INVARIANTS, BOTH ENFORCED BY THE SERVER
 *
 *   An abandoned checkout is not a trip. `failed` bookings are filtered out
 *   entirely, and `pending` ones until money has actually been broadcast
 *   against them. So a `pending` row here is never somebody who wandered off
 *   — it is somebody who has paid and is waiting for the hotel.
 *
 *   The cancel link renders only when the server says `cancellable`. A control
 *   whose flow does not exist end to end never ships, and a cancel button that
 *   409s is worse than no button because it has already promised.
 *
 * TWO SECTIONS, AND A CANCELLED STAY IS ALWAYS PAST
 *
 * Whatever its dates. A cancellation is over, and leaving it under "Upcoming"
 * because its check-in has not happened yet is the list arguing with itself.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";

import { CancelSheet } from "./CancelSheet";
import { Empty, Ground, Photo, SectionLabel, Spinner } from "./kit";
import { P, money, pointsEarned, shortDate, stayRange } from "./look";
import { refreshTrips, useTrips } from "@/lib/app/stays-data";
import type { Booking } from "@/lib/app/stays";

const SUPPORT_EMAIL = "support@hihodl.xyz";

export function TripsScreen() {
  const href = useProductHref();
  const router = useRouter();
  const { bookings, loading, error, refetch } = useTrips();
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.checkout >= today && b.status !== "cancelled");
  const past = bookings.filter((b) => b.checkout < today || b.status === "cancelled");

  return (
    <Ground className="gap-4 rounded-[20px] p-4 sm:p-6">
      <h1 className="text-[25px] font-extrabold leading-tight tracking-[-0.7px]" style={{ color: P.text }}>
        Your trips
      </h1>

      {loading ? (
        <div className="flex justify-center pt-20">
          <Spinner size={22} color={P.greenText} />
        </div>
      ) : error ? (
        <Empty icon="cloud-offline-outline" title="Couldn't load your trips" action="Try again" onAction={() => void refetch()} />
      ) : bookings.length === 0 ? (
        <Empty
          icon="briefcase-outline"
          title="No trips yet"
          body="Book a stay and it'll show up here, with the points you earned."
          action="Find a stay"
          onAction={() => router.push(href("/travel"))}
        />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className="flex flex-col">
              <SectionLabel className="mb-3 !px-0">Upcoming</SectionLabel>
              {upcoming.map((b) => (
                <TripRow key={b.id} booking={b} href={href(`/travel/trips/${b.id}`)} onCancel={() => setCancelling(b)} />
              ))}
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="flex flex-col">
              <SectionLabel className="mb-3 mt-2 !px-0">Past</SectionLabel>
              {past.map((b) => (
                <TripRow key={b.id} booking={b} href={href(`/travel/trips/${b.id}`)} onCancel={() => setCancelling(b)} />
              ))}
            </section>
          ) : null}

          {/*
            One support link at the foot, not one per row: from here the
            question is usually "who do I talk to", not "about which stay".
          */}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Hi Travel")}`}
            className="flex items-center justify-center gap-[7px] py-[18px] text-[12.5px] font-semibold tracking-[-0.1px]"
            style={{ color: P.textDim }}
          >
            <Ion name="mail-outline" size={15} />
            Question about a trip? Email us
          </a>
        </>
      )}

      {cancelling ? (
        <CancelSheet
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            void refreshTrips();
          }}
        />
      ) : null}
    </Ground>
  );
}

/* ── One row ──────────────────────────────────────────────────────── */

function TripRow({ booking, href, onCancel }: { booking: Booking; href: string; onCancel: () => void }) {
  const cancelled = booking.status === "cancelled";
  const confirming = booking.status === "pending";

  return (
    <div
      className="mb-3 rounded-[18px] border-[0.5px] border-white/10 bg-white/[0.04] p-[14px]"
      style={{ opacity: cancelled ? 0.6 : 1 }}
    >
      <Link href={href} className="block transition-opacity active:opacity-85">
        <div className="flex items-center gap-3">
          <span className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: P.card }}>
            <Photo image={booking.hotel.photo} alt={booking.hotel.name} iconSize={18} sizes="58px" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15.5px] font-bold leading-5 tracking-[-0.3px]" style={{ color: P.text }}>
              {booking.hotel.name}
            </p>
            <p className="mt-[3px] text-[12.5px] font-medium" style={{ color: P.textMuted }}>
              {stayRange(booking.checkin, booking.checkout)}
            </p>
            {booking.hotel.city ? (
              <p className="mt-0.5 truncate text-[12px]" style={{ color: P.textDim }}>
                {booking.hotel.city}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-[13px] flex items-end gap-3 border-t-[0.5px] pt-3" style={{ borderColor: P.divider }}>
          <div className="min-w-0 flex-1">
            <p className="text-[16.5px] font-extrabold tabular-nums tracking-[-0.4px]" style={{ color: P.text }}>
              {money(booking.price, booking.currency)}
            </p>
            {booking.reference ? (
              <p className="mt-0.5 text-[11.5px]" style={{ color: P.textDim }}>
                {`Ref ${booking.reference}`}
              </p>
            ) : null}
          </div>
          <PointsColumn booking={booking} />
        </div>
      </Link>

      {cancelled || confirming ? (
        <div
          className="mt-3 flex items-center justify-center gap-2 rounded-[10px] py-[7px]"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {confirming ? <Spinner size={13} color={P.textMuted} /> : null}
          <p className="text-[12px] font-bold tracking-[0.2px]" style={{ color: P.textMuted }}>
            {cancelled ? "Cancelled" : "CONFIRMING WITH THE HOTEL"}
          </p>
        </div>
      ) : null}

      {booking.cancellable && !cancelled ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 self-start py-1 text-[13px] font-semibold underline"
          style={{ color: P.textMuted }}
        >
          Cancel booking
        </button>
      ) : null}
    </div>
  );
}

/**
 * What this stay earns, and when.
 *
 * A cancelled stay overrides everything with a neutral pill: the award is
 * released on check-out, and a stay nobody took has no check-out. Nothing at
 * all when there is nothing to earn — a zero is a promise of no promise.
 */
function PointsColumn({ booking }: { booking: Booking }) {
  if (booking.points.earned <= 0 && booking.status !== "cancelled") return null;

  if (booking.status === "cancelled") {
    return (
      <span className="shrink-0 rounded-[8px] px-[9px] py-[5px] text-[11.5px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: P.textDim }}>
        No points — stay cancelled
      </span>
    );
  }

  const credited = booking.points.state === "credited";
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="flex items-center gap-[5px]">
        <span style={{ color: credited ? P.greenText : P.textMuted }} aria-hidden>
          <Ion name={credited ? "checkmark-circle" : "time-outline"} size={13} />
        </span>
        <span className="text-[14px] font-bold tracking-[-0.2px]" style={{ color: credited ? P.greenText : P.text }}>
          {pointsEarned(booking.points.earned)}
        </span>
      </span>
      <span className="mt-0.5 text-[11.5px]" style={{ color: P.textDim }}>
        {credited ? "In your balance" : booking.points.dueAt ? `after ${shortDate(booking.points.dueAt.slice(0, 10))}` : "In your balance after check-out"}
      </span>
    </span>
  );
}
