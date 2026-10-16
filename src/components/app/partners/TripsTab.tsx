"use client";

/**
 * The two forms a trip needs: making one (a HOLD group chat the partner's
 * member runs; travellers join it by link and count for them) and "Collect
 * deposits", an ordinary reusable pay link at a fixed price pinned to the
 * trip (lib/app/partners createTripDeposit). An agency also sets the trip's
 * country (which welcome eSIM it gives, sent as `countryCode`) and how many
 * travellers it has seats for: the first that many who join by the link get
 * the welcome eSIM. The list and the detail are TripsSection.
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { COUNTRY_CODES } from "@/lib/ad-space/billing-rules";
import { flagEmoji } from "@/lib/app/event-look";
import { countryName, createTrip, createTripDeposit, partnerErrorText, TRIP_TRAVELLERS_MAX, updateTrip, type Trip } from "@/lib/app/partners";

import { btnGlass, ctaCommit, HoldCard } from "../hold";
import { Ion } from "../ion";
import { Alert } from "../ui";
import { Field, inputCls, labelCls } from "./kit";

const smallBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50";

/* ── Travellers (agencies) ────────────────────────────────────────── */

/** "20" → 20; anything not a whole number from 1 to 500 → null. */
export function toTravellers(raw: string): number | null {
  const clean = raw.trim();
  if (!/^\d{1,3}$/.test(clean)) return null;
  const n = Number(clean);
  return n >= 1 && n <= TRIP_TRAVELLERS_MAX ? n : null;
}

const TRAVELLERS_HINT = (n: number | null) =>
  `Only the first ${n ? `${n} ` : ""}travellers who join through this trip's link get the welcome eSIM. Everyone else can still join and still counts for your commission.`;

function TravellersField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const n = toTravellers(value);
  return (
    <Field label="Travellers" hint={value.trim() && n == null ? `Pick a number from 1 to ${TRIP_TRAVELLERS_MAX}.` : TRAVELLERS_HINT(n)}>
      <input
        className={inputCls}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        placeholder="20"
        autoFocus={autoFocus}
        aria-invalid={value.trim() !== "" && n == null}
      />
    </Field>
  );
}

/* ── Country (agencies) ───────────────────────────────────────────── */

