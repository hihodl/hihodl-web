"use client";

/**
 * Where, when, who — the app's destination sheet, `DateRangeCalendar.tsx` and
 * `GuestPicker.tsx`, on the web.
 *
 * WHAT THE APP DOES IN THREE SHEETS, THIS DOES IN ONE BAR
 *
 * A phone has one column and has to stack the three questions into sheets. A
 * browser window does not, so the three sit in a row and each opens its own
 * popover underneath. The contents of those popovers are the app's, to the
 * pixel; only the container changed, because copying a bottom sheet onto a
 * 1400px screen would be copying the constraint rather than the design.
 *
 * EVERY DATE IS A UTC ISO STRING
 *
 * `"2026-09-14"`, start to finish. Not a `Date`. A calendar built on local
 * `Date` objects picks the wrong day for anybody east of Greenwich after
 * 23:00, and the person who finds that bug is the one standing at a reception
 * desk a day early.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Ion } from "../ion";

import { Cta, Spinner } from "./kit";
import { P, dateRange, guests as guestsWord, isoDay, nights as nightsWord, nightsBetween, shiftDay } from "./look";
import { usePlaceSearch } from "@/lib/app/stays-data";
import type { Place } from "@/lib/app/stays";

/* ── What a search IS ─────────────────────────────────────────────── */

export interface Where {
  /** What the person sees in the field. */
  label: string;
  /** The supplier's id, when they picked a suggestion. */
  placeId?: string;
  countryCode?: string;
  /** What they typed, when they did not pick one. The server resolves it. */
  query?: string;
}

export interface Stay {
  where: Where | null;
  checkin: string;
  checkout: string;
  adults: number;
  /** One AGE per child, not a count — a toddler and a teenager price apart. */
  children: number[];
}

export const MAX_CHILDREN = 4;

/** A sensible first search: a week out, two nights, two adults. */
export function blankStay(): Stay {
  return { where: null, checkin: isoDay(7), checkout: isoDay(9), adults: 2, children: [] };
}

/* ── The bar ──────────────────────────────────────────────────────── */

type Open = "where" | "when" | "who" | null;

