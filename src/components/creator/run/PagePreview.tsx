"use client";

/**
 * The creator's page, live, next to whatever changes it.
 *
 * It is a frame around the real page (/app/preview/<id>), not a drawing of it:
 * the same components, the same read, the same order. A preview that is built
 * separately is a preview of a page that does not exist, and it drifts the
 * first week nobody looks.
 *
 * TWO WIDTHS, BECAUSE THE PAGE IS READ ON A PHONE
 *
 * Almost everyone arrives from a link on X, on a phone, so the phone is the
 * default and the wide one is the second thought. The frame is laid out at a
 * real width (390 or 1120) and scaled down to the room there is, so what is
 * shown is the page's own layout at that width, never a squeezed one: the
 * breakpoints fire where they really fire.
 *
 * `reload` is a number the parent bumps to redraw after a save. The frame is
 * keyed on it, so it remounts rather than being told to navigate — the page is
 * server-rendered, and a remount is the only way to re-run it.
 */

import { useEffect, useRef, useState } from "react";

import { btnGlassPill as btnSmallSecondary } from "@/components/app/spaces/kit";

import { Ion } from "@/components/app/ion";
import { useT } from "@/lib/app/i18n/react";

/** What the page is read on, at the width it is really read at. */
const WIDTHS = { phone: 390, wide: 1120 } as const;
type Shape = keyof typeof WIDTHS;

/** Tall enough to show the hero and the first spots without scrolling inside the frame. */
const HEIGHT: Record<Shape, number> = { phone: 780, wide: 760 };

export function PagePreview({
  spaceId,
  ground,
  reload = 0,
  className = "",
}: {
  spaceId: string;
  /** The pending background, shown before it is saved. Absent: whatever is stored. */
  ground?: string | null;
  reload?: number;
  className?: string;
}) {
  const t = useT();
  const [shape, setShape] = useState<Shape>("phone");
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);

  // The frame is drawn at its real width and scaled to the room there is.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setRoom(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = WIDTHS[shape];
  const height = HEIGHT[shape];
  // Never magnified: a page blown up past its own size reads as a mistake.
  const scale = room > 0 ? Math.min(1, room / width) : 1;

  const url = `/preview/${encodeURIComponent(spaceId)}${ground ? `?ground=${encodeURIComponent(ground)}` : ""}`;

  return (
    <section className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("runner.preview.yourPage")}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-[16px] border border-white/10 bg-white/[0.05] p-0.5">
            {(Object.keys(WIDTHS) as Shape[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setShape(k)}
                aria-pressed={shape === k}
                className={`h-7 rounded-[14px] px-2.5 text-[12px] transition-colors ${
                  shape === k ? "bg-white/15 text-white" : "text-white/[0.62] hover:bg-white/10"
                }`}
              >
                {k === "phone" ? t("runner.preview.phone") : t("runner.preview.desktop")}
              </button>
            ))}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
            {t("runner.preview.open")} <Ion name="open-outline" size={13} />
          </a>
        </div>
      </div>

      <div ref={box} className="min-w-0 overflow-hidden rounded-[16px] border border-white/10 bg-black/20">
        <div style={{ height: height * scale }}>
          <iframe
            key={`${reload}:${url}`}
            src={url}
            title={t("runner.preview.yourPage")}
            loading="lazy"
            // Nothing in a preview needs to leave it: no top-level navigation,
            // no downloads, no popups. Scripts and same-origin stay on, or the
            // page would not be the page.
            sandbox="allow-scripts allow-same-origin"
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
              display: "block",
            }}
          />
        </div>
      </div>

      <p className="text-[12px] leading-4 text-white/55">
        {t("runner.preview.note")}
      </p>
    </section>
  );
}
