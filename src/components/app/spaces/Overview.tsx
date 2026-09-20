"use client";

/**
 * Spaces › Overview: the creator's business at a glance, and what is waiting
 * on them.
 *
 * Four big numbers about the creator's own value (what they earned and that
 * brands paid our fee on top, the brands that pay them and came back, how
 * much of what they list sells, what needs them), then a hub of cards. Every
 * card opens its own screen with Back (OverviewScreens.tsx):
 *
 *   /spaces                  the hub
 *   /spaces?view=brands      Brands you work with: one card per brand
 *   /spaces?view=brand&brand= one brand's activity with you, and nothing else
 *   /spaces?view=events      By event
 *   /spaces?view=sells       What sells for you
 *   /spaces?view=pay         How brands pay
 *   /spaces?view=inspired    You inspired (listings that credit you)
 *   /spaces?view=needs       Needs you, and what is live
 *
 * The analytics are GET /ad-space/me/analytics: this creator's own paid
 * orders. Money is shown as money ("$1,500"), never as a USDC figure.
 */

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { baseOf, groupByMember, pendingSeat } from "@/lib/creator/team";
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
  useAnalytics,
  useEarnings,
  useListingViews,
  useManagedOffers,
  useOffers,
  useOwed,
  useSales,
} from "@/lib/app/spaces-data";
import type { CreatorAnalytics } from "@/lib/creator/analytics";
import type { OfferView, SalesSummary } from "@/lib/creator/listing";

import { useHref } from "../base";
import { Ion, type IonName } from "../ion";
import { useShell } from "../Shell";
import { dollars, Skeleton } from "../ui";
import { BrandScreen, brandParam } from "./BrandScreen";
import { CardGrid, DrillBar } from "./cards";
import { dueText, ReadError, StatusPill } from "./common";
import { Card, Empty, emptyBtn, Group as Panel, ListRow as RowLink, money, ProgressBar, Stat as KpiTile, Tag } from "./kit";
import { useOffersContent } from "./ContentOffer";
import {
  BrandsScreen,
  EventsScreen,
  feeLine,
  InspiredScreen,
  isOverviewView,
  PayScreen,
  pctText,
  plural,
  SellsScreen,
  daysText,
} from "./OverviewScreens";

/** A sale stays in "Needs you" as a content lead this long: the brand just paid, and is listening. */
const LEAD_DAYS = 7;

const FILL = "flex flex-col gap-4 lg:flex-1";
const BOTTOM = "grid grid-cols-[minmax(0,1fr)] gap-4 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]";
/** A group's "see all": 12.5/600 muted, the app's link ink. */
const seeAll = "text-[12.5px] font-strong normal-case tracking-normal text-white/[0.62] hover:text-white";

/** Rows in "Needs you" and "Live". */
const ROWS = 3;

export function Overview({ view = null, brand = null }: { view?: string | null; brand?: string | null }) {
  const { role } = useShell();
  return role === "manager" ? <ManagerOverview /> : <CreatorOverview view={view} brand={brand} />;
}

/* ── Creator ──────────────────────────────────────────────────────── */

