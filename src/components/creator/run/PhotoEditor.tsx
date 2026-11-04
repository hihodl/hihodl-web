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

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";

import { useHref } from "@/components/app/base";
import { btnWhite as btnSmall, btnGlassPill as btnSmallSecondary } from "@/components/app/spaces/kit";
import { cardBox as glass } from "@/components/app/spaces/kit";
import { ImageProblem, prepareImage } from "@/lib/ad-space/image";
import { t as tl } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { CreatorApiError } from "@/lib/creator/api";
import type { PhotoRect, PositionView, SpaceView } from "@/lib/creator/listing";
import { clearListingPhoto, setListingPhoto, setListingSquares } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";
import {
  LAYOUTS,
  arrange,
  layoutFits,
  readLayouts,
  removeLayout,
  writeLayout,
  type LayoutKind,
  type SavedLayout,
} from "@/lib/creator/spot-layout";

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

/** Why a square cannot be saved as it is. */
type Trouble = "small" | "overlap";

/** The words for each arrangement (lib/creator/spot-layout's LAYOUT_LABEL, in the person's language). */
const LAYOUT_KEY = {
  grid: "runner.photo.layout.grid",
  band: "runner.photo.layout.band",
  column: "runner.photo.layout.column",
  corners: "runner.photo.layout.corners",
} as const satisfies Record<LayoutKind, string>;

/** Why each square cannot be saved as it is, by position id. */
function troubleOf(rects: Map<string, PhotoRect>): Map<string, Trouble> {
  const out = new Map<string, Trouble>();
  const list = [...rects];
  for (const [id, r] of list) {
    if (r.w < MIN_SIDE - 1e-6 || r.h < MIN_SIDE - 1e-6) out.set(id, "small");
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (overlapShare(list[i][1], list[j][1]) > OVERLAP_TOLERANCE) {
        out.set(list[i][0], "overlap");
        out.set(list[j][0], "overlap");
      }
    }
  }
  return out;
}

/** The drawing's geometry. The API sends it; the console's own Template type leaves it out. */
type Drawing = {
  views?: { key: string; label?: string }[];
  zones?: { zoneKey: string; viewKey: string; rect?: PhotoRect }[];
};

/**
 * Where a spot starts on a fresh photo.
 *
 * On ONE SIDE, where the drawing has it: a zone is already a fraction of that
 * side, and the photo shows that side, so the drawing is simply right.
 *
 * On ONE PHOTO for the whole product, an even grid — see the comment in the
 * body for what it replaced and why.
 */

function seedRects(space: SpaceView, positions: readonly PositionView[], view: string | null): Map<string, PhotoRect> {
  const out = new Map<string, PhotoRect>();
  const drawing = (space.template ?? {}) as Drawing;
  const zones = drawing.zones ?? [];
  const unplaced: PositionView[] = [];

  for (const p of positions) {
    if (p.rect) {
      out.set(p.id, p.rect);
      continue;
    }
    // ONE SIDE: the drawing's own geometry is right, because the zone is
    // already a fraction of the side the photo shows. Nothing to invent.
    const zr = view ? zones.find((zone) => zone.zoneKey === p.zoneKey)?.rect : undefined;
    if (view && zr) {
      const w = Math.max(MIN_SIDE, zr.w);
      const h = Math.max(MIN_SIDE, zr.h);
      out.set(p.id, round({ x: clamp(zr.x, 0, 1 - w), y: clamp(zr.y, 0, 1 - h), w, h }));
      continue;
    }
    unplaced.push(p);
  }

  // ONE PHOTO FOR THE WHOLE PRODUCT, and anything the drawing cannot place:
  // an even grid. The old seed put each side in its own vertical strip and
  // squashed every square to a quarter of its width, which hits the 4% floor
  // and lands them on top of one another — eighteen spots opened in amber
  // before the creator had touched anything. A grid opens clean, and the
  // squares that matter get dragged.
  const order = new Map((drawing.views ?? []).map((v, i) => [v.key, i]));
  const viewOf = new Map(zones.map((z) => [z.zoneKey, z.viewKey]));
  unplaced.sort((a, b) => (order.get(viewOf.get(a.zoneKey) ?? "") ?? 99) - (order.get(viewOf.get(b.zoneKey) ?? "") ?? 99));
  const grid = arrange(unplaced.length, "grid");
  unplaced.forEach((p, i) => {
    if (grid[i]) out.set(p.id, grid[i]);
  });
  return out;
}

