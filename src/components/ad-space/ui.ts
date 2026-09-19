/**
 * Shared classes for the Ad Space page.
 *
 * Every pill and button has a FIXED height and a radius of exactly half of it
 * (h-12 / 24px, h-10 / 20px, h-6 / 12px), and never wraps. A 9999px radius on
 * something whose height can change turns it into a lozenge when it wraps.
 *
 * No red anywhere: attention is amber, done is the success green, everything
 * else is the neutral text scale.
 */

export const btnPrimary =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[24px] bg-amber px-6 text-small font-medium text-text-on-amber transition-colors duration-180 hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber";

export const btnSecondary =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[24px] border border-[color:var(--color-hairline-strong)] px-6 text-small font-medium text-text transition-colors duration-180 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

export const btnSmall =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] bg-amber px-5 text-small font-medium text-text-on-amber transition-colors duration-180 hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber";

export const btnSmallSecondary =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] border border-[color:var(--color-hairline-strong)] px-5 text-small font-medium text-text transition-colors duration-180 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";

const pillBase =
  "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] border px-2.5 text-tiny";

export const pill = {
  neutral: `${pillBase} border-[color:var(--color-hairline-strong)] text-text-muted`,
  open: `${pillBase} border-moonlight/40 bg-moonlight/10 text-text`,
  held: `${pillBase} border-dashed border-amber/60 bg-amber/10 text-amber`,
  // Finished, so quiet: one amber in the palette, and filled amber is only ever the action.
  sold: `${pillBase} border-[color:var(--color-hairline-strong)] bg-white/[0.06] text-text-muted`,
  attention: `${pillBase} border-amber/40 bg-amber/10 text-amber`,
  done: `${pillBase} border-success/40 bg-success/10 text-success`,
} as const;

export const card =
  "rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03]";

export const eyebrow = "text-tiny uppercase tracking-wider";

export const input =
  "w-full rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.04] px-4 py-3 text-body text-text placeholder:text-text-faint outline-none transition-colors duration-180 focus:border-amber/60";

/** Zone colours on the board, as raw values: SVG attributes cannot take classes for everything. */
export const ZONE = {
  openStroke: "#5B7CFF",
  openFill: "rgba(91,124,255,0.10)",
  openFillHover: "rgba(91,124,255,0.24)",
  heldStroke: "#FFB703",
  heldFill: "rgba(255,183,3,0.14)",
  // A sold zone is done, not an action: a quiet light plate, never the CTA amber.
  soldFill: "#C9D3DC",
  soldInk: "#0A141E",
  plate: "#FFFFFF",
  idleStroke: "rgba(255,255,255,0.18)",
  outline: "rgba(244,246,250,0.55)",
} as const;
