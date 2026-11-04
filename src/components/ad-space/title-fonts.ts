import { Bricolage_Grotesque, Fraunces, Playfair_Display } from "next/font/google";
import type { CSSProperties } from "react";

import type { TitleStyle } from "@/lib/ad-space/studio";

/**
 * The four title styles a creator picks in the studio. Classic is the site's
 * own display face and loads nothing; each of the other three is one weight
 * of one family, self-hosted by next/font.
 *
 * `preload: false`: every listing imports this file, and most wear classic.
 * The @font-face rules ship with the page's CSS, but a browser only fetches a
 * face once an element actually uses it, so a classic page downloads none.
 */
const eclectic = Bricolage_Grotesque({ subsets: ["latin"], weight: "500", display: "swap", preload: false });
const fancy = Playfair_Display({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", preload: false });
const literary = Fraunces({ subsets: ["latin"], weight: "300", display: "swap", preload: false });

/**
 * The inline style that wears a title style, or undefined for classic. Inline
 * so it wins over the heading's `font-display` / `font-light` utilities
 * without depending on stylesheet order.
 */
export function titleFontStyle(style: TitleStyle): CSSProperties | undefined {
  switch (style) {
    case "eclectic":
      return { ...eclectic.style, letterSpacing: "-0.02em" };
    case "fancy":
      return { ...fancy.style, letterSpacing: "-0.01em" };
    case "literary":
      return { ...literary.style, letterSpacing: "-0.015em" };
    default:
      return undefined;
  }
}
