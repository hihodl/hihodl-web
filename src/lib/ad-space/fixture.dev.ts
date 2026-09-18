/**
 * Development fixture for the public Ad Space page.
 *
 * Loaded only when `AD_SPACE_FIXTURE=1` and NODE_ENV is not production (see
 * `getPublicSpace`). The outlines and zones are copied from the backend
 * catalog (server/services/ad-space/catalog-data.ts) so the board renders the
 * real geometry. Spaces:
 *   /s/coinempress/road-to-token2049   placement, carry-on suitcase, fixed price,
 *                                      TOKEN2049 (city photo), sibling on the feed
 *   /s/coinempress/token2049-videos    service, short-form video, TOKEN2049, its
 *                                      own banner image, sibling on the ground
 *   /s/coinempress/token2049-takeover  the same suitcase, priced by takeover, no
 *                                      event, ember gradient
 *   /s/coinempress/road-to-devcon-8    Devcon 8 (no city photo), sea gradient
 *   /s/coinempress/token2049-pitch-reviews
 *                                      a session space (In the room): pitch
 *                                      review, TOKEN2049, one dispute on record,
 *                                      and a funding goal already beaten (133%)
 *   /s/coinempress/token2049-afterparty-host
 *                                      a custom service, named by its creator,
 *                                      with a mention on X and a funding goal
 *                                      still a way off (21%)
 *   /s/coinempress/breakpoint-london-coverage
 *                                      a TIERED service (ad-space-tiers-v0.md):
 *                                      one event, three prices — $50 logos (six,
 *                                      four left), a $200 card and mic placement
 *                                      (three, all gone, so the rung shows grey)
 *                                      and one $1,300 flagship interview
 * and every other card on an event page opens a copy of the matching board.
 *
 * Events:
 *   /events/token2049-singapore-2026   both tabs, the feed has more open spots
 *   /events/devcon-8-mumbai-2026       no city photo, an empty feed
 *   /events/token-2049-singapore       merged: redirects to the first
 *
 * Bookings (/b/<token>), one per state a buyer can find their session in:
 *   /b/fixture_awaiting_contact  /b/fixture_awaiting_schedule  /b/fixture_scheduled
 *   /b/fixture_awaiting_confirmation  /b/fixture_delivered  /b/fixture_disputed
 *   /b/fixture_window_closed (awaiting_confirmation with confirmBy passed)
 *   /b/fixture_no_handle (scheduled; no handle, path, template name or label)
 */

import type {
  Booking,
  EventPage,
  EventSummary,
  OfferThread,
  OfferView,
  Position,
  PositionOffers,
  SessionState,
  SessionView,
  Space,
  SpaceCard,
  Takeover,
  TemplateZone,
} from "./types";

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${y + h - r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} H${x + r} a${r} ${r} 0 0 1 ${-r} ${-r} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

const SUITCASE_FACE = [
  roundRect(12, 28, 76, 100, 7),
  "M41 28 V7 a2 2 0 0 1 2 -2 H57 a2 2 0 0 1 2 2 V28",
  "M45 28 V9 M55 28 V9",
  circle(22, 132, 4.5),
  circle(78, 132, 4.5),
];

const SUITCASE_SIDE = [
  roundRect(17, 28, 26, 100, 5),
  "M30 28 V5 M26 5 H34",
  "M17 40 H43 M17 116 H43",
  circle(23, 132, 4.5),
  circle(37, 132, 4.5),
];

const FACE_ZONES = [
  { key: "headline", name: "headline", x: 0.2, y: 0.257, w: 0.6, h: 0.129, size: "40 × 15 cm", price: 50000 },
  { key: "upper-left", name: "upper left", x: 0.2, y: 0.429, w: 0.28, h: 0.157, size: "17 × 12 cm", price: 20000 },
  { key: "upper-right", name: "upper right", x: 0.52, y: 0.429, w: 0.28, h: 0.157, size: "17 × 12 cm", price: 20000 },
  { key: "lower-left", name: "lower left", x: 0.2, y: 0.629, w: 0.28, h: 0.157, size: "17 × 12 cm", price: 17500 },
  { key: "lower-right", name: "lower right", x: 0.52, y: 0.629, w: 0.28, h: 0.157, size: "17 × 12 cm", price: 17500 },
];

const SIDE_ZONES = [
  { key: "upper-left", name: "side upper left", x: 0.333, y: 0.6, w: 0.15, h: 0.079, size: "10 × 10 cm", price: 12500 },
  { key: "upper-right", name: "side upper right", x: 0.517, y: 0.6, w: 0.15, h: 0.079, size: "10 × 10 cm", price: 12500 },
  { key: "lower-left", name: "side lower left", x: 0.333, y: 0.707, w: 0.15, h: 0.079, size: "10 × 10 cm", price: 12500 },
  { key: "lower-right", name: "side lower right", x: 0.517, y: 0.707, w: 0.15, h: 0.079, size: "10 × 10 cm", price: 12500 },
];

function zonesFor(views: string[], zones: typeof FACE_ZONES): TemplateZone[] {
  return views.flatMap((view) =>
    zones.map((z) => ({
      zoneKey: `${view}-${z.key}`,
      label: `${view[0].toUpperCase()}${view.slice(1)} ${z.name}`,
      viewKey: view,
      rect: { x: z.x, y: z.y, w: z.w, h: z.h },
      sizeLabel: z.size,
      suggestedPriceCents: z.price,
    })),
  );
}

