"use client";

/**
 * A partner's trips. A trip is a HOLD group chat the partner owns: travellers
 * open its join link, the app joins them to the chat, and anyone new signs up
 * first and counts for the partner.
 *
 * "Collect deposits" makes an ordinary reusable pay link at a fixed price for
 * the trip and pins it to the trip (lib/app/partners createTripDeposit).
 */

import { useState, type FormEvent } from "react";

import { QrCode } from "@/components/ad-space/qr";
import { createTrip, createTripDeposit, dayLabel, partnerErrorText, type Trip } from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { btnGlass, ctaCommit, HoldCard } from "../hold";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { Field, inputCls, QrDownloads } from "./kit";

const smallBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50";

export function TripsTab({
  trips,
  error,
  onRetry,
  onChanged,
  active,
}: {
  trips: Trip[] | undefined;
  error: unknown;
  onRetry: () => void;
  onChanged: () => void;
  active: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] leading-[20px] text-white/60">One group chat per trip. Travellers join with one link.</p>
        {!creating && active ? (
          <button type="button" className={btnGlass} onClick={() => setCreating(true)}>
            <Ion name="add" size={18} />
            New trip
          </button>
        ) : null}
      </div>

      {creating ? (
        <NewTrip
          onDone={(made) => {
            setCreating(false);
            if (made) onChanged();
          }}
        />
      ) : null}

      {error && !trips ? (
        <HoldCard>
          <ReadFailed compact title="Could not load your trips" onRetry={onRetry} />
        </HoldCard>
      ) : !trips ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      ) : trips.length === 0 && !creating ? (
        <HoldCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <Ion name="airplane-outline" size={26} className="text-white/35" />
          <p className="text-[14px] font-bold text-white">No trips yet</p>
          <p className="max-w-[360px] text-[13px] leading-[19px] text-white/55">
            Make one for your next group. Share its link, and everyone lands in the same chat, ready to book and pay.
          </p>
          {active ? (
            <button type="button" className={`${btnGlass} mt-1`} onClick={() => setCreating(true)}>
              <Ion name="add" size={18} />
              New trip
            </button>
          ) : null}
        </HoldCard>
      ) : (
        trips.map((trip) => <TripCard key={trip.id} trip={trip} onChanged={onChanged} />)
      )}
    </div>
  );
}

/* ── A new trip ───────────────────────────────────────────────────── */

function NewTrip({ onDone }: { onDone: (made: boolean) => void }) {
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datesOk = !startsOn || !endsOn || endsOn >= startsOn;
  const ready = name.trim().length >= 2 && datesOk && !busy;

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
          <input className={inputCls} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="Ubud, Bali" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts (optional)">
            <input className={`${inputCls} [color-scheme:dark]`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <input className={`${inputCls} [color-scheme:dark]`} type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
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

/* ── One trip ─────────────────────────────────────────────────────── */

function dates(trip: Trip): string {
  const a = dayLabel(trip.startsOn);
  const b = dayLabel(trip.endsOn);
  if (a && b) return `${a} to ${b}`;
  return a || b;
}

function TripCard({ trip, onChanged }: { trip: Trip; onChanged: () => void }) {
  const [qr, setQr] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const when = dates(trip);
  const meta = [trip.place, when].filter(Boolean).join(", ");

  return (
    <HoldCard className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber/[0.14] text-amber">
          <Ion name="airplane-outline" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold text-white">{trip.name}</h3>
          {meta ? <p className="truncate text-[13px] text-white/60">{meta}</p> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-white/80">
          <Ion name="people-outline" size={15} />
          {trip.members}
        </span>
      </div>

      <div className="mt-4 rounded-[16px] bg-white/[0.04] p-3.5">
        <p className="text-[12px] font-bold uppercase tracking-[0.5px] text-white/50">Join link</p>
        <p className="mt-1 break-all text-[13.5px] text-white/85">{trip.joinUrl.replace(/^https?:\/\//, "")}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <CopyButton value={trip.joinUrl} className={smallBtn} />
          <button type="button" className={smallBtn} onClick={() => setQr((v) => !v)} aria-expanded={qr}>
            <Ion name="qr-code-outline" size={15} />
            {qr ? "Hide QR" : "QR code"}
          </button>
        </div>
        {qr ? (
          <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="w-[148px] overflow-hidden rounded-[14px] bg-white p-1.5">
              <QrCode text={trip.joinUrl} title={`QR code to join ${trip.name}`} className="block h-auto w-full" />
            </div>
            <QrDownloads text={trip.joinUrl} name={`hold-trip-${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || trip.id}-qr`} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-[16px] bg-white/[0.04] p-3.5">
        <p className="text-[12px] font-bold uppercase tracking-[0.5px] text-white/50">Deposits</p>
        {trip.payLinkUrl ? (
          <>
            <p className="mt-1 break-all text-[13.5px] text-white/85">{trip.payLinkUrl.replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 text-[12.5px] leading-[18px] text-white/55">Every traveller pays the same link. Payments land in your HOLD account.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <CopyButton value={trip.payLinkUrl} className={smallBtn} />
              <a href={trip.payLinkUrl} target="_blank" rel="noopener noreferrer" className={smallBtn}>
                <Ion name="open-outline" size={15} />
                Open
              </a>
            </div>
          </>
        ) : deposit ? (
          <DepositForm
            trip={trip}
            onDone={(made) => {
              setDeposit(false);
              if (made) onChanged();
            }}
          />
        ) : (
          <>
            <p className="mt-1 text-[13px] leading-[19px] text-white/60">Take a fixed deposit from every traveller with one link.</p>
            <button type="button" className={`${smallBtn} mt-2.5`} onClick={() => setDeposit(true)}>
              <Ion name="cash-outline" size={15} />
              Collect deposits
            </button>
          </>
        )}
      </div>
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

function DepositForm({ trip, onDone }: { trip: Trip; onDone: (made: boolean) => void }) {
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
