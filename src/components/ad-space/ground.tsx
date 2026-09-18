import type { ReactNode } from "react";

/**
 * The ground every Spaces page stands on: the same background Benefits wears
 * in the app, because Spaces IS Benefits. A sponsor who opens a creator's link
 * and later opens the app must feel they are in the same place.
 *
 * This is `SplashBackground` from hihodl-wallet (src/components/SplashBackground.tsx),
 * layer for layer, translated from four React Native LinearGradients into one
 * CSS background. The app draws them bottom to top; CSS lists them top first.
 *   base   #1a5276 → #0f3555 → #0a1929, top to 75% down
 *   amber  rgba(255,183,3) 0.13 → 0.04 → none, from the top right down-left
 *   cool   rgba(142,202,230) 0.09 → 0.03 → none, across from the left
 *   floor  rgba(26,82,118) 0.15 → none, from the bottom left up-right
 * If the app's layers change, change them here too.
 */
export const BENEFITS_GROUND = [
  "linear-gradient(67deg, rgba(26,82,118,0.15) 0%, transparent 60%)",
  "linear-gradient(111deg, rgba(142,202,230,0.09) 10%, rgba(142,202,230,0.03) 40%, transparent 70%)",
  "linear-gradient(236deg, rgba(255,183,3,0.13) 10%, rgba(255,183,3,0.04) 35%, transparent 60%)",
  "linear-gradient(180deg, #1a5276 0%, #0f3555 37.5%, #0a1929 75%, #0a1929 100%)",
].join(", ");

/**
 * The page's background, held still behind the content like a screen in the
 * app rather than stretched down a long page. A fixed layer instead of
 * `background-attachment: fixed`, which iOS Safari ignores.
 */
export function SpacesGround({ background = BENEFITS_GROUND, children }: { background?: string; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background }} aria-hidden />
      {children}
    </div>
  );
}
