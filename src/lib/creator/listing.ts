/**
 * A listing, as the creator builds it and as the backend stores it.
 *
 * WHY THE FORM HOLDS ITS OWN MODEL AND NOT THE API'S
 *
 * The API takes cents, instants and arrays of positions. A creator types
 * dollars into a box, picks a day on a calendar, and thinks in RUNGS — "the
 * $50 logo, three of them" — not in the three positions a rung expands into.
 * So the form owns a draft shaped like what a person writes, and `bodyOf`
 * turns it into the payload once, in one place, where the conversion can be
 * read and checked.
 *
 * WHY MONEY IS A STRING IN THE DRAFT AND AN INTEGER IN THE BODY
 *
 * "1,300" is a thing somebody typed, and half-typed states like "13." have to
 * survive being re-rendered. Cents are computed from the text at the moment it
 * is sent, by splitting on the decimal point rather than multiplying a float:
 * `12.34 * 100` is 1233.9999999999998 in this language, and a listing is money.
 *
 * WHY A PATCH IS A DIFF AND NOT THE WHOLE DRAFT
 *
 * `updateBody` on the backend carries no zod `.default()` anywhere, on purpose:
 * zod 4 applies defaults inside `.partial()`, so a PATCH that omitted a field
 * would reset it. `patchOf` keeps that property honest from this side by
 * sending only the keys whose value actually changed.
 */

import type { Chain } from "@/lib/ad-space/types";

/* ── What the backend allows, mirrored ────────────────────────────── */

/**
 * The backend's own limits, copied rather than fetched.
 *
 * They are enforced there and mirrored here so the form can refuse before the
 * server has to: a creator who builds a ladder the API then rejects has wasted
 * their evening on our layout. If any of these moves in
 * `server/services/ad-space/rules.ts` or `offers-rules.ts`, it moves here too.
 */
export const LIMITS = {
  /** A spot's listed price: $5 to $25,000. */
  PRICE_MIN_CENTS: 500,
  PRICE_MAX_CENTS: 2_500_000,
  /** No offer, counter or bid under $25 — so no price on a rung that takes them. */
  OFFER_MIN_CENTS: 2_500,
  /** A session slot is at least $50. */
  SESSION_MIN_CENTS: 5_000,
  /** The public goal: its own cheapest spot, up to a million dollars. */
  GOAL_MIN_CENTS: 500,
  GOAL_MAX_CENTS: 100_000_000,
  /** A campaign runs at least a day and at most sixty. */
  MIN_CAMPAIGN_HOURS: 24,
  MAX_CAMPAIGN_DAYS: 60,
  /** Bidding ends at least 24 h after it goes live and 50 h before it closes. */
  BIDDING_MIN_AFTER_PUBLISH_HOURS: 24,
  BIDDING_MIN_BEFORE_CLOSE_HOURS: 50,
  MAX_TIERS: 6,
  TIER_TITLE_MAX: 60,
  TIER_PERKS_MAX: 5,
  TIER_PERK_MAX: 120,
  MAX_POSITIONS: 40,
  TITLE_MIN: 3,
  TITLE_MAX: 120,
  REASON_MAX: 280,
  PITCH_MAX: 280,
  KEY_DATES_MAX: 10,
  DELIVERABLES_MAX: 12,
  DELIVERABLE_COUNT_MAX: 20,
  DELIVERABLE_DAYS_AFTER_CLOSE: 90,
  NOTE_MIN: 3,
  NOTE_MAX: 120,
  /**
   * How many listings one series holds, the original counted. Past this,
   * "the same thing at several events" stops being true: a creator who has
   * said yes to twenty events has promised twenty weekends.
   *
   * One call adds at most `SERIES_MAX - 1` of them, because the original is
   * always one of the ten — the router's own body schema says so, and a
   * tenth event in a single request is turned away before the service ever
   * counts it.
   */
  SERIES_MAX: 10,
  SERVICE_NAME_MIN: 3,
  SERVICE_NAME_MAX: 60,
  SERVICE_SUMMARY_MIN: 20,
  SERVICE_SUMMARY_MAX: 280,
  FEE_BPS: 500,
} as const;

