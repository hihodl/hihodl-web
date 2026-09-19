/**
 * Ad Space, as the public API returns it.
 *
 * Mirrors documentation/ad-space-api-v0.md field for field. Anything the page
 * shows comes from here; nothing is invented on the web side. Amounts are the
 * server's strings (USDC) or integer cents, and the page formats them without
 * doing arithmetic on them.
 */

import type { PackageView as ProductionPackageView, ProductionView as ProductionSpotView } from "@/lib/creator/listing";

export type Chain = "solana" | "base" | "polygon";

export type SpaceStatus = "draft" | "live" | "closed" | "delisted";
export type PositionStatus = "open" | "held" | "sold";
export type ContentKind = "logo" | "qr" | "text" | "photo";
export type VerifiedType = "blue" | "business" | "government" | null;
export type DeliverableState = "upcoming" | "overdue" | "delivered" | "missed";
export type Fallback = "content_anyway" | "creator_refund" | "next_event";
export type VenueType = "travel" | "conference" | "sports_event" | "private_event" | "everyday";
/**
 * `takeover`: the listed price is where bidding OPENS, and a sold spot can be
 * taken by paying a multiple of what it last went for. The sponsor displaced is
 * repaid every cent inside the same transaction.
 *
 * `offers` and `bids` (hispace-offers-v0.md): the sponsor names the price. In
 * `offers` no price is shown; in `bids` the listed price is the opening bid and
 * the highest backed bid is public. A `fixed` space may also accept offers
 * (`acceptsOffers`). A server older than offers only ever sends the first two.
 */
export type PricingMode = "fixed" | "takeover" | "offers" | "bids";

export interface Creator {
  xUserId: string;
  xHandle: string;
  xName: string;
  xAvatarUrl: string | null;
  xVerifiedType: VerifiedType;
  xIdentityVerified: boolean;
  xFollowers: number;
  xAccountCreatedAt: string | null;
  trackRecord: TrackRecord;
}

/**
 * What a creator has delivered. `disputed` (hispace-in-the-room-v0.md) counts
 * sessions a buyer said did not happen; a backend that predates it leaves it
 * out, which reads as zero.
 */
export interface TrackRecord {
  delivered: number;
  missed: number;
  disputed?: number;
  /**
   * Content production: "Delivered on time: onTime of accepted", counted from
   * spots a brand accepted (or 72 hours of its silence did). Absent when the
   * creator has none, and on an older server.
   */
  production?: { onTime: number; accepted: number };
}

export interface TemplateView {
  key: string;
  label: string;
  viewBox: [number, number];
  outline: string[];
}

export interface TemplateZone {
  zoneKey: string;
  label: string;
  viewKey: string;
  rect: { x: number; y: number; w: number; h: number };
  sizeLabel: string;
  suggestedPriceCents: number;
}

export interface Template {
  id: string;
  kind: "placement" | "service";
  productType: string;
  name: string;
  views: TemplateView[];
  zones: TemplateZone[];
  service: {
    deliverableKind: string;
    summary: string;
    maxSlots: number;
    /**
     * `content` is delivered by a public link (tab `feed`); `session` is time in
     * person at an event (tab `room`), delivered by the buyer confirming it. A
     * backend that predates sessions leaves it out, which reads as `content`.
     */
    format?: ServiceFormat;
    /**
     * The `custom-service` template: the creator names and describes what they
     * sell, so a brand reads `Space.serviceName` and `Space.serviceSummary`, not
     * this template's generic ones. Absent on a server older than it.
     */
    custom?: boolean;
  } | null;
}

export type ServiceFormat = "content" | "session" | "production";

// Content production (spaces-content-production-v0.md): one set of types for
// the console and the public pages, kept with the creator's listing model.
export type {
  ChecklistItem,
  PackageView,
  ProductionBrief,
  ProductionState,
  ProductionView,
} from "@/lib/creator/listing";

export interface Sponsor {
  name: string;
  url: string | null;
  xHandle: string | null;
  contentKind: ContentKind;
  contentText: string | null;
  imageUrl: string | null;
}