/** The server's refusals, in words. */
function describePhotoError(e: unknown): string {
  if (e instanceof ImageProblem) {
    if (e.reason === "type") return tl("runner.photo.err.type");
    if (e.reason === "too_big") return tl("runner.photo.err.tooBig");
    return tl("runner.photo.err.unreadable");
  }
  if (e instanceof CreatorApiError) {
    switch (e.code) {
      case "photo_frozen":
        return tl("runner.photo.err.frozen");
      case "square_frozen":
        return tl("runner.photo.err.squareFrozen");
      case "photo_required":
        return tl("runner.photo.err.required");
      case "photo_mode_conflict":
        return tl("runner.photo.err.modeConflict");
      case "view_not_on_product":
        return tl("runner.photo.err.viewNotOnProduct");
      case "photo_needs_a_product":
        return tl("runner.photo.err.needsProduct");
      case "squares_invalid":
        return tl("runner.photo.err.squaresInvalid");
      case "image_too_large":
        return tl("runner.photo.err.tooLarge");
      case "image_type_not_supported":
        return tl("runner.photo.err.jpgPng");
      case "image_unreadable":
        return tl("runner.photo.err.unreadable");
      case "space_delisted":
        return tl("runner.photo.err.delisted");
    }
  }
  return describeRunError(e);
}

/** The side each zone is drawn on, from the drawing the API sends. */
export function viewOfZones(space: SpaceView): Map<string, string> {
  const zones = ((space.template ?? {}) as Drawing).zones ?? [];
  return new Map(zones.map((z) => [z.zoneKey, z.viewKey]));
}

/**
 * Every side of the product, and the one-photo mode, as one row of pills.
 *
 * The editor worked on one side and had no idea the others existed: to move
 * from the front to the back you went back to the hub and in again, which is
 * two clicks to say "and now the other side of the same suitcase". Each pill
 * carries how far that side has got, so the row is also the progress.
 *
 * The mode in use wins: with one photo covering the whole product the sides
 * are not offered, and with a photo per side the one-photo pill is not, because
 * the server refuses the mix and an offer that can only be refused is a trap.
 */
