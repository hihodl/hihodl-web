"use client";

/**
 * Every commission, one row per booking cut: when it was booked, by whom,
 * through which link and member, HOLD's margin, the share, the amount, who it
 * is paid to and where it stands. Filtered on the server by dates, product,
 * status, trip, member and link; the export is exactly what is filtered.
 */

import { useState } from "react";

import { dayLabel, pct, queryOf, usd, useLinks, usePaged, useTeam, type Commission, type CommissionStatus, type Scope, type TripRow } from "@/lib/app/partners";

import { Ion } from "../ion";
import { DateFilter, DeskPanel, ExportButton, FilterBar, Muted, PagedTable, SelectFilter, type Column } from "./desk";
import { KIND, Pill, type PillTone } from "./kit";

const STATUS: Record<CommissionStatus, { label: string; tone: PillTone }> = {
  pending: { label: "Pending", tone: "blue" },
  payable: { label: "Payable", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  void: { label: "Cancelled", tone: "quiet" },
};

export function CommissionStatusPill({ c }: { c: Pick<Commission, "status" | "clawback"> }) {
  if (c.clawback) return <Pill tone="quiet">Clawback</Pill>;
  const s = STATUS[c.status] ?? STATUS.pending;
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function commissionColumns(scope: Scope): Column<Commission>[] {
  const cols: Column<Commission>[] = [
    { key: "bookedAt", title: "Booked", render: (c) => <span className="whitespace-nowrap">{dayLabel(c.bookedAt)}</span> },
    {
      key: "kind",
      title: "Product",
      render: (c) => {
        const k = KIND[c.kind] ?? KIND.stay;
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Ion name={k.icon} size={15} className="text-white/60" />
            {k.label}
          </span>
        );
      },
    },
    { key: "traveller", title: "Traveller", render: (c) => <span className="font-bold text-white">{c.traveller}</span> },
    { key: "member", title: "Brought by", hideBelow: "lg", render: (c) => c.memberName ?? <Muted>Partner</Muted> },
    { key: "link", title: "Link", hideBelow: "xl", render: (c) => (c.linkCode ? <span className="font-mono text-[12.5px] text-white/70">{c.linkCode}</span> : <Muted>Trip</Muted>) },
    { key: "margin", title: "HOLD margin", align: "right", hideBelow: "md", render: (c) => usd(c.marginUsd) },
    { key: "share", title: "Share", align: "right", hideBelow: "lg", render: (c) => pct(c.shareBps) },
    {
      key: "commission",
      title: "Commission",
      align: "right",
      render: (c) => (
        <span className={`font-extrabold ${c.status === "void" ? "text-white/40 line-through" : c.clawback ? "text-white/60" : "text-white"}`}>{usd(c.commissionUsdc)}</span>
      ),
    },
    {
      key: "payee",
      title: "Paid to",
      hideBelow: "md",
      render: (c) => (c.payee === "me" ? "You" : c.payee),
    },
    {
      key: "status",
      title: "Status",
      render: (c) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <CommissionStatusPill c={c} />
          {c.status === "pending" && c.payableAfter ? <span className="whitespace-nowrap text-[11.5px] text-white/45">after {dayLabel(c.payableAfter)}</span> : null}
        </span>
      ),
    },
  ];
  return scope === "team" ? cols : cols.filter((c) => c.key !== "member");
}

export type Filters = Record<string, string>;

export function useFilters(initial: Filters = {}) {
  const [f, setF] = useState<Filters>(initial);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const active = Object.values(f).some(Boolean);
  return { f, set, setMany: (p: Filters) => setF((x) => ({ ...x, ...p })), clear: () => setF({}), active };
}

export function CommissionsSection({ scope, trips }: { scope: Scope; trips: TripRow[] }) {
  const team = scope === "team";
  const { f, set, setMany, clear, active } = useFilters();
  const page = usePaged<Commission>("partners/me/commissions", { scope, ...f });
  const members = useTeam(team);
  const links = useLinks(true, scope);
  const qs = queryOf({ scope, ...f });

  return (
    <DeskPanel
      flush
      title="Commissions"
      meta={
        page.total
          ? `${(page.total.count ?? 0).toLocaleString("en-US")} rows, ${usd(page.total.commissionUsdc ?? 0)} not counting cancelled`
          : "Every booking your travellers made"
      }
      actions={<ExportButton path={`partners/me/export/commissions?${qs}`} name="hold-partners-commissions.csv" />}
    >
      <div className="px-4 sm:px-5">
        <FilterBar active={active} onClear={clear}>
          <DateFilter from={f.from ?? ""} to={f.to ?? ""} onChange={(from, to) => setMany({ from, to })} />
          <SelectFilter label="Product" value={f.kind ?? ""} onChange={(v) => set("kind", v)} options={[{ value: "stay", label: "Stays" }, { value: "flight", label: "Flights" }, { value: "esim", label: "eSIMs" }]} />
          <SelectFilter
            label="Status"
            value={f.status ?? ""}
            onChange={(v) => set("status", v)}
            options={[
              { value: "pending", label: "Pending" },
              { value: "payable", label: "Payable" },
              { value: "paid", label: "Paid" },
              { value: "void", label: "Cancelled" },
            ]}
          />
          {trips.length ? <SelectFilter label="Trip" value={f.tripId ?? ""} onChange={(v) => set("tripId", v)} options={trips.map((t) => ({ value: t.id, label: t.name }))} /> : null}
          {team && members.data?.length ? (
            <SelectFilter label="Member" value={f.memberId ?? ""} onChange={(v) => set("memberId", v)} options={members.data.map((m) => ({ value: m.memberId, label: m.name }))} />
          ) : null}
          {links.data?.some((l) => l.id) ? (
            <SelectFilter label="Link" value={f.linkId ?? ""} onChange={(v) => set("linkId", v)} options={links.data.filter((l) => l.id).map((l) => ({ value: l.id!, label: l.label ? `${l.code} (${l.label})` : l.code }))} />
          ) : null}
          <SelectFilter label="Paid to" value={f.payee ?? ""} onChange={(v) => set("payee", v)} options={[{ value: "me", label: "Only me" }]} />
        </FilterBar>
      </div>
      <PagedTable
        page={page}
        columns={commissionColumns(scope)}
        rowKey={(c) => c.id}
        failedTitle="Could not load commissions"
        empty={active ? "No commissions match these filters." : "Nothing yet. When a traveller you brought books a stay, a flight or an eSIM, it shows up here."}
      />
    </DeskPanel>
  );
}