function CreatorOverview({ view, brand }: { view: string | null; brand: string | null }) {
  const { listings, work, agency } = useShell();
  const href = useHref();
  const analytics = useAnalytics();
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
  const owedToTeam = groupByMember(owed.data ?? []).reduce((n, g) => n + g.owedBase, 0n);

  // A brand that just took a spot: offer them content (a spot is often where a content deal starts).
  const offersContent = useOffersContent();
  const leads = useMemo(() => {
    const since = Date.now() - LEAD_DAYS * 86_400_000;
    return paidSales(sales.data)
      .filter((r) => r.status === "paid" && r.sponsorName && r.paidAt && Date.parse(r.paidAt) >= since)
      .filter((r) => offersContent(listings.find((l) => l.id === r.spaceId)))
      .map((r) => ({ orderId: r.orderId, spaceId: r.spaceId, brand: r.sponsorName!, listing: r.serviceName || r.spaceTitle }));
  }, [sales.data, listings, offersContent]);

  const current = isOverviewView(view) ? view : null;
  const back = href("");
  const data = analytics.data;

  if (current === "needs") {
    const live = listings.filter((l) => l.status === "live");
    return (
      <div className={FILL}>
        <DrillBar back={back} crumb="Overview" title="Needs you" />
        <div className={BOTTOM}>
          <NeedsYou offers={waiting} deliveries={due} leads={leads} loading={!offers.data || !views.data} limit={8} />
          <LivePanel live={live} rows={8} />
        </div>
      </div>
    );
  }
  if (current) {
    if (!data) return analytics.error ? <ReadError error={analytics.error} /> : <Skeleton className="h-[320px]" />;
    // One brand alone: back to the grid of brands, never to the hub.
    if (current === "brand") return <BrandScreen data={data} brandKey={brand ?? ""} back={`${back}?view=brands`} />;
    if (current === "brands") return <BrandsScreen data={data} back={back} hrefOf={(key) => `${back}?${brandParam(key)}`} />;
    if (current === "events") return <EventsScreen data={data} back={back} />;
    if (current === "sells") return <SellsScreen data={data} back={back} />;
    if (current === "pay") return <PayScreen data={data} back={back} />;
    if (current === "inspired") return <InspiredScreen data={data} back={back} />;
  }

  const needs = waiting.length + due.length + leads.length;
  const t = data?.totals;
  const loading = !data && !analytics.error;
  const v = (x: ReactNode) => (loading ? "…" : x);

  return (
    <div className={FILL}>
      <section aria-label="Your business" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <KpiTile label="Earned" value={v(dollars(t?.receivedCents ?? 0))} note={t ? (t.orders && t.fee.paidByYouCents === 0 ? "5% paid by brands" : feeLine(t)) : " "} href={href("/sales")} />
        <KpiTile
          label="Brands that paid you"
          value={v(t?.brands ?? 0)}
          note={t ? (t.repeatBrands ? `${t.repeatBrands} came back` : "none back yet") : " "}
          href={`${href("")}?view=brands`}
        />
        <KpiTile
          label="Sell-through"
          value={v(t?.sellThroughPct != null ? pctText(t.sellThroughPct) : "–")}
          note={t ? `${t.spotsSold} of ${t.spotsTotal} spots sold` : " "}
          href={`${href("")}?view=sells`}
        />
        <KpiTile
          label="Needs you"
          value={offers.data && views.data ? needs : "…"}
          note={`${plural(waiting.length, "offer")} · ${due.length} due`}
          href={`${href("")}?view=needs`}
          attention={needs > 0}
        />
      </section>
      <ReadError error={analytics.error ?? sales.error ?? offers.error} />
      <Hub data={data ?? null} sales={sales.data} href={href} owedToTeamCents={agency.on ? Number(owedToTeam / 10_000n) : 0} />
    </div>
  );
}

/* ── The hub ──────────────────────────────────────────────────────── */

