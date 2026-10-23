import type { ReactNode } from "react";
import { DownloadLink } from "@/components/site/DownloadLink";

/**
 * The homepage speaks the app's palette, not the old site's steel blue:
 * hihodl-wallet src/theme/colors.ts and gradients.ts (release/ios-build-13).
 * When the app changes a colour, it changes here.
 */
export const APP = {
  /** navBg: the ground under every screen. */
  ground: "#0D1820",
  /** sheetBase: the app's bottom sheet. */
  sheet: "#1B2D36",
  /** Main account: ACCOUNT_PRIMARY.Main, CARD_GRADS.Main. */
  cyan: "#00C2FF",
  cyanGlow: "#36E0FF",
  /** Savings account: CARD_GRADS.Savings. */
  silver: "#D7DCE4",
  silverDeep: "#AEB6C2",
  /** brand.yellow, the primary action. */
  amber: "#FFB703",
  /** brand.almostBlack, ink on amber. */
  ink: "#0F0F1A",
  /** textOnBlueMuted and textSubtle: secondary text, 4:1 or better on the ground. */
  muted: "#C8D0D9",
  subtle: "#9FB7C2",
} as const;

/** The app's row on a sheet: white at 6% with a hairline. */
export const GLASS = "rounded-[24px] border border-white/10 bg-white/[0.06]";

/** Glass laid on a photo: dark tint, blur, solid fallback where blur is missing. */
export const PHOTO_GLASS =
  "border border-white/15 bg-[#0D1820]/85 supports-[backdrop-filter]:bg-[#0D1820]/45 supports-[backdrop-filter]:backdrop-blur-[20px]";

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 px-4 py-20 md:px-8 md:py-28 ${className}`}>
      <div className="mx-auto max-w-[1120px]">{children}</div>
    </section>
  );
}

/** A section title: centred and heavy, with one or two words in bold or bold italic. */
export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-center text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[52px] [&_b]:font-black [&_em]:font-black [&_em]:italic ${className}`}
    >
      {children}
    </h2>
  );
}

/** The one primary action, in the app's amber. */
export function AmberCta({ children = "Get HOLD", wide = false }: { children?: ReactNode; wide?: boolean }) {
  return (
    <DownloadLink
      className={`inline-flex h-14 items-center justify-center rounded-full bg-[#FFB703] px-9 text-[17px] font-extrabold text-[#0F0F1A] transition-transform duration-180 ease-out-soft hover:scale-[1.02] active:scale-[0.98] ${
        wide ? "w-full" : ""
      }`}
    >
      {children}
    </DownloadLink>
  );
}
