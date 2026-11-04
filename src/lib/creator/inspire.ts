/**
 * Spaces › Inspire: `GET /inspire/events` and `GET /inspire/events/:slug/campaigns`.
 *
 * What other people have sold ad space on, by event. Two sources on the same
 * cards (backend services/inspire): campaigns imported once from the public
 * sponsor me index by @emilylai, credited on every one and never presented as
 * HOLD users, and every published HOLD Spaces listing. Neither carries how a
 * campaign is going: no amounts raised, no spots left.
 *
 * It also holds the bridge between the index's product words and our own
 * catalogue (`templateForCampaign`), which is what "Use this idea" opens the
 * listing editor on.
 */

"use client";

import { t, type MessageKey } from "@/lib/app/i18n";

import { call } from "./api";

export type { InspiredByInput } from "./inspired-by";

export type SurfaceKind = "object" | "clothing" | "body" | "content" | "vehicle";
export type PricingModel = "auction" | "fixed" | "tiered" | "offers" | "not_stated";

export interface InspireCredit {
  kind: "sponsorme_index";
  name: string;
  label: string;
  by: string;
  byUrl: string;
  url: string;
}

export interface InspireEvent {
  slug: string;
  name: string;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
  spacesEventSlug: string | null;
  count: number;
  holdCount: number;
  indexCount: number;
}

export interface InspireCampaign {
  id: string;
  origin: "hold" | "sponsorme_index";
  /**
   * `avatarUrl` is the creator's own picture on X. The read does not carry one
   * today — the index seed has no picture and the inspire service does not
   * select `user_x_accounts.avatar_url` for HOLD rows — so the card draws a
   * coloured tile with their initial. When a server starts sending it, it is
   * drawn instead, with no other change here.
   */
  creator: { handle: string; name: string | null; platform: "x" | "other"; avatarUrl?: string | null };
  title: string;
  surface: { kind: SurfaceKind | null; product: string | null };
  offer: string | null;
  pricing: { model: PricingModel; text: string | null };
  description: string | null;
  links: { post: string | null; website: string | null; holdPage: string | null };
  launchedOn: string | null;
  suggestedTemplateId: string | null;
  source: { label: string; url: string } | null;
}

export interface InspireEventCampaigns {
  event: InspireEvent;
  campaigns: InspireCampaign[];
  facets: { surfaces: { kind: SurfaceKind; count: number }[]; products: { product: string; count: number }[] };
  credit: InspireCredit;
}

/** The card for campaigns tied to no event. */
export const ANYTIME = "anytime";

/** The message key of each surface's name: `surfaceLabel` reads it in the current language. */
export const SURFACE_LABEL: Record<SurfaceKind, MessageKey> = {
  object: "spaces.inspire.surface.object",
  clothing: "spaces.inspire.surface.clothing",
  body: "spaces.inspire.surface.body",
  content: "spaces.inspire.surface.content",
  vehicle: "spaces.inspire.surface.vehicle",
};

export const PRICING_LABEL: Record<PricingModel, MessageKey> = {
  auction: "spaces.inspire.pricing.auction",
  fixed: "spaces.inspire.pricing.fixed",
  tiered: "spaces.inspire.pricing.tiered",
  offers: "spaces.inspire.pricing.offers",
  not_stated: "spaces.inspire.pricing.notStated",
};

export function surfaceLabel(kind: SurfaceKind): string {
  return t(SURFACE_LABEL[kind]);
}

export function pricingLabel(model: PricingModel): string {
  const k = PRICING_LABEL[model];
  return k ? t(k) : model;
}

export function getInspireEvents(): Promise<{ events: InspireEvent[]; credit: InspireCredit }> {
  return call("inspire/events");
}

export function getInspireCampaigns(slug: string): Promise<InspireEventCampaigns> {
  return call(`inspire/events/${encodeURIComponent(slug)}/campaigns`);
}

/* ── Which product an idea is really about ────────────────────────── */