export const CONTENT_KINDS = ["logo", "qr", "text", "photo"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const DELIVERABLE_KINDS = [
  "in_person",
  "photo_post",
  "video",
  "story",
  "thank_you_post",
  "mention",
  "custom",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const PLATFORMS = ["x", "instagram", "tiktok", "youtube", "linkedin", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const FALLBACKS = ["content_anyway", "creator_refund", "next_event"] as const;
export type Fallback = (typeof FALLBACKS)[number];

export const VENUE_TYPES = ["travel", "conference", "sports_event", "private_event", "everyday"] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const EVENT_CATEGORIES = [
  "crypto",
  "fintech",
  "ai",
  "tech",
  "robotics",
  "science",
  "motorsport",
  "sports",
  "travel",
  "culture",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Venues whose own rules decide whether branded items are allowed. */
export const VENUES_WITH_RULES: readonly VenueType[] = ["conference", "sports_event", "private_event"];

export const ATTESTATIONS = [
  "owns_item",
  "venue_rules_checked",
  "sports_rules_allow_logos",
  "host_consent",
  "temporary_skin_safe_adult",
  "discloses_sponsorship",
  "public_place",
  "no_investment_advice",
  "no_investor_intros",
] as const;
export type Attestation = (typeof ATTESTATIONS)[number];

/** Every declaration a session publishes with, whatever the venue. */
const SESSION_ATTESTATIONS: readonly Attestation[] = [
  "public_place",
  "no_investment_advice",
  "no_investor_intros",
  "discloses_sponsorship",
];

/**
 * The declarations this listing must carry, exactly as `requiredAttestationsFor`
 * decides them on the backend. Ticking these is what the publish gate checks,
 * so the form asks for these and no others.
 */
export function requiredAttestations(
  templateRequires: readonly string[],
  venue: VenueType,
  kind: TemplateKind,
  isSession: boolean,
  /** Content production declares exactly what its template asks, like the backend. */
  isProduction = false,
): Attestation[] {
  const out = new Set<Attestation>();
  if (kind === "service" && isProduction) {
    return ATTESTATIONS.filter((a) => templateRequires.includes(a));
  }
  if (kind === "service" && isSession) {
    for (const a of SESSION_ATTESTATIONS) out.add(a);
  } else {
    out.add(kind === "service" ? "discloses_sponsorship" : "owns_item");
    if (VENUES_WITH_RULES.includes(venue)) out.add("venue_rules_checked");
    if (venue === "sports_event") out.add("sports_rules_allow_logos");
    if (venue === "private_event") out.add("host_consent");
  }
  for (const a of templateRequires) {
    if ((ATTESTATIONS as readonly string[]).includes(a)) out.add(a as Attestation);
  }
  return ATTESTATIONS.filter((a) => out.has(a));
}

/* ── What the API hands back ──────────────────────────────────────── */

export type TemplateKind = "placement" | "service";
export type ServiceFormat = "content" | "session" | "production";

export interface TemplateZone {
  zoneKey: string;
  label: string;
  viewKey: string;
  sizeLabel: string;
  suggestedPriceCents: number | null;
}

export interface Template {
  id: string;
  productType: string;
  name: string;
  kind: TemplateKind;
  service: {
    summary: string;
    maxSlots: number;
    format?: ServiceFormat;
    suggestedPriceCents?: number;
    deliverableKind?: string;
    /** `custom-service`: the creator names the service themselves. */
    custom?: boolean;
  } | null;
  allowedVenues: VenueType[];
  requiredAttestations: string[];
  zones: TemplateZone[];
}

/** A session is the creator's time in person, and it has rules of its own. */
export function isSessionTemplate(t: Template | null): boolean {
  return t?.kind === "service" && t.service?.format === "session";
}

/** Content production: a package for the brand's own channels, delivered privately. */
export function isProductionTemplate(t: Template | null): boolean {
  return t?.kind === "service" && t.service?.format === "production";
}

/* ── Content production (spaces-content-production-v0.md) ─────────── */

export const PRODUCTION_DELIVERABLES = ["interviews", "shortForm", "brollPack", "photoSet", "socialAssets"] as const;
export type ProductionDeliverable = (typeof PRODUCTION_DELIVERABLES)[number];

/** What each line is, as the creator ticks it and the brand reads it. Mirrors production-rules.ts. */
export const PRODUCTION_DELIVERABLE_LABEL: Record<ProductionDeliverable, string> = {
  interviews: "On-camera interviews",
  shortForm: "Short-form edits (9:16, up to 60 s)",
  brollPack: "B-roll pack (raw clips)",
  photoSet: "Photo set",
  socialAssets: "Social assets (cut-downs, captions)",
};

export const PRODUCTION_TURNAROUNDS = [24, 48, 72] as const;
export type Turnaround = (typeof PRODUCTION_TURNAROUNDS)[number];
export const USAGE_SCOPES = ["organic", "organic_and_paid"] as const;
export const USAGE_TERMS = ["6m", "12m", "perpetual"] as const;
export const USAGE_SCOPE_LABEL: Record<(typeof USAGE_SCOPES)[number], string> = {
  organic: "Organic social only",
  organic_and_paid: "Organic and paid ads",
};
export const USAGE_TERM_LABEL: Record<(typeof USAGE_TERMS)[number], string> = {
  "6m": "6 months",
  "12m": "12 months",
  perpetual: "Perpetual",
};
/** Each line, at most this many per spot. */
export const PRODUCTION_DELIVERABLE_MAX = 20;

export interface ProductionPackage {
  deliverables: Record<ProductionDeliverable, number>;
  turnaroundHours: Turnaround;
  usage: { scope: (typeof USAGE_SCOPES)[number]; term: (typeof USAGE_TERMS)[number] };
}

/** What a spot includes, as the API sends it back on a space. */
export interface PackageView extends ProductionPackage {
  lines: { key: ProductionDeliverable; label: string; count: number }[];
}

export const DEFAULT_PACKAGE: ProductionPackage = {
  deliverables: { interviews: 1, shortForm: 3, brollPack: 1, photoSet: 0, socialAssets: 0 },
  turnaroundHours: 48,
  usage: { scope: "organic", term: "12m" },
};

export interface ChecklistItem {
  key: ProductionDeliverable;
  count: number;
}

export type ProductionState = "awaiting_delivery" | "overdue" | "delivered" | "revision_requested" | "accepted";

export interface ProductionBrief {
  goal: "awareness" | "product_launch" | "hiring" | "community";
  keyMessages: string[];
  interviewees: string | null;
  assetsUrl: string | null;
  dos: string | null;
  donts: string | null;
  shootContact: { kind: "x" | "telegram"; value: string };
}

/** One sold production spot, for the creator, a delivering seat and the brand. Never public. */
export interface ProductionView {
  orderId: string | null;
  positionId: string;
  package: PackageView | null;
  brief: ProductionBrief | null;
  event: { startsOn: string; endsOn: string; timeZone: string | null };
  shootOn: string;
  shootOnSet: boolean;
  dueAt: string;
  state: ProductionState;
  delivery: null | { url: string; checklist: ChecklistItem[]; deliveredAt: string; firstDeliveredAt: string };
  revision: null | { note: string; requestedAt: string };
  revisionAvailable: boolean;
  accepted: null | { at: string; auto: boolean };
  autoAcceptAt: string | null;
  onTime: boolean | null;
  publicProof: null | { url: string; at: string };
}

export function isCustomServiceTemplate(t: Template | null): boolean {
  return t?.kind === "service" && t.service?.custom === true;
}

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string | null;
  startsOn: string;
  endsOn: string;
  category: string;
  spaceCount: number;
}

export type PricingMode = "fixed" | "takeover" | "offers" | "bids";
/** How one rung sells. Never `takeover`: that is a rule about the whole board. */
export type SaleMode = "fixed" | "fixed_with_offers" | "offers" | "bids";
export type PositionStatus = "open" | "held" | "sold";
export type SpaceStatus = "draft" | "live" | "closed" | "delisted";

export interface OffersBlock {
  mode: SaleMode;
  openCount: number | null;
  bidCount: number | null;
  highestBidUsdc: string | null;
  leaderName: string | null;
  reserveMet: boolean | null;
  openingBidUsdc: string | null;
  nextMinimumBidUsdc: string | null;
  biddingEndsAt: string | null;
  biddingOpen: boolean | null;
  reservedUntil: string | null;
  /** The creator's own view only: the floor nobody else is ever shown. */
  minOfferUsdc?: string | null;
}

export interface PositionView {
  id: string;
  zoneKey: string;
  label: string;
  tierKey: string | null;
  saleMode: SaleMode | null;
  title: string | null;
  perks: string[];
  priceCents: number | null;
  sponsorPaysUsdc: string | null;
  creatorReceivesUsdc: string | null;
  pitch: string | null;
  accepts: ContentKind[];
  status: PositionStatus;
  offers: OffersBlock | null;
  sponsor: {
    name: string | null;
    url: string | null;
    xHandle: string | null;
    contentKind: string | null;
    contentText: string | null;
    imageUrl: string | null;
  } | null;
  content: { status: string; rejectedReason: string | null; submittedAt: string | null } | null;
  delivered: { url: string; at: string } | null;
  qr: { code: string; url: string; scans: number } | null;
  /** This spot's square on the listing's photo, in fractions (0 to 1) of it. A server older than photos sends none. */
  rect?: PhotoRect | null;
  /** Sold, or reserved for an accepted offer: the square cannot move. */
  rectFrozen?: boolean;
  /** A sold content production spot, on the creator's own view only. */
  orderId?: string | null;
  production?: ProductionView | null;
}

/** A square on the photo, in fractions (0 to 1) of it. */
export interface PhotoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The creator's own photo of the product. `ready`: every spot has its square, so the page shows it. */
export interface ListingPhoto {
  url: string | null;
  width: number;
  height: number;
  ready: boolean;
}

export interface DeliverableView {
  id: string;
  kind: string;
  platform: string | null;
  count: number;
  dueDate: string;
  note: string | null;
  deliveredUrl: string | null;
  state: "delivered" | "upcoming" | "overdue" | "missed";
}

export interface SpaceUpdate {
  id: string;
  body: string | null;
  imageUrl: string | null;
  positionId: string | null;
  createdAt: string;
}

/** Only the parts of the space view this console reads. The API sends more. */
export interface SpaceView {
  id: string;
  slug: string;
  title: string;
  reason: string | null;
  fundingGoalCents: number | null;
  status: SpaceStatus;
  kind: TemplateKind;
  serviceName: string | null;
  serviceSummary: string | null;
  closesAt: string;
  keyDates: { label: string; date: string }[];
  deliverBy: string | null;
  publishedAt: string | null;
  chains: Chain[];
  feePayer: "sponsor" | "creator";
  feeBps: number;
  pricingMode: PricingMode;
  acceptsOffers: boolean;
  biddingEndsAt: string | null;
  spaceOffers: OffersBlock | null;
  venueType: string;
  eventName: string | null;
  fallback: string;
  fallbackNote: string | null;
  attestations: string[];
  requiredAttestations: string[];
  deliverables: DeliverableView[];
  template: Template | null;
  positions: PositionView[];
  totals: { positions: number; sold: number; committedCents: number; totalCents: number | null };
  updates: SpaceUpdate[];
  share: { url: string; text: string } | null;
  event: EventSummary | null;
  /** The creator's own picture for this listing, or null (the gradient is drawn instead). */
  bannerUrl?: string | null;
  bannerGradient?: string | null;
  /** The creator's photo of the product with the spots on it, or null. A server older than photos sends none. */
  photo?: ListingPhoto | null;
  /** Content production: what a spot includes. Null on every other template; absent on an older server. */
  production?: PackageView | null;
  /** "What you get" in the creator's words; null or absent is never edited. */
  brandGets?: BrandGetsLine[] | null;
  /** The product in the creator's colours, or null for the outline alone. Absent on an older server. */
  productLook?: { body: string; accent: string } | null;
  /** A photo per side of the product, keyed by view. Empty or absent: none. Never with `photo`. */
  viewPhotos?: Record<string, ListingPhoto>;
}

export interface SpaceCard {
  id: string;
  slug: string;
  title: string;
  templateId: string;
  serviceName: string | null;
  status: SpaceStatus;
  closesAt: string;
  publishedAt: string | null;
  chains: Chain[];
  pricingMode: PricingMode;
  acceptsOffers: boolean;
  biddingEndsAt: string | null;
  totals: { positions: number; sold: number; committedCents: number; totalCents: number | null };
  fundingGoalCents: number | null;
  awaitingReview: number;
  event: EventSummary | null;
  bannerUrl?: string | null;
  bannerGradient?: string | null;
}

/* ── One listing, several events ──────────────────────────────────── */

/**
 * One event this listing is being taken to, and when that copy stops selling.
 *
 * The close is per event and never shared. The whole reason a series exists is
 * that the events are on different days, so a single close date would be in the
 * past for one of them and months early for another.
 */
export interface SeriesEventInput {
  eventId: string;
  /** An instant, as the API takes it. */
  closesAt: string;
}

/**
 * One event the listing could not be taken to, and why.
 *
 * A refusal here is about THAT event and nothing else: the call still made
 * every other copy, and they come back in the same answer. `code` is an
 * ordinary refusal code — `series_event_repeated`, `event_unavailable`, or
 * anything creating a draft can refuse — so it goes through the same machinery
 * every other refusal does.
 */
export interface SeriesRefusal {
  eventId: string;
  code: string;
  details?: unknown;
}

/**
 * Every listing that came out of one authoring act, the original first.
 *
 * They are ordinary listings and nothing about them is joint: each has its own
 * link, its own spots, its own close and its own bidding clock. What they share
 * is only that they can be listed together.
 */
export interface SeriesView {
  seriesId: string;
  spaces: SpaceView[];
}

export type OfferKind = "offer" | "bid";
export type OfferStatus =
  | "pending"
  | "countered"
  | "accepted"
  | "paid"
  | "declined"
  | "expired"
  | "withdrawn"
  | "lapsed"
  | "superseded";

export interface OfferView {
  id: string;
  spaceId: string;
  spaceTitle: string;
  serviceName: string | null;
  spacePath: string | null;
  positionId: string | null;
  positionLabel: string | null;
  kind: OfferKind;
  status: OfferStatus;
  /** The agreed-price figure. What the creator RECEIVES only when the sponsor carries our fee. */
  amountUsdc: string;
  sponsorPaysUsdc: string;
  counterUsdc: string | null;
  counterSponsorPaysUsdc: string | null;
  agreedUsdc: string | null;
  agreedSponsorPaysUsdc: string | null;
  rounds: { by: string; amountUsdc: string; at: string }[];
  countersLeft: number;
  sponsor: {
    name: string;
    contactKind: string | null;
    contactValue: string | null;
    message: string | null;
    via: "app" | "web";
    backed: { chain: string; address: string; checkedAt: string } | null;
  };
  declineReason: string | null;
  expiresAt: string | null;
  orderId: string | null;
  leading: boolean | null;
  createdAt: string;
  /** The version accept, counter and decline are pinned to. */
  updatedAt: string;
}

export interface SalesSummary {
  /** What reached the creator's own wallet. Not the sponsor's gross. */
  receivedUsdc: string;
  soldSpots: number;
  orders: number;
  spaces: number;
  recent: {
    orderId: string;
    spaceId: string;
    spaceTitle: string;
    serviceName: string | null;
    zoneKey: string;
    chain: string;
    status: string;
    receivedUsdc: string;
    paidAt: string | null;
    /**
     * Who paid, as they named themselves: the name on the spot, the offer's,
     * or a session buyer's handle. Never an email. Null when they gave none;
     * absent from a server older than it.
     */
    sponsorName?: string | null;
  }[];
  /**
   * The server's totals per listing, over EVERY sale (not just `recent`),
   * biggest first. Absent from a server older than it.
   */
  listings?: SalesListing[];
}

/** One listing's sales, totalled by the server. */
export interface SalesListing {
  spaceId: string;
  spaceTitle: string;
  serviceName: string | null;
  /** What reached the creator from this listing. */
  receivedUsdc: string;
  /** Orders that paid (a spot taken over counts each order that paid for it). */
  orders: number;
  /** Spots this listing's sponsors hold now. */
  soldSpots: number;
  lastPaidAt: string | null;
}

/* ── Money, as text and as cents ──────────────────────────────────── */

/**
 * Dollars a person typed, as whole cents — or null if it is not an amount.
 *
 * Split on the point rather than multiplied, because a price is money: this
 * language makes `12.34 * 100` into 1233.9999999999998, and a listing built on
 * that would be a dollar out somewhere nobody ever looks.
 */
export function centsFromDollars(text: string): number | null {
  const clean = text.trim().replace(/[$,\s]/g, "");
  if (!clean) return null;
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m || (!m[1] && !m[2])) return null;
  const whole = Number(m[1] || "0");
  const frac = Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) return null;
  return whole * 100 + frac;
}

/**
 * A USDC figure from the API back into whole cents.
 *
 * The API prints six decimals because that is what the chain stores, and every
 * amount it prints came from cents (`cents * 10^4`), so the last four are
 * always zeros. Only the first two are read, and nothing is ever multiplied.
 */
export function centsFromUsdc(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d+)(?:\.(\d{0,6}))?$/.exec(value.trim());
  if (!m) return null;
  const whole = Number(m[1]);
  const cents = Number((m[2] ?? "").slice(0, 2).padEnd(2, "0") || "0");
  return Number.isSafeInteger(whole) ? whole * 100 + cents : null;
}

