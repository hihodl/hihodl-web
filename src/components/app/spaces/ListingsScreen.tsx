"use client";

/**
 * Spaces › Listings (the app's "My spaces"): every listing as a card with its
 * own picture, filtered by status and by kind — Spaces sell zones on a
 * product, Services sell the creator's own work — a page of cards at a time,
 * and each card opens the listing.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { closesText } from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
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

/** Two rows of four on a laptop: the page never grows past one screen. */
const PAGE = 8;

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

  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [status, kind]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages - 1);

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
            {shown.slice(at * PAGE, at * PAGE + PAGE).map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} kind={kindOf(l)} />
              </li>
            ))}
          </CardGrid>
          <Pager page={at} pages={pages} total={shown.length} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">{children}</ul>;
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn =
    "inline-flex h-8 items-center rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny text-[#CFE3EC] transition-colors hover:bg-white/10 disabled:opacity-40";
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2">
      <span className="text-tiny tabular-nums text-[#9FB7C2]">
        {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}
      </span>
      <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/** The listing's own picture, or its gradient. Never the event's photo. */
function Cover({ url, gradient, children }: { url?: string | null; gradient?: string | null; children?: ReactNode }) {
  return (
    <div
      className="relative h-[112px] shrink-0 overflow-hidden rounded-t-[18px] xl:h-[128px]"
      style={url ? undefined : { background: gradientCss(gradient) }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,20,0)_40%,rgba(4,12,20,0.6)_100%)]" />
      <div className="absolute left-3 top-3">{children}</div>
    </div>
  );
}

const cardCls = `${glass} flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:bg-white/[0.06]`;

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
