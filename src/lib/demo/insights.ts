/**
 * The demo's Insights (GET /ad-space/insights?event=): a busy event
 * (TOKEN2049), a thin one where most figures are still below the sample
 * (Breakpoint), and all of Spaces. Numbers are made up and consistent with
 * each other; the brands are fictional.
 */

import type { Brand, Insights, InsightsEvent, Surface } from "@/lib/creator/insights";

const DAY = 86_400_000;
const dayFromNow = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);

const EVENTS: Record<string, InsightsEvent> = {
  "token2049-singapore-2026": { slug: "token2049-singapore-2026", name: "TOKEN2049", city: "Singapore", startsOn: dayFromNow(20), endsOn: dayFromNow(22) },
  "breakpoint-london-2026": { slug: "breakpoint-london-2026", name: "Breakpoint", city: "London", startsOn: dayFromNow(45), endsOn: dayFromNow(47) },
  "devcon-8-mumbai-2026": { slug: "devcon-8-mumbai-2026", name: "Devcon 8", city: "Mumbai", startsOn: dayFromNow(60), endsOn: dayFromNow(63) },
};

type Scope = "busy" | "thin" | "all";

function sample(creators: number, listings: number) {
  return { creators, listings };
}

/** A figure that only shows from `min` creators: null below it, as the backend answers. */
function gate<T>(value: T, creators: number, min = 3): T | null {
  return creators >= min ? value : null;
}

function brands(scope: Scope): Brand[] {
  const all: Brand[] = [
    { name: "Northwind", handle: "northwind", placements: 9, spendBand: "1k-10k", spendBandLabel: "$1k to $10k", country: "SG" },
    { name: "Lumen Labs", handle: "lumenlabs", placements: 7, spendBand: "1k-10k", spendBandLabel: "$1k to $10k", country: "US" },
    { name: "Paperclip", handle: "paperclip", placements: 5, spendBand: "100-999", spendBandLabel: "$100 to $999", country: "GB" },
    { name: "Mesa", handle: "mesa", placements: 4, spendBand: "100-999", spendBandLabel: "$100 to $999", country: null },
    { name: "Stackd", handle: "stackd", placements: 3, spendBand: "10k+", spendBandLabel: "$10k and over", country: "DE" },
    { name: "Kopi Labs", handle: null, placements: 2, spendBand: "under-100", spendBandLabel: "Under $100", country: "SG" },
  ];
  if (scope === "thin") return [];
  return scope === "all" ? all : all.slice(0, 5);
}

