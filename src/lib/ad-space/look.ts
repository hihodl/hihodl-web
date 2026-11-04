/**
 * How a banner looks: the gradient presets and the categories, defined once for
 * the pages and the X cards alike. Values are exactly those in
 * documentation/ad-space-events-v0.md; the app draws the same five.
 *
 * Plain strings on purpose: Satori (the X cards) takes inline styles only, so a
 * Tailwind class would be useless to half the readers of this file.
 */

import { t } from "@/lib/app/i18n";

import type { BannerGradient, EventCategory, EventSummary } from "./types";

export const GRADIENTS: Record<BannerGradient, { from: string; via: string }> = {
  steel: { from: "#2C4566", via: "#4F7090" },
  ember: { from: "#2A1F18", via: "#6B4A12" },
  night: { from: "#060B10", via: "#1F2535" },
  slate: { from: "#1F2535", via: "#3A4556" },
  sea: { from: "#0B2A33", via: "#1F5F6B" },
};

/** An unknown key (a newer backend, a typo) draws steel rather than nothing. */
export function gradientKey(key: string | null | undefined): BannerGradient {
  return key && key in GRADIENTS ? (key as BannerGradient) : "steel";
}

/** The preset itself, top to bottom, like the site's signature gradient. */
export function gradientCss(key: string | null | undefined): string {
  const g = GRADIENTS[gradientKey(key)];
  return `linear-gradient(180deg, ${g.from} 0%, ${g.via} 50%, ${g.from} 100%)`;
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * The same preset, laid over the LOWER HALF of a photo so a small card reads on
 * any picture. Clear at the middle, the preset's own colours at the bottom. The
 * caller sizes the layer (bottom 0, height 50% or more).
 */
export function gradientOverPhotoCss(key: string | null | undefined): string {
  const g = GRADIENTS[gradientKey(key)];
  return `linear-gradient(180deg, ${rgba(g.from, 0)} 0%, ${rgba(g.via, 0.55)} 45%, ${rgba(g.from, 0.94)} 100%)`;
}

/** Getters: each read is in the language on screen. */
export const CATEGORY_LABEL: Record<EventCategory, string> = {
  get crypto() { return t("board.category.crypto"); },
  get fintech() { return t("board.category.fintech"); },
  get ai() { return t("board.category.ai"); },
  get tech() { return t("board.category.tech"); },
  get robotics() { return t("board.category.robotics"); },
  get science() { return t("board.category.science"); },
  get motorsport() { return t("board.category.motorsport"); },
  get sports() { return t("board.category.sports"); },
  get travel() { return t("board.category.travel"); },
  get culture() { return t("board.category.culture"); },
  get other() { return t("board.category.other"); },
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABEL[key as EventCategory] ?? t("board.category.other");
}

export interface Banner {
  imageUrl: string | null;
  /** Laid over the photo's lower half, or drawn alone when there is no photo. */
  gradient: BannerGradient;
  /** Set only when the picture is the event's (licensed) city photo. */
  credit: string | null;
}

/**
 * What a creator's banner draws: their own image, then the event's city photo,
 * then their gradient. The creator's image wears the creator's gradient; the
 * city photo wears steel, as it does on the event page, so one event looks the
 * same everywhere it appears.
 */
export function bannerFor(
  own: { bannerUrl: string | null; bannerGradient: BannerGradient },
  event: Pick<EventSummary, "coverUrl" | "coverCredit"> | null,
): Banner {
  if (own.bannerUrl) return { imageUrl: own.bannerUrl, gradient: gradientKey(own.bannerGradient), credit: null };
  if (event?.coverUrl) return { imageUrl: event.coverUrl, gradient: "steel", credit: event.coverCredit };
  return { imageUrl: null, gradient: gradientKey(own.bannerGradient), credit: null };
}
