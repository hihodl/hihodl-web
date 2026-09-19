/**
 * The demo's Overview analytics (GET /ad-space/me/analytics) for @demo_creator,
 * and the HOLD creators "Inspired by" can find (GET /ad-space/creators/search).
 * Numbers are made up and consistent with each other; every brand and every
 * creator here is fictional.
 */

import type { BrandRelation, CreatorAnalytics, GroupRow, HoldCreatorHit, MixRow } from "@/lib/creator/analytics";

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const on = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);

const T2049 = { key: "ev-token2049", name: "TOKEN2049", slug: "token2049-singapore-2026" };
const KBW = { key: "ev-kbw", name: "Korea Blockchain Week", slug: "korea-blockchain-week-2026" };
const BP = { key: "ev-breakpoint", name: "Breakpoint", slug: "breakpoint-london-2026" };

type Chain = BrandRelation["chains"][number];
type From = BrandRelation["payFrom"][number];
const solana = (orders: number): Chain => ({ key: "solana", label: "Solana", orders });
const base = (orders: number): Chain => ({ key: "base", label: "Base", orders });
const polygon = (orders: number): Chain => ({ key: "polygon", label: "Polygon", orders });
const wallet = (orders: number): From => ({ key: "wallet", label: "External wallet", orders });
const hold = (orders: number): From => ({ key: "hold", label: "HOLD account", orders });

function brand(
  name: string,
  handle: string | null,
  receivedCents: number,
  orders: number,
  events: (typeof T2049)[],
  firstDaysAgo: number,
  lastDaysAgo: number,
  chains: Chain[],
  payFrom: From[],
  listings = events.length,
): BrandRelation {
  return {
    key: handle ? `x:${handle}` : `n:${name.toLowerCase()}`,
    name,
    handle,
    logoUrl: null,
    named: handle ? "public" : "private",
    receivedCents,
    sponsorPaidCents: Math.round(receivedCents * 1.05),
    orders,
    firstPaidAt: ago(firstDaysAgo),
    lastPaidAt: ago(lastDaysAgo),
    events,
    listings,
    repeat: events.length >= 2 || listings >= 2,
    chains,
    payFrom,
  };
}

const BRANDS: BrandRelation[] = [
  brand("Northwind", "northwind", 420_000, 5, [T2049, KBW, BP], 80, 3, [solana(4), base(1)], [wallet(3), hold(2)]),
  brand("Lumen Labs", "lumenlabs", 260_000, 3, [T2049, BP], 60, 10, [base(3)], [wallet(3)]),
  brand("Stackd", "stackd", 150_000, 1, [T2049], 20, 20, [solana(1)], [hold(1)]),
  brand("Paperclip", "paperclip", 90_000, 2, [KBW], 45, 40, [solana(2)], [wallet(2)], 2),
  brand("Mesa", "mesamoney", 60_000, 1, [T2049], 15, 15, [polygon(1)], [wallet(1)]),
  brand("Kopi Labs", null, 35_000, 1, [KBW], 42, 42, [base(1)], [wallet(1)]),
  brand("Acme", "acme", 25_000, 1, [BP], 5, 5, [solana(1)], [wallet(1)]),
  brand("Orbit", "orbitfi", 20_000, 1, [T2049], 12, 12, [solana(1)], [hold(1)]),
];

function group(key: string, label: string, listings: number, sold: number, total: number, cents: number, orders: number, first: number | null, out: number | null, soldOut: number): GroupRow {
  return {
    key,
    label,
    listings,
    spotsSold: sold,
    spotsTotal: total,
    soldPct: total ? Math.round((sold / total) * 1000) / 10 : null,
    receivedCents: cents,
    orders,
    medianDaysToFirstSale: first,
    medianDaysToSellOut: out,
    soldOutListings: soldOut,
  };
}

const mix = (key: string, label: string, orders: number, cents: number, totalOrders: number, totalCents: number): MixRow => ({
  key,
  label,
  orders,
  ordersPct: Math.round((orders / totalOrders) * 1000) / 10,
  receivedCents: cents,
  receivedPct: Math.round((cents / totalCents) * 1000) / 10,
});

