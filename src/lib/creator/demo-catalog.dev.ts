/**
 * The Ad Space catalogue, copied from the backend.
 *
 * Source of truth: hihodl-backend `server/services/ad-space/catalog-data.ts`.
 * The demo answers `/ad-space/templates` from here, so "Pick your hook" offers
 * the products the real console offers and "Use this idea" on a dress lands on
 * the dress. Every id, name, kind, `allowedVenues`, `requiredAttestations`,
 * outline and zone is the backend's — nothing here is invented, and a product
 * that changes there is re-copied rather than edited here.
 *
 * The backend's own words, kept because they explain the data:
 *
 * Every product a creator can sell space on: its views, the empty outline the
 * app draws for each view (stroke only, blueprint style), the zones a logo can
 * go in, where the product may be used, and what the creator must declare
 * before publishing it.
 *
 * ── Coordinates ──
 * Each view has its own viewBox. Outline paths are in viewBox units. Zones are
 * FRACTIONS of the viewBox (0 to 1), so a zone lands in the same place on a
 * phone and on a 1200px web page.
 *
 * ── Policy lives here too ──
 * `allowedVenues` and `requiredAttestations` are read at publish. See the
 * backend's documentation/ad-space-policies.md for the reasoning.
 */
import type { ServiceFormat, TemplateKind, VenueType } from "./listing";

/** The backend's `Attestation`; the console only ever reads them as strings. */
type Attestation = string;

export interface CatalogView {
  key: string;
  label: string;
  /** The real object's size, for the "40 × 15 cm" a zone promises. */
  widthCm?: number;
  heightCm?: number;
  viewBox: [number, number];
  /** SVG path data, stroke only. */
  outline: string[];
}

export interface CatalogZone {
  zoneKey: string;
  label: string;
  viewKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sizeLabel: string;
  suggestedPriceCents: number;
}

/** What each slot of a service delivers, read by a sponsor before paying. */
export interface CatalogService {
  /** The kind of public link that delivers one slot; `in_person` for a session. */
  deliverableKind: "video" | "photo_post" | "story" | "in_person";
  /**
   * content — delivered by a public link the creator posts; tab `feed`.
   * session — the creator's time in person at an event, which leaves no link
   *           anybody can check, so the BUYER confirms it; tab `room`. See
   *           documentation/hispace-in-the-room-v0.md.
   * production — a package made FOR the brand's channels at an event,
   *           delivered by a private link the brand accepts; tab `feed`. See
   *           documentation/spaces-content-production-v0.md.
   * Lives in the `service` jsonb, synced at boot; a row without it is content.
   */
  format?: ServiceFormat;
  summary: string;
  /** Slots a creator may offer at once. */
  maxSlots: number;
  /** What the app pre-fills as the slot price. */
  suggestedPriceCents?: number;
  /**
   * Not a product of ours: the creator names the service and says what the
   * brand gets (`serviceName`, `serviceSummary` on the space), and the
   * template's name and summary only introduce the option. `custom-service`.
   */
  custom?: boolean;
}

export interface CatalogTemplate {
  id: string;
  productType: string;
  name: string;
  /** Placement unless stated: zones on a product. */
  kind?: TemplateKind;
  /** Services only; see CatalogService. */
  service?: CatalogService;
  sortOrder: number;
  active: boolean;
  allowedVenues: VenueType[];
  requiredAttestations: Attestation[];
  views: CatalogView[];
  zones: CatalogZone[];
}