function Hub({
  data,
  sales,
  href,
  owedToTeamCents,
}: {
  data: CreatorAnalytics | null;
  sales: SalesSummary | undefined;
  href: (p?: string) => string;
  /** A Creative Director's team is owed this (their own bookkeeping); 0 hides it. */
  owedToTeamCents: number;
}) {
  const to = (view: string) => `${href("")}?view=${view}`;
  const t = data?.totals;
  const topEvent = data?.byEvent.find((e) => e.receivedCents > 0) ?? data?.byEvent[0] ?? null;
  const bestProduct = data
    ? [...data.byProduct].filter((p) => p.soldPct !== null && p.spotsTotal > 0).sort((a, b) => b.soldPct! - a.soldPct! || b.receivedCents - a.receivedCents)[0] ?? null
    : null;
  const chain = data?.payMix.byChain[0] ?? null;
  const hold = data?.payMix.byPayFrom.find((m) => m.key === "hold") ?? null;
  const inspired = data?.inspired;
  const dash = data ? "—" : "…";

  return (
    <CardGrid>
      <HubCard
        href={to("brands")}
        icon="people-outline"
        title="Brands you work with"
        line={data ? (data.topBrands.length ? data.topBrands.slice(0, 3).map((b) => b.name).join(", ") : "No brand has paid yet") : " "}
        value={t ? String(t.brands) : dash}
        note={t ? `${t.repeatBrands} repeat` : ""}
      />
      <HubCard
        href={to("events")}
        icon="calendar-outline"
        title="By event"
        line={topEvent ? `${topEvent.name} made the most` : data ? "No event yet" : " "}
        value={topEvent ? dollars(topEvent.receivedCents) : dash}
        note={t ? plural(t.events, "event") : ""}
      />
      <HubCard
        href={to("sells")}
        icon="pricetags-outline"
        title="What sells for you"
        line={bestProduct ? `${bestProduct.label} sells best` : data ? "Publish to see what sells" : " "}
        value={bestProduct?.soldPct != null ? pctText(bestProduct.soldPct) : dash}
        note={bestProduct?.medianDaysToFirstSale != null ? `sold · 1st sale ${daysText(bestProduct.medianDaysToFirstSale)}` : bestProduct ? "sold" : ""}
      />
      <HubCard
        href={to("pay")}
        icon="wallet-outline"
        title="How brands pay"
        line={chain ? [`${chain.label} ${pctText(chain.receivedPct ?? 0)}`, hold ? `HOLD ${pctText(hold.ordersPct ?? 0)} of orders` : null].filter(Boolean).join(" · ") : data ? "No payment yet" : " "}
        value={chain ? chain.label : dash}
        note={t ? (t.fee.paidByYouCents === 0 && t.orders > 0 ? "you kept 100%" : "USDC to your wallet") : ""}
      />
      <HubCard href={href("/sales")} icon="stats-chart-outline" title="Sales" line="Received per week, last 8 weeks" value={<WeekBars sales={sales} />} note={t ? plural(t.orders, "order") : ""} />
      <HubCard
        href={to("needs")}
        icon="notifications-outline"
        title="Needs you and live"
        line="Offers, deliveries, what is live"
        value={t ? String(t.listings) : dash}
        note={owedToTeamCents > 0 ? `${dollars(owedToTeamCents)} owed to team` : "listings published"}
      />
      {inspired && inspired.listings > 0 ? (
        <HubCard
          href={to("inspired")}
          icon="sparkles-outline"
          title="You inspired"
          line={inspired.recent.slice(0, 2).map((l) => (l.creatorHandle ? `@${l.creatorHandle}` : l.title)).join(", ")}
          value={String(inspired.listings)}
          note={inspired.listings === 1 ? "listing credits you" : "listings credit you"}
        />
      ) : null}
    </CardGrid>
  );
}

function HubCard({
  href,
  icon,
  title,
  line,
  value,
  note,
}: {
  href: string;
  icon: IonName;
  title: string;
  line: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <li className="flex">
      <Card href={href} className="w-full sm:min-h-[160px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] bg-white/[0.08] text-white">
            <Ion name={icon} size={16} />
          </span>
          <p className="truncate text-[16px] font-strong tracking-[-0.2px] text-white">{title}</p>
        </div>
        <p className="truncate text-[13px] text-white/[0.62]">{line}</p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
          <div className={`${money} min-w-0 whitespace-nowrap leading-none`}>{value}</div>
          {note ? <p className="truncate text-[12.5px] font-strong tabular-nums text-white/55">{note}</p> : null}
        </div>
      </Card>
    </li>
  );
}

/** Eight small bars: money received per week. */
function WeekBars({ sales }: { sales: SalesSummary | undefined }) {
  const points = useMemo(() => salesByWeek(sales), [sales]);
  const max = Math.max(1, ...points.map((p) => p.cents));
  return (
    <span className="flex h-[30px] items-end gap-1" role="img" aria-label="Received per week, last 8 weeks">
      {points.map((p) => (
        <span
          key={p.label}
          className={`w-2.5 rounded-[2px] ${p.cents ? "bg-[#0E9B68]" : "bg-white/10"}`}
          style={{ height: p.cents ? Math.max(4, Math.round((p.cents / max) * 30)) : 2 }}
          title={`${p.label}: ${dollars(p.cents)}`}
        />
      ))}
    </span>
  );
}