export function demoInsights(
  event: string | null,
  mine: { id: string; title: string; templateId: string; eventSlug: string | null; publishedAt: string }[],
): Insights {
  const slug = event === "all" ? null : event && EVENTS[event] ? event : "token2049-singapore-2026";
  const ev = slug ? EVENTS[slug] : null;
  const scope: Scope = !ev ? "all" : slug === "token2049-singapore-2026" ? "busy" : "thin";
  const asOf = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const c = scope === "busy" ? 14 : scope === "thin" ? 2 : 61;
  const l = scope === "busy" ? 31 : scope === "thin" ? 3 : 148;
  const m = <T,>(v: T) => ({ value: gate(v, c), creators: c });

  const surfaces: { key: Surface; label: string; listings: number; placements: number; filled: number; money: number }[] = [
    { key: "object", label: "Objects (suitcase, backpack)", listings: 12, placements: 96, filled: 61, money: 0.34 },
    { key: "clothing", label: "Clothing (blazer, hoodie)", listings: 6, placements: 40, filled: 21, money: 0.14 },
    { key: "service", label: "Services (videos, posts)", listings: 8, placements: 44, filled: 30, money: 0.29 },
    { key: "production", label: "Content production", listings: 3, placements: 14, filled: 9, money: 0.2 },
    { key: "photo", label: "Your own photo", listings: 2, placements: 11, filled: 4, money: 0.03 },
  ];
  const k = scope === "all" ? 4 : scope === "thin" ? 0.1 : 1;
  const sellRow = (r: (typeof surfaces)[number]) => {
    const listings = Math.max(scope === "thin" ? 1 : 0, Math.round(r.listings * k));
    const placements = Math.round(r.placements * k);
    const filled = Math.round(r.filled * k);
    const creators = Math.max(1, Math.round(c * (r.listings / 31)));
    return {
      key: r.key,
      label: r.label,
      listings,
      placements,
      filled,
      filledPct: gate(placements ? Math.round((filled / placements) * 100) : 0, creators),
      moneyShare: gate(r.money, creators),
      sample: sample(creators, listings),
    };
  };

  const products = [
    { key: "carry-on-suitcase", label: "Carry-on suitcase", listings: 9, placements: 80, filled: 52 },
    { key: "blazer", label: "Blazer", listings: 4, placements: 24, filled: 14 },
    { key: "short-form-video", label: "Short video", listings: 5, placements: 25, filled: 18 },
    { key: "backpack", label: "Backpack", listings: 3, placements: 16, filled: 9 },
    { key: "content-production", label: "Content production", listings: 3, placements: 14, filled: 9 },
  ].map((p) => {
    const creators = Math.max(1, Math.round(p.listings * (scope === "all" ? 3 : scope === "thin" ? 0.2 : 0.9)));
    const listings = Math.max(scope === "thin" ? 1 : 0, Math.round(p.listings * k));
    return {
      key: p.key,
      label: p.label,
      listings,
      placements: Math.round(p.placements * k),
      filled: Math.round(p.filled * k),
      filledPct: gate(Math.round((p.filled / p.placements) * 100), creators),
      moneyShare: gate(Math.round((p.filled / 102) * 100) / 100, creators),
      sample: sample(creators, listings),
    };
  });

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((label, i) => ({
    day: i + 1,
    label,
    listings: scope === "thin" ? (i < 2 ? 1 : 0) : Math.round([6, 5, 4, 7, 3, 2, 4][i] * k),
    soldFirstWeekPct: gate([58, 52, 44, 67, 38, 25, 33][i], scope === "thin" ? 1 : [5, 4, 4, 6, 3, 2, 3][i]),
    firstWeekSalesPerListing: gate([2.1, 1.8, 1.4, 2.6, 1.2, 0.8, 1.1][i], scope === "thin" ? 1 : [5, 4, 4, 6, 3, 2, 3][i]),
    sample: sample(scope === "thin" ? 1 : [5, 4, 4, 6, 3, 2, 3][i], Math.round([6, 5, 4, 7, 3, 2, 4][i] * k)),
  }));

  const brandRows = brands(scope);
  const mineHere = mine.filter((x) => (slug ? x.eventSlug === slug : true));

  return {
    asOf,
    minSample: 3,
    event: ev,
    events: Object.values(EVENTS),
    hook: {
      asOf,
      sample: sample(c, l),
      mine: mineHere.slice(0, 3).map((x, i) => ({
        listingId: x.id,
        productId: x.templateId,
        product: x.templateId === "carry-on-suitcase" ? "Carry-on suitcase" : x.templateId === "content-production" ? "Content production" : x.title,
        surface: (x.templateId === "carry-on-suitcase" ? "object" : x.templateId === "content-production" ? "production" : "service") as Surface,
        publishedAt: x.publishedAt,
        daysBeforeEvent: slug ? 26 - i * 9 : null,
        rank: slug ? i + 1 : null,
        sameProduct: slug ? 3 + i * 2 : 12,
      })),
      leastCrowded: [
        { key: "blazer", label: "Blazer", listings: scope === "thin" ? 0 : 1 },
        { key: "backpack", label: "Backpack", listings: scope === "thin" ? 0 : 2 },
        { key: "photo", label: "Your own photo", listings: scope === "thin" ? 1 : 2 },
      ],
      early:
        scope === "thin"
          ? { sold: { medianDays: null, sample: sample(1, 1) }, unsold: { medianDays: null, sample: sample(1, 2) } }
          : { sold: { medianDays: 24, sample: sample(c - 4, l - 9) }, unsold: { medianDays: 9, sample: sample(6, 9) } },
      contentDeals: { pct: gate(scope === "all" ? 18 : 27, c), sample: { creators: c, sponsors: scope === "thin" ? 1 : scope === "all" ? 88 : 22 } },
    },
    you: {
      asOf,
      sample: { creators: c, listings: l, creatorsWithASale: Math.max(1, Math.round(c * 0.7)) },
      listings: mineHere.length,
      raisedCents: scope === "thin" ? 0 : scope === "all" ? 1_184_000 : 612_500,
      placements: scope === "thin" ? { filled: 0, total: 22, pct: 0 } : { filled: 11, total: 19, pct: 58 },
      daysLive: scope === "thin" ? 4 : 7,
      daysToFirstSale: scope === "thin" ? null : 2,
      followers: 48_210,
      usdPerFollower: scope === "thin" ? null : 0.127,
      floorCents: 12_500,
      median: {
        raisedCents: m(284_000),
        filledPct: m(46),
        daysLive: m(9),
        daysToFirstSale: m(4),
        usdPerFollower: m(0.061),
        floorCents: m(10_000),
      },
    },
    whatSells: {
      asOf,
      sample: { creators: c, listings: l, sales: scope === "thin" ? 1 : scope === "all" ? 402 : 125 },
      surfaces: surfaces.map(sellRow) as Insights["whatSells"]["surfaces"],
      products,
    },
    pricing: {
      asOf,
      sample: { creators: c, listings: l, unpriced: scope === "thin" ? 0 : 3 },
      bands: [
        { key: "under-50", label: "Under $50", listings: 6, withSale: 5 },
        { key: "50-149", label: "$50 to $149", listings: 11, withSale: 8 },
        { key: "150-499", label: "$150 to $499", listings: 9, withSale: 5 },
        { key: "500-plus", label: "$500 and over", listings: 5, withSale: 2 },
      ].map((b) => {
        const creators = scope === "thin" ? 1 : Math.max(2, Math.round(b.listings * (scope === "all" ? 2.2 : 0.8)));
        const listings = scope === "thin" ? 1 : Math.round(b.listings * k);
        return { ...b, listings, withSale: scope === "thin" ? 0 : Math.round(b.withSale * k), pct: gate(Math.round((b.withSale / b.listings) * 100), creators), sample: sample(creators, listings) };
      }),
      ways: [
        { key: "fixed" as const, label: "Fixed price", placements: 120, filled: 71 },
        { key: "offers" as const, label: "Fixed or offers", placements: 48, filled: 33 },
        { key: "bids" as const, label: "Bidding", placements: 9, filled: 5 },
      ].map((w) => {
        const creators = scope === "thin" ? 1 : w.key === "bids" ? 2 : Math.round(c * 0.6);
        return { ...w, placements: Math.round(w.placements * k), filled: Math.round(w.filled * k), filledPct: gate(Math.round((w.filled / w.placements) * 100), creators), sample: sample(creators, Math.round(10 * k)) };
      }),
    },
    timing: {
      asOf,
      timeZone: "Asia/Singapore",
      sample: { creators: c, listings: l, listingsWithASale: scope === "thin" ? 1 : Math.round(l * 0.7) },
      ages: [
        { key: "30-plus", label: "30 days or more before", listings: 7, placements: 50, filled: 38 },
        { key: "14-29", label: "14 to 29 days before", listings: 12, placements: 80, filled: 45 },
        { key: "7-13", label: "7 to 13 days before", listings: 8, placements: 40, filled: 17 },
        { key: "under-7", label: "Under a week before", listings: 4, placements: 18, filled: 4 },
      ].map((a) => {
        const creators = scope === "thin" ? 1 : Math.max(2, Math.round(a.listings * (scope === "all" ? 2 : 0.9)));
        return { ...a, listings: Math.round(a.listings * k), placements: Math.round(a.placements * k), filled: Math.round(a.filled * k), filledPct: gate(Math.round((a.filled / a.placements) * 100), creators), sample: sample(creators, Math.round(a.listings * k)) };
      }),
      medianDaysToFirstSale: gate(4, c),
      medianDaysToFirstSaleSample: sample(c, l),
      weekdays,
    },
    brands: {
      asOf,
      event: ev && brandRows.length ? { brands: brandRows, sample: { paidOrders: 34, named: 28 } } : null,
      allTime: { brands: brands("all"), sample: { paidOrders: 402, named: 311 } },
    },
  };
}
