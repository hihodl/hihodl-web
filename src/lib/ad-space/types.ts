/**
 * Ad Space, as the public API returns it.
 *
 * Mirrors documentation/ad-space-api-v0.md field for field. Anything the page
 * shows comes from here; nothing is invented on the web side. Amounts are the
 * server's strings (USDC) or integer cents, and the page formats them without
 * doing arithmetic on them.
 */

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
 */
export type PricingMode = "fixed" | "takeover";

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
  } | null;
}

export type ServiceFormat = "content" | "session";

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
  /** Where bidding opened. */
  floorPriceCents: number;
  handsSoFar: number;
  handsLeft: number;
  /** "too_many_takeovers" | "price_ceiling", or null while it can still be taken. */
  closed: string | null;
}

export interface Position {
  id: string;
  zoneKey: string;
  label: string;
  priceCents: number;
  sponsorPaysUsdc: string;
  creatorReceivesUsdc: string;
  pitch: string | null;
  accepts: ContentKind[];
  status: PositionStatus;
  /** Null on a fixed-price space, where a spot is sold once and stays sold. */
  takeover: Takeover | null;
  sponsor: Sponsor | null;
  /** Only for the creator, or the sponsor reading with their checkout key. */
  content?: { status: "pending" | "approved" | "rejected"; rejectedReason: string | null } | null;
  delivered: { url: string; at: string } | null;
}

export interface Update {
  id: string;
  body: string | null;
  imageUrl: string | null;
  positionId: string | null;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  kind: string;
  platform: string;
  count: number;
  dueDate: string;
  deliveredUrl: string | null;
  state: DeliverableState;
}

export interface Space {
  id: string;
  slug: string;
  title: string;
  reason: string | null;
  status: SpaceStatus;
  kind: "placement" | "service";
  closesAt: string;
  keyDates: { label: string; date: string }[];
  deliverBy: string | null;
  publishedAt: string | null;
  chains: Chain[];
  payTo: { solana: string | null; evm: string | null } | null;
  creator: Creator;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  pricingMode: PricingMode;
  /** How much a takeover multiplies the last price by; null on a fixed-price space. */
  takeoverMultiple: number | null;
  venueType: VenueType;
  eventName: string | null;
  fallback: Fallback;
  fallbackNote: string | null;
  attestations: string[];
  requiredAttestations: string[];
  deliverables: Deliverable[];
  template: Template;
  positions: Position[];
  totals: { positions: number; sold: number; committedCents: number; totalCents: number };
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
  /** The same creator's other live or closed spaces for the same event. */
  siblings: SpaceSibling[];
}

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
  pricingMode: PricingMode;
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
   * The buyer's manage link, `https://hihodl.xyz/b/<token>`, on a PAID session
   * order read with this browser's checkout key.
   *
   * ASSUMPTION (not named in the contract): the order carries it as
   * `manageUrl`. The server keeps only the token's hash, so the page also keeps
   * the first copy it sees in localStorage, keyed by order.
   */
  manageUrl?: string | null;
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
