"use client";

/**
 * Choosing WHICH square of a photo becomes the avatar.
 *
 * WHY THIS EXISTS
 *
 * The web used to centre-crop silently: take the middle square, scale it to
 * 512 and upload. The middle of a photograph is very rarely the middle of a
 * face — a portrait taken at arm's length puts the head in the top third, and
 * the automatic crop cut it off at the eyebrows. Somebody then has no way to
 * fix it except to go and crop the file themselves before coming back.
 *
 * HOW IT WORKS
 *
 * The viewport is a square with a round hole, because the avatar is round
 * everywhere it is drawn and a square preview lies about what will be kept.
 * Drag to move, wheel or the slider to zoom, and the image can never be
 * dragged off the hole: the offsets are clamped so it always covers.
 *
 * WHAT LEAVES
 *
 * The source rectangle, in the ORIGINAL image's own pixels — not a screenshot
 * of the preview. So the quality that goes up is the photograph's, whatever
 * size this box happens to be on screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/lib/app/i18n/react";
import type { CropRect } from "@/lib/app/me";

import { ctaCommit, ctaSecondary } from "../hold";
import { Ion } from "../ion";

/** The preview box, in CSS pixels. */
const VIEW = 260;
const MAX_ZOOM = 4;

export function AvatarCropper({
  image,
  busy,
  onCancel,
  onConfirm,
}: {
  image: HTMLImageElement;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (rect: CropRect) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const t = useT();

  /** Scale at which the image exactly covers the hole. Zoom multiplies it. */
  const cover = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
  const s = cover * zoom;
  const dw = image.naturalWidth * s;
  const dh = image.naturalHeight * s;

  /**
   * How far the image may be pushed before a corner of the hole would show
   * empty. Recomputed on every zoom, and applied to the CURRENT offset too:
   * zooming back out must pull a pushed-aside image back into place rather
   * than leaving a gap.
   */
  const limit = useCallback(
    (next: { x: number; y: number }, atZoom: number) => {
      const w = image.naturalWidth * cover * atZoom;
      const h = image.naturalHeight * cover * atZoom;
      const mx = Math.max(0, (w - VIEW) / 2);
      const my = Math.max(0, (h - VIEW) / 2);
      return { x: Math.max(-mx, Math.min(mx, next.x)), y: Math.max(-my, Math.min(my, next.y)) };
    },
    [image.naturalWidth, image.naturalHeight, cover],
  );

  const setZoomClamped = useCallback(
    (z: number) => {
      const next = Math.max(1, Math.min(MAX_ZOOM, z));
      setZoom(next);
      setOffset((o) => limit(o, next));
    },
    [limit],
  );

  /* Pointer drag. Capture, so a fast drag that leaves the box keeps moving. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset(limit({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, zoom));
  };
  const endDrag = () => {
    drag.current = null;
  };

  /**
   * The wheel zooms, and the listener is attached by hand because React's
   * onWheel is passive: preventDefault inside it is ignored, and the page
   * scrolls behind the cropper while somebody is trying to size their face.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoomClamped]);

  /**
   * The hole, in the source image's own pixels.
   *
   * The displayed image is centred on the hole and then moved by `offset`, so
   * the hole's top-left sits at (dw/2 - VIEW/2 - offset.x) in displayed pixels
   * — divided by the scale, that is where it sits in the original.
   */
  const rect = (): CropRect => ({
    sx: (dw / 2 - VIEW / 2 - offset.x) / s,
    sy: (dh / 2 - VIEW / 2 - offset.y) / s,
    side: VIEW / s,
  });

  return (
    <div className="flex flex-col items-center">
      <p className="mb-4 text-center text-[13px] text-[#9FB7C2]">{t("account.cropper.hint")}</p>

      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ width: VIEW, height: VIEW, touchAction: "none" }}
        className="relative max-w-full cursor-grab overflow-hidden rounded-[18px] bg-black/40 active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: dw,
            height: dh,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            maxWidth: "none",
          }}
        />
        {/*
          The mask: one element, a huge ring-shaped shadow that darkens
          everything outside the circle. Cheaper and crisper than two stacked
          gradients, and it cannot drift out of register with the hole.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px]"
          style={{ boxShadow: `0 0 0 ${VIEW}px rgba(4,12,20,0.66) inset`, clipPath: "circle(50%)", mixBlendMode: "normal" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full border border-white/50" />
      </div>

      <div className="mt-5 flex w-full max-w-[320px] items-center gap-3">
        <Ion name="image-outline" size={14} className="shrink-0 text-white/70" />
        <label htmlFor="avatar-zoom" className="sr-only">
          {t("account.cropper.zoom")}
        </label>
        <input
          id="avatar-zoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={busy}
          onChange={(e) => setZoomClamped(Number(e.target.value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.18] accent-amber"
        />
        <Ion name="image-outline" size={20} className="shrink-0 text-white/70" />
      </div>

      <div className="mt-6 flex w-full max-w-[320px] flex-col gap-2.5">
        <button type="button" className={ctaCommit} disabled={busy} onClick={() => onConfirm(rect())}>
          {busy ? t("common.saving") : t("account.cropper.use")}
        </button>
        <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
          {t("account.cropper.another")}
        </button>
      </div>
    </div>
  );
}