function logo(text: string, bg: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="10" fill="${bg}"/><text x="100" y="52" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${fg}">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** "500.00" style strings, as the server would send them. */
function usdc(cents: number): string {
  return (cents / 100).toFixed(2);
}

function position(
  id: string,
  zone: { zoneKey: string; label: string; suggestedPriceCents: number },
  over: Partial<Position> = {},
): Position {
  const price = zone.suggestedPriceCents;
  return {
    id,
    zoneKey: zone.zoneKey,
    label: zone.label,
    priceCents: price,
    sponsorPaysUsdc: usdc(price + Math.round(price * 0.05)),
    creatorReceivesUsdc: usdc(price),
    pitch: null,
    accepts: ["logo", "qr", "text"],
    status: "open",
    takeover: null,
    sponsor: null,
    delivered: null,
    // The old shapes: a placement's zones and N identical slots carry no tier,
    // and render exactly as they did before tiers existed.
    tierKey: null,
    title: null,
    perks: [],
    ...over,
  };
}

const DAY = 24 * 60 * 60 * 1000;

/** How many times one spot may change hands (the server's MAX_TAKEOVERS). */
const MAX_HANDS = 6;

function suitcase(): Space {
  const zones = [...zonesFor(["front", "back"], FACE_ZONES), ...zonesFor(["left", "right"], SIDE_ZONES)];
  const byKey = Object.fromEntries(zones.map((z) => [z.zoneKey, z]));
  const pid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  const sold = (n: number, key: string, sponsor: Position["sponsor"]) =>
    position(pid(n), byKey[key], { status: "sold", sponsor });

  const positions: Position[] = [
    sold(1, "front-headline", {
      name: "Acme",
      url: "https://acme.xyz",
      xHandle: "acme",
      contentKind: "logo",
      contentText: null,
      imageUrl: logo("ACME", "#FFFFFF", "#141F2E"),
    }),
    position(pid(2), byKey["front-upper-left"], {
      pitch: "Right under the headline, in every airport shot",
      accepts: ["logo", "qr"],
    }),
    sold(3, "front-upper-right", {
      name: "Nodeline",
      url: "https://nodeline.io",
      xHandle: "nodeline",
      contentKind: "qr",
      contentText: "https://nodeline.io/r/coin",
      imageUrl: null,
    }),
    position(pid(4), byKey["front-lower-left"], { status: "held" }),
    sold(5, "front-lower-right", {
      name: "Kopi Labs",
      url: null,
      xHandle: null,
      contentKind: "text",
      contentText: "CODE10",
      imageUrl: null,
    }),
    sold(6, "back-headline", {
      name: "Orbit",
      url: "https://orbit.fi",
      xHandle: "orbitfi",
      contentKind: "logo",
      contentText: null,
      imageUrl: logo("ORBIT", "#5B7CFF", "#FFFFFF"),
    }),
    position(pid(7), byKey["back-upper-left"]),
    position(pid(8), byKey["back-upper-right"]),
    sold(9, "back-lower-left", {
      name: "Lumen",
      url: "https://lumen.xyz",
      xHandle: "lumen",
      contentKind: "logo",
      contentText: null,
      imageUrl: logo("lumen", "#FFB703", "#0A0500"),
    }),
    position(pid(10), byKey["back-lower-right"]),
    sold(11, "left-upper-left", {
      name: "Stackd",
      url: "https://stackd.app",
      xHandle: "stackd",
      contentKind: "logo",
      contentText: null,
      imageUrl: logo("S", "#141F2E", "#FFB703"),
    }),
    position(pid(12), byKey["left-upper-right"]),
    position(pid(13), byKey["left-lower-left"]),
    position(pid(14), byKey["left-lower-right"]),
    sold(15, "right-upper-left", {
      name: "Mesa",
      url: "https://mesa.money",
      xHandle: "mesamoney",
      contentKind: "logo",
      contentText: null,
      imageUrl: logo("MESA", "#FFFFFF", "#2C4566"),
    }),
    sold(16, "right-upper-right", {
      name: "A sponsor with a very long name indeed",
      url: null,
      xHandle: null,
      contentKind: "text",
      contentText: null,
      imageUrl: null,
    }),
    position(pid(17), byKey["right-lower-left"]),
    position(pid(18), byKey["right-lower-right"]),
  ];

  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "road-to-token2049",
    title: "Road to TOKEN2049",
    reason: "Funding my ticket, flight and stay. Your logo rides through Changi, the venue and every vlog.",
    status: "live",
    kind: "placement",
    closesAt: new Date(Date.now() + 12 * DAY + 5 * 60 * 60 * 1000).toISOString(),
    keyDates: [
      { label: "Packing vlog", date: "2026-10-04" },
      { label: "Flight to Singapore", date: "2026-10-05" },
      { label: "TOKEN2049 day 1", date: "2026-10-07" },
    ],
    deliverBy: null,
    publishedAt: new Date(Date.now() - 3 * DAY).toISOString(),
    chains: ["solana", "base", "polygon"],
    payTo: { solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", evm: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" },
    creator: {
      xUserId: "123",
      xHandle: "coinempress",
      xName: "Coin Empress",
      xAvatarUrl: null,
      xVerifiedType: "blue",
      xIdentityVerified: false,
      xFollowers: 48210,
      xAccountCreatedAt: "2019-03-11T00:00:00.000Z",
      trackRecord: { delivered: 3, missed: 0 },
    },
    feeBps: 500,
    feePayer: "sponsor",
    pricingMode: "fixed",
    takeoverMultiple: null,
    acceptsOffers: false,
    biddingEndsAt: null,
    spaceOffers: null,
    venueType: "conference",
    eventName: "TOKEN2049 Singapore",
    fallback: "content_anyway",
    fallbackNote: "If the suitcase can't go in, it sits at the hotel lobby shoot instead.",
    attestations: ["owns_item", "venue_rules_checked"],
    requiredAttestations: ["owns_item", "venue_rules_checked"],
    deliverables: [
      { id: "d1", kind: "video", platform: "x", count: 1, dueDate: "2026-10-04", deliveredUrl: null, state: "upcoming", note: "The packing vlog, suitcase in frame." },
      { id: "d2", kind: "photo_post", platform: "x", count: 3, dueDate: "2026-10-09", deliveredUrl: null, state: "upcoming", note: null },
      { id: "d4", kind: "mention", platform: "x", count: 2, dueDate: "2026-10-08", deliveredUrl: null, state: "upcoming", note: null },
      { id: "d5", kind: "custom", platform: null, count: 1, dueDate: "2026-10-08", deliveredUrl: null, state: "upcoming", note: "Your sticker on my conference badge for both days" },
      { id: "d3", kind: "thank_you_post", platform: "x", count: 1, dueDate: "2026-09-12", deliveredUrl: "https://x.com/coinempress/status/1", state: "delivered", note: null },
    ],
    serviceName: null,
    serviceSummary: null,
    template: {
      id: "carry-on-suitcase",
      kind: "placement",
      productType: "luggage",
      name: "Carry-on suitcase",
      views: [
        { key: "front", label: "Front", viewBox: [100, 140], outline: SUITCASE_FACE },
        { key: "back", label: "Back", viewBox: [100, 140], outline: SUITCASE_FACE },
        { key: "left", label: "Left", viewBox: [60, 140], outline: SUITCASE_SIDE },
        { key: "right", label: "Right", viewBox: [60, 140], outline: SUITCASE_SIDE },
      ],
      zones,
      service: null,
    },
    positions,
    // No goal: the ordinary space, and the one that proves the hero still counts
    // spots exactly as it did before goals existed. The afterparty and the pitch
    // reviews carry one.
    fundingGoalCents: null,
    totals: { positions: 18, sold: 8, committedCents: 177500, totalCents: 420000 },
    updates: [
      {
        id: "u2",
        body: "Front of the suitcase is officially sold out",
        imageUrl: null,
        positionId: null,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "u1",
        body: "First sticker is on. Thank you Acme.",
        imageUrl: logo("PHOTO", "#2C4566", "#F4F6FA"),
        positionId: pid(1),
        createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
      },
    ],
    share: {
      url: "https://hihodl.xyz/s/coinempress/road-to-token2049?m=8",
      text: "8 of 18 spots on my suitcase are sold for TOKEN2049 https://hihodl.xyz/s/coinempress/road-to-token2049?m=8",
    },
    // Null on a draft and on an account with no code yet; set here so the
    // recruiting strip above the footer is visible in local development.
    creatorInvite: { code: "coin-3f2a1", url: "https://hihodl.xyz/invite/coin-3f2a1" },
    event: TOKEN2049,
    bannerUrl: null,
    bannerGradient: "steel",
    siblings: [{ path: "/s/coinempress/token2049-videos", tab: "feed", title: "TOKEN2049 short videos" }],
  };
}

