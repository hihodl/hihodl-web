"use client";

/**
 * Cancelling — the app's `CancelBookingSheet.tsx`.
 *
 * TWO SHAPES, ONE SHEET
 *
 * It can cancel, or it cannot. The second shape is not an error dialog: the
 * supplier refusing an online cancellation for this particular booking is a
 * real answer, and the reservation is unchanged. So that shape shows NO
 * refund figure at all — an amount printed beside an explanation of why
 * nothing is happening is a refund being dangled.
 *
 * THE SAFE BUTTON IS THE SOLID ONE
 *
 * "Keep booking" is white and sits where the thumb rests. "Cancel booking" is
 * amber TINTED — never filled, and never red, because nothing in this product
 * is red. That is not squeamishness: the tint is what stops the destructive
 * option reading as the primary one on a sheet somebody opened by mistake.
 *
 * (It was once a bare amber line under the white pill, and that was a bug: an
 * unbounded line of text under a solid pill reads as a caption about the pill,
 * and the sheet whose whole purpose is cancelling got reported as "I only see
 * Keep".)
 *
 * WHAT HAPPENS AFTER IS A FAN-OUT, NOT A REFRESH
 *
 * Three surfaces go stale on a cancellation and only one of them is on screen:
 * this booking, the trips list, and the HiPoints balance. The points one is
 * the one nothing else asks for — a discount is TAKEN at the hold and GIVEN
 * BACK on cancellation, and on booking 086e1382 (28-Aug-2026) 50 points came
 * back at 09:35:40 with the screen still reading 4,950.
 */

import { useEffect, useState } from "react";
import { mutate } from "swr";

import { Ion } from "../ion";

import { Spinner } from "./kit";
import { P, money, shortDate } from "./look";
import { cancelBooking, type Booking } from "@/lib/app/stays";

const SUPPORT_EMAIL = "support@hihodl.xyz";

const BLOCKED_DEFAULT =
  "The property isn't accepting an online cancellation for this booking. Your reservation is unchanged and nothing has been charged.";

export function CancelSheet({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking;
  onClose: () => void;
  /** The cancellation went through. The caller re-reads what it owns. */
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // While a request is out, the sheet cannot be dismissed: there is money in
  // the air and closing over it is how somebody ends up unsure what happened.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy, onClose]);

  const free = booking.freeCancelUntil !== null && booking.freeCancelUntil.slice(0, 10) >= new Date().toISOString().slice(0, 10);

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      await cancelBooking(booking.id);
      // The fan-out. Fire and forget, each isolated: the cancellation has
      // already succeeded, and a failed refresh must never turn it into an
      // error on the guest's screen.
      void mutate((k) => Array.isArray(k) && k[1] === "hipoints", undefined, { revalidate: true });
      void mutate((k) => Array.isArray(k) && k[1] === "stays/booking", undefined, { revalidate: true });
      onDone();
    } catch (e) {
      const status = typeof e === "object" && e !== null && "status" in e ? (e as { status?: number }).status : null;
      // 409 is the supplier refusing THIS booking — explain it and offer a
      // human. Anything else is a blip, and the answer is to try again.
      if (status === 409) setBlocked(BLOCKED_DEFAULT);
      else setProblem("Couldn't cancel that booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const refund = free ? booking.price : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
        className="absolute inset-0 cursor-default disabled:cursor-default"
        style={{ background: "rgba(0,0,0,0.55)" }}
      />

      <div
        className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-t-[26px] border-[0.5px] border-white/10 p-5 pb-7 sm:rounded-[26px]"
        style={{ background: "linear-gradient(to bottom, #122C36, #0A1921 55%, #08151C)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[0.5px]" style={{ background: "rgba(255,255,255,0.16)" }} />

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold tracking-[-0.4px]" style={{ color: P.text }}>
              {blocked ? "We can't cancel this one" : "Cancel this booking?"}
            </h2>
            <p className="mt-1 line-clamp-2 text-[14px] font-semibold" style={{ color: P.textMuted }}>
              {booking.hotel.name}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)", color: P.text }}
          >
            <Ion name="close" size={20} />
          </button>
        </div>

        {!blocked && refund !== null ? (
          <div className="mt-[18px] rounded-[16px] p-[14px]" style={{ background: "#0E2029", border: `0.5px solid ${P.cardBorder}` }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              You get back
            </p>
            <p className="mt-1 text-[26px] font-extrabold tabular-nums tracking-[-0.6px]" style={{ color: "#4ADE80" }}>
              {money(refund, booking.currency)}
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-4" style={{ color: "rgba(255,255,255,0.5)" }}>
              Sent to the wallet you paid from, as soon as this goes through.
            </p>
          </div>
        ) : null}

        <p className="mt-3.5 text-[12.5px] font-semibold leading-[18px]" style={{ color: "rgba(255,255,255,0.5)" }}>
          {blocked
            ? blocked
            : free && booking.freeCancelUntil
              ? `Free cancellation until ${shortDate(booking.freeCancelUntil.slice(0, 10))}.`
              : "This booking is past its free-cancellation date. Cancelling is still possible — the property decides what it keeps."}
        </p>

        {problem ? (
          <p className="mt-2.5 text-[12.5px] font-semibold" style={{ color: P.caution }}>
            {problem}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[16px] text-[16px] font-extrabold tracking-[-0.2px] disabled:opacity-60"
          style={{ background: "#fff", color: "#07131A" }}
        >
          {blocked ? "Close" : "Keep booking"}
        </button>

        {blocked ? (
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(["Hi Travel", booking.hotel.name, booking.reference].filter(Boolean).join(" · "))}`}
            className="mt-2.5 flex h-[50px] w-full items-center justify-center rounded-[16px] text-[15.5px] font-extrabold tracking-[-0.1px]"
            style={{ background: "rgba(255,183,3,0.12)", border: `0.5px solid rgba(255,183,3,0.38)`, color: P.caution }}
          >
            Email us about this booking
          </a>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="mt-2.5 flex h-[50px] w-full items-center justify-center rounded-[16px] text-[15.5px] font-extrabold tracking-[-0.1px] disabled:opacity-80"
            style={{ background: "rgba(255,183,3,0.12)", border: `0.5px solid rgba(255,183,3,0.38)`, color: P.caution }}
          >
            {busy ? <Spinner size={17} color={P.caution} /> : "Cancel booking"}
          </button>
        )}
      </div>
    </div>
  );
}
