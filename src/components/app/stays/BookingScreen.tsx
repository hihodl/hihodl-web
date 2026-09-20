"use client";

/**
 * One booking — the app's `travel/booking.tsx`.
 *
 * THE ORDER OF THE SECTIONS IS THE ARGUMENT
 *
 * Before the trip the question is "is this real, and can I still change it".
 * On the day it is "where is it". After check-out it is "what did I get". So:
 * the reference first, then where, then when, then the room, then the
 * cancellation terms, then what it cost and what it earned.
 *
 * THE REFERENCE IS TWO DIFFERENT THINGS AND THE LABEL SAYS WHICH
 *
 * The property's own confirmation code can be read down the phone and heard
 * back — it is the strongest proof this product owns, and it gets the
 * property's name on it. Our supplier's booking id is meaningless at a
 * reception desk, so it keeps a neutral label. The server decides which one
 * this is (`referenceKind`); a client comparing strings would have to
 * reproduce that rule and would eventually get it wrong.
 *
 * TIMES ARE ABSENT ON PURPOSE
 *
 * The supplier does not return check-in times for a booking, and an invented
 * 15:00 leaves somebody standing in a lobby. The footnote says who decides
 * instead.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";

import { CancelSheet } from "./CancelSheet";
import { Banner, Card, Empty, Ground, Photo, SectionLabel, Spinner } from "./kit";
import { P, count, daysUntil, guests as guestsWord, longDate, money, nights as nightsWord, nightsBetween, pointsEarned, shortDate } from "./look";
import { refreshTrips, useBooking } from "@/lib/app/stays-data";
import type { Booking } from "@/lib/app/stays";

const SUPPORT_EMAIL = "support@hihodl.xyz";

export function BookingScreen({ bookingId }: { bookingId: string }) {
  const href = useProductHref();
  const router = useRouter();
  const { data: booking, isLoading, error, mutate } = useBooking(bookingId);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Ground className="rounded-[20px] p-6">
        <div className="flex justify-center py-20">
          <Spinner size={22} color={P.greenText} />
        </div>
      </Ground>
    );
  }
  if (error || !booking) {
    return (
      <Ground className="rounded-[20px] p-6">
        <Empty icon="cloud-offline-outline" title="Couldn't load this booking" action="Try again" onAction={() => void mutate()} />
      </Ground>
    );
  }

  const cancelled = booking.status === "cancelled";
  const nights = nightsBetween(booking.checkin, booking.checkout);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // A clipboard the browser will not open is not worth a message: the
      // code is on screen and can be read.
    }
  }

  return (
    <Ground className="gap-3 rounded-[20px] p-4 sm:p-6">
      <button
        type="button"
        onClick={() => router.push(href("/travel/trips"))}
        className="flex items-center gap-1.5 self-start rounded-[8px] px-2 py-1 text-[12.5px] font-semibold transition-colors hover:bg-white/10"
        style={{ color: P.textMuted }}
      >
        <Ion name="chevron-back" size={14} />
        Your trips
      </button>

      {/* ── The hero ── */}
      <div className="relative h-[240px] w-full overflow-hidden rounded-[20px] sm:h-[268px]" style={{ background: P.card }}>
        <Photo image={booking.hotel.photoLarge ?? booking.hotel.photo} alt={booking.hotel.name} iconSize={28} priority sizes="(min-width: 1024px) 900px, 100vw" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: cancelled
              ? "linear-gradient(to bottom, rgba(6,18,26,0.55), rgba(6,18,26,0.78) 45%, rgba(6,18,26,0.97))"
              : "linear-gradient(to bottom, rgba(6,18,26,0.15), rgba(6,18,26,0.55) 45%, rgba(6,18,26,0.96))",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-5 pb-[18px]">
          <Phase booking={booking} />
          <h1 className="line-clamp-2 text-[25px] font-extrabold leading-[29px] tracking-[-0.7px]" style={{ color: P.text }}>
            {booking.hotel.name}
          </h1>
          {booking.hotel.city ? (
            <p className="text-[13.5px] font-semibold" style={{ color: "rgba(255,255,255,0.72)" }}>
              {booking.hotel.city}
            </p>
          ) : null}
        </div>
      </div>

      {booking.isSandbox ? <Banner icon="flask-outline">Test booking — not a real reservation</Banner> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ── The code ── */}
        {booking.reference ? (
          <Card hero className="p-4 lg:col-span-2">
            <SectionLabel className="!px-0">{booking.referenceKind === "hotel" ? "Hotel confirmation" : "Booking reference"}</SectionLabel>
            <button type="button" onClick={() => void copy(booking.reference!, "Reference")} className="mt-1 flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[21px] font-extrabold tabular-nums tracking-[0.4px]" style={{ color: P.text }}>
                  {booking.reference}
                </span>
                {booking.referenceKind === "hotel" ? (
                  <span className="mt-0.5 block text-[12px]" style={{ color: P.textDim }}>
                    The property&apos;s own code. Give it at the desk.
                  </span>
                ) : null}
              </span>
              <span className="shrink-0" style={{ color: copied === "Reference" ? P.greenText : P.textDim }} aria-hidden>
                <Ion name={copied === "Reference" ? "checkmark" : "copy-outline"} size={18} />
              </span>
            </button>
          </Card>
        ) : null}

        {/* ── Where ── */}
        {booking.hotel.address || booking.hotel.city ? (
          <Card hero className="p-4">
            <SectionLabel className="!px-0">Where</SectionLabel>
            <p className="mt-2 text-[15px] font-semibold leading-[21px]" style={{ color: P.text }}>
              {booking.hotel.address ?? "Address provided by the property"}
            </p>
            {booking.hotel.city ? (
              <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: "rgba(255,255,255,0.64)" }}>
                {booking.hotel.city}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  booking.hotel.latitude !== null && booking.hotel.longitude !== null
                    ? `${booking.hotel.latitude},${booking.hotel.longitude}`
                    : [booking.hotel.name, booking.hotel.address, booking.hotel.city].filter(Boolean).join(", "),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-[999px] px-[13px] py-2 text-[12px] font-extrabold"
                style={{ background: P.chipBg, color: P.chipText }}
              >
                <Ion name="navigate" size={12} />
                Directions
              </a>
              {booking.hotel.address ? (
                <button
                  type="button"
                  onClick={() => void copy(booking.hotel.address!, "Address")}
                  className="rounded-[999px] px-[13px] py-2 text-[12px] font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: P.text }}
                >
                  {copied === "Address" ? "Copied" : "Copy address"}
                </button>
              ) : null}
              {booking.hotel.phone ? (
                <a
                  href={`tel:${booking.hotel.phone.replace(/[^\d+*#,;]/g, "")}`}
                  className="flex items-center gap-1.5 rounded-[999px] px-[13px] py-2 text-[12px] font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: P.text }}
                >
                  <Ion name="call-outline" size={12} />
                  Call the hotel
                </a>
              ) : null}
            </div>
          </Card>
        ) : null}

        {/* ── When ── */}
        <Card hero className="p-4">
          <SectionLabel className="!px-0">When</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            <Row label="Check in" value={longDate(booking.checkin)} />
            <Row label="Check out" value={longDate(booking.checkout)} divided />
          </div>
          <span className="mt-3 inline-block rounded-[999px] px-[11px] py-1.5 text-[12px] font-bold" style={{ background: "rgba(255,255,255,0.07)", color: P.text }}>
            {nightsWord(nights)}
          </span>
          <p className="mt-2.5 text-[11.5px]" style={{ color: P.textFaint }}>
            Arrival and departure times are set by the property.
          </p>
        </Card>

        {/* ── The room ── */}
        <Card hero className="p-4">
          <SectionLabel className="!px-0">Your room</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            {booking.room ? <Row label="Room" value={booking.room} /> : null}
            {booking.board ? <Row label="Board" value={booking.board} divided /> : null}
            <Row label="Guests" value={guestsWord(booking.adults, booking.children)} divided />
            <Row label="Lead guest" value={booking.guestName} divided />
            {booking.specialRequest ? <Row label="Your request" value={booking.specialRequest} divided /> : null}
          </div>
        </Card>

        {/* ── Cancellation ── */}
        <Card
          hero
          className="p-4"
          // The accent only while the free window is genuinely open: amber that
          // is always on says nothing.
        >
          <SectionLabel className="!px-0">Cancellation</SectionLabel>
          <Cancellation booking={booking} />
        </Card>

        {/* ── What it cost ── */}
        <Card hero className="p-4 lg:col-span-2">
          <SectionLabel className="!px-0">Payment</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            <Row label="Total paid" value={money(booking.price, booking.currency)} strong />
            {booking.pointsRedeemed > 0 ? <Row label="Points used" value={`${count(booking.pointsRedeemed)} pts`} divided /> : null}
          </div>
          {booking.points.earned > 0 ? (
            <div className="mt-3 border-t-[0.5px] pt-3" style={{ borderColor: P.divider }}>
              <p className="text-[16px] font-extrabold" style={{ color: cancelled ? P.textDim : P.text }}>
                {pointsEarned(booking.points.earned)}
              </p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: P.textMuted }}>
                {cancelled
                  ? "Not earned — this booking was cancelled"
                  : booking.points.state === "credited"
                    ? "In your balance"
                    : `Credited after you check out on ${shortDate(booking.checkout)}`}
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(["Hi Travel", booking.hotel.name, booking.reference].filter(Boolean).join(" · "))}`}
        className="flex items-center justify-center gap-2 py-3 text-[12.5px] font-semibold"
        style={{ color: P.textDim }}
      >
        <Ion name="mail-outline" size={16} />
        Question about this booking? Email us
      </a>

      {booking.cancellable && !cancelled ? (
        <button
          type="button"
          onClick={() => setCancelling(true)}
          className="mx-auto px-2 py-3 text-[13.5px] font-semibold underline"
          style={{ color: P.textMuted }}
        >
          Cancel this booking
        </button>
      ) : null}

      {cancelling ? (
        <CancelSheet
          booking={booking}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false);
            void mutate();
            void refreshTrips();
          }}
        />
      ) : null}
    </Ground>
  );
}

/* ── The bits ─────────────────────────────────────────────────────── */

/** Where this booking is in its own life, in six words or fewer. */
function Phase({ booking }: { booking: Booking }) {
  const inDays = daysUntil(booking.checkin);
  const outDays = daysUntil(booking.checkout);
  const cancelled = booking.status === "cancelled";

  const said = cancelled
    ? "Cancelled"
    : outDays <= 0
      ? `Stayed in ${new Date(`${booking.checkout}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}`
      : inDays <= 0
        ? outDays === 1
          ? "Checking out tomorrow"
          : `You're staying — ${outDays} nights left`
        : inDays === 0
          ? "Check in today"
          : inDays === 1
            ? "Check in tomorrow"
            : `In ${inDays} days`;

  return (
    <span
      className="self-start rounded-[999px] px-2.5 py-[5px] text-[11.5px] font-extrabold tracking-[-0.1px]"
      style={{
        background: cancelled ? "rgba(255,255,255,0.10)" : "rgba(47,190,138,0.18)",
        border: `0.5px solid ${cancelled ? "rgba(255,255,255,0.18)" : "rgba(47,190,138,0.35)"}`,
        color: cancelled ? P.textMuted : P.greenText,
      }}
    >
      {said}
    </span>
  );
}

function Cancellation({ booking }: { booking: Booking }) {
  const until = booking.freeCancelUntil?.slice(0, 10) ?? null;
  const days = until ? daysUntil(until) : null;
  const open = days !== null && days >= 0;

  if (open) {
    return (
      <div className="mt-2 flex items-start gap-2.5">
        <span className="mt-px shrink-0" style={{ color: P.caution }} aria-hidden>
          <Ion name="shield-checkmark-outline" size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[15.5px] font-extrabold" style={{ color: P.caution }}>
            {`Free until ${shortDate(until!)}`}
          </p>
          <p className="mt-1 text-[13px] leading-[19px]" style={{ color: P.textMuted }}>
            {days === 0
              ? "That's today. Cancel before the property's deadline and you're refunded in full."
              : `You have ${days} ${days === 1 ? "day" : "days"}. Cancel before then and you're refunded in full; after it, the property sets the charge.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2.5">
      <span className="mt-px shrink-0" style={{ color: P.textMuted }} aria-hidden>
        <Ion name="information-circle-outline" size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[15.5px] font-extrabold" style={{ color: P.text }}>
          {until ? "Free cancellation has ended" : "Non-refundable"}
        </p>
        <p className="mt-1 text-[13px] leading-[19px]" style={{ color: P.textMuted }}>
          {until
            ? `The free window closed on ${shortDate(until)}. Cancelling now is up to the property and may be charged.`
            : "This rate was booked without free cancellation, which is why it was cheaper. Changes are up to the property."}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false, divided = false }: { label: string; value: string; strong?: boolean; divided?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={divided ? { borderTop: `0.5px solid ${P.divider}` } : undefined}>
      <span className="shrink-0 text-[13px] font-medium tracking-[-0.1px]" style={{ color: P.textMuted }}>
        {label}
      </span>
      <span
        className={strong ? "text-right text-[18px] font-extrabold tabular-nums tracking-[-0.5px]" : "text-right text-[13.5px] font-bold leading-[18.5px] tracking-[-0.2px]"}
        style={{ color: P.text }}
      >
        {value}
      </span>
    </div>
  );
}
