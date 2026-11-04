"use client";

/**
 * Who the partner brought: when they joined, through which link or trip and
 * which member, what they booked and what it earned. A name shows when the
 * traveller is in one of the partner's trips (they already share a chat);
 * anyone else is initials. Filtered on the server; the export matches.
 */

import { dayLabel, queryOf, usd, useLinks, usePaged, useTeam, type Scope, type Traveller, type TripName } from "@/lib/app/partners";

import { Ion } from "../ion";
import { useFilters } from "./CommissionsSection";
import { DateFilter, DeskPanel, ExportButton, FilterBar, Muted, PagedTable, SelectFilter, type Column } from "./desk";
import { KIND, Pill } from "./kit";

function columns(scope: Scope): Column<Traveller>[] {
  const cols: Column<Traveller>[] = [
    {
      key: "name",
      title: "Traveller",
      render: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-bold text-white">{t.name}</span>
          <span className="truncate text-[12px] text-white/45">Joined {dayLabel(t.joinedAt)}</span>
        </span>
      ),
    },
    {
      key: "via",
      title: "Came through",
      hideBelow: "md",
      render: (t) =>
        t.source === "group" ? (
          <Pill tone="blue">Trip</Pill>
        ) : t.linkCode ? (
          <span className="font-mono text-[12.5px] text-white/70">{t.linkCode}</span>
        ) : (
          <Muted>Link</Muted>
        ),
    },
    { key: "member", title: "Brought by", hideBelow: "lg", render: (t) => t.memberName ?? <Muted>Partner</Muted> },
    { key: "trips", title: "Trips", hideBelow: "md", render: (t) => (t.trips.length ? <span className="line-clamp-2">{t.trips.join(", ")}</span> : <Muted>None</Muted>) },
    {
      key: "products",
      title: "Booked",
      render: (t) =>
        t.products.length ? (
          <span className="inline-flex gap-1.5">
            {t.products.map((p) => (
              <span key={p} title={KIND[p]?.label} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                <Ion name={KIND[p]?.icon ?? "bed-outline"} size={14} />
              </span>
            ))}
          </span>
        ) : (
          <Muted>Not yet</Muted>
        ),
    },
    { key: "bookings", title: "Bookings", align: "right", hideBelow: "sm", render: (t) => t.bookings.toLocaleString("en-US") },
    { key: "commission", title: "Commission", align: "right", render: (t) => <span className="font-extrabold text-white">{usd(t.commissionUsdc)}</span> },
    { key: "last", title: "Last booking", hideBelow: "xl", render: (t) => (t.lastBookedAt ? dayLabel(t.lastBookedAt) : <Muted>None</Muted>) },
    { key: "until", title: "Counts until", hideBelow: "xl", render: (t) => dayLabel(t.attributedUntil) },
  ];
  return scope === "team" ? cols : cols.filter((c) => c.key !== "member");
}

export function TravellersSection({ scope, trips }: { scope: Scope; trips: TripName[] }) {
  const team = scope === "team";
  const { f, set, setMany, clear, active } = useFilters();
  const page = usePaged<Traveller>("partners/me/travellers", { scope, ...f });
  const members = useTeam(team);
  const links = useLinks(true, scope);
  const qs = queryOf({ scope, ...f });

  return (
    <DeskPanel
      flush
      title="Travellers"
      meta={page.total ? `${(page.total.count ?? 0).toLocaleString("en-US")} people` : "Everyone who came in through your links and trips"}
      actions={<ExportButton path={`partners/me/export/travellers?${qs}`} name="hold-partners-travellers.csv" />}
    >
      <div className="px-4 sm:px-5">
        <FilterBar active={active} onClear={clear}>
          <DateFilter from={f.from ?? ""} to={f.to ?? ""} onChange={(from, to) => setMany({ from, to })} />
          <SelectFilter label="Booked" value={f.booked ?? ""} onChange={(v) => set("booked", v)} options={[{ value: "yes", label: "Booked" }, { value: "no", label: "Not yet" }]} />
          {trips.length ? <SelectFilter label="Trip" value={f.tripId ?? ""} onChange={(v) => set("tripId", v)} options={trips.map((t) => ({ value: t.id, label: t.name }))} /> : null}
          {team && members.data?.length ? (
            <SelectFilter label="Member" value={f.memberId ?? ""} onChange={(v) => set("memberId", v)} options={members.data.map((m) => ({ value: m.memberId, label: m.name }))} />
          ) : null}
          {links.data?.some((l) => l.id) ? (
            <SelectFilter label="Link" value={f.linkId ?? ""} onChange={(v) => set("linkId", v)} options={links.data.filter((l) => l.id).map((l) => ({ value: l.id!, label: l.label ? `${l.code} (${l.label})` : l.code }))} />
          ) : null}
        </FilterBar>
        <p className="mb-3 text-[12.5px] leading-[18px] text-white/50">
          Names show for travellers in one of your trips. Everyone else shows as initials. HOLD never shares an email or an address.
        </p>
      </div>
      <PagedTable
        page={page}
        columns={columns(scope)}
        rowKey={(t) => t.id}
        failedTitle="Could not load travellers"
        empty={active ? "Nobody matches these filters." : "Nobody yet. Share your link or a trip, and everyone who signs up through it shows up here."}
      />
    </DeskPanel>
  );
}
