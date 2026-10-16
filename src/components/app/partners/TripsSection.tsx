"use client";

/**
 * Trips: one HOLD group chat per trip, the link travellers join it by, and
 * its deposit. The list is a table with what each trip brought in; opening a
 * trip shows who joined, who has paid the deposit and what the trip earned.
 *
 * A deposit is matched to a traveller when they paid from their HOLD wallet.
 * Card, bank and outside wallet payments cannot be tied to a person, so they
 * are shown as "not matched" with their total: the money always adds up.
 *
 * Agencies only: each trip says how many of its welcome eSIMs were claimed
 * (the first `maxTravellers` who join by the link get one). A trip that
 * gives none says nothing about it, and creators never see the line.
 */

import { useState } from "react";

import { QrCode } from "@/components/ad-space/qr";
import { countryName, dayLabel, fileSlug, usd, usePaged, useTripDetail, type DepositState, type Scope, type Trip, type TripDetail, type TripRow } from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { PersonFace } from "../payments/group-kit";
import { Skeleton } from "../ui";
import { DataTable, DeskPanel, ExportButton, FilterBar, Muted, PagedTable, SelectFilter, smallBtn, Stat, type Column } from "./desk";
import { useFilters } from "./CommissionsSection";
import { Pill, QrDownloads, type PillTone } from "./kit";
import { DepositForm, NewTrip, TravellersForm } from "./TripsTab";

/** The welcome eSIM a trip gives, in words; null when it gives none. */
function welcomeText(t: Pick<Trip, "place" | "countryCode" | "maxTravellers" | "welcome">): { line: string; count: string } | null {
  const w = t.welcome;
  if (!w?.offered) return null;
  const where = countryName(t.countryCode) || t.place?.trim();
  const line = `Includes a 1 GB welcome eSIM${where ? ` for ${where}` : ""}`;
  const n = (v: number) => v.toLocaleString("en-US");
  const count = t.maxTravellers != null ? `${n(w.given)} of ${n(t.maxTravellers)} claimed` : w.left != null ? `${n(w.left)} left` : `${n(w.given)} claimed`;
  return { line, count };
}

function when(t: { startsOn: string | null; endsOn: string | null }): string {
  const a = dayLabel(t.startsOn);
  const b = dayLabel(t.endsOn);
  return a && b ? `${a} to ${b}` : a || b;
}

function tripColumns(scope: Scope, agency: boolean): Column<TripRow>[] {
  const cols: Column<TripRow>[] = [
    {
      key: "name",
      title: "Trip",
      render: (t) => {
        const welcome = agency ? welcomeText(t) : null;
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-bold text-white">{t.name}</span>
            <span className="truncate text-[12px] text-white/45">{[t.place, when(t)].filter(Boolean).join(", ") || "No dates yet"}</span>
            {welcome ? (
              <span className="truncate text-[12px] text-amber/90" title={`${welcome.line}. ${welcome.count}.`}>
                {welcome.line}. {welcome.count}
              </span>
            ) : null}
          </span>
        );
      },
    },
    { key: "runBy", title: "Run by", hideBelow: "lg", render: (t) => t.runBy ?? <Muted>Partner</Muted> },
    { key: "members", title: "People", align: "right", hideBelow: "sm", render: (t) => t.members.toLocaleString("en-US") },
    { key: "deposits", title: "Deposits paid", align: "right", hideBelow: "sm", render: (t) => (t.payLinkCode ? t.depositsPaid.toLocaleString("en-US") : <Muted>No deposit</Muted>) },
    { key: "collected", title: "Collected", align: "right", hideBelow: "md", render: (t) => (t.payLinkCode ? usd(t.collectedUsdc) : <Muted>None</Muted>) },
    { key: "bookings", title: "Bookings", align: "right", hideBelow: "md", render: (t) => t.bookings.toLocaleString("en-US") },
    { key: "commission", title: "Commission", align: "right", render: (t) => <span className="font-extrabold text-white">{usd(t.commissionUsdc)}</span> },
    { key: "open", title: "", align: "right", render: () => <Ion name="chevron-forward" size={16} className="text-white/40" /> },
  ];
  return scope === "team" ? cols : cols.filter((c) => c.key !== "runBy");
}

