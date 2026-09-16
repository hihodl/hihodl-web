/**
 * Development fixture for the public Ad Space page.
 *
 * Loaded only when `AD_SPACE_FIXTURE=1` and NODE_ENV is not production (see
 * `getPublicSpace`). The outlines and zones are copied from the backend
 * catalog (server/services/ad-space/catalog-data.ts) so the board renders the
 * real geometry. Two spaces:
 *   /s/coinempress/road-to-token2049   placement, carry-on suitcase
 *   /s/coinempress/token2049-videos    service, short-form video
 */

import type { Position, Space, TemplateZone } from "./types";

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
    sponsor: null,
    delivered: null,
    ...over,
  };
}

const DAY = 24 * 60 * 60 * 1000;

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
    venueType: "conference",
    eventName: "TOKEN2049 Singapore",
    fallback: "content_anyway",
    fallbackNote: "If the suitcase can't go in, it sits at the hotel lobby shoot instead.",
    attestations: ["owns_item", "venue_rules_checked"],
    requiredAttestations: ["owns_item", "venue_rules_checked"],
    deliverables: [
      { id: "d1", kind: "video", platform: "x", count: 1, dueDate: "2026-10-04", deliveredUrl: null, state: "upcoming" },
      { id: "d2", kind: "photo", platform: "x", count: 3, dueDate: "2026-10-09", deliveredUrl: null, state: "upcoming" },
      { id: "d3", kind: "post", platform: "x", count: 1, dueDate: "2026-09-12", deliveredUrl: "https://x.com/coinempress/status/1", state: "delivered" },
    ],
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
  };
}

export function fixtureSpace(handle: string, slug: string): Space | null {
  if (handle.toLowerCase() !== "coinempress") return null;
  if (slug === "road-to-token2049") return suitcase();
  if (slug === "token2049-videos") return videos();
  return null;
}
