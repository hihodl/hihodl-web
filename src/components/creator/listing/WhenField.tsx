/**
 * Our own calendar, and our own clock.
 *
 * WHY NOT `type="datetime-local"`
 *
 * Because it is not ours. The browser's picker is a white sheet with blue
 * buttons that arrives in the middle of a navy card, in whatever shape the
 * operating system feels like, and it is the one part of publishing a listing
 * that looks like it belongs to somebody else. The app never had this problem:
 * it draws its own month (`hihodl-wallet/src/features/ad-space/components/
 * Calendar.tsx`) and so does this.
 *
 * THE SQUARE DAY
 *
 * The app's calendar carries a warning worth keeping even where the renderer
 * cannot bite: the selected day's disc always paints a background and always
 * carries its radius, so selecting a day changes a COLOUR and never introduces
 * a shape. Half the height, never a big number.
 *
 * THE MONTH IS ALWAYS SIX ROWS
 *
 * A calendar that grows and shrinks as the months go by reads as a bug, and
 * inside a step card it would move the field under it.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Ion } from "@/components/app/ion";
import { Chip, dayText, fieldLabel } from "@/components/app/spaces/kit";

import { Problems } from "./parts";

/* ── Days as text, which is how they are stored ───────────────────── */

export function parseDay(day: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.slice(0, 10));
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function isoDay(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today, in the creator's own clock, because that is the clock they book in. */
export function today(): string {
  const now = new Date();
  return isoDay(now.getFullYear(), now.getMonth(), now.getDate());
}

/** A day shifted by whole days, staying a day and never becoming an instant. */
export function dayPlus(day: string, days: number): string {
  const p = parseDay(day);
  if (!p) return day;
  const d = new Date(p.y, p.m, p.d + days);
  return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Splits what a `datetime-local` box holds: "2026-10-07T18:30". */
function splitLocal(value: string): { day: string; time: string } {
  const [day = "", time = ""] = value.split("T");
  return { day, time: /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "" };
}

/* ── One month ────────────────────────────────────────────────────── */

type Cursor = { y: number; m: number };

const shift = (c: Cursor, delta: number): Cursor => {
  const d = new Date(c.y, c.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

/** Months as a single number, so "is this month inside the window" is a compare. */
const asMonths = (c: Cursor) => c.y * 12 + c.m;

export function MonthCalendar({
  value,
  min,
  max,
  onPick,
}: {
  value: string;
  /** YYYY-MM-DD, both inclusive. */
  min: string;
  max: string;
  onPick: (day: string) => void;
}) {
  const startAt = parseDay(value) ?? parseDay(min);
  const [cursor, setCursor] = useState<Cursor>(() => {
    const now = new Date();
    return startAt ? { y: startAt.y, m: startAt.m } : { y: now.getFullYear(), m: now.getMonth() };
  });

  const minP = parseDay(min);
  const maxP = parseDay(max);
  const lowest = minP ? asMonths({ y: minP.y, m: minP.m }) : -Infinity;
  const highest = maxP ? asMonths({ y: maxP.y, m: maxP.m }) : Infinity;
  const canPrev = asMonths(cursor) > lowest;
  const canNext = asMonths(cursor) < highest;

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  // Monday-first weekday initials, as the app draws them.
  const weekdays = useMemo(
    () => [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })),
    [],
  );

  const first = new Date(cursor.y, cursor.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length < 42) cells.push(null);

  const move = (delta: number) => {
    const next = shift(cursor, delta);
    const n = asMonths(next);
    if (n >= lowest && n <= highest) setCursor(next);
  };

  const head = "flex h-8 w-8 items-center justify-center rounded-[16px] text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between py-1">
        <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => move(-1)} className={head}>
          <Ion name="chevron-back" size={18} />
        </button>
        <span className="text-[15px] font-extrabold text-white">{monthLabel}</span>
        <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => move(1)} className={head}>
          <Ion name="chevron-forward" size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1 text-center text-[11.5px] font-bold text-white/55">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d == null) return <span key={i} className="h-10" />;
          const day = isoDay(cursor.y, cursor.m, d);
          const out = day < min || day > max;
          const on = day === value;
          return (
            <span key={i} className="flex h-10 items-center justify-center">
              <button
                type="button"
                disabled={out}
                aria-pressed={on}
                onClick={() => onPick(day)}
                // The disc always has a background and always has its radius:
                // picking a day changes their colour and never adds a shape.
                className={`flex h-9 w-9 items-center justify-center rounded-[18px] text-[14.5px] transition-colors ${
                  on
                    ? "bg-[#F1F5F9] font-extrabold text-[#0A1420]"
                    : out
                      ? "bg-transparent font-strong text-white/[0.28]"
                      : "bg-transparent font-strong text-white hover:bg-white/10"
                }`}
              >
                {d}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── The clock ────────────────────────────────────────────────────── */

/** Every half hour, plus whatever odd minute a draft already holds. */
function slotsFor(value: string): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  if (value && !out.includes(value)) out.push(value);
  return out.sort();
}

function TimeStrip({ value, onPick }: { value: string; onPick: (time: string) => void }) {
  const slots = useMemo(() => slotsFor(value), [value]);
  const strip = useRef<HTMLDivElement>(null);
  const here = useRef<HTMLDivElement>(null);

  // Open on the time that is already chosen rather than on midnight. The strip
  // is scrolled by hand rather than with `scrollIntoView`, which would also
  // pull every scrollable ancestor — the step pager included — along with it.
  useEffect(() => {
    const box = strip.current;
    const chip = here.current;
    if (!box || !chip) return;
    box.scrollLeft = Math.max(0, chip.offsetLeft - box.clientWidth / 2 + chip.offsetWidth / 2);
  }, []);

  return (
    <div
      ref={strip}
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {slots.map((t) => (
        <div key={t} ref={t === value ? here : undefined} className="shrink-0">
          <Chip label={t} selected={t === value} onClick={() => onPick(t)} />
        </div>
      ))}
    </div>
  );
}

/* ── The fields ───────────────────────────────────────────────────── */

/** The box that opens the calendar: the app's PickerRow, with our chevron. */
function Opener({
  value,
  placeholder,
  open,
  attention,
  onClick,
  icon,
}: {
  value: string;
  placeholder: string;
  open: boolean;
  attention: boolean;
  onClick: () => void;
  icon: "calendar-outline" | "time-outline";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`flex min-h-12 w-full items-center gap-2.5 rounded-[16px] border bg-white/[0.06] px-3.5 text-left transition-colors hover:bg-white/[0.09] ${
        attention ? "border-amber" : open ? "border-white/30" : "border-white/[0.12]"
      }`}
    >
      <Ion name={icon} size={17} className="shrink-0 text-white/[0.62]" />
      <span className={`flex-1 truncate text-[15.5px] ${value ? "text-white" : "text-white/[0.45]"}`}>{value || placeholder}</span>
      <Ion name={open ? "chevron-up" : "chevron-down"} size={16} className="shrink-0 text-white/55" />
    </button>
  );
}