export function TripsSection({
  scope,
  active,
  agency,
  partnerName,
  onChanged,
}: {
  scope: Scope;
  active: boolean;
  /** An agency's trips hold seats and give the welcome eSIM; a creator's do not. */
  agency: boolean;
  partnerName: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { f, set, clear, active: filtered } = useFilters();
  const page = usePaged<TripRow>("partners/me/trips", { scope, ...f });

  if (open) {
    return (
      <TripDetailView
        id={open}
        agency={agency}
        partnerName={partnerName}
        onBack={() => {
          setOpen(null);
          page.reload();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <NewTrip
          agency={agency}
          onDone={(made) => {
            setCreating(false);
            if (made) {
              page.reload();
              onChanged();
            }
          }}
        />
      ) : null}
      <DeskPanel
        flush
        title="Trips"
        meta="One group chat per trip. Travellers join with one link."
        actions={
          active && !creating ? (
            <button type="button" className={smallBtn} onClick={() => setCreating(true)}>
              <Ion name="add" size={16} />
              New trip
            </button>
          ) : null
        }
      >
        <div className="px-4 sm:px-5">
          <FilterBar active={filtered} onClear={clear}>
            <SelectFilter label="When" value={f.when ?? ""} onChange={(v) => set("when", v)} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
          </FilterBar>
        </div>
        <PagedTable
          page={page}
          columns={tripColumns(scope, agency)}
          rowKey={(t) => t.id}
          onRowClick={(t) => setOpen(t.id)}
          failedTitle="Could not load your trips"
          empty="No trips yet. Make one for your next group: share its link, and everyone lands in the same chat, ready to book and pay."
        />
      </DeskPanel>
    </div>
  );
}

const DEPOSIT: Record<DepositState, { label: string; tone: PillTone }> = {
  paid: { label: "Paid", tone: "green" },
  partial: { label: "Part paid", tone: "amber" },
  unpaid: { label: "Not paid", tone: "quiet" },
  team: { label: "Your team", tone: "blue" },
};

const peopleColumns: Column<TripDetail["people"][number]>[] = [
  {
    key: "name",
    title: "Traveller",
    render: (p) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <PersonFace person={{ avatarUrl: p.avatarUrl, displayName: p.name, aliasHandle: p.handle }} size={32} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold text-white">{p.name}</span>
          {p.handle ? <span className="truncate text-[12px] text-white/45">@{p.handle.replace(/^@/, "")}</span> : null}
        </span>
      </span>
    ),
  },
  { key: "joined", title: "Joined", hideBelow: "md", render: (p) => (p.joinedAt ? dayLabel(p.joinedAt) : <Muted>Unknown</Muted>) },
  { key: "yours", title: "Counts for you", hideBelow: "lg", render: (p) => (p.team ? <Muted>Team</Muted> : p.broughtByYou ? "Yes" : <Muted>Came earlier</Muted>) },
  {
    key: "deposit",
    title: "Deposit",
    render: (p) => (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Pill tone={DEPOSIT[p.deposit.state].tone}>{DEPOSIT[p.deposit.state].label}</Pill>
        {p.deposit.paidUsdc > 0 ? (
          <span className="whitespace-nowrap text-[11.5px] text-white/50">
            {usd(p.deposit.paidUsdc)}
            {p.deposit.paidAt ? `, ${dayLabel(p.deposit.paidAt)}` : ""}
          </span>
        ) : null}
      </span>
    ),
  },
  { key: "bookings", title: "Bookings", align: "right", render: (p) => p.bookings.toLocaleString("en-US") },
  { key: "commission", title: "Commission", align: "right", render: (p) => <span className="font-extrabold text-white">{usd(p.commissionUsdc)}</span> },
];

function TripDetailView({ id, agency, partnerName, onBack }: { id: string; agency: boolean; partnerName: string; onBack: () => void }) {
  const detail = useTripDetail(id);
  const [qr, setQr] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const [seats, setSeats] = useState(false);
  const back = (
    <button type="button" className={smallBtn} onClick={onBack}>
      <Ion name="chevron-back" size={15} />
      All trips
    </button>
  );

  if (detail.error && !detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <div>{back}</div>
        <DeskPanel>
          <ReadFailed compact title="Could not load this trip" onRetry={() => void detail.mutate()} />
        </DeskPanel>
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="flex flex-col gap-3">
        <div>{back}</div>
        <Skeleton className="h-[140px]" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const { trip, totals, people } = detail.data;
  const travellers = people.filter((p) => !p.team);
  const expected = totals.expectedUsdc;
  const welcome = agency ? welcomeText(trip) : null;
  // The server sends `welcome` once it runs agency trips: only then is the group set up as below.
  const groupSetUp = agency && trip.welcome !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        <ExportButton path={`partners/me/export/trips/${encodeURIComponent(trip.id)}`} name={`hold-partners-trip-${fileSlug(trip.name)}.csv`} label="Export travellers" />
      </div>

      <DeskPanel title={trip.name} meta={[trip.place, when(trip), trip.runBy ? `Run by ${trip.runBy}` : null].filter(Boolean).join(", ") || undefined}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Travellers" value={totals.members.toLocaleString("en-US")} />
          <Stat label="Deposit paid" value={`${totals.paid} of ${totals.members}`} tone="green" note={totals.partial ? `${totals.partial} part paid` : undefined} />
          <Stat label="Not paid yet" value={totals.unpaid.toLocaleString("en-US")} tone="amber" />
          <Stat label="Collected" value={usd(totals.collectedUsdc)} note={expected != null ? `of ${usd(expected)} expected` : undefined} />
          <Stat label="Bookings" value={totals.bookings.toLocaleString("en-US")} />
          <Stat label="Commission" value={usd(totals.commissionUsdc)} tone="blue" />
        </div>
        {totals.unmatched.payments > 0 ? (
          <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
            {totals.unmatched.payments} {totals.unmatched.payments === 1 ? "payment" : "payments"} ({usd(totals.unmatched.usdc)}) came by card, bank or
            an outside wallet and cannot be tied to a traveller. They are in the total collected.
          </p>
        ) : null}
        {welcome ? (
          <div className="mt-4 border-t border-white/[0.08] pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <Ion name="cellular-outline" size={18} className="mt-0.5 shrink-0 text-amber" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-bold text-white">{welcome.line}</span>
                  <span className="text-[12.5px] text-white/55">{welcome.count}</span>
                </span>
              </div>
              {!seats ? (
                <button type="button" className={`${smallBtn} self-start sm:self-auto`} onClick={() => setSeats(true)}>
                  <Ion name="people-outline" size={15} />
                  {trip.maxTravellers != null ? "Change travellers" : "Set travellers"}
                </button>
              ) : null}
            </div>
            {seats ? (
              <TravellersForm
                trip={trip}
                onDone={(saved) => {
                  setSeats(false);
                  if (saved) void detail.mutate();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </DeskPanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DeskPanel title="Join link">
          {trip.joinUrl ? (
            <JoinLink url={trip.joinUrl} name={trip.name} id={trip.id} qr={qr} onQr={() => setQr((v) => !v)} />
          ) : (
            <p className="text-[13px] leading-[19px] text-white/60">
              The join link cannot be made right now. The trip&rsquo;s chat may have changed hands: open it in the HOLD app to share it, or try again in a moment.
            </p>
          )}
          {groupSetUp ? (
            <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
              Travellers who open your trip link join the {partnerName ? `${partnerName} · ${trip.name}` : trip.name} group in HOLD, with you as the only admin
              {welcome ? ", and find their welcome eSIM in the app." : "."}
            </p>
          ) : null}
        </DeskPanel>
        <DeskPanel title="Deposits">
          {trip.payLinkUrl ? (
            <>
              <p className="break-all text-[13.5px] text-white/85">{trip.payLinkUrl.replace(/^https?:\/\//, "")}</p>
              <p className="mt-1 text-[12.5px] leading-[18px] text-white/55">
                {detail.data.deposit?.perTravellerUsd ? `${usd(detail.data.deposit.perTravellerUsd)} per traveller. ` : ""}Payments land in the HOLD account that made this link.
              </p>
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
                if (made) void detail.mutate();
              }}
            />
          ) : (
            <>
              <p className="text-[13px] leading-[19px] text-white/60">Take a fixed deposit from every traveller with one link, and see here who has paid.</p>
              <button type="button" className={`${smallBtn} mt-2.5`} onClick={() => setDeposit(true)}>
                <Ion name="cash-outline" size={15} />
                Collect deposits
              </button>
            </>
          )}
        </DeskPanel>
      </div>

      <DeskPanel flush title="Who is going" meta={`${travellers.length} travellers${people.length > travellers.length ? `, ${people.length - travellers.length} from your team` : ""}`}>
        <DataTable columns={peopleColumns} rows={people} rowKey={(p) => `${p.name}-${p.joinedAt}-${p.handle}`} empty="Nobody has joined yet. Share the join link with your group." />
      </DeskPanel>
    </div>
  );
}

function JoinLink({ url, name, id, qr, onQr }: { url: string; name: string; id: string; qr: boolean; onQr: () => void }) {
  return (
    <>
      <p className="break-all text-[13.5px] text-white/85">{url.replace(/^https?:\/\//, "")}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <CopyButton value={url} className={smallBtn} />
        <button type="button" className={smallBtn} onClick={onQr} aria-expanded={qr}>
          <Ion name="qr-code-outline" size={15} />
          {qr ? "Hide QR" : "QR code"}
        </button>
      </div>
      {qr ? (
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="w-[148px] overflow-hidden rounded-[14px] bg-white p-1.5">
            <QrCode text={url} title={`QR code to join ${name}`} className="block h-auto w-full" />
          </div>
          <QrDownloads text={url} name={`hold-trip-${id.slice(0, 8)}-qr`} />
        </div>
      ) : null}
    </>
  );
}
