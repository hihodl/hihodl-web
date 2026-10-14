"use client";

/**
 * A partner's numbers at a glance: the funnel (visits, signups, travellers
 * who booked, bookings), what it earned and where that money is, twelve
 * months of bars, what each product brings, the link, and the latest
 * commissions. Every figure is the server's, read from the ledgers: what was
 * earned and received never moves when the money is spent from Savings.
 */

import Link from "next/link";
import { useMemo } from "react";

import { dayLabel, monthLabel, usd, usePaged, type Commission, type PartnerDashboard, type PartnerMe, type Scope } from "@/lib/app/partners";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { KpiTile, Skeleton } from "../ui";
import { commissionColumns } from "./CommissionsSection";
import { DataTable, DeskPanel, smallBtn, Stat, type Section } from "./desk";
import { KIND } from "./kit";
import { LinkCard } from "./LinkCard";

export function OverviewSection({
  data,
  link,
  scope,
  paid,
  onLinkSaved,
  go,
}: {
  data: PartnerDashboard;
  /** Paid at all: the owner, or anyone in split mode. Nobody else is asked for billing. */
  paid: boolean;
  /** The link this person shares: the partner's for the owner, their own for everyone else. */
  link: string;
  scope: Scope;
  onLinkSaved: (me: PartnerMe) => void;
  go: (s: Section) => void;
}) {
  const t = data.totals;
  const recent = usePaged<Commission>("partners/me/commissions", { scope, limit: "6" });
  const columns = useMemo(() => commissionColumns(scope).filter((c) => ["bookedAt", "kind", "traveller", "commission", "status"].includes(c.key)), [scope]);
  const team = scope === "team";
  const productHref = useProductHref();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Link visits" value={t.visits.toLocaleString("en-US")} note="Opens of your invite pages" />
        <KpiTile label="Signups" value={t.signups.toLocaleString("en-US")} note={team ? "Through the team's links" : "Through your links"} />
        <KpiTile
          label="Travellers who booked"
          value={t.travellers.toLocaleString("en-US")}
          note={t.signups ? `${Math.round(t.conversion * 100)}% of signups` : "Of your signups"}
        />
        <KpiTile label="Bookings" value={t.bookings.toLocaleString("en-US")} note="Stays, flights and eSIMs" />
        <KpiTile label="Earned" value={usd(t.earnedUsdc)} note={`${usd(t.receivedUsdc)} received`} attention={t.earnedUsdc > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <DeskPanel title="Where the money is" meta={team ? "The whole team" : "What you brought"}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Pending" value={usd(t.pendingUsdc)} tone="blue" note="Trip not taken yet" />
            <Stat label="Payable" value={usd(t.payableUsdc)} tone="amber" note="Goes out next payout" />
            <Stat label="Paid" value={usd(t.paidUsdc)} tone="green" note="Sent to Savings" />
            <Stat label="Received by you" value={usd(data.mine.receivedUsdc)} note={`${usd(data.mine.payableUsdc)} payable to you`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[13px]">
            <span className="flex items-center gap-2 font-bold text-white">
              <Ion name="calendar-outline" size={16} className="text-amber" />
              {data.payoutsEnabled
                ? `Next payout ${dayLabel(data.nextPayoutOn.slice(0, 10))}, minimum ${usd(data.payoutMinUsdc).replace(/\.00$/, "")}`
                : "Payouts start soon"}
            </span>
            <span className="text-white/55">
              Payouts land in your HOLD Savings in USDC. What you earned here stays the same when you spend or move it.
            </span>
            {paid && data.billing !== "verified" ? (
              <button type="button" className="font-bold text-amber underline-offset-2 hover:underline" onClick={() => go("settings")}>
                {data.billing === "missing" ? "Add your billing details to get paid" : "Billing details in review"}
              </button>
            ) : null}
          </div>
        </DeskPanel>

        <DeskPanel title="By product">
          <ul className="flex flex-col gap-3">
            {data.byProduct.map((p) => {
              const max = Math.max(1, ...data.byProduct.map((x) => x.commissionUsdc));
              const k = KIND[p.kind];
              return (
                <li key={p.kind} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                    <Ion name={k.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-bold text-white">{k.label}</span>
                      <span className="text-[14px] font-extrabold tabular-nums text-white">{usd(p.commissionUsdc)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <span className="block h-full rounded-full bg-amber" style={{ width: `${Math.max(p.commissionUsdc > 0 ? 3 : 0, (p.commissionUsdc / max) * 100)}%` }} />
                    </span>
                    <span className="mt-1 block text-[12px] text-white/50">{p.bookings.toLocaleString("en-US")} bookings</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </DeskPanel>
      </div>

      <DeskPanel title="Last 12 months">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Bars title="Signups" values={data.months.map((m) => m.signups)} labels={data.months.map((m) => monthLabel(m.month, true))} format={(n) => n.toLocaleString("en-US")} color="#8ECAE6" />
          <Bars title="Bookings" values={data.months.map((m) => m.bookings)} labels={data.months.map((m) => monthLabel(m.month, true))} format={(n) => n.toLocaleString("en-US")} color="#C9D4E0" />
          <Bars title="Commission" values={data.months.map((m) => m.commissionUsdc)} labels={data.months.map((m) => monthLabel(m.month, true))} format={(n) => usd(n)} color="#FFB703" />
        </div>
      </DeskPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <LinkCard partner={data.partner} link={link} onSaved={onLinkSaved} canEdit={data.me.role === "owner"} />
        <DeskPanel
          flush
          title="Latest commissions"
          actions={
            <button type="button" className={smallBtn} onClick={() => go("commissions")}>
              See all
              <Ion name="chevron-forward" size={14} />
            </button>
          }
        >
          {recent.error && recent.items.length === 0 ? (
            <ReadFailed title="Could not load the latest commissions" onRetry={() => recent.reload()} />
          ) : recent.loading && recent.items.length === 0 ? (
            <Skeleton className="m-4 h-[120px]" />
          ) : (
            <DataTable
              columns={columns}
              rows={recent.items}
              rowKey={(c) => c.id}
              empty="Nothing yet. When a traveller you brought books a stay, a flight or an eSIM, it shows up here."
            />
          )}
        </DeskPanel>
      </div>

      {/* Ad Space is part of HOLD Partners: sponsorships of a space or an event. */}
      <Link
        href={productHref("/spaces")}
        className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.07]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/[0.14] text-amber">
          <Ion name="megaphone-outline" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-white">Ad Space comes with HOLD Partners</span>
          <span className="mt-0.5 block text-[13px] leading-[19px] text-white/60">
            Sell sponsorships of your space or your events. Brands book a spot and pay you directly.
          </span>
        </span>
        <Ion name="chevron-forward" size={16} className="shrink-0 text-white/40" />
      </Link>
    </div>
  );
}

function Bars({ title, values, labels, format, color }: { title: string; values: number[]; labels: string[]; format: (n: number) => string; color: string }) {
  const max = Math.max(0, ...values);
  const last = values[values.length - 1] ?? 0;
  const sum = values.reduce((s, v) => s + v, 0);
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-strong text-[#9FB7C2]">{title}</span>
        <span className="text-[13px] font-bold tabular-nums text-white">
          {format(last)} <span className="font-normal text-white/50">this month, {format(sum)} in 12</span>
        </span>
      </figcaption>
      <div className="mt-3 flex h-[96px] items-end gap-1" role="img" aria-label={`${title}: ${values.map((v, i) => `${labels[i]} ${format(v)}`).join(", ")}`}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${labels[i]}: ${format(v)}`}>
            <div
              className="w-full rounded-t-[3px]"
              style={{ height: max > 0 ? `${Math.max(v > 0 ? 4 : 2, (v / max) * 100)}%` : "2px", background: v > 0 ? color : "rgba(255,255,255,0.12)" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {labels.map((l, i) => (
          <span key={i} className={`min-w-0 flex-1 truncate text-center text-[10.5px] text-white/45 ${i % 2 ? "hidden sm:block" : ""}`}>
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}