/**
 * The ladder on a spot, on a space that prices by takeover. Null on a
 * fixed-price space.
 *
 * Each figure is named because at a multiple of two they collide: what the
 * creator gets from a takeover equals what the spot last sold for, so the same
 * amount can mean two different things one line apart. Nothing here is ever
 * rendered as a bare number.
 *
 * `nextPriceUsdc`, `nextSponsorPaysUsdc` and `refundsUsdc` are null when there
 * is nothing to take — the spot is still open, or `closed` says it can go no
 * higher.
 */
export interface Takeover {
  /** What the spot costs now. */
  priceUsdc: string;
  /** What it would be listed at after the next takeover. */
  nextPriceUsdc: string | null;
  /** What the next sponsor's wallet signs for: the new price, our fee, and the refund. */
  nextSponsorPaysUsdc: string | null;
  /** What the sponsor being displaced gets back, in full, in that same payment. */
  refundsUsdc: string | null;
  /** Our fee on that next takeover: the fee on the difference. Absent on an older server. */
  nextFeeUsdc?: string | null;
  /** Where bidding opened. */
  floorPriceCents: number;
  handsSoFar: number;
  handsLeft: number;
  /** "too_many_takeovers" | "price_ceiling", or null while it can still be taken. */
  closed: string | null;
}

/**
 * A spot's square on the creator's own photo, in FRACTIONS (0 to 1) of the
 * photo, the way a catalog zone is a fraction of its view.
 */
export interface PhotoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The creator's own photo of the product. On a public page it is only ever
 * present when every position has its square (`getPublicSpace` drops it
 * otherwise), and then it is drawn instead of the catalog drawing.
 */
export interface SpacePhoto {
  url: string;
  /** Natural size in pixels, read by the server from the image itself. */
  width: number;
  height: number;
}

export interface Position {
  id: string;
  zoneKey: string;
  /** This spot's square on `Space.photo`, or null. Only drawn when the space has a photo. */
  rect?: PhotoRect | null;
  /** The tier's name when this position sells one, else the zone's label or the slot number. */
  label: string;
  /**
   * Tiers (ad-space-tiers-v0.md). A service space can sell a LADDER: up to six
   * rungs, each its own price and its own list of what the brand gets, and a
   * rung with five available is five positions sharing a `tierKey`.
   *
   * `tierKey` is null on the old shapes — a placement's zones, or N identical
   * slots — and those render exactly as they always have. `title` is the
   * rung's name ("Flagship on-site interview"); `label` already falls back to
   * it, so anything that prints a label prints the tier's name for free.
   *
   * `perks` is what the brand gets for that price, up to five short lines.
   * PLAIN TEXT, and printed as text: never as HTML, never as markdown.
   *
   * All three are optional because a server older than tiers sends no key at
   * all; `getPublicSpace` fills them, so nothing downstream has to guess.
   */
  tierKey?: string | null;
  title?: string | null;
  perks?: string[];
  /**
   * How THIS rung sells, when it does not sell the way its space does: the $50
   * logo to whoever pays first, the one interview to the highest bid, on the
   * same board. Null means the space's own mode, which is every space that
   * exists today, and `takeover` is never a rung's to choose — it is a rule
   * about what one sponsor may do to another and it belongs to the space.
   *
   * It wins over everything else the page could read, `offers.mode` included:
   * a rung that sells at its price carries no offers block at all, and without
   * this the page would fall back to the space and offer a "Make an offer"
   * button on a rung that does not take one.
   *
   * Optional, and `getPublicSpace` fills it: a server older than per-rung modes
   * sends no key, and anything it does not recognise reads as null.
   */
  saleMode?: SaleMode | null;
  /** Null in `offers` mode, where no price is shown. In `bids` it is the opening bid. */
  priceCents: number | null;
  sponsorPaysUsdc: string | null;
  creatorReceivesUsdc: string | null;
  pitch: string | null;
  accepts: ContentKind[];
  status: PositionStatus;
  /** Null on a fixed-price space, where a spot is sold once and stays sold. */
  takeover: Takeover | null;
  sponsor: Sponsor | null;
  /** Only for the creator, or the sponsor reading with their checkout key. */
  content?: { status: "pending" | "approved" | "rejected"; rejectedReason: string | null } | null;
  delivered: { url: string; at: string } | null;
  /**
   * How offers and bids stand on this spot, or null when the space takes none.
   * Null on a service slot of an UNTIERED space, which carries it once as
   * `Space.spaceOffers` because its slots are identical and any one will do.
   * On a tiered space the rungs are not identical — "$900" means nothing
   * unless it says $900 for the interview — so each position carries its own,
   * exactly as a placement's zones do. Optional because a server older than
   * offers sends no key.
   */
  offers?: PositionOffers | null;
}

