import type { ReactNode } from "react";
import { DownloadLink } from "@/components/site/DownloadLink";

/**
 * A light page, the way Persona sells: white and very light grey grounds,
 * near-black type, and the sunny photos carrying the feeling. The app's own
 * colours (hihodl-wallet src/theme/colors.ts and gradients.ts on
 * release/ios-build-13) are the accents: the cyan Main card, the silver
 * Savings card and the amber action.
 */
export const APP = {
  cyan: "#00C2FF",
  cyanGlow: "#36E0FF",
  silver: "#D7DCE4",
  silverDeep: "#AEB6C2",
  amber: "#FFB703",
  /** brand.almostBlack: the ink, on white and on amber. */
  ink: "#0F0F1A",
  /** navBg: the dark ground, used once, for the closing banner. */
  navy: "#0D1820",
} as const;

/** Body copy on white (9:1) and on the soft grey (8:1). */
export const BODY = "text-[#3F4A55]";
/** Secondary copy: 4.8:1 on white, 4.5:1 on the soft grey. */
export const SUBTLE = "text-[#5F6975]";
/** The soft grey ground of a card or an alternate section. */
export const SOFT = "bg-[#F4F5F7]";

export function Section({
  id,
  children,
  className = "",
  soft = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  soft?: boolean;
}) {
  return (
    <section id={id} className={`scroll-mt-16 border-t border-black/[0.08] px-4 py-20 md:px-8 md:py-28 ${soft ? SOFT : "bg-white"} ${className}`}>
      <div className="mx-auto max-w-[1120px]">{children}</div>
    </section>
  );
}

/** A section title: centred, medium weight, one word set in italic. */
export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-center text-[36px] font-medium leading-[1.06] tracking-[-0.035em] text-[#0F0F1A] md:text-[56px] [&_b]:font-medium [&_em]:font-medium [&_em]:italic ${className}`}
    >
      {children}
    </h2>
  );
}

/** The one primary action, in the app's amber. */
export function AmberCta({ children = "Get HOLD", wide = false }: { children?: ReactNode; wide?: boolean }) {
  return (
    <DownloadLink
      className={`inline-flex h-14 items-center justify-center rounded-full bg-[#FFB703] px-9 text-[17px] font-semibold text-[#0F0F1A] transition-transform duration-180 ease-out-soft hover:scale-[1.02] active:scale-[0.98] ${
        wide ? "w-full" : ""
      }`}
    >
      {children}
    </DownloadLink>
  );
}

/**
 * Glass laid on a photo, the KAST way: a neutral dark tint with a strong
 * blur, so it takes the photo's own colour instead of painting it blue.
 * Solid where blur is missing.
 */
export const PHOTO_GLASS =
  "border border-white/20 bg-black/55 supports-[backdrop-filter]:bg-black/25 supports-[backdrop-filter]:backdrop-blur-[24px] supports-[backdrop-filter]:backdrop-saturate-[1.6]";
