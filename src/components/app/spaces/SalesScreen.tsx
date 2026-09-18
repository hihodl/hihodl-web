"use client";

/**
 * Spaces › Sales: what reached the creator's wallet, order by order.
 *
 * `receivedUsdc` is the server's own figure for the creator's leg of every
 * paid order — not what sponsors were charged — so the headline says
 * "Received" and nothing else borrows the word.
 */

import { useMemo, useState } from "react";

import { chainName } from "@/lib/creator/team";
import { cents } from "@/lib/app/spaces-model";
import { useSales } from "@/lib/app/spaces-data";

import { dollars, EmptyState, FilterPills, KpiTile, Panel, Skeleton } from "../ui";
import { ReadError, shortDay } from "./common";

const ORDER_STATUS: Record<string, string> = {
  paid: "Paid",
  confirmed: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

export function SalesScreen() {
  const sales = useSales();
  const [chain, setChain] = useState("all");
  const [listing, setListing] = useState("all");

  const rows = useMemo(() => sales.data?.recent ?? [], [sales.data]);
  const chains = [...new Set(rows.map((r) => r.chain))];
  const listings = [...new Map(rows.map((r) => [r.spaceId, r.serviceName || r.spaceTitle])).entries()];
  const shown = rows.filter((r) => (chain === "all" || r.chain === chain) && (listing === "all" || r.spaceId === listing));
  const shownCents = shown.reduce((n, r) => n + cents(r.receivedUsdc), 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile label="Received" value={sales.data ? dollars(cents(sales.data.receivedUsdc)) : "…"} unit="USDC" />
        <KpiTile label="Orders" value={sales.data?.orders ?? "…"} />
        <KpiTile label="Spots sold" value={sales.data?.soldSpots ?? "…"} />
        <KpiTile label="Listings with sales" value={sales.data?.spaces ?? "…"} />
      </section>

      <ReadError error={sales.error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Chain"
          value={chain}
          onChange={setChain}
          options={[{ value: "all", label: "All chains" }, ...chains.map((c) => ({ value: c, label: chainName(c) }))]}
        />
        {listings.length > 1 ? (
          <label className="flex items-center gap-2 text-tiny text-[#9FB7C2]">
            <span className="sr-only">Listing</span>
            <select
              value={listing}
              onChange={(e) => setListing(e.target.value)}
              className="h-8 max-w-[260px] rounded-[10px] border border-white/10 bg-[rgba(3,12,16,0.6)] px-2 text-tiny text-text outline-none"
            >
              <option value="all">All listings</option>
              {listings.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <Panel title="Orders" meta={sales.data ? `${shown.length} · ${dollars(shownCents)}` : ""}>
        {!sales.data && !sales.error ? (
          <Skeleton className="h-60" />
        ) : shown.length === 0 ? (
          <EmptyState title="No sales yet." />
        ) : (
          <div className="-mx-1 max-h-[calc(var(--app-vh,100dvh)-420px)] min-h-[240px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-small">
              <thead className="sticky top-0 bg-[rgba(6,18,30,0.95)]">
                <tr className="text-[11px] text-[#9FB7C2]">
                  <th className="px-2 py-2 font-normal">Date</th>
                  <th className="px-2 py-2 font-normal">Listing</th>
                  <th className="px-2 py-2 font-normal">Spot</th>
                  <th className="px-2 py-2 font-normal">Chain</th>
                  <th className="px-2 py-2 font-normal">Status</th>
                  <th className="px-2 py-2 text-right font-normal">To you</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.orderId} className="border-t border-white/[0.06]">
                    <td className="whitespace-nowrap px-2 py-2.5 text-[#CFE3EC]">{shortDay(r.paidAt)}</td>
                    <td className="max-w-[260px] truncate px-2 py-2.5 text-text">{r.serviceName || r.spaceTitle}</td>
                    <td className="max-w-[160px] truncate px-2 py-2.5 text-[#CFE3EC]">{r.zoneKey}</td>
                    <td className="px-2 py-2.5 text-[#CFE3EC]">{chainName(r.chain)}</td>
                    <td className="px-2 py-2.5 text-[#CFE3EC]">{ORDER_STATUS[r.status] ?? r.status}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-text">{r.receivedUsdc} USDC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