function videos(): Space {
  const base = suitcase();
  const slot = (n: number, over: Partial<Position> = {}) =>
    position(
      `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`,
      { zoneKey: `slot-${n}`, label: `Slot ${n}`, suggestedPriceCents: 50000 },
      { accepts: ["logo", "text"], pitch: "One dedicated video, your product in the first five seconds", ...over },
    );
  return {
    ...base,
    id: "22222222-2222-4222-8222-222222222222",
    slug: "token2049-videos",
    title: "TOKEN2049 short videos",
    reason: "Three dedicated videos from the floor, one sponsor each.",
    kind: "service",
    deliverBy: "2026-10-20",
    chains: ["solana", "base"],
    deliverables: [],
    attestations: ["discloses_sponsorship"],
    requiredAttestations: ["discloses_sponsorship"],
    fallback: "content_anyway",
    fallbackNote: null,
    template: {
      id: "short-form-video",
      kind: "service",
      productType: "service",
      name: "Short-form video",
      views: [],
      zones: [],
      service: {
        deliverableKind: "video",
        summary: "One dedicated short-form video (up to 60 s) posted on X, made about the sponsor's product.",
        maxSlots: 20,
      },
    },
    positions: [
      slot(1, {
        status: "sold",
        sponsor: {
          name: "Acme",
          url: "https://acme.xyz",
          xHandle: "acme",
          contentKind: "logo",
          contentText: null,
          imageUrl: logo("ACME", "#FFFFFF", "#141F2E"),
        },
        delivered: { url: "https://x.com/coinempress/status/2", at: new Date().toISOString() },
      }),
      slot(2, { status: "held" }),
      slot(3),
    ],
    totals: { positions: 3, sold: 1, committedCents: 50000, totalCents: 150000 },
    updates: [],
    share: {
      url: "https://hihodl.xyz/s/coinempress/token2049-videos?m=1",
      text: "1 of 3 video slots sold https://hihodl.xyz/s/coinempress/token2049-videos?m=1",
    },
    // The creator's own banner, which wins over the city photo.
    bannerUrl: photo("photo-1565967511849-76a60a516170"),
    siblings: [{ path: "/s/coinempress/road-to-token2049", tab: "ground", title: "Road to TOKEN2049" }],
  };
}

/**
 * The same board, priced by takeover, with the ladder in every state a card has
 * to render: a spot nobody has taken, one taken twice, one that has changed
 * hands as often as it may, and one a doubling would push past the ceiling.
 *
 * The headline spot is the pair of figures the copy exists for: a $87.50 floor
 * taken twice is a $350 spot, and the next hand costs $735 while repaying
 * $367.50 — two amounts one line apart that must never appear unlabelled.
 */
function takeovers(): Space {
  const base = suitcase();
  const byKey = Object.fromEntries(base.template.zones.map((z) => [z.zoneKey, z]));
  const pid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

  /**
   * One spot's ladder, as the server builds it: the next three figures exist
   * only while there is something to take. A spot nobody holds yet, and one
   * that can go no higher, carry the floor and the count and nothing else.
   */
  const ladder = (args: {
    priceCents: number;
    floorPriceCents: number;
    handsSoFar: number;
    takeable: boolean;
    closed?: string;
  }): Takeover => {
    const next = args.takeable ? args.priceCents * 2 : null;
    return {
      priceUsdc: usdc(args.priceCents),
      nextPriceUsdc: next ? usdc(next) : null,
      nextSponsorPaysUsdc: next ? usdc(next + Math.round(next * 0.05)) : null,
      refundsUsdc: next ? usdc(args.priceCents + Math.round(args.priceCents * 0.05)) : null,
      floorPriceCents: args.floorPriceCents,
      handsSoFar: args.handsSoFar,
      handsLeft: MAX_HANDS - args.handsSoFar,
      closed: args.closed ?? null,
    };
  };

  /** A spot whose price has moved off the zone's suggestion, as bidding does. */
  const at = (n: number, zoneKey: string, priceCents: number, over: Partial<Position>): Position =>
    position(pid(n), byKey[zoneKey], {
      priceCents,
      sponsorPaysUsdc: usdc(priceCents + Math.round(priceCents * 0.05)),
      creatorReceivesUsdc: usdc(priceCents),
      ...over,
    });

  const positions: Position[] = [
    at(1, "front-headline", 35000, {
      status: "sold",
      sponsor: {
        name: "Acme",
        url: "https://acme.xyz",
        xHandle: "acme",
        contentKind: "logo",
        contentText: null,
        imageUrl: logo("ACME", "#FFFFFF", "#141F2E"),
      },
      takeover: ladder({ priceCents: 35000, floorPriceCents: 8750, handsSoFar: 2, takeable: true }),
    }),
    at(2, "front-upper-left", 20000, {
      pitch: "Right under the headline, in every airport shot",
      takeover: ladder({ priceCents: 20000, floorPriceCents: 20000, handsSoFar: 0, takeable: false }),
    }),
    at(3, "front-upper-right", 50000, {
      status: "sold",
      sponsor: {
        name: "Nodeline",
        url: "https://nodeline.io",
        xHandle: "nodeline",
        contentKind: "qr",
        contentText: "https://nodeline.io/r/coin",
        imageUrl: null,
      },
      takeover: ladder({ priceCents: 50000, floorPriceCents: 50000, handsSoFar: 0, takeable: true }),
    }),
    at(4, "front-lower-left", 17500, {
      status: "held",
      takeover: ladder({ priceCents: 17500, floorPriceCents: 17500, handsSoFar: 0, takeable: false }),
    }),
    at(5, "front-lower-right", 800000, {
      status: "sold",
      sponsor: {
        name: "Kopi Labs",
        url: null,
        xHandle: null,
        contentKind: "text",
        contentText: "CODE10",
        imageUrl: null,
      },
      takeover: ladder({
        priceCents: 800000,
        floorPriceCents: 12500,
        handsSoFar: MAX_HANDS,
        takeable: false,
        closed: "too_many_takeovers",
      }),
    }),
    at(6, "back-headline", 1600000, {
      status: "sold",
      sponsor: {
        name: "Orbit",
        url: "https://orbit.fi",
        xHandle: "orbitfi",
        contentKind: "logo",
        contentText: null,
        imageUrl: logo("ORBIT", "#5B7CFF", "#FFFFFF"),
      },
      // Doubling $16,000 lands past the $25,000 a spot may cost, so it stops
      // here even though it has a hand left.
      takeover: ladder({
        priceCents: 1600000,
        floorPriceCents: 50000,
        handsSoFar: 5,
        takeable: false,
        closed: "price_ceiling",
      }),
    }),
    at(7, "back-upper-left", 20000, {
      takeover: ladder({ priceCents: 20000, floorPriceCents: 20000, handsSoFar: 0, takeable: false }),
    }),
    at(8, "back-upper-right", 20000, {
      takeover: ladder({ priceCents: 20000, floorPriceCents: 20000, handsSoFar: 0, takeable: false }),
    }),
  ];

  return {
    ...base,
    id: "33333333-3333-4333-8333-333333333333",
    slug: "token2049-takeover",
    title: "TOKEN2049 suitcase, open bidding",
    reason: "Every spot opens low. Sponsors outbid each other, and whoever is outbid gets their money straight back.",
    // Takeovers are Solana only: the refund is a leg of the very transaction
    // that displaces the sponsor, and a transaction lives on one chain.
    chains: ["solana"],
    pricingMode: "takeover",
    takeoverMultiple: 2,
    positions,
    totals: { positions: positions.length, sold: 4, committedCents: 2485000, totalCents: 2562500 },
    updates: [],
    share: {
      url: "https://hihodl.xyz/s/coinempress/token2049-takeover?m=4",
      text: "4 of 8 spots taken, and every one of them is still up for grabs https://hihodl.xyz/s/coinempress/token2049-takeover?m=4",
    },
    // A space from before events: a free-text event name and nothing else.
    event: null,
    bannerGradient: "ember",
    siblings: [],
  };
}

