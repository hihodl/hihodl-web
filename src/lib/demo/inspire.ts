/**
 * The demo's Inspire (GET /inspire/events and /inspire/events/:slug/campaigns),
 * shaped exactly as the backend answers (services/inspire/inspire.service.ts).
 *
 *   - The 285 campaigns of the sponsor me index, from the same seed the
 *     backend imports (inspire-seed.json = hihodl-backend
 *     data/inspiration/sponsorme-index-2026-09-19.json). Public facts, credited
 *     as the backend credits them: "via sponsorme index", by @emilylai.
 *   - Three fictional HOLD listings, "On HOLD": two at TOKEN2049 and one tied
 *     to no event. The creators are the demo's own fictional ones.
 *
 * Preview branch only.
 */

import type {
  InspireCampaign,
  InspireCredit,
  InspireEvent,
  InspireEventCampaigns,
  PricingModel,
  SurfaceKind,
} from "@/lib/creator/inspire";

import seed from "./inspire-seed.json";

interface SeedCampaign {
  sourceUrl: string;
  eventSlug: string | null;
  creatorHandle: string;
  creatorPlatform: "x" | "other";
  creatorName: string | null;
  title: string;
  surfaceKind: SurfaceKind | null;
  productType: string | null;
  offer: string | null;
  pricingModel: PricingModel;
  pricingText: string | null;
  description: string | null;
  xPostUrl: string | null;
  websiteUrl: string | null;
  launchedOn: string | null;
}

interface SeedEvent {
  slug: string;
  name: string;
  city: string;
  startsOn: string;
  endsOn: string;
  adSpaceEventSlug: string | null;
}

const ANYTIME = "anytime";

const CREDIT: InspireCredit = {
  kind: "sponsorme_index",
  name: "sponsor me index",
  label: "via sponsorme index",
  by: "@emilylai",
  byUrl: "https://x.com/emilylai",
  url: "https://sponsorme.emilylai.com",
};

/** services/inspire/rules.ts `suggestedTemplateId`, verbatim. */
const TEMPLATE_FOR_PRODUCT: Record<string, string> = {
  Suitcase: "carry-on-suitcase",
  Bag: "backpack",
  Laptop: "laptop-lid",
  Phone: "phone-case",
  Bike: "road-bike",
  Car: "car",
  Van: "car",
  Dress: "long-dress",
  Suit: "blazer",
  Hoodie: "tshirt-or-hoodie",
  Shirt: "tshirt-or-hoodie",
  Outfit: "tshirt-or-hoodie",
  Tattoo: "temporary-tattoo",
  Forehead: "temporary-tattoo",
  Body: "race-kit",
};
function suggested(kind: string | null, product: string | null): string | null {
  if (product && TEMPLATE_FOR_PRODUCT[product]) return TEMPLATE_FOR_PRODUCT[product];
  return kind === "content" ? "content-production" : null;
}

/** Fictional HOLD listings, with the event they are at (null: none). */
const HOLD: { event: string | null; campaign: InspireCampaign }[] = [
  {
    event: "token2049-singapore-2026",
    campaign: {
      id: "hold:demo-nodeline-suitcase",
      origin: "hold",
      creator: { handle: "nodeline_creator", name: "Nodeline Creator", platform: "x" },
      title: "My carry-on, flying Lisbon to TOKEN2049",
      surface: { kind: "object", product: "Suitcase" },
      offer: "A logo on the creator's carry-on suitcase",
      pricing: { model: "tiered", text: null },
      description: "Twelve spots on the suitcase, in every airport, hotel and side-event story of the week.",
      links: { post: null, website: null, holdPage: "/s/nodeline_creator" },
      launchedOn: "2026-09-18",
      suggestedTemplateId: "carry-on-suitcase",
      source: null,
    },
  },
  {
    event: "token2049-singapore-2026",
    campaign: {
      id: "hold:demo-harbor-content",
      origin: "hold",
      creator: { handle: "harbor_frames", name: "Harbor Frames", platform: "x" },
      title: "Two days of TOKEN2049 on camera, your brand in every cut",
      surface: { kind: "content", product: null },
      offer: "Content production",
      pricing: { model: "fixed", text: null },
      description: "Interviews and short videos from the floor and the side events, delivered within 48 hours.",
      links: { post: null, website: null, holdPage: "/s/harbor_frames" },
      launchedOn: "2026-09-17",
      suggestedTemplateId: "content-production",
      source: null,
    },
  },
  {
    event: null,
    campaign: {
      id: "hold:demo-pace-racekit",
      origin: "hold",
      creator: { handle: "pace_and_miles", name: "Pace and Miles", platform: "x" },
      title: "Every race this autumn in one race kit",
      surface: { kind: "clothing", product: "Shirt" },
      offer: "A logo on the creator's race kit",
      pricing: { model: "auction", text: null },
      description: "Three half marathons and a 10K, with the kit in every finish-line photo.",
      links: { post: null, website: null, holdPage: "/s/pace_and_miles" },
      launchedOn: "2026-09-15",
      suggestedTemplateId: "race-kit",
      source: null,
    },
  },
];