/** An account with nothing published gets the empty answer, as the backend gives it. */
export function demoAnalytics(empty = false): CreatorAnalytics {
  if (empty) {
    return {
      asOf: new Date().toISOString(),
      totals: {
        receivedCents: 0, sponsorPaidCents: 0, orders: 0, averageOrderCents: null, brands: 0, namedBrands: 0, repeatBrands: 0, repeatReceivedPct: null,
        events: 0, listings: 0, spotsSold: 0, spotsTotal: 0, sellThroughPct: null, medianDaysToFirstSale: null, fee: { paidByBrandsCents: 0, paidByYouCents: 0 },
      },
      brands: [], topBrands: [], byEvent: [], byListing: [], byProduct: [], byKind: [],
      payMix: { byChain: [], byPayFrom: [], byDeal: [] },
      inspired: { listings: 0, creators: 0, recent: [] },
    };
  }
  const total = 1_060_000;
  return {
    asOf: new Date().toISOString(),
    totals: {
      receivedCents: total,
      sponsorPaidCents: 1_113_000,
      orders: 15,
      averageOrderCents: 70_667,
      brands: BRANDS.length,
      namedBrands: BRANDS.length,
      repeatBrands: BRANDS.filter((b) => b.repeat).length,
      repeatReceivedPct: 73.6,
      events: 3,
      listings: 6,
      spotsSold: 15,
      spotsTotal: 22,
      sellThroughPct: 68.2,
      medianDaysToFirstSale: 2,
      fee: { paidByBrandsCents: 53_000, paidByYouCents: 0 },
    },
    brands: BRANDS,
    topBrands: BRANDS.slice(0, 5),
    byEvent: [
      { key: T2049.key, name: "TOKEN2049", slug: T2049.slug, city: "Singapore", startsOn: on(20), endsOn: on(22), listings: 3, receivedCents: 640_000, orders: 8, spotsSold: 8, spotsTotal: 10, sellThroughPct: 80, brands: 5 },
      { key: KBW.key, name: KBW.name, slug: KBW.slug, city: "Seoul", startsOn: on(-30), endsOn: on(-27), listings: 2, receivedCents: 245_000, orders: 4, spotsSold: 4, spotsTotal: 6, sellThroughPct: 66.7, brands: 3 },
      { key: BP.key, name: "Breakpoint", slug: BP.slug, city: "London", startsOn: on(45), endsOn: on(47), listings: 1, receivedCents: 175_000, orders: 3, spotsSold: 3, spotsTotal: 6, sellThroughPct: 50, brands: 3 },
    ],
    byListing: [
      { id: "l1", title: "Road to TOKEN2049", product: "Carry-on suitcase", kind: "object", status: "live", event: "TOKEN2049", spotsSold: 6, spotsTotal: 6, soldPct: 100, receivedCents: 420_000, orders: 6, daysToFirstSale: 1, daysToSellOut: 9 },
      { id: "l2", title: "TOKEN2049 short videos", product: "Short video", kind: "service", status: "live", event: "TOKEN2049", spotsSold: 2, spotsTotal: 4, soldPct: 50, receivedCents: 220_000, orders: 2, daysToFirstSale: 4, daysToSellOut: null },
      { id: "l3", title: "KBW hoodie", product: "Hoodie", kind: "clothing", status: "closed", event: "Korea Blockchain Week", spotsSold: 4, spotsTotal: 6, soldPct: 66.7, receivedCents: 245_000, orders: 4, daysToFirstSale: 2, daysToSellOut: null },
      { id: "l4", title: "My suitcase to Breakpoint", product: "Carry-on suitcase", kind: "object", status: "live", event: "Breakpoint", spotsSold: 3, spotsTotal: 6, soldPct: 50, receivedCents: 175_000, orders: 3, daysToFirstSale: 3, daysToSellOut: null },
      { id: "l5", title: "TOKEN2049 content production", product: "Content production", kind: "production", status: "live", event: "TOKEN2049", spotsSold: 0, spotsTotal: 0, soldPct: null, receivedCents: 0, orders: 0, daysToFirstSale: null, daysToSellOut: null },
    ],
    byProduct: [
      { ...group("carry-on-suitcase", "Carry-on suitcase", 2, 9, 12, 595_000, 9, 2, 9, 1), kind: "object" },
      { ...group("hoodie", "Hoodie", 1, 4, 6, 245_000, 4, 2, null, 0), kind: "clothing" },
      { ...group("short-video", "Short video", 1, 2, 4, 220_000, 2, 4, null, 0), kind: "service" },
    ],
    byKind: [
      { ...group("object", "Objects", 2, 9, 12, 595_000, 9, 2, 9, 1), key: "object" },
      { ...group("clothing", "Clothing", 1, 4, 6, 245_000, 4, 2, null, 0), key: "clothing" },
      { ...group("service", "Services", 1, 2, 4, 220_000, 2, 4, null, 0), key: "service" },
    ],
    payMix: {
      byChain: [mix("solana", "Solana", 10, 690_000, 15, total), mix("base", "Base", 4, 310_000, 15, total), mix("polygon", "Polygon", 1, 60_000, 15, total)],
      byPayFrom: [mix("wallet", "External wallet", 11, 760_000, 15, total), mix("hold", "HOLD account", 4, 300_000, 15, total)],
      byDeal: [
        mix("price", "Listed price", 10, 640_000, 15, total),
        mix("offer", "Accepted offer", 4, 300_000, 15, total),
        mix("bid", "Winning bid", 1, 120_000, 15, total),
      ],
    },
    inspired: {
      listings: 2,
      creators: 2,
      recent: [
        { spaceId: "demo-inspired-1", title: "Carry-on to Devcon 8", creatorHandle: "nodeline_creator", creatorName: "Nodeline Creator", path: null, creditedAt: ago(6) },
        { spaceId: "demo-inspired-2", title: "Breakpoint jacket", creatorHandle: "orbit_travels", creatorName: "Orbit Travels", path: null, creditedAt: ago(14) },
      ],
    },
  };
}

const CREATORS: HoldCreatorHit[] = [
  { handle: "nodeline_creator", name: "Nodeline Creator", avatarUrl: null, username: null },
  { handle: "orbit_travels", name: "Orbit Travels", avatarUrl: null, username: null },
  { handle: "mesa_makes", name: "Mesa Makes", avatarUrl: null, username: "mesa" },
  { handle: "kopi_on_the_road", name: "Kopi on the Road", avatarUrl: null, username: "kopi" },
];

export function demoCreatorSearch(q: string, limit = 6): HoldCreatorHit[] {
  const t = q.trim().replace(/^@+/, "").toLowerCase();
  if (!t) return [];
  return CREATORS.filter((c) => c.handle.startsWith(t) || c.username?.startsWith(t)).slice(0, limit);
}