/**
 * In the room: a creator's time at TOKEN2049, sold as pitch reviews. No sponsor
 * block ever shows on a session slot, and the track record carries a dispute so
 * "· 1 disputed" renders.
 */
/**
 * A `custom-service` space: the creator names and describes what they sell, and
 * the brand reads that instead of the template's generic copy.
 */
function customService(): Space {
  const base = videos();
  return {
    ...base,
    id: "55555555-5555-4555-8555-555555555555",
    slug: "token2049-afterparty-host",
    title: "Host my TOKEN2049 afterparty table",
    reason: null,
    serviceName: "Afterparty table host",
    serviceSummary: "Your brand hosts my table at the Marina Bay afterparty: your name on the table card and a toast to you.",
    deliverables: [
      { id: "c1", kind: "mention", platform: "x", count: 1, dueDate: "2026-10-09", deliveredUrl: null, state: "upcoming", note: "Tagged in the night's recap thread" },
    ],
    template: {
      id: "custom-service",
      kind: "service",
      productType: "service",
      name: "Custom service",
      views: [],
      zones: [],
      service: { deliverableKind: "custom", summary: "Something the creator describes.", maxSlots: 20, custom: true },
    },
    // A campaign with a goal and a way to go: the hero reads "$500 of $2,400 ·
    // 21%" and the bar fills with the money rather than with the slots sold.
    // Its fallback carries no note, so the block shows the standard sentence.
    fundingGoalCents: 240000,
    share: {
      url: "https://hihodl.xyz/s/coinempress/token2049-afterparty-host",
      text: "Host my TOKEN2049 afterparty table https://hihodl.xyz/s/coinempress/token2049-afterparty-host",
    },
  };
}

/**
 * The listing tiers exist for (ad-space-tiers-v0.md): a creator with a
 * content-creator pass covering one event, selling three different things at
 * three prices on one page.
 *
 * Every state the ladder has to render is here: a rung half sold with one copy
 * being paid for, a rung with nothing left (which still shows, greyed, because
 * a ladder with a missing rung reads as a mistake), and the flagship, sold
 * once, still there.
 */
function eventCoverage(): Space {
  const base = videos();
  const pid = (n: number) => `00000000-0000-4000-c000-${String(n).padStart(12, "0")}`;

  /** A tier, and the copies of it that are for sale. */
  type Tier = { key: string; title: string; priceCents: number; perks: string[] };

  const STRIP: Tier = {
    key: "mini-strip",
    title: "Logo in my mini strip",
    priceCents: 5000,
    perks: [
      "Your logo in the strip that runs on every clip I post from the floor",
      "Your name in the caption of each daily recap",
    ],
  };
  const CARD_MIC: Tier = {
    key: "card-and-mic",
    title: "Card and mic placement",
    priceCents: 20000,
    perks: [
      "Everything in the mini strip",
      "Your card on the table in every interview I shoot",
      "Your logo on my mic flag, on camera all three days",
    ],
  };
  const FLAGSHIP: Tier = {
    key: "flagship-interview",
    title: "Flagship on-site interview, fully produced",
    priceCents: 130000,
    perks: [
      "Everything in the card and mic placement",
      "A 10-minute interview with your founder, shot and edited by me",
      "Posted the same evening, with your handle in the post",
      "The raw footage as well, yours to re-cut anywhere you like",
    ],
  };

  /** One copy of a rung. Every copy of a tier carries the same name, price and lines. */
  const copy = (n: number, tier: Tier, over: Partial<Position> = {}): Position =>
    position(
      pid(n),
      { zoneKey: `slot-${n}`, label: tier.title, suggestedPriceCents: tier.priceCents },
      {
        tierKey: tier.key,
        title: tier.title,
        perks: tier.perks,
        accepts: ["logo", "qr", "text"],
        pitch: null,
        ...over,
      },
    );

  const sponsor = (name: string, bg: string, fg: string): Position["sponsor"] => ({
    name,
    url: null,
    xHandle: name.toLowerCase().replace(/\W/g, ""),
    contentKind: "logo",
    contentText: null,
    imageUrl: logo(name.toUpperCase(), bg, fg),
  });

  const positions: Position[] = [
    copy(1, STRIP, { status: "sold", sponsor: sponsor("Kopi Labs", "#FFFFFF", "#141F2E") }),
    copy(2, STRIP, { status: "held" }),
    copy(3, STRIP),
    copy(4, STRIP),
    copy(5, STRIP),
    copy(6, STRIP),
    copy(7, CARD_MIC, { status: "sold", sponsor: sponsor("Acme", "#FFFFFF", "#141F2E") }),
    copy(8, CARD_MIC, { status: "sold", sponsor: sponsor("Nodeline", "#5B7CFF", "#FFFFFF") }),
    copy(9, CARD_MIC, { status: "sold", sponsor: sponsor("Lumen", "#FFB703", "#0A0500") }),
    copy(10, FLAGSHIP),
  ];

  return {
    ...base,
    id: "77777777-7777-4777-8777-777777777777",
    slug: "breakpoint-london-coverage",
    title: "I'm covering Breakpoint London",
    reason:
      "Three days on the floor with a creator pass: interviews, recap footage and daily posts, all shot and edited by me. Pick a spot, pay in USDC, your brand goes live.",
    deliverBy: dayFromNow(45),
    chains: ["solana", "base", "polygon"],
    fallback: "creator_refund",
    fallbackNote: null,
    attestations: ["discloses_sponsorship"],
    requiredAttestations: ["discloses_sponsorship"],
    deliverables: [
      { id: "b1", kind: "video", platform: "x", count: 3, dueDate: dayFromNow(45), deliveredUrl: null, state: "upcoming", note: "One recap a day, all three days." },
      { id: "b2", kind: "mention", platform: "x", count: 1, dueDate: dayFromNow(46), deliveredUrl: null, state: "upcoming", note: null },
    ],
    template: {
      id: "event-coverage",
      kind: "service",
      productType: "service",
      name: "Cover an event for you",
      views: [],
      zones: [],
      service: {
        deliverableKind: "video",
        summary:
          "Three days at the event with a content-creator pass: floor interviews, recap footage and daily posts.",
        maxSlots: 20,
      },
    },
    positions,
    // $650 of $2,000 so far: one mini strip and the three card and mic spots.
    fundingGoalCents: 200000,
    totals: { positions: positions.length, sold: 4, committedCents: 65000, totalCents: 220000 },
    updates: [],
    // A space with no event row of its own: the name is free text, as it is on
    // every space made before events existed.
    eventName: "Breakpoint London",
    event: null,
    bannerUrl: null,
    bannerGradient: "night",
    share: {
      url: "https://hihodl.xyz/s/coinempress/breakpoint-london-coverage",
      text: "Spots on my Breakpoint London coverage start at $50 https://hihodl.xyz/s/coinempress/breakpoint-london-coverage",
    },
    siblings: [],
  };
}

