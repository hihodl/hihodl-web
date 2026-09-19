"use client";

/**
 * The pieces the front door is built from: sign-in, the auth callback,
 * onboarding and Account. The product shell's look (glass on the Benefits
 * ground, one amber action), with buttons of a fixed height and a radius that
 * never makes a lozenge. Selection changes a colour, never a border width.
 * Never red: anything that went wrong is an amber line that says what to do.
 */

import { useState, type ReactNode } from "react";

import { Wordmark } from "@/components/site/Wordmark";

import { glass } from "../ui";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-amber px-5 text-small font-medium text-text-on-amber transition-colors hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber";
export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-white/10 bg-white/[0.05] px-5 text-small font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";
export const btnSmallGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";
export const btnLink = "h-9 rounded-[8px] px-2 text-small text-[#9FB7C2] transition-colors hover:bg-white/10 hover:text-text disabled:opacity-50";
export const inputCls =
  "h-11 w-full min-w-0 rounded-[12px] border border-white/10 bg-white/[0.05] px-4 text-small text-text outline-none transition-colors placeholder:text-[#6B8A99] focus:border-amber/60 disabled:opacity-60";

/** HOLD, and nothing else: the door is the product's, not one module's. */
export function HoldMark({ className = "h-5 w-auto" }: { className?: string }) {
  return <Wordmark className={`${className} text-text`} />;
}

/** A centred card, the one thing on the screen. */
export function DoorCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`${glass} w-full ${wide ? "max-w-[520px]" : "max-w-[440px]"} p-6 sm:p-8`}>{children}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-small leading-relaxed text-[#9FB7C2]">{children}</p>;
}

/** An amber line. Never red. */
export function Warn({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[12px] border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
      {children}
    </p>
  );
}

/** A heading with a Back to its left, for every screen that is not a home. */
export function ScreenHeader({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {onBack ? (
          <button type="button" onClick={onBack} className="h-8 shrink-0 rounded-[8px] px-2 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text">
            ← Back
          </button>
        ) : null}
        <h2 className="truncate text-body font-medium text-text">{title}</h2>
      </div>
      {action}
    </header>
  );
}

/** A square photo with the initial when there is none, its radius a fixed fraction of its size. */
export function Avatar({
  src,
  name,
  size = 48,
  onError,
  round = false,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  /** A circle, as the app draws a person (src/ui/UserAvatar). */
  round?: boolean;
  /** A signed photo expires within the hour: the caller may read a fresh one. */
  onError?: () => void;
}) {
  const initial = (name.replace(/^@/, "").trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size, borderRadius: round ? size / 2 : Math.round(size * 0.28) };
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken !== src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} onError={() => {
          setBroken(src);
          onError?.();
        }} className="shrink-0 object-cover" />;
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.08] font-medium text-text"
      aria-hidden
    >
      <span style={{ fontSize: Math.round(size * 0.4) }}>{initial}</span>
    </span>
  );
}

/** "4Hn2…9xQe". */
export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/** Copy a value; says "Copied" for a moment. Nothing else is written to the clipboard. */
export function CopyButton({ value, label = "Copy", className = btnSmallGhost }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        // No clipboard outside a secure context: the value is on screen either way.
        const copy = navigator.clipboard?.writeText(value);
        if (!copy) return;
        void copy.then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => setCopied(false),
        );
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