/** Every country, by its English name: the welcome eSIM is the one for the trip's country. */
const COUNTRIES = (() => {
  const seen = new Set<string>();
  const out: { code: string; name: string; flag: string; key: string }[] = [];
  for (const raw of COUNTRY_CODES) {
    const code = raw.toUpperCase();
    const name = countryName(code);
    if (!name || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name, flag: flagEmoji(code) ?? "", key: plain(name) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
})();

/** "Côte d'Ivoire" → "cote d'ivoire": search ignores accents and case. */
function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** A searchable country list: flag and name shown, the ISO alpha-2 code kept. */
function CountryField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const picked = COUNTRIES.find((c) => c.code === value) ?? null;
  const matches = useMemo(() => {
    const k = plain(q);
    if (!k) return COUNTRIES;
    const starts = COUNTRIES.filter((c) => c.key.startsWith(k) || c.code.toLowerCase() === k);
    const inside = COUNTRIES.filter((c) => !starts.includes(c) && c.key.includes(k));
    return [...starts, ...inside];
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQ("");
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = matches[hi];
      if (c) pick(c.code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={box} className="relative">
      <span className={labelCls} id={`${id}-label`}>
        Country
      </span>
      {open ? (
        <input
          className={inputCls}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={keys}
          placeholder="Search a country"
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={matches[hi] ? `${id}-${matches[hi].code}` : undefined}
          autoComplete="off"
        />
      ) : (
        <button
          type="button"
          className={`${inputCls} flex items-center justify-between gap-2 text-left`}
          onClick={() => {
            setOpen(true);
            setHi(0);
          }}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
        >
          <span className={`min-w-0 truncate ${picked ? "" : "text-white/35"}`}>{picked ? `${picked.flag} ${picked.name}` : "Pick a country"}</span>
          <Ion name="chevron-down" size={16} className="shrink-0 text-white/45" />
        </button>
      )}
      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 z-20 mt-1.5 max-h-64 overflow-y-auto rounded-[14px] border border-white/10 bg-[#141826] py-1 shadow-xl"
        >
          {matches.length ? (
            matches.map((c, i) => (
              <li
                key={c.code}
                id={`${id}-${c.code}`}
                data-i={i}
                role="option"
                aria-selected={c.code === value}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-[14px] text-white ${i === hi ? "bg-white/[0.08]" : ""}`}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c.code)}
              >
                <span aria-hidden className="text-[18px] leading-none">
                  {c.flag}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.code === value ? <Ion name="checkmark" size={16} className="shrink-0 text-amber" /> : null}
              </li>
            ))
          ) : (
            <li className="px-4 py-2.5 text-[13px] text-white/55">No country by that name</li>
          )}
        </ul>
      ) : null}
      <span className="mt-1.5 block text-[12.5px] leading-[18px] text-white/55">Where the group goes. Travellers get the welcome eSIM for this country.</span>
    </div>
  );
}

/** A real ISO alpha-2 country, or null. */
function toCountry(code: string): string | null {
  return COUNTRIES.some((c) => c.code === code) ? code : null;
}

/** Change a trip's country and how many travellers it has seats for. */
export function TravellersForm({ trip, onDone }: { trip: Pick<Trip, "id" | "maxTravellers" | "countryCode">; onDone: (saved: boolean) => void }) {
  const [value, setValue] = useState(trip.maxTravellers != null ? String(trip.maxTravellers) : "");
  const [country, setCountry] = useState((trip.countryCode ?? "").toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = toTravellers(value);
  const code = toCountry(country);
  const changed = n !== trip.maxTravellers || code !== (trip.countryCode ?? "").toUpperCase();
  const ready = n != null && code != null && changed && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await updateTrip(trip.id, { maxTravellers: n, countryCode: code });
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CountryField value={country} onChange={setCountry} />
        <TravellersField value={value} onChange={setValue} />
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${smallBtn} border-amber bg-amber text-[#0F0F1A] hover:bg-amber`} disabled={!ready}>
          {busy ? "Saving" : "Save"}
        </button>
        <button type="button" className={smallBtn} onClick={() => onDone(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── A new trip ───────────────────────────────────────────────────── */

/** `agency`: the trip holds seats, and the first travellers get the welcome eSIM. */
export function NewTrip({ agency, onDone }: { agency: boolean; onDone: (made: boolean) => void }) {
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [travellers, setTravellers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datesOk = !startsOn || !endsOn || endsOn >= startsOn;
  const [country, setCountry] = useState("");
  const seats = toTravellers(travellers);
  const code = toCountry(country);
  const ready = name.trim().length >= 2 && datesOk && (!agency || (seats != null && code != null)) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await createTrip({
        name: name.trim(),
        ...(place.trim() ? { place: place.trim() } : {}),
        ...(startsOn ? { startsOn } : {}),
        ...(endsOn ? { endsOn } : {}),
        ...(agency && seats != null ? { maxTravellers: seats } : {}),
        ...(agency && code ? { countryCode: code } : {}),
      });
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <HoldCard className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <h2 className="text-[16px] font-bold text-white">New trip</h2>
        <Field label="Trip name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Bali retreat, May" autoFocus />
        </Field>
        {agency ? <CountryField value={country} onChange={setCountry} /> : null}
        <Field label={agency ? "City (optional)" : "Place (optional)"}>
          <input className={inputCls} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Ubud, Bali" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts (optional)">
            <input className={`${inputCls} [color-scheme:dark]`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <input className={`${inputCls} [color-scheme:dark]`} type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
        {agency ? <TravellersField value={travellers} onChange={setTravellers} /> : null}
        {!datesOk ? <Alert>The trip ends before it starts. Check the dates.</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button type="submit" className={ctaCommit} disabled={!ready}>
            {busy ? "Making the trip" : "Make the trip"}
          </button>
          <button type="button" className={`${btnGlass} h-[52px] w-full rounded-[26px]`} onClick={() => onDone(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </HoldCard>
  );
}

/* ── Collect deposits ─────────────────────────────────────────────── */

/** "150", "150.5", "1,500.00" → cents, or null. */
function toCents(raw: string): number | null {
  const clean = raw.replace(/[,\s$]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function DepositForm({ trip, onDone }: { trip: Trip; onDone: (made: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = toCents(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!cents || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createTripDeposit(trip, cents);
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-3" noValidate>
      <Field label="Deposit per traveller, in US dollars">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-white/55">$</span>
          <input
            className={`${inputCls} pl-8`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="250"
            autoFocus
            aria-label="Deposit amount in US dollars"
          />
        </div>
      </Field>
      <p className="text-[12.5px] leading-[18px] text-white/55">
        Makes one pay link called &ldquo;{trip.name} deposit&rdquo; that every traveller in the group can pay.
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${smallBtn} border-amber bg-amber text-[#0F0F1A] hover:bg-amber`} disabled={!cents || busy}>
          {busy ? "Making the link" : "Make the deposit link"}
        </button>
        <button type="button" className={smallBtn} onClick={() => onDone(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
