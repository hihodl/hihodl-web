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
import { Banner, Card, Empty, Photo, Screen, SectionLabel, Spinner } from "./kit";
import { P, daysUntil, guests as guestsWord, longDate, money, nights as nightsWord, nightsBetween, pointsEarned, shortDate } from "./look";
import { refreshTrips, useBooking } from "@/lib/app/stays-data";
import type { Booking } from "@/lib/app/stays";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

const SUPPORT_EMAIL = "support@hihodl.xyz";

export function BookingScreen({ bookingId }: { bookingId: string }) {
  const href = useProductHref();
  const router = useRouter();
  const t = useT();
  const { data: booking, isLoading, error, mutate } = useBooking(bookingId);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen className="py-8">
        <div className="flex justify-center py-20">
          <Spinner size={22} color={P.greenText} />
        </div>
      </Screen>
    );
  }
  if (error || !booking) {
    return (
      <Screen className="py-8">
        <Empty icon="cloud-offline-outline" title={t("trips.booking.errorTitle")} action={t("common.tryAgain")} onAction={() => void mutate()} />
      </Screen>
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
    <Screen className="gap-3">
      <button
        type="button"
        onClick={() => router.push(href("/travel/trips"))}
        className="flex items-center gap-1.5 self-start rounded-[8px] px-2 py-1 text-[12.5px] font-semibold transition-colors hover:bg-white/10"
        style={{ color: P.textMuted }}
      >
        <Ion name="chevron-back" size={14} />
        {t("trips.booking.backToTrips")}
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

      {booking.isSandbox ? <Banner icon="flask-outline">{t("trips.booking.sandbox")}</Banner> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ── The code ── */}
        {booking.reference ? (
          <Card hero className="p-4 lg:col-span-2">
            <SectionLabel className="!px-0">{booking.referenceKind === "hotel" ? t("trips.booking.hotelConfirmation") : t("trips.booking.reference")}</SectionLabel>
            <button type="button" onClick={() => void copy(booking.reference!, "Reference")} className="mt-1 flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[21px] font-extrabold tabular-nums tracking-[0.4px]" style={{ color: P.text }}>
                  {booking.reference}
                </span>
                {booking.referenceKind === "hotel" ? (
                  <span className="mt-0.5 block text-[12px]" style={{ color: P.textDim }}>
                    {t("trips.booking.hotelCodeNote")}
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
            <SectionLabel className="!px-0">{t("trips.booking.where")}</SectionLabel>
            <p className="mt-2 text-[15px] font-semibold leading-[21px]" style={{ color: P.text }}>
              {booking.hotel.address ?? t("trips.booking.addressByProperty")}
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
                {t("trips.booking.directions")}
              </a>
              {booking.hotel.address ? (
                <button
                  type="button"
                  onClick={() => void copy(booking.hotel.address!, "Address")}
                  className="rounded-[999px] px-[13px] py-2 text-[12px] font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: P.text }}
                >
                  {copied === "Address" ? t("trips.booking.copied") : t("trips.booking.copyAddress")}
                </button>
              ) : null}
              {booking.hotel.phone ? (
                <a
                  href={`tel:${booking.hotel.phone.replace(/[^\d+*#,;]/g, "")}`}
                  className="flex items-center gap-1.5 rounded-[999px] px-[13px] py-2 text-[12px] font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", color: P.text }}
                >
                  <Ion name="call-outline" size={12} />
                  {t("trips.booking.callHotel")}
                </a>
              ) : null}
            </div>
          </Card>
        ) : null}

        {/* ── When ── */}
        <Card hero className="p-4">
          <SectionLabel className="!px-0">{t("trips.booking.when")}</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            <Row label={t("trips.booking.checkIn")} value={longDate(booking.checkin)} />
            <Row label={t("trips.booking.checkOut")} value={longDate(booking.checkout)} divided />
          </div>
          <span className="mt-3 inline-block rounded-[999px] px-[11px] py-1.5 text-[12px] font-bold" style={{ background: "rgba(255,255,255,0.07)", color: P.text }}>
            {nightsWord(nights)}
          </span>
          <p className="mt-2.5 text-[11.5px]" style={{ color: P.textFaint }}>
            {t("trips.booking.timesNote")}
          </p>
        </Card>

        {/* ── The room ── */}
        <Card hero className="p-4">
          <SectionLabel className="!px-0">{t("trips.booking.yourRoom")}</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            {booking.room ? <Row label={t("trips.booking.room")} value={booking.room} /> : null}
            {booking.board ? <Row label={t("trips.booking.board")} value={booking.board} divided /> : null}
            <Row label={t("trips.booking.guests")} value={guestsWord(booking.adults, booking.children)} divided />
            <Row label={t("trips.booking.leadGuest")} value={booking.guestName} divided />
            {booking.specialRequest ? <Row label={t("trips.booking.yourRequest")} value={booking.specialRequest} divided /> : null}
          </div>
        </Card>

        {/* ── Cancellation ── */}
        <Card
          hero
          className="p-4"
          // The accent only while the free window is genuinely open: amber that
          // is always on says nothing.
        >
          <SectionLabel className="!px-0">{t("trips.booking.cancellation")}</SectionLabel>
          <Cancellation booking={booking} />
        </Card>

        {/* ── What it cost ── */}
        <Card hero className="p-4 lg:col-span-2">
          <SectionLabel className="!px-0">{t("trips.booking.payment")}</SectionLabel>
          <div className="mt-1.5 flex flex-col">
            <Row label={t("trips.booking.totalPaid")} value={money(booking.price, booking.currency)} strong />
            {booking.pointsRedeemed > 0 ? <Row label={t("trips.booking.pointsUsed")} value={pointsEarned(booking.pointsRedeemed)} divided /> : null}
          </div>
          {booking.points.earned > 0 ? (
            <div className="mt-3 border-t-[0.5px] pt-3" style={{ borderColor: P.divider }}>
              <p className="text-[16px] font-extrabold" style={{ color: cancelled ? P.textDim : P.text }}>
                {pointsEarned(booking.points.earned)}
              </p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: P.textMuted }}>
                {cancelled
                  ? t("trips.booking.pointsNotEarned")
                  : booking.points.state === "credited"
                    ? t("stays.points.credited")
                    : t("trips.booking.pointsAfterCheckout", { date: shortDate(booking.checkout) })}
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
        {t("trips.booking.help")}
      </a>

      {booking.cancellable && !cancelled ? (
        <button
          type="button"
          onClick={() => setCancelling(true)}
          className="mx-auto px-2 py-3 text-[13.5px] font-semibold underline"
          style={{ color: P.textMuted }}
        >
          {t("trips.booking.cancel")}
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
    </Screen>
  );
}

/* ── The bits ─────────────────────────────────────────────────────── */

/** Where this booking is in its own life, in six words or fewer. */
function Phase({ booking }: { booking: Booking }) {
  const t = useT();
  const inDays = daysUntil(booking.checkin);
  const outDays = daysUntil(booking.checkout);
  const cancelled = booking.status === "cancelled";

  const said = cancelled
    ? t("trips.phase.cancelled")
    : outDays <= 0
      ? t("trips.phase.stayedIn", { month: fmtDate(`${booking.checkout}T00:00:00Z`, { month: "long", timeZone: "UTC" }) })
      : inDays <= 0
        ? outDays === 1
          ? t("trips.phase.checkingOutTomorrow")
          : t("trips.phase.staying", { count: outDays })
        : inDays === 0
          ? t("trips.phase.checkInToday")
          : inDays === 1
            ? t("trips.phase.checkInTomorrow")
            : t("trips.phase.inDays", { count: inDays });

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
  const t = useT();
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
            {t("trips.policy.freeUntil", { date: shortDate(until!) })}
          </p>
          <p className="mt-1 text-[13px] leading-[19px]" style={{ color: P.textMuted }}>
            {days === 0
              ? t("trips.policy.todayBody")
              : t("trips.policy.daysBody", { count: days })}
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
          {until ? t("trips.policy.ended") : t("stays.rate.nonRefundable")}
        </p>
        <p className="mt-1 text-[13px] leading-[19px]" style={{ color: P.textMuted }}>
          {until
            ? t("trips.policy.endedBody", { date: shortDate(until) })
            : t("trips.policy.nonRefundableBody")}
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
