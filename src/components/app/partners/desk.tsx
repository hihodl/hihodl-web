"use client";

/**
 * The Partners desk's own furniture: full width, a side nav of its own, and
 * tables. An agency with hundreds of travellers reads rows, not cards, so
 * every list here is a table with filters on the server, "Load more" by
 * cursor, and an export of exactly what is filtered.
 *
 * Under 1024px the side nav becomes a row of pills and wide tables scroll
 * inside their own panel; the page itself never scrolls sideways.
 */

import { useState, type ReactNode } from "react";

import { downloadFile, partnerErrorText, type Paged } from "@/lib/app/partners";

import { Ion, type IonName } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, glass, Skeleton } from "../ui";

/* ── Sections and the side nav ────────────────────────────────────── */

export type Section = "overview" | "travellers" | "trips" | "commissions" | "payouts" | "links" | "team" | "settings";

export const SECTIONS: readonly { key: Section; label: string; icon: IonName; teamOnly?: boolean }[] = [
  { key: "overview", label: "Overview", icon: "grid-outline" },
  { key: "travellers", label: "Travellers", icon: "people-outline" },
  { key: "trips", label: "Trips", icon: "airplane-outline" },
  { key: "commissions", label: "Commissions", icon: "receipt-outline" },
  { key: "payouts", label: "Payouts", icon: "wallet-outline" },
  { key: "links", label: "Links", icon: "link-outline" },
  { key: "team", label: "Team", icon: "person-add-outline", teamOnly: true },
  { key: "settings", label: "Settings", icon: "settings-outline" },
];