function SideSwitcher({ space, view }: { space: SpaceView; view: string | null }) {
  const t = useT();
  const href = useHref();
  const base = `/listings/${space.id}?tab=photo`;
  const drawing = (space.template ?? {}) as Drawing;
  const views = drawing.views ?? [];
  const zoneView = useMemo(() => viewOfZones(space), [space]);
  const perSide = Object.keys(space.viewPhotos ?? {}).length > 0;
  const whole = Boolean(space.photo);
  if (views.length < 2) return null;

  const items: { key: string | null; label: string; note: string; ready: boolean }[] = [];
  if (!whole) {
    for (const v of views) {
      const on = space.positions.filter((p) => zoneView.get(p.zoneKey) === v.key);
      const placed = on.filter((p) => p.rect).length;
      const side = space.viewPhotos?.[v.key];
      items.push({
        key: v.key,
        label: v.label ?? v.key,
        note: !side ? t("runner.photo.noPhoto") : side.ready ? t("runner.photo.done") : `${placed}/${on.length}`,
        ready: Boolean(side?.ready),
      });
    }
  }
  if (!perSide) {
    items.push({
      key: null,
      label: t("runner.photo.onePhoto"),
      note: !space.photo ? t("runner.photo.noPhoto") : space.photo.ready ? t("runner.photo.done") : `${space.positions.filter((p) => p.rect).length}/${space.positions.length}`,
      ready: Boolean(space.photo?.ready),
    });
  }
  if (items.length < 2) return null;

  return (
    <div className="flex min-h-[36px] items-center gap-2 overflow-x-auto">
      {items.map((it) => {
        const on = it.key === view;
        return (
          <Link
            key={it.key ?? "one"}
            href={href(it.key ? `${base}&item=side-${encodeURIComponent(it.key)}` : `${base}&item=one`)}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[16px] border px-3 text-[12.5px] transition-colors ${
              on ? "border-text bg-white/15 text-white" : "border-white/10 bg-white/[0.05] text-white/[0.62] hover:bg-white/10"
            }`}
          >
            {it.label}
            <span className={it.ready ? "text-[#2FBE8A]" : "text-white/45"}>{it.note}</span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Arrangements: a starting shape for every square at once, and the creator's
 * own, saved by name.
 *
 * Placing eighteen squares by hand, none under 4% of a side and none more than
 * 5% over another, is the kind of work people abandon. One click lays them all
 * out legally; the drags that follow are the ones that actually matter.
 *
 * A saved arrangement is keyed by ZONE, so the one tuned for a suitcase front
 * applies to the next suitcase. They live in this browser.
 */
function Arranger({
  templateId,
  view,
  positions,
  frozen,
  rects,
  onApply,
}: {
  templateId: string | null;
  view: string | null;
  positions: readonly PositionView[];
  frozen: ReadonlySet<string>;
  rects: Map<string, PhotoRect>;
  onApply: (next: Map<string, PhotoRect>) => void;
}) {
  const t = useT();
  const [mine, setMine] = useState<SavedLayout[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => setMine(readLayouts(templateId, view)), [templateId, view]);

  // A sold square is where its sponsor saw it, so no arrangement moves it —
  // and the free ones are laid out around it rather than under it.
  const movable = positions.filter((p) => !frozen.has(p.id));
  if (movable.length === 0) return null;

  const apply = (kind: LayoutKind) => {
    const held = positions.filter((p) => frozen.has(p.id)).map((p) => rects.get(p.id)).filter((r): r is PhotoRect => !!r);
    // Room for the sold squares too, so the free ones can be laid out AROUND
    // them: a sold square is where its sponsor saw it and does not move, and
    // an arrangement that drops another square on top of it is amber on
    // arrival, which is the thing this button exists to stop.
    const shapes = arrange(movable.length + held.length, kind).filter(
      (r) => !held.some((h) => overlapShare(r, h) > OVERLAP_TOLERANCE),
    );
    const next = new Map(rects);
    movable.forEach((p, i) => {
      if (shapes[i]) next.set(p.id, shapes[i]);
    });
    onApply(next);
  };

  const applySaved = (l: SavedLayout) => {
    const next = new Map(rects);
    for (const p of movable) {
      const r = l.rects[p.zoneKey];
      if (r) next.set(p.id, r);
    }
    onApply(next);
  };

  const save = () => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    const out: Record<string, PhotoRect> = {};
    for (const p of positions) {
      const r = rects.get(p.id);
      if (r) out[p.zoneKey] = r;
    }
    setMine(writeLayout(templateId, view, { name: clean, at: Date.now(), rects: out }));
    setName("");
    setNaming(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("runner.photo.arrange")}</span>
        {LAYOUTS.filter((k) => layoutFits(movable.length, k)).map((k) => (
          <button key={k} type="button" className={pill} onClick={() => apply(k)}>
            {t(LAYOUT_KEY[k])}
          </button>
        ))}
        {mine.map((l) => (
          <span key={l.name} className="inline-flex shrink-0 items-center">
            <button
              type="button"
              className={`${pill} rounded-r-none border-r-0 pr-2`}
              onClick={() => applySaved(l)}
              title={t("runner.photo.savedOn", { date: fmtDate(l.at, { day: "numeric", month: "short" }) })}
            >
              {l.name}
            </button>
            <button
              type="button"
              aria-label={t("runner.photo.forget", { name: l.name })}
              className={`${pill} rounded-l-none pl-1.5 pr-2.5 text-white/45`}
              onClick={() => setMine(removeLayout(templateId, view, l.name))}
            >
              &times;
            </button>
          </span>
        ))}
        {naming ? null : (
          <button type="button" className={pill} onClick={() => setNaming(true)}>
            {t("runner.photo.saveThis")}
          </button>
        )}
      </div>
      {naming ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={name}
            maxLength={40}
            placeholder={t("runner.photo.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setNaming(false);
            }}
            className="h-8 w-[220px] rounded-[16px] border border-white/15 bg-black/20 px-3 text-[12.5px] text-white outline-none focus:border-white/30"
          />
          <button type="button" className={pill} disabled={!name.trim()} onClick={save}>
            {t("common.save")}
          </button>
          <button type="button" className={pill} onClick={() => setNaming(false)}>
            {t("common.cancel")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The small pill every control here wears. Radius is half the height, never 999. */
const pill =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[16px] border border-white/10 bg-white/[0.05] px-3 text-[12.5px] text-white/[0.78] transition-colors hover:bg-white/10 disabled:opacity-40";

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
  const t = useT();
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

  /**
   * A photo arrives by being dropped on this screen or pasted into it, as well
   * as through the file dialog. Nothing in this product could take a dropped
   * file before — five upload buttons, five system dialogs — and pasting is
   * what anybody does with a screenshot they have just taken.
   *
   * Closed while a spot is sold or the other mode is in use, because the photo
   * under a sold square does not change and the server refuses a mix: an
   * upload that can only be refused should not be invited.
   */
  const takes = busy === null && !conflict && frozen.size === 0;
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!takes) return;
    const onPaste = (e: ClipboardEvent) => {
      // Not while they are typing a name into something: that paste is theirs.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const file = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .find((f): f is File => !!f);
      if (!file) return;
      e.preventDefault();
      upload(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // `upload` closes over what it needs and is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takes, view, space.id]);

  const dropProps = takes
    ? {
        onDragOver: (e: DragEvent<HTMLElement>) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: (e: DragEvent<HTMLElement>) => {
          // Only when the pointer has really left, not on every child crossed.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOver(false);
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          setOver(false);
          const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
          if (file) upload(file);
          else if (e.dataTransfer.files.length > 0) setNotice(t("runner.photo.err.type"));
        },
      }
    : {};

  /** The line the whole editor wears while something is being dragged over it. */
  const dropVeil = over ? (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border-2 border-dashed border-[#5B7CFF] bg-[rgba(8,12,24,0.72)]">
      <p className="text-[14.5px] font-bold text-white">{t("runner.photo.dropHere")}</p>
    </div>
  ) : null;

  const switcher = <SideSwitcher space={space} view={view} />;

  if (!photo) {
    const side = viewLabel ? viewLabel.toLowerCase() : t("runner.photo.side");
    return (
      <div className="flex flex-col gap-3">
        {switcher}
        <section
          {...dropProps}
          className={`${glass} relative flex h-[calc(var(--app-vh,100dvh)-260px)] min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center`}
        >
        <div className="flex max-w-[440px] flex-col gap-2">
          <h3 className="text-[15.5px] font-strong text-white">
            {view ? t("runner.photo.sideTitle", { side }) : t("runner.photo.showReal")}
          </h3>
          <p className="text-[14.5px] text-white/[0.62]">
            {view
              ? t("runner.photo.sideBody", {
                  side,
                  product: (space.template?.name ?? t("runner.photo.product")).toLowerCase(),
                  count: positions.length,
                })
              : t("runner.photo.wholeBody")}
          </p>
        </div>
          {conflict ? (
            <p className="max-w-[440px] text-[14.5px] text-amber">
              {view ? t("runner.photo.conflictSide") : t("runner.photo.conflictWhole")}
            </p>
          ) : (
            <button type="button" className={btnSmall} disabled={busy !== null} onClick={() => input.current?.click()}>
              {busy === "upload" ? t("runner.uploading") : t("runner.photo.choose")}
            </button>
          )}
          <p className="text-[12.5px] text-white/55">
            {conflict ? t("runner.photo.formats") : t("runner.photo.formatsDrop")}
          </p>
          {chooser}
          {notice ? <Notice>{notice}</Notice> : null}
          {dropVeil}
        </section>
      </div>
    );
  }

  const selectedPosition = positions.find((p) => p.id === selected) ?? null;

  return (
    <div {...dropProps} className="relative flex flex-col gap-3">
      {switcher}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[12.5px] text-white/55">
          {trouble.size > 0
            ? t("runner.photo.fixAmber")
            : dirty
              ? t("runner.photo.unsaved")
              : placed && photo.ready
                ? t("runner.photo.live")
                : t("runner.photo.placeEvery")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSmallSecondary}
            disabled={busy !== null || frozen.size > 0}
            title={frozen.size > 0 ? t("runner.photo.soldHint") : undefined}
            onClick={() => input.current?.click()}
          >
            {busy === "upload" ? t("runner.uploading") : t("runner.photo.replace")}
          </button>
          {confirmRemove ? (
            <button type="button" className={btnSmallSecondary} disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? t("runner.removing") : t("runner.photo.removeAll")}
            </button>
          ) : (
            <button
              type="button"
              className={btnSmallSecondary}
              disabled={busy !== null || frozen.size > 0}
              onClick={() => setConfirmRemove(true)}
            >
              {t("runner.photo.remove")}
            </button>
          )}
          <button
            type="button"
            className={btnSmall}
            disabled={busy !== null || trouble.size > 0 || (!dirty && placed)}
            onClick={save}
          >
            {busy === "save" ? t("common.saving") : t("common.save")}
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

      <Arranger
        templateId={space.template?.id ?? null}
        view={view}
        positions={positions}
        frozen={frozen}
        rects={rects}
        onApply={setRects}
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
              {frozen.has(p.id) ? <span className="text-amber">{t("runner.spots.sold")}</span> : null}
            </button>
          );
        })}
      </div>
      {selectedPosition && trouble.has(selectedPosition.id) ? (
        <p className="text-[12.5px] text-amber">
          {t("runner.photo.trouble", { label: selectedPosition.label, kind: trouble.get(selectedPosition.id) })}
        </p>
      ) : null}
      {dropVeil}
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
  trouble: Map<string, Trouble>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, r: PhotoRect) => void;
}) {
  const t = useT();
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
                aria-label={locked ? t("runner.photo.squareSoldAria", { label: p.label }) : p.label}
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
                  {locked ? t("runner.photo.squareSold", { label: p.label }) : p.label}
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