/* ── Offers and bids (hispace-offers-v0.md) ───────────────────────────── */

export type OfferMode = "fixed_with_offers" | "offers" | "bids";

/**
 * How one spot sells, as the server names it (`saleModeOf`). It is `OfferMode`
 * plus the one mode that takes no offer at all, which the page carries as a
 * null `OfferMode`: on a `fixed` rung there is nothing to offer, only a price.
 */
export type SaleMode = OfferMode | "fixed";

/**
 * The public side of offers on a spot (or on a service space). Every amount is
 * the creator's side, before our fee, unless its name says `SponsorPays`.
 */
export interface PositionOffers {
  mode: OfferMode;
  /** Offers modes: open threads (pending, countered, accepted). */
  openCount: number | null;
  /** Bids only. */
  bidCount: number | null;
  /** Bids only: the highest BACKED bid, creator amount. */
  highestBidUsdc: string | null;
  highestBidSponsorPaysUsdc: string | null;
  /** Bids only: the display name of whoever leads. */
  leaderName: string | null;
  /** Bids only; null when there is no reserve. */
  reserveMet: boolean | null;
  openingBidUsdc: string | null;
  /** Bids only: the least the next bid can be, creator amount. */
  nextMinimumBidUsdc: string | null;
  /** Bids only: this spot's end, extensions included. */
  biddingEndsAt: string | null;
  biddingOpen: boolean | null;
  /** While an accepted offer waits for its payment. */
  reservedUntil: string | null;
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

export interface OfferRound {
  by: "sponsor" | "creator" | "auto";
  amountUsdc: string;
  at: string;
}

/** One offer or bid, as its sponsor sees it through the manage link. */
export interface OfferView {
  id: string;
  spaceId: string;
  /** Null on a service space until an acceptance assigns a slot. */
  positionId: string | null;
  positionLabel: string | null;
  kind: OfferKind;
  status: OfferStatus;
  /** The sponsor's latest amount, creator side, before fee. */
  amountUsdc: string;
  sponsorPaysUsdc: string;
  /** The creator's latest counter, while countered. */
  counterUsdc: string | null;
  counterSponsorPaysUsdc: string | null;
  /** Once accepted. */
  agreedUsdc: string | null;
  agreedSponsorPaysUsdc: string | null;
  rounds: OfferRound[];
  countersLeft: number;
  sponsor: {
    name: string;
    contactKind: ContactKind | null;
    contactValue: string | null;
    message: string | null;
    via: "app" | "web";
    backed: null | { chain: Chain; address: string; checkedAt: string };
  };
  declineReason: "too_low" | "not_a_fit" | "other" | null;
  /** When the current wait ends: the creator's answer, the sponsor's, or the payment. */
  expiresAt: string | null;
  orderId: string | null;
  /** Bids only: this is the highest backed bid now. */
  leading: boolean | null;
  createdAt: string;
  updatedAt: string;
  /** The space's `sponsorPointsShareBps`, when the server joins it in. */
  sponsorPointsShareBps?: number;
  /** The space's title and web path ("/s/<handle>/<slug>"), when the server joins them in. */
  spaceTitle?: string | null;
  spacePath?: string | null;
}

/** `GET /public/offers/:token`, and what `respond` answers. */
export interface OfferThread {
  offer: OfferView;
  space: {
    id: string;
    /** "/s/<handle>/<slug>". */
    path: string | null;
    title: string;
    templateName: string | null;
    pricingMode: PricingMode;
    status: SpaceStatus;
    closesAt: string;
    creator: { xHandle: string | null; xName: string | null; xAvatarUrl: string | null };
    event: EventSummary | null;
  };
  position: Position | null;
}

export interface OfferProof {
  chain: Chain;
  address: string;
  nonce: string;
  signature: string;
}

export interface Update {
  id: string;
  body: string | null;
  imageUrl: string | null;
  positionId: string | null;
  createdAt: string;
}

/**
 * `mention`: the creator mentions or tags the brand on `platform`. `custom`:
 * whatever the creator wrote in `note`. The rest are the original catalogue.
 * Kept open as a string so a kind this page does not know still renders.
 */
export type DeliverableKind =
  | "in_person"
  | "photo_post"
  | "video"
  | "story"
  | "thank_you_post"
  | "mention"
  | "custom";

export interface Deliverable {
  id: string;
  kind: DeliverableKind | (string & {});
  /** Null on a `custom` deliverable that happens nowhere in particular. */
  platform: string | null;
  /** The creator's own words; the whole promise on a `custom` one. `getPublicSpace` fills null. */
  note: string | null;
  count: number;
  dueDate: string;
  deliveredUrl: string | null;
  state: DeliverableState;
}

export interface Space {
  id: string;
  slug: string;
  title: string;
  /**
   * Content production: what a spot includes, the turnaround and the usage
   * rights. Null on every other template; absent on an older server.
   */
  production?: ProductionPackageView | null;
  reason: string | null;
  status: SpaceStatus;
  kind: "placement" | "service";
  closesAt: string;
  keyDates: { label: string; date: string }[];
  deliverBy: string | null;
  publishedAt: string | null;
  chains: Chain[];
  payTo: { solana: string | null; evm: string | null } | null;
  /**
   * The chains a sponsor can pay on right now: `chains` narrowed to where the
   * creator has an address and the server can take a payment. Absent on an
   * older server; the page then narrows `chains` by `payTo` itself.
   */
  payableChains?: Chain[];
  creator: Creator;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  /**
   * The share of our fee a sponsor paying from the HOLD app earns back in
   * HiPoints (spaces-sponsor-points-v0.md), 1000 today. Absent on a server
   * older than sponsor points: the page then promises nothing.
   */
  sponsorPointsShareBps?: number;
  pricingMode: PricingMode;
  /** How much a takeover multiplies the last price by; null on a fixed-price space. */
  takeoverMultiple: number | null;
  /**
   * A `fixed` space that also takes offers below its price. `getPublicSpace`
   * fills false when a server older than offers leaves it out.
   */
  acceptsOffers: boolean;
  /**
   * When bidding ends, space-wide. Each spot's own end is on its `offers`, and
   * that is the one the page counts down, because a late bid moves a spot's
   * end and never the others'.
   *
   * Usually `bids` only — but a tiered space may sell at a fixed price and
   * still carry one, because on a ladder the countdown can belong to a single
   * rung (the interview) rather than to the board.
   */
  biddingEndsAt: string | null;
  /**
   * An untiered service space's offers, which target the space rather than a
   * slot. Null on a tiered one, where every rung carries its own.
   */
  spaceOffers: PositionOffers | null;
  venueType: VenueType;
  eventName: string | null;
  fallback: Fallback;
  fallbackNote: string | null;
  attestations: string[];
  requiredAttestations: string[];
  deliverables: Deliverable[];
  template: Template;
  /**
   * What the creator calls their service, and how they describe it. Set on a
   * `custom-service` space, where they replace the template's name and summary;
   * null otherwise. `getPublicSpace` fills null on an older server.
   */
  serviceName: string | null;
  serviceSummary: string | null;
  positions: Position[];
  /**
   * What the campaign is raising, in integer cents, or null when the creator
   * named no goal. A space that has one is measured against it — money, not
   * spots — because what a campaign is FOR is an amount and not an inventory.
   * `getPublicSpace` fills null, so a server older than the goal reads as a
   * space that never named one and the page stays exactly as it was.
   */
  fundingGoalCents: number | null;
  /**
   * `committedCents`: paid so far (on `offers` and `bids`, the agreed amounts of
   * paid orders). `totalCents`: every listed price added up, null on `offers`
   * and `bids`, which have no total to be "of".
   */
  totals: { positions: number; sold: number; committedCents: number; totalCents: number | null };
  updates: Update[];
  share: { url: string; text: string };
  /**
   * The creator's own invite link, for the other audience this page has: the
   * creator who reads it and wants one. Null on a draft, and null on an older
   * account that has no code yet, so every reader of this field must render
   * nothing rather than invent a link.
   */
  creatorInvite: { code: string; url: string } | null;
  /**
   * The event this space is for, or null. `eventName` above stays and is
   * written from the event's name, so older share texts keep reading right.
   *
   * The four fields below are from ad-space-events-v0.md. A backend that
   * predates them sends none of them; `getPublicSpace` fills the defaults so no
   * reader has to guess.
   */
  event: EventSummary | null;
  /** The creator's own banner image, or null. */
  bannerUrl: string | null;
  bannerGradient: BannerGradient;
  /**
   * The creator's own photo of the product, with every position's `rect` on
   * it; null draws the catalog template as before.
   */
  photo?: SpacePhoto | null;
  /** The same creator's other live or closed spaces for the same event. */
  siblings: SpaceSibling[];
  /**
   * "What you get" in the creator's words and order: their own `text` lines
   * and our `reach` / `spot` suggestions, worded here from live figures. Null
   * or absent: never edited, the page shows the suggestions.
   */
  brandGets?: BrandGetsLine[] | null;
  /**
   * The product in the creator's colours: `body` fills the drawing, `accent`
   * its handle, wheels and trim. Null draws the outline alone.
   */
  productLook?: { body: string; accent: string } | null;
  /**
   * A real photo per side of the product, keyed by view, each side's spots
   * `rect`s on its own photo. Only sides whose every spot has its square; a
   * side not here keeps the drawing. Never together with `photo`.
   */
  viewPhotos?: Record<string, SpacePhoto>;
  /**
   * The ground this page stands on: the listing's own, else the creator's
   * default; hold | app | night | white | #RRGGBB. Null or absent: HOLD blue.
   */
  pageGround?: string | null;
}

export type BrandGetsLine = { kind: "reach" } | { kind: "spot" } | { kind: "text"; text: string };

/* ── Events (ad-space-events-v0.md) ───────────────────────────────────── */

/** The only values `bannerGradient` accepts. Colours live in `./look`. */
export type BannerGradient = "steel" | "ember" | "night" | "slate" | "sea";

export type EventCategory =
  | "crypto"
  | "fintech"
  | "ai"
  | "tech"
  | "robotics"
  | "science"
  | "motorsport"
  | "sports"
  | "travel"
  | "culture"
  | "other";

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  city: string;
  /** ISO 3166-1 alpha-2, or null. */
  country: string | null;
  /** Calendar dates, "2026-11-12". No time zone: the day it is in that city. */
  startsOn: string;
  endsOn: string;
  /**
   * The event's IANA zone ("Asia/Singapore"), or null when nobody knows it.
   * Only for showing times; every instant stays UTC. Optional because a server
   * older than hispace-in-the-room-v0.md sends no key at all.
   */
  timeZone?: string | null;
  category: EventCategory;
  /** The event's cover, else the city photo, else null (the client draws `steel`). */
  coverUrl: string | null;
  coverCredit: string | null;
  /** Live and closed spaces. Never shown on the banner. */
  spaceCount: number;
}