export function SearchBar({
  value,
  onChange,
  onSearch,
  searching = false,
}: {
  value: Stay;
  onChange: (next: Stay) => void;
  onSearch: () => void;
  searching?: boolean;
}) {
  const [open, setOpen] = useState<Open>(null);
  const box = useRef<HTMLDivElement>(null);

  // A click anywhere else closes whatever is open. Escape too — a popover that
  // can only be dismissed by finding its own trigger again is a trap.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const nights = nightsBetween(value.checkin, value.checkout);
  const ready = Boolean(value.where);

  return (
    <div ref={box} className="relative z-20">
      <div
        className="flex flex-col gap-2 rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04] p-2 sm:flex-row sm:items-center"
      >
        <Field
          label="Where"
          value={value.where?.label ?? "Anywhere"}
          muted={!value.where}
          icon="search"
          on={open === "where"}
          onClick={() => setOpen(open === "where" ? null : "where")}
          className="sm:flex-[1.4]"
        />
        <Field
          label="When"
          value={`${dateRange(value.checkin, value.checkout)} · ${nightsWord(nights)}`}
          icon="calendar-outline"
          on={open === "when"}
          onClick={() => setOpen(open === "when" ? null : "when")}
        />
        <Field
          label="Who"
          value={guestsWord(value.adults, value.children.length)}
          icon="people-outline"
          on={open === "who"}
          onClick={() => setOpen(open === "who" ? null : "who")}
        />
        <Cta
          label="Search"
          icon="search"
          working={searching}
          disabled={!ready}
          onClick={() => {
            setOpen(null);
            onSearch();
          }}
          className="sm:w-auto sm:px-7"
        />
      </div>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-[26px] border-[0.5px] border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
          style={{ background: P.sheet }}
        >
          {/* The sheet's own gradient and its lit lip, as in the app. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[220px]"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.055), rgba(255,255,255,0.014) 45%, transparent)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[0.5px]" style={{ background: "rgba(255,255,255,0.16)" }} />
          <div className="relative max-h-[min(70vh,560px)] overflow-y-auto p-4">
            {open === "where" ? (
              <WherePicker
                value={value.where}
                onPick={(where) => {
                  onChange({ ...value, where });
                  setOpen("when");
                }}
              />
            ) : null}
            {open === "when" ? (
              <WhenPicker
                checkin={value.checkin}
                checkout={value.checkout}
                onChange={(checkin, checkout) => onChange({ ...value, checkin, checkout })}
                onDone={() => setOpen("who")}
              />
            ) : null}
            {open === "who" ? (
              <WhoPicker
                adults={value.adults}
                ages={value.children}
                onChange={(adults, children) => onChange({ ...value, adults, children })}
                onDone={() => setOpen(null)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  on,
  muted = false,
  onClick,
  className = "",
}: {
  label: string;
  value: string;
  icon: "search" | "calendar-outline" | "people-outline";
  on: boolean;
  muted?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[18px] px-3.5 py-2.5 text-left transition-colors ${className}`}
      style={{ background: on ? "rgba(255,255,255,0.10)" : "transparent" }}
    >
      <span className="shrink-0" style={{ color: P.textDim }} aria-hidden>
        <Ion name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.7px]" style={{ color: P.textDim }}>
          {label}
        </span>
        <span className="mt-px block truncate text-[14px] font-bold tracking-[-0.25px]" style={{ color: muted ? P.textDim : P.text }}>
          {value}
        </span>
      </span>
    </button>
  );
}

/* ── Where ────────────────────────────────────────────────────────── */

function WherePicker({ value, onPick }: { value: Where | null; onPick: (w: Where) => void }) {
  const [typed, setTyped] = useState(value?.label ?? "");
  const { places, loading } = usePlaceSearch(typed);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);

  const free = typed.trim();
  const canSearchText = free.length >= 2 && !places.some((p) => p.name.toLowerCase() === free.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={field}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && free.length >= 2) onPick(places[0] ? placeToWhere(places[0]) : { label: free, query: free });
        }}
        placeholder="City, region or country"
        aria-label="Where are you going"
        className="h-[46px] rounded-[16px] px-4 text-[15px] font-semibold tracking-[-0.2px] outline-none placeholder:font-medium"
        style={{ background: "rgba(255,255,255,0.06)", border: `0.5px solid ${P.cardBorder}`, color: P.text }}
      />

      {loading && places.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      ) : null}

      {places.map((p) => (
        <button
          key={p.placeId}
          type="button"
          onClick={() => onPick(placeToWhere(p))}
          className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: P.textDim }} aria-hidden>
            <Ion name="location-outline" size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold tracking-[-0.2px]" style={{ color: P.text }}>
              {p.name}
            </span>
            {p.address ? (
              <span className="mt-px block truncate text-[12px]" style={{ color: P.textDim }}>
                {p.address}
              </span>
            ) : null}
          </span>
        </button>
      ))}

      {/*
        Searching the words themselves, when nothing matched. The server
        resolves free text to a place id; sending it as a city name is what
        made every search that skipped autocomplete fail upstream.
      */}
      {canSearchText ? (
        <button
          type="button"
          onClick={() => onPick({ label: free, query: free })}
          className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "rgba(255,255,255,0.06)", color: P.greenText }} aria-hidden>
            <Ion name="search" size={16} />
          </span>
          <span className="truncate text-[14px] font-bold tracking-[-0.2px]" style={{ color: P.text }}>
            {`Search “${free}”`}
          </span>
        </button>
      ) : null}

      {!loading && places.length === 0 && free.length >= 2 && !canSearchText ? (
        <p className="py-6 text-center text-[13px]" style={{ color: P.textDim }}>
          No places matched. Try a city name.
        </p>
      ) : null}
    </div>
  );
}

function placeToWhere(p: Place): Where {
  return { label: p.name, placeId: p.placeId, countryCode: p.countryCode ?? undefined };
}

/* ── When ─────────────────────────────────────────────────────────── */

/** Fourteen months ahead, which is as far as anybody books a hotel. */
const MONTHS_AHEAD = 14;

function WhenPicker({
  checkin,
  checkout,
  onChange,
  onDone,
}: {
  checkin: string;
  checkout: string;
  onChange: (checkin: string, checkout: string) => void;
  onDone: () => void;
}) {
  // While a range is half-picked, `end` is null and nothing is committed —
  // `onChange` never fires on a half-picked range.
  const [start, setStart] = useState<string>(checkin);
  const [end, setEnd] = useState<string | null>(checkout);

  const today = isoDay();
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }, []);

  const weekdays = useMemo(
    // 2024-01-01 was a Monday, which is where this grid starts.
    () => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })),
    [],
  );

  function tap(iso: string) {
    if (iso < today) return;
    // A complete range, or a tap at or before the start, begins a new one.
    if (end !== null || iso <= start) {
      setStart(iso);
      setEnd(null);
      return;
    }
    setEnd(iso);
    onChange(start, iso);
  }

  return (
    <div className="flex flex-col">
      <div className="flex border-b-[0.5px] px-2 pb-2" style={{ borderColor: P.divider }}>
        {weekdays.map((w) => (
          <span key={w} className="flex-1 text-center text-[11px] font-bold tracking-[0.4px]" style={{ color: P.textDim }}>
            {w}
          </span>
        ))}
      </div>

      <div className="max-h-[330px] overflow-y-auto pt-3">
        {months.map(({ y, m }) => (
          <Month key={`${y}-${m}`} y={y} m={m} today={today} start={start} end={end} onTap={tap} />
        ))}
      </div>

      <div className="flex min-h-[62px] items-center justify-center border-t-[0.5px] pb-1 pt-3" style={{ borderColor: P.divider }}>
        {end === null ? (
          <div className="flex items-center gap-[7px]">
            <span style={{ color: P.textDim }} aria-hidden>
              <Ion name="calendar-outline" size={15} />
            </span>
            <p className="text-[13px] font-medium" style={{ color: P.textDim }}>
              Now pick your check-out date
            </p>
          </div>
        ) : (
          <div className="flex w-full items-center gap-2.5 px-1">
            <Edge label="CHECK-IN" iso={start} />
            <span
              className="mt-[7px] shrink-0 rounded-[999px] px-2.5 py-[5px] text-[11.5px] font-extrabold tracking-[-0.1px]"
              style={{ background: P.selectSoft, color: P.text }}
            >
              {nightsWord(nightsBetween(start, end))}
            </span>
            <Edge label="CHECK-OUT" iso={end} right />
            <Cta label="Done" onClick={onDone} className="ml-2 !h-[42px] shrink-0 !rounded-[21px] !px-5 !text-[14px]" />
          </div>
        )}
      </div>
    </div>
  );
}

