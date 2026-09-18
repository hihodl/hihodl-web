/**
 * The in-memory backend behind the console's local DEMO MODE (see ./demo).
 *
 * Server only, development only: imported by `/api/creator-demo/[...path]`
 * and, for the invite preview, by `/creator/team` — both behind
 * `creatorDemoEnabled()`, both with a dynamic import, so a build with the
 * flag off never loads it.
 *
 * WHAT IT IS
 *
 * One module-level store (on `globalThis`, so the route handler and the server
 * component share it across Next's bundles), seeded with a mid-life account
 * and changed by every write: create a draft, publish it, take it to three
 * events, answer an offer, invite somebody, give them a share, mark them paid,
 * and the next read says so. It resets when the dev server restarts, or on
 * `POST demo/reset`.
 *
 * WHAT IT IS NOT
 *
 * The backend. It mirrors the shapes the web parses (`lib/creator/listing.ts`,
 * `team.ts`, `types.ts`) and the refusals the console turns into words
 * (`problems.ts`), with a subset of the rules — enough that the screens meet
 * their real states, never a statement about what the server enforces.
 * The contract is documentation/ad-space-api-v0.md.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { fixtureEvents, fixtureSpace } from "@/lib/ad-space/fixture.dev";
import type { Chain } from "@/lib/ad-space/types";

import { DEMO_INVITE_CODE, DEMO_PEOPLE, DEMO_SEAT_CODE, DEMO_WALLETS, isDemoRole, type DemoRole } from "./demo";
import type {
  DeliverableView,
  EventSummary,
  OfferView,
  OffersBlock,
  PositionView,
  SalesSummary,
  SaleMode,
  SpaceCard,
  SpaceView,
  Template,
} from "./listing";
import type { Assignment, Earning, InvitePreview, TeamMember, TeamRole, WorkListing } from "./team";
import type { PayoutAddressView, XAccountStatus } from "./types";

/* ── Records ──────────────────────────────────────────────────────── */

const HOUR = 3_600_000;
const DAY = 86_400_000;
const FEE_BPS = 500;

type UserId = string;

interface Account {
  userId: UserId;
  x: XAccountStatus;
  payout: { solana: string | null; evm: string | null };
  challenges: Map<string, { chain: "solana" | "evm"; address: string }>;
}

interface PosRec {
  id: string;
  zoneKey: string;
  label: string;
  tierKey: string | null;
  saleMode: SaleMode | null;
  title: string | null;
  perks: string[];
  priceCents: number | null;
  minOfferCents: number | null;
  pitch: string | null;
  accepts: ("logo" | "qr" | "text" | "photo")[];
  status: "open" | "held" | "sold";
  biddingEndsAt: string | null;
  reservedUntil: string | null;
  sponsor: PositionView["sponsor"];
  content: PositionView["content"];
  delivered: PositionView["delivered"];
  qr: PositionView["qr"];
}

interface DeliverableRec {
  id: string;
  kind: string;
  platform: string | null;
  count: number;
  dueDate: string;
  note: string | null;
  deliveredUrl: string | null;
  deliveredAt: string | null;
}

interface SpaceRec {
  /** The creator's own picture (POST /spaces/:id/banner). */
  bannerUrl?: string | null;
  id: string;
  ownerId: UserId;
  templateId: string;
  slug: string;
  title: string;
  reason: string | null;
  fundingGoalCents: number | null;
  status: SpaceView["status"];
  serviceName: string | null;
  serviceSummary: string | null;
  closesAt: string;
  keyDates: { label: string; date: string }[];
  deliverBy: string | null;
  publishedAt: string | null;
  chains: Chain[];
  feePayer: "sponsor" | "creator";
  pricingMode: SpaceView["pricingMode"];
  acceptsOffers: boolean;
  biddingEndsAt: string | null;
  venueType: string;
  eventId: string | null;
  eventName: string | null;
  fallback: string;
  fallbackNote: string | null;
  attestations: string[];
  deliverables: DeliverableRec[];
  positions: PosRec[];
  minOfferCents: number | null;
  updates: SpaceView["updates"];
  seriesId: string | null;
  createdAt: string;
}

interface OfferRec {
  id: string;
  spaceId: string;
  positionId: string | null;
  kind: "offer" | "bid";
  status: OfferView["status"];
  amountCents: number;
  counterCents: number | null;
  agreedCents: number | null;
  rounds: { by: string; amountCents: number; at: string }[];
  countersUsed: number;
  sponsor: OfferView["sponsor"];
  declineReason: string | null;
  expiresAt: string | null;
  leading: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderRec {
  id: string;
  spaceId: string;
  positionId: string;
  chain: string;
  priceCents: number;
  paidAt: string;
}

interface MemberRec {
  id: string;
  ownerId: UserId;
  role: TeamRole;
  label: string;
  status: "invited" | "active" | "removed";
  memberUserId: UserId | null;
  invitedAt: string;
  acceptedAt: string | null;
  inviteExpiresAt: string | null;
  code: string | null;
}

interface AssignmentRec {
  id: string;
  spaceId: string;
  memberId: string;
  shareBps: number;
  note: string | null;
}

interface EarningRec {
  id: string;
  orderId: string;
  spaceId: string;
  memberId: string;
  amountBase: bigint;
  shareBps: number;
  chain: string;
  status: "owed" | "paid" | "void";
  paidTx: string | null;
  paidAt: string | null;
  paidNote: string | null;
  createdAt: string;
}

/** A refusal armed from the demo badge: the next call that matches answers it. */
export interface ArmedError {
  code: string;
  status: number;
  /** A regular expression "<METHOD> <path>" must match, e.g. "/publish$"; empty matches any call. */
  match: string;
  details?: Record<string, unknown>;
}

interface Store {
  seed: "seeded" | "empty";
  accounts: Map<UserId, Account>;
  spaces: SpaceRec[];
  offers: OfferRec[];
  orders: OrderRec[];
  members: MemberRec[];
  assignments: AssignmentRec[];
  earnings: EarningRec[];
  events: EventSummary[];
  armed: ArmedError | null;
}

export class DemoError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/* ── Small helpers ────────────────────────────────────────────────── */

const iso = (ms: number) => new Date(ms).toISOString();
const ago = (ms: number) => iso(Date.now() - ms);
const ahead = (ms: number) => iso(Date.now() + ms);
const day = (days: number) => iso(Date.now() + days * DAY).slice(0, 10);

/** Cents as the API prints USDC: two decimals at least. */
function usdc(cents: number): string {
  return (cents / 100).toFixed(2);
}

function usdcBase(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = (base % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}

function feeOf(cents: number): number {
  return Math.floor((cents * FEE_BPS) / 10_000);
}

function sponsorPays(cents: number, feePayer: "sponsor" | "creator"): number {
  return feePayer === "sponsor" ? cents + feeOf(cents) : cents;
}

function creatorGets(cents: number, feePayer: "sponsor" | "creator"): number {
  return feePayer === "creator" ? cents - feeOf(cents) : cents;
}

function uuid(): string {
  return randomUUID();
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "listing"
  );
}

const OWNER: UserId = DEMO_PEOPLE.owner.userId;
const MANAGER: UserId = DEMO_PEOPLE.manager.userId;
const REP: UserId = DEMO_PEOPLE.rep.userId;

const COIN_X = {
  handle: "coinempress",
  name: "Coin Empress",
  avatarUrl: null as string | null,
};

/* ── The catalogue ────────────────────────────────────────────────── */

const EVERYWHERE = ["travel", "conference", "sports_event", "private_event", "everyday"] as const;
const AT_AN_EVENT = ["conference", "sports_event", "travel"] as const;

function contentService(
  id: string,
  name: string,
  summary: string,
  maxSlots: number,
  deliverableKind: string,
  venues: readonly string[] = EVERYWHERE,
): Template {
  return {
    id,
    productType: "service",
    name,
    kind: "service",
    service: { summary, maxSlots, format: "content", deliverableKind },
    allowedVenues: [...venues] as Template["allowedVenues"],
    requiredAttestations: ["discloses_sponsorship"],
    zones: [],
  };
}

function sessionService(id: string, name: string, summary: string, maxSlots: number, suggestedPriceCents: number): Template {
  return {
    id,
    productType: "session",
    name,
    kind: "service",
    service: { summary, maxSlots, format: "session", suggestedPriceCents, deliverableKind: "in_person" },
    allowedVenues: [...AT_AN_EVENT] as Template["allowedVenues"],
    requiredAttestations: ["public_place", "no_investment_advice", "no_investor_intros"],
    zones: [],
  };
}

/**
 * The templates a creator picks from. The suitcase carries the public fixture's
 * own geometry (which is the backend catalogue's), so a listing built here and
 * the brand page render the same board.
 */
function catalogue(): Template[] {
  const suitcase = fixtureSpace("coinempress", "road-to-token2049")?.template;
  const suitcaseTemplate: Template = {
    id: "carry-on-suitcase",
    productType: "luggage",
    name: "Carry-on suitcase",
    kind: "placement",
    service: null,
    allowedVenues: ["travel", "conference", "everyday"],
    requiredAttestations: [],
    zones: (suitcase?.zones ?? []).map((z) => ({
      ...z,
      sizeLabel: z.sizeLabel,
      suggestedPriceCents: z.suggestedPriceCents ?? null,
    })),
  };
  // The public Template also carries `views` (the outlines); the console ignores them but the brand page draws them.
  (suitcaseTemplate as Template & { views?: unknown }).views = suitcase?.views ?? [];
  return [
    suitcaseTemplate,
    contentService(
      "short-form-video",
      "Short video",
      "A short video about your brand, up to 60 seconds, on the creator's X, TikTok, Reels or Shorts.",
      20,
      "video",
    ),
    contentService(
      "sponsored-x-post",
      "Sponsored X post",
      "A post about your brand on the creator's X, with your link or code, kept up for at least 30 days.",
      20,
      "photo_post",
    ),
    contentService(
      "event-coverage",
      "Cover an event for you",
      "The creator is at the event with a pass and covers it for your brand: floor footage, interviews and daily posts on their own channels.",
      20,
      "video",
      AT_AN_EVENT,
    ),
    contentService(
      "interview",
      "Interview",
      "The creator interviews someone from your team on camera and publishes it on their channels.",
      10,
      "video",
    ),
    sessionService(
      "booth-presence",
      "Booth appearance",
      "Two hours at your booth during the event, meeting visitors and posting from it.",
      6,
      30_000,
    ),
    sessionService(
      "moderate-panel",
      "Moderate your panel",
      "The creator moderates one of your panels: prepares the questions with you and keeps it on time.",
      5,
      40_000,
    ),
    {
      id: "custom-service",
      productType: "service",
      name: "Custom service",
      kind: "service",
      service: {
        deliverableKind: "photo_post",
        format: "content",
        summary: "Something that isn't on the list. You name it and say exactly what the brand gets.",
        maxSlots: 10,
        custom: true,
      },
      allowedVenues: [...EVERYWHERE] as Template["allowedVenues"],
      requiredAttestations: ["discloses_sponsorship", "no_investment_advice", "no_investor_intros"],
      zones: [],
    },
  ];
}

let CATALOGUE: Template[] | null = null;
function templates(): Template[] {
  CATALOGUE ??= catalogue();
  return CATALOGUE;
}
function templateOf(id: string): Template | null {
  return templates().find((t) => t.id === id) ?? null;
}

const AVAILABLE_CHAINS: Chain[] = ["solana", "base", "polygon"];

/* ── Events ───────────────────────────────────────────────────────── */

function eventsSeed(): EventSummary[] {
  // TOKEN2049 and Devcon 8 are the public fixture's own, ids and slugs
  // included, so /events/<slug> opens the page the console linked to.
  const fromFixture = fixtureEvents().map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    city: e.city,
    country: e.country,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    category: e.category as string,
    spaceCount: e.spaceCount,
  }));
  const own = (n: number, slug: string, name: string, city: string, country: string, from: number, to: number, category = "crypto") => ({
    id: `e0000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
    slug,
    name,
    city,
    country,
    startsOn: day(from),
    endsOn: day(to),
    category,
    spaceCount: 0,
  });
  return [
    ...fromFixture,
    own(1, "breakpoint-london-2026", "Breakpoint", "London", "GB", 45, 47),
    own(2, "korea-blockchain-week-2026", "Korea Blockchain Week", "Seoul", "KR", -16, -12),
    own(3, "permissionless-brooklyn-2026", "Permissionless", "Brooklyn", "US", 33, 35),
    own(4, "web-summit-lisbon-2026", "Web Summit", "Lisbon", "PT", 48, 51, "tech"),
    own(5, "solana-accelerate-nyc-2026", "Solana Accelerate", "New York", "US", 27, 28),
    own(6, "money2020-amsterdam-2026", "Money20/20", "Amsterdam", "NL", 38, 40, "fintech"),
  ];
}

function eventById(s: Store, id: string | null): EventSummary | null {
  return id ? s.events.find((e) => e.id === id) ?? null : null;
}

function eventBySlug(s: Store, slug: string): EventSummary {
  const e = s.events.find((x) => x.slug === slug);
  if (!e) throw new Error(`demo seed names an unknown event: ${slug}`);
  return e;
}

/* ── Seeding ──────────────────────────────────────────────────────── */

function notLinked(): XAccountStatus {
  return { linked: false, canPublish: false, refusal: "x_not_linked", configured: true };
}

function coinX(): XAccountStatus {
  return {
    linked: true,
    handle: COIN_X.handle,
    name: COIN_X.name,
    avatarUrl: COIN_X.avatarUrl,
    verifiedType: "blue",
    identityVerified: false,
    followers: 48_210,
    accountCreatedAt: "2019-03-11T00:00:00.000Z",
    linkedAt: ago(40 * DAY),
    canPublish: true,
    refusal: null,
    configured: true,
  };
}

function account(userId: UserId, over: Partial<Account> = {}): Account {
  return { userId, x: notLinked(), payout: { solana: null, evm: null }, challenges: new Map(), ...over };
}

function pos(over: Partial<PosRec> & Pick<PosRec, "zoneKey" | "label">): PosRec {
  return {
    id: uuid(),
    tierKey: null,
    saleMode: null,
    title: null,
    perks: [],
    priceCents: null,
    minOfferCents: null,
    pitch: null,
    accepts: ["logo", "qr", "text"],
    status: "open",
    biddingEndsAt: null,
    reservedUntil: null,
    sponsor: null,
    content: null,
    delivered: null,
    qr: null,
    ...over,
  };
}

function logo(text: string, bg: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="10" fill="${bg}"/><text x="100" y="52" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${fg}">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function sponsorOf(name: string, kind: "logo" | "text" | "qr" = "logo"): NonNullable<PosRec["sponsor"]> {
  const handle = name.toLowerCase().replace(/\W/g, "");
  return {
    name,
    url: `https://${handle}.xyz`,
    xHandle: handle,
    contentKind: kind,
    contentText: kind === "text" ? "CODE10" : kind === "qr" ? `https://${handle}.xyz/r/coin` : null,
    imageUrl: kind === "logo" ? logo(name.toUpperCase().slice(0, 6), "#FFFFFF", "#141F2E") : null,
  };
}