/** The panel the calendar and the clock sit in, under the box that opened it. */
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] p-3">{children}</div>;
}

/**
 * A day, picked on our own month.
 *
 * `value` and what comes back are both "YYYY-MM-DD", which is what the draft
 * has always held and what the body sends: nothing about the payload changes
 * by drawing the picker ourselves.
 */
export function DayField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  problems = [],
  placeholder = "Pick a day",
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
  min: string;
  max: string;
  hint?: string;
  problems?: readonly string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <Opener
        icon="calendar-outline"
        value={value ? dayText(value) : ""}
        placeholder={placeholder}
        open={open}
        attention={problems.length > 0}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <Panel>
          <MonthCalendar
            value={value}
            min={min}
            max={max}
            onPick={(day) => {
              onChange(day);
              setOpen(false);
            }}
          />
        </Panel>
      ) : null}
      {problems.length ? <Problems list={problems} /> : hint ? <p className="text-[12px] leading-4 text-white/55">{hint}</p> : null}
    </div>
  );
}

/**
 * A day and a time, as one `datetime-local` value — "2026-10-07T18:30", the
 * exact string the draft held when this was a white browser box.
 *
 * Picking a day on an empty field fills the time in too, because a moment with
 * no hour is not a moment: `DEFAULT_TIME` is the end of a working evening,
 * which is when a campaign that closes "on the 7th" actually closes.
 */
const DEFAULT_TIME = "18:00";

export function DayTimeField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  problems = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  hint?: string;
  problems?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const { day, time } = splitLocal(value);

  const shown = day ? `${dayText(day)}${time ? `, ${time}` : ""}` : "";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <Opener
        icon="calendar-outline"
        value={shown}
        placeholder="Pick a day and a time"
        open={open}
        attention={problems.length > 0}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <Panel>
          <MonthCalendar value={day} min={min} max={max} onPick={(d) => onChange(`${d}T${time || DEFAULT_TIME}`)} />
          <div className="flex items-center gap-2 pt-1">
            <Ion name="time-outline" size={16} className="shrink-0 text-white/[0.62]" />
            <span className="text-[12.5px] font-bold text-white/[0.62]">Time</span>
          </div>
          <TimeStrip value={time || DEFAULT_TIME} onPick={(t) => onChange(`${day || min}T${t}`)} />
        </Panel>
      ) : null}
      {problems.length ? <Problems list={problems} /> : hint ? <p className="text-[12px] leading-4 text-white/55">{hint}</p> : null}
    </div>
  );
}