function Edge({ label, iso, right = false }: { label: string; iso: string; right?: boolean }) {
  const d = new Date(`${iso}T00:00:00Z`);
  const said = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-[3px] ${right ? "items-end" : ""}`}>
      <span className="text-[10px] font-extrabold tracking-[0.7px]" style={{ color: P.textDim }}>
        {label}
      </span>
      <span className="truncate text-[14.5px] font-bold tracking-[-0.25px]" style={{ color: P.text }}>
        {said}
      </span>
    </div>
  );
}

function Month({
  y,
  m,
  today,
  start,
  end,
  onTap,
}: {
  y: number;
  m: number;
  today: string;
  start: string;
  end: string | null;
  onTap: (iso: string) => void;
}) {
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Monday-first: JS counts Sunday as 0, so rotate by six.
  const blanks = (first.getUTCDay() + 6) % 7;
  const label = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mb-[18px]">
      <p className="mb-2 px-3 text-[15px] font-bold tracking-[-0.3px]" style={{ color: P.text }}>
        {label}
      </p>
      <div className="flex flex-wrap px-2">
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} className="h-[46px]" style={{ width: `${100 / 7}%` }} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const past = iso < today;
          const isStart = iso === start;
          const isEnd = end !== null && iso === end;
          const edge = isStart || isEnd;
          const between = end !== null && iso > start && iso < end;
          const banded = between || (edge && end !== null && start !== end);

          return (
            <span key={iso} className="relative flex h-[46px] items-center justify-center" style={{ width: `${100 / 7}%` }}>
              {/* The band sits BEHIND the dot, and stops at the middle of each end. */}
              {banded ? (
                <span
                  aria-hidden
                  className="absolute inset-y-[4px]"
                  style={{
                    background: P.selectSoft,
                    left: isStart ? "50%" : 0,
                    right: isEnd ? "50%" : 0,
                    borderTopLeftRadius: isStart ? 19 : 0,
                    borderBottomLeftRadius: isStart ? 19 : 0,
                    borderTopRightRadius: isEnd ? 19 : 0,
                    borderBottomRightRadius: isEnd ? 19 : 0,
                  }}
                />
              ) : null}
              <button
                type="button"
                disabled={past}
                onClick={() => onTap(iso)}
                className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[19px] text-[14.5px] tracking-[-0.2px] disabled:cursor-default"
                style={{
                  background: edge ? P.select : "transparent",
                  color: edge ? P.selectText : past ? P.textFaint : P.text,
                  fontWeight: edge ? 800 : iso === today ? 800 : between ? 700 : 600,
                  border: iso === today ? `1.5px solid ${edge ? "rgba(10,20,32,0.28)" : P.todayRing}` : "none",
                }}
              >
                {i + 1}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── Who ──────────────────────────────────────────────────────────── */

function WhoPicker({
  adults,
  // Named `ages` and not `children`: React reserves that prop name, and one
  // child's age is a number, not a node.
  ages,
  onChange,
  onDone,
}: {
  adults: number;
  ages: number[];
  onChange: (adults: number, ages: number[]) => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col">
      <Stepper
        label="Adults"
        sub="Age 18 and over"
        value={adults}
        min={1}
        max={8}
        onChange={(n) => onChange(n, ages)}
      />
      <Stepper
        label="Children"
        sub="Age 0 to 17"
        value={ages.length}
        min={0}
        max={MAX_CHILDREN}
        onChange={(n) =>
          // Growing keeps the ages already given and defaults the new one to 8;
          // shrinking drops from the end, so nobody's answer moves sideways.
          onChange(adults, n > ages.length ? [...ages, ...Array(n - ages.length).fill(8)] : ages.slice(0, n))
        }
      />

      {ages.length > 0 ? (
        <div className="mt-1.5 border-t-[0.5px] pt-3" style={{ borderColor: P.divider }}>
          <p className="text-[12.5px] leading-[18.5px] tracking-[-0.1px]" style={{ color: P.textDim }}>
            Ages change the price. Hotels charge differently for a toddler and a teenager, so give us the age at check-in.
          </p>
          {ages.map((age, i) => (
            <Stepper
              key={i}
              label={`Child ${i + 1}`}
              sub={age === 0 ? "Under 1" : `${age} ${age === 1 ? "year" : "years"}`}
              value={age}
              min={0}
              max={17}
              hideValue
              onChange={(n) => onChange(adults, ages.map((a, j) => (j === i ? n : a)))}
            />
          ))}
        </div>
      ) : null}

      <Cta label="Done" onClick={onDone} className="mt-4" />
    </div>
  );
}

function Stepper({
  label,
  sub,
  value,
  min,
  max,
  onChange,
  hideValue = false,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** A child's age says itself in the sub-line; printing it twice is noise. */
  hideValue?: boolean;
}) {
  const btn = (dir: -1 | 1, icon: "remove" | "add", at: boolean) => (
    <button
      type="button"
      aria-label={`${dir < 0 ? "Decrease" : "Increase"} ${label}`}
      disabled={at}
      onClick={() => onChange(value + dir)}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] disabled:cursor-default"
      style={{ border: `0.5px solid ${at ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.22)"}`, color: at ? P.textFaint : P.text }}
    >
      <Ion name={icon} size={18} />
    </button>
  );

  return (
    <div className="flex items-center gap-3.5 py-[15px]">
      <div className="min-w-0 flex-1">
        <p className="text-[15.5px] font-semibold tracking-[-0.25px]" style={{ color: P.text }}>
          {label}
        </p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: P.textDim }}>
          {sub}
        </p>
      </div>
      {btn(-1, "remove", value <= min)}
      {hideValue ? null : (
        <span className="min-w-[22px] text-center text-[16px] font-bold" style={{ color: P.text }}>
          {value}
        </span>
      )}
      {btn(1, "add", value >= max)}
    </div>
  );
}

