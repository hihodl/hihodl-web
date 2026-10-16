"use client";

/**
 * The two forms a trip needs: making one (a HOLD group chat the partner's
 * member runs; travellers join it by link and count for them) and "Collect
 * deposits", an ordinary reusable pay link at a fixed price pinned to the
 * trip (lib/app/partners createTripDeposit). An agency also sets how many
 * travellers the trip has seats for: the first that many who join by the
 * link get the welcome eSIM. The list and the detail are TripsSection.
 */

import { useState, type FormEvent } from "react";

import { createTrip, createTripDeposit, partnerErrorText, TRIP_TRAVELLERS_MAX, updateTrip, type Trip } from "@/lib/app/partners";

import { btnGlass, ctaCommit, HoldCard } from "../hold";
import { Alert } from "../ui";
import { Field, inputCls } from "./kit";

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

/** Change how many travellers a trip has seats for. */
export function TravellersForm({ trip, onDone }: { trip: Pick<Trip, "id" | "maxTravellers">; onDone: (saved: boolean) => void }) {
  const [value, setValue] = useState(trip.maxTravellers != null ? String(trip.maxTravellers) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = toTravellers(value);
  const ready = n != null && n !== trip.maxTravellers && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await updateTrip(trip.id, { maxTravellers: n });
      onDone(true);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-3" noValidate>
      <TravellersField value={value} onChange={setValue} autoFocus />
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
  const seats = toTravellers(travellers);
  const ready = name.trim().length >= 2 && datesOk && (!agency || seats != null) && !busy;

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
        <Field label="Place (optional)">
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
