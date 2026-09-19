import type { CSSProperties, ReactNode } from "react";

import { groundOf } from "@/lib/ad-space/theme";

/**
 * The ground every Spaces page stands on. The creator chooses it (see
 * src/lib/ad-space/theme.ts); nothing chosen is HOLD blue, the background
 * Benefits wears in the app, because Spaces IS Benefits.
 *
 * HOLD blue is `SplashBackground` from hihodl-wallet
 * (src/components/SplashBackground.tsx), layer for layer and point for point.
 * Expo's LinearGradient takes `start`/`end` as fractions of the view, with its
 * colours evenly spaced between them; an SVG gradient in `objectBoundingBox`
 * units stretched over the viewport is exactly that, on any screen shape. The
 * CSS-angle translation this replaces could only approximate it, and drifted
 * further from the app the wider the screen. The app draws, bottom to top:
 *   base   #1a5276 → #0f3555 → #0a1929, from (0.5, 0) to (0.5, 0.75)
 *   amber  rgba(255,183,3) 0.13 → 0.04 → none, (0.8, 0.15) to (0.2, 0.55)
 *   cool   rgba(142,202,230) 0.09 → 0.03 → none, (0.1, 0.35) to (0.9, 0.65)
 *   floor  rgba(26,82,118) 0.15 → none, (0.15, 0.7) to (0.85, 0.4)
 * If the app's layers change, change them here too.
 */
type Stop = [offset: number, color: string, opacity: number];
const LAYERS: { id: string; from: [number, number]; to: [number, number]; stops: Stop[] }[] = [
  { id: "base", from: [0.5, 0], to: [0.5, 0.75], stops: [[0, "#1a5276", 1], [0.5, "#0f3555", 1], [1, "#0a1929", 1]] },
  { id: "amber", from: [0.8, 0.15], to: [0.2, 0.55], stops: [[0, "#FFB703", 0.13], [0.5, "#FFB703", 0.04], [1, "#FFB703", 0]] },
  { id: "cool", from: [0.1, 0.35], to: [0.9, 0.65], stops: [[0, "#8ECAE6", 0.09], [0.5, "#8ECAE6", 0.03], [1, "#8ECAE6", 0]] },
  { id: "floor", from: [0.15, 0.7], to: [0.85, 0.4], stops: [[0, "#1a5276", 0.15], [1, "#1a5276", 0]] },
];

/** The same layers as CSS, for the few places that need a `background` string (the X cards). */
export const BENEFITS_GROUND = [
  "linear-gradient(67deg, rgba(26,82,118,0.15) 0%, transparent 60%)",
  "linear-gradient(111deg, rgba(142,202,230,0.09) 10%, rgba(142,202,230,0.03) 40%, transparent 70%)",
  "linear-gradient(236deg, rgba(255,183,3,0.13) 10%, rgba(255,183,3,0.04) 35%, transparent 60%)",
  "linear-gradient(180deg, #1a5276 0%, #0f3555 37.5%, #0a1929 75%, #0a1929 100%)",
].join(", ");

function HoldBlue() {
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1 1" aria-hidden>
      <defs>
        {LAYERS.map((l) => (
          <linearGradient
            key={l.id}
            id={`sp-ground-${l.id}`}
            gradientUnits="objectBoundingBox"
            x1={l.from[0]}
            y1={l.from[1]}
            x2={l.to[0]}
            y2={l.to[1]}
          >
            {l.stops.map(([o, c, a]) => (
              <stop key={o} offset={o} stopColor={c} stopOpacity={a} />
            ))}
          </linearGradient>
        ))}
      </defs>
      <rect width="1" height="1" fill="#0a1929" />
      {LAYERS.map((l) => (
        <rect key={l.id} width="1" height="1" fill={`url(#sp-ground-${l.id})`} />
      ))}
    </svg>
  );
}

/**
 * The page's background, held still behind the content like a screen in the
 * app rather than stretched down a long page. A fixed layer instead of
 * `background-attachment: fixed`, which iOS Safari ignores.
 *
 * `ground` is the stored value (hold | app | night | white | #RRGGBB, or
 * null); a light one re-inks everything inside through `data-sp-ground`.
 */
export function SpacesGround({ ground = null, children }: { ground?: string | null; children: ReactNode }) {
  const g = groundOf(ground);
  return (
    <div
      className="relative isolate flex min-h-screen flex-col text-sp-ink"
      data-sp-ground={g.light ? "light" : "dark"}
      data-sp-kind={g.kind}
      // The base colour on the wrapper too, so a page longer than the screen
      // (a full-page capture, an overscroll) never shows the site's own ground.
      style={{ ...(g.vars as CSSProperties), backgroundColor: g.base }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: g.base }} aria-hidden>
        {g.kind === "hold" ? <HoldBlue /> : null}
      </div>
      {children}
    </div>
  );
}