/** Placement templates are `ground`, content services `feed`, sessions `room`. */
export type SpaceTab = "ground" | "feed" | "room";

export interface SpaceSibling {
  path: string;
  tab: SpaceTab;
  title: string;
}

/**
 * The creator on an event page's card. Unlike a space's own page, the backend
 * sends these straight from the last X sync, so a name, a follower count or a
 * verification kind may be null, and `xVerifiedType` may be a kind this page
 * has no tick for.
 */
export interface CardCreator {
  xHandle: string | null;
  xName: string | null;
  xAvatarUrl: string | null;
  xVerifiedType: string | null;
  xFollowers: number | null;
  trackRecord: TrackRecord;
}

/** One card on an event page. */
export interface SpaceCard {
  spaceId: string;
  path: string;
  title: string;
  tab: SpaceTab;
  /** Null when the space's template is gone from the catalogue. */
  templateName: string | null;
  /** The creator's own name for a custom service; wins over `templateName`. Missing on an older server. */
  serviceName?: string | null;
  serviceSummary?: string | null;
  pricingMode: PricingMode;
  /**
   * Board and event cards carry these (hispace-offers-v0.md, Backend
   * implementation) so the event page can say how a space sells: "Accepts
   * offers", "Make an offer", "Bidding · 2d left" from `biddingEndsAt`. Missing
   * (an older server) reads as a space that takes no offers and has no end.
   */
  acceptsOffers?: boolean;
  biddingEndsAt?: string | null;
  status: "live" | "closed";
  closesAt: string;
  /** The creator's X profile as last synced; any of it can be missing. */
  creator: CardCreator;
  bannerUrl: string | null;
  bannerGradient: BannerGradient;
  /**
   * `open` counts what a sponsor can still get: on a takeover board that
   * includes a sold spot whose ladder has not stopped, as on the page's hero.
   */
  totals: { positions: number; open: number; sold: number };
  /** The lowest price a sponsor can pay right now, or null when nothing can be bought. */
  fromPriceCents: number | null;
}

