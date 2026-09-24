/**
 * Where the squares start, and the arrangements a creator can drop on them.
 *
 * WHY THIS EXISTS
 *
 * A carry-on suitcase carries eighteen spots. Placing eighteen squares on a
 * photo by hand, each at least 4% of a side and none more than 5% over
 * another, is not a task anybody finishes in a good mood — and the old seed
 * made it worse: in one-photo mode it laid the drawing's four sides out in
 * four vertical strips and squashed every square to a quarter of its width,
 * which hits the 4% floor and lands them on top of each other. The creator's
 * first sight of their own photo was a wall of amber they had to undo.
 *
 * So: arrangements. Every one of these is guaranteed to produce squares that
 * are inside the photo, at least MIN_SIDE a side, and not touching — the two
 * things the server checks. A creator picks one, then drags the few that
 * matter. The drawing's own geometry stays the default where it fits, because
 * on one side of the product it is genuinely right.
 *
 * SAVED ARRANGEMENTS TRAVEL BY ZONE, NOT BY POSITION
 *
 * A saved arrangement is keyed by `zoneKey` ("front-headline"), never by
 * position id, so the one a creator tuned for their suitcase front applies to
 * the next suitcase they list. They live in this browser (localStorage) and
 * are named by the person who made them.
 */

import { t } from "@/lib/app/i18n";

import type { PhotoRect } from "./listing";

/** The server's own floor and tolerance (services/ad-space/photo-rules.ts). */
export const MIN_SIDE = 0.04;

/** Room left around the edge of the photo, and between squares. */
const MARGIN = 0.05;
const GAP = 0.025;

export const LAYOUTS = ["grid", "band", "column", "corners"] as const;
export type LayoutKind = (typeof LAYOUTS)[number];

/** Getters, so each read is in the language on screen at that moment. */
export const LAYOUT_LABEL: Record<LayoutKind, string> = {
  get grid() {
    return t("listings.layout.grid");
  },
  get band() {
    return t("listings.layout.band");
  },
  get column() {
    return t("listings.layout.column");
  },
  get corners() {
    return t("listings.layout.corners");
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round(r: PhotoRect): PhotoRect {
  const q = (n: number) => Math.round(n * 1e5) / 1e5;
  return { x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) };
}

/**
 * `n` cells in `cols` × `rows` inside a box, each shrunk by half a gap so no
 * two ever touch. Returns fewer than `n` only if the box cannot hold them.
 */
function cells(n: number, cols: number, box: { x: number; y: number; w: number; h: number }): PhotoRect[] {
  if (n <= 0) return [];
  const c = Math.max(1, cols);
  const rows = Math.ceil(n / c);
  const cw = box.w / c;
  const ch = box.h / rows;
  const w = Math.max(MIN_SIDE, cw - GAP);
  const h = Math.max(MIN_SIDE, ch - GAP);
  const out: PhotoRect[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    out.push(
      round({
        x: clamp(box.x + col * cw + (cw - w) / 2, 0, 1 - w),
        y: clamp(box.y + row * ch + (ch - h) / 2, 0, 1 - h),
        w,
        h,
      }),
    );
  }
  return out;
}

/** The whole photo, minus its margin. */
function canvas() {
  return { x: MARGIN, y: MARGIN, w: 1 - MARGIN * 2, h: 1 - MARGIN * 2 };
}

/**
 * `n` squares in the named arrangement, in order. The caller decides which
 * spot gets which square — the order they are listed in, which is the
 * catalog's own order (headline first, then the corners).
 */
export function arrange(n: number, kind: LayoutKind): PhotoRect[] {
  if (n <= 0) return [];
  const box = canvas();

  if (kind === "column") return cells(n, 1, box);

  if (kind === "corners" && n <= 5) {
    const s = Math.max(MIN_SIDE, 0.22);
    const far = 1 - MARGIN - s;
    const mid = 0.5 - s / 2;
    const spots: PhotoRect[] = [
      { x: MARGIN, y: MARGIN, w: s, h: s },
      { x: far, y: MARGIN, w: s, h: s },
      { x: MARGIN, y: far, w: s, h: s },
      { x: far, y: far, w: s, h: s },
      { x: mid, y: mid, w: s, h: s },
    ];
    // The centre one is only free of the corners on a photo with room for it.
    return spots.slice(0, n).map(round);
  }

  if (kind === "band" && n >= 2) {
    const bandH = Math.max(MIN_SIDE, Math.min(0.2, box.h / Math.max(2, Math.ceil((n - 1) / 3) + 1)));
    const head = round({ x: box.x, y: box.y, w: box.w, h: bandH });
    const rest = cells(n - 1, Math.min(n - 1, 3), {
      x: box.x,
      y: box.y + bandH + GAP,
      w: box.w,
      h: Math.max(MIN_SIDE, box.h - bandH - GAP),
    });
    return [head, ...rest];
  }

  // Even grid, and the fallback for every arrangement that does not fit.
  return cells(n, Math.ceil(Math.sqrt(n)), box);
}

/** An arrangement is offered only where it can hold this many squares apart. */
export function layoutFits(n: number, kind: LayoutKind): boolean {
  if (n <= 0) return false;
  if (kind === "corners") return n <= 5;
  if (kind === "band") return n >= 2;
  if (kind === "column") return n * (MIN_SIDE + GAP) <= 1;
  return true;
}

/* ── A creator's own arrangements, in their browser ────────────────── */

export interface SavedLayout {
  name: string;
  /** When it was saved, so the newest is offered first. */
  at: number;
  /** zoneKey → square. Keyed by zone so it fits the next listing of the same product. */
  rects: Record<string, PhotoRect>;
}

const PREFIX = "hihodl:ad-space:layout:";

/** One shelf per product and side: a front arrangement is not a left one. */
function shelf(templateId: string | null, view: string | null): string {
  return `${PREFIX}${templateId ?? "any"}:${view ?? "one"}`;
}

export function readLayouts(templateId: string | null, view: string | null): SavedLayout[] {
  try {
    const raw = window.localStorage.getItem(shelf(templateId, view));
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedLayout[];
    return Array.isArray(list) ? list.filter((l) => l && typeof l.name === "string" && l.rects).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}

/** Saving under a name that exists replaces it: the creator is correcting it, not collecting it. */
export function writeLayout(templateId: string | null, view: string | null, layout: SavedLayout): SavedLayout[] {
  const next = [layout, ...readLayouts(templateId, view).filter((l) => l.name !== layout.name)].slice(0, 12);
  try {
    window.localStorage.setItem(shelf(templateId, view), JSON.stringify(next));
  } catch {
    // A browser that refuses storage still gets the arrangement it just applied.
  }
  return next;
}

export function removeLayout(templateId: string | null, view: string | null, name: string): SavedLayout[] {
  const next = readLayouts(templateId, view).filter((l) => l.name !== name);
  try {
    window.localStorage.setItem(shelf(templateId, view), JSON.stringify(next));
  } catch {
    // Nothing to do: the list on screen is the answer either way.
  }
  return next;
}