function fromSeed(c: SeedCampaign, i: number): InspireCampaign {
  return {
    id: `index:demo-${String(i).padStart(4, "0")}`,
    origin: "sponsorme_index",
    creator: { handle: c.creatorHandle, name: c.creatorName, platform: c.creatorPlatform },
    title: c.title,
    surface: { kind: c.surfaceKind, product: c.productType },
    offer: c.offer,
    pricing: { model: c.pricingModel, text: c.pricingText },
    description: c.description,
    links: { post: c.xPostUrl, website: c.websiteUrl, holdPage: null },
    launchedOn: c.launchedOn,
    suggestedTemplateId: suggested(c.surfaceKind, c.productType),
    source: { label: CREDIT.label, url: c.sourceUrl },
  };
}

interface Bucket {
  event: Omit<InspireEvent, "count" | "holdCount" | "indexCount">;
  campaigns: InspireCampaign[];
}

let built: Map<string, Bucket> | null = null;

function buckets(): Map<string, Bucket> {
  if (built) return built;
  const events = (seed as { events: SeedEvent[] }).events;
  const out = new Map<string, Bucket>();
  for (const e of events) {
    out.set(e.slug, {
      event: { slug: e.slug, name: e.name, city: e.city, startsOn: e.startsOn, endsOn: e.endsOn, spacesEventSlug: e.adSpaceEventSlug },
      campaigns: [],
    });
  }
  out.set(ANYTIME, {
    event: { slug: ANYTIME, name: "Not tied to an event", city: null, startsOn: null, endsOn: null, spacesEventSlug: null },
    campaigns: [],
  });
  (seed as { campaigns: SeedCampaign[] }).campaigns.forEach((c, i) => {
    out.get(c.eventSlug && out.has(c.eventSlug) ? c.eventSlug : ANYTIME)!.campaigns.push(fromSeed(c, i));
  });
  for (const h of HOLD) out.get(h.event ?? ANYTIME)!.campaigns.push(h.campaign);
  // HOLD first, then the newest: the backend's order.
  for (const b of out.values()) {
    b.campaigns.sort(
      (a, z) =>
        (a.origin === "hold" ? 0 : 1) - (z.origin === "hold" ? 0 : 1) ||
        (z.launchedOn ?? "").localeCompare(a.launchedOn ?? "") ||
        a.id.localeCompare(z.id),
    );
  }
  built = out;
  return out;
}

function card(b: Bucket): InspireEvent {
  const holdCount = b.campaigns.filter((c) => c.origin === "hold").length;
  return { ...b.event, count: b.campaigns.length, holdCount, indexCount: b.campaigns.length - holdCount };
}

function facets(list: InspireCampaign[]): InspireEventCampaigns["facets"] {
  const kinds = new Map<SurfaceKind, number>();
  const products = new Map<string, number>();
  for (const c of list) {
    if (c.surface.kind) kinds.set(c.surface.kind, (kinds.get(c.surface.kind) ?? 0) + 1);
    if (c.surface.product) products.set(c.surface.product, (products.get(c.surface.product) ?? 0) + 1);
  }
  const by = <K extends string>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    surfaces: by(kinds).map(([kind, count]) => ({ kind, count })),
    products: by(products).map(([product, count]) => ({ product, count })),
  };
}

export function demoInspireEvents(): { events: InspireEvent[]; credit: InspireCredit } {
  const all = [...buckets().values()].map(card).filter((c) => c.count > 0);
  const dated = all
    .filter((c) => c.slug !== ANYTIME)
    .sort((a, b) => (a.startsOn ?? "9999").localeCompare(b.startsOn ?? "9999") || b.count - a.count || a.name.localeCompare(b.name));
  const anytime = all.find((c) => c.slug === ANYTIME);
  return { events: anytime ? [...dated, anytime] : dated, credit: CREDIT };
}

/** Null: no such event (the backend's 404). */
export function demoInspireCampaigns(slug: string, query: URLSearchParams): InspireEventCampaigns | null {
  const b = buckets().get(slug.toLowerCase());
  if (!b) return null;
  const surface = query.get("surface");
  const product = query.get("product")?.toLowerCase() ?? null;
  const shown = b.campaigns.filter(
    (c) => (!surface || c.surface.kind === surface) && (!product || (c.surface.product ?? "").toLowerCase() === product),
  );
  return { event: card(b), campaigns: shown, facets: facets(b.campaigns), credit: CREDIT };
}
