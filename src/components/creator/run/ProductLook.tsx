/**
 * "Your product": the creator makes the suitcase (the laptop, the jacket…)
 * theirs, in two ways, each its own screen behind a card with Back:
 *
 *   Colours       the drawing's body and its handle, wheels and trim, from a
 *                 curated palette or any hex. Every spot stays legible on any
 *                 colour by itself: the outline's ink and the plate under each
 *                 price follow the body's lightness.
 *   Real photos   a photo of each side (front, back…) with that side's spots
 *                 placed as squares on it (./PhotoEditor, per view), or the
 *                 original single photo for the whole product. A side without
 *                 a photo keeps the drawing.
 *
 * Selecting a swatch changes a COLOUR (its edge goes the select white), never the width
 * of its border, and no swatch is a 9999 pill.
 */

"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { btnWhite as btnSmall, btnGlassPill as btnSmallSecondary } from "@/components/app/spaces/kit";
import { ProductOutline } from "@/components/ad-space/ProductBoard";
import { useHref } from "@/components/app/base";
import { cardBox as glass } from "@/components/app/spaces/kit";
import {
  ACCENT_PALETTE,
  BODY_PALETTE,
  DEFAULT_LOOK,
  contrast,
  inkOn,
  normalHex,
  type ProductLook,
} from "@/lib/ad-space/product-look";
import type { TemplateView } from "@/lib/ad-space/types";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import type { SpaceView } from "@/lib/creator/listing";
import { setListingProductLook } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Notice } from "../parts";
import { viewOfZones } from "./PhotoEditor";

/** The drawing the API sends with the template; the console's own type leaves it out. */
type Drawing = {
  views?: TemplateView[];
  zones?: { zoneKey: string; viewKey: string; rect?: { x: number; y: number; w: number; h: number } }[];
};

export function drawingOf(space: SpaceView): { views: TemplateView[]; zones: NonNullable<Drawing["zones"]> } {
  const d = (space.template ?? {}) as Drawing;
  return { views: d.views ?? [], zones: d.zones ?? [] };
}

/* ── The hub: one card per way ─────────────────────────────────────── */