function space(over: Partial<SpaceRec> & Pick<SpaceRec, "templateId" | "slug" | "title">): SpaceRec {
  return {
    id: uuid(),
    ownerId: OWNER,
    reason: null,
    fundingGoalCents: null,
    status: "draft",
    serviceName: null,
    serviceSummary: null,
    closesAt: ahead(20 * DAY),
    keyDates: [],
    deliverBy: null,
    publishedAt: null,
    chains: ["solana"],
    feePayer: "sponsor",
    pricingMode: "fixed",
    acceptsOffers: false,
    biddingEndsAt: null,
    venueType: "conference",
    eventId: null,
    eventName: null,
    fallback: "content_anyway",
    fallbackNote: null,
    attestations: [],
    deliverables: [],
    positions: [],
    minOfferCents: null,
    updates: [],
    seriesId: null,
    createdAt: ago(10 * DAY),
    ...over,
  };
}

/** Copies of one rung, the way the backend expands a tier into positions. */
function rung(
  startSlot: number,
  count: number,
  t: { key: string; title: string; priceCents: number | null; perks: string[]; saleMode?: SaleMode | null; minOfferCents?: number | null },
): PosRec[] {
  return Array.from({ length: count }, (_, i) =>
    pos({
      zoneKey: `slot-${startSlot + i}`,
      label: t.title,
      tierKey: t.key,
      title: t.title,
      perks: t.perks,
      priceCents: t.priceCents,
      saleMode: t.saleMode ?? null,
      minOfferCents: t.minOfferCents ?? null,
    }),
  );
}

function sell(s: Store, sp: SpaceRec, p: PosRec, sponsor: NonNullable<PosRec["sponsor"]>, daysAgo: number, chain = "solana"): OrderRec {
  p.status = "sold";
  p.sponsor = sponsor;
  const order: OrderRec = {
    id: uuid(),
    spaceId: sp.id,
    positionId: p.id,
    chain,
    priceCents: p.priceCents ?? 0,
    paidAt: ago(daysAgo * DAY),
  };
  s.orders.push(order);
  return order;
}

