"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Tip {
  label: string;
  x: number;
  y: number;
  zoom: number;
}

/**
 * The name of an icon in the folded sidebar, in a pill to its right the moment
 * the pointer (or the keyboard) reaches it. It replaces `title`, whose native
 * tooltip waits about a second and looks like the operating system's.
 *
 * Any element carrying data-rail-tip="Label" gets one while this is mounted, so
 * the rail renders it only when folded. The pill is drawn into <body>: the rail
 * scrolls and would clip anything hung off its edge. A zoomed frame passes its
 * zoom on, so the pill is the size of the icons it names.
 */
export function RailTip() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let target: HTMLElement | null = null;
    const show = (el: HTMLElement) => {
      target = el;
      const r = el.getBoundingClientRect();
      const zoom = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
      setTip({ label: el.dataset.railTip ?? "", x: r.right + 10 * zoom, y: r.top + r.height / 2, zoom });
    };
    const hide = () => {
      target = null;
      setTip(null);
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element).closest<HTMLElement>("[data-rail-tip]");
      if (el === target) return;
      if (el) show(el);
      else hide();
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-rail-tip]") : null;
      if (el?.matches(":focus-visible")) show(el);
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    // A click usually changes the page or unfolds the rail, and a scroll moves
    // the icon out from under the pill: either way it would be left pointing at nothing.
    document.addEventListener("click", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("click", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-[1000] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0b1a24] px-2.5 py-1.5 text-[12px] font-medium leading-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ left: tip.x / tip.zoom, top: tip.y / tip.zoom, zoom: tip.zoom }}
    >
      {tip.label}
    </div>,
    document.body,
  );
}
