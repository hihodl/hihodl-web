/**
 * The round flag, drawn the way the app's <Flag> draws it
 * (hihodl-wallet src/ui/Flag.tsx): the 3:2 flag from country-flag-icons at
 * 1.5 times the circle's width, centred, cropped by the circle, with a
 * hairline. The SVGs in public/flags are copied from that package.
 */
export type FlagCode = "US" | "EU" | "GB" | "MX" | "BR" | "CO";

export function Flag({ code, size = 24, className = "" }: { code: FlagCode; size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/10 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/flags/${code}.svg`} alt="" width={size * 1.5} height={size} className="max-w-none" style={{ width: size * 1.5, height: size }} />
    </span>
  );
}