/** A circle as path data, so every outline is one kind of thing. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/** A rounded rectangle as path data. */
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} H${x + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${y + h - r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} H${x + r} a${r} ${r} 0 0 1 ${-r} ${-r} V${y + r} a${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

/** The same zones on two views, keys prefixed by view. */
function mirrored(
  views: string[],
  zones: Array<Omit<CatalogZone, "zoneKey" | "viewKey" | "label"> & { key: string; name: string }>,
): CatalogZone[] {
  const out: CatalogZone[] = [];
  for (const view of views) {
    for (const z of zones) {
      out.push({
        zoneKey: `${view}-${z.key}`,
        label: `${view[0].toUpperCase()}${view.slice(1)} ${z.name}`,
        viewKey: view,
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        sizeLabel: z.sizeLabel,
        suggestedPriceCents: z.suggestedPriceCents,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------

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

// A daypack is drawn from the two sides a sticker is ever seen from: the face
// somebody walking behind you reads, and the profile somebody sitting next to
// you on the train reads. The back panel is against a back and never sold.
const BACKPACK_FRONT = [
  roundRect(14, 18, 72, 110, 14),
  "M42 18 q0 -9 8 -9 q8 0 8 9",
  "M14 46 Q50 54 86 46",
  "M24 50 V120 M76 50 V120",
  roundRect(26, 94, 48, 30, 5),
  "M26 99 H74",
];

const BACKPACK_SIDE = [
  roundRect(16, 18, 38, 110, 12),
  "M22 18 q0 -8 7 -8 q7 0 7 8",
  "M16 46 Q35 52 54 46",
  // The shoulder strap, two curves that read as one band.
  "M20 26 Q4 60 8 96 Q10 116 20 122",
  "M26 28 Q12 60 15 94 Q17 112 24 118",
  roundRect(40, 86, 12, 32, 4),
];

const BIKE = [
  circle(38, 70, 26),
  circle(38, 70, 22),
  circle(132, 70, 26),
  circle(132, 70, 22),
  // seat tube, top tube, down tube, head tube, fork, stays
  "M82 72 L72 30 L118 30 L121 42 L82 72 Z",
  "M121 42 L132 70",
  "M82 72 L38 70 L72 30",
  circle(82, 72, 4),
  "M72 30 V25 M63 25 H80",
  "M118 30 L122 23 H130 q6 0 6 6 v4",
];

// A car is the only product here nobody can hold, so it is drawn the way a
// wrap shop quotes one: the profile, the tail, and the plan from above. The
// silhouette climbs over the roof and the beltline closes the glass, which is
// why the windows are a chord and not a second shape floating inside.
const CAR_SIDE = [
  // The sill turns up and over each arch, so the wheels sit in the body
  // instead of under it — the difference between a car and a car on a trailer.
  "M12 50 Q12 38 26 34 L58 30 L84 13 L124 13 L168 32 L186 36 Q192 39 192 48 V56 " +
    "H170 A14 14 0 0 0 142 56 H60 A14 14 0 0 0 32 56 H12 Z",
  "M58 30 L168 32",
  "M112 13 V30",
  "M62 30 V56 M110 30 V56 M142 31 V56",
  "M80 33 H90 M124 33 H132",
  circle(46, 56, 12),
  circle(46, 56, 5),
  circle(156, 56, 12),
  circle(156, 56, 5),
];

const CAR_REAR = [
  "M38 8 H92 L110 34 V78 Q110 84 104 84 H26 Q20 84 20 78 V34 Z",
  "M42 14 H88 L100 34 H30 Z",
  "M24 36 H106",
  "M22 38 H42 L40 50 H22 Z",
  "M108 38 H88 L90 50 H108 Z",
  roundRect(52, 56, 26, 12, 2),
  "M20 70 H110",
];

// From above, nose at the top: bonnet, windscreen, roof, rear screen, boot.
const CAR_TOP = [
  "M20 8 Q40 4 60 8 L70 46 V150 L60 192 Q40 196 20 192 L10 150 V46 Z",
  "M14 58 H66",
  "M16 62 H64 L60 80 H20 Z",
  "M20 82 H60 V126 H20 Z",
  "M20 128 H60 L64 146 H16 Z",
  "M14 150 H66",
  "M10 66 H2 V74 H10",
  "M70 66 H78 V74 H70",
];

const PHONE_CASE = [
  roundRect(8, 4, 44, 112, 9),
  roundRect(12, 8, 18, 20, 5),
  circle(17, 14, 2.6),
  circle(25, 14, 2.6),
  circle(17, 22, 2.6),
];

// ── The one surface that redraws itself ──
// A sticker is fixed at print time; a wallpaper is a file. The QR in the
// middle is drawn as part of the phone, not sold as a spot, because it is the
// creator's own link back to the space — somebody who likes what they see on
// the screen can reach the board that sells it. Everything for sale sits
// around it: two above, five down each side.
const PHONE_SCREEN = [
  roundRect(2, 2, 56, 126, 8),
  roundRect(5, 6, 50, 118, 5),
  // The island, which is what says "this is the screen and not the back".
  roundRect(24, 9, 12, 3.5, 1.75),
  // The QR, drawn as a QR rather than as an empty square.
  roundRect(21, 52, 18, 18, 1),
  roundRect(23.5, 54.5, 4, 4, 0.6),
  roundRect(32.5, 54.5, 4, 4, 0.6),
  roundRect(23.5, 63.5, 4, 4, 0.6),
  roundRect(30, 61, 2, 2, 0.3),
  roundRect(34, 64, 2, 2, 0.3),
  roundRect(31, 66, 2, 2, 0.3),
];

const PHONE_BACK = [
  roundRect(2, 2, 56, 126, 8),
  roundRect(6, 6, 20, 22, 5),
  circle(12, 12, 2.8),
  circle(20, 12, 2.8),
  circle(12, 21, 2.8),
];

const LAPTOP_LID = [roundRect(12, 8, 116, 76, 6), "M4 88 H136 L132 93 H8 Z"];

const DRESS_FRONT = ["M27 22 Q40 17 53 22 L51 58 Q55 104 61 152 L19 152 Q25 104 29 58 Z"];
const DRESS_BACK = [...DRESS_FRONT, "M40 21 V60"];

const BLAZER_BODY =
  "M38 12 Q50 9 62 12 L80 18 Q86 20 87 28 L92 72 L82 74 L77 38 L76 110 L24 110 L23 38 L18 74 L8 72 L13 28 Q14 20 20 18 Z";
const BLAZER_FRONT = [BLAZER_BODY, "M42 12 L50 46 L58 12", "M50 46 V110", "M28 82 H42 M58 82 H72 M60 32 H70"];
const BLAZER_BACK = [BLAZER_BODY, "M50 12 V110", "M46 110 V98 M54 110 V98"];

const JACKET_BODY =
  "M36 12 Q50 9 64 12 L82 18 Q88 21 88 30 L92 78 L82 80 L78 40 L78 100 L22 100 L22 40 L18 80 L8 78 L12 30 Q12 21 18 18 Z";
const JACKET_FRONT = [
  JACKET_BODY,
  "M36 12 L44 22 L50 14 L56 22 L64 12",
  "M50 22 V100",
  "M28 40 H42 V50 H28 Z M58 40 H72 V50 H58 Z",
  "M22 92 H78",
];
const JACKET_BACK = [JACKET_BODY, "M22 34 H78", "M22 92 H78"];

const TOTE = ["M14 38 H66 L63 94 H17 Z", "M28 38 Q28 10 40 10 Q52 10 52 38", "M33 38 Q33 16 40 16 Q47 16 47 38"];

const TRISUIT =
  "M28 10 Q40 6 52 10 L64 16 L67 32 L58 35 L56 26 L57 84 L61 120 L45 120 L40 92 L35 120 L19 120 L23 84 L24 26 L22 35 L13 32 L16 16 Z";
const TRISUIT_FRONT = [TRISUIT, "M34 9 Q40 14 46 9", "M40 12 V40"];
const TRISUIT_BACK = [TRISUIT, "M34 9 Q40 12 46 9"];
const HELMET_SIDE = ["M8 44 Q10 12 50 8 Q88 8 94 34 Q80 40 60 42 Q30 48 8 44 Z", "M30 18 Q50 12 70 18"];
const HELMET_FRONT = ["M8 46 Q8 8 30 8 Q52 8 52 46 Q30 40 8 46 Z", "M14 40 Q30 34 46 40"];

const TSHIRT_BODY = "M36 8 Q50 14 64 8 L86 18 L96 40 L80 46 L76 36 L76 104 L24 104 L24 36 L20 46 L4 40 L14 18 Z";
const TSHIRT_FRONT = [TSHIRT_BODY, "M36 8 Q50 20 64 8"];
const TSHIRT_BACK = [TSHIRT_BODY, "M36 8 Q50 12 64 8"];

const CAP_FRONT = ["M14 50 Q14 12 50 10 Q86 12 86 50 Z", "M8 50 H92 Q94 58 86 60 H14 Q6 58 8 50 Z", "M50 10 V50", circle(50, 10, 2)];
const CAP_SIDE = ["M10 50 Q12 12 52 10 Q84 12 88 50 Z", "M88 50 Q98 50 98 56 Q98 60 90 60 L70 58 Q76 54 88 50", circle(52, 10, 2)];
const CAP_BACK = ["M14 50 Q14 12 50 10 Q86 12 86 50 Z", "M38 50 Q38 40 50 40 Q62 40 62 50", "M50 10 V40"];

// A whole person, drawn once and worn by both views. The figure is female
// because most of the creators selling this are, and it is drawn head to foot
// because a spot on a forearm or a calf has nowhere to live on a cropped
// torso. Arms hang a little away from the body so the forearm reads as its own
// limb and not as an edge of the hips.
const BODY =
  "M45 32 V45 Q36 46 24 54 Q18 62 19 76 L17.5 126 L17.8 134 Q18 141 22 141 Q26 141 26.2 134 " +
  "L24.5 126 L30 76 Q32 84 32 96 Q32 114 26.5 130 Q27 150 33 167 Q30.5 190 37 217 " +
  "L35.5 224 Q35.5 227 39 227 L45.5 227 Q47 227 46.5 224 L44.5 217 Q46.5 190 45 167 L48 128 " +
  "Q50 131 52 128 L55 167 Q53.5 190 55.5 217 L53.5 224 Q53 227 54.5 227 L61 227 Q64.5 227 64.5 224 " +
  "L63 217 Q69.5 190 67 167 Q73 150 73.5 130 Q68 114 68 96 Q68 84 70 76 L75.5 126 " +
  "L73.8 134 Q74 141 78 141 Q82 141 82.2 134 L82.5 126 L81 76 Q82 62 76 54 Q64 46 55 45 V32";
// No face: this is a mannequin a creator maps positions onto, not a portrait
// of anybody. The hair is up, which is both how people train and the only way
// the upper back can stay a position on the back view.
const HEAD = ["M50 9 a9.5 13 0 0 1 0 26 a9.5 13 0 0 1 0 -26", circle(50, 6.5, 4.5)];

// The sports top: straps over the shoulders, a scooped neckline that stops
// well below the collarbones, and a hem at the ribs. Drawn closed, as its own
// shape, so the chest reads as covered at a glance and nobody has to take our
// word for where the skin is.
const SPORTS_TOP_FRONT =
  "M27 55 L33 52 Q33.5 60 35 66 Q42 73 50 73 Q58 73 65 66 Q66.5 60 67 52 L73 55 L70 76 L68.1 90 H31.9 L30 76 Z";
// The same top from behind is a rib band and two straps, which is how sports
// tops are cut and which is why the upper back survives as a position.
const SPORTS_TOP_BACK = ["M30.4 78 H69.6 L68.1 90 H31.9 Z", "M27 55 L33 52 L35 78 H30.4 Z", "M73 55 L67 52 L65 78 H69.6 Z"];

// Mid-thigh shorts, hemmed above the knee so the lower thigh stays open.
const SHORTS = [
  "M30.8 112 H69.2 L73.5 130 L71.8 148 H53.6 L52 130 Q50 132.5 48 130 L46.4 148 H28.2 L26.5 130 Z",
  // A waistband and a side seam on each leg: without them the shorts read as
  // two stray lines across the legs instead of a garment.
  "M30.5 118 H69.5",
  "M31 118 L29.3 147",
  "M69 118 L70.7 147",
];
// Both views are the same body in the same clothes; only the cut of the top
// and the hairline tell them apart, which is the point — a sponsor comparing
// the two is comparing places on one person, not two drawings.
const BODY_FRONT = [BODY, ...HEAD, "M41 22 Q44 14 50 14 Q56 14 59 22", SPORTS_TOP_FRONT, ...SHORTS];
const BODY_BACK = [BODY, ...HEAD, "M43 30 Q50 36 57 30", ...SPORTS_TOP_BACK, ...SHORTS, "M50 119 V129"];

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

const EVERYWHERE: VenueType[] = ["travel", "conference", "sports_event", "private_event", "everyday"];

/**
 * A service: N identical slots, no drawing. Each slot is one sponsor's own
 * piece of content, delivered with its own public link — the only kind of
 * service in the catalog, which is what keeps paid calls, "alpha" and anything
 * without a public proof of delivery out of it by construction.
 */
function service(
  id: string,
  name: string,
  sortOrder: number,
  s: CatalogService,
  allowedVenues: VenueType[] = EVERYWHERE,
): CatalogTemplate {
  return {
    id,
    productType: "service",
    name,
    kind: "service",
    service: { ...s, format: "content" },
    sortOrder,
    active: true,
    allowedVenues,
    requiredAttestations: ["discloses_sponsorship"],
    views: [],
    zones: [],
  };
}

/** Where time in person is sold: at an event, never at somebody's party. */
const AT_AN_EVENT: VenueType[] = ["conference", "sports_event", "travel"];

/**
 * A session: the creator's own time at an event, sold by the slot. A closed
 * list of professional formats, and closed on purpose. What is NOT here is the
 * point of the list: introductions to investors (broker or finder work, a
 * lawyer decides before it is ever added), investment advice or calls, anything
 * meeting in private, and a generic "meet me". Every one publishes only with
 * the three declarations that keep it that way, and only linked to an event.
 */
function session(
  id: string,
  name: string,
  sortOrder: number,
  s: { summary: string; maxSlots: number; suggestedPriceCents: number },
  active = true,
): CatalogTemplate {
  return {
    id,
    productType: "session",
    name,
    kind: "service",
    service: { deliverableKind: "in_person", format: "session", ...s },
    sortOrder,
    active,
    allowedVenues: AT_AN_EVENT,
    requiredAttestations: ["public_place", "no_investment_advice", "no_investor_intros"],
    views: [],
    zones: [],
  };
}

/**
 * Content production: the creator films and edits a package for the brand's
 * own channels at an event, sold as N limited spots. Event-only, like a
 * session, because the shoot window IS the event's dates. It declares the ad
 * label (the creator often posts it too) and no investment advice, which it
 * shares with sessions.
 */
function production(
  id: string,
  name: string,
  sortOrder: number,
  s: { summary: string; maxSlots: number; suggestedPriceCents: number },
): CatalogTemplate {
  return {
    id,
    productType: "production",
    name,
    kind: "service",
    service: { deliverableKind: "video", format: "production", ...s },
    sortOrder,
    active: true,
    allowedVenues: AT_AN_EVENT,
    requiredAttestations: ["discloses_sponsorship", "no_investment_advice"],
    views: [],
    zones: [],
  };
}

export const CATALOG: CatalogTemplate[] = [
  {
    id: "carry-on-suitcase",
    productType: "luggage",
    name: "Carry-on suitcase",
    sortOrder: 10,
    active: true,
    allowedVenues: ["travel", "conference", "everyday"],
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", widthCm: 47, heightCm: 66, viewBox: [100, 140], outline: SUITCASE_FACE },
      { key: "back", label: "Back", widthCm: 47, heightCm: 66, viewBox: [100, 140], outline: SUITCASE_FACE },
      { key: "left", label: "Left", widthCm: 28, heightCm: 66, viewBox: [60, 140], outline: SUITCASE_SIDE },
      { key: "right", label: "Right", widthCm: 28, heightCm: 66, viewBox: [60, 140], outline: SUITCASE_SIDE },
    ],
    zones: [
      ...mirrored(["front", "back"], [
        { key: "headline", name: "headline", x: 0.2, y: 0.257, w: 0.6, h: 0.129, sizeLabel: "40 × 15 cm", suggestedPriceCents: 50000 },
        { key: "upper-left", name: "upper left", x: 0.2, y: 0.429, w: 0.28, h: 0.157, sizeLabel: "17 × 12 cm", suggestedPriceCents: 20000 },
        { key: "upper-right", name: "upper right", x: 0.52, y: 0.429, w: 0.28, h: 0.157, sizeLabel: "17 × 12 cm", suggestedPriceCents: 20000 },
        { key: "lower-left", name: "lower left", x: 0.2, y: 0.629, w: 0.28, h: 0.157, sizeLabel: "17 × 12 cm", suggestedPriceCents: 17500 },
        { key: "lower-right", name: "lower right", x: 0.52, y: 0.629, w: 0.28, h: 0.157, sizeLabel: "17 × 12 cm", suggestedPriceCents: 17500 },
      ]),
      ...mirrored(["left", "right"], [
        { key: "upper-left", name: "side upper left", x: 0.333, y: 0.6, w: 0.15, h: 0.079, sizeLabel: "10 × 10 cm", suggestedPriceCents: 12500 },
        { key: "upper-right", name: "side upper right", x: 0.517, y: 0.6, w: 0.15, h: 0.079, sizeLabel: "10 × 10 cm", suggestedPriceCents: 12500 },
        { key: "lower-left", name: "side lower left", x: 0.333, y: 0.707, w: 0.15, h: 0.079, sizeLabel: "10 × 10 cm", suggestedPriceCents: 12500 },
        { key: "lower-right", name: "side lower right", x: 0.517, y: 0.707, w: 0.15, h: 0.079, sizeLabel: "10 × 10 cm", suggestedPriceCents: 12500 },
      ]),
    ],
  },
  {
    id: "backpack",
    productType: "luggage",
    name: "Backpack",
    sortOrder: 15,
    active: true,
    // Same three as the suitcase: it is the bag that goes to the airport, into
    // the conference and out on a commute, and it is the commute that sells it.
    allowedVenues: ["travel", "conference", "everyday"],
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", widthCm: 30, heightCm: 46, viewBox: [100, 140], outline: BACKPACK_FRONT },
      { key: "side", label: "Side", widthCm: 20, heightCm: 46, viewBox: [70, 140], outline: BACKPACK_SIDE },
    ],
    // Nine spots, which is what the listings that sell are: one face worth
    // paying for and eight stickers around it. The two gussets and the four
    // side positions are deliberately cheap — they are sticker money, and a
    // creator who prices them like the face sells none of them.
    zones: [
      { zoneKey: "front-panel", label: "Front panel", viewKey: "front", x: 0.28, y: 0.4, w: 0.44, h: 0.23, sizeLabel: "13 × 10 cm", suggestedPriceCents: 25000 },
      { zoneKey: "front-lid", label: "Lid, top pocket", viewKey: "front", x: 0.3, y: 0.17, w: 0.4, h: 0.115, sizeLabel: "12 × 5 cm", suggestedPriceCents: 12000 },
      { zoneKey: "front-pocket", label: "Front pocket", viewKey: "front", x: 0.3, y: 0.72, w: 0.4, h: 0.145, sizeLabel: "12 × 7 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-gusset-left", label: "Gusset, left", viewKey: "front", x: 0.155, y: 0.45, w: 0.08, h: 0.1, sizeLabel: "3 × 4.5 cm", suggestedPriceCents: 5000 },
      { zoneKey: "front-gusset-right", label: "Gusset, right", viewKey: "front", x: 0.765, y: 0.45, w: 0.08, h: 0.1, sizeLabel: "3 × 4.5 cm", suggestedPriceCents: 5000 },
      // One side view, two real sides: a sticker here goes on both, the way the
      // bike frame sells a tube.
      { zoneKey: "side-upper", label: "Side panel, upper", viewKey: "side", x: 0.31, y: 0.38, w: 0.26, h: 0.15, sizeLabel: "both sides", suggestedPriceCents: 9000 },
      { zoneKey: "side-lower", label: "Side panel, lower", viewKey: "side", x: 0.31, y: 0.58, w: 0.26, h: 0.15, sizeLabel: "both sides", suggestedPriceCents: 7000 },
      { zoneKey: "side-pocket", label: "Side pocket", viewKey: "side", x: 0.59, y: 0.65, w: 0.15, h: 0.13, sizeLabel: "both sides", suggestedPriceCents: 6000 },
      { zoneKey: "side-strap", label: "Shoulder strap", viewKey: "side", x: 0.122, y: 0.46, w: 0.082, h: 0.11, sizeLabel: "both straps", suggestedPriceCents: 6000 },
    ],
  },
  {
    id: "laptop-lid",
    productType: "tech",
    name: "Laptop",
    sortOrder: 20,
    active: true,
    allowedVenues: ["travel", "conference", "everyday"],
    requiredAttestations: [],
    views: [{ key: "lid", label: "Lid", widthCm: 31, heightCm: 22, viewBox: [140, 100], outline: LAPTOP_LID }],
    zones: [
      { zoneKey: "lid-center", label: "Lid centre", viewKey: "lid", x: 0.393, y: 0.32, w: 0.214, h: 0.28, sizeLabel: "7 × 6 cm", suggestedPriceCents: 25000 },
      { zoneKey: "lid-top-left", label: "Lid top left", viewKey: "lid", x: 0.143, y: 0.16, w: 0.186, h: 0.18, sizeLabel: "6 × 4 cm", suggestedPriceCents: 10000 },
      { zoneKey: "lid-top-right", label: "Lid top right", viewKey: "lid", x: 0.671, y: 0.16, w: 0.186, h: 0.18, sizeLabel: "6 × 4 cm", suggestedPriceCents: 10000 },
      { zoneKey: "lid-bottom-left", label: "Lid bottom left", viewKey: "lid", x: 0.143, y: 0.58, w: 0.186, h: 0.18, sizeLabel: "6 × 4 cm", suggestedPriceCents: 7500 },
      { zoneKey: "lid-bottom-right", label: "Lid bottom right", viewKey: "lid", x: 0.671, y: 0.58, w: 0.186, h: 0.18, sizeLabel: "6 × 4 cm", suggestedPriceCents: 7500 },
    ],
  },
  {
    id: "phone-case",
    productType: "tech",
    name: "Phone case",
    sortOrder: 30,
    // Retired, never deleted: "Phone wallpaper and back" carries these three
    // spots and the screen as well, and nobody selling a phone wants to choose
    // between the two halves of the same phone. Spaces already built on it keep
    // working — `getTemplate` reads a retired row, only `listTemplates` hides it.
    active: false,
    allowedVenues: EVERYWHERE,
    requiredAttestations: [],
    views: [{ key: "back", label: "Back", widthCm: 7.5, heightCm: 15, viewBox: [60, 120], outline: PHONE_CASE }],
    zones: [
      { zoneKey: "back-center", label: "Centre", viewKey: "back", x: 0.233, y: 0.367, w: 0.533, h: 0.217, sizeLabel: "4 × 3 cm", suggestedPriceCents: 7500 },
      { zoneKey: "back-lower", label: "Lower", viewKey: "back", x: 0.233, y: 0.633, w: 0.533, h: 0.167, sizeLabel: "4 × 2.5 cm", suggestedPriceCents: 5000 },
      { zoneKey: "back-corner", label: "Next to the camera", viewKey: "back", x: 0.567, y: 0.083, w: 0.233, h: 0.117, sizeLabel: "2 × 2 cm", suggestedPriceCents: 2500 },
    ],
  },
  {
    // ── Why a wallpaper is a product and not a joke ──
    // The cheapest surface anybody owns. No printing, no stickers, nothing to
    // post: a creator can be selling ten minutes after they decide to, which
    // makes it the first space most of them will ever publish. It is also the
    // only thing in this catalog that REDRAWS itself — a suitcase is fixed the
    // moment it is printed, a wallpaper changes the moment a spot sells — so
    // the board a sponsor buys into is the board everyone actually sees.
    //
    // Worn for the length of a conference, which is how the listings that
    // invented this describe it: "on my phone's wallpaper and back for two
    // weeks during the conference".
    id: "phone-wallpaper",
    productType: "tech",
    name: "Phone wallpaper and back",
    sortOrder: 28,
    active: true,
    allowedVenues: EVERYWHERE,
    requiredAttestations: [],
    views: [
      // The screen is measured in pixels, because what is delivered is a file.
      // The centimetres are the phone's, so the two views sit at one scale.
      { key: "screen", label: "Wallpaper", widthCm: 7.8, heightCm: 16, viewBox: [60, 130], outline: PHONE_SCREEN },
      { key: "back", label: "Back", widthCm: 7.8, heightCm: 16, viewBox: [60, 130], outline: PHONE_BACK },
    ],
    zones: [
      // Above the QR: the two everybody looks at, because the eye lands there
      // on the way to the code.
      { zoneKey: "screen-top-left", label: "Above the code, left", viewKey: "screen", x: 0.2, y: 0.292, w: 0.267, h: 0.069, sizeLabel: "340 \u00d7 190 px", suggestedPriceCents: 7500 },
      { zoneKey: "screen-top-right", label: "Above the code, right", viewKey: "screen", x: 0.533, y: 0.292, w: 0.267, h: 0.069, sizeLabel: "340 \u00d7 190 px", suggestedPriceCents: 7500 },
      { zoneKey: "screen-left-1", label: "Left column, 1", viewKey: "screen", x: 0.108, y: 0.4, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-left-2", label: "Left column, 2", viewKey: "screen", x: 0.108, y: 0.477, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-left-3", label: "Left column, 3", viewKey: "screen", x: 0.108, y: 0.554, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-left-4", label: "Left column, 4", viewKey: "screen", x: 0.108, y: 0.631, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-left-5", label: "Left column, 5", viewKey: "screen", x: 0.108, y: 0.708, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-right-1", label: "Right column, 1", viewKey: "screen", x: 0.692, y: 0.4, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-right-2", label: "Right column, 2", viewKey: "screen", x: 0.692, y: 0.477, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-right-3", label: "Right column, 3", viewKey: "screen", x: 0.692, y: 0.554, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-right-4", label: "Right column, 4", viewKey: "screen", x: 0.692, y: 0.631, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      { zoneKey: "screen-right-5", label: "Right column, 5", viewKey: "screen", x: 0.692, y: 0.708, w: 0.2, h: 0.062, sizeLabel: "260 \u00d7 170 px", suggestedPriceCents: 4000 },
      // The back is a sticker again, so it is measured in centimetres.
      { zoneKey: "back-by-the-camera", label: "Next to the camera", viewKey: "back", x: 0.567, y: 0.062, w: 0.3, h: 0.092, sizeLabel: "2.5 \u00d7 1.5 cm", suggestedPriceCents: 2500 },
      { zoneKey: "back-upper", label: "Back upper", viewKey: "back", x: 0.2, y: 0.277, w: 0.6, h: 0.138, sizeLabel: "4.5 \u00d7 2 cm", suggestedPriceCents: 5000 },
      { zoneKey: "back-middle", label: "Back middle", viewKey: "back", x: 0.2, y: 0.477, w: 0.6, h: 0.138, sizeLabel: "4.5 \u00d7 2 cm", suggestedPriceCents: 5000 },
      { zoneKey: "back-lower", label: "Back lower", viewKey: "back", x: 0.2, y: 0.677, w: 0.6, h: 0.138, sizeLabel: "4.5 \u00d7 2 cm", suggestedPriceCents: 5000 },
    ],
  },
  {
    id: "road-bike",
    productType: "sports",
    name: "Bike frame",
    sortOrder: 40,
    active: true,
    allowedVenues: ["sports_event", "travel", "everyday"],
    requiredAttestations: [],
    views: [{ key: "side", label: "Side", widthCm: 170, heightCm: 100, viewBox: [170, 100], outline: BIKE }],
    zones: [
      { zoneKey: "down-tube-lower", label: "Down tube, lower half", viewKey: "side", x: 0.506, y: 0.55, w: 0.094, h: 0.15, sizeLabel: "both sides", suggestedPriceCents: 40000 },
      { zoneKey: "down-tube-upper", label: "Down tube, upper half", viewKey: "side", x: 0.6, y: 0.4, w: 0.088, h: 0.15, sizeLabel: "both sides", suggestedPriceCents: 30000 },
      { zoneKey: "top-tube", label: "Top tube", viewKey: "side", x: 0.47, y: 0.26, w: 0.19, h: 0.08, sizeLabel: "both sides", suggestedPriceCents: 20000 },
      { zoneKey: "seat-tube", label: "Seat tube", viewKey: "side", x: 0.418, y: 0.38, w: 0.059, h: 0.22, sizeLabel: "both sides", suggestedPriceCents: 17500 },
      { zoneKey: "fork", label: "Fork blades", viewKey: "side", x: 0.718, y: 0.45, w: 0.059, h: 0.21, sizeLabel: "both sides", suggestedPriceCents: 17500 },
      { zoneKey: "head-tube", label: "Head tube", viewKey: "side", x: 0.69, y: 0.26, w: 0.05, h: 0.13, sizeLabel: "front on", suggestedPriceCents: 12500 },
    ],
  },
  {
    id: "car",
    // Nothing in the catalog fits: a car is not luggage, not worn and not
    // sports kit. It is the first of its own type, and the type is the point —
    // it is the only surface here that is read by strangers who never chose to
    // look at it, which is why the panels carry the prices they do.
    productType: "vehicle",
    name: "Car",
    sortOrder: 45,
    active: true,
    // A wrapped car is seen from the street and the next lane, and it can sit
    // in a paddock or a start village. It never goes inside a conference hall,
    // and turning up to somebody's wedding in a sponsored car is their day,
    // not the creator's, so neither venue is offered.
    allowedVenues: ["everyday", "travel", "sports_event"],
    requiredAttestations: [],
    views: [
      { key: "side", label: "Side", widthCm: 470, heightCm: 145, viewBox: [200, 70], outline: CAR_SIDE },
      { key: "rear", label: "Rear", widthCm: 185, heightCm: 142, viewBox: [130, 100], outline: CAR_REAR },
      { key: "top", label: "Bonnet and roof", widthCm: 185, heightCm: 470, viewBox: [80, 200], outline: CAR_TOP },
    ],
    // Nineteen positions, which is what a car campaign of this size actually
    // gets sold in. Every side position is one sticker on each flank, priced
    // once, because a wrap shop cuts both and nobody buys half a car.
    zones: [
      { zoneKey: "front-door-upper", label: "Front door, upper", viewKey: "side", x: 0.34, y: 0.5, w: 0.2, h: 0.12, sizeLabel: "both sides", suggestedPriceCents: 45000 },
      { zoneKey: "front-door-lower", label: "Front door, lower", viewKey: "side", x: 0.34, y: 0.65, w: 0.2, h: 0.13, sizeLabel: "both sides", suggestedPriceCents: 30000 },
      { zoneKey: "rear-door-upper", label: "Rear door, upper", viewKey: "side", x: 0.56, y: 0.5, w: 0.14, h: 0.12, sizeLabel: "both sides", suggestedPriceCents: 40000 },
      { zoneKey: "rear-door-lower", label: "Rear door, lower", viewKey: "side", x: 0.56, y: 0.65, w: 0.14, h: 0.13, sizeLabel: "both sides", suggestedPriceCents: 27500 },
      { zoneKey: "rear-quarter", label: "Rear quarter panel", viewKey: "side", x: 0.735, y: 0.49, w: 0.14, h: 0.09, sizeLabel: "both sides", suggestedPriceCents: 35000 },
      { zoneKey: "front-wing", label: "Front wing", viewKey: "side", x: 0.095, y: 0.55, w: 0.06, h: 0.13, sizeLabel: "both sides", suggestedPriceCents: 25000 },
      { zoneKey: "front-door-glass", label: "Front door window", viewKey: "side", x: 0.44, y: 0.24, w: 0.1, h: 0.15, sizeLabel: "both sides", suggestedPriceCents: 15000 },
      { zoneKey: "rear-door-glass", label: "Rear door window", viewKey: "side", x: 0.615, y: 0.3, w: 0.085, h: 0.11, sizeLabel: "both sides", suggestedPriceCents: 12500 },
      { zoneKey: "side-rear-bumper", label: "Rear bumper, side", viewKey: "side", x: 0.86, y: 0.63, w: 0.075, h: 0.13, sizeLabel: "both sides", suggestedPriceCents: 12500 },
      // The tail is the one view the car behind reads for a whole commute.
      { zoneKey: "rear-window", label: "Rear window", viewKey: "rear", x: 0.325, y: 0.17, w: 0.35, h: 0.14, sizeLabel: "65 × 20 cm", suggestedPriceCents: 40000 },
      { zoneKey: "tailgate", label: "Tailgate", viewKey: "rear", x: 0.36, y: 0.38, w: 0.28, h: 0.14, sizeLabel: "52 × 20 cm", suggestedPriceCents: 35000 },
      { zoneKey: "rear-bumper-centre", label: "Rear bumper, centre", viewKey: "rear", x: 0.36, y: 0.72, w: 0.28, h: 0.08, sizeLabel: "52 × 11 cm", suggestedPriceCents: 15000 },
      { zoneKey: "rear-bumper-left", label: "Rear bumper, left", viewKey: "rear", x: 0.18, y: 0.72, w: 0.11, h: 0.08, sizeLabel: "20 × 11 cm", suggestedPriceCents: 10000 },
      { zoneKey: "rear-bumper-right", label: "Rear bumper, right", viewKey: "rear", x: 0.665, y: 0.72, w: 0.11, h: 0.08, sizeLabel: "20 × 11 cm", suggestedPriceCents: 10000 },
      // The bonnet is the most expensive panel on the car: it is what every
      // photograph of the car is framed around, and what a drone or a first
      // floor window sees. A rear quarter is a third of it.
      { zoneKey: "bonnet-centre", label: "Bonnet, centre", viewKey: "top", x: 0.3, y: 0.1, w: 0.4, h: 0.15, sizeLabel: "74 × 70 cm", suggestedPriceCents: 60000 },
      { zoneKey: "bonnet-left", label: "Bonnet, left stripe", viewKey: "top", x: 0.19, y: 0.17, w: 0.075, h: 0.1, sizeLabel: "14 × 47 cm", suggestedPriceCents: 20000 },
      { zoneKey: "bonnet-right", label: "Bonnet, right stripe", viewKey: "top", x: 0.735, y: 0.17, w: 0.075, h: 0.1, sizeLabel: "14 × 47 cm", suggestedPriceCents: 20000 },
      { zoneKey: "roof", label: "Roof", viewKey: "top", x: 0.3, y: 0.44, w: 0.4, h: 0.15, sizeLabel: "74 × 70 cm", suggestedPriceCents: 35000 },
      { zoneKey: "boot-lid", label: "Boot lid", viewKey: "top", x: 0.3, y: 0.78, w: 0.4, h: 0.12, sizeLabel: "74 × 56 cm", suggestedPriceCents: 30000 },
    ],
  },
  {
    id: "race-kit",
    productType: "sports",
    name: "Race kit and helmet",
    sortOrder: 50,
    active: true,
    allowedVenues: ["sports_event", "everyday"],
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", viewBox: [80, 140], outline: TRISUIT_FRONT },
      { key: "back", label: "Back", viewBox: [80, 140], outline: TRISUIT_BACK },
      { key: "helmet-side", label: "Helmet, side", viewBox: [100, 60], outline: HELMET_SIDE },
      { key: "helmet-front", label: "Helmet, front", viewBox: [60, 60], outline: HELMET_FRONT },
    ],
    zones: [
      { zoneKey: "front-chest", label: "Front panel, upper", viewKey: "front", x: 0.35, y: 0.2, w: 0.3, h: 0.114, sizeLabel: "14 × 10 cm", suggestedPriceCents: 60000 },
      { zoneKey: "front-belly", label: "Front panel, lower", viewKey: "front", x: 0.35, y: 0.343, w: 0.3, h: 0.129, sizeLabel: "14 × 12 cm", suggestedPriceCents: 35000 },
      { zoneKey: "front-sleeves", label: "Sleeves, pair", viewKey: "front", x: 0.1875, y: 0.129, w: 0.0875, h: 0.0714, sizeLabel: "5 × 5 cm", suggestedPriceCents: 22500 },
      { zoneKey: "front-waist-left", label: "Waist tab, front left", viewKey: "front", x: 0.325, y: 0.5, w: 0.1, h: 0.043, sizeLabel: "4 × 3 cm", suggestedPriceCents: 20000 },
      { zoneKey: "front-waist-centre", label: "Waist tab, front centre", viewKey: "front", x: 0.45, y: 0.5, w: 0.1, h: 0.043, sizeLabel: "4 × 3 cm", suggestedPriceCents: 20000 },
      { zoneKey: "front-waist-right", label: "Waist tab, front right", viewKey: "front", x: 0.575, y: 0.5, w: 0.1, h: 0.043, sizeLabel: "4 × 3 cm", suggestedPriceCents: 20000 },
      { zoneKey: "front-thigh-left", label: "Front thigh, left", viewKey: "front", x: 0.325, y: 0.643, w: 0.125, h: 0.129, sizeLabel: "8 × 10 cm", suggestedPriceCents: 25000 },
      { zoneKey: "front-thigh-right", label: "Front thigh, right", viewKey: "front", x: 0.55, y: 0.643, w: 0.125, h: 0.129, sizeLabel: "8 × 10 cm", suggestedPriceCents: 25000 },
      { zoneKey: "back-upper", label: "Back panel, upper", viewKey: "back", x: 0.35, y: 0.18, w: 0.3, h: 0.15, sizeLabel: "14 × 12 cm", suggestedPriceCents: 50000 },
      { zoneKey: "back-lower", label: "Back panel, lower", viewKey: "back", x: 0.35, y: 0.37, w: 0.3, h: 0.12, sizeLabel: "14 × 10 cm", suggestedPriceCents: 30000 },
      { zoneKey: "back-waist-centre", label: "Waist tab, back centre", viewKey: "back", x: 0.45, y: 0.5, w: 0.1, h: 0.043, sizeLabel: "4 × 3 cm", suggestedPriceCents: 20000 },
      { zoneKey: "back-thigh-left", label: "Back thigh, left", viewKey: "back", x: 0.325, y: 0.643, w: 0.125, h: 0.129, sizeLabel: "8 × 10 cm", suggestedPriceCents: 25000 },
      { zoneKey: "back-thigh-right", label: "Back thigh, right", viewKey: "back", x: 0.55, y: 0.643, w: 0.125, h: 0.129, sizeLabel: "8 × 10 cm", suggestedPriceCents: 25000 },
      { zoneKey: "helmet-sides", label: "Helmet, sides", viewKey: "helmet-side", x: 0.3, y: 0.333, w: 0.32, h: 0.233, sizeLabel: "both sides", suggestedPriceCents: 17500 },
      { zoneKey: "helmet-front", label: "Helmet, front", viewKey: "helmet-front", x: 0.333, y: 0.267, w: 0.333, h: 0.167, sizeLabel: "6 × 3 cm", suggestedPriceCents: 15000 },
    ],
  },
  {
    id: "temporary-tattoo",
    productType: "body",
    name: "Temporary tattoos",
    sortOrder: 60,
    active: true,
    /**
     * The figure is dressed, and that is the product decision, not a drawing
     * decision. On every other template the outline is a picture of a thing;
     * here the outline is the policy. A creator can only sell a position we
     * authored, so a spot that is never drawn can never be sold — and because
     * the sports top and the shorts are drawn as their own closed shapes, every
     * position left on the board is visibly on skin that sportswear leaves out:
     * collarbones, arms, midriff, legs. No chest, no anything under the shorts,
     * and no way for a creator to add one. That is what lets a body product
     * exist in the catalog at all, and it is why the clothes are line work
     * rather than an assumption a reader has to take on trust.
     */
    // Racing (Hyrox, triathlon, running) and training content: a sponsored body
    // belongs where sportswear already is. Not weddings, not conferences — a
    // sponsored body at a private or business event is a brand-safety question
    // we are not answering in the MVP, and dressing the figure does not change
    // that. The skin declaration stays too: what is drawn is where a transfer
    // goes, and it goes on an adult who says the ink is skin-safe.
    allowedVenues: ["sports_event", "everyday"],
    requiredAttestations: ["temporary_skin_safe_adult"],
    views: [
      { key: "front", label: "Front", widthCm: 74, heightCm: 170, viewBox: [100, 230], outline: BODY_FRONT },
      { key: "back", label: "Back", widthCm: 74, heightCm: 170, viewBox: [100, 230], outline: BODY_BACK },
    ],
    // `front-chest-left` and `front-chest-right` used to be the bare chest and
    // now sit on the collarbones. The key is kept because `syncCatalog` upserts
    // by key and never deletes: renaming one would leave a published space
    // selling a position nobody can find, and reusing one for a different piece
    // of skin would quietly change what a sponsor already paid for. The
    // collarbone is the nearest exposed place to where the key used to point,
    // which is what keeps the old key honest.
    zones: [
      { zoneKey: "front-chest-left", label: "Collarbone, left", viewKey: "front", x: 0.355, y: 0.226, w: 0.115, h: 0.052, sizeLabel: "8 × 9 cm", suggestedPriceCents: 20000 },
      { zoneKey: "front-chest-right", label: "Collarbone, right", viewKey: "front", x: 0.53, y: 0.226, w: 0.115, h: 0.052, sizeLabel: "8 × 9 cm", suggestedPriceCents: 20000 },
      { zoneKey: "front-arm-left", label: "Upper arm, left", viewKey: "front", x: 0.203, y: 0.352, w: 0.064, h: 0.078, sizeLabel: "5 × 13 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-arm-right", label: "Upper arm, right", viewKey: "front", x: 0.733, y: 0.352, w: 0.064, h: 0.078, sizeLabel: "5 × 13 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-forearm-left", label: "Forearm, left", viewKey: "front", x: 0.193, y: 0.461, w: 0.047, h: 0.074, sizeLabel: "4 × 13 cm", suggestedPriceCents: 12000 },
      { zoneKey: "front-forearm-right", label: "Forearm, right", viewKey: "front", x: 0.76, y: 0.461, w: 0.047, h: 0.074, sizeLabel: "4 × 13 cm", suggestedPriceCents: 12000 },
      { zoneKey: "front-abs", label: "Stomach", viewKey: "front", x: 0.4, y: 0.409, w: 0.2, h: 0.07, sizeLabel: "15 × 12 cm", suggestedPriceCents: 40000 },
      { zoneKey: "front-thigh-left", label: "Thigh, left", viewKey: "front", x: 0.335, y: 0.661, w: 0.11, h: 0.057, sizeLabel: "8 × 10 cm", suggestedPriceCents: 10000 },
      { zoneKey: "front-thigh-right", label: "Thigh, right", viewKey: "front", x: 0.555, y: 0.661, w: 0.11, h: 0.057, sizeLabel: "8 × 10 cm", suggestedPriceCents: 10000 },
      // The lower leg is two different pieces of skin, so it is two positions
      // and they are named for what they are: the front view sells the shin,
      // the back view the calf. A sponsor on one is not on the other.
      { zoneKey: "front-shin-left", label: "Shin, left", viewKey: "front", x: 0.35, y: 0.809, w: 0.09, h: 0.078, sizeLabel: "7 × 13 cm", suggestedPriceCents: 8000 },
      { zoneKey: "front-shin-right", label: "Shin, right", viewKey: "front", x: 0.56, y: 0.809, w: 0.09, h: 0.078, sizeLabel: "7 × 13 cm", suggestedPriceCents: 8000 },
      { zoneKey: "back-upper", label: "Upper back", viewKey: "back", x: 0.36, y: 0.226, w: 0.28, h: 0.096, sizeLabel: "20 × 16 cm", suggestedPriceCents: 35000 },
      { zoneKey: "back-lower", label: "Lower back", viewKey: "back", x: 0.38, y: 0.409, w: 0.24, h: 0.07, sizeLabel: "18 × 12 cm", suggestedPriceCents: 18000 },
      { zoneKey: "back-calf-left", label: "Calf, left", viewKey: "back", x: 0.35, y: 0.809, w: 0.09, h: 0.078, sizeLabel: "7 × 13 cm", suggestedPriceCents: 8000 },
      { zoneKey: "back-calf-right", label: "Calf, right", viewKey: "back", x: 0.56, y: 0.809, w: 0.09, h: 0.078, sizeLabel: "7 × 13 cm", suggestedPriceCents: 8000 },
    ],
  },
  {
    id: "long-dress",
    productType: "apparel",
    name: "Long dress",
    sortOrder: 70,
    active: true,
    allowedVenues: ["conference", "private_event", "everyday"],
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", viewBox: [80, 160], outline: DRESS_FRONT },
      { key: "back", label: "Back", viewBox: [80, 160], outline: DRESS_BACK },
    ],
    zones: mirrored(["front", "back"], [
      { key: "bust", name: "bust", x: 0.4, y: 0.1625, w: 0.2, h: 0.0875, sizeLabel: "12 × 10 cm", suggestedPriceCents: 120000 },
      { key: "waist", name: "waist", x: 0.4, y: 0.275, w: 0.2, h: 0.075, sizeLabel: "12 × 8 cm", suggestedPriceCents: 90000 },
      { key: "hip-left", name: "hip left", x: 0.375, y: 0.375, w: 0.1125, h: 0.0875, sizeLabel: "8 × 10 cm", suggestedPriceCents: 70000 },
      { key: "hip-right", name: "hip right", x: 0.5125, y: 0.375, w: 0.1125, h: 0.0875, sizeLabel: "8 × 10 cm", suggestedPriceCents: 70000 },
      { key: "skirt-upper", name: "skirt upper", x: 0.375, y: 0.5, w: 0.25, h: 0.1, sizeLabel: "15 × 12 cm", suggestedPriceCents: 50000 },
      { key: "skirt-lower", name: "skirt lower", x: 0.35, y: 0.6375, w: 0.3, h: 0.2375, sizeLabel: "20 × 30 cm", suggestedPriceCents: 90000 },
    ]),
  },
  {
    id: "blazer",
    productType: "apparel",
    name: "Blazer",
    sortOrder: 80,
    active: true,
    allowedVenues: ["conference", "private_event", "everyday", "travel"],
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", viewBox: [100, 120], outline: BLAZER_FRONT },
      { key: "back", label: "Back", viewBox: [100, 120], outline: BLAZER_BACK },
    ],
    zones: [
      { zoneKey: "front-chest-left", label: "Chest, left", viewKey: "front", x: 0.27, y: 0.25, w: 0.14, h: 0.117, sizeLabel: "8 × 6 cm", suggestedPriceCents: 25000 },
      { zoneKey: "front-chest-right", label: "Chest, right (pocket)", viewKey: "front", x: 0.59, y: 0.25, w: 0.14, h: 0.117, sizeLabel: "8 × 6 cm", suggestedPriceCents: 30000 },
      { zoneKey: "front-pocket-left", label: "Pocket, left", viewKey: "front", x: 0.27, y: 0.7, w: 0.16, h: 0.117, sizeLabel: "10 × 6 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-pocket-right", label: "Pocket, right", viewKey: "front", x: 0.57, y: 0.7, w: 0.16, h: 0.117, sizeLabel: "10 × 6 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-sleeve-left", label: "Sleeve, left", viewKey: "front", x: 0.12, y: 0.367, w: 0.08, h: 0.133, sizeLabel: "5 × 8 cm", suggestedPriceCents: 10000 },
      { zoneKey: "front-sleeve-right", label: "Sleeve, right", viewKey: "front", x: 0.8, y: 0.367, w: 0.08, h: 0.133, sizeLabel: "5 × 8 cm", suggestedPriceCents: 10000 },
      { zoneKey: "back-upper", label: "Back, upper", viewKey: "back", x: 0.3, y: 0.167, w: 0.4, h: 0.217, sizeLabel: "25 × 15 cm", suggestedPriceCents: 40000 },
      { zoneKey: "back-lower", label: "Back, lower", viewKey: "back", x: 0.32, y: 0.467, w: 0.36, h: 0.267, sizeLabel: "22 × 18 cm", suggestedPriceCents: 30000 },
    ],
  },
  {
    id: "jacket-and-tote",
    productType: "apparel",
    name: "Jacket and tote bag",
    sortOrder: 90,
    active: true,
    allowedVenues: ["travel", "conference", "private_event", "everyday"],
    requiredAttestations: [],
    views: [
      { key: "jacket-front", label: "Jacket, front", viewBox: [100, 120], outline: JACKET_FRONT },
      { key: "jacket-back", label: "Jacket, back", viewBox: [100, 120], outline: JACKET_BACK },
      { key: "tote-front", label: "Tote, front", viewBox: [80, 100], outline: TOTE },
      { key: "tote-back", label: "Tote, back", viewBox: [80, 100], outline: TOTE },
    ],
    zones: [
      { zoneKey: "jacket-chest-left", label: "Jacket chest, left", viewKey: "jacket-front", x: 0.26, y: 0.3, w: 0.18, h: 0.133, sizeLabel: "10 × 8 cm", suggestedPriceCents: 30000 },
      { zoneKey: "jacket-chest-right", label: "Jacket chest, right", viewKey: "jacket-front", x: 0.56, y: 0.3, w: 0.18, h: 0.133, sizeLabel: "10 × 8 cm", suggestedPriceCents: 30000 },
      { zoneKey: "jacket-sleeve-left", label: "Jacket sleeve, left", viewKey: "jacket-front", x: 0.11, y: 0.383, w: 0.08, h: 0.15, sizeLabel: "6 × 10 cm", suggestedPriceCents: 10000 },
      { zoneKey: "jacket-sleeve-right", label: "Jacket sleeve, right", viewKey: "jacket-front", x: 0.81, y: 0.383, w: 0.08, h: 0.15, sizeLabel: "6 × 10 cm", suggestedPriceCents: 10000 },
      { zoneKey: "jacket-hem-left", label: "Jacket hem, left", viewKey: "jacket-front", x: 0.26, y: 0.583, w: 0.18, h: 0.15, sizeLabel: "10 × 8 cm", suggestedPriceCents: 20000 },
      { zoneKey: "jacket-hem-right", label: "Jacket hem, right", viewKey: "jacket-front", x: 0.56, y: 0.583, w: 0.18, h: 0.15, sizeLabel: "10 × 8 cm", suggestedPriceCents: 20000 },
      { zoneKey: "jacket-back-yoke", label: "Jacket back, yoke", viewKey: "jacket-back", x: 0.3, y: 0.133, w: 0.4, h: 0.133, sizeLabel: "25 × 8 cm", suggestedPriceCents: 50000 },
      { zoneKey: "jacket-back-centre", label: "Jacket back, centre", viewKey: "jacket-back", x: 0.3, y: 0.317, w: 0.4, h: 0.267, sizeLabel: "25 × 18 cm", suggestedPriceCents: 80000 },
      { zoneKey: "jacket-back-waistband", label: "Jacket back, waistband", viewKey: "jacket-back", x: 0.34, y: 0.667, w: 0.32, h: 0.1, sizeLabel: "20 × 5 cm", suggestedPriceCents: 20000 },
      ...mirrored(["tote-front", "tote-back"], [
        { key: "top-left", name: "top left", x: 0.275, y: 0.46, w: 0.2, h: 0.16, sizeLabel: "8 × 8 cm", suggestedPriceCents: 2000 },
        { key: "top-right", name: "top right", x: 0.525, y: 0.46, w: 0.2, h: 0.16, sizeLabel: "8 × 8 cm", suggestedPriceCents: 2000 },
        { key: "bottom-left", name: "bottom left", x: 0.275, y: 0.68, w: 0.2, h: 0.16, sizeLabel: "8 × 8 cm", suggestedPriceCents: 1000 },
        { key: "bottom-right", name: "bottom right", x: 0.525, y: 0.68, w: 0.2, h: 0.16, sizeLabel: "8 × 8 cm", suggestedPriceCents: 1000 },
      ]).map((z) => ({ ...z, label: z.label.replace(/^Tote-front/, "Tote front").replace(/^Tote-back/, "Tote back") })),
    ],
  },
  {
    id: "tshirt-or-hoodie",
    productType: "apparel",
    name: "T-shirt or hoodie",
    sortOrder: 95,
    active: true,
    allowedVenues: EVERYWHERE,
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", viewBox: [100, 110], outline: TSHIRT_FRONT },
      { key: "back", label: "Back", viewBox: [100, 110], outline: TSHIRT_BACK },
    ],
    zones: [
      { zoneKey: "front-chest-left", label: "Chest, left", viewKey: "front", x: 0.3, y: 0.25, w: 0.14, h: 0.11, sizeLabel: "8 × 8 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-chest-right", label: "Chest, right", viewKey: "front", x: 0.56, y: 0.25, w: 0.14, h: 0.11, sizeLabel: "8 × 8 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-centre", label: "Front, centre", viewKey: "front", x: 0.32, y: 0.42, w: 0.36, h: 0.22, sizeLabel: "25 × 20 cm", suggestedPriceCents: 40000 },
      { zoneKey: "front-hem", label: "Front, hem", viewKey: "front", x: 0.32, y: 0.76, w: 0.36, h: 0.1, sizeLabel: "20 × 6 cm", suggestedPriceCents: 15000 },
      { zoneKey: "front-sleeve-left", label: "Sleeve, left", viewKey: "front", x: 0.1, y: 0.25, w: 0.09, h: 0.09, sizeLabel: "6 × 6 cm", suggestedPriceCents: 10000 },
      { zoneKey: "front-sleeve-right", label: "Sleeve, right", viewKey: "front", x: 0.81, y: 0.25, w: 0.09, h: 0.09, sizeLabel: "6 × 6 cm", suggestedPriceCents: 10000 },
      { zoneKey: "back-yoke", label: "Back, yoke", viewKey: "back", x: 0.3, y: 0.18, w: 0.4, h: 0.1, sizeLabel: "25 × 8 cm", suggestedPriceCents: 25000 },
      { zoneKey: "back-centre", label: "Back, centre", viewKey: "back", x: 0.3, y: 0.33, w: 0.4, h: 0.3, sizeLabel: "30 × 25 cm", suggestedPriceCents: 50000 },
      { zoneKey: "back-hem", label: "Back, hem", viewKey: "back", x: 0.32, y: 0.72, w: 0.36, h: 0.12, sizeLabel: "20 × 8 cm", suggestedPriceCents: 15000 },
    ],
  },
  {
    id: "cap",
    productType: "apparel",
    name: "Cap",
    sortOrder: 97,
    active: true,
    allowedVenues: EVERYWHERE,
    requiredAttestations: [],
    views: [
      { key: "front", label: "Front", viewBox: [100, 70], outline: CAP_FRONT },
      { key: "left", label: "Left", viewBox: [100, 70], outline: CAP_SIDE },
      { key: "right", label: "Right", viewBox: [100, 70], outline: CAP_SIDE },
      { key: "back", label: "Back", viewBox: [100, 70], outline: CAP_BACK },
    ],
    zones: [
      { zoneKey: "front-panel", label: "Front panel", viewKey: "front", x: 0.3, y: 0.3, w: 0.4, h: 0.3, sizeLabel: "8 × 5 cm", suggestedPriceCents: 25000 },
      { zoneKey: "front-visor", label: "Visor", viewKey: "front", x: 0.25, y: 0.75, w: 0.5, h: 0.1, sizeLabel: "10 × 2 cm", suggestedPriceCents: 7500 },
      ...mirrored(["left", "right"], [
        { key: "side", name: "side", x: 0.3, y: 0.35, w: 0.3, h: 0.3, sizeLabel: "5 × 4 cm", suggestedPriceCents: 10000 },
      ]),
      { zoneKey: "back-strap", label: "Back, above the strap", viewKey: "back", x: 0.35, y: 0.3, w: 0.3, h: 0.2, sizeLabel: "6 × 3 cm", suggestedPriceCents: 7500 },
    ],
  },
  service("short-form-video", "Short video", 200, {
    deliverableKind: "video",
    summary: "A short video about your brand, up to 60 seconds, posted to the creator's audience on X, TikTok, Reels or Shorts.",
    maxSlots: 20,
  }),
  service("sponsored-x-post", "Sponsored X post", 210, {
    deliverableKind: "photo_post",
    summary: "A post about your brand to the creator's followers on X, with your link or code, kept up for at least 30 days.",
    maxSlots: 20,
  }),
  service(
    "event-wrap",
    "Event recap video",
    220,
    {
      deliverableKind: "video",
      summary: "The creator's recap video of the event, with your brand mentioned, your logo on screen and your link in the post.",
      maxSlots: 5,
    },
    ["conference", "sports_event", "travel"],
  ),
  // The listing this template exists for: a creator with an official content
  // pass covering a conference for three days, selling a logo in the strip at
  // $50 and a produced on-site interview at $1,300 off the same page. The
  // ladder is the tiers; this is the thing being covered. Without it the
  // nearest we offered was "Event recap video", which is one deliverable, not
  // three days of work sold in rungs.
  service(
    "event-coverage",
    "Cover an event for you",
    225,
    {
      deliverableKind: "video",
      summary:
        "The creator is at the event with a pass and covers it for your brand: floor footage, interviews and daily posts on their own channels.",
      maxSlots: 20,
    },
    ["conference", "sports_event", "travel"],
  ),
  service("interview", "Interview", 230, {
    deliverableKind: "video",
    summary: "The creator interviews someone from your team on camera and publishes it on their channels.",
    maxSlots: 10,
  }),
  // The two every creator selling a conference already sells by hand, and the
  // reason a landing page written in an afternoon beats us: a sponsor who wants
  // their product used on camera, and a sponsor who wants two audiences at once.
  service("product-demo", "Product demo", 240, {
    deliverableKind: "video",
    summary: "The creator uses your product on camera and shows what it does, start to finish.",
    maxSlots: 10,
  }),
  service("creator-collab", "Two-creator video", 250, {
    deliverableKind: "video",
    summary: "One video about your brand made with another creator and posted on both channels, reaching both audiences.",
    maxSlots: 5,
  }),
  // "Don't sponsor my trip. Sponsor the content." Made for the brand, not
  // posted on the creator's channels: the brand brings the brief.
  production("content-production", "Content production", 260, {
    summary:
      "Content for your own channels. You bring the brief, the creator brings the camera: interviews, short-form, b-roll and social assets filmed at the event, edited and delivered to you.",
    maxSlots: 10,
    suggestedPriceCents: 150_000,
  }),
  // In the room: the creator's time at the event itself.
  session("host-side-event", "Host your side event", 300, {
    summary: "The creator hosts your side event for one evening: opens it, keeps it running and closes it.",
    maxSlots: 3,
    suggestedPriceCents: 60_000,
  }),
  session("moderate-panel", "Moderate your panel", 310, {
    summary: "The creator moderates one of your panels: prepares the questions with you and keeps it on time.",
    maxSlots: 5,
    suggestedPriceCents: 40_000,
  }),
  session("booth-presence", "Booth appearance", 320, {
    summary: "Two hours at your booth during the event, meeting visitors and posting from it.",
    maxSlots: 6,
    suggestedPriceCents: 30_000,
  }),
  // Retired, never deleted: a live space may be selling them, and its page must
  // keep reading the template. They leave the catalog a creator picks from.
  session(
    "pitch-review",
    "Pitch review",
    330,
    {
      summary:
        "Thirty minutes at the venue or a public place where the creator listens to your pitch and tells you plainly what lands and what does not.",
      maxSlots: 12,
      suggestedPriceCents: 10_000,
    },
    false,
  ),
  session(
    "office-hours",
    "Office hours",
    340,
    {
      summary:
        "Forty-five minutes with the creator at the venue or a public place for your questions about content, community and the event.",
      maxSlots: 10,
      suggestedPriceCents: 15_000,
    },
    false,
  ),
  session("event-guide", "Event guide for your team", 350, {
    summary: "Half a day showing your team the talks, side events and people worth their time.",
    maxSlots: 4,
    suggestedPriceCents: 35_000,
  }),
  // Last: what a creator reaches for when nothing above fits. Content, not a
  // session, so it is delivered by a public link like every other content
  // service; and it declares no advice and no investor intros up front,
  // because the creator's own words are the whole product.
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
    sortOrder: 400,
    active: true,
    allowedVenues: EVERYWHERE,
    requiredAttestations: ["discloses_sponsorship", "no_investment_advice", "no_investor_intros"],
    views: [],
    zones: [],
  },
];