export interface EventPage {
  event: EventSummary;
  tabs: Record<SpaceTab, SpaceCard[]>;
  /** The tab to open on without `?tab=`: the API's, else computed the same way here. */
  defaultTab: SpaceTab;
}

/* ── A creator's hub (/s/<handle>) ────────────────────────────────────── */

/**
 * The creator at the top of their own hub. The same thin shape the cards carry
 * — the backend sends it from the last X sync, so a name, a follower count or a
 * verification kind may be null — except for the handle, which is the address
 * the page was reached by and therefore always there.
 */
export interface CreatorProfile extends CardCreator {
  xHandle: string;
  /** The ground the creator chose for their pages: hold | app | night | white | #RRGGBB. Null or absent: HOLD blue. */
  pageGround?: string | null;
}

/**
 * One section of a hub: an event, and everything this creator sells for it.
 *
 * `othersAtEvent` is the number behind the way OUT of this page — other
 * creators with something listed at the same event, this one excluded. It is
 * the whole reason a hub is worth sharing: a brand the creator does not win
 * still finds the event, and the event finds them a creator.
 */
export interface CreatorGroup {
  /** Null on exactly one group, always the last: what they sell for no event. */
  event: EventSummary | null;
  othersAtEvent: number;
  cards: SpaceCard[];
}