function pitchReviews(): Space {
  const base = videos();
  const slot = (n: number, over: Partial<Position> = {}) =>
    position(
      `00000000-0000-4000-b000-${String(n).padStart(12, "0")}`,
      { zoneKey: `slot-${n}`, label: `Slot ${n}`, suggestedPriceCents: 10000 },
      { accepts: [], pitch: null, ...over },
    );
  return {
    ...base,
    id: "44444444-4444-4444-8444-444444444444",
    slug: "token2049-pitch-reviews",
    title: "Pitch reviews at TOKEN2049",
    reason: "Thirty minutes on your deck before you pitch, at the venue. I have judged four demo days this year.",
    keyDates: [],
    kind: "service",
    deliverBy: dayFromNow(23),
    chains: ["solana", "base", "polygon"],
    fallback: "creator_refund",
    fallbackNote: "If I can't make the time we set, I refund you the same day.",
    attestations: ["public_place", "no_investment_advice", "no_investor_intros"],
    requiredAttestations: ["public_place", "no_investment_advice", "no_investor_intros"],
    creator: { ...base.creator, trackRecord: { delivered: 5, missed: 0, disputed: 1 } },
    template: {
      id: "pitch-review",
      kind: "service",
      productType: "service",
      name: "Pitch review",
      views: [],
      zones: [],
      service: {
        deliverableKind: "session",
        summary: "A 30-minute review of your pitch, in person at the event, at the venue or a public place.",
        maxSlots: 12,
        format: "session",
      },
    },
    positions: [slot(1, { status: "sold" }), slot(2, { status: "sold" }), slot(3, { status: "held" }), slot(4), slot(5), slot(6)],
    // A goal already beaten, which is the case the bar must not get wrong:
    // "$200 of $150 · 133%", the bar full and the number still climbing.
    fundingGoalCents: 15000,
    totals: { positions: 6, sold: 2, committedCents: 20000, totalCents: 60000 },
    share: {
      url: "https://hihodl.xyz/s/coinempress/token2049-pitch-reviews?m=2",
      text: "Pitch reviews at TOKEN2049 https://hihodl.xyz/s/coinempress/token2049-pitch-reviews?m=2",
    },
    bannerUrl: null,
    siblings: [
      { path: "/s/coinempress/road-to-token2049", tab: "ground", title: "Road to TOKEN2049" },
      { path: "/s/coinempress/token2049-videos", tab: "feed", title: "TOKEN2049 short videos" },
    ],
  };
}

/* ── Events ──────────────────────────────────────────────────────────── */

function photo(id: string): string {
  return `https://images.unsplash.com/${id}?w=2000&q=70&fm=jpg&fit=crop`;
}

/** Days from today as a calendar date, so the countdowns never go stale. */
function dayFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

const TOKEN2049: EventSummary = {
  id: "e0000000-0000-4000-8000-000000000001",
  slug: "token2049-singapore-2026",
  name: "TOKEN2049",
  city: "Singapore",
  country: "SG",
  startsOn: dayFromNow(21),
  endsOn: dayFromNow(22),
  timeZone: "Asia/Singapore",
  category: "crypto",
  coverUrl: photo("photo-1508964942454-1a56651d54ac"),
  coverCredit: "Photo: Unsplash",
  spaceCount: 6,
};

const DEVCON: EventSummary = {
  id: "e0000000-0000-4000-8000-000000000002",
  slug: "devcon-8-mumbai-2026",
  name: "Devcon 8",
  city: "Mumbai",
  country: "IN",
  startsOn: dayFromNow(57),
  endsOn: dayFromNow(60),
  timeZone: "Asia/Kolkata",
  category: "crypto",
  coverUrl: null,
  coverCredit: null,
  spaceCount: 2,
};

type CardCreator = SpaceCard["creator"];

function creator(xHandle: string, xName: string | null, xFollowers: number | null, over: Partial<CardCreator> = {}): CardCreator {
  return {
    xHandle,
    xName,
    xAvatarUrl: null,
    xVerifiedType: "blue",
    xFollowers,
    trackRecord: { delivered: 0, missed: 0 },
    ...over,
  };
}

const COIN = creator("coinempress", "Coin Empress", 48210, { trackRecord: { delivered: 3, missed: 0 } });

