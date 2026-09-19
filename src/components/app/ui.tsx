"use client";

/**
 * The product's building blocks, ported from the KPI dashboard's look into
 * this repo's Tailwind 3: glass panels on the Benefits ground, one big number
 * per tile, small rates, segmented controls that change colour when chosen.
 *
 * Pills keep the house rule: a fixed height and a radius of exactly half of
 * it, and choosing one changes its colour, never its border width.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { IconChevronRight } from "./icons";

export const glass =
  "rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(9,27,40,0.72),rgba(6,18,30,0.64))] shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl";

export const glassSoft = "rounded-[14px] border border-white/[0.08] bg-[rgba(3,12,20,0.35)]";

/* ── Panels ───────────────────────────────────────────────────────── */

export function Panel({
  title,
  meta,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${glass} flex min-w-0 flex-col p-4 sm:p-5 ${className}`}>
      {title || action ? (
        <header className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            {title ? <h2 className="truncate text-small font-medium text-text">{title}</h2> : null}
            {meta ? <span className="truncate text-tiny text-[#9FB7C2]">{meta}</span> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={`min-w-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ── Numbers ──────────────────────────────────────────────────────── */

/** One big number and a caption. Money in the number, rates in the caption. */
export function KpiTile({
  label,
  value,
  unit,
  note,
  href,
  attention,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  href?: string;
  attention?: boolean;
}) {
  const body = (
    <>
      <p className="text-tiny text-[#9FB7C2]">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-[30px] font-medium leading-none tracking-tight tabular-nums ${attention ? "text-amber" : "text-text"}`}>
          {value}
        </span>
        {unit ? <span className="text-tiny text-[#9FB7C2]">{unit}</span> : null}
      </p>
      {note ? <p className="mt-2 truncate text-tiny text-[#B4BEC9]">{note}</p> : null}
    </>
  );
  const cls = `${glass} block min-w-0 px-5 py-4 text-left`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors duration-180 hover:bg-white/[0.06]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A small figure for the second row. */
export function MiniMetric({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="truncate text-[11px] text-[#9FB7C2]">{label}</p>
      <p className="mt-1 text-[18px] font-medium leading-none tabular-nums text-text">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="-mx-2 block min-w-0 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 px-0 py-1.5">{body}</div>
  );
}

/* ── Controls ─────────────────────────────────────────────────────── */

/** The dashboard's segmented control: the chosen one turns amber. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-[10px] border border-white/10 bg-[rgba(3,12,16,0.5)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-7 shrink-0 whitespace-nowrap rounded-[8px] px-3 text-tiny font-medium transition-colors ${
            value === o.value ? "bg-amber/20 text-[#FFE2A1]" : "text-[#9FB7C2] hover:text-[#CFE3EC]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filter pills with counts. 32px high, 16px radius. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[16px] border px-3 text-tiny transition-colors ${
              on
                ? "border-amber/45 bg-amber/20 text-[#FFE2A1]"
                : "border-white/10 bg-white/[0.04] text-[#CFE3EC] hover:bg-white/[0.08]"
            }`}
          >
            {o.label}
            {o.count !== undefined ? <span className={on ? "text-[#FFE2A1]/80" : "text-[#9FB7C2]"}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Tabs that are links, for a drill-down whose tab belongs in the URL. */
export function LinkTabs({ tabs, active }: { tabs: readonly { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex rounded-[12px] border border-white/10 bg-[rgba(3,12,16,0.5)] p-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-tiny font-medium transition-colors ${
                on ? "bg-amber/20 text-[#FFE2A1]" : "text-[#9FB7C2] hover:bg-white/[0.06] hover:text-[#CFE3EC]"
              }`}
            >
              {t.label}
              {t.count ? (
                <span className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-[8px] px-1 text-[10px] ${on ? "bg-amber/30" : "bg-white/10"}`}>
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Rows, lists, empties ─────────────────────────────────────────── */

/** A row you click to drill into. The whole row is the link. */
export function RowLink({
  href,
  title,
  sub,
  right,
  selected,
  onClick,
}: {
  href?: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const cls = `group flex w-full min-w-0 items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors ${
    selected ? "bg-amber/[0.14]" : "hover:bg-white/[0.05]"
  }`;
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-small text-text">{title}</div>
        {sub ? <div className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{sub}</div> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
      <IconChevronRight className={`shrink-0 ${selected ? "text-amber" : "text-white/30 group-hover:text-white/60"}`} />
    </>
  );
  if (href) {
    return (
      <Link href={href} scroll={false} className={cls} aria-current={selected ? "true" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={selected}>
      {inner}
    </button>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-small text-[#9FB7C2]">{title}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[14px] bg-white/[0.05] ${className}`} />;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-white/10" aria-hidden>
      <div className="h-full rounded-[3px] bg-amber" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** An amber line for a refusal or a failed read. Never red. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[12px] border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
      {children}
    </p>
  );
}

/* ── Money ────────────────────────────────────────────────────────── */

/** "$1,234" or "$1,234.50" from whole cents. */
export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}
