/**
 * The listing's own photo, with every spot a square on it.
 *
 * A sponsor buying a spot on a real suitcase wants to see that suitcase. So the
 * creator uploads a photo of the real thing (the case, the jacket, their own
 * arm) and places each spot on it as a square: drag to move, a corner to
 * resize, with a mouse or a finger. Once every spot has its square and it is
 * saved, the public page and the X card show the photo instead of the catalog
 * drawing.
 *
 * WHAT THE SERVER HOLDS US TO (services/ad-space/photo-rules.ts)
 *
 * Every square inside the photo, at least 4% of it a side, and no two covering
 * more than 5% of the smaller one. The same rules are checked here as the
 * creator drags, so Save is only offered when the server will say yes; the
 * server checks again, and its answer is the one shown.
 *
 * A SOLD SQUARE DOES NOT MOVE
 *
 * A sponsor bought the spot they saw. A square that is sold (or held for an
 * accepted offer) is drawn locked and cannot be dragged, and the photo under
 * it can no longer be replaced or removed.
 *
 * ONE PHOTO, OR ONE PER SIDE
 *
 * With `view` the editor works on one side of the product (front, back…): its
 * own photo, and only the spots on that side, seeded where the drawing has
 * them. The two modes are never mixed (the server refuses it), so a side
 * cannot be started while one photo covers the whole product, and back.
 *
 * ONE SCREEN
 *
 * The photo is fitted to the room the screen has, never scrolled: a tall photo
 * gets narrow, a wide one short. Selecting a square changes its colour, never
 * the width of its edge.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { btnWhite as btnSmall, btnGlassPill as btnSmallSecondary } from "@/components/app/spaces/kit";
import { cardBox as glass } from "@/components/app/spaces/kit";
import { ImageProblem, prepareImage } from "@/lib/ad-space/image";
import { CreatorApiError } from "@/lib/creator/api";
import type { PhotoRect, PositionView, SpaceView } from "@/lib/creator/listing";
import { clearListingPhoto, setListingPhoto, setListingSquares } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { Notice } from "../parts";

/** Mirrors the server's MIN_SIDE and OVERLAP_TOLERANCE. */
const MIN_SIDE = 0.04;
const OVERLAP_TOLERANCE = 0.05;
/** One arrow-key step, as a share of the photo. */
const STEP = 0.005;

/** Colours only: selection, trouble and sold differ by colour, the edge is always 2px. */
const EDGE = {
  idle: "#5B7CFF",
  selected: "#F4F6FA",
  trouble: "#FFB703",
  sold: "#FFB703",
} as const;
const FILL = {
  idle: "rgba(8,12,24,0.50)",
  selected: "rgba(91,124,255,0.45)",
  sold: "rgba(255,183,3,0.35)",
} as const;

type Corner = "nw" | "ne" | "sw" | "se";
type Drag = {
  id: string;
  mode: "move" | Corner;
  startX: number;
  startY: number;
  start: PhotoRect;
  /** The stage's size on screen when the drag began, in the pointer's own units. */
  boxW: number;
  boxH: number;
  pointerId: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (r: PhotoRect): PhotoRect => {
  const q = (n: number) => Math.round(n * 1e5) / 1e5;
  return { x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) };
};
const same = (a: PhotoRect | null | undefined, b: PhotoRect | null | undefined) => {
  if (!a || !b) return !a && !b;
  const ra = round(a);
  const rb = round(b);
  return ra.x === rb.x && ra.y === rb.y && ra.w === rb.w && ra.h === rb.h;
};

function overlapShare(a: PhotoRect, b: PhotoRect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/** Why each square cannot be saved as it is, by position id. */
function troubleOf(rects: Map<string, PhotoRect>): Map<string, string> {
  const out = new Map<string, string>();
  const list = [...rects];
  for (const [id, r] of list) {
    if (r.w < MIN_SIDE - 1e-6 || r.h < MIN_SIDE - 1e-6) out.set(id, "too small to find on a phone");
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (overlapShare(list[i][1], list[j][1]) > OVERLAP_TOLERANCE) {
        out.set(list[i][0], "on top of another spot");
        out.set(list[j][0], "on top of another spot");
      }
    }
  }
  return out;
}

