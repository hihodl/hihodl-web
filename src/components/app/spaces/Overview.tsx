"use client";

/**
 * Spaces › Overview: how the listings are doing, and what is waiting on you.
 *
 * The dashboard's executive screen, for one creator: four big numbers, a row
 * of small ones, one chart with a segmented control, then the two panels that
 * lead somewhere — what needs you, and what is live. Every figure is a link to
 * the screen that explains it; nothing here is explained in prose.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { baseOf, groupByMember, pendingSeat, usdcText } from "@/lib/creator/team";
import {
  cents,
  dueSoon,
  paidSales,
  memberDeliveries,
  ownerDeliveries,
  salesByWeek,
  waitingOnYou,
  type DeliveryItem,
} from "@/lib/app/spaces-model";
import {
  useEarnings,
  useListingViews,
  useManagedOffers,
  useOffers,
  useOwed,
  useSales,
} from "@/lib/app/spaces-data";
import type { OfferView, SalesSummary } from "@/lib/creator/listing";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { dollars, EmptyState, KpiTile, MiniMetric, Panel, ProgressBar, RowLink, Segmented, Skeleton, glass } from "../ui";
import { dueText, ReadError, StatusPill } from "./common";
import { ReadyToPublish } from "./ReadyToPublish";
import { useOffersContent } from "./ContentOffer";

/** A sale stays in "Needs you" as a content lead this long: the brand just paid, and is listening. */
const LEAD_DAYS = 7;

/**
 * The Overview is exactly as tall as the sidebar on a wide screen: the column
 * it sits in is, and the last row of panels takes what is left, so its bottom
 * edge is the sidebar's. The panels show a few rows and link to the rest.
 */
const FILL = "flex flex-col gap-4 lg:flex-1";
const BOTTOM = "grid grid-cols-[minmax(0,1fr)] gap-4 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]";
/** Rows in "Needs you" and "Live". */
const ROWS = 3;

export function Overview() {
  const { role } = useShell();
  return role === "manager" ? <ManagerOverview /> : <CreatorOverview />;
}

/* ── Creator ──────────────────────────────────────────────────────── */