function LivePanel({ live, rows = ROWS }: { live: ReturnType<typeof useShell>["listings"]; rows?: number }) {
  const href = useHref();
  return (
    <Panel title="Live" meta={`${live.length}`} action={<Link href={href("/listings")} className={seeAll}>All listings</Link>}>
      {live.length === 0 ? (
        <Empty icon="megaphone-outline" title="Nothing live" action={<Link href={href("/listings/new")} className={emptyBtn}>Create a space</Link>} />
      ) : (
        <ul className="flex flex-col divide-y divide-white/[0.08]">
          {live.slice(0, rows).map((l) => (
            <li key={l.id}>
              <RowLink
                href={href(`/listings/${l.id}`)}
                title={l.serviceName || l.title}
                meta={
                  <span className="flex items-center gap-2">
                    <span className="w-20 shrink-0">
                      <ProgressBar value={l.totals.positions > 0 ? l.totals.sold / l.totals.positions : 0} />
                    </span>
                    {l.totals.sold}/{l.totals.positions} sold
                  </span>
                }
                right={<span className="text-[15px] font-strong tabular-nums text-white">{dollars(l.totals.committedCents)}</span>}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function NeedsYou({
  offers,
  deliveries,
  leads = [],
  loading,
  limit = ROWS,
}: {
  offers: readonly OfferView[];
  deliveries: readonly DeliveryItem[];
  /** Brands that just paid for a spot, to offer content to. */
  leads?: readonly { orderId: string; spaceId: string; brand: string; listing: string }[];
  loading: boolean;
  limit?: number;
}) {
  const href = useHref();
  const seat = typeof window !== "undefined" ? pendingSeat() : null;
  const rows = [
    ...(seat
      ? [{ key: "seat", href: href(`/team?seat=${encodeURIComponent(seat.seat)}`), title: "Team invitation", sub: "Waiting for your answer", right: <Tag label="Open" tone="caution" /> }]
      : []),
    ...offers.map((o) => ({
      key: `o-${o.id}`,
      href: href(`/offers?id=${o.id}`),
      title: `${o.kind === "bid" ? "Bid" : "Offer"} · ${o.sponsor.name}`,
      sub: o.serviceName || o.spaceTitle,
      right: <span className="text-[15px] font-strong tabular-nums text-white">{dollars(cents(o.amountUsdc))}</span>,
    })),
    ...deliveries.map((d) => ({
      key: `d-${d.id}`,
      href: href(`/deliveries?item=${encodeURIComponent(d.id)}`),
      title: d.kind === "artwork" ? d.title : `${d.kind === "spot" || d.kind === "production" ? "Deliver" : "Promise"} · ${d.title}`,
      sub: d.listing,
      right: d.due ? <Tag label={dueText(d.due)} tone={d.state === "overdue" ? "caution" : "calm"} /> : null,
    })),
    ...leads.map((l) => ({
      key: `c-${l.orderId}`,
      href: `${href("/sales")}?listing=${encodeURIComponent(l.spaceId)}&offer=${encodeURIComponent(l.orderId)}`,
      title: `Offer them content · ${l.brand}`,
      sub: l.listing,
      right: <Tag label="New sale" tone="good" />,
    })),
  ];

  return (
    <Panel
      title="Needs you"
      meta={loading ? "" : `${rows.length}`}
      action={
        <span className="flex items-center gap-3">
          <Link href={href("/offers")} className={seeAll}>
            All offers
          </Link>
          <Link href={href("/deliveries")} className={seeAll}>
            All deliveries
          </Link>
        </span>
      }
    >
      {loading ? (
        <Skeleton className="h-36" />
      ) : rows.length === 0 ? (
        <Empty icon="checkmark-done" title="Nothing waiting" />
      ) : (
        <ul className="flex flex-col divide-y divide-white/[0.08]">
          {rows.slice(0, limit).map((r) => (
            <li key={r.key}>
              <RowLink href={r.href} title={r.title} meta={r.sub} right={r.right} />
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
      <section aria-label="Position" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <KpiTile label="Listings you sell" value={managed.length} href={href("/listings")} />
        <KpiTile
          label="Offers & bids waiting"
          value={offers.data || ids.length === 0 ? waiting.length : "…"}
          href={href("/offers")}
          attention={waiting.length > 0}
        />
        <KpiTile label="Due in 7 days" value={due.length} href={href("/deliveries")} attention={due.length > 0} />
        <KpiTile label="Owed to you" value={dollars(Number(owedToYou / 10_000n))} href={href("/team?tab=earnings")} />
      </section>

      <div className={BOTTOM}>
        <NeedsYou offers={waiting} deliveries={due} loading={ids.length > 0 && !offers.data} />
        <Panel
          title="Listings you sell"
          meta={`${managed.length}`}
          action={<Link href={href("/listings")} className={seeAll}>All listings</Link>}
        >
          {managed.length === 0 ? (
            <Empty icon="megaphone-outline" title="No listings yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-white/[0.08]">
              {managed.slice(0, ROWS).map((m) => (
                <li key={m.spaceId}>
                  <RowLink
                    href={href(`/listings/${m.spaceId}`)}
                    title={m.title}
                    meta={m.eventName ?? "No event"}
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
