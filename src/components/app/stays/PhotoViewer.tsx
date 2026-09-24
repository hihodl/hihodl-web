"use client";

/**
 * One property's photographs, full screen, on black — the app's `PhotoViewer`.
 *
 * WHY A BOOKING PAGE NEEDS THIS AT ALL
 *
 * liteAPI properties return between 56 and 257 photographs each, median 82.
 * That is a Booking-sized library, and on this page it was reaching a 340px
 * band and a row of 104px room thumbnails. Nobody commits four hundred euros
 * to a room they have seen inside a letterbox; they leave and open the site
 * that lets them look properly. So looking properly is a view, and this is it.
 *
 * WHY BLACK, AND `contain`
 *
 * A hotel photograph is 3:2 and a browser window is not. Inside a layout the
 * picture is either cropped to the slot or letterboxed into it, and both are
 * wrong when LOOKING is the task: the crop hides the half of the room the
 * guest wanted, and the letterbox puts navy bars around it. Here it is shown
 * whole, at the largest size the window allows, with nothing competing. Black
 * rather than the travel navy for the same reason a cinema is not painted
 * blue.
 *
 * WHY IT IS A PORTAL
 *
 * The product's frame is drawn with CSS `zoom`, and `zoom` on an ancestor
 * makes that ancestor the containing block for `position: fixed`. A viewer
 * rendered in place would be scaled and clipped to the column it came from,
 * which on a large screen is exactly where this is opened from. So it goes to
 * `document.body`, outside the zoom.
 *
 * WHAT THE CHROME DOES
 *
 * The counter and the caption are useful for the first second and then they
 * are two labels sitting on top of the thing you came to look at, so a click
 * on the picture puts them away and brings them back. Close and the arrows
 * stay: a view you cannot find the exit of is a trap, and a mouse has no
 * swipe. Arrow keys page, Escape leaves.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Ion } from "../ion";

import { Photo } from "./kit";
import { P } from "./look";
import type { GalleryImage } from "@/lib/app/stays";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

export function PhotoViewer({
  images,
  initialIndex,
  open,
  onClose,
  title,
}: {
  images: GalleryImage[];
  /** Which photograph was clicked. The viewer opens ON it, never at zero. */
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  /** The property or room name, under the counter, small. */
  title?: string;
}) {
  const t = useT();
  const [at, setAt] = useState(initialIndex);
  const [chrome, setChrome] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Seeded on every open, not on mount: opening photograph 41 of 82 must not
  // mean paging past forty, and the component survives between openings.
  useEffect(() => {
    if (!open) return;
    setAt(initialIndex);
    setChrome(true);
  }, [open, initialIndex]);

  const go = useCallback(
    (step: number) => setAt((i) => (i + step + images.length) % images.length),
    [images.length],
  );

  // The keyboard is the mouse's equal here. Bound while open only, so the
  // arrow keys still belong to the page underneath the rest of the time.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  // The page behind must not scroll under the viewer. The old value is put
  // back rather than cleared, so a page that had its own reason to lock keeps
  // it.
  useEffect(() => {
    if (!open) return;
    const had = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = had;
    };
  }, [open]);

  if (!open || !mounted || images.length === 0) return null;

  const shown = images[Math.min(at, images.length - 1)];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? t("trips.photos.titled", { title }) : t("trips.photos.title")}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.96)" }}
    >
      {/* The picture. Clicking it is the chrome toggle — everything that
          navigates sits above this and stops the click. */}
      <button
        type="button"
        aria-label={chrome ? t("trips.photos.hideCaptions") : t("trips.photos.showCaptions")}
        onClick={() => setChrome((c) => !c)}
        className="absolute inset-0 flex cursor-default items-center justify-center p-0"
      >
        <span className="flex h-full w-full items-center justify-center p-2 sm:p-8">
          <Photo image={shown} alt={shown.caption ?? title ?? ""} fit="contain" iconSize={40} priority />
        </span>
      </button>

      {/* Always reachable, chrome or no chrome. */}
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-[999px] transition-opacity hover:opacity-100 sm:right-5 sm:top-5"
        style={{ background: "rgba(255,255,255,0.12)", color: P.text, opacity: 0.9 }}
      >
        <Ion name="close" size={22} />
      </button>

      {images.length > 1 ? (
        <>
          <Step side="left" onClick={() => go(-1)} />
          <Step side="right" onClick={() => go(1)} />
        </>
      ) : null}

      {chrome ? (
        <div className="pointer-events-none absolute left-0 right-0 top-3 flex flex-col items-center gap-1 px-16 sm:top-5">
          <span
            className="rounded-[999px] px-3 py-[6px] text-[12px] font-extrabold tabular-nums tracking-[-0.1px]"
            style={{ background: "rgba(255,255,255,0.12)", color: P.text }}
          >
            {t("trips.photos.counter", { index: fmtNumber(at + 1), total: fmtNumber(images.length) })}
          </span>
          {title ? (
            <span className="max-w-full truncate text-[12px] font-semibold" style={{ color: P.textMuted }}>
              {title}
            </span>
          ) : null}
        </div>
      ) : null}

      {chrome && shown.caption ? (
        <span
          className="pointer-events-none absolute bottom-5 left-1/2 max-w-[80%] -translate-x-1/2 truncate rounded-[999px] px-3 py-[6px] text-[12px] font-semibold"
          style={{ background: "rgba(255,255,255,0.12)", color: P.text }}
        >
          {shown.caption}
        </span>
      ) : null}
    </div>,
    document.body,
  );
}

/** Bigger than the gallery's own arrows: here they are the only way to page. */
function Step({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={side === "left" ? t("trips.photos.previous") : t("trips.photos.next")}
      onClick={onClick}
      className={`absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-[999px] transition-opacity hover:opacity-100 ${
        side === "left" ? "left-2 sm:left-5" : "right-2 sm:right-5"
      }`}
      style={{ background: "rgba(255,255,255,0.12)", color: P.text, opacity: 0.85 }}
    >
      <Ion name={side === "left" ? "chevron-back" : "chevron-forward"} size={24} />
    </button>
  );
}