export function SideNav({ value, onChange, showTeam }: { value: Section; onChange: (s: Section) => void; showTeam: boolean }) {
  const items = SECTIONS.filter((s) => showTeam || !s.teamOnly);
  return (
    <>
      <nav aria-label="Partners" className="sticky top-4 hidden w-[208px] shrink-0 flex-col gap-1 self-start lg:flex">
        {items.map((s) => {
          const on = s.key === value;
          return (
            <button
              key={s.key}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onChange(s.key)}
              className={`flex h-10 items-center gap-2.5 rounded-[12px] px-3 text-left text-[14px] font-bold transition-colors ${
                on ? "bg-white text-[#0A1420]" : "text-white/75 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Ion name={s.icon} size={17} />
              {s.label}
            </button>
          );
        })}
      </nav>
      <nav aria-label="Partners" className="-mx-1 mb-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {items.map((s) => {
          const on = s.key === value;
          return (
            <button
              key={s.key}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onChange(s.key)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors ${
                on ? "bg-white text-[#0A1420]" : "bg-white/10 text-white hover:bg-white/[0.14]"
              }`}
            >
              <Ion name={s.icon} size={15} />
              {s.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* ── Panels and headings ──────────────────────────────────────────── */

export function DeskPanel({ title, meta, actions, children, flush = false }: { title?: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`${glass} min-w-0 ${flush ? "" : "p-4 sm:p-5"}`}>
      {title || actions ? (
        <header className={`flex min-w-0 flex-wrap items-center justify-between gap-3 ${flush ? "px-4 pt-4 sm:px-5 sm:pt-5" : ""} mb-3`}>
          <div className="min-w-0">
            {title ? <h2 className="truncate text-[16px] font-bold text-white">{title}</h2> : null}
            {meta ? <p className="mt-0.5 truncate text-[12.5px] text-[#9FB7C2]">{meta}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export const smallBtn =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50";
export const amberBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-amber px-4 text-[13px] font-extrabold text-[#0F0F1A] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/* ── Filters ──────────────────────────────────────────────────────── */

export const filterCls =
  "h-9 min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[13px] text-white outline-none transition-colors focus:border-amber/60 [color-scheme:dark]";

export function FilterBar({ children, onClear, active }: { children: ReactNode; onClear?: () => void; active?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      {active && onClear ? (
        <button type="button" onClick={onClear} className="h-9 rounded-full px-3 text-[13px] font-bold text-[#8ECAE6] hover:text-white">
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex min-w-0 items-center">
      <span className="sr-only">{label}</span>
      <select className={`${filterCls} max-w-[220px] pr-7`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}: all</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input className={`${filterCls} w-[140px]`} type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} aria-label="From" />
      <span className="text-[12px] text-white/45">to</span>
      <input className={`${filterCls} w-[140px]`} type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} aria-label="To" />
    </span>
  );
}

/* ── Export ───────────────────────────────────────────────────────── */

export function ExportButton({ path, name, label = "Export CSV" }: { path: string; name: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className={smallBtn}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadFile(path, name);
          } catch (e) {
            setError(partnerErrorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Ion name="download-outline" size={15} />
        {busy ? "Preparing" : label}
      </button>
      {error ? <span className="text-[12px] text-amber">{error}</span> : null}
    </span>
  );
}

/* ── Tables ───────────────────────────────────────────────────────── */

export type Column<T> = {
  key: string;
  title: string;
  align?: "left" | "right";
  /** Hidden under this breakpoint, so a phone keeps the columns that matter. */
  /** Viewport breakpoints. The desk's own nav and the app's sidebar take ~480px, so "2xl" (1536) is a wide table's friend. */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  render: (row: T) => ReactNode;
  className?: string;
};

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="px-4 py-10 text-center text-[13.5px] leading-[20px] text-white/55 sm:px-5">{empty ?? "Nothing here yet."}</div>;
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px] sm:min-w-[560px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`sticky top-0 whitespace-nowrap border-b border-white/[0.08] px-2 py-2.5 text-[11px] sm:px-3 font-bold uppercase tracking-[0.6px] text-[#9FB7C2] first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${
                  c.align === "right" ? "text-right" : "text-left"
                } ${c.hideBelow ? HIDE[c.hideBelow] : ""}`}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-white/[0.05] last:border-0 ${onRowClick ? "cursor-pointer transition-colors hover:bg-white/[0.04]" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-2 py-3 align-middle sm:px-3 text-white/90 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${c.align === "right" ? "text-right tabular-nums" : ""} ${
                    c.hideBelow ? HIDE[c.hideBelow] : ""
                  } ${c.className ?? ""}`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A paged list in a panel: skeleton, failure with Retry, the table, Load more. */
export function PagedTable<T>({
  page,
  columns,
  rowKey,
  onRowClick,
  empty,
  failedTitle,
}: {
  page: Paged<T>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty: ReactNode;
  failedTitle: string;
}) {
  if (page.error && page.items.length === 0 && !page.loading) {
    return <ReadFailed compact title={failedTitle} onRetry={page.reload} />;
  }
  if (page.loading && page.items.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  return (
    <>
      <DataTable columns={columns} rows={page.items} rowKey={rowKey} onRowClick={onRowClick} empty={empty} />
      {page.error && page.items.length > 0 ? (
        <div className="px-4 pb-3 sm:px-5">
          <Alert>{partnerErrorText(page.error)}</Alert>
        </div>
      ) : null}
      {page.hasMore ? (
        <div className="flex justify-center px-4 py-4">
          <button type="button" className={smallBtn} onClick={page.loadMore} disabled={page.loadingMore}>
            {page.loadingMore ? "Loading" : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ── Small things in cells ────────────────────────────────────────── */

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-white/50">{children}</span>;
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "amber" | "green" | "blue" }) {
  const dot = tone === "amber" ? "#FFB703" : tone === "green" ? "#4ADE80" : tone === "blue" ? "#8ECAE6" : null;
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate text-[12px] text-[#9FB7C2]">
        {dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} /> : null}
        {label}
      </p>
      <p className="mt-1 truncate text-[20px] font-extrabold tabular-nums text-white">{value}</p>
      {note ? <p className="mt-0.5 truncate text-[12px] text-white/50">{note}</p> : null}
    </div>
  );
}
