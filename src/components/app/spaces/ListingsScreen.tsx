"use client";

/**
 * Spaces › Listings (the app's "My spaces"): every listing, filtered by status
 * and by kind — Spaces sell zones on a product, Services sell the creator's
 * own work — and each card opens the listing.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { closesText } from "@/lib/ad-space/format";
import type { SpaceCard } from "@/lib/creator/listing";
import { useTemplates } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { dollars, EmptyState, FilterPills, Panel, ProgressBar, glass } from "../ui";
import { StatusPill } from "./common";

type StatusFilter = "all" | "live" | "draft" | "closed";
type KindFilter = "all" | "placement" | "service";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "closed", label: "Closed" },
];

export function ListingsScreen() {
  const { role } = useShell();
  return role === "manager" ? <ManagedListings /> : <OwnListings />;
}

function OwnListings() {
  const { listings } = useShell();
  const href = useHref();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const templates = useTemplates();
  const [kind, setKind] = useState<KindFilter>("all");

  const status = (STATUS_OPTIONS.some((o) => o.value === params.get("status")) ? params.get("status") : "all") as StatusFilter;
  const setStatus = (v: StatusFilter) => router.replace(v === "all" ? pathname : `${pathname}?status=${v}`, { scroll: false });

  const kindOf = useMemo(() => {
    const map = new Map((templates.data?.templates ?? []).map((t) => [t.id, t.kind]));
    return (l: SpaceCard) => map.get(l.templateId) ?? (l.serviceName ? "service" : "placement");
  }, [templates.data]);

  const byStatus = (l: SpaceCard, s: StatusFilter) =>
    s === "all" || (s === "closed" ? l.status === "closed" || l.status === "delisted" : l.status === s);
  const shown = listings
    .filter((l) => byStatus(l, status) && (kind === "all" || kindOf(l) === kind))
    .sort((a, b) => (a.status === "draft" ? -1 : 0) - (b.status === "draft" ? -1 : 0));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS.map((o) => ({ ...o, count: listings.filter((l) => byStatus(l, o.value)).length }))}
        />
        <FilterPills
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All kinds" },
            { value: "placement", label: "Spaces" },
            { value: "service", label: "Services" },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Panel>
          <EmptyState
            title={listings.length === 0 ? "No listings yet." : "No listings match."}
            action={
              <Link href={href("/listings/new")} className="text-small text-amber">
                New listing
              </Link>
            }
          />
        </Panel>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} kind={kindOf(l)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingCard({ listing: l, kind }: { listing: SpaceCard; kind: string }) {
  const href = useHref();
  const target = href(`/listings/${l.id}`);
  return (
    <Link href={target} className={`${glass} flex h-full min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-white/[0.06]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-text">{l.serviceName || l.title}</p>
          <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">
            {kind === "service" ? "Service" : "Space"}
            {l.event ? ` · ${l.event.name}` : ""}
          </p>
        </div>
        <StatusPill status={l.status} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        <div>
          <p className="text-[22px] font-medium leading-none tabular-nums text-text">{dollars(l.totals.committedCents)}</p>
          <p className="mt-1 text-[11px] text-[#9FB7C2]">
            {l.totals.sold}/{l.totals.positions} sold{l.fundingGoalCents ? ` · goal ${dollars(l.fundingGoalCents)}` : ""}
          </p>
        </div>
        {l.awaitingReview > 0 ? (
          <span className="inline-flex h-6 items-center rounded-[12px] border border-amber/40 bg-amber/10 px-2.5 text-tiny text-amber">
            {l.awaitingReview} artwork
          </span>
        ) : null}
      </div>
      <ProgressBar value={l.totals.sold} max={l.totals.positions} />
      <p className="text-[11px] text-[#7F97A3]">
        {l.status === "draft" ? "Draft · only you see it" : closesText(l.closesAt, l.status === "closed")}
      </p>
    </Link>
  );
}

function ManagedListings() {
  const { managed } = useShell();
  const href = useHref();
  return managed.length === 0 ? (
    <Panel>
      <EmptyState title="No listings yet." />
    </Panel>
  ) : (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {managed.map((m) => (
        <li key={m.spaceId}>
          <Link href={href(`/listings/${m.spaceId}`)} className={`${glass} flex h-full min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-white/[0.06]`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-small font-medium text-text">{m.title}</p>
              <StatusPill status={m.status} />
            </div>
            <p className="truncate text-tiny text-[#9FB7C2]">{m.eventName ?? "No event"}</p>
            <p className="mt-auto text-[11px] text-[#7F97A3]">{m.closesAt ? closesText(m.closesAt, m.status === "closed") : ""}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
