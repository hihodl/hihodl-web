"use client";

/**
 * The pieces every Stays screen is built from — the app's `TravelShell.tsx`,
 * `HotelPhoto.tsx` and `PointsPill.tsx`, on the web.
 *
 * Three of these carry a decision, not just a style:
 *
 *   Photo    a hotel picture has TWO urls, and the resized one does fail. The
 *            fallback ladder is the component's whole job.
 *   Cta      one button shape, five states, and exactly one of them is amber.
 *   Empty    "nothing matched" and "we couldn't ask" are the same component:
 *            only the words and the presence of a retry differ.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Ion, type IonName } from "../ion";

import { P, R, CARD, pointsEarned } from "./look";
import type { Image } from "@/lib/app/stays";

/* ── The ground ───────────────────────────────────────────────────── */

/**
 * The travel screen's ground: navy, then the four gradients the app's
 * `SplashBackground` stacks over it.
 *
 * It is not flat and that is deliberate — the amber wash at the top right and
 * the blue one at the bottom left are what stop a screen of dark glass cards
 * reading as a spreadsheet. Drawn as one absolutely positioned layer so the
 * content above it needs to know nothing about it.
 */
export function Ground({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate flex min-w-0 flex-1 flex-col ${className}`} style={{ background: P.bg }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "linear-gradient(to bottom, #1a5276 0%, #0f3555 42%, #0a1929 75%)",
            "linear-gradient(196deg, rgba(255,183,3,0.13) 0%, rgba(255,183,3,0.04) 30%, transparent 62%)",
            "linear-gradient(107deg, rgba(142,202,230,0.09) 0%, rgba(142,202,230,0.03) 28%, transparent 60%)",
            "linear-gradient(295deg, rgba(26,82,118,0.15) 0%, transparent 55%)",
          ].join(","),
        }}
      />
      {children}
    </div>
  );
}

/* ── A photograph ─────────────────────────────────────────────────── */

/**
 * A hotel picture, with its fallback ladder.
 *
 * The server sends two urls: `url` is a CDN resize of the supplier's original
 * (about 190 KB) and `origin` is that original (up to 571 KB at 3000×2000).
 * The resize is a third-party rewrite and it does 404 — which is the whole
 * reason `origin` is sent. So: try the small one, fall back to the big one
 * once, and if both are dead draw the bed rather than a grey hole.
 */
export function Photo({
  image,
  alt,
  className = "",
  iconSize = 22,
  sizes,
  priority,
}: {
  image: Image | null;
  alt: string;
  className?: string;
  /** The bed in the fallback. Each call site sizes it to its own box. */
  iconSize?: number;
  sizes?: string;
  priority?: boolean;
}) {
  // `step` is the rung of the ladder: 0 the resize, 1 the original, 2 the bed.
  const [step, setStep] = useState(0);
  const src = step === 0 ? image?.url : step === 1 ? image?.origin : null;

  // A new picture in the same slot (a rail scrolling, a gallery paging) starts
  // at the top of the ladder again — otherwise one dead resize condemns every
  // photograph that reuses the element.
  useEffect(() => setStep(0), [image?.url]);

  if (!image || !src) {
    return (
      <span
        className={`flex items-center justify-center ${className}`}
        style={{ background: "rgba(255,255,255,0.05)", color: P.textFaint }}
        aria-hidden
      >
        <Ion name="bed-outline" size={iconSize} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the supplier's CDN is not in next.config's image domains, and adding a third party there is a bigger decision than this component.
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setStep((s) => s + 1)}
      className={`h-full w-full object-cover ${className}`}
      style={{ transition: "opacity 160ms" }}
    />
  );
}

/* ── The one button ───────────────────────────────────────────────── */

export type CtaVariant = "primary" | "commit" | "secondary";

/**
 * The button, in the app's five states.
 *
 * `commit` is the amber fill and it is spent ONCE per route, on the control
 * that charges. Everything that merely advances is `primary` — near-white on
 * navy, which reads as forward without claiming to be final.
 *
 * `working` beats `disabled`: a button that is busy must not also look dead,
 * or the person taps it again. And the LABEL does not change while it spins —
 * a bar that reflows mid-payment is how somebody moves their thumb onto a
 * control they did not mean to press.
 */
export function Cta({
  label,
  onClick,
  variant = "primary",
  working = false,
  disabled = false,
  icon,
  type = "button",
  className = "",
}: {
  label: string;
  onClick?: () => void;
  variant?: CtaVariant;
  working?: boolean;
  disabled?: boolean;
  icon?: IonName;
  type?: "button" | "submit";
  className?: string;
}) {
  const dead = disabled && !working;
  const glass = variant === "secondary" || working;

  const fill = dead
    ? "rgba(255,255,255,0.07)"
    : glass
      ? "rgba(255,255,255,0.10)"
      : variant === "commit"
        ? P.ctaBg
        : P.chipBg;
  const ink = working ? P.text : dead ? P.textDim : variant === "secondary" ? P.text : variant === "commit" ? P.ctaText : P.chipText;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={dead || working}
      className={`flex h-[52px] items-center justify-center gap-[9px] rounded-[26px] px-5 text-[16px] tracking-[-0.2px] transition-opacity active:opacity-85 disabled:cursor-default ${
        glass || dead ? "font-bold" : "font-extrabold"
      } ${className}`}
      style={{
        background: fill,
        color: ink,
        border: glass ? `0.5px solid rgba(255,255,255,0.22)` : "none",
        boxShadow: glass || dead ? "none" : "0 10px 18px rgba(0,0,0,0.30)",
      }}
    >
      {working ? <Spinner size={16} color={ink} /> : null}
      <span className="truncate">{label}</span>
      {icon && !working ? <Ion name={icon} size={16} /> : null}
    </button>
  );
}

/** The app's `ActivityIndicator`, small. */
export function Spinner({ size = 16, color = P.textDim }: { size?: number; color?: string }) {
  return (
    <span
      className="inline-block shrink-0 animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        // A ring drawn at 2px on a 16px box; the transparent quarter is the motion.
      }}
      aria-hidden
    />
  );
}

/* ── Nothing here ─────────────────────────────────────────────────── */

/**
 * The empty state AND the error state.
 *
 * One component, because they are the same shape and differ only in what they
 * say and whether there is anything to try again. Two components drift.
 */
export function Empty({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IonName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-[10px] px-10 pt-[70px] text-center">
      <span
        className="mb-1 flex h-14 w-14 items-center justify-center rounded-[28px]"
        style={{ background: P.card, border: `0.5px solid ${P.cardBorder}`, color: P.textDim }}
        aria-hidden
      >
        <Ion name={icon} size={24} />
      </span>
      <p className="text-[17px] font-bold tracking-[-0.3px]" style={{ color: P.text }}>
        {title}
      </p>
      {body ? (
        <p className="max-w-[340px] text-[14px] leading-[20px]" style={{ color: P.textMuted }}>
          {body}
        </p>
      ) : null}
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-[999px] px-[18px] py-[11px] text-[14px] font-semibold tracking-[-0.1px] transition-opacity active:opacity-85"
          style={{ background: "rgba(255,255,255,0.10)", border: `0.5px solid rgba(255,255,255,0.22)`, color: P.text }}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

/* ── Points ───────────────────────────────────────────────────────── */

const PILL_SIZE = {
  sm: { padY: 5, padX: 9, font: 12, icon: 13 },
  md: { padY: 7, padX: 11, font: 13.5, icon: 15 },
  lg: { padY: 9, padX: 13, font: 15, icon: 17 },
} as const;

/**
 * "+4,200 pts".
 *
 * The leading plus is load-bearing: without it, "4,200 pts" sitting next to a
 * price reads as a price IN points. Nothing at all when the stay earns
 * nothing — a zero here is a promise of no promise.
 */
export function PointsPill({ points, size = "sm" }: { points: number; size?: keyof typeof PILL_SIZE }) {
  if (points <= 0) return null;
  const s = PILL_SIZE[size];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[5px] self-start rounded-[999px] whitespace-nowrap font-bold tracking-[-0.2px]"
      style={{
        padding: `${s.padY}px ${s.padX}px`,
        fontSize: s.font,
        background: "rgba(255,183,3,0.10)",
        border: `0.5px solid ${P.cautionBorder}`,
        color: P.caution,
      }}
    >
      <Ion name="star" size={s.icon} />
      {`+${pointsEarned(points)}`}
    </span>
  );
}

/** The full sentence, for a screen with room: what you get, and when. */
export function PointsStatement({ points, credited }: { points: number; credited: boolean }) {
  if (points <= 0) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-[16px] p-[14px]"
      style={{ background: "rgba(255,183,3,0.10)", border: `0.5px solid ${P.cautionBorder}` }}
    >
      <span className="flex w-5 shrink-0 items-center justify-center" style={{ color: P.caution }} aria-hidden>
        <Ion name={credited ? "checkmark-circle" : "star"} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.2px]" style={{ color: P.text }}>
          {credited ? "You got " : "You get "}
          <span className="font-extrabold" style={{ color: P.caution }}>
            {pointsEarned(points)}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] tracking-[-0.1px]" style={{ color: P.textMuted }}>
          {credited ? "In your balance" : "In your balance after check-out"}
        </p>
      </div>
    </div>
  );
}

/** "Up to 4% back in points" — the shelf's own headline. */
export function PointsHeadline({ pct }: { pct: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-[999px] px-[11px] py-1.5 text-[12.5px] font-bold tracking-[-0.1px]"
      style={{ background: "rgba(255,183,3,0.10)", border: `0.5px solid ${P.cautionBorder}`, color: P.caution }}
    >
      <Ion name="sparkles" size={13} />
      {`Up to ${pct}% back in points`}
    </span>
  );
}

/* ── Small shared shapes ──────────────────────────────────────────── */

/** The uppercase label over a block. One per section, never two deep. */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`px-1 text-[11px] font-extrabold uppercase tracking-[0.7px] ${className}`}
      style={{ color: P.textDim }}
    >
      {children}
    </p>
  );
}

/** The 0–10 guest score, in its grey box. */
export function ScorePill({ rating }: { rating: number }) {
  return (
    <span
      className="rounded-[7px] px-[7px] py-[3px] text-[11.5px] font-extrabold tabular-nums tracking-[-0.2px]"
      style={{ background: "rgba(255,255,255,0.10)", color: P.text }}
    >
      {rating.toFixed(1)}
    </span>
  );
}

/**
 * The strip that says a booking is not real.
 *
 * Amber as a TINT, never a fill: this needs attention, it does not commit.
 */
export function Banner({ icon, children }: { icon: IonName; children: ReactNode }) {
  return (
    <div
      className="flex items-center gap-[7px] rounded-[11px] px-[11px] py-2"
      style={{ background: P.cautionSoft }}
    >
      <span className="shrink-0" style={{ color: P.caution }} aria-hidden>
        <Ion name={icon} size={13} />
      </span>
      <p className="min-w-0 flex-1 text-[11.5px] font-semibold tracking-[-0.1px]" style={{ color: P.caution }}>
        {children}
      </p>
    </div>
  );
}

/** A glass card, the shape nine screens repeat. */
export function Card({
  children,
  className = "",
  hero = false,
}: {
  children: ReactNode;
  className?: string;
  /** 24 instead of 18: a card that holds a whole screen's answer. */
  hero?: boolean;
}) {
  return <div className={`${hero ? "rounded-[24px]" : "rounded-[18px]"} border-[0.5px] border-white/10 bg-white/[0.04] ${className}`}>{children}</div>;
}

export { CARD, R };
