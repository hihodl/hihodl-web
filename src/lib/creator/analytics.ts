/**
 * The creator's own business: `GET /ad-space/me/analytics` and its shape.
 *
 * Built by the backend (services/ad-space/analytics-rules.ts) from this
 * creator's own paid orders only: the brands that paid them and came back,
 * money per event, what sells and how fast, and how brands pay. Money is
 * whole cents; percentages are 0 to 100 with one decimal, null with nothing
 * to divide by.
 */

"use client";

import { call } from "./api";

export type Surface = "object" | "clothing" | "service" | "production" | "photo" | "other";

export interface BrandRelation {
  key: string;
  name: string;
  handle: string | null;
  logoUrl: string | null;
  /** public: as the page shows it. private: the name on your Sales. null: not named, grouped by who paid. */
  named: "public" | "private" | null;
  /** What reached you. */
  receivedCents: number;
  /** What the brand paid to reach you: your price plus our fee when they covered it. */
  sponsorPaidCents: number;
  orders: number;
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  events: { key: string; name: string; slug: string | null }[];
  listings: number;
  /** Paid at two or more events, or for two or more listings. */
  repeat: boolean;
  chains: { key: string; label: string; orders: number }[];
  payFrom: { key: "hold" | "wallet"; label: string; orders: number }[];
}

export interface EventRow {
  key: string;
  name: string;
  slug: string | null;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
  listings: number;
  receivedCents: number;
  orders: number;
  spotsSold: number;
  spotsTotal: number;
  sellThroughPct: number | null;
  brands: number;
}

export interface ListingRow {
  id: string;
  title: string;
  product: string;
  kind: Surface;
  status: string;
  event: string;
  spotsSold: number;
  spotsTotal: number;
  soldPct: number | null;
  receivedCents: number;
  orders: number;
  daysToFirstSale: number | null;
  daysToSellOut: number | null;
}

export interface GroupRow {
  key: string;
  label: string;
  listings: number;
  spotsSold: number;
  spotsTotal: number;
  soldPct: number | null;
  receivedCents: number;
  orders: number;
  medianDaysToFirstSale: number | null;
  medianDaysToSellOut: number | null;
  soldOutListings: number;
}

export interface MixRow {
  key: string;
  label: string;
  orders: number;
  ordersPct: number | null;
  receivedCents: number;
  receivedPct: number | null;
}

export interface InspiredListing {
  spaceId: string;
  title: string;
  creatorHandle: string | null;
  creatorName: string | null;
  path: string | null;
  creditedAt: string | null;
}

export interface CreatorAnalytics {
  asOf: string;
  totals: {
    receivedCents: number;
    sponsorPaidCents: number;
    orders: number;
    averageOrderCents: number | null;
    brands: number;
    namedBrands: number;
    repeatBrands: number;
    repeatReceivedPct: number | null;
    events: number;
    listings: number;
    spotsSold: number;
    spotsTotal: number;
    sellThroughPct: number | null;
    medianDaysToFirstSale: number | null;
    fee: { paidByBrandsCents: number; paidByYouCents: number };
  };
  brands: BrandRelation[];
  topBrands: BrandRelation[];
  byEvent: EventRow[];
  byListing: ListingRow[];
  byProduct: (GroupRow & { kind: Surface })[];
  byKind: (GroupRow & { key: Surface })[];
  payMix: { byChain: MixRow[]; byPayFrom: MixRow[]; byDeal: MixRow[] };
  /** Listings by other creators that credit you as their inspiration. Absent on an older server. */
  inspired?: { listings: number; creators: number; recent: InspiredListing[] };
}

export function getAnalytics(): Promise<{ analytics: CreatorAnalytics }> {
  return call<{ analytics: CreatorAnalytics }>("ad-space/me/analytics");
}

/* ── "Inspired by" ────────────────────────────────────────────────── */

export interface HoldCreatorHit {
  handle: string;
  name: string | null;
  avatarUrl: string | null;
  /** The HOLD username that matched, when it was that and not the X handle. */
  username: string | null;
}

export function searchCreators(q: string, limit = 6): Promise<{ creators: HoldCreatorHit[] }> {
  return call<{ creators: HoldCreatorHit[] }>(`ad-space/creators/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}
