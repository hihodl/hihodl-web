/**
 * Spaces › Inspire: `GET /inspire/events` and `GET /inspire/events/:slug/campaigns`.
 *
 * What other people have sold ad space on, by event. Two sources on the same
 * cards (backend services/inspire): campaigns imported once from the public
 * sponsor me index by @emilylai, credited on every one and never presented as
 * HOLD users, and every published HOLD Spaces listing. Neither carries how a
 * campaign is going: no amounts raised, no spots left.
 */

"use client";

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
  creator: { handle: string; name: string | null; platform: "x" | "other" };
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

export const SURFACE_LABEL: Record<SurfaceKind, string> = {
  object: "Objects",
  clothing: "Clothing",
  body: "Body",
  content: "Content",
  vehicle: "Vehicles",
};

export const PRICING_LABEL: Record<PricingModel, string> = {
  auction: "Auction",
  fixed: "Fixed price",
  tiered: "Tiers",
  offers: "Offers",
  not_stated: "Price not stated",
};

export function getInspireEvents(): Promise<{ events: InspireEvent[]; credit: InspireCredit }> {
  return call("inspire/events");
}

export function getInspireCampaigns(slug: string): Promise<InspireEventCampaigns> {
  return call(`inspire/events/${encodeURIComponent(slug)}/campaigns`);
}

/**
 * The listing editor on this idea: its template when we sell one like it, and
 * the credit, `Inspired by @handle` (the `inspiredBy` field on the space:
 * `{ kind: "x" | "hold", handle }`). A creator from the index is credited by
 * their X handle; one without an X handle is not credited.
 */
export function ideaQuery(c: InspireCampaign): string {
  const q = new URLSearchParams();
  if (c.suggestedTemplateId) q.set("template", c.suggestedTemplateId);
  if (c.origin === "hold") q.set("inspiredBy", `hold:${c.creator.handle}`);
  else if (c.creator.platform === "x") q.set("inspiredBy", `x:${c.creator.handle}`);
  const s = q.toString();
  return s ? `?${s}` : "";
}