function card(
  n: number,
  over: Omit<Partial<SpaceCard>, "creator" | "totals"> &
    Pick<SpaceCard, "path" | "title" | "tab" | "templateName"> & {
      creator: CardCreator;
      totals: SpaceCard["totals"];
    },
): SpaceCard {
  return {
    spaceId: `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    pricingMode: "fixed",
    status: "live",
    closesAt: new Date(Date.now() + 12 * DAY).toISOString(),
    bannerUrl: null,
    bannerGradient: "steel",
    fromPriceCents: 12500,
    ...over,
  };
}

function token2049Tabs(): EventPage["tabs"] {
  return {
    ground: [
      card(1, {
        path: "/s/coinempress/road-to-token2049",
        title: "Road to TOKEN2049",
        tab: "ground",
        templateName: "Carry-on suitcase",
        creator: COIN,
        totals: { positions: 18, open: 9, sold: 8 },
        closesAt: new Date(Date.now() + 12 * DAY + 5 * 60 * 60 * 1000).toISOString(),
      }),
      card(21, {
        path: "/s/coinempress/token2049-bids",
        title: "Bid for my TOKEN2049 suitcase",
        tab: "ground",
        templateName: "Carry-on suitcase",
        creator: COIN,
        pricingMode: "bids",
        biddingEndsAt: new Date(Date.now() + 2 * DAY + 5 * 60 * 60 * 1000).toISOString(),
        totals: { positions: 18, open: 8, sold: 8 },
        fromPriceCents: null,
      }),
      card(22, {
        path: "/s/coinempress/token2049-offers",
        title: "Make me an offer: TOKEN2049 suitcase",
        tab: "ground",
        templateName: "Carry-on suitcase",
        creator: COIN,
        pricingMode: "offers",
        totals: { positions: 18, open: 9, sold: 8 },
        fromPriceCents: null,
      }),
      card(23, {
        path: "/s/coinempress/token2049-videos-offers",
        title: "TOKEN2049 short videos, offers welcome",
        tab: "ground",
        templateName: "Short-form video",
        creator: COIN,
        acceptsOffers: true,
        totals: { positions: 3, open: 1, sold: 1 },
        fromPriceCents: 52500,
      }),
      card(2, {
        path: "/s/defidana/token2049-blazer",
        title: "My blazer at TOKEN2049",
        tab: "ground",
        templateName: "Blazer",
        creator: creator("defidana", "Dana | DeFi", 12840, {
          xVerifiedType: null,
          trackRecord: { delivered: 1, missed: 0 },
        }),
        bannerGradient: "night",
        pricingMode: "takeover",
        totals: { positions: 6, open: 4, sold: 3 },
        fromPriceCents: 30000,
        closesAt: new Date(Date.now() + 9 * DAY).toISOString(),
      }),
      card(3, {
        path: "/s/kaitotrades/backpack-singapore",
        title: "Backpack through Singapore",
        tab: "ground",
        templateName: "Backpack",
        creator: creator("kaitotrades", "Kaito", 210400, {
          xVerifiedType: "business",
          trackRecord: { delivered: 7, missed: 1 },
        }),
        bannerGradient: "slate",
        status: "closed",
        totals: { positions: 8, open: 0, sold: 8 },
        fromPriceCents: null,
        closesAt: new Date(Date.now() - 2 * DAY).toISOString(),
      }),
    ],
    feed: [
      card(4, {
        path: "/s/mira_onchain/token2049-interviews",
        title: "Founder interviews from the floor",
        tab: "feed",
        templateName: "Interview",
        creator: creator("mira_onchain", "Mira", 96300, { trackRecord: { delivered: 4, missed: 0 } }),
        bannerGradient: "sea",
        totals: { positions: 12, open: 10, sold: 2 },
        fromPriceCents: 45000,
        closesAt: new Date(Date.now() + 18 * DAY).toISOString(),
      }),
      card(5, {
        path: "/s/sgnomad/token2049-week-wrap",
        title: "TOKEN2049 week, wrapped",
        tab: "feed",
        templateName: "Event wrap",
        creator: creator("sgnomad", "SG Nomad with a rather long display name", 5120, { xVerifiedType: null }),
        bannerUrl: photo("photo-1496939376851-89342e90adcd"),
        totals: { positions: 5, open: 3, sold: 2 },
        fromPriceCents: 20000,
        closesAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      }),
      card(6, {
        path: "/s/coinempress/token2049-videos",
        title: "TOKEN2049 short videos",
        tab: "feed",
        templateName: "Short-form video",
        creator: COIN,
        bannerUrl: photo("photo-1565967511849-76a60a516170"),
        totals: { positions: 3, open: 1, sold: 1 },
        fromPriceCents: 50000,
      }),
    ],
    room: [
      card(9, {
        path: "/s/coinempress/token2049-pitch-reviews",
        title: "Pitch reviews at TOKEN2049",
        tab: "room",
        templateName: "Pitch review",
        creator: { ...COIN, trackRecord: { delivered: 5, missed: 0, disputed: 1 } },
        totals: { positions: 6, open: 3, sold: 2 },
        fromPriceCents: 10000,
      }),
      card(10, {
        path: "/s/mira_onchain/token2049-side-event-host",
        title: "I host your side event",
        tab: "room",
        templateName: "Host or MC your side event",
        creator: creator("mira_onchain", "Mira", 96300, { trackRecord: { delivered: 4, missed: 0 } }),
        bannerGradient: "sea",
        totals: { positions: 3, open: 2, sold: 1 },
        fromPriceCents: 60000,
      }),
    ],
  };
}

function devconTabs(): EventPage["tabs"] {
  return {
    ground: [
      card(7, {
        path: "/s/coinempress/road-to-devcon-8",
        title: "Road to Devcon 8",
        tab: "ground",
        templateName: "Carry-on suitcase",
        creator: COIN,
        bannerGradient: "sea",
        totals: { positions: 18, open: 18, sold: 0 },
        closesAt: new Date(Date.now() + 40 * DAY).toISOString(),
      }),
      card(8, {
        path: "/s/priya_builds/devcon-tote",
        title: "A tote bag across Devcon",
        tab: "ground",
        // An X sync that came back thin, and a template gone from the catalogue.
        templateName: null,
        creator: creator("priya_builds", null, null, { xVerifiedType: "unknown_kind", trackRecord: { delivered: 2, missed: 0 } }),
        bannerUrl: photo("photo-1570168007204-dfb528c6958f"),
        totals: { positions: 4, open: 2, sold: 2 },
        fromPriceCents: 8000,
        closesAt: new Date(Date.now() + 30 * DAY).toISOString(),
      }),
    ],
    feed: [],
    room: [],
  };
}

export function fixtureEvents(): EventSummary[] {
  return [TOKEN2049, DEVCON];
}

export function fixtureEvent(slug: string): EventPage | { redirectTo: string } | null {
  // As the API computes it: open spots on live spaces, feed 14 to ground 13.
  if (slug === TOKEN2049.slug) return { event: TOKEN2049, tabs: token2049Tabs(), defaultTab: "feed" };
  if (slug === DEVCON.slug) return { event: DEVCON, tabs: devconTabs(), defaultTab: "ground" };
  if (slug === "token-2049-singapore") return { redirectTo: TOKEN2049.slug };
  return null;
}

/**
 * Any card on an event page opens a board: the real fixtures for coinempress,
 * and for everybody else a copy of the suitcase or the video board wearing that
 * card's creator, title, event and look.
 */
function fromCard(c: SpaceCard, event: EventSummary, all: SpaceCard[]): Space {
  const base = c.tab === "room" ? pitchReviews() : c.tab === "feed" ? videos() : suitcase();
  const slug = c.path.split("/").pop() ?? base.slug;
  return {
    ...base,
    id: c.spaceId,
    slug,
    title: c.title,
    status: c.status,
    closesAt: c.closesAt,
    pricingMode: "fixed",
    creator: {
      ...base.creator,
      xHandle: c.creator.xHandle ?? base.creator.xHandle,
      xName: c.creator.xName ?? c.creator.xHandle ?? base.creator.xName,
      xAvatarUrl: c.creator.xAvatarUrl,
      xVerifiedType: c.creator.xVerifiedType === "blue" || c.creator.xVerifiedType === "business" ? c.creator.xVerifiedType : null,
      xFollowers: c.creator.xFollowers ?? 0,
      trackRecord: c.creator.trackRecord,
      xUserId: c.creator.xHandle ?? c.spaceId,
      xAccountCreatedAt: "2021-06-01T00:00:00.000Z",
    },
    eventName: event.name,
    event,
    bannerUrl: c.bannerUrl,
    bannerGradient: c.bannerGradient,
    siblings: all
      .filter((o) => o.creator.xHandle === c.creator.xHandle && o.path !== c.path)
      .map((o) => ({ path: o.path, tab: o.tab, title: o.title })),
    share: { url: `https://hihodl.xyz${c.path}`, text: `${c.title} https://hihodl.xyz${c.path}` },
    creatorInvite: null,
  };
}

