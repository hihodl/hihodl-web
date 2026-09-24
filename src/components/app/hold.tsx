"use client";

/**
 * The app's parts, on the web.
 *
 * Every screen the web shares with HOLD's app (Account, Settings, the Spaces
 * creator side) is built from these, and these are the app's own components
 * read off its source, so a screen here is the screen on the phone:
 *
 *   holdCard        src/ui/GlassSurface   radius 28, a 6% white wash, the lit
 *                                         top edge (0.16) over dim sides (0.07)
 *                                         and a darker bottom (0.04)
 *   SectionTitle    src/ui/SectionTitle   13/600 in textSubtle, 16 above, 8 below
 *   MenuRow         src/ui/MenuRow        icon 18, label 14/700, sub 12,
 *                                         value 12 on the right, 18px padding,
 *                                         no dividers, chevron only when asked
 *   SettingsRow     src/ui/Row            the Settings screen's row: 20px tall
 *                                         padding, title 16/600 and a 13px sub
 *   Switch          RN Switch             amber track on, 12% white off
 *   BackHeader      GlassHeader           a chevron back and the title centred
 *   ctaPrimary …    TravelCta / CTAButton 52 high, radius half of it
 *
 * Colours are src/theme/colors.ts: text #FFFFFF, textMuted #CFE3EC,
 * textSubtle #9FB7C2, brand yellow #FFB703 on ink #0F0F1A.
 *
 * Weights are the app's: 700 for row labels and headers, 800 on the CTA
 * plates, 600 (`font-strong`) where the app says 600. The one web-only
 * difference is that a row that is pressed on the phone is hovered here.
 */

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/lib/app/i18n/react";

import { useHeaderSlot } from "./header-slot";
import { Ion, type IonName } from "./ion";

/* ── Colours (src/theme/colors.ts) ───────────────────────────────── */

export const C = {
  text: "#FFFFFF",
  textMuted: "#CFE3EC",
  textSubtle: "#9FB7C2",
  primary: "#FFB703",
  primaryOn: "#0F0F1A",
  /** Spaces' select fill (travelPalette.select) and its ink. */
  select: "#F1F5F9",
  selectText: "#0A1420",
} as const;

/* ── The card: GlassSurface ──────────────────────────────────────── */

/** GlassSurface: radius 28, 6% white wash, lit top edge. */
export const holdCard =
  "relative overflow-hidden rounded-[28px] border border-t-white/[0.16] border-x-white/[0.07] border-b-white/[0.04] bg-white/[0.06] backdrop-blur-xl";

export function HoldCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${holdCard} ${className}`}>{children}</section>;
}

/* ── SectionTitle ────────────────────────────────────────────────── */

export function SectionTitle({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return <h2 className={`${first ? "mt-0" : "mt-4"} mb-2 text-[13px] font-strong leading-[18px] text-[#9FB7C2]`}>{children}</h2>;
}

/* ── MenuRow ─────────────────────────────────────────────────────── */

const rowBase = "flex w-full min-w-0 items-center gap-3 px-[18px] py-[18px] text-left transition-colors hover:bg-white/[0.03] disabled:opacity-45";

export interface MenuRowProps {
  icon: IonName;
  label: string;
  sub?: ReactNode;
  value?: ReactNode;
  /** Pending-action count: a quiet glass round badge. */
  badge?: number;
  right?: ReactNode;
  chevron?: boolean;
  href?: string;
  /** Opens in a new tab (a mailto stays in this one). */
  external?: boolean;
  /** A full page load, for pages that set their own CSP (the Wallet, /welcome). */
  reload?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** An amber label for a row that needs the person (never red). */
  attention?: boolean;
}

