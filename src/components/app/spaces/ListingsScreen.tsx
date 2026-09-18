"use client";

/**
 * Spaces › Listings (the app's "My spaces"): every listing as a card with its
 * own picture, filtered by status and by kind — Spaces sell zones on a
 * product, Services sell the creator's own work — a page of cards at a time,
 * and each card opens the listing.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { closesText } from "@/lib/ad-space/format";
import type { SpaceCard } from "@/lib/creator/listing";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { dollars, EmptyState, FilterPills, Panel, ProgressBar } from "../ui";
import { StatusPill } from "./common";
import { cardCls, CardGrid, Cover, Pager, useListingKind, usePaged } from "./cards";

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
  const kindOf = useListingKind();
  const [kind, setKind] = useState<KindFilter>("all");

  const status = (STATUS_OPTIONS.some((o) => o.value === params.get("status")) ? params.get("status") : "all") as StatusFilter;
  const setStatus = (v: StatusFilter) => router.replace(v === "all" ? pathname : `${pathname}?status=${v}`, { scroll: false });

  const byStatus = (l: SpaceCard, s: StatusFilter) =>
    s === "all" || (s === "closed" ? l.status === "closed" || l.status === "delisted" : l.status === s);
  const shown = listings
    .filter((l) => byStatus(l, status) && (kind === "all" || kindOf(l) === kind))
    .sort((a, b) => (a.status === "draft" ? -1 : 0) - (b.status === "draft" ? -1 : 0));

  const paged = usePaged(shown, `${status}:${kind}`);

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
        <>
          <CardGrid>
            {paged.shown.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} kind={kindOf(l)} />
              </li>
            ))}
          </CardGrid>
          <Pager {...paged} />
        </>
      )}
    </div>
  );
}

function ListingCard({ listing: l, kind }: { listing: SpaceCard; kind: string }) {
  const href = useHref();
  return (
    <Link href={href(`/listings/${l.id}`)} className={cardCls}>
      <Cover url={l.bannerUrl} gradient={l.bannerGradient}>
        <StatusPill status={l.status} onPhoto />
      </Cover>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-text">{l.serviceName || l.title}</p>
          <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">
            {l.event ? l.event.name : kind === "service" ? "Service" : "Space"}
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-[22px] font-medium leading-none tabular-nums text-text">{dollars(l.totals.committedCents)}</p>
          <p className="text-tiny tabular-nums text-[#9FB7C2]">
            {l.totals.sold}/{l.totals.positions} sold
          </p>
        </div>
        <ProgressBar value={l.totals.sold} max={l.totals.positions} />
      </div>
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
    <CardGrid>
      {managed.map((m) => (
        <li key={m.spaceId}>
          <Link href={href(`/listings/${m.spaceId}`)} className={cardCls}>
            <Cover>
              <StatusPill status={m.status} onPhoto />
            </Cover>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <p className="truncate text-small font-medium text-text">{m.title}</p>
              <p className="truncate text-tiny text-[#9FB7C2]">{m.eventName ?? "No event"}</p>
              <p className="mt-auto pt-2 text-[11px] text-[#7F97A3]">{m.closesAt ? closesText(m.closesAt, m.status === "closed") : ""}</p>
            </div>
          </Link>
        </li>
      ))}
    </CardGrid>
  );
}