/* ── Offers and bids (hispace-offers-v0.md) ─────────────────────────────── */

const NO_OFFERS: PositionOffers = {
  mode: "offers",
  openCount: null,
  bidCount: null,
  highestBidUsdc: null,
  highestBidSponsorPaysUsdc: null,
  leaderName: null,
  reserveMet: null,
  openingBidUsdc: null,
  nextMinimumBidUsdc: null,
  biddingEndsAt: null,
  biddingOpen: null,
  reservedUntil: null,
};

/**
 * The suitcase, sold by bidding: a spot with no bids, one led with the reserve
 * met, one led below the reserve, one whose bidding ended, and one held for the
 * winning bid while it is paid.
 */
function bidsBoard(): Space {
  const base = suitcase();
  const ends = new Date(Date.now() + 2 * DAY + 5 * HOUR).toISOString();
  const bids = (over: Partial<PositionOffers>): PositionOffers => ({
    ...NO_OFFERS,
    mode: "bids",
    bidCount: 0,
    openingBidUsdc: "100.00",
    nextMinimumBidUsdc: "100.00",
    biddingEndsAt: ends,
    biddingOpen: true,
    ...over,
  });
  const positions = base.positions.map((p, i): Position => {
    if (p.status === "sold") return { ...p, offers: bids({ biddingOpen: false }) };
    const opening = { priceCents: 10000, sponsorPaysUsdc: "105.00", creatorReceivesUsdc: "100.00" };
    if (i === 1) {
      return {
        ...p,
        ...opening,
        offers: bids({
          bidCount: 12,
          highestBidUsdc: "420.00",
          highestBidSponsorPaysUsdc: "441.00",
          leaderName: "Acme",
          reserveMet: true,
          nextMinimumBidUsdc: "441.00",
        }),
      };
    }
    if (i === 3) {
      return {
        ...p,
        ...opening,
        status: "held",
        offers: bids({
          bidCount: 4,
          highestBidUsdc: "260.00",
          highestBidSponsorPaysUsdc: "273.00",
          leaderName: "Nodeline",
          biddingOpen: false,
          biddingEndsAt: new Date(Date.now() - 3 * HOUR).toISOString(),
          reservedUntil: new Date(Date.now() + 20 * HOUR).toISOString(),
        }),
      };
    }
    if (i === 6) {
      return {
        ...p,
        ...opening,
        offers: bids({
          bidCount: 2,
          highestBidUsdc: "150.00",
          highestBidSponsorPaysUsdc: "157.50",
          leaderName: "Kopi Labs",
          reserveMet: false,
          nextMinimumBidUsdc: "157.50",
          biddingEndsAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
        }),
      };
    }
    if (i === 7) {
      return {
        ...p,
        ...opening,
        offers: bids({
          bidCount: 1,
          highestBidUsdc: "100.00",
          highestBidSponsorPaysUsdc: "105.00",
          leaderName: "Orbit",
          biddingOpen: false,
          biddingEndsAt: new Date(Date.now() - HOUR).toISOString(),
        }),
      };
    }
    return { ...p, ...opening, offers: bids({}) };
  });
  return {
    ...base,
    id: "44444444-4444-4444-8444-444444444444",
    slug: "token2049-bids",
    title: "Bid for my TOKEN2049 suitcase",
    pricingMode: "bids",
    biddingEndsAt: ends,
    positions,
    share: { url: "https://hihodl.xyz/s/coinempress/token2049-bids", text: "Bid for my suitcase" },
    siblings: [],
  };
}

/** The suitcase with no prices: every open spot takes offers. */
function offersBoard(): Space {
  const base = suitcase();
  return {
    ...base,
    id: "55555555-5555-4555-8555-555555555555",
    slug: "token2049-offers",
    title: "Make me an offer: TOKEN2049 suitcase",
    pricingMode: "offers",
    positions: base.positions.map((p, i) =>
      p.status === "sold"
        ? { ...p, offers: { ...NO_OFFERS } }
        : {
            ...p,
            priceCents: null,
            sponsorPaysUsdc: null,
            creatorReceivesUsdc: null,
            offers: {
              ...NO_OFFERS,
              openCount: i % 3,
              reservedUntil: p.status === "held" ? new Date(Date.now() + 18 * HOUR).toISOString() : null,
            },
          },
    ),
    share: { url: "https://hihodl.xyz/s/coinempress/token2049-offers", text: "Make me an offer" },
    siblings: [],
  };
}

/** The video slots at a fixed price that also takes offers, on the space. */
function videosWithOffers(): Space {
  const base = videos();
  return {
    ...base,
    id: "66666666-6666-4666-8666-666666666666",
    slug: "token2049-videos-offers",
    acceptsOffers: true,
    spaceOffers: { ...NO_OFFERS, mode: "fixed_with_offers", openCount: 3 },
    siblings: [],
  };
}

function offersFixtures(): Space[] {
  return [bidsBoard(), offersBoard(), videosWithOffers()];
}

/** A fixture offer's token: a 43-character name, so it passes the real token check. */
function fixtureToken(name: string): string {
  return `fixture_${name}`.padEnd(43, "x");
}