/** src/ui/MenuRow: one trailing element wins, right > badge > value > chevron. */
export function MenuRow({ icon, label, sub, value, badge, right, chevron, href, external, reload, onClick, disabled, attention }: MenuRowProps) {
  const t = useT();
  const trailing = right ? (
    right
  ) : badge && badge > 0 ? (
    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] border border-white/[0.18] bg-white/10 px-[7px] text-[12px] font-bold text-white" aria-label={t("shell.hold.badgePending", { count: badge })}>
      {badge}
    </span>
  ) : value !== undefined && value !== null ? (
    <span className="max-w-[180px] shrink-0 truncate text-right text-[12px] leading-4 text-[#9FB7C2]">{value}</span>
  ) : chevron ? (
    <Ion name="chevron-forward" size={16} className="shrink-0 text-white/35" />
  ) : null;
  const ink = attention ? "text-amber" : "text-white";
  const inner = (
    <>
      <Ion name={icon} size={18} className={`shrink-0 ${ink} ${sub ? "self-start mt-[2px]" : ""}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-bold leading-5 ${ink}`}>{label}</span>
        {sub ? <span className="mt-0.5 block truncate text-[12px] leading-4 text-[#9FB7C2]">{sub}</span> : null}
      </span>
      {trailing}
    </>
  );
  if (href) {
    return external || reload ? (
      <a href={href} target={external && !href.startsWith("mailto:") ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={rowBase}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={rowBase}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={rowBase}>
      {inner}
    </button>
  );
}

/* ── Settings' Row (src/ui/Row with a labelNode) ─────────────────── */

export function SettingsRow({
  icon,
  title,
  sub,
  value,
  right,
  chevron,
  href,
  onClick,
  disabled,
}: {
  icon: IonName;
  title: string;
  sub?: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = "flex w-full min-w-0 items-center gap-3 px-3 py-5 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-45";
  const inner = (
    <>
      <Ion name={icon} size={18} className="mr-[-2px] shrink-0 text-white" />
      <span className="min-w-0 flex-1 pr-3">
        <span className={`block truncate ${sub ? "text-[16px] leading-[21px]" : "text-[14px] leading-5"} font-strong tracking-[0.1px] text-white`}>{title}</span>
        {sub ? <span className="mt-0.5 block text-[13px] leading-[17px] text-white/[0.62]">{sub}</span> : null}
      </span>
      {value !== undefined && value !== null ? <span className="max-w-[45%] shrink-0 truncate text-right text-[12px] text-[#9FB7C2]">{value}</span> : null}
      {right ? <span className="shrink-0">{right}</span> : null}
      {chevron ? <Ion name="chevron-forward" size={16} className="ml-1.5 shrink-0 text-[#9FB7C2]" /> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/* ── Switch ──────────────────────────────────────────────────────── */

/** React Native's Switch as the app draws it: amber track on, 12% white off, white thumb. Colour only. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-[15.5px] transition-colors duration-200 disabled:opacity-45 ${checked ? "bg-amber" : "bg-white/[0.12]"}`}
    >
      <span className={`absolute left-[2px] h-[27px] w-[27px] rounded-[13.5px] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform duration-200 ${checked ? "translate-x-[20px]" : "translate-x-0"}`} />
    </button>
  );
}

/* ── The header of a screen opened from another ─────────────────── */

/**
 * GlassHeader / TravelHeader: a chevron back on the left, the title (17/700)
 * centred on the screen with its subtitle (12/500) under it.
 *
 * Inside the product shell it is drawn in the top bar instead of the page
 * (see header-slot), so the section title and this one are never both on
 * screen.
 */
export function BackHeader({
  title,
  subtitle,
  onBack,
  backHref,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backHref?: string;
  right?: ReactNode;
}) {
  const t = useT();
  const slot = useHeaderSlot();
  const claim = slot?.claim;
  useEffect(() => (claim ? claim() : undefined), [claim]);

  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10";
  const back = backHref ? (
    <Link href={backHref} aria-label={t("common.back")} className={btn}>
      <Ion name="chevron-back" size={22} />
    </Link>
  ) : onBack ? (
    <button type="button" onClick={onBack} aria-label={t("common.back")} className={btn}>
      <Ion name="chevron-back" size={22} />
    </button>
  ) : null;
  const words = (
    <>
      <h1 className="truncate text-[17px] font-bold tracking-[-0.3px] text-white">{title}</h1>
      {subtitle ? <p className="mt-0.5 truncate text-[12px] font-medium tracking-[-0.1px] text-white/55">{subtitle}</p> : null}
    </>
  );

  if (slot) {
    return (
      <>
        {slot.title
          ? createPortal(
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {back}
                <div className={`min-w-0 flex-1 ${back ? "" : "pl-1"}`}>{words}</div>
              </div>,
              slot.title,
            )
          : null}
        {right && slot.right ? createPortal(right, slot.right) : null}
      </>
    );
  }

  return (
    <header className="relative mb-2 flex h-11 items-center">
      {back ?? <span className="w-9" />}
      <div className="pointer-events-none absolute inset-x-14 text-center">{words}</div>
      <span className="ml-auto flex min-w-9 items-center justify-end">{right}</span>
    </header>
  );
}

/** A screen opened from a list: one column, the app's width, in the middle. */
export function Column({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto flex w-full ${wide ? "max-w-[720px]" : "max-w-[560px]"} flex-col pb-6`}>{children}</div>;
}

/* ── Buttons: TravelCta and CTAButton ────────────────────────────── */

const ctaBase =
  "inline-flex h-[52px] w-full items-center justify-center gap-[9px] rounded-[26px] px-6 text-[16px] tracking-[-0.2px] transition-opacity hover:opacity-90 disabled:cursor-not-allowed";

/** The one amber plate: the tap that commits (TravelCta "commit", CTAButton primary). */
export const ctaCommit = `${ctaBase} bg-amber font-extrabold text-[#0F0F1A] shadow-[0_10px_18px_rgba(0,0,0,0.3)] disabled:bg-white/[0.07] disabled:text-white/60 disabled:shadow-none`;
/** TravelCta "primary": the white plate that moves on without taking money. */
export const ctaPrimary = `${ctaBase} bg-[#F1F5F9] font-extrabold text-[#0A1420] shadow-[0_10px_18px_rgba(0,0,0,0.3)] disabled:bg-white/[0.07] disabled:text-white/60 disabled:shadow-none`;
/** TravelCta "secondary": glass, white ink. */
export const ctaSecondary = `${ctaBase} border border-white/[0.22] bg-white/10 font-bold text-white disabled:opacity-50`;

/** A smaller glass button, for an action inside a card (the app's 44-high CTAButton md). */
export const btnGlass =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-white/[0.22] bg-white/10 px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50";

/* ── Notice (the app's amber tint; never red) ────────────────────── */

export function Notice({ children, icon = "information-circle-outline", tone = "caution" }: { children: ReactNode; icon?: IonName; tone?: "caution" | "calm" | "good" }) {
  const ink = tone === "caution" ? "text-amber" : tone === "good" ? "text-[#2FBE8A]" : "text-white/[0.62]";
  const bg = tone === "caution" ? "bg-amber/[0.12]" : tone === "good" ? "bg-[rgba(14,155,104,0.14)]" : "bg-white/[0.04]";
  return (
    <p role="status" className={`flex gap-2 rounded-[12px] px-3 py-2.5 ${bg}`}>
      <Ion name={icon} size={15} className={`mt-px shrink-0 ${ink}`} />
      <span className={`flex-1 text-[13px] font-strong leading-[18px] ${ink}`}>{children}</span>
    </p>
  );
}