function seeded(): Store {
  const s: Store = {
    seed: "seeded",
    accounts: new Map(),
    spaces: [],
    offers: [],
    orders: [],
    members: [],
    assignments: [],
    earnings: [],
    events: eventsSeed(),
    armed: null,
  };

  s.accounts.set(
    OWNER,
    account(OWNER, { x: coinX(), payout: { solana: DEMO_WALLETS.solana, evm: null } }),
  );
  s.accounts.set(MANAGER, account(MANAGER));
  s.accounts.set(REP, account(REP));
  s.accounts.set(DEMO_PEOPLE.invitee.userId, account(DEMO_PEOPLE.invitee.userId));

  const token2049 = eventBySlug(s, "token2049-singapore-2026");
  const devcon = eventBySlug(s, "devcon-8-mumbai-2026");
  const breakpoint = eventBySlug(s, "breakpoint-london-2026");
  const kbw = eventBySlug(s, "korea-blockchain-week-2026");

  /* 1. A live FIXED-PRICE LADDER that also takes offers, at TOKEN2049 — the
        first of a series of three. */
  const seriesId = uuid();
  const videoRungs = (start: number) => [
    ...rung(start, 3, {
      key: "tier-1",
      title: "One dedicated video",
      priceCents: 50_000,
      minOfferCents: 35_000,
      perks: ["One video up to 60 seconds, your product in the first five seconds", "Your link pinned in the replies for 30 days"],
    }),
    ...rung(start + 3, 1, {
      key: "tier-2",
      title: "Video and an X thread",
      priceCents: 90_000,
      perks: ["Everything in the dedicated video", "A five-post thread on X walking through your product", "Your handle tagged in the first post"],
    }),
  ];
  const videosCommon = {
    templateId: "short-form-video",
    reason: "I post daily from the floor. Your brand in my videos, straight to 48k people who care about crypto.",
    chains: ["solana"] as Chain[],
    acceptsOffers: true,
    venueType: "conference",
    fallback: "content_anyway",
    attestations: ["discloses_sponsorship"],
    seriesId,
  };
  const videos = space({
    ...videosCommon,
    slug: "token2049-videos",
    title: "TOKEN2049 short videos",
    status: "live",
    eventId: token2049.id,
    eventName: token2049.name,
    closesAt: ahead(20 * DAY),
    deliverBy: day(30),
    publishedAt: ago(6 * DAY),
    positions: videoRungs(1),
    createdAt: ago(9 * DAY),
    updates: [{ id: uuid(), body: "First video is shot, going up tomorrow morning.", imageUrl: null, positionId: null, createdAt: ago(20 * HOUR) }],
  });
  videos.bannerUrl = "/demo/singapore.jpg";
  s.spaces.push(videos);
  const videoSold = videos.positions[0];
  sell(s, videos, videoSold, sponsorOf("Kopi Labs"), 3);
  videoSold.content = { status: "pending", rejectedReason: null, submittedAt: ago(5 * HOUR) };

  const videosDevcon = space({
    ...videosCommon,
    slug: "token2049-videos-devcon-8",
    title: "TOKEN2049 short videos",
    status: "live",
    eventId: devcon.id,
    eventName: devcon.name,
    closesAt: ahead(56 * DAY),
    deliverBy: day(66),
    publishedAt: ago(5 * DAY),
    positions: videoRungs(1),
    createdAt: ago(6 * DAY),
  });
  const videosBreakpoint = space({
    ...videosCommon,
    slug: "token2049-videos-breakpoint",
    title: "TOKEN2049 short videos",
    status: "draft",
    eventId: breakpoint.id,
    eventName: breakpoint.name,
    closesAt: ahead(44 * DAY),
    deliverBy: day(54),
    positions: videoRungs(1),
    createdAt: ago(6 * DAY),
  });
  s.spaces.push(videosDevcon, videosBreakpoint);

  /* 2. A live ladder with a BIDDING RUNG, at Breakpoint. */
  const flagshipEnds = ahead(3 * DAY + 4 * HOUR);
  const coverage = space({
    templateId: "event-coverage",
    slug: "breakpoint-london-coverage",
    title: "I'm covering Breakpoint London",
    reason:
      "Three days on the floor with a creator pass: interviews, recap footage and daily posts, all shot and edited by me.",
    status: "live",
    eventId: breakpoint.id,
    eventName: breakpoint.name,
    closesAt: ahead(44 * DAY),
    deliverBy: day(55),
    publishedAt: ago(8 * DAY),
    chains: ["solana"],
    fundingGoalCents: 200_000,
    fallback: "creator_refund",
    attestations: ["discloses_sponsorship"],
    biddingEndsAt: flagshipEnds,
    createdAt: ago(12 * DAY),
    positions: [
      ...rung(1, 6, {
        key: "mini-strip",
        title: "Logo in my mini strip",
        priceCents: 5_000,
        saleMode: "fixed",
        perks: ["Your logo in the strip that runs on every clip I post from the floor", "Your name in the caption of each daily recap"],
      }),
      ...rung(7, 3, {
        key: "card-and-mic",
        title: "Card and mic placement",
        priceCents: 20_000,
        saleMode: "fixed",
        perks: ["Everything in the mini strip", "Your card on the table in every interview I shoot", "Your logo on my mic flag, on camera all three days"],
      }),
      ...rung(10, 1, {
        key: "flagship-interview",
        title: "Flagship on-site interview, fully produced",
        priceCents: 130_000,
        saleMode: "bids",
        minOfferCents: 140_000,
        perks: [
          "Everything in the card and mic placement",
          "A 10-minute interview with your founder, shot and edited by me",
          "Posted the same evening, with your handle in the post",
        ],
      }),
    ],
  });
  coverage.positions[9].biddingEndsAt = flagshipEnds;
  s.spaces.push(coverage);
  const stripOrder = sell(s, coverage, coverage.positions[0], sponsorOf("Kopi Labs"), 7);
  coverage.positions[0].content = { status: "approved", rejectedReason: null, submittedAt: ago(6 * DAY) };
  const cardOrders = [
    sell(s, coverage, coverage.positions[6], sponsorOf("Acme"), 6),
    sell(s, coverage, coverage.positions[7], sponsorOf("Nodeline", "qr"), 5, "base"),
    sell(s, coverage, coverage.positions[8], sponsorOf("Lumen"), 2),
  ];
  for (const i of [6, 7, 8]) coverage.positions[i].content = { status: "approved", rejectedReason: null, submittedAt: ago(4 * DAY) };
  coverage.deliverables = [
    { id: uuid(), kind: "video", platform: "x", count: 3, dueDate: day(48), note: "One recap a day, all three days.", deliveredUrl: null, deliveredAt: null },
    { id: uuid(), kind: "mention", platform: "x", count: 1, dueDate: day(49), note: null, deliveredUrl: null, deliveredAt: null },
  ];

  /* 3. A draft, half built. */
  s.spaces.push(
    space({
      templateId: "interview",
      slug: "devcon-8-hallway-interviews",
      title: "Devcon 8 hallway interviews",
      reason: "Five-minute interviews with builders between talks. Your founder in one of them.",
      status: "draft",
      eventId: devcon.id,
      eventName: devcon.name,
      closesAt: ahead(55 * DAY),
      deliverBy: day(65),
      createdAt: ago(1 * DAY),
      positions: rung(1, 2, {
        key: "tier-1",
        title: "Your founder, interviewed",
        priceCents: 60_000,
        perks: ["A five-minute interview between talks", "Posted on X and YouTube Shorts"],
      }),
    }),
  );

  /* 4. A closed placement with sales, work still to finish. */
  const zones = templateOf("carry-on-suitcase")?.zones ?? [];
  const kbwSpace = space({
    templateId: "carry-on-suitcase",
    slug: "road-to-korea-blockchain-week",
    title: "Road to Korea Blockchain Week",
    reason: "My suitcase through Incheon, the venue and every vlog of the week.",
    status: "closed",
    eventId: kbw.id,
    eventName: kbw.name,
    venueType: "conference",
    closesAt: ago(17 * DAY),
    publishedAt: ago(40 * DAY),
    chains: ["solana", "base"],
    attestations: ["owns_item", "venue_rules_checked"],
    createdAt: ago(45 * DAY),
    positions: zones.map((z) =>
      pos({ zoneKey: z.zoneKey, label: z.label, priceCents: z.suggestedPriceCents ?? 10_000, accepts: ["logo", "qr", "text"] }),
    ),
    deliverables: [
      { id: uuid(), kind: "video", platform: "x", count: 1, dueDate: day(-18), note: "The packing vlog, suitcase in frame.", deliveredUrl: "https://x.com/coinempress/status/1830000000000000001", deliveredAt: ago(18 * DAY) },
      { id: uuid(), kind: "photo_post", platform: "instagram", count: 3, dueDate: day(-10), note: null, deliveredUrl: null, deliveredAt: null },
      { id: uuid(), kind: "thank_you_post", platform: "x", count: 1, dueDate: day(2), note: null, deliveredUrl: null, deliveredAt: null },
    ],
  });
  kbwSpace.bannerUrl = "/demo/suitcase-front.jpg";
  s.spaces.push(kbwSpace);
  const kbwSales = ["Orbit", "Mesa", "Stackd", "Acme", "Nodeline", "Lumen"].map((name, i) => {
    const p = kbwSpace.positions[i];
    const o = sell(s, kbwSpace, p, sponsorOf(name, i === 4 ? "text" : "logo"), 30 - i * 2, i === 2 ? "base" : "solana");
    p.content = { status: i === 5 ? "pending" : "approved", rejectedReason: null, submittedAt: ago((20 - i) * DAY) };
    if (i < 3) p.delivered = { url: `https://x.com/coinempress/status/18300000000000001${i}`, at: ago((16 - i) * DAY) };
    if (i === 0) p.qr = { code: "kbw-orbit", url: "https://hihodl.xyz/q/kbw-orbit", scans: 214 };
    return o;
  });

  /* Offers and bids — three waiting on the creator. */
  const offer = (o: Partial<OfferRec> & Pick<OfferRec, "spaceId" | "positionId" | "kind" | "amountCents">): OfferRec => ({
    id: uuid(),
    status: "pending",
    counterCents: null,
    agreedCents: null,
    rounds: [{ by: "sponsor", amountCents: o.amountCents, at: ago(5 * HOUR) }],
    countersUsed: 0,
    sponsor: { name: "A sponsor", contactKind: null, contactValue: null, message: null, via: "web", backed: null },
    declineReason: null,
    expiresAt: ahead(40 * HOUR),
    leading: null,
    createdAt: ago(5 * HOUR),
    updatedAt: ago(5 * HOUR),
    ...o,
  });
  s.offers.push(
    offer({
      spaceId: videos.id,
      positionId: videos.positions[1].id,
      kind: "offer",
      amountCents: 40_000,
      sponsor: {
        name: "Acme",
        contactKind: "email",
        contactValue: "team@acme.xyz",
        message: "We launch on day 2 and would love a video that week.",
        via: "web",
        backed: { chain: "solana", address: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT", checkedAt: ago(5 * HOUR) },
      },
    }),
    offer({
      spaceId: videos.id,
      positionId: videos.positions[3].id,
      kind: "offer",
      amountCents: 75_000,
      createdAt: ago(20 * HOUR),
      updatedAt: ago(20 * HOUR),
      expiresAt: ahead(28 * HOUR),
      sponsor: { name: "Nodeline", contactKind: "telegram", contactValue: "@nodeline_bd", message: null, via: "app", backed: null },
    }),
    offer({
      spaceId: videos.id,
      positionId: videos.positions[2].id,
      kind: "offer",
      amountCents: 25_000,
      status: "declined",
      declineReason: "too_low",
      expiresAt: null,
      createdAt: ago(3 * DAY),
      updatedAt: ago(2 * DAY),
      sponsor: { name: "Lumen", contactKind: null, contactValue: null, message: "Would you do it for 250?", via: "web", backed: null },
    }),
    offer({
      spaceId: coverage.id,
      positionId: coverage.positions[9].id,
      kind: "bid",
      amountCents: 150_000,
      leading: true,
      expiresAt: flagshipEnds,
      createdAt: ago(9 * HOUR),
      updatedAt: ago(9 * HOUR),
      sponsor: {
        name: "Orbit",
        contactKind: "email",
        contactValue: "growth@orbit.fi",
        message: "Our founder is in London all three days.",
        via: "web",
        backed: { chain: "solana", address: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T", checkedAt: ago(9 * HOUR) },
      },
    }),
    offer({
      spaceId: coverage.id,
      positionId: coverage.positions[9].id,
      kind: "bid",
      amountCents: 140_000,
      status: "superseded",
      leading: false,
      expiresAt: null,
      createdAt: ago(30 * HOUR),
      updatedAt: ago(9 * HOUR),
      sponsor: { name: "Mesa", contactKind: null, contactValue: null, message: null, via: "app", backed: { chain: "base", address: "0x1111111111111111111111111111111111111111", checkedAt: ago(30 * HOUR) } },
    }),
  );

  /* The team: a manager, a rep, and an invitation nobody has taken yet. */
  const dana: MemberRec = {
    id: uuid(),
    ownerId: OWNER,
    role: "manager",
    label: "Dana, sells for me",
    status: "active",
    memberUserId: MANAGER,
    invitedAt: ago(30 * DAY),
    acceptedAt: ago(29 * DAY),
    inviteExpiresAt: null,
    code: null,
  };
  const kai: MemberRec = {
    id: uuid(),
    ownerId: OWNER,
    role: "rep",
    label: "Kai, camera and booth",
    status: "active",
    memberUserId: REP,
    invitedAt: ago(50 * DAY),
    acceptedAt: ago(48 * DAY),
    inviteExpiresAt: null,
    code: null,
  };
  const pending: MemberRec = {
    id: uuid(),
    ownerId: OWNER,
    role: "rep",
    label: "Maria, Singapore crew",
    status: "invited",
    memberUserId: null,
    invitedAt: ago(2 * DAY),
    acceptedAt: null,
    inviteExpiresAt: ahead(12 * DAY),
    code: DEMO_SEAT_CODE,
  };
  s.members.push(dana, kai, pending);

  s.assignments.push(
    { id: uuid(), spaceId: coverage.id, memberId: dana.id, shareBps: 1_500, note: "Finds the sponsors for the interview" },
    { id: uuid(), spaceId: coverage.id, memberId: kai.id, shareBps: 1_000, note: "Runs the camera all three days" },
    { id: uuid(), spaceId: videos.id, memberId: dana.id, shareBps: 1_000, note: null },
    { id: uuid(), spaceId: kbwSpace.id, memberId: kai.id, shareBps: 500, note: "Carried the suitcase on day 2" },
  );

  // What each sale owed, as `accrueTeamShares` writes it when the chain confirms.
  const accrue = (order: OrderRec, member: MemberRec, shareBps: number, paid?: { tx: string | null; note: string | null; daysAgo: number }) => {
    const sp = s.spaces.find((x) => x.id === order.spaceId)!;
    const received = BigInt(creatorGets(order.priceCents, sp.feePayer)) * 10_000n;
    s.earnings.push({
      id: uuid(),
      orderId: order.id,
      spaceId: order.spaceId,
      memberId: member.id,
      amountBase: (received * BigInt(shareBps)) / 10_000n,
      shareBps,
      chain: order.chain,
      status: paid ? "paid" : "owed",
      paidTx: paid?.tx ?? null,
      paidAt: paid ? ago(paid.daysAgo * DAY) : null,
      paidNote: paid?.note ?? null,
      createdAt: order.paidAt,
    });
  };
  accrue(stripOrder, dana, 1_500, { tx: "5KtP9mWq…a1Zf", note: "Paid for the first week", daysAgo: 4 });
  accrue(stripOrder, kai, 1_000, { tx: null, note: "Cash in hand in London", daysAgo: 4 });
  for (const o of cardOrders) {
    accrue(o, dana, 1_500);
    accrue(o, kai, 1_000);
  }
  accrue(s.orders.find((o) => o.positionId === videoSold.id)!, dana, 1_000);
  for (const o of kbwSales) accrue(o, kai, 500);

  return s;
}

function empty(): Store {
  const s: Store = {
    seed: "empty",
    accounts: new Map(),
    spaces: [],
    offers: [],
    orders: [],
    members: [],
    assignments: [],
    earnings: [],
    events: eventsSeed(),
    armed: null,
  };
  for (const who of Object.values(DEMO_PEOPLE)) s.accounts.set(who.userId, account(who.userId));
  return s;
}

/* ── The store itself ─────────────────────────────────────────────── */

const G = globalThis as typeof globalThis & { __holdCreatorDemo?: Store };

function store(): Store {
  G.__holdCreatorDemo ??= seeded();
  return G.__holdCreatorDemo;
}

export function resetDemo(seed: "seeded" | "empty"): void {
  G.__holdCreatorDemo = seed === "empty" ? empty() : seeded();
}

export function armDemoError(armed: ArmedError | null): void {
  store().armed = armed;
}

export function demoStatus() {
  const s = store();
  return {
    seed: s.seed,
    armed: s.armed,
    seatCode: s.members.find((m) => m.status === "invited" && m.code)?.code ?? null,
    shortcuts: demoShortcuts(),
  };
}

/** Spend the armed refusal if this call matches it. */
function takeArmed(method: string, path: string): ArmedError | null {
  const s = store();
  const a = s.armed;
  if (!a) return null;
  let hit = true;
  try {
    hit = !a.match || new RegExp(a.match).test(`${method} ${path}`);
  } catch {
    hit = `${method} ${path}`.includes(a.match);
  }
  if (!hit) return null;
  s.armed = null;
  return a;
}

/* ── Views: the shapes the web parses ─────────────────────────────── */

function role(s: Store, userId: UserId, sp: SpaceRec): "owner" | TeamRole | null {
  if (sp.ownerId === userId) return "owner";
  const seat = s.members.find((m) => m.memberUserId === userId && m.ownerId === sp.ownerId && m.status === "active");
  if (!seat) return null;
  return s.assignments.some((a) => a.spaceId === sp.id && a.memberId === seat.id) ? seat.role : null;
}

/** The listing if this caller may do that to it; `not_found` otherwise, as `spaceFor` answers. */
function spaceFor(s: Store, userId: UserId, spaceId: string, power: "read" | "deliver" | "sell" | "own"): SpaceRec {
  const sp = s.spaces.find((x) => x.id === spaceId);
  if (!sp) throw new DemoError("not_found", 404);
  const r = role(s, userId, sp);
  const powers: Record<string, string[]> = {
    owner: ["read", "deliver", "sell", "own"],
    manager: ["read", "deliver", "sell"],
    rep: ["deliver"],
  };
  if (!r || !powers[r].includes(power)) throw new DemoError("not_found", 404);
  return sp;
}

function saleModeOf(sp: SpaceRec, p: PosRec | null): SaleMode {
  if (p?.saleMode) return p.saleMode;
  switch (sp.pricingMode) {
    case "offers":
      return "offers";
    case "bids":
      return "bids";
    default:
      return sp.acceptsOffers ? "fixed_with_offers" : "fixed";
  }
}

function offersBlock(
  s: Store,
  sp: SpaceRec,
  p: PosRec | null,
  creator: boolean,
  priceCents: number | null,
  minOfferCents: number | null,
): OffersBlock | null {
  const mode = saleModeOf(sp, p);
  if (mode === "fixed") return null;
  const rows = s.offers.filter(
    (o) => o.spaceId === sp.id && (p ? o.positionId === p.id : true) && o.status !== "withdrawn" && o.status !== "declined",
  );
  const bids = mode === "bids" && p !== null;
  const counted = rows.filter((o) => o.kind === "bid" && ["pending", "accepted", "paid", "superseded"].includes(o.status));
  const leader = bids
    ? [...counted].filter((o) => o.status !== "superseded").sort((a, b) => b.amountCents - a.amountCents)[0] ?? null
    : null;
  const opening = bids ? priceCents : null;
  const next = opening !== null ? Math.max(opening, leader ? Math.ceil(leader.amountCents * 1.05) : opening) : null;
  const endsAt = bids ? p?.biddingEndsAt ?? sp.biddingEndsAt : null;
  const block: OffersBlock & { highestBidSponsorPaysUsdc?: string | null } = {
    mode,
    openCount: bids ? null : rows.filter((o) => ["pending", "countered", "accepted"].includes(o.status)).length,
    bidCount: bids ? counted.length : null,
    highestBidUsdc: leader ? usdc(leader.amountCents) : null,
    highestBidSponsorPaysUsdc: leader ? usdc(sponsorPays(leader.amountCents, sp.feePayer)) : null,
    leaderName: leader ? leader.sponsor.name : null,
    reserveMet: bids ? (minOfferCents === null ? true : (leader?.amountCents ?? 0) >= minOfferCents) : null,
    openingBidUsdc: opening !== null ? usdc(opening) : null,
    nextMinimumBidUsdc: bids && next !== null ? usdc(next) : null,
    biddingEndsAt: endsAt,
    biddingOpen: bids ? p?.status === "open" && !!endsAt && Date.parse(endsAt) > Date.now() : null,
    reservedUntil: p?.reservedUntil ?? null,
  };
  if (creator) block.minOfferUsdc = minOfferCents !== null ? usdc(minOfferCents) : null;
  return block;
}

function deliverableState(d: DeliverableRec): DeliverableView["state"] {
  if (d.deliveredUrl) return "delivered";
  const due = Date.parse(`${d.dueDate}T23:59:59Z`);
  if (Date.now() <= due) return "upcoming";
  return Date.now() - due > 7 * DAY ? "missed" : "overdue";
}

function totalsOf(s: Store, sp: SpaceRec) {
  const sold = sp.positions.filter((p) => p.status === "sold");
  const committed = sold.reduce((n, p) => n + (s.orders.find((o) => o.positionId === p.id)?.priceCents ?? p.priceCents ?? 0), 0);
  const priced = sp.positions.every((p) => p.priceCents !== null);
  return {
    positions: sp.positions.length,
    sold: sold.length,
    committedCents: committed,
    totalCents: priced ? sp.positions.reduce((n, p) => n + (p.priceCents ?? 0), 0) : null,
  };
}

function shareOf(sp: SpaceRec, origin: string, totals: { positions: number; sold: number }) {
  if (sp.status === "draft") return null;
  const url = `${origin}/s/${COIN_X.handle}/${sp.slug}${totals.sold ? `?m=${totals.sold}` : ""}`;
  const text =
    totals.sold > 0
      ? `${totals.sold} of ${totals.positions} spots on ${sp.title} are taken ${url}`
      : `${sp.title}: spots open now, paid in USDC straight to me ${url}`;
  return { url, text };
}

function requiredAttestationsOf(t: Template | null, sp: SpaceRec): string[] {
  const out = new Set<string>();
  const session = t?.kind === "service" && t.service?.format === "session";
  if (session) ["public_place", "no_investment_advice", "no_investor_intros", "discloses_sponsorship"].forEach((a) => out.add(a));
  else {
    out.add(t?.kind === "service" ? "discloses_sponsorship" : "owns_item");
    if (["conference", "sports_event", "private_event"].includes(sp.venueType)) out.add("venue_rules_checked");
    if (sp.venueType === "sports_event") out.add("sports_rules_allow_logos");
    if (sp.venueType === "private_event") out.add("host_consent");
  }
  for (const a of t?.requiredAttestations ?? []) out.add(a);
  return [...out];
}

function spaceView(s: Store, sp: SpaceRec, viewer: UserId, origin: string): SpaceView {
  const creator = sp.ownerId === viewer;
  const t = templateOf(sp.templateId);
  const tiered = sp.positions.some((p) => p.tierKey !== null);
  const service = t?.kind === "service";
  const totals = totalsOf(s, sp);
  return {
    id: sp.id,
    slug: sp.slug,
    title: sp.title,
    reason: sp.reason,
    fundingGoalCents: sp.fundingGoalCents,
    status: sp.status,
    kind: t?.kind ?? "placement",
    serviceName: sp.serviceName,
    serviceSummary: sp.serviceSummary,
    closesAt: sp.closesAt,
    keyDates: sp.keyDates,
    deliverBy: sp.deliverBy,
    publishedAt: sp.publishedAt,
    chains: sp.chains,
    feePayer: sp.feePayer,
    feeBps: FEE_BPS,
    pricingMode: sp.pricingMode,
    acceptsOffers: sp.acceptsOffers,
    biddingEndsAt: sp.biddingEndsAt,
    spaceOffers:
      service && !tiered ? offersBlock(s, sp, null, creator, sp.positions[0]?.priceCents ?? null, sp.minOfferCents) : null,
    venueType: sp.venueType,
    eventName: sp.eventName,
    fallback: sp.fallback,
    fallbackNote: sp.fallbackNote,
    attestations: sp.attestations,
    requiredAttestations: requiredAttestationsOf(t, sp),
    deliverables: sp.deliverables.map((d) => ({
      id: d.id,
      kind: d.kind,
      platform: d.platform,
      count: d.count,
      dueDate: d.dueDate,
      note: d.note,
      deliveredUrl: d.deliveredUrl,
      state: deliverableState(d),
    })),
    template: t,
    positions: sp.positions.map((p) => ({
      id: p.id,
      zoneKey: p.zoneKey,
      label: p.label,
      tierKey: p.tierKey,
      saleMode: p.saleMode,
      title: p.title,
      perks: p.perks,
      priceCents: p.priceCents,
      sponsorPaysUsdc: p.priceCents !== null ? usdc(sponsorPays(p.priceCents, sp.feePayer)) : null,
      creatorReceivesUsdc: p.priceCents !== null ? usdc(creatorGets(p.priceCents, sp.feePayer)) : null,
      pitch: p.pitch,
      accepts: p.accepts,
      status: p.status,
      offers: service && !tiered ? null : offersBlock(s, sp, p, creator, p.priceCents, p.minOfferCents),
      sponsor: p.sponsor,
      content: p.content,
      delivered: p.delivered,
      qr: p.qr,
    })),
    totals,
    updates: [...sp.updates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    share: shareOf(sp, origin, totals),
    event: eventById(s, sp.eventId),
    bannerUrl: sp.bannerUrl ?? null,
    bannerGradient: "steel",
  };
}

function cardView(s: Store, sp: SpaceRec): SpaceCard {
  return {
    id: sp.id,
    slug: sp.slug,
    title: sp.title,
    templateId: sp.templateId,
    serviceName: sp.serviceName,
    status: sp.status,
    closesAt: sp.closesAt,
    publishedAt: sp.publishedAt,
    chains: sp.chains,
    pricingMode: sp.pricingMode,
    acceptsOffers: sp.acceptsOffers,
    biddingEndsAt: sp.biddingEndsAt,
    totals: totalsOf(s, sp),
    fundingGoalCents: sp.fundingGoalCents,
    awaitingReview: sp.positions.filter((p) => p.content?.status === "pending").length,
    event: eventById(s, sp.eventId),
    bannerUrl: sp.bannerUrl ?? null,
    bannerGradient: "steel",
  };
}

function offerView(s: Store, o: OfferRec): OfferView {
  const sp = s.spaces.find((x) => x.id === o.spaceId)!;
  const p = sp.positions.find((x) => x.id === o.positionId) ?? null;
  const pays = (c: number | null) => (c === null ? null : usdc(sponsorPays(c, sp.feePayer)));
  return {
    id: o.id,
    spaceId: o.spaceId,
    spaceTitle: sp.title,
    serviceName: sp.serviceName,
    spacePath: sp.status === "draft" ? null : `/s/${COIN_X.handle}/${sp.slug}`,
    positionId: o.positionId,
    positionLabel: p ? p.title ?? p.label : null,
    kind: o.kind,
    status: o.status,
    amountUsdc: usdc(o.amountCents),
    sponsorPaysUsdc: pays(o.amountCents)!,
    counterUsdc: o.counterCents !== null ? usdc(o.counterCents) : null,
    counterSponsorPaysUsdc: pays(o.counterCents),
    agreedUsdc: o.agreedCents !== null ? usdc(o.agreedCents) : null,
    agreedSponsorPaysUsdc: pays(o.agreedCents),
    rounds: o.rounds.map((r) => ({ by: r.by, amountUsdc: usdc(r.amountCents), at: r.at })),
    countersLeft: Math.max(0, 3 - o.countersUsed),
    sponsor: o.sponsor,
    declineReason: o.declineReason,
    expiresAt: o.expiresAt,
    orderId: null,
    leading: o.leading,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function memberView(m: MemberRec, fromMemberSide: boolean): TeamMember {
  const base: TeamMember = {
    id: m.id,
    role: m.role,
    label: m.label,
    status: m.status,
    memberUserId: m.memberUserId,
    invitedAt: m.invitedAt,
    acceptedAt: m.acceptedAt,
    inviteExpiresAt: m.status === "invited" ? m.inviteExpiresAt : null,
  };
  if (!fromMemberSide) return base;
  return { ...base, creatorHandle: COIN_X.handle, creatorName: COIN_X.name, creatorAvatarUrl: COIN_X.avatarUrl };
}

function earningView(s: Store, e: EarningRec): Earning {
  const sp = s.spaces.find((x) => x.id === e.spaceId);
  const m = s.members.find((x) => x.id === e.memberId);
  return {
    id: e.id,
    orderId: e.orderId,
    spaceId: e.spaceId,
    listingTitle: sp?.title ?? null,
    memberId: e.memberId,
    memberLabel: m?.label ?? null,
    creatorHandle: COIN_X.handle,
    amountUsdc: usdcBase(e.amountBase),
    shareBps: e.shareBps,
    chain: e.chain,
    status: e.status,
    paidTx: e.paidTx,
    paidAt: e.paidAt,
    paidNote: e.paidNote,
    createdAt: e.createdAt,
  };
}

function payoutView(a: Account): PayoutAddressView {
  const declared: PayoutAddressView["declared"] = [];
  if (a.payout.solana) declared.push({ chain: "solana", address: a.payout.solana });
  if (a.payout.evm) declared.push({ chain: "evm", address: a.payout.evm });
  return {
    solana: { address: a.payout.solana, source: a.payout.solana ? "declared" : null },
    evm: { address: a.payout.evm, source: a.payout.evm ? "declared" : null },
    declared,
  };
}

/* ── Building a listing from a body ───────────────────────────────── */

type Body = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function positionsFrom(body: Body, t: Template): PosRec[] | null {
  if (t.kind === "service") {
    const service = body.service as { tiers?: Body[]; slots?: number; priceCents?: number | null; minOfferCents?: number | null; pitch?: string | null } | undefined;
    if (!service) return null;
    if (Array.isArray(service.tiers)) {
      if (service.tiers.length > 6) throw new DemoError("too_many_tiers", 422, { max: 6 });
      let slot = 1;
      const out: PosRec[] = [];
      for (const tier of service.tiers) {
        const available = num(tier.available) ?? 1;
        const saleMode = (str(tier.saleMode) as SaleMode | null) ?? null;
        if (saleMode === "bids" && available > 1) throw new DemoError("bid_tier_sells_one", 422, { tierKey: tier.key });
        if (available < 1 || available > 20) throw new DemoError("tier_quantity_invalid", 422, { tierKey: tier.key });
        for (const p of rung(slot, available, {
          key: str(tier.key) ?? `tier-${slot}`,
          title: str(tier.title) ?? "",
          priceCents: num(tier.priceCents),
          minOfferCents: num(tier.minOfferCents),
          perks: Array.isArray(tier.perks) ? (tier.perks as string[]) : [],
          saleMode,
        })) {
          p.pitch = str(tier.pitch);
          out.push(p);
        }
        slot += available;
      }
      if (out.length > 40) throw new DemoError("too_many_positions", 422, { max: 40 });
      return out;
    }
    const n = num(service.slots) ?? 1;
    if (n < 1 || n > (t.service?.maxSlots ?? 20)) throw new DemoError("slots_out_of_range", 422, { max: t.service?.maxSlots ?? 20 });
    return Array.from({ length: n }, (_, i) =>
      pos({ zoneKey: `slot-${i + 1}`, label: `Slot ${i + 1}`, priceCents: service.priceCents ?? null, pitch: service.pitch ?? null }),
    );
  }
  const list = body.positions as Body[] | undefined;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  return list.map((p) => {
    const zoneKey = str(p.zoneKey) ?? "";
    const zone = t.zones.find((z) => z.zoneKey === zoneKey);
    if (!zone) throw new DemoError("unknown_zone", 422, { zoneKey });
    if (seen.has(zoneKey)) throw new DemoError("duplicate_zone", 422, { zoneKey });
    seen.add(zoneKey);
    return pos({
      zoneKey,
      label: zone.label,
      priceCents: num(p.priceCents),
      minOfferCents: num(p.minOfferCents),
      pitch: str(p.pitch),
      accepts: (Array.isArray(p.accepts) ? p.accepts : ["logo"]) as PosRec["accepts"],
    });
  });
}

function checkDates(closesAt: string | null) {
  if (!closesAt) return;
  const at = Date.parse(closesAt);
  if (!Number.isFinite(at)) throw new DemoError("validation_error", 400);
  if (at - Date.now() < 24 * HOUR) throw new DemoError("closes_too_soon", 422, { minHours: 24 });
  if (at - Date.now() > 60 * DAY) throw new DemoError("closes_too_late", 422, { maxDays: 60 });
}

function applyBody(s: Store, sp: SpaceRec, body: Body, t: Template): void {
  if ("title" in body) {
    const title = (str(body.title) ?? "").trim();
    if (title.length > 0 && (title.length < 3 || title.length > 120)) throw new DemoError("validation_error", 400);
    sp.title = title || sp.title;
  }
  if ("reason" in body) sp.reason = str(body.reason);
  if ("fundingGoalCents" in body) sp.fundingGoalCents = num(body.fundingGoalCents);
  if ("closesAt" in body) {
    const c = str(body.closesAt);
    checkDates(c);
    if (c) sp.closesAt = c;
  }
  if ("keyDates" in body && Array.isArray(body.keyDates)) sp.keyDates = body.keyDates as SpaceRec["keyDates"];
  if ("feePayer" in body) sp.feePayer = body.feePayer === "creator" ? "creator" : "sponsor";
  if ("pricingMode" in body) sp.pricingMode = (str(body.pricingMode) as SpaceRec["pricingMode"]) ?? "fixed";
  if ("acceptsOffers" in body) sp.acceptsOffers = body.acceptsOffers === true;
  if ("biddingEndsAt" in body) sp.biddingEndsAt = str(body.biddingEndsAt);
  if ("venueType" in body) sp.venueType = str(body.venueType) ?? sp.venueType;
  if ("eventId" in body || "eventName" in body) {
    const eventId = str(body.eventId);
    const event = eventById(s, eventId);
    if (eventId && !event) throw new DemoError("event_unavailable", 422);
    sp.eventId = event?.id ?? null;
    sp.eventName = event?.name ?? str(body.eventName);
  }
  if ("chains" in body && Array.isArray(body.chains)) {
    if (body.chains.length === 0) throw new DemoError("chains_required", 422);
    sp.chains = body.chains as Chain[];
  }
  if ("fallback" in body) sp.fallback = str(body.fallback) ?? sp.fallback;
  if ("fallbackNote" in body) sp.fallbackNote = str(body.fallbackNote);
  if ("attestations" in body && Array.isArray(body.attestations)) sp.attestations = body.attestations as string[];
  if ("deliverBy" in body) sp.deliverBy = str(body.deliverBy);
  if ("serviceName" in body) sp.serviceName = str(body.serviceName);
  if ("serviceSummary" in body) sp.serviceSummary = str(body.serviceSummary);
  if ("deliverables" in body && Array.isArray(body.deliverables)) {
    sp.deliverables = (body.deliverables as Body[]).map((d) => ({
      id: uuid(),
      kind: str(d.kind) ?? "custom",
      platform: str(d.platform),
      count: num(d.count) ?? 1,
      dueDate: str(d.dueDate) ?? day(30),
      note: str(d.note),
      deliveredUrl: null,
      deliveredAt: null,
    }));
  }
  const positions = positionsFrom(body, t);
  if (positions) {
    sp.positions = positions;
    // The listing-level floor of N identical slots lives on the space.
    const service = body.service as { minOfferCents?: number | null; tiers?: unknown } | undefined;
    if (service && !Array.isArray(service.tiers)) sp.minOfferCents = service.minOfferCents ?? null;
  }
  const bidRung = sp.positions.find((p) => p.saleMode === "bids");
  for (const p of sp.positions) p.biddingEndsAt = p === bidRung || sp.pricingMode === "bids" ? sp.biddingEndsAt : null;
}

/* ── The routes ───────────────────────────────────────────────────── */

export interface DemoRequest {
  method: string;
  /** The path after `/api/creator-demo/`, no leading slash, no query. */
  path: string;
  query: URLSearchParams;
  body: Body | null;
  /** `Authorization` header, as sent. */
  authorization: string | null;
  origin: string;
}

export interface DemoResponse {
  status: number;
  data?: unknown;
  error?: { code: string; message?: string; details?: Record<string, unknown> };
}

function ok(data: unknown, status = 200): DemoResponse {
  return { status, data };
}

function viewerOf(authorization: string | null): UserId {
  const m = /^Bearer demo-([a-z]+)$/.exec(authorization ?? "");
  if (!m || !isDemoRole(m[1])) throw new DemoError("UNAUTHORIZED", 401);
  return DEMO_PEOPLE[m[1] as DemoRole].userId;
}

function accountOf(s: Store, userId: UserId): Account {
  let a = s.accounts.get(userId);
  if (!a) {
    a = account(userId);
    s.accounts.set(userId, a);
  }
  return a;
}

/** The public preview of a seat, as `GET /ad-space/public/team/invite/:code` answers it. */
export function demoInvitePreview(code: string): { invite: InvitePreview } | { error: string } {
  const s = store();
  const seat = s.members.find((m) => m.code === code && m.status === "invited");
  if (!seat) return { error: "invite_not_found" };
  if (seat.inviteExpiresAt && Date.parse(seat.inviteExpiresAt) < Date.now()) return { error: "invite_expired" };
  return {
    invite: {
      role: seat.role,
      creatorHandle: COIN_X.handle,
      creatorName: COIN_X.name,
      creatorAvatarUrl: COIN_X.avatarUrl,
      expiresAt: seat.inviteExpiresAt,
    },
  };
}

export function handleDemo(req: DemoRequest): DemoResponse {
  try {
    return route(req);
  } catch (e) {
    if (e instanceof DemoError) return { status: e.status, error: { code: e.code, details: e.details } };
    return { status: 500, error: { code: "server", message: e instanceof Error ? e.message : String(e) } };
  }
}

function route(req: DemoRequest): DemoResponse {
  const { method, path } = req;
  const seg = path.split("/").filter(Boolean);

  // The demo's own controls. No session: the badge works signed out too.
  if (seg[0] === "demo") {
    if (method === "GET" && seg[1] === "state") return ok(demoStatus());
    if (method === "POST" && seg[1] === "reset") {
      resetDemo(req.body?.seed === "empty" ? "empty" : "seeded");
      return ok(demoStatus());
    }
    if (method === "POST" && seg[1] === "arm") {
      const code = str(req.body?.code);
      armDemoError(
        code
          ? {
              code,
              status: num(req.body?.status) ?? 422,
              match: str(req.body?.match) ?? "",
              details: (req.body?.details as Record<string, unknown> | undefined) ?? {},
            }
          : null,
      );
      return ok(demoStatus());
    }
    throw new DemoError("not_found", 404);
  }

  // The seat preview, which the real API serves without a session.
  if (method === "GET" && seg[0] === "ad-space" && seg[1] === "public" && seg[2] === "team" && seg[3] === "invite" && seg[4]) {
    const r = demoInvitePreview(seg[4]);
    if ("error" in r) throw new DemoError(r.error, r.error === "invite_expired" ? 410 : 404);
    return ok(r);
  }

  const viewer = viewerOf(req.authorization);
  const armed = takeArmed(method, path);
  if (armed) return { status: armed.status, error: { code: armed.code, details: armed.details } };

  const s = store();
  const is = (m: string, pattern: string): string[] | null => {
    if (m !== method) return null;
    const parts = pattern.split("/");
    if (parts.length !== seg.length) return null;
    const params: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i] === ":") params.push(seg[i]);
      else if (parts[i] !== seg[i]) return null;
    }
    return params;
  };
  let p: string[] | null;

  /* X */
  if (is("GET", "x-account")) return ok(accountOf(s, viewer).x);
  if (is("POST", "x-account/link")) {
    const ticket = randomBytes(24).toString("base64url");
    return ok({ authorizeUrl: `${req.origin}/creator/x?result=signed_in&ticket=${ticket}`, returnUrl: `${req.origin}/creator/x` });
  }
  if (is("POST", "x-account/complete")) {
    const a = accountOf(s, viewer);
    a.x =
      viewer === OWNER
        ? coinX()
        : {
            linked: true,
            handle: viewer === MANAGER ? "dana_sells" : viewer === REP ? "kai_films" : "sam_new",
            name: null,
            avatarUrl: null,
            verifiedType: null,
            identityVerified: false,
            followers: 312,
            accountCreatedAt: ago(40 * DAY),
            linkedAt: iso(Date.now()),
            canPublish: false,
            refusal: "x_not_verified",
            configured: true,
          };
    return ok({ result: "ok", account: a.x });
  }

  /* Where you get paid */
  if (is("GET", "ad-space/payout-address")) return ok(payoutView(accountOf(s, viewer)));
  if (is("POST", "ad-space/payout-address/challenge")) {
    const chain = req.body?.chain === "evm" ? "evm" : req.body?.chain === "solana" ? "solana" : null;
    const address = str(req.body?.address);
    if (!chain) throw new DemoError("payout_chain_unknown", 422);
    if (!address) throw new DemoError("payout_address_invalid", 422);
    const nonce = randomBytes(16).toString("hex");
    accountOf(s, viewer).challenges.set(nonce, { chain, address });
    return ok({
      nonce,
      message: [
        "HOLD — prove this address is yours",
        "",
        `Address: ${address}`,
        `Network: ${chain === "solana" ? "Solana" : "Base, Polygon and Ethereum"}`,
        `Nonce: ${nonce}`,
        "",
        "Signing this moves no money, needs no balance and costs no fee.",
        "(Local demo: any signature is accepted.)",
      ].join("\n"),
      expiresInMinutes: 10,
    });
  }
  if (is("POST", "ad-space/payout-address")) {
    const a = accountOf(s, viewer);
    const nonce = str(req.body?.nonce) ?? "";
    const c = a.challenges.get(nonce);
    a.challenges.delete(nonce);
    if (!c || c.address !== req.body?.address) throw new DemoError("payout_nonce_invalid", 422);
    if (!str(req.body?.signature)) throw new DemoError("payout_signature_invalid", 422);
    a.payout[c.chain] = c.address;
    return ok(payoutView(a));
  }

  /* Catalogue and events */
  if (is("GET", "ad-space/templates")) return ok({ templates: templates(), availableChains: AVAILABLE_CHAINS });
  if (is("GET", "ad-space/events/search")) {
    const q = (req.query.get("q") ?? "").trim().toLowerCase();
    const limit = Math.min(20, Number(req.query.get("limit") ?? "8") || 8);
    const today = day(0);
    const events = s.events
      .filter((e) => e.endsOn >= today)
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) || e.slug.includes(q))
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
      .slice(0, limit)
      .map((e) => ({ ...e, spaceCount: e.spaceCount + s.spaces.filter((x) => x.eventId === e.id && x.status === "live").length }));
    return ok({ events });
  }
  if (is("POST", "ad-space/events")) {
    const b = req.body ?? {};
    const name = (str(b.name) ?? "").trim();
    const city = (str(b.city) ?? "").trim();
    const startsOn = str(b.startsOn) ?? "";
    const endsOn = str(b.endsOn) ?? startsOn;
    if (!name || !city || !startsOn) throw new DemoError("validation_error", 400);
    const near = (a: string, c: string) => Math.abs(Date.parse(a) - Date.parse(c)) <= 7 * DAY;
    const candidates = s.events.filter(
      (e) => e.name.toLowerCase() === name.toLowerCase() || (e.city.toLowerCase() === city.toLowerCase() && near(e.startsOn, startsOn)),
    );
    if (candidates.length > 0 && b.confirmNew !== true) throw new DemoError("similar_events", 409, { candidates });
    const event: EventSummary = {
      id: uuid(),
      slug: `${slugify(name)}-${startsOn.slice(0, 4)}`,
      name,
      city,
      country: str(b.country),
      startsOn,
      endsOn,
      category: str(b.category) ?? "other",
      spaceCount: 0,
    };
    s.events.push(event);
    return ok({ event, existed: false }, 201);
  }

  /* Listings */
  if (is("GET", "ad-space/spaces/mine")) {
    const mine = s.spaces.filter((x) => x.ownerId === viewer).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ spaces: mine.map((x) => cardView(s, x)) });
  }
  if (is("POST", "ad-space/spaces")) {
    const b = req.body ?? {};
    const t = templateOf(str(b.templateId) ?? "");
    if (!t) throw new DemoError("not_found", 404);
    const title = (str(b.title) ?? "").trim();
    const sp = space({
      ownerId: viewer,
      templateId: t.id,
      slug: slugify(title || t.name),
      title: title || t.name,
      createdAt: iso(Date.now()),
    });
    applyBody(s, sp, b, t);
    // Slugs are per creator; a repeated title gets a number, as `slugAttempt` does.
    let n = 2;
    const base = sp.slug;
    while (s.spaces.some((x) => x.ownerId === viewer && x.slug === sp.slug)) sp.slug = `${base}-${n++}`;
    s.spaces.push(sp);
    return ok({ space: spaceView(s, sp, viewer, req.origin) }, 201);
  }
  if ((p = is("GET", "ad-space/spaces/:"))) {
    const sp = spaceFor(s, viewer, p[0], "read");
    if (sp.status === "draft" && sp.ownerId !== viewer) throw new DemoError("not_found", 404);
    return ok({ space: spaceView(s, sp, viewer, req.origin) });
  }
  if ((p = is("PATCH", "ad-space/spaces/:"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    if (sp.status !== "draft") throw new DemoError("space_not_draft", 409);
    applyBody(s, sp, req.body ?? {}, templateOf(sp.templateId)!);
    return ok({ space: spaceView(s, sp, viewer, req.origin) });
  }
  if ((p = is("DELETE", "ad-space/spaces/:"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    if (sp.status !== "draft") throw new DemoError("space_not_draft", 409);
    s.spaces = s.spaces.filter((x) => x !== sp);
    return ok({ deleted: true });
  }
  if ((p = is("POST", "ad-space/spaces/:/publish"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    publish(s, sp);
    return ok({ space: spaceView(s, sp, viewer, req.origin) });
  }
  if ((p = is("GET", "ad-space/spaces/:/share"))) {
    const sp = spaceFor(s, viewer, p[0], "read");
    const share = shareOf(sp, req.origin, totalsOf(s, sp));
    if (!share) throw new DemoError("not_live", 409);
    return ok(share);
  }

  /* Series */
  if ((p = is("GET", "ad-space/spaces/:/series"))) {
    const sp = spaceFor(s, viewer, p[0], "read");
    if (!sp.seriesId) return ok({ series: null });
    const members = s.spaces.filter((x) => x.seriesId === sp.seriesId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return ok({ series: { seriesId: sp.seriesId, spaces: members.map((x) => spaceView(s, x, viewer, req.origin)) } });
  }
  if ((p = is("POST", "ad-space/spaces/:/series"))) return ok(addToSeries(s, viewer, p[0], req), 200);
  if ((p = is("DELETE", "ad-space/spaces/:/series"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    const id = sp.seriesId;
    sp.seriesId = null;
    const left = s.spaces.filter((x) => x.seriesId === id && id !== null);
    if (left.length === 1) left[0].seriesId = null;
    return ok({ left: true });
  }

  /* Offers */
  if (is("GET", "ad-space/offers/received")) {
    const mine = new Set(s.spaces.filter((x) => x.ownerId === viewer).map((x) => x.id));
    const open = ["pending", "countered", "accepted"];
    const list = s.offers
      .filter((o) => mine.has(o.spaceId))
      .sort((a, b) => Number(open.includes(b.status)) - Number(open.includes(a.status)) || b.createdAt.localeCompare(a.createdAt));
    return ok({ offers: list.map((o) => offerView(s, o)) });
  }
  if ((p = is("GET", "ad-space/spaces/:/offers"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    return ok({ offers: s.offers.filter((o) => o.spaceId === sp.id).map((o) => offerView(s, o)) });
  }
  if ((p = is("POST", "ad-space/offers/:/accept")) || (p = is("POST", "ad-space/offers/:/counter")) || (p = is("POST", "ad-space/offers/:/decline"))) {
    return ok({ offer: offerView(s, answerOffer(s, viewer, p[0], seg[3], req.body ?? {})) });
  }
  if ((p = is("PUT", "ad-space/positions/:/min-offer"))) {
    const sp = s.spaces.find((x) => x.positions.some((q) => q.id === p![0]));
    if (!sp) throw new DemoError("not_found", 404);
    spaceFor(s, viewer, sp.id, "sell");
    const cents = req.body?.minOfferCents === null ? null : num(req.body?.minOfferCents);
    if (cents !== null && cents < 2_500) throw new DemoError("min_offer_invalid", 422);
    sp.positions.find((q) => q.id === p![0])!.minOfferCents = cents;
    return ok({ space: spaceView(s, sp, viewer, req.origin) });
  }
  if ((p = is("PUT", "ad-space/spaces/:/min-offer"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    const cents = req.body?.minOfferCents === null ? null : num(req.body?.minOfferCents);
    if (cents !== null && cents < 2_500) throw new DemoError("min_offer_invalid", 422);
    sp.minOfferCents = cents;
    return ok({ space: spaceView(s, sp, viewer, req.origin) });
  }

  /* Money in, work out */
  if (is("GET", "ad-space/sales")) return ok({ sales: salesFor(s, viewer) });
  if ((p = is("POST", "ad-space/positions/:/delivered"))) {
    const sp = s.spaces.find((x) => x.positions.some((q) => q.id === p![0]));
    if (!sp) throw new DemoError("not_found", 404);
    spaceFor(s, viewer, sp.id, "deliver");
    const q = sp.positions.find((x) => x.id === p![0])!;
    if (q.status !== "sold") throw new DemoError("position_not_sold", 409);
    const url = str(req.body?.url);
    if (!url || !/^https?:\/\//.test(url)) throw new DemoError("validation_error", 400);
    q.delivered = { url, at: iso(Date.now()) };
    return ok({ delivered: q.delivered });
  }
  if ((p = is("POST", "ad-space/deliverables/:/delivered"))) {
    const sp = s.spaces.find((x) => x.deliverables.some((d) => d.id === p![0]));
    if (!sp) throw new DemoError("not_found", 404);
    spaceFor(s, viewer, sp.id, "deliver");
    const d = sp.deliverables.find((x) => x.id === p![0])!;
    const url = str(req.body?.url);
    if (!url || !/^https?:\/\//.test(url)) throw new DemoError("validation_error", 400);
    d.deliveredUrl = url;
    d.deliveredAt = iso(Date.now());
    return ok({ deliverable: d });
  }
  if ((p = is("POST", "ad-space/positions/:/content/review"))) {
    const sp = s.spaces.find((x) => x.positions.some((q) => q.id === p![0]));
    if (!sp) throw new DemoError("not_found", 404);
    spaceFor(s, viewer, sp.id, "own");
    const q = sp.positions.find((x) => x.id === p![0])!;
    if (q.content?.status !== "pending") throw new DemoError("nothing_to_review", 409);
    if (req.body?.submittedAt !== q.content.submittedAt) throw new DemoError("content_changed", 409);
    q.content =
      req.body?.approve === true
        ? { status: "approved", rejectedReason: null, submittedAt: q.content.submittedAt }
        : { status: "rejected", rejectedReason: str(req.body?.reason), submittedAt: q.content.submittedAt };
    return ok({ content: q.content });
  }
  if ((p = is("POST", "ad-space/spaces/:/updates"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    const body = (str(req.body?.body) ?? "").trim();
    if (!body) throw new DemoError("update_empty", 422);
    const update = { id: uuid(), body, imageUrl: null, positionId: null, createdAt: iso(Date.now()) };
    sp.updates.push(update);
    return ok({ update }, 201);
  }
  if ((p = is("DELETE", "ad-space/spaces/:/updates/:"))) {
    const sp = spaceFor(s, viewer, p[0], "sell");
    sp.updates = sp.updates.filter((u) => u.id !== p![1]);
    return ok({ removed: true });
  }

  /* The listing's picture. The mock cannot read the image bytes (the route parses JSON), so it keeps a stock one. */
  if ((p = is("POST", "ad-space/spaces/:/banner"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    sp.bannerUrl = "/demo/singapore.jpg";
    return ok({ bannerUrl: sp.bannerUrl }, 201);
  }
  if ((p = is("DELETE", "ad-space/spaces/:/banner"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    sp.bannerUrl = null;
    return ok({ bannerUrl: null });
  }

  /* The team */
  if (is("GET", "ad-space/team")) {
    return ok({ team: s.members.filter((m) => m.ownerId === viewer && m.status !== "removed").map((m) => memberView(m, false)) });
  }
  if (is("POST", "ad-space/team")) {
    const label = (str(req.body?.label) ?? "").trim();
    const r = req.body?.role;
    const email = str(req.body?.email);
    if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DemoError("VALIDATION_ERROR", 400);
    if (!label || label.length > 64) throw new DemoError("team_label_required", 422);
    if (r !== "manager" && r !== "rep") throw new DemoError("team_role_unknown", 422);
    if (s.members.filter((m) => m.ownerId === viewer && m.status !== "removed").length >= 25) {
      throw new DemoError("team_too_large", 422, { max: 25 });
    }
    const code = randomBytes(24).toString("base64url");
    const m: MemberRec = {
      id: uuid(),
      ownerId: viewer,
      role: r,
      label,
      status: "invited",
      memberUserId: null,
      invitedAt: iso(Date.now()),
      acceptedAt: null,
      inviteExpiresAt: ahead(14 * DAY),
      code,
    };
    s.members.push(m);
    return ok(
      { member: memberView(m, false), code, url: `${req.origin}/invite/${DEMO_INVITE_CODE}?seat=${code}`, emailed: email !== null },
      201,
    );
  }
  if (is("GET", "ad-space/team/seats")) {
    return ok({ seats: s.members.filter((m) => m.memberUserId === viewer && m.status === "active").map((m) => memberView(m, true)) });
  }
  if (is("POST", "ad-space/team/accept")) {
    const code = str(req.body?.code) ?? "";
    const seat = s.members.find((m) => m.code === code && m.status === "invited");
    if (!seat) throw new DemoError("invite_not_found", 404);
    if (seat.inviteExpiresAt && Date.parse(seat.inviteExpiresAt) < Date.now()) throw new DemoError("invite_expired", 410);
    if (seat.ownerId === viewer) throw new DemoError("invite_is_your_own", 422);
    if (s.members.some((m) => m.ownerId === seat.ownerId && m.memberUserId === viewer && m.status === "active")) {
      throw new DemoError("already_on_this_team", 409);
    }
    seat.status = "active";
    seat.memberUserId = viewer;
    seat.acceptedAt = iso(Date.now());
    seat.code = null;
    seat.inviteExpiresAt = null;
    return ok({ member: memberView(seat, true) });
  }
  if (is("GET", "ad-space/team/work")) return ok({ work: workFor(s, viewer) });
  if (is("GET", "ad-space/team/owed")) {
    const mine = new Set(s.members.filter((m) => m.ownerId === viewer).map((m) => m.id));
    return ok({ owed: s.earnings.filter((e) => mine.has(e.memberId) && e.status !== "void").map((e) => earningView(s, e)) });
  }
  if (is("GET", "ad-space/team/earnings")) {
    const seats = new Set(s.members.filter((m) => m.memberUserId === viewer).map((m) => m.id));
    return ok({ earnings: s.earnings.filter((e) => seats.has(e.memberId) && e.status !== "void").map((e) => earningView(s, e)) });
  }
  if (is("POST", "ad-space/team/owed/paid")) {
    const ids = Array.isArray(req.body?.earningIds) ? (req.body!.earningIds as string[]) : [];
    if (ids.length === 0 || ids.length > 200) throw new DemoError("validation_error", 400);
    const mine = new Set(s.members.filter((m) => m.ownerId === viewer).map((m) => m.id));
    let paid = 0;
    for (const e of s.earnings) {
      if (!ids.includes(e.id) || !mine.has(e.memberId) || e.status !== "owed") continue;
      e.status = "paid";
      e.paidAt = iso(Date.now());
      e.paidTx = str(req.body?.paidTx);
      e.paidNote = str(req.body?.note);
      paid += 1;
    }
    return ok({ paid });
  }
  if ((p = is("DELETE", "ad-space/team/:"))) {
    const m = s.members.find((x) => x.id === p![0] && x.ownerId === viewer && x.status !== "removed");
    if (!m) throw new DemoError("not_found", 404);
    m.status = "removed";
    m.code = null;
    s.assignments = s.assignments.filter((a) => a.memberId !== m.id);
    return ok({ member: memberView(m, false) });
  }
  if ((p = is("GET", "ad-space/spaces/:/team"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    return ok({ assignments: assignmentsFor(s, sp.id) });
  }
  if ((p = is("PUT", "ad-space/spaces/:/team"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    const memberId = str(req.body?.memberId) ?? "";
    const shareBps = num(req.body?.shareBps);
    const m = s.members.find((x) => x.id === memberId && x.ownerId === viewer && x.status === "active");
    if (!m) throw new DemoError("member_not_active", 422);
    if (shareBps === null || !Number.isInteger(shareBps) || shareBps < 1 || shareBps > 10_000) {
      throw new DemoError("share_out_of_range", 422);
    }
    const others = s.assignments.filter((a) => a.spaceId === sp.id && a.memberId !== memberId).reduce((n, a) => n + a.shareBps, 0);
    if (others + shareBps > 10_000) throw new DemoError("shares_over_a_hundred", 422, { leftBps: 10_000 - others });
    let a = s.assignments.find((x) => x.spaceId === sp.id && x.memberId === memberId);
    if (!a) {
      a = { id: uuid(), spaceId: sp.id, memberId, shareBps, note: null };
      s.assignments.push(a);
    }
    a.shareBps = shareBps;
    a.note = str(req.body?.note);
    return ok({ assignment: assignmentsFor(s, sp.id).find((x) => x.memberId === memberId) });
  }
  if ((p = is("DELETE", "ad-space/spaces/:/team/:"))) {
    const sp = spaceFor(s, viewer, p[0], "own");
    const before = s.assignments.length;
    s.assignments = s.assignments.filter((a) => !(a.spaceId === sp.id && a.memberId === p![1]));
    return ok({ removed: s.assignments.length < before });
  }

  throw new DemoError("not_found", 404, { demo: `No demo route for ${method} ${path}` });
}

function publish(s: Store, sp: SpaceRec): void {
  if (sp.status !== "draft") throw new DemoError("space_not_draft", 409);
  const owner = accountOf(s, sp.ownerId);
  if (!owner.x.canPublish) throw new DemoError(owner.x.refusal ?? "x_not_linked", 422);
  if (sp.positions.length === 0) throw new DemoError("no_positions", 422);
  if (sp.chains.includes("solana") && !owner.payout.solana) throw new DemoError("no_solana_address", 422);
  if (sp.chains.some((c) => c !== "solana") && !owner.payout.evm) throw new DemoError("no_evm_address", 422);
  const required = requiredAttestationsOf(templateOf(sp.templateId), sp);
  const missing = required.filter((a) => !sp.attestations.includes(a));
  if (missing.length) throw new DemoError("missing_attestation", 422, { missing });
  checkDates(sp.closesAt);
  const t = templateOf(sp.templateId);
  if (t?.kind === "service" && t.service?.format === "session") {
    const e = eventById(s, sp.eventId);
    if (!e) throw new DemoError("room_needs_an_event", 422);
    sp.deliverBy = iso(Date.parse(`${e.endsOn}T00:00:00Z`) + DAY).slice(0, 10);
  }
  sp.status = "live";
  sp.publishedAt = iso(Date.now());
}

function addToSeries(s: Store, viewer: UserId, spaceId: string, req: DemoRequest) {
  const src = spaceFor(s, viewer, spaceId, "sell");
  if (src.status === "delisted") throw new DemoError("space_delisted", 409);
  const events = Array.isArray(req.body?.events) ? (req.body!.events as { eventId?: string; closesAt?: string }[]) : [];
  if (events.length === 0) throw new DemoError("series_events_required", 422);
  const seriesId = src.seriesId ?? uuid();
  const members = () => s.spaces.filter((x) => x.seriesId === seriesId || x === src);
  if (members().length + events.length > 10) throw new DemoError("series_too_large", 422, { max: 10 });
  if (src.positions.length === 0) throw new DemoError("zones_required", 422);
  src.seriesId = seriesId;

  const created: string[] = [];
  const refused: { eventId: string; code: string; details?: unknown }[] = [];
  const shift = (from: string | null, delta: number) => (from ? iso(Date.parse(from) + delta).slice(0, from.length) : from);
  for (const { eventId = "", closesAt = "" } of events) {
    const event = eventById(s, eventId);
    if (!event || event.endsOn < day(0)) {
      refused.push({ eventId, code: "event_unavailable" });
      continue;
    }
    if (members().some((x) => x.eventId === eventId)) {
      refused.push({ eventId, code: "series_event_repeated" });
      continue;
    }
    try {
      checkDates(closesAt);
    } catch (e) {
      refused.push({ eventId, code: (e as DemoError).code, details: (e as DemoError).details });
      continue;
    }
    const delta = Date.parse(closesAt) - Date.parse(src.closesAt);
    const copy: SpaceRec = {
      ...src,
      id: uuid(),
      status: "draft",
      publishedAt: null,
      slug: `${src.slug}-${event.slug.replace(/-\d{4}$/, "")}`.slice(0, 80),
      eventId: event.id,
      eventName: event.name,
      closesAt,
      biddingEndsAt: shift(src.biddingEndsAt, delta),
      deliverBy: shift(src.deliverBy, delta),
      keyDates: src.keyDates.map((k) => ({ ...k, date: shift(k.date, delta) ?? k.date })),
      deliverables: src.deliverables.map((d) => ({ ...d, id: uuid(), dueDate: shift(d.dueDate, delta) ?? d.dueDate, deliveredUrl: null, deliveredAt: null })),
      positions: src.positions.map((q) => ({
        ...q,
        id: uuid(),
        status: "open",
        sponsor: null,
        content: null,
        delivered: null,
        qr: null,
        reservedUntil: null,
        biddingEndsAt: shift(q.biddingEndsAt, delta),
      })),
      updates: [],
      seriesId,
      createdAt: iso(Date.now() + created.length),
    };
    s.spaces.push(copy);
    created.push(copy.id);
  }
  const spaces = members()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((x) => spaceView(s, x, viewer, req.origin));
  return { seriesId, created, refused, spaces };
}

function answerOffer(s: Store, viewer: UserId, offerId: string, action: string, body: Body): OfferRec {
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) throw new DemoError("not_found", 404);
  const sp = spaceFor(s, viewer, o.spaceId, "sell");
  if (body.updatedAt !== o.updatedAt) throw new DemoError("offer_changed", 409);
  const now = iso(Date.now());
  if (action === "accept") {
    if (o.status !== "pending" && o.status !== "countered") throw new DemoError("offer_not_open", 409);
    // The creator accepting settles at the sponsor's amount, even over a counter
    // (backend `agreedAmountCents("creator", …)`); only the sponsor accepting a
    // counter settles at the counter.
    o.agreedCents = o.amountCents;
    o.status = "accepted";
    o.expiresAt = ahead(24 * HOUR);
    const q = sp.positions.find((x) => x.id === o.positionId);
    if (q) {
      q.status = "held";
      q.reservedUntil = o.expiresAt;
    }
    if (o.kind === "bid") {
      for (const other of s.offers) {
        if (other !== o && other.positionId === o.positionId && other.kind === "bid" && other.status === "pending") {
          other.status = "superseded";
          other.updatedAt = now;
        }
      }
    }
  } else if (action === "counter") {
    if (o.kind !== "offer" || o.status !== "pending") throw new DemoError("offer_not_open", 409);
    if (o.countersUsed >= 3) throw new DemoError("too_many_rounds", 409);
    const amount = num(body.amountCents);
    if (amount === null || amount <= o.amountCents) throw new DemoError("counter_not_above_offer", 422);
    const price = sp.positions.find((x) => x.id === o.positionId)?.priceCents ?? null;
    if (price !== null && amount > price) throw new DemoError("counter_above_price", 422, { priceCents: price });
    o.status = "countered";
    o.counterCents = amount;
    o.countersUsed += 1;
    o.rounds.push({ by: "creator", amountCents: amount, at: now });
    o.expiresAt = ahead(48 * HOUR);
  } else {
    if (!["pending", "countered"].includes(o.status)) throw new DemoError("offer_not_open", 409);
    o.status = "declined";
    o.declineReason = str(body.reason) ?? "other";
    o.expiresAt = null;
  }
  o.updatedAt = now;
  return o;
}

function salesFor(s: Store, viewer: UserId): SalesSummary {
  const mine = s.spaces.filter((x) => x.ownerId === viewer);
  const ids = new Set(mine.map((x) => x.id));
  const orders = s.orders.filter((o) => ids.has(o.spaceId)).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const received = orders.reduce((n, o) => {
    const sp = mine.find((x) => x.id === o.spaceId)!;
    return n + creatorGets(o.priceCents, sp.feePayer);
  }, 0);
  return {
    receivedUsdc: usdc(received),
    soldSpots: orders.length,
    orders: orders.length,
    spaces: new Set(orders.map((o) => o.spaceId)).size,
    recent: orders.slice(0, 10).map((o) => {
      const sp = mine.find((x) => x.id === o.spaceId)!;
      const q = sp.positions.find((x) => x.id === o.positionId);
      return {
        orderId: o.id,
        spaceId: o.spaceId,
        spaceTitle: sp.title,
        serviceName: sp.serviceName,
        zoneKey: q?.zoneKey ?? "",
        chain: o.chain,
        status: "paid",
        receivedUsdc: usdc(creatorGets(o.priceCents, sp.feePayer)),
        paidAt: o.paidAt,
      };
    }),
  };
}

function assignmentsFor(s: Store, spaceId: string): Assignment[] {
  return s.assignments
    .filter((a) => a.spaceId === spaceId)
    .map((a) => {
      const m = s.members.find((x) => x.id === a.memberId)!;
      return {
        id: a.id,
        memberId: a.memberId,
        shareBps: a.shareBps,
        note: a.note,
        label: m.label,
        role: m.role,
        memberUserId: m.memberUserId,
        status: m.status,
      };
    });
}

function workFor(s: Store, viewer: UserId): WorkListing[] {
  const seats = s.members.filter((m) => m.memberUserId === viewer && m.status === "active");
  const out: WorkListing[] = [];
  for (const seat of seats) {
    for (const a of s.assignments.filter((x) => x.memberId === seat.id)) {
      const sp = s.spaces.find((x) => x.id === a.spaceId);
      if (!sp) continue;
      const e = eventById(s, sp.eventId);
      out.push({
        spaceId: sp.id,
        role: seat.role,
        title: sp.title,
        slug: sp.slug,
        status: sp.status,
        eventName: sp.eventName,
        eventStartsOn: e?.startsOn ?? null,
        eventEndsOn: e?.endsOn ?? null,
        deliverBy: sp.deliverBy,
        closesAt: sp.closesAt,
        // Only what was SOLD is work. `label` is the position's TITLE, exactly as
        // `workFor` selects it — null on a placement, which has no title.
        slots: sp.positions
          .filter((q) => q.status === "sold")
          .map((q) => ({
            id: q.id,
            spaceId: sp.id,
            label: q.title,
            zoneKey: q.zoneKey,
            sponsorName: q.sponsor?.name ?? null,
            contentStatus: q.content?.status ?? null,
            deliveredUrl: q.delivered?.url ?? null,
            deliveredAt: q.delivered?.at ?? null,
          })),
        deliverables: sp.deliverables.map((d) => ({
          id: d.id,
          spaceId: sp.id,
          kind: d.kind,
          platform: d.platform,
          count: d.count,
          note: d.note,
          dueDate: d.dueDate,
          deliveredUrl: d.deliveredUrl,
          deliveredAt: d.deliveredAt,
        })),
      });
    }
  }
  return out;
}

/** Listings worth jumping to from the demo badge, as they stand now. */
export function demoShortcuts(): { label: string; href: string }[] {
  const s = store();
  const find = (slug: string) => s.spaces.find((x) => x.slug === slug);
  const out: { label: string; href: string }[] = [];
  const add = (label: string, slug: string) => {
    const sp = find(slug);
    if (sp) out.push({ label, href: `/app/spaces/listings/${sp.id}` });
  };
  add("Fixed ladder with offers (series of 3)", "token2049-videos");
  add("Ladder with a bidding rung", "breakpoint-london-coverage");
  add("Closed listing with sales", "road-to-korea-blockchain-week");
  const draft = find("devcon-8-hallway-interviews");
  if (draft) out.push({ label: "Draft, in the wizard", href: `/app/spaces/listings/${draft.id}/edit` });
  return out;
}
