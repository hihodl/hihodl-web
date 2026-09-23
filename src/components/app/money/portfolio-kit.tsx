"use client";

/**
 * The parts Performance, Realised gains and What you paid share — the app's
 * internal-screen language (a 34px back disc, a centred 20px title, glass
 * secondary cards) drawn once so the three screens read as one product.
 */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { Ion, type IonName } from "../ion";

/** theme/colors `invest`: gain green, and a loss in neutral white. Never red. */
export const UP = "#3DDC84";
export const DOWN = "#FFFFFF";
export const AMBER = "#FFB703";

/** GlassCardSecondary. */
export const glassCard =
  "rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,27,40,0.72),rgba(6,18,30,0.64))] shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl";

const disc =
  "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] border border-white/[0.08] bg-white/[0.06] text-white transition-colors hover:bg-white/[0.12]";

/** Back, a centred title, and one optional disc on the right — the app's internal header. */
export function PortfolioHeader({ title, back, right }: { title: string; back: string; right?: ReactNode }) {
  return (
    <header className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2 pb-4">
      <Link href={back} aria-label="Back" className={disc}>
        <Ion name="chevron-back" size={20} />
      </Link>
      <h1 className="truncate text-center text-[20px] font-bold tracking-[-0.4px] text-white">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}

/** A disc that does one thing, for the header's right slot. */
export function HeaderDisc({ icon, label, onClick, disabled }: { icon: IonName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`${disc} disabled:opacity-40`}>
      <Ion name={icon} size={18} />
    </button>
  );
}

/** A card that says one thing: a bold line and a quieter one under it. */
export function NoteCard({ title, children, tone = "plain" }: { title: ReactNode; children?: ReactNode; tone?: "plain" | "notice" }) {
  return (
    <div className={`${glassCard} p-4 ${tone === "notice" ? "!border-[rgba(255,183,3,0.35)]" : ""}`}>
      <p className="text-[15px] font-bold text-white">{title}</p>
      {children ? <div className="mt-1 text-[13px] leading-[19px] text-white/[0.8]">{children}</div> : null}
    </div>
  );
}

/** Uppercase section label, as the app's `section` style. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 ml-1 mt-1.5 text-[12px] font-bold uppercase tracking-[0.6px] text-white/[0.7]">{children}</h2>;
}

/* ── The allocation ring ──────────────────────────────────────────── */

export interface DonutSlice {
  id: string;
  label: string;
  color: string;
  /** 0..1 of the whole. */
  pct: number;
}

/**
 * The app's `features/invest/_components/Donut`: one dashed circle per slice,
 * rotated to its start angle, a 2px gap between slices, a hairline floor for a
 * slice smaller than a pixel. The value sits in the middle; hovering a slice
 * or its legend row puts that slice's name and share there instead, so the
 * ring answers "which one is this" without a tooltip covering it.
 */
export function Donut({
  slices,
  centerValue,
  centerLabel = "invested",
  size = 124,
  thickness = 18,
  active,
  onActive,
}: {
  slices: readonly DonutSlice[];
  centerValue: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  active: string | null;
  onActive: (id: string | null) => void;
}) {
  const r = (size - thickness) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const GAP = slices.length > 1 ? 2 : 0;
  const segments = useMemo(() => {
    let acc = 0;
    return slices
      .filter((sl) => sl.pct > 0)
      .map((sl) => {
        const start = acc;
        acc += sl.pct;
        return { ...sl, rotation: start * 360 - 90, len: Math.max(sl.pct * C - GAP, 0.5) };
      });
  }, [slices, C, GAP]);
  const on = segments.find((s) => s.id === active) ?? null;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Allocation by asset">
        <circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} fill="none" />
        {segments.map((seg) => (
          <circle
            key={seg.id}
            cx={c}
            cy={c}
            r={r}
            stroke={seg.color}
            strokeWidth={active === seg.id ? thickness + 3 : thickness}
            strokeOpacity={active && active !== seg.id ? 0.45 : 1}
            fill="none"
            strokeDasharray={`${seg.len} ${C - seg.len}`}
            transform={`rotate(${seg.rotation} ${c} ${c})`}
            onMouseEnter={() => onActive(seg.id)}
            onMouseLeave={() => onActive(null)}
            className="cursor-default transition-[stroke-opacity,stroke-width] duration-150"
          >
            <title>{`${seg.label} ${(seg.pct * 100).toFixed(0)}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <p className="max-w-full truncate text-[15px] font-bold tracking-[-0.4px] tabular-nums text-white">
          {on ? `${(on.pct * 100).toFixed(0)}%` : centerValue}
        </p>
        <p className="mt-0.5 max-w-full truncate text-[9px] font-bold uppercase tracking-[0.6px] text-white/[0.6]">{on ? on.label : centerLabel}</p>
      </div>
    </div>
  );
}

/** Ring and legend with one shared hover, the way the app pairs them. */
export function AllocationCard({ slices, centerValue }: { slices: readonly DonutSlice[]; centerValue: string }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className={`${glassCard} mb-4 flex items-center gap-[18px] p-[18px]`}>
      <Donut slices={slices} centerValue={centerValue} active={active} onActive={setActive} />
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {slices.map((sl) => (
          <li
            key={sl.id}
            onMouseEnter={() => setActive(sl.id)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 transition-opacity ${active && active !== sl.id ? "opacity-50" : ""}`}
          >
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sl.color }} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-strong text-white/[0.85]">{sl.label}</span>
            <span className="min-w-[34px] text-right text-[12px] font-strong tabular-nums text-white/[0.7]">{(sl.pct * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A pill whose radius is half its height, and whose selection changes a
 * COLOUR — the border is always there, only its colour moves.
 */
export function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center justify-center rounded-[16px] border px-3.5 text-[13px] transition-colors ${
        on ? "border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.14)] font-bold text-[#FFB703]" : "border-white/10 bg-white/[0.06] font-strong text-white/[0.7] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