function CreatorOverview() {
  const { listings, work, agency } = useShell();
  const href = useHref();
  const sales = useSales();
  const offers = useOffers();
  const owed = useOwed(agency.on);
  const running = useMemo(() => listings.filter((l) => l.status !== "draft").map((l) => l.id), [listings]);
  const views = useListingViews(running);

  const own = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);
  const deliveries = useMemo(
    () => [...ownerDeliveries(views.data ?? []), ...memberDeliveries(work, own)],
    [views.data, work, own],
  );
  const due = dueSoon(deliveries);
  const waiting = waitingOnYou(offers.data ?? []);
  const bids = waiting.filter((o) => o.kind === "bid").length;

  const live = listings.filter((l) => l.status === "live");
  const committed = listings.reduce((n, l) => n + l.totals.committedCents, 0);
  const goal = listings.reduce((n, l) => n + (l.fundingGoalCents ?? 0), 0);
  const positions = live.reduce((n, l) => n + l.totals.positions, 0);
  const sold = live.reduce((n, l) => n + l.totals.sold, 0);
  const owedToTeam = groupByMember(owed.data ?? []).reduce((n, g) => n + g.owedBase, 0n);
  const artwork = deliveries.filter((d) => d.kind === "artwork").length;

  // A brand that just took a spot: offer them content (a spot is often where a content deal starts).
  const offersContent = useOffersContent();
  const leads = useMemo(() => {
    const since = Date.now() - LEAD_DAYS * 86_400_000;
    return paidSales(sales.data)
      .filter((r) => r.status === "paid" && r.sponsorName && r.paidAt && Date.parse(r.paidAt) >= since)
      .filter((r) => offersContent(listings.find((l) => l.id === r.spaceId)))
      .map((r) => ({ orderId: r.orderId, spaceId: r.spaceId, brand: r.sponsorName!, listing: r.serviceName || r.spaceTitle }));
  }, [sales.data, listings, offersContent]);

  return (
    <div className={FILL}>
      <ReadyToPublish compact />
      <section aria-label="Position" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label="Received"
          value={sales.data ? dollars(cents(sales.data.receivedUsdc)) : "…"}
          note={sales.data ? `${sales.data.orders} orders · ${sales.data.spaces} listings` : " "}
          href={href("/sales")}
        />
        <KpiTile
          label="Committed"
          value={dollars(committed)}
          note={goal > 0 ? `${Math.round((committed / goal) * 100)}% of ${dollars(goal)} goal` : `${sold} of ${positions} spots sold`}
          href={href("/listings")}
        />
        <KpiTile
          label="Offers & bids waiting"
          value={offers.data ? waiting.length : "…"}
          note={`${bids} ${bids === 1 ? "bid" : "bids"}`}
          href={href("/offers")}
          attention={waiting.length > 0}
        />
        <KpiTile
          label="Due in 7 days"
          value={views.data ? due.length : "…"}
          note={`${artwork} artwork to approve`}
          href={href("/deliveries")}
          attention={due.length > 0}
        />
      </section>

      <section aria-label="Rates" className={`${glass} grid grid-cols-3 gap-x-5 gap-y-2 px-5 py-3 sm:grid-cols-6`}>
        <MiniMetric label="Live listings" value={live.length} href={href("/listings?status=live")} />
        <MiniMetric label="Drafts" value={listings.filter((l) => l.status === "draft").length} href={href("/listings?status=draft")} />
        <MiniMetric label="Open spots" value={positions - sold} href={href("/listings?status=live")} />
        <MiniMetric label="Spots sold" value={sales.data?.soldSpots ?? "…"} href={href("/sales")} />
        {agency.on ? (
          <MiniMetric label="Owed to team" value={usdcText(owedToTeam).replace(/\.00$/, "")} href={href("/team?tab=owed")} />
        ) : (
          <MiniMetric
            label="Closed"
            value={listings.filter((l) => l.status === "closed" || l.status === "delisted").length}
            href={href("/listings?status=closed")}
          />
        )}
        <MiniMetric label="Sell-through" value={<span className="text-[14px]">{positions ? `${Math.round((sold / positions) * 100)}%` : "–"}</span>} />
      </section>

      <SalesChart sales={sales.data} loading={!sales.data && !sales.error} />
      <ReadError error={sales.error ?? offers.error} />

      <div className={BOTTOM}>
        <NeedsYou offers={waiting} deliveries={due} leads={leads} loading={!offers.data || !views.data} />
        <Panel title="Live" meta={`${live.length}`} action={<Link href={href("/listings")} className="text-tiny text-[#9FB7C2] hover:text-text">All listings</Link>}>
          {live.length === 0 ? (
            <EmptyState title="Nothing live." action={<Link href={href("/listings/new")} className="text-small text-amber">Pick your hook</Link>} />
          ) : (
            <ul className="flex flex-col gap-1">
              {live.slice(0, ROWS).map((l) => (
                <li key={l.id}>
                  <RowLink
                    href={href(`/listings/${l.id}`)}
                    title={l.serviceName || l.title}
                    sub={
                      <span className="flex items-center gap-2">
                        <span className="w-20 shrink-0">
                          <ProgressBar value={l.totals.sold} max={l.totals.positions} />
                        </span>
                        {l.totals.sold}/{l.totals.positions} sold
                      </span>
                    }
                    right={<span className="text-small tabular-nums text-text">{dollars(l.totals.committedCents)}</span>}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Received money per week, or orders per week. */
function SalesChart({ sales, loading }: { sales: SalesSummary | undefined; loading: boolean }) {
  const [mode, setMode] = useState<"usdc" | "orders">("usdc");
  const points = useMemo(() => salesByWeek(sales), [sales]);
  const values = points.map((p) => (mode === "usdc" ? p.cents : p.orders));
  const max = Math.max(1, ...values);

  return (
    <Panel
      title="Sales"
      meta="last 8 weeks"
      action={
        <Segmented
          label="Measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "usdc", label: "USDC" },
            { value: "orders", label: "Orders" },
          ]}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="flex h-28 items-end gap-1.5 sm:gap-3" role="img" aria-label="Sales per week">
          {points.map((p, i) => {
            const v = values[i];
            const h = v === 0 ? 2 : Math.max(6, Math.round((v / max) * 72));
            return (
              <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="truncate text-[10px] tabular-nums text-[#9FB7C2]">
                  {v === 0 ? "" : mode === "usdc" ? dollars(v) : v}
                </span>
                <div
                  className={`w-full max-w-[44px] rounded-[4px] ${v === 0 ? "bg-white/10" : "bg-[linear-gradient(180deg,#FFD234,#FFB703)]"}`}
                  style={{ height: h }}
                  title={`${p.label}: ${mode === "usdc" ? dollars(v) : `${v} orders`}`}
                />
                <span className="truncate text-[10px] text-[#B4BEC9]">{p.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function NeedsYou({
  offers,
  deliveries,
  leads = [],
  loading,
}: {
  offers: readonly OfferView[];
  deliveries: readonly DeliveryItem[];
  /** Brands that just paid for a spot, to offer content to. */
  leads?: readonly { orderId: string; spaceId: string; brand: string; listing: string }[];
  loading: boolean;
}) {
  const href = useHref();
  const seat = typeof window !== "undefined" ? pendingSeat() : null;
  const rows = [
    ...(seat
      ? [{ key: "seat", href: href(`/team?seat=${encodeURIComponent(seat.seat)}`), title: "Team invitation", sub: "Waiting for your answer", right: <span className="text-tiny text-amber">Open</span> }]
      : []),
    ...offers.map((o) => ({
      key: `o-${o.id}`,
      href: href(`/offers?id=${o.id}`),
      title: `${o.kind === "bid" ? "Bid" : "Offer"} · ${o.sponsor.name}`,
      sub: o.serviceName || o.spaceTitle,
      right: <span className="text-small tabular-nums text-text">{o.amountUsdc} USDC</span>,
    })),
    ...deliveries.map((d) => ({
      key: `d-${d.id}`,
      href: href(`/deliveries?item=${encodeURIComponent(d.id)}`),
      title: d.kind === "artwork" ? d.title : `${d.kind === "spot" || d.kind === "production" ? "Deliver" : "Promise"} · ${d.title}`,
      sub: d.listing,
      right: d.due ? <span className={`text-tiny ${d.state === "overdue" ? "text-amber" : "text-[#9FB7C2]"}`}>{dueText(d.due)}</span> : null,
    })),
    ...leads.map((l) => ({
      key: `c-${l.orderId}`,
      href: `${href("/sales")}?listing=${encodeURIComponent(l.spaceId)}&offer=${encodeURIComponent(l.orderId)}`,
      title: `Offer them content · ${l.brand}`,
      sub: l.listing,
      right: <span className="text-tiny text-[#9FB7C2]">New sale</span>,
    })),
  ];

  return (
    <Panel
      title="Needs you"
      meta={loading ? "" : `${rows.length}`}
      action={
        <span className="flex items-center gap-3 text-tiny">
          <Link href={href("/offers")} className="text-[#9FB7C2] hover:text-text">
            All offers
          </Link>
          <Link href={href("/deliveries")} className="text-[#9FB7C2] hover:text-text">
            All deliveries
          </Link>
        </span>
      }
    >
      {loading ? (
        <Skeleton className="h-36" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing waiting." />
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.slice(0, ROWS).map((r) => (
            <li key={r.key}>
              <RowLink href={r.href} title={r.title} sub={r.sub} right={r.right} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ── Manager ──────────────────────────────────────────────────────── */

function ManagerOverview() {
  const { managed, work } = useShell();
  const href = useHref();
  const ids = useMemo(() => managed.map((m) => m.spaceId), [managed]);
  const offers = useManagedOffers(ids);
  const earnings = useEarnings();
  const items = useMemo(() => memberDeliveries(work), [work]);
  const due = dueSoon(items);
  const waiting = waitingOnYou(offers.data ?? []);
  const owedToYou = (earnings.data ?? []).filter((e) => e.status === "owed").reduce((n, e) => n + baseOf(e.amountUsdc), 0n);

  return (
    <div className={FILL}>
      <section aria-label="Position" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile label="Listings you sell" value={managed.length} href={href("/listings")} />
        <KpiTile
          label="Offers & bids waiting"
          value={offers.data || ids.length === 0 ? waiting.length : "…"}
          href={href("/offers")}
          attention={waiting.length > 0}
        />
        <KpiTile label="Due in 7 days" value={due.length} href={href("/deliveries")} attention={due.length > 0} />
        <KpiTile label="Owed to you" value={usdcText(owedToYou).replace(/\.00$/, "")} unit="USDC" href={href("/team?tab=earnings")} />
      </section>

      <div className={BOTTOM}>
        <NeedsYou offers={waiting} deliveries={due} loading={ids.length > 0 && !offers.data} />
        <Panel
          title="Listings you sell"
          meta={`${managed.length}`}
          action={<Link href={href("/listings")} className="text-tiny text-[#9FB7C2] hover:text-text">All listings</Link>}
        >
          {managed.length === 0 ? (
            <EmptyState title="No listings yet." />
          ) : (
            <ul className="flex flex-col gap-1">
              {managed.slice(0, ROWS).map((m) => (
                <li key={m.spaceId}>
                  <RowLink
                    href={href(`/listings/${m.spaceId}`)}
                    title={m.title}
                    sub={m.eventName ?? "No event"}
                    right={<StatusPill status={m.status} />}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