/**
 * Where a spot starts on a fresh photo: where it sits on the catalog drawing,
 * with the drawing's views laid side by side across the photo. Roughly right
 * for a photo of the same thing from the front, and never on top of another.
 */
/** The drawing's geometry. The API sends it; the console's own Template type leaves it out. */
type Drawing = {
  views?: { key: string }[];
  zones?: { zoneKey: string; viewKey: string; rect?: PhotoRect }[];
};

function seedRects(space: SpaceView, positions: readonly PositionView[], view: string | null): Map<string, PhotoRect> {
  const out = new Map<string, PhotoRect>();
  const drawing = (space.template ?? {}) as Drawing;
  // One side: its zones are already fractions of that side, which is what its photo shows.
  const views = view ? [{ key: view }] : drawing.views ?? [];
  const zones = drawing.zones ?? [];
  const n = Math.max(1, views.length);
  const unplaced: PositionView[] = [];
  for (const p of positions) {
    if (p.rect) {
      out.set(p.id, p.rect);
      continue;
    }
    const z = zones.find((zone) => zone.zoneKey === p.zoneKey);
    const i = z ? views.findIndex((v) => v.key === z.viewKey) : -1;
    const zr = z?.rect;
    if (!zr || i < 0) {
      unplaced.push(p);
      continue;
    }
    const w = Math.max(MIN_SIDE, zr.w / n);
    const h = Math.max(MIN_SIDE, zr.h);
    out.set(p.id, round({ x: clamp((i + zr.x) / n, 0, 1 - w), y: clamp(zr.y, 0, 1 - h), w, h }));
  }
  // Anything the drawing cannot place goes in a row along the bottom.
  unplaced.forEach((p, k) => {
    const side = 0.12;
    const perRow = Math.floor(1 / (side + 0.02));
    const x = 0.02 + (k % perRow) * (side + 0.02);
    const y = clamp(0.86 - Math.floor(k / perRow) * (side + 0.02), 0, 1 - side);
    out.set(p.id, { x, y, w: side, h: side });
  });
  return out;
}

/** The server's refusals, in words. */
function describePhotoError(e: unknown): string {
  if (e instanceof ImageProblem) {
    if (e.reason === "type") return "Use a JPG, PNG or WebP photo.";
    if (e.reason === "too_big") return "That photo is too large even after shrinking it. Try a smaller one.";
    return "We could not read that photo. Try another.";
  }
  if (e instanceof CreatorApiError) {
    switch (e.code) {
      case "photo_frozen":
        return "A spot on this photo is sold, so the photo stays: the sponsor bought the place they saw on it.";
      case "square_frozen":
        return "That spot is sold, so its square stays where the sponsor saw it.";
      case "photo_required":
        return "Upload the photo first.";
      case "photo_mode_conflict":
        return "Use one photo for the whole product or a photo per side, not both. Remove the other one first.";
      case "view_not_on_product":
        return "That side is not part of this product.";
      case "photo_needs_a_product":
        return "A photo with squares is for a product. This listing sells a service.";
      case "squares_invalid":
        return "Some squares are too small or on top of each other. Fix the ones marked in amber and save again.";
      case "image_too_large":
        return "Up to 3 MB.";
      case "image_type_not_supported":
        return "Use a JPG or PNG photo.";
      case "image_unreadable":
        return "We could not read that photo. Try another.";
      case "space_delisted":
        return "This listing is off HiSpace, so it cannot be changed.";
    }
  }
  return describeRunError(e);
}

/** The side each zone is drawn on, from the drawing the API sends. */
export function viewOfZones(space: SpaceView): Map<string, string> {
  const zones = ((space.template ?? {}) as Drawing).zones ?? [];
  return new Map(zones.map((z) => [z.zoneKey, z.viewKey]));
}

