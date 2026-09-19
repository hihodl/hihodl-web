"use client";

/**
 * The parts every Spaces screen in the app is built from
 * (src/features/ad-space/components/ui.tsx), on the web.
 *
 * The app's Spaces wears Hi Travel's palette (`travelPalette`): cards are a
 * 6% white wash with a 10% stroke at radius 18, section labels are small
 * capitals, the selected chip is a WHITE plate with navy ink (not amber), and
 * the amber fill is spent once per route on the tap that takes money.
 *
 * Its rules come with it: no red (attention is an amber tint with amber ink),
 * a pill's radius is half its height, and selecting changes a colour, never a
 * border width.
 *
 * One web-only change: the app's dim ink (42% white) is drawn at 55% wherever
 * it carries small text, so it keeps 4.5:1 on the ground.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Ion, type IonName } from "../ion";

/* ── travelPalette, as classes ───────────────────────────────────── */

export const P = {
  text: "text-white",
  muted: "text-white/[0.62]",
  /** textDim, lifted to 55% for small text. */
  dim: "text-white/55",
  caution: "text-amber",
  good: "text-[#2FBE8A]",
} as const;

/* ── Card, labels, body ──────────────────────────────────────────── */

export const cardCls = "flex min-w-0 flex-col gap-2.5 rounded-[18px] border border-white/10 bg-white/[0.06] p-3.5";

export function Card({ children, className = "", href, onClick }: { children: ReactNode; className?: string; href?: string; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} scroll={false} className={`${cardCls} text-left transition-colors hover:bg-white/[0.09] ${className}`}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cardCls} w-full text-left transition-colors hover:bg-white/[0.09] ${className}`}>
        {children}
      </button>
    );
  }
  return <div className={`${cardCls} ${className}`}>{children}</div>;
}

/** Small capitals over a group: 12/700, uppercase, tracked. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <h2 className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">{children}</h2>
      {right}
    </div>
  );
}

export function Body({ children, dim, className = "" }: { children: ReactNode; dim?: boolean; className?: string }) {
  return <p className={`text-[14.5px] leading-5 ${dim ? P.muted : P.text} ${className}`}>{children}</p>;
}

/** adStyles.h1 / h2 / money / small. */
export const h1 = "text-[24px] font-strong tracking-[-0.5px] text-white";
export const h2 = "text-[18px] font-strong tracking-[-0.3px] text-white";
export const money = "text-[28px] font-strong tracking-[-0.6px] tabular-nums text-white";
export const small = "text-[12px] font-strong text-white/55";

/* ── Chips and tags ──────────────────────────────────────────────── */

/** A pill that toggles, 34 high, radius 17. Selected is a white plate with navy ink; the stroke never changes width. */
export function Chip({
  label,
  selected,
  onClick,
  href,
  icon,
  disabled,
  count,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  href?: string;
  icon?: IonName;
  disabled?: boolean;
  count?: number;
}) {
  const cls = `inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[17px] border px-[13px] text-[13.5px] font-strong transition-colors ${
    selected ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/[0.14] bg-white/[0.06] text-white/[0.62] hover:bg-white/10"
  } ${disabled ? "opacity-45" : ""}`;
  const inner = (
    <>
      {icon ? <Ion name={icon} size={14} /> : null}
      {label}
      {count !== undefined ? <span className={selected ? "text-[#0A1420]/70" : "text-white/55"}>{count}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} scroll={false} aria-current={selected ? "page" : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || !onClick} aria-pressed={!!selected} className={cls}>
      {inner}
    </button>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {children}
    </div>
  );
}

/** A 22-high tag, radius 11: calm, good (green), caution (amber) or dim. */
export function Tag({ label, tone = "calm" }: { label: ReactNode; tone?: "calm" | "good" | "caution" | "dim" }) {
  const ink = tone === "good" ? "text-[#2FBE8A]" : tone === "caution" ? "text-amber" : tone === "dim" ? "text-white/55" : "text-white/[0.62]";
  const bg = tone === "good" ? "bg-[rgba(14,155,104,0.14)]" : tone === "caution" ? "bg-amber/[0.12]" : "bg-white/[0.07]";
  return <span className={`inline-flex h-[22px] shrink-0 items-center self-start whitespace-nowrap rounded-[11px] px-[9px] text-[11.5px] font-strong tracking-[0.1px] ${bg} ${ink}`}>{label}</span>;
}

/* ── Rows ────────────────────────────────────────────────────────── */

/** SheetRow: an icon, a title and a meta line, a chevron; attention is an amber stroke. */
export function SheetRow({
  title,
  meta,
  icon,
  href,
  onClick,
  attention,
  right,
}: {
  title: ReactNode;
  meta?: ReactNode;
  icon?: IonName;
  href?: string;
  onClick?: () => void;
  attention?: boolean;
  right?: ReactNode;
}) {
  const cls = `flex w-full min-w-0 items-center gap-2.5 rounded-[14px] border bg-white/[0.06] px-3 py-[11px] text-left transition-colors hover:bg-white/[0.09] ${
    attention ? "border-amber" : "border-white/10"
  }`;
  const inner = (
    <>
      {icon ? <Ion name={icon} size={18} className={`shrink-0 ${attention ? "text-amber" : "text-white/[0.62]"}`} /> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-strong text-white">{title}</span>
        {meta ? <span className="truncate text-[12.5px] text-white/55">{meta}</span> : null}
      </span>
      {right ?? <Ion name="chevron-forward" size={16} className="shrink-0 text-white/55" />}
    </>
  );
  if (href) {
    return (
      <Link href={href} scroll={false} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Label on the left, value on the right. */
export function KV({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[14px] text-white/[0.62]">{k}</span>
      <span className={`shrink text-right text-white ${strong ? "text-[15px] font-strong" : "text-[14px] font-medium"}`}>{v}</span>
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-white/[0.08]" />;
}

/* ── Fields ──────────────────────────────────────────────────────── */

export const fieldLabel = "text-[12.5px] font-strong text-white/[0.62]";
export const inputCls =
  "min-h-12 w-full min-w-0 rounded-[16px] border border-white/[0.12] bg-white/[0.06] px-3.5 py-3 text-[15.5px] text-white outline-none transition-colors placeholder:text-white/[0.28] focus:border-white/30 disabled:opacity-60";
export const inputAttention = "border-amber";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </label>
      {children}
      {error ? <p className="text-[12.5px] font-strong leading-[17px] text-amber">{error}</p> : hint ? <p className="text-[12px] leading-4 text-white/55">{hint}</p> : null}
    </div>
  );
}

/** A box that opens a picker: label above, value and a chevron down. */
export function PickerRow({ label, value, onClick, attention }: { label: string; value: ReactNode; onClick: () => void; attention?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full flex-col gap-1.5 text-left">
      <span className={fieldLabel}>{label}</span>
      <span className={`flex min-h-12 items-center gap-2 rounded-[16px] border bg-white/[0.06] px-3.5 ${attention ? "border-amber" : "border-white/[0.12]"}`}>
        <span className="flex-1 truncate text-[15.5px] text-white">{value}</span>
        <Ion name="chevron-down" size={16} className="text-white/55" />
      </span>
    </button>
  );
}

export function Checkbox({ checked, onChange, label, attention }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; attention?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-3 py-1.5 text-left">
      <span
        className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border ${
          checked ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : attention ? "border-amber" : "border-white/35"
        }`}
      >
        {checked ? <Ion name="checkmark" size={15} /> : null}
      </span>
      <span className="flex-1 text-[14.5px] leading-5 text-white">{label}</span>
    </button>
  );
}