export function ProductHub({ space }: { space: SpaceView }) {
  const t = useT();
  const href = useHref();
  const base = `/listings/${space.id}?tab=photo`;
  const { views } = drawingOf(space);
  const look = space.productLook ?? null;
  const sides = space.viewPhotos ?? {};
  const zoneView = viewOfZones(space);
  const placedOn = (view: string) => {
    const on = space.positions.filter((p) => zoneView.get(p.zoneKey) === view);
    return `${on.filter((p) => p.rect).length}/${on.length}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("runner.look.drawing")}</h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li>
            <HubLink href={href(`${base}&item=colour`)} title={t("runner.photo.colours")} note={look ? t("runner.look.yourColours") : t("runner.look.outlineOnly")}>
              <LookPreview views={views.slice(0, 2)} look={look} height={72} />
            </HubLink>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("runner.look.realPhotos")}</h3>
          <p className="text-[12.5px] text-white/[0.62]">
            {t("runner.look.realPhotosBody", { product: (space.template?.name ?? t("runner.photo.product")).toLowerCase() })}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {views.map((v) => {
            const side = sides[v.key];
            return (
              <li key={v.key}>
                <HubLink
                  href={href(`${base}&item=side-${encodeURIComponent(v.key)}`)}
                  title={v.label}
                  note={!side ? t("runner.look.addPhoto") : side.ready ? t("runner.look.onYourPage") : t("runner.look.spotsPlaced", { placed: placedOn(v.key) })}
                  live={Boolean(side?.ready)}
                >
                  {side?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the creator's own upload, from our bucket
                    <img src={side.url} alt="" className="h-[72px] w-auto max-w-full rounded-[8px] object-cover" />
                  ) : (
                    <LookPreview views={[v]} look={look} height={72} />
                  )}
                </HubLink>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("runner.look.onePhotoWhole")}</h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li>
            <HubLink
              href={href(`${base}&item=one`)}
              title={t("runner.photo.onePhoto")}
              note={!space.photo ? t("runner.look.noSides") : space.photo.ready ? t("runner.look.onYourPage") : t("runner.look.spotsToPlace")}
              live={Boolean(space.photo?.ready)}
            >
              {space.photo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- the creator's own upload, from our bucket
                <img src={space.photo.url} alt="" className="h-[72px] w-auto max-w-full rounded-[8px] object-cover" />
              ) : null}
            </HubLink>
          </li>
        </ul>
      </section>
    </div>
  );
}

function HubLink({
  href,
  title,
  note,
  live = false,
  children,
}: {
  href: string;
  title: string;
  note: string;
  live?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={`${glass} flex h-full min-h-[148px] flex-col justify-between gap-3 p-4 transition-colors hover:bg-white/[0.07]`}>
      <div className="flex min-h-[72px] items-center">{children}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-bold text-white">{title}</p>
          <p className={`truncate text-[12.5px] ${live ? "text-[#2FBE8A]" : "text-white/[0.62]"}`}>{note}</p>
        </div>
        <span aria-hidden className="text-white/[0.62]">
          &rarr;
        </span>
      </div>
    </Link>
  );
}

/** The product's sides, drawn in a look (or outline only), no spots. */
export function LookPreview({ views, look, height }: { views: TemplateView[]; look: ProductLook | null; height: number }) {
  return (
    <div className="flex items-end gap-3" aria-hidden>
      {views.map((v) => (
        <svg
          key={v.key}
          viewBox={`0 0 ${v.viewBox[0]} ${v.viewBox[1]}`}
          className="overflow-visible"
          style={{ height, width: "auto", aspectRatio: `${v.viewBox[0]} / ${v.viewBox[1]}` }}
        >
          <ProductOutline view={v} look={look} />
        </svg>
      ))}
    </div>
  );
}

/* ── Colours ───────────────────────────────────────────────────────── */

export function ColourEditor({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const t = useT();
  const saved = space.productLook ?? null;
  const [look, setLook] = useState<ProductLook>(saved ?? DEFAULT_LOOK);
  const [busy, setBusy] = useState<null | "save" | "clear">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { views, zones } = useMemo(() => drawingOf(space), [space]);
  const dirty = !saved || saved.body !== look.body || saved.accent !== look.accent;

  function save(next: ProductLook | null) {
    setNotice(null);
    setBusy(next ? "save" : "clear");
    void setListingProductLook(space.id, next)
      .then(() => {
        if (!next) setLook(DEFAULT_LOOK);
        onChanged();
      })
      .catch((e) => setNotice(describeRunError(e)))
      .finally(() => setBusy(null));
  }

  const ink = inkOn(look.body);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className={`${glass} flex min-h-[320px] flex-col items-center justify-center gap-4 p-5`}>
        <div className="flex flex-wrap items-end justify-center gap-5">
          {views.map((v) => {
            const [W, H] = v.viewBox;
            const onView = zones.filter((z) => z.viewKey === v.key && z.rect && space.positions.some((p) => p.zoneKey === z.zoneKey));
            return (
              <figure key={v.key} className="flex flex-col items-center gap-2">
                <svg viewBox={`0 0 ${W} ${H}`} className="overflow-visible" style={{ height: 220, width: "auto", aspectRatio: `${W} / ${H}` }} aria-hidden>
                  <ProductOutline view={v} look={look} />
                  {onView.map((z) => (
                    <rect
                      key={z.zoneKey}
                      x={z.rect!.x * W}
                      y={z.rect!.y * H}
                      width={z.rect!.w * W}
                      height={z.rect!.h * H}
                      rx={Math.min(z.rect!.w * W, z.rect!.h * H) * 0.12}
                      fill="rgba(8,12,24,0.58)"
                      stroke="#5B7CFF"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
                <figcaption className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">{v.label}</figcaption>
              </figure>
            );
          })}
        </div>
        <p className="text-center text-[12.5px] text-white/[0.62]">
          {t("runner.look.plateNote", {
            ink: ink === "#0A141E" ? "dark" : "light",
            ratio: fmtNumber(contrast(look.body, ink), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          })}
        </p>
      </section>

      <section className={`${glass} flex flex-col gap-5 p-5`}>
        <Swatches
          id="hex-body"
          title={t("runner.look.body")}
          palette={BODY_PALETTE}
          value={look.body}
          onChange={(body) => setLook((l) => ({ ...l, body }))}
        />
        <Swatches
          id="hex-handle-wheels-and-trim"
          title={t("runner.look.accent")}
          palette={ACCENT_PALETTE}
          value={look.accent}
          onChange={(accent) => setLook((l) => ({ ...l, accent }))}
        />
        {notice ? <Notice>{notice}</Notice> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button type="button" className={btnSmall} disabled={busy !== null || !dirty} onClick={() => save(look)}>
            {busy === "save" ? t("common.saving") : saved && !dirty ? t("common.saved") : t("runner.look.save")}
          </button>
          {saved ? (
            <button type="button" className={btnSmallSecondary} disabled={busy !== null} onClick={() => save(null)}>
              {busy === "clear" ? t("runner.removing") : t("runner.look.backToOutline")}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Swatches({
  id,
  title,
  palette,
  value,
  onChange,
}: {
  /** The hex field's id: fixed, so it does not change with the language of the title. */
  id: string;
  title: string;
  palette: readonly { name: string; hex: string }[];
  value: string;
  onChange: (hex: string) => void;
}) {
  const [typed, setTyped] = useState(value);
  const t = useT();
  const custom = !palette.some((c) => c.hex.toUpperCase() === value.toUpperCase());
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-[14.5px] font-bold text-white">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {palette.map((c) => {
          const on = c.hex.toUpperCase() === value.toUpperCase();
          return (
            <button
              key={c.hex}
              type="button"
              aria-pressed={on}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                onChange(c.hex);
                setTyped(c.hex);
              }}
              className={`h-10 w-10 rounded-[12px] border-2 transition-colors duration-180 ${on ? "border-[#F1F5F9]" : "border-white/15 hover:border-white/40"}`}
              style={{ background: c.hex }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-[12.5px] text-white/[0.62]">
          {t("runner.look.custom")}
        </label>
        <input
          type="color"
          aria-label={t("runner.look.pickAny", { title })}
          value={normalHex(value) ?? "#000000"}
          onChange={(e) => {
            const hex = normalHex(e.target.value);
            if (hex) {
              onChange(hex);
              setTyped(hex);
            }
          }}
          className={`h-10 w-10 cursor-pointer rounded-[12px] border-2 bg-transparent p-0.5 ${custom ? "border-[#F1F5F9]" : "border-white/15"}`}
        />
        <input
          id={id}
          value={typed}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setTyped(e.target.value);
            const hex = normalHex(e.target.value);
            if (hex) onChange(hex);
          }}
          className="h-10 w-28 rounded-[12px] border border-white/15 bg-black/20 px-3 font-mono text-[14.5px] uppercase text-white outline-none focus:border-white/30"
        />
      </div>
    </fieldset>
  );
}