/**
 * `GET /public/creators/:handle`.
 *
 * The groups arrive ordered — upcoming events by start date, then past ones,
 * then the group tied to no event — and the cards inside them are ordered too.
 * That order is the server's and the page never touches it: two pages sorting
 * the same list by different rules is how the same creator ends up looking
 * like two different creators.
 */
export interface CreatorPage {
  creator: CreatorProfile;
  groups: CreatorGroup[];
  /** Across every group: spaces listed, spots a sponsor can still take, events. */
  totals: { spaces: number; openSpots: number; events: number };
}

/**
 * `quoted`: a Base/Polygon checkout that was handed out and not signed yet. It
 * holds nothing; the position is held only once the signatures arrive.
 */
export type OrderStatus =
  | "quoted"
  | "awaiting_payment"
  | "paid"
  | "paid_duplicate"
  | "expired"
  | "cancelled"
  /** Was paid and held the spot, until somebody doubled the price and repaid it. */
  | "outbid";

export interface Order {
  id: string;
  positionId: string;
  spaceId: string;
  status: OrderStatus;
  chain: Chain;
  /** What the spot costs. On a takeover, the doubled price. */
  priceUsdc: string;
  /**
   * What reaches the creator FROM THIS ORDER. On a takeover that is the
   * DIFFERENCE between the new price and the old one, not the price — at a
   * multiple of two it equals what the spot last sold for, so it must never be
   * put on screen without a label saying which of the two it is.
   */
  creatorReceivesUsdc: string;
  feeUsdc: string;
  /** Every leg together: what the wallet signs for. */
  sponsorPaysUsdc: string;
  /** Set only on a takeover: the sponsor displaced, repaid in full. */
  takeover: { replacesOrderId: string; refundsUsdc: string; refundAddress: string | null } | null;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  creatorAddress: string;
  feeAddress: string;
  sponsorAddress: string | null;
  reservedUntil: string;
  txSignature: string | null;
  paidAt: string | null;
  explorerUrl: string | null;
  share: { url: string; text: string } | null;
  /**
   * Set only on a session order (hispace-in-the-room-v0.md), and only for its
   * buyer and its creator. Never on a public page.
   */
  session?: SessionView | null;
  /**
   * Set only on a paid content production order, and only for the brand that
   * paid: its brief, the due time, the private delivery and its acceptance.
   */
  production?: ProductionSpotView | null;
  /**
   * The buyer's manage link, `https://hihodl.xyz/b/<token>`, on a PAID session
   * order read with this browser's checkout key.
   *
   * ASSUMPTION (not named in the contract): the order carries it as
   * `manageUrl`. The server keeps only the token's hash, so the page also keeps
   * the first copy it sees in localStorage, keyed by order.
   */
  manageUrl?: string | null;
}