export function PhotoEditor({
  space,
  onChanged,
  view = null,
  viewLabel = null,
}: {
  space: SpaceView;
  onChanged: () => void;
  /** One side of the product, with its own photo. Absent: one photo for the whole product. */
  view?: string | null;
  viewLabel?: string | null;
}) {
  const photo = (view ? space.viewPhotos?.[view] : space.photo) ?? null;
  const zoneView = useMemo(() => viewOfZones(space), [space]);
  const positions = useMemo(
    () => (view ? space.positions.filter((p) => zoneView.get(p.zoneKey) === view) : space.positions),
    [space.positions, view, zoneView],
  );
  // The other mode is in use: a square is a fraction of ONE picture.
  const conflict = view ? Boolean(space.photo) : Object.keys(space.viewPhotos ?? {}).length > 0;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "save" | "remove">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const frozen = useMemo(
    () => new Set(positions.filter((p) => p.rectFrozen).map((p) => p.id)),
    [positions],
  );
  const initial = useMemo(() => seedRects(space, positions, view), [space, positions, view]);
  const [rects, setRects] = useState<Map<string, PhotoRect>>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setRects(initial), [initial]);

  const trouble = useMemo(() => troubleOf(rects), [rects]);
  const changed = positions.filter((p) => !frozen.has(p.id) && !same(p.rect, rects.get(p.id)));
  const dirty = changed.length > 0;
  const placed = positions.every((p) => p.rect);

  function upload(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    setBusy("upload");
    // Drawn upright into a canvas and sent as JPEG: the server strips EXIF,
    // orientation included, and the X card reads JPEG and PNG only.
    void prepareImage(file, { keepTransparency: false })
      .then((blob) => setListingPhoto(space.id, blob, view))
      .then(onChanged)
      .catch((e) => setNotice(describePhotoError(e)))
      .finally(() => setBusy(null));
  }

  function save() {
    setNotice(null);
    setBusy("save");
    void setListingSquares(
      space.id,
      changed.map((p) => ({ positionId: p.id, rect: round(rects.get(p.id)!) })),
    )
      .then(onChanged)
      .catch((e) => setNotice(describePhotoError(e)))
      .finally(() => setBusy(null));
  }

  function remove() {
    setNotice(null);
    setBusy("remove");
    void clearListingPhoto(space.id, view)
      .then(onChanged)
      .catch((e) => setNotice(describePhotoError(e)))
      .finally(() => {
        setBusy(null);
        setConfirmRemove(false);
      });
  }

  const chooser = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (!photo) {
    const side = viewLabel ? viewLabel.toLowerCase() : "side";
    return (
      <section className={`${glass} flex h-[calc(var(--app-vh,100dvh)-220px)] min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center`}>
        <div className="flex max-w-[440px] flex-col gap-2">
          <h3 className="text-[15.5px] font-strong text-white">
            {view ? `Your ${side}, as it really is` : "Show sponsors the real thing"}
          </h3>
          <p className="text-[14.5px] text-white/[0.62]">
            {view
              ? `Upload a photo of the ${side} of your ${(space.template?.name ?? "product").toLowerCase()}, then place its ${positions.length} ${positions.length === 1 ? "spot" : "spots"} on it. Once they are placed, your page shows this photo for the ${side} and the drawing for any side without one.`
              : "Upload a photo of what you are selling space on, then place each spot on it. Once every spot is placed, your page and your X card show your photo instead of the drawing."}
          </p>
        </div>
        {conflict ? (
          <p className="max-w-[440px] text-[14.5px] text-amber">
            {view
              ? "This listing uses one photo for the whole product. Remove it first to give each side its own."
              : "This listing has a photo per side. Remove those first to use one photo for the whole product."}
          </p>
        ) : (
          <button type="button" className={btnSmall} disabled={busy !== null} onClick={() => input.current?.click()}>
            {busy === "upload" ? "Uploading…" : "Upload a photo"}
          </button>
        )}
        <p className="text-[12.5px] text-white/55">JPG, PNG or WebP. We remove the location and camera details.</p>
        {chooser}
        {notice ? <Notice>{notice}</Notice> : null}
      </section>
    );
  }

  const selectedPosition = positions.find((p) => p.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[12.5px] text-white/55">
          {trouble.size > 0
            ? "Fix the squares in amber before saving."
            : dirty
              ? "Unsaved changes."
              : placed && photo.ready
                ? "On your page and your X card."
                : "Place every spot and save to show the photo on your page."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSmallSecondary}
            disabled={busy !== null || frozen.size > 0}
            title={frozen.size > 0 ? "A spot on this photo is sold" : undefined}
            onClick={() => input.current?.click()}
          >
            {busy === "upload" ? "Uploading…" : "Replace photo"}
          </button>
          {confirmRemove ? (
            <button type="button" className={btnSmallSecondary} disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? "Removing…" : "Remove it and every square"}
            </button>
          ) : (
            <button
              type="button"
              className={btnSmallSecondary}
              disabled={busy !== null || frozen.size > 0}
              onClick={() => setConfirmRemove(true)}
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            className={btnSmall}
            disabled={busy !== null || trouble.size > 0 || (!dirty && placed)}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {chooser}

      <Stage
        url={photo.url}
        width={photo.width}
        height={photo.height}
        positions={positions}
        rects={rects}
        frozen={frozen}
        trouble={trouble}
        selected={selected}
        onSelect={setSelected}
        onMove={(id, r) => setRects((prev) => new Map(prev).set(id, r))}
      />

      <div className="flex min-h-[40px] items-center gap-2 overflow-x-auto">
        {positions.map((p) => {
          const on = p.id === selected;
          const bad = trouble.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(on ? null : p.id)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[16px] border px-3 text-[12.5px] transition-colors ${
                on
                  ? "border-text bg-white/15 text-white"
                  : bad
                    ? "border-amber/60 bg-amber/10 text-amber"
                    : "border-white/10 bg-white/[0.05] text-white/[0.62] hover:bg-white/10"
              }`}
            >
              {p.label}
              {frozen.has(p.id) ? <span className="text-amber">Sold</span> : null}
            </button>
          );
        })}
      </div>
      {selectedPosition && trouble.has(selectedPosition.id) ? (
        <p className="text-[12.5px] text-amber">
          {selectedPosition.label} is {trouble.get(selectedPosition.id)}.
        </p>
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}
    </div>
  );
}

/**
 * The photo, fitted to the room left on the screen, with the squares on it.
 * Pointer events cover mouse, pen and touch alike; `touch-action: none` keeps
 * a finger dragging a square from scrolling the page instead.
 */
function Stage({
  url,
  width,
  height,
  positions,
  rects,
  frozen,
  trouble,
  selected,
  onSelect,
  onMove,
}: {
  url: string | null;
  width: number;
  height: number;
  positions: PositionView[];
  rects: Map<string, PhotoRect>;
  frozen: Set<string>;
  trouble: Map<string, string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, r: PhotoRect) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<Drag | null>(null);

  // Fit the photo inside the box, keeping its shape. Layout units, so the
  // shell's zoom does not throw it off.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const bw = el.clientWidth;
      const bh = el.clientHeight;
      if (!bw || !bh) return;
      const k = Math.min(bw / width, bh / height);
      setFit({ w: Math.floor(width * k), h: Math.floor(height * k) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const begin = useCallback(
    (e: PointerEvent<HTMLElement>, id: string, mode: Drag["mode"]) => {
      // Every press on a square is the square's, never the stage's "select nothing".
      e.stopPropagation();
      if (frozen.has(id)) {
        onSelect(id);
        return;
      }
      const r = rects.get(id);
      const s = stage.current?.getBoundingClientRect();
      if (!r || !s) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = {
        id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        start: r,
        boxW: s.width,
        boxH: s.height,
        pointerId: e.pointerId,
      };
      onSelect(id);
    },
    [frozen, rects, onSelect],
  );

  const move = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = (e.clientX - d.startX) / d.boxW;
      const dy = (e.clientY - d.startY) / d.boxH;
      const s = d.start;
      let next: PhotoRect;
      if (d.mode === "move") {
        next = { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
      } else {
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;
        if (d.mode === "nw" || d.mode === "sw") left = clamp(s.x + dx, 0, right - MIN_SIDE);
        if (d.mode === "ne" || d.mode === "se") right = clamp(right + dx, left + MIN_SIDE, 1);
        if (d.mode === "nw" || d.mode === "ne") top = clamp(s.y + dy, 0, bottom - MIN_SIDE);
        if (d.mode === "sw" || d.mode === "se") bottom = clamp(bottom + dy, top + MIN_SIDE, 1);
        next = { x: left, y: top, w: right - left, h: bottom - top };
      }
      onMove(d.id, round(next));
    },
    [onMove],
  );

  const end = useCallback((e: PointerEvent<HTMLElement>) => {
    if (drag.current && e.pointerId === drag.current.pointerId) drag.current = null;
  }, []);

  /** Arrows move the selected square; with Shift they grow or shrink it. */
  const onKey = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    const r = rects.get(id);
    if (!r || frozen.has(id)) return;
    const d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = e.shiftKey
      ? { ...r, w: clamp(r.w + d[0], MIN_SIDE, 1 - r.x), h: clamp(r.h + d[1], MIN_SIDE, 1 - r.y) }
      : { ...r, x: clamp(r.x + d[0], 0, 1 - r.w), y: clamp(r.y + d[1], 0, 1 - r.h) };
    onMove(id, round(next));
  };

  return (
    <div
      ref={box}
      className="flex h-[calc(var(--app-vh,100dvh)-330px)] min-h-[240px] w-full items-center justify-center lg:h-[calc(var(--app-vh,100dvh)-270px)]"
    >
      {fit ? (
        <div
          ref={stage}
          className="relative touch-none select-none overflow-hidden rounded-[14px] border border-white/10"
          style={{ width: fit.w, height: fit.h }}
          onPointerDown={() => onSelect(null)}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          ) : null}
          {positions.map((p) => {
            const r = rects.get(p.id);
            if (!r) return null;
            const locked = frozen.has(p.id);
            const on = selected === p.id;
            const bad = trouble.has(p.id);
            const edge = on ? EDGE.selected : bad ? EDGE.trouble : locked ? EDGE.sold : EDGE.idle;
            const fill = locked ? FILL.sold : on ? FILL.selected : FILL.idle;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`${p.label}${locked ? ", sold, cannot move" : ""}`}
                onPointerDown={(e) => begin(e, p.id, "move")}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onFocus={() => onSelect(p.id)}
                onKeyDown={(e) => onKey(e, p.id)}
                className={`absolute flex items-center justify-center overflow-hidden rounded-[6px] border-2 outline-none transition-colors ${
                  locked ? "cursor-not-allowed" : "cursor-move"
                } ${bad && !on ? "border-dashed" : "border-solid"}`}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  borderColor: edge,
                  background: fill,
                  zIndex: on ? 2 : 1,
                }}
              >
                <span className="pointer-events-none truncate px-1 text-[11px] font-strong text-white">
                  {locked ? `${p.label} · Sold` : p.label}
                </span>
                {on && !locked
                  ? (["nw", "ne", "sw", "se"] as const).map((c) => (
                      <span
                        key={c}
                        onPointerDown={(e) => begin(e, p.id, c)}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                        aria-hidden
                        className="absolute h-5 w-5 touch-none"
                        style={{
                          left: c === "nw" || c === "sw" ? -2 : undefined,
                          right: c === "ne" || c === "se" ? -2 : undefined,
                          top: c === "nw" || c === "ne" ? -2 : undefined,
                          bottom: c === "sw" || c === "se" ? -2 : undefined,
                          cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                        }}
                      >
                        <span
                          className="absolute h-2.5 w-2.5 rounded-[3px] bg-text"
                          style={{
                            left: c === "nw" || c === "sw" ? 0 : undefined,
                            right: c === "ne" || c === "se" ? 0 : undefined,
                            top: c === "nw" || c === "ne" ? 0 : undefined,
                            bottom: c === "sw" || c === "se" ? 0 : undefined,
                          }}
                        />
                      </span>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
