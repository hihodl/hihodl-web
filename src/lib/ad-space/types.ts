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

export interface Creator {
  xUserId: string;
  xHandle: string;
  xName: string;
  xAvatarUrl: string | null;
  xVerifiedType: VerifiedType;
  xIdentityVerified: boolean;
  xFollowers: number;
  xAccountCreatedAt: string | null;
  trackRecord: { delivered: number; missed: number };
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
  service: { deliverableKind: string; summary: string; maxSlots: number } | null;
}

export interface Sponsor {
  name: string;
  url: string | null;
  xHandle: string | null;
  contentKind: ContentKind;
  contentText: string | null;
  imageUrl: string | null;
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
}

export type OrderStatus = "awaiting_payment" | "paid" | "paid_duplicate" | "expired" | "cancelled";

export interface Order {
  id: string;
  positionId: string;
  spaceId: string;
  status: OrderStatus;
  chain: Chain;
  creatorReceivesUsdc: string;
  feeUsdc: string;
  sponsorPaysUsdc: string;
  feeBps: number;
  feePayer: "sponsor" | "creator";
  creatorAddress: string;
  sponsorAddress: string | null;
  reservedUntil: string;
  txSignature: string | null;
  paidAt: string | null;
  explorerUrl: string | null;
  share: { url: string; text: string } | null;
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