/**
 * `GET /public/productions/:token`: the brand's delivery page. Accept and
 * revision answer the same object.
 */
export interface BrandProduction {
  orderId: string;
  space: { id: string; title: string; slug: string; eventName: string | null };
  creatorHandle: string | null;
  positionLabel: string | null;
  chain: Chain;
  paidAt: string | null;
  production: ProductionSpotView;
}

/** The brand's brief, as the checkout sends it. */
export interface BriefBody {
  goal: "awareness" | "product_launch" | "hiring" | "community";
  keyMessages: string[];
  interviewees?: string | null;
  assetsUrl?: string | null;
  dos?: string | null;
  donts?: string | null;
  shootContact: { kind: "x" | "telegram"; value: string };
}

/* ── Sessions: time in person at an event ─────────────────────────────── */

export type ContactKind = "x" | "telegram" | "email";

export type SessionState =
  | "awaiting_contact"
  | "awaiting_schedule"
  | "scheduled"
  | "awaiting_confirmation"
  | "delivered"
  | "disputed";

/** What only a session's buyer and its creator see. */
export interface SessionView {
  contact: { kind: ContactKind; value: string } | null;
  brief: string | null;
  sessionAt: string | null;
  sessionPlace: string | null;
  /**
   * The event's dates and zone as they were when the session was sold, so the
   * page shows the time in the event's own clock. Optional: an older server
   * sends none, and the page then shows the reader's clock.
   */
  event?: { startsOn: string; endsOn: string; timeZone: string | null } | null;
  state: SessionState;
  /** Until when the buyer can answer (or turn a dispute into delivered). */
  confirmBy: string | null;
  disputeNote: string | null;
  creatorReply: string | null;
}

/**
 * `GET /public/bookings/:token`.
 *
 * The shape is the contract's (hispace-in-the-room-v0.md, backend section).
 * `PUT contact` and `POST confirm` answer the same object. The labels and the
 * creator's handle can be null, so the page names "the creator" instead.
 */
export interface Booking {
  order: Order & { session: SessionView };
  /** The slot's label, "Session 3". Null when the server can't name it. */
  positionLabel: string | null;
  space: {
    id: string;
    /** "/s/<handle>/<slug>", or null when the creator has no X handle on file. */
    path: string | null;
    title: string;
    templateName: string | null;
    status: SpaceStatus;
    creator: { xHandle: string | null; xName: string | null; xAvatarUrl: string | null };
    event: EventSummary | null;
    fallback: Fallback;
    fallbackNote: string | null;
  };
}

export interface EvmAuthorization {
  role: "creator" | "fee";
  label: string;
  message: Record<string, string>;
}

export interface EvmPayload {
  chainId: number;
  token: string;
  domain: Record<string, string | number>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  authorizations: EvmAuthorization[];
  validBefore: number;
}

export type ConfirmOutcome = "paid" | "duplicate" | "pending" | "unpaid";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