/** Cents back into what the box should show: "130000" → "1300", "5050" → "50.50". */
export function dollarsFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Integer cents as "$1,300" or "$1,300.50". */
export function usd(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/**
 * What a sponsor pays and what the creator keeps, from one listed price.
 *
 * The same arithmetic as `orderAmounts`: our 5% is the same number either way,
 * and the choice only moves who carries it. Shown so a creator setting a price
 * sees both halves of it before anybody pays.
 */
export function feeSplit(priceCents: number, feePayer: "sponsor" | "creator") {
  const fee = Math.floor((priceCents * LIMITS.FEE_BPS) / 10_000);
  return feePayer === "creator"
    ? { sponsorPaysCents: priceCents, creatorGetsCents: priceCents - fee, feeCents: fee }
    : { sponsorPaysCents: priceCents + fee, creatorGetsCents: priceCents, feeCents: fee };
}

/**
 * What actually reaches the creator's wallet, as USDC, exactly.
 *
 * WHY THIS IS COMPUTED HERE AT ALL, GIVEN THE HOUSE RULE
 *
 * Every other figure on these screens comes from the server. An OFFER is the
 * one place it cannot: the API sends the agreed amount and what the sponsor
 * moves, and when the creator carries our fee those are the SAME number and
 * neither of them is the creator's receipt. Money on this screen is somebody's
 * income, so it is worked out rather than left as the sponsor's gross with a
 * hopeful label.
 *
 * It is the server's own arithmetic, not an approximation of it: base units as
 * BigInt (`cents × 10⁴`), the fee floored in base units exactly as `feeFor`
 * does it, and the same printing as `formatUsdc`. `12.34 × 0.95` in floating
 * point is not this, which is why none of it is a number.
 */
export function creatorReceivesUsdc(priceCents: number, feePayer: "sponsor" | "creator"): string {
  const base = BigInt(priceCents) * 10_000n;
  const fee = (base * BigInt(LIMITS.FEE_BPS)) / 10_000n;
  return formatUsdcBase(feePayer === "creator" ? base - fee : base);
}

/** A bigint of USDC base units as the API prints it: at least two decimals, no trailing zeros past that. */
function formatUsdcBase(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = (base % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}

/* ── The draft the form holds ─────────────────────────────────────── */

/** One rung of the ladder, as a person writes it. */
export interface RungDraft {
  /** Stable across edits, so a sold copy keeps belonging to its rung. */
  key: string;
  title: string;
  priceDollars: string;
  available: number;
  perks: string[];
  /** Null: this rung sells the way the whole listing does. */
  saleMode: SaleMode | null;
  /** The creator's own floor. Never shown to a brand. */
  minOfferDollars: string;
  pitch: string;
}

export interface ZoneDraft {
  zoneKey: string;
  on: boolean;
  priceDollars: string;
  minOfferDollars: string;
  pitch: string;
  accepts: ContentKind[];
}

/**
 * One line of "What you get", in the creator's words (brand-gets-rules.ts on
 * the backend). `reach` and `spot` are OUR suggestions, worded on the page
 * from live figures; `text` is the creator's own line.
 */
export type BrandGetsLine = { kind: "reach" } | { kind: "spot" } | { kind: "text"; text: string };

export const BRAND_GETS_LIMITS = { MAX_LINES: 8, TEXT_MIN: 3, TEXT_MAX: 120 } as const;

/** What an untouched listing shows: the two suggestions, reach first. */
export const BRAND_GETS_SUGGESTED: readonly BrandGetsLine[] = [{ kind: "reach" }, { kind: "spot" }];

export interface DeliverableDraft {
  kind: DeliverableKind;
  platform: Platform | null;
  count: number;
  dueDate: string;
  note: string;
}

export interface ListingDraft {
  templateId: string;
  title: string;
  reason: string;
  fundingGoalDollars: string;
  /** A `datetime-local` value, in the creator's own clock. */
  closesAt: string;
  biddingEndsAt: string;
  pricingMode: PricingMode;
  acceptsOffers: boolean;
  feePayer: "sponsor" | "creator";
  venueType: VenueType;
  eventId: string | null;
  eventName: string;
  keyDates: { label: string; date: string }[];
  chains: Chain[];
  fallback: Fallback;
  fallbackNote: string;
  attestations: Attestation[];
  deliverables: DeliverableDraft[];
  /** "What you get" lines in the creator's order; null is never edited (the suggestions show). */
  brandGets: BrandGetsLine[] | null;
  deliverBy: string;
  serviceName: string;
  serviceSummary: string;
  /** Content production only: what a spot includes, the turnaround and the rights. */
  production: ProductionPackage;
  /** What this listing is made of. A placement always sells zones. */
  sells: "ladder" | "slots" | "zones";
  rungs: RungDraft[];
  slots: number;
  slotPriceDollars: string;
  slotMinOfferDollars: string;
  slotPitch: string;
  zones: ZoneDraft[];
}

/** A key nothing else on this ladder has, stable for as long as the rung lives. */
export function newRungKey(existing: readonly RungDraft[]): string {
  for (let n = 1; ; n += 1) {
    const key = `tier-${n}`;
    if (!existing.some((r) => r.key === key)) return key;
  }
}

/**
 * A fresh rung. A second one starts with the lines of the one below it,
 * because a ladder is cumulative in practice — "everything in $50, plus the
 * mic flag" — and re-typing that is how people give up halfway. Pre-filled,
 * never enforced: a rung that deliberately does not include the one under it
 * is allowed to say so, and the lines are editable text.
 */
export function newRung(existing: readonly RungDraft[]): RungDraft {
  const below = existing[existing.length - 1];
  return {
    key: newRungKey(existing),
    title: "",
    priceDollars: "",
    available: 1,
    perks: below ? [...below.perks] : [""],
    saleMode: null,
    minOfferDollars: "",
    pitch: "",
  };
}

/** An empty draft for a template, with whatever that template already knows. */
export function draftFor(template: Template): ListingDraft {
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const suggested = template.service?.suggestedPriceCents ?? null;
  return {
    templateId: template.id,
    title: "",
    reason: "",
    fundingGoalDollars: "",
    closesAt: "",
    biddingEndsAt: "",
    pricingMode: "fixed",
    acceptsOffers: false,
    feePayer: "sponsor",
    venueType: template.allowedVenues[0] ?? "everyday",
    eventId: null,
    eventName: "",
    keyDates: [],
    chains: [],
    // Production is filmed at the event: without the event there is no content either.
    fallback: session || production ? "creator_refund" : "content_anyway",
    fallbackNote: "",
    attestations: [],
    deliverables: [],
    brandGets: null,
    deliverBy: "",
    serviceName: "",
    serviceSummary: "",
    production: { ...DEFAULT_PACKAGE, deliverables: { ...DEFAULT_PACKAGE.deliverables }, usage: { ...DEFAULT_PACKAGE.usage } },
    // A production spot is one package at one price: N identical spots, not a ladder.
    sells: production ? "slots" : service ? "ladder" : "zones",
    rungs: service ? [{ ...newRung([]), perks: [""] }] : [],
    slots: 1,
    slotPriceDollars: dollarsFromCents(suggested),
    slotMinOfferDollars: "",
    slotPitch: "",
    zones: template.zones.map((z) => ({
      zoneKey: z.zoneKey,
      on: true,
      priceDollars: dollarsFromCents(z.suggestedPriceCents),
      minOfferDollars: "",
      pitch: "",
      accepts: ["logo"],
    })),
  };
}

/**
 * A saved draft, back in the form's own shape.
 *
 * A creator who closes the tab has not lost an evening: the draft is on the
 * server from the moment the ladder is first saved, and this is how it is
 * picked up again. The ladder is rebuilt by grouping the positions back into
 * the rungs they were expanded from — a rung with three available is three
 * positions sharing a `tierKey`, and that key is the whole of what they have
 * in common.
 */
export function draftFromSpace(space: SpaceView, template: Template): ListingDraft {
  const base = draftFor(template);
  const tiered = space.positions.some((p) => p.tierKey);
  const rungs: RungDraft[] = [];
  if (tiered) {
    for (const p of space.positions) {
      if (!p.tierKey) continue;
      const seen = rungs.find((r) => r.key === p.tierKey);
      if (seen) {
        seen.available += 1;
        continue;
      }
      rungs.push({
        key: p.tierKey,
        title: p.title ?? "",
        priceDollars: dollarsFromCents(p.priceCents),
        available: 1,
        perks: p.perks.length ? p.perks : [""],
        saleMode: p.saleMode,
        minOfferDollars: dollarsFromCents(centsFromUsdc(p.offers?.minOfferUsdc)),
        pitch: p.pitch ?? "",
      });
    }
  }
  const first = space.positions[0];

  return {
    ...base,
    title: space.title,
    reason: space.reason ?? "",
    fundingGoalDollars: dollarsFromCents(space.fundingGoalCents),
    closesAt: localValueOf(space.closesAt),
    biddingEndsAt: localValueOf(space.biddingEndsAt),
    pricingMode: space.pricingMode,
    acceptsOffers: space.acceptsOffers,
    feePayer: space.feePayer,
    venueType: (VENUE_TYPES as readonly string[]).includes(space.venueType)
      ? (space.venueType as VenueType)
      : base.venueType,
    eventId: space.event?.id ?? null,
    eventName: space.eventName ?? "",
    keyDates: space.keyDates ?? [],
    chains: space.chains,
    fallback: (FALLBACKS as readonly string[]).includes(space.fallback) ? (space.fallback as Fallback) : base.fallback,
    fallbackNote: space.fallbackNote ?? "",
    attestations: space.attestations.filter((a): a is Attestation => (ATTESTATIONS as readonly string[]).includes(a)),
    deliverables: space.deliverables.map((d) => ({
      kind: (DELIVERABLE_KINDS as readonly string[]).includes(d.kind) ? (d.kind as DeliverableKind) : "custom",
      platform: (PLATFORMS as readonly string[]).includes(d.platform ?? "") ? (d.platform as Platform) : null,
      count: d.count,
      dueDate: d.dueDate,
      note: d.note ?? "",
    })),
    brandGets: space.brandGets ? space.brandGets.map((l) => ({ ...l })) : null,
    deliverBy: space.deliverBy ?? "",
    serviceName: space.serviceName ?? "",
    serviceSummary: space.serviceSummary ?? "",
    production: space.production
      ? {
          deliverables: { ...space.production.deliverables },
          turnaroundHours: space.production.turnaroundHours,
          usage: { ...space.production.usage },
        }
      : base.production,
    sells: template.kind === "service" ? (tiered ? "ladder" : "slots") : "zones",
    rungs: rungs.length ? rungs : base.rungs,
    slots: template.kind === "service" && !tiered ? Math.max(1, space.positions.length) : base.slots,
    slotPriceDollars: dollarsFromCents(first?.priceCents ?? null),
    slotMinOfferDollars: dollarsFromCents(centsFromUsdc(space.spaceOffers?.minOfferUsdc)),
    slotPitch: first?.pitch ?? "",
    zones: template.zones.map((z) => {
      const own = space.positions.find((p) => p.zoneKey === z.zoneKey);
      return {
        zoneKey: z.zoneKey,
        on: !!own,
        priceDollars: dollarsFromCents(own?.priceCents ?? null),
        minOfferDollars: dollarsFromCents(centsFromUsdc(own?.offers?.minOfferUsdc)),
        pitch: own?.pitch ?? "",
        accepts: own?.accepts?.length ? own.accepts : (["logo"] as ContentKind[]),
      };
    }),
  };
}

/** A `datetime-local` value as the instant the API takes, or null. */
export function instantOf(value: string): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** An instant from the API back into a `datetime-local` value, in local time. */
export function localValueOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whether any rung on this ladder takes bids — which is what needs a countdown. */
export function anyRungBids(draft: ListingDraft): boolean {
  return draft.sells === "ladder" && draft.rungs.some((r) => r.saleMode === "bids");
}

/** How a rung actually sells: its own answer, else the whole listing's. */
export function saleModeOf(draft: ListingDraft, own: SaleMode | null): SaleMode {
  if (own) return own;
  switch (draft.pricingMode) {
    case "offers":
      return "offers";
    case "bids":
      return "bids";
    case "takeover":
      // A rung never sells by takeover, but a board can; for the purposes of
      // "does this need a price", takeover behaves like a fixed price.
      return "fixed";
    default:
      return draft.acceptsOffers ? "fixed_with_offers" : "fixed";
  }
}

/** Whether a way of selling shows a price at all. `offers` deliberately does not. */
export function modeShowsPrice(mode: SaleMode): boolean {
  return mode !== "offers";
}

/** Whether a way of selling keeps a hidden floor. */
export function modeKeepsFloor(mode: SaleMode): boolean {
  return mode === "offers" || mode === "bids" || mode === "fixed_with_offers";
}

/* ── The draft as a payload ───────────────────────────────────────── */

/** Null for an empty box, so "no goal" and "no floor" are sent as nothing. */
function centsOrNull(text: string): number | null {
  return text.trim() ? centsFromDollars(text) : null;
}

function linesOf(perks: readonly string[]): string[] {
  return perks.map((p) => p.trim()).filter(Boolean);
}

/**
 * The whole body a create would send. A patch is the difference between two of
 * these, so everything the API is ever told is built here and nowhere else.
 */
export function bodyOf(draft: ListingDraft, template: Template): Record<string, unknown> {
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const body: Record<string, unknown> = {
    title: draft.title.trim(),
    reason: draft.reason.trim() || null,
    fundingGoalCents: centsOrNull(draft.fundingGoalDollars),
    closesAt: instantOf(draft.closesAt),
    keyDates: draft.keyDates.filter((k) => k.label.trim() && k.date),
    feePayer: draft.feePayer,
    pricingMode: draft.pricingMode,
    acceptsOffers: draft.pricingMode === "fixed" ? draft.acceptsOffers : false,
    // A countdown belongs to a bidding board, or to a ladder with a bidding
    // rung on it — which is a board that sells at a price and still has a clock.
    biddingEndsAt:
      draft.pricingMode === "bids" || anyRungBids(draft) ? instantOf(draft.biddingEndsAt) : null,
    venueType: draft.venueType,
    // The id wins over the name on the backend, so a picked event is sent as an
    // id and the typed name goes with it only when there is no id.
    eventId: draft.eventId,
    eventName: draft.eventId ? null : draft.eventName.trim() || null,
    chains: draft.chains,
    fallback: draft.fallback,
    fallbackNote: draft.fallbackNote.trim() || null,
    attestations: draft.attestations,
    // A line still being typed (empty) is not sent: the draft keeps it, the page does not.
    brandGets:
      draft.brandGets === null
        ? null
        : draft.brandGets.flatMap((l): BrandGetsLine[] =>
            l.kind !== "text" ? [l] : l.text.trim() ? [{ kind: "text", text: l.text.trim() }] : [],
          ),
  };

  if (template.kind === "service") {
    // A session's deliver-by is not typed: publish sets it to the day after
    // the event ends. Sending one would be a number we made up.
    body.deliverBy = session || production ? null : draft.deliverBy || null;
    // Sent only for production, so no other listing's PATCH ever mentions it.
    if (production) body.production = draft.production;
    body.deliverables = [];
    body.serviceName = isCustomServiceTemplate(template) ? draft.serviceName.trim() || null : null;
    body.serviceSummary = isCustomServiceTemplate(template) ? draft.serviceSummary.trim() || null : null;
    body.service =
      draft.sells === "ladder"
        ? {
            tiers: draft.rungs.map((r) => {
              const mode = saleModeOf(draft, r.saleMode);
              return {
                key: r.key,
                title: r.title.trim(),
                available: r.available,
                // A rung sold by offers shows no price, whatever is in the box.
                priceCents: modeShowsPrice(mode) ? centsOrNull(r.priceDollars) : null,
                minOfferCents: modeKeepsFloor(mode) ? centsOrNull(r.minOfferDollars) : null,
                perks: linesOf(r.perks),
                pitch: r.pitch.trim() || null,
                saleMode: r.saleMode,
              };
            }),
          }
        : {
            slots: draft.slots,
            priceCents: modeShowsPrice(saleModeOf(draft, null)) ? centsOrNull(draft.slotPriceDollars) : null,
            minOfferCents: modeKeepsFloor(saleModeOf(draft, null))
              ? centsOrNull(draft.slotMinOfferDollars)
              : null,
            pitch: draft.slotPitch.trim() || null,
          };
  } else {
    const mode = saleModeOf(draft, null);
    body.deliverBy = null;
    body.deliverables = draft.deliverables.map((d) => ({
      kind: d.kind,
      platform: d.platform,
      count: d.count,
      dueDate: d.dueDate,
      note: d.note.trim() || null,
    }));
    body.positions = draft.zones
      .filter((z) => z.on)
      .map((z) => ({
        zoneKey: z.zoneKey,
        priceCents: modeShowsPrice(mode) ? centsOrNull(z.priceDollars) : null,
        minOfferCents: modeKeepsFloor(mode) ? centsOrNull(z.minOfferDollars) : null,
        pitch: z.pitch.trim() || null,
        accepts: z.accepts,
      }));
  }
  return body;
}

/**
 * Only what changed, so an omitted field keeps its value.
 *
 * `updateBody` on the backend has no zod `.default()` in it, because zod 4
 * applies defaults inside `.partial()` and a PATCH that omitted a field would
 * reset it. Sending a diff is how this side keeps that promise: what we do not
 * mention, we do not touch.
 */
export function patchOf(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out[key] = after[key];
  }
  return out;
}