export function fixtureOffer(token: string): OfferThread | null {
  const names = ["pending", "countered", "accepted", "paid", "declined", "expired", "bid_leading", "bid_outbid", "videos_accepted"];
  const name = names.find((n) => fixtureToken(n) === token);
  if (!name) return null;
  const bid = name.startsWith("bid_");
  const space = bid ? bidsBoard() : name.startsWith("videos") ? videosWithOffers() : offersBoard();
  const position = bid ? space.positions[1] : name.startsWith("videos") ? space.positions[2] : space.positions[1];
  const at = (h: number) => new Date(Date.now() - h * HOUR).toISOString();
  const status: OfferView["status"] =
    name === "bid_leading" || name === "bid_outbid" ? "pending" : name === "videos_accepted" ? "accepted" : (name as OfferView["status"]);
  const accepted = status === "accepted" || status === "paid";
  const rounds: OfferView["rounds"] =
    name === "pending" || bid
      ? [{ by: "sponsor", amountUsdc: bid ? "420.00" : "300.00", at: at(5) }]
      : [
          { by: "sponsor", amountUsdc: "300.00", at: at(30) },
          { by: "auto", amountUsdc: "350.00", at: at(30) },
          ...(status === "countered" ? [] : [{ by: "sponsor" as const, amountUsdc: "350.00", at: at(4) }]),
        ];
  const offer: OfferView = {
    id: "0f000000-0000-4000-8000-000000000001",
    spaceId: space.id,
    positionId: position.id,
    positionLabel: position.label,
    kind: bid ? "bid" : "offer",
    status,
    amountUsdc: bid ? (name === "bid_leading" ? "420.00" : "380.00") : status === "countered" || name === "pending" ? "300.00" : "350.00",
    sponsorPaysUsdc: bid ? (name === "bid_leading" ? "441.00" : "399.00") : status === "countered" || name === "pending" ? "315.00" : "367.50",
    counterUsdc: status === "countered" ? "350.00" : null,
    counterSponsorPaysUsdc: status === "countered" ? "367.50" : null,
    agreedUsdc: accepted ? "350.00" : null,
    agreedSponsorPaysUsdc: accepted ? "367.50" : null,
    rounds,
    countersLeft: 2,
    sponsor: {
      name: "Acme",
      contactKind: "email",
      contactValue: "team@acme.xyz",
      message: "We launch on day 2 and would love the front of the suitcase.",
      via: "web",
      backed: bid || name === "accepted" ? { chain: "solana", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", checkedAt: at(5) } : null,
    },
    declineReason: status === "declined" ? "too_low" : null,
    expiresAt:
      status === "pending" || status === "countered"
        ? new Date(Date.now() + 40 * HOUR).toISOString()
        : status === "accepted"
          ? new Date(Date.now() + 20 * HOUR).toISOString()
          : null,
    orderId: status === "paid" ? "0e000000-0000-4000-8000-000000000009" : null,
    leading: bid ? name === "bid_leading" : null,
    createdAt: at(30),
    updatedAt: at(4),
  };
  return {
    offer,
    space: {
      id: space.id,
      path: `/s/coinempress/${space.slug}`,
      title: space.title,
      templateName: space.template.name,
      pricingMode: space.pricingMode,
      status: space.status,
      closesAt: space.closesAt,
      creator: { xHandle: space.creator.xHandle, xName: space.creator.xName, xAvatarUrl: null },
      event: space.event,
    },
    position,
  };
}

export function fixtureSpace(handle: string, slug: string): Space | null {
  if (handle === "id")
    return (
      [suitcase(), videos(), takeovers(), pitchReviews(), customService(), eventCoverage(), ...offersFixtures()].find(
        (s) => s.id === slug,
      ) ?? null
    );
  if (handle.toLowerCase() === "coinempress") {
    const offered = offersFixtures().find((s) => s.slug === slug);
    if (offered) return offered;
    if (slug === "road-to-token2049") return suitcase();
    if (slug === "token2049-videos") return videos();
    if (slug === "token2049-takeover") return takeovers();
    if (slug === "token2049-pitch-reviews") return pitchReviews();
    if (slug === "token2049-afterparty-host") return customService();
    if (slug === "breakpoint-london-coverage") return eventCoverage();
  }
  const path = `/s/${handle.toLowerCase()}/${slug}`;
  for (const [event, tabs] of [
    [TOKEN2049, token2049Tabs()],
    [DEVCON, devconTabs()],
  ] as const) {
    const all = [...tabs.ground, ...tabs.feed, ...tabs.room];
    const hit = all.find((c) => c.path.toLowerCase() === path);
    if (hit) return fromCard(hit, event, all);
  }
  return null;
}

/* ── Bookings ────────────────────────────────────────────────────────── */

const HOUR = 60 * 60 * 1000;

function sessionFor(state: SessionState, confirmByPast = false): SessionView {
  const contact = state === "awaiting_contact" ? null : { kind: "telegram" as const, value: "@dana_builds" };
  const brief =
    state === "awaiting_contact" ? null : "We launch on day 2 and want the deck reviewed before the demo stage.";
  const scheduled = state !== "awaiting_contact" && state !== "awaiting_schedule";
  const sessionAt = !scheduled
    ? null
    : state === "scheduled"
      ? new Date(Date.now() + 21 * DAY + 10 * HOUR).toISOString()
      : new Date(Date.now() - (confirmByPast ? 9 : 1) * DAY).toISOString();
  const answered = state === "delivered" || state === "disputed" || state === "awaiting_confirmation";
  return {
    contact,
    brief,
    sessionAt,
    sessionPlace: scheduled ? "TOKEN2049 venue, Level 4 lounge" : null,
    event: { startsOn: TOKEN2049.startsOn, endsOn: TOKEN2049.endsOn, timeZone: TOKEN2049.timeZone ?? null },
    state,
    confirmBy:
      answered && sessionAt ? new Date(Date.parse(sessionAt) + 7 * DAY).toISOString() : null,
    disputeNote: state === "disputed" ? "Nobody came to the lounge at the time we agreed." : null,
    creatorReply: state === "disputed" ? "I was there from 10:00 to 10:40. Happy to do it again tomorrow." : null,
  };
}

export function fixtureBooking(token: string): Booking | null {
  const states: Record<string, [SessionState, boolean]> = {
    fixture_awaiting_contact: ["awaiting_contact", false],
    fixture_awaiting_schedule: ["awaiting_schedule", false],
    fixture_scheduled: ["scheduled", false],
    fixture_awaiting_confirmation: ["awaiting_confirmation", false],
    fixture_delivered: ["delivered", false],
    fixture_disputed: ["disputed", false],
    fixture_window_closed: ["awaiting_confirmation", true],
    fixture_no_handle: ["scheduled", false],
  };
  const hit = states[token];
  if (!hit) return null;
  const space = pitchReviews();
  const position = space.positions[0];
  // The server can name no handle, path, template or slot: the page must still read.
  const bare = token === "fixture_no_handle";
  return {
    order: {
      id: "0e000000-0000-4000-8000-000000000001",
      positionId: position.id,
      spaceId: space.id,
      status: "paid",
      chain: "base",
      priceUsdc: "100.00",
      creatorReceivesUsdc: "100.00",
      feeUsdc: "5.00",
      sponsorPaysUsdc: "105.00",
      takeover: null,
      feeBps: 500,
      feePayer: "sponsor",
      creatorAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      feeAddress: "0x0000000000000000000000000000000000000001",
      sponsorAddress: "0x1111111111111111111111111111111111111111",
      reservedUntil: new Date(Date.now() - 3 * DAY).toISOString(),
      txSignature: "0xabc",
      paidAt: new Date(Date.now() - 3 * DAY).toISOString(),
      explorerUrl: "https://basescan.org/tx/0xabc",
      share: null,
      session: sessionFor(hit[0], hit[1]),
    },
    positionLabel: bare ? null : position.label,
    space: {
      id: space.id,
      path: bare ? null : "/s/coinempress/token2049-pitch-reviews",
      title: space.title,
      templateName: bare ? null : space.template.name,
      status: space.status,
      creator: { xHandle: bare ? null : space.creator.xHandle, xName: space.creator.xName, xAvatarUrl: null },
      event: space.event,
      fallback: space.fallback,
      fallbackNote: space.fallbackNote,
    },
  };
}
