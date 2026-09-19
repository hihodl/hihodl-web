/**
 * Spaces Insights: `GET /ad-space/insights?event=<slug|all>` and its shape.
 *
 * Built by the backend from HOLD Spaces' own paid orders
 * (services/ad-space/insights-rules.ts). A figure about other creators is
 * `null` when fewer than `minSample` creators stand behind it; the `sample`
 * beside it says how many do, which is what the screen shows instead.
 * Money is whole cents; a brand's spend is only ever a band.
 */

"use client";

import { call } from "./api";

export interface Sample {
  creators: number;
  listings: number;
}

export interface InsightsEvent {
  slug: string;
  name: string;
  city: string;
  startsOn: string;
  endsOn: string;
}

export interface Median {
  value: number | null;
  creators: number;
}

export interface YouBlock {
  asOf: string;
  sample: { creators: number; listings: number; creatorsWithASale: number };
  listings: number;
  raisedCents: number;
  placements: { filled: number; total: number; pct: number | null };
  daysLive: number | null;
  daysToFirstSale: number | null;
  followers: number | null;
  usdPerFollower: number | null;
  floorCents: number | null;
  median: {
    raisedCents: Median;
    filledPct: Median;
    daysLive: Median;
    daysToFirstSale: Median;
    usdPerFollower: Median;
    floorCents: Median;
  };
}

export type Surface = "object" | "clothing" | "service" | "photo" | "other";

export interface SellRow {
  key: string;
  label: string;
  listings: number;
  placements: number;
  filled: number;
  filledPct: number | null;
  moneyShare: number | null;
  sample: Sample;
}

export interface WhatSellsBlock {
  asOf: string;
  sample: { creators: number; listings: number; sales: number };
  surfaces: (SellRow & { key: Surface })[];
  products: SellRow[];
}

export interface PricingBlock {
  asOf: string;
  sample: { creators: number; listings: number; unpriced: number };
  bands: { key: string; label: string; listings: number; withSale: number; pct: number | null; sample: Sample }[];
  ways: { key: "fixed" | "offers" | "bids"; label: string; placements: number; filled: number; filledPct: number | null; sample: Sample }[];
}

export interface TimingBlock {
  asOf: string;
  timeZone: string;
  sample: { creators: number; listings: number; listingsWithASale: number };
  ages: { key: string; label: string; listings: number; placements: number; filled: number; filledPct: number | null; sample: Sample }[];
  medianDaysToFirstSale: number | null;
  medianDaysToFirstSaleSample: Sample;
  weekdays: {
    day: number;
    label: string;
    listings: number;
    soldFirstWeekPct: number | null;
    firstWeekSalesPerListing: number | null;
    sample: Sample;
  }[];
}

export interface Brand {
  name: string;
  handle: string | null;
  placements: number;
  spendBand: "under-100" | "100-999" | "1k-10k" | "10k+";
  spendBandLabel: string;
  country: string | null;
}

export interface BrandList {
  brands: Brand[];
  sample: { paidOrders: number; named: number };
}

export interface Insights {
  asOf: string;
  minSample: number;
  event: InsightsEvent | null;
  events: InsightsEvent[];
  you: YouBlock;
  whatSells: WhatSellsBlock;
  pricing: PricingBlock;
  timing: TimingBlock;
  brands: { asOf: string; event: BrandList | null; allTime: BrandList };
}

/** `event`: a slug, `all` for the whole of Spaces, or null for the creator's nearest event. */
export function getInsights(event: string | null): Promise<{ insights: Insights }> {
  return call<{ insights: Insights }>(event ? `ad-space/insights?event=${encodeURIComponent(event)}` : "ad-space/insights");
}
