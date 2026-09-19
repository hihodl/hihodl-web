/**
 * The ground a creator's public pages stand on, and the ink that goes with it.
 *
 * The creator chooses it (Spaces settings for the profile and every listing,
 * and an override per listing); the backend keeps the value
 * (server/services/ad-space/page-ground-rules.ts) and this file owns how each
 * one looks:
 *
 *   hold     HOLD blue: the app's SplashBackground, layer for layer (./ground)
 *   app      the app's own dark shell, `colors.bg` #0F0F1A (hihodl-wallet
 *            src/theme/colors.ts), flat, as behind every wallet screen
 *   night    black
 *   white    a real light theme: every --sp-* token re-inked for white
 *   #RRGGBB  any colour, with dark or light ink chosen by WCAG contrast, and
 *            amber / green / blue text dropped to plain ink where they would
 *            fall under 4.5:1 on it
 *
 * Nothing set is HOLD blue, what every page wore before.
 *
 * The pay sheets keep their own dark sheet on every ground (`.sp-dark` resets
 * the tokens inside them): money moves on the same surface everywhere, and a
 * sponsor meets it exactly as the app shows it.
 */

import type { CSSProperties } from "react";

import { contrast, inkOn, normalHex } from "./product-look";

export const PAGE_GROUND_PRESETS = ["hold", "app", "night", "white"] as const;
export type PageGroundPreset = (typeof PAGE_GROUND_PRESETS)[number];

export const PAGE_GROUND_LABEL: Record<PageGroundPreset, string> = {
  hold: "HOLD blue",
  app: "App dark",
  night: "Night black",
  white: "White",
};

/** The app's dark shell (hihodl-wallet `colors.bg`, `brand.almostBlack`). */
export const APP_DARK = "#0F0F1A";
export const NIGHT_BLACK = "#050506";

export interface Ground {
  /** What the page wears: a preset, or a custom colour. */
  kind: PageGroundPreset | "custom";
  /** The flat colour behind everything (hold draws its layers over this). */
  base: string;
  /** Light grounds are re-inked (`data-sp-ground="light"`). */
  light: boolean;
  /** Extra token overrides a custom colour needs. */
  vars: CSSProperties;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** The dark and light values of the three coloured inks, as the CSS defines them. */
const INKS = {
  dark: { amber: "#FFB703", ok: "#4ADE80", cool: "#8EA3FF" },
  light: { amber: "#8A5A00", ok: "#15803D", cool: "#3A56D4" },
} as const;

/** A stored value, read: unknown values are HOLD blue rather than a guess. */
export function groundOf(value: string | null | undefined): Ground {
  if (value === "app") return { kind: "app", base: APP_DARK, light: false, vars: {} };
  if (value === "night") return { kind: "night", base: NIGHT_BLACK, light: false, vars: {} };
  if (value === "white") return { kind: "white", base: "#FFFFFF", light: true, vars: {} };
  const hex = value ? normalHex(value) : null;
  if (value?.startsWith("#") && hex) {
    const ink = inkOn(hex);
    const light = ink !== "#F4F6FA";
    const set = light ? INKS.light : INKS.dark;
    // A coloured ink that would fall under 4.5:1 on this colour is written in plain ink instead.
    const or = (c: string) => rgb(contrast(c, hex) >= 4.5 ? c : ink);
    return {
      kind: "custom",
      base: hex,
      light,
      vars: {
        "--sp-amber-ink": or(set.amber),
        "--sp-ok-ink": or(set.ok),
        "--sp-cool-ink": or(set.cool),
      } as CSSProperties,
    };
  }
  return { kind: "hold", base: "#0A1929", light: false, vars: {} };
}