/** A 6-high bar in the app's green. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-[3px] bg-white/10" aria-hidden>
      <div className="h-1.5 rounded-[3px] bg-[#0E9B68]" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

/** −/+ around a number. */
export function Stepper({ value, min = 1, max, onChange, suffix, labelLess, labelMore }: { value: number; min?: number; max: number; onChange: (n: number) => void; suffix?: string; labelLess: string; labelMore: string }) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-[18px] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.14]";
  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label={labelLess} className={btn} onClick={() => onChange(Math.max(min, value - 1))}>
        <Ion name="remove" size={18} />
      </button>
      <span className="min-w-[34px] text-center text-[20px] font-strong tabular-nums text-white">{suffix ? `${value}${suffix}` : value}</span>
      <button type="button" aria-label={labelMore} className={btn} onClick={() => onChange(Math.min(max, value + 1))}>
        <Ion name="add" size={18} />
      </button>
    </div>
  );
}

/** "More options": closed until opened, and open on its own when something inside needs fixing. */
export function Disclosure({ label, children, attention, summary }: { label: string; children: ReactNode; attention?: boolean; summary?: string | null }) {
  const [open, setOpen] = useState(false);
  const shown = open || !!attention;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={shown} onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 py-2 text-left">
        <Ion name={shown ? "chevron-down" : "chevron-forward"} size={16} className={attention ? "text-amber" : "text-white/[0.62]"} />
        <span className={`text-[13px] font-strong ${attention ? "text-amber" : "text-white/[0.62]"}`}>{label}</span>
        {!shown && summary ? <span className="flex-1 truncate text-right text-[12px] text-white/55">{summary}</span> : null}
      </button>
      {shown ? <div className="flex flex-col gap-3 pb-0.5">{children}</div> : null}
    </div>
  );
}