/**
 * The catalogue template for each product the sponsor me index names, so "Use
 * this idea" opens the editor on the dress, the car or the laptop rather than
 * on whatever the picker happens to show first.
 *
 * The index's product vocabulary is its own (`surfaces.js`, mirrored by the
 * backend's `PRODUCT_KIND`); ours is the Ad Space catalogue. This is the whole
 * bridge between the two, and it is deliberately kept here rather than read
 * from the server: a row that lands on the wrong product is worse than one
 * that lands on the picker, so both halves are written by hand and checked
 * against the seed (the server's own copy is services/inspire/rules.ts).
 *
 * Every product word the index has is in here, and that is the point: all 285
 * seeded rows open the editor on a real product, none on the picker and none
 * on the suitcase. The catalogue grew four products to make that true — the
 * wall, the bottle, the pet's kit and the catch-all — which is what a creator
 * pressing "Use this idea" on a dress and getting a suitcase was telling us.
 *
 * A template only counts while the catalogue still lists it: `templateForCampaign`
 * checks the live ids, so a retired product reads as none. That is why `Phone`
 * points at the wallpaper and not at the retired `phone-case`.
 */
const TEMPLATE_FOR_PRODUCT: Record<string, string> = {
  // Objects
  Suitcase: "carry-on-suitcase",
  Bag: "backpack",
  Laptop: "laptop-lid",
  Phone: "phone-wallpaper",
  Bottle: "bottle-or-mug",
  // A wall, a garage door, a fridge door, a cubicle door and the board behind
  // a desk are one flat panel sold by the square.
  Wall: "wall-or-door",
  Fridge: "wall-or-door",
  Toilet: "wall-or-door",
  Pet: "pet-vest",
  // The long tail, and the index's own catch-all: six squares on the face of
  // something the creator owns.
  Guitar: "custom-object",
  Cigarettes: "custom-object",
  Other: "custom-object",
  // Vehicles. A motorcycle is sold on its frame like a bike; a van and a tank
  // are panels like a car's.
  Bike: "road-bike",
  Motorcycle: "road-bike",
  Car: "car",
  Van: "car",
  Tank: "car",
  // Clothing
  Dress: "long-dress",
  Suit: "blazer",
  Shirt: "tshirt-or-hoodie",
  Hoodie: "tshirt-or-hoodie",
  Outfit: "tshirt-or-hoodie",
  // Body. Logos worn on skin are our temporary tattoos; logos worn on a runner
  // or a fighter for a race are the race kit.
  Tattoo: "temporary-tattoo",
  Forehead: "temporary-tattoo",
  Nails: "temporary-tattoo",
  Body: "race-kit",
};

/** The service every "sponsor my content" idea opens on. */
const CONTENT_TEMPLATE = "content-production";

/**
 * The template this idea should open the editor on, or null when we sell
 * nothing like it.
 *
 * `known` is the live catalogue's ids: a template this server does not have is
 * treated as none, so a link never lands on a product the editor cannot show.
 * Pass null while the catalogue is still loading.
 */
export function templateForCampaign(c: InspireCampaign, known?: ReadonlySet<string> | null): string | null {
  const id = closestTemplate(c);
  if (!id) return null;
  return !known || known.has(id) ? id : null;
}

function closestTemplate(c: InspireCampaign): string | null {
  // A HOLD listing is already one of our products: it knows which.
  if (c.origin === "hold") return c.suggestedTemplateId;
  // Sponsored content is a service, whatever the logo would otherwise go on:
  // "Sponsored coverage from Breakpoint" carries the product `Body`.
  if (c.surface.kind === "content") return CONTENT_TEMPLATE;
  const byProduct = c.surface.product ? TEMPLATE_FOR_PRODUCT[c.surface.product] ?? null : null;
  // A server that learns a product we have not mapped yet still gets its say.
  return byProduct ?? c.suggestedTemplateId;
}

/**
 * The listing editor on this idea: the template it is about, and the credit,
 * `Inspired by @handle` (the `inspiredBy` field on the space:
 * `{ kind: "x" | "hold", handle }`). A creator from the index is credited by
 * their X handle; one without an X handle is not credited.
 */
export function ideaQuery(c: InspireCampaign, templateId: string | null): string {
  const q = new URLSearchParams();
  if (templateId) q.set("template", templateId);
  if (c.origin === "hold") q.set("inspiredBy", `hold:${c.creator.handle}`);
  else if (c.creator.platform === "x") q.set("inspiredBy", `x:${c.creator.handle}`);
  const s = q.toString();
  return s ? `?${s}` : "";
}