/* ── Carrying a search in the URL ─────────────────────────────────── */

/**
 * A search belongs in the address bar.
 *
 * The app keeps it in a store because a phone has no address bar. A browser
 * does, and a results page that cannot be reloaded, shared or reached with the
 * back button is a worse screen than the app's, not the same one.
 */
export function stayToParams(s: Stay): URLSearchParams {
  const q = new URLSearchParams();
  if (s.where?.placeId) q.set("place", s.where.placeId);
  if (s.where?.query) q.set("q", s.where.query);
  if (s.where?.countryCode) q.set("cc", s.where.countryCode);
  if (s.where?.label) q.set("where", s.where.label);
  q.set("in", s.checkin);
  q.set("out", s.checkout);
  q.set("adults", String(s.adults));
  if (s.children.length) q.set("children", s.children.join(","));
  return q;
}

export function stayFromParams(q: URLSearchParams): Stay {
  const label = q.get("where") ?? q.get("q") ?? "";
  const placeId = q.get("place") ?? undefined;
  const free = q.get("q") ?? undefined;
  const blank = blankStay();
  return {
    where: label || placeId || free ? { label: label || free || "", placeId, query: free, countryCode: q.get("cc") ?? undefined } : null,
    checkin: q.get("in") ?? blank.checkin,
    checkout: q.get("out") ?? blank.checkout,
    // `|| 2` and not a clamp: "0 adults" is not a search anybody meant, so it
    // falls back to the default rather than to one adult.
    adults: Math.max(1, Math.min(8, Number(q.get("adults")) || 2)),
    children: parseAges(q.get("children")),
  };
}

/**
 * The children's ages from the URL.
 *
 * The empty check is load-bearing and was missing: `"".split(",")` is `[""]`,
 * `Number("")` is 0, and 0 is a perfectly valid age — so a search with NO
 * children silently became a search for one infant, on every URL that omitted
 * the parameter, which is nearly all of them. The supplier prices an infant,
 * so that is a wrong price quoted on a booking screen, not a cosmetic bug.
 */
function parseAges(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "")
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17)
    .slice(0, MAX_CHILDREN);
}

/** Checkout must be after check-in, always. A URL can say otherwise. */
export function sane(s: Stay): Stay {
  const checkin = s.checkin < isoDay() ? isoDay(1) : s.checkin;
  const checkout = s.checkout <= checkin ? shiftDay(checkin, 1) : s.checkout;
  return { ...s, checkin, checkout };
}