/** TravelEmpty: an icon in a 56 disc, a 17 title, a muted body, and a glass action. */
export function Empty({ icon, title, body, action }: { icon: IonName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] text-white/55">
        <Ion name={icon} size={24} />
      </span>
      <p className="text-[17px] font-strong tracking-[-0.3px] text-white">{title}</p>
      {body ? <p className="max-w-[360px] text-[14px] leading-5 text-white/[0.62]">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** TravelEmpty's action: a glass pill, 42 high. */
export const emptyBtn =
  "inline-flex h-[42px] items-center justify-center rounded-[21px] border border-white/[0.22] bg-white/10 px-[18px] text-[14px] font-strong tracking-[-0.1px] text-white transition-colors hover:bg-white/[0.14]";

/* ── The app's format.ts and EventLine (appended) ────────────────── */

/** formatCents: "$1,200" or "$1,200.50"; "—" for nothing. */
export function centsText(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const d = cents / 100;
  const whole = Number.isInteger(d);
  return `$${d.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** formatDateTime: "Wed, 7 Oct, 10:00". */
export function dateTimeText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** formatDay: "7 Oct 2026". */
export function dayText(day: string | null | undefined): string {
  if (!day) return "—";
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** formatEventDates: "7–8 Oct", "30 Sep – 2 Oct", the year only when it is not this one. */
export function eventDatesText(startsOn: string, endsOn: string): string {
  const a = Date.parse(`${startsOn.slice(0, 10)}T00:00:00Z`);
  const b0 = Date.parse(`${(endsOn || startsOn).slice(0, 10)}T00:00:00Z`);
  const b = Number.isFinite(b0) ? b0 : a;
  if (!Number.isFinite(a)) return startsOn || "";
  const da = new Date(a);
  const db = new Date(b);
  const m = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const thisYear = new Date().getUTCFullYear();
  if (da.getUTCFullYear() !== db.getUTCFullYear()) return `${da.getUTCDate()} ${m(da)} ${da.getUTCFullYear()} – ${db.getUTCDate()} ${m(db)} ${db.getUTCFullYear()}`;
  const year = db.getUTCFullYear() !== thisYear ? ` ${db.getUTCFullYear()}` : "";
  if (a === b) return `${da.getUTCDate()} ${m(da)}${year}`;
  if (da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${db.getUTCDate()} ${m(db)}${year}`;
  return `${da.getUTCDate()} ${m(da)} – ${db.getUTCDate()} ${m(db)}${year}`;
}

/** EventLine (EventParts): a calendar icon and "Name · City · 7–8 Oct", 12.5/600 muted. */
export function EventLine({ event }: { event: { name: string; city?: string | null; startsOn?: string | null; endsOn?: string | null } }) {
  const when = event.startsOn ? eventDatesText(event.startsOn, event.endsOn ?? event.startsOn) : "";
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Ion name="calendar-outline" size={13} className="shrink-0 text-white/[0.62]" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-strong text-white/[0.62]">{[event.name, event.city, when].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

/* ── Web-only screens, drawn with the app's parts (appended) ─────── */

/** A group: its SectionLabel (with a count and a control on the right) over a Card. */
export function Group({
  title,
  meta,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-2.5 ${className}`}>
      {title || action ? (
        <SectionLabel
          right={action}
        >
          {title}
          {meta !== undefined && meta !== null && meta !== "" ? <span className="ml-2 normal-case tracking-normal text-white/55">{meta}</span> : null}
        </SectionLabel>
      ) : null}
      <Card>{children}</Card>
    </section>
  );
}

/** The FilterPills contract (options, value, onChange), drawn as the app's Chips. */
export function Pills<T extends string>({
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
    <ChipRow label={label}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} count={o.count} selected={value === o.value} onClick={() => onChange(o.value)} />
      ))}
    </ChipRow>
  );
}

/** A figure on a card: small capitals, the money size, a dim line; amber ink when it waits on you. */
export function Stat({ label, value, note, href, attention }: { label: string; value: ReactNode; note?: ReactNode; href?: string; attention?: boolean }) {
  return (
    <Card href={href} className="gap-1.5">
      <span className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">{label}</span>
      <span className={`${money} ${attention ? "!text-amber" : ""}`}>{value}</span>
      {note ? <span className="truncate text-[12.5px] font-strong text-white/55">{note}</span> : null}
    </Card>
  );
}

/** A row inside a Card: title, meta, something on the right; no chevron, the whole row opens. */
export function ListRow({ href, title, meta, right, onClick }: { href?: string; title: ReactNode; meta?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const cls = "flex w-full min-w-0 items-center gap-3 rounded-[12px] px-1 py-2.5 text-left transition-colors hover:bg-white/[0.04]";
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-strong text-white">{title}</span>
        {meta ? <span className="truncate text-[12.5px] text-white/55">{meta}</span> : null}
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </>
  );
  if (href)
    return (
      <Link href={href} scroll={false} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}
