/**
 * Every call the console makes about a listing.
 *
 * All of them go straight to the backend with the creator's Bearer token (see
 * ./api). Names here say what a creator is doing, not what the route is
 * called: `publishListing`, not `postSpacesIdPublish`.
 *
 * Nothing in this file decides anything. The shapes are the server's, the
 * rules are the server's, and the two places that turn either into English
 * are ./rules (before we send) and ./problems (after it says no).
 */

"use client";

import type { Chain } from "@/lib/ad-space/types";

import { call } from "./api";
import type {
  EventSummary,
  OfferView,
  SalesSummary,
  SpaceCard,
  SpaceUpdate,
  SpaceView,
  Template,
} from "./listing";

/* ── The catalogue ────────────────────────────────────────────────── */

export function getTemplates(): Promise<{ templates: Template[]; availableChains: Chain[] }> {
  return call<{ templates: Template[]; availableChains: Chain[] }>("ad-space/templates");
}

/* ── Events ───────────────────────────────────────────────────────── */

export function searchEvents(q: string, limit = 8): Promise<{ events: EventSummary[] }> {
  return call<{ events: EventSummary[] }>(`ad-space/events/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

/**
 * Add an event nobody has added yet.
 *
 * 409 `similar_events` comes back with `error.details.candidates` when one
 * already looks like this — the same name, the same city, or dates a week
 * either side. That is a question, not a refusal: show the candidates, and
 * send it again with `confirmNew` if none of them is it.
 */
export function createEvent(body: {
  name: string;
  city: string;
  country?: string | null;
  startsOn: string;
  endsOn: string;
  category: string;
  confirmNew?: boolean;
}): Promise<{ event: EventSummary; existed: boolean }> {
  return call<{ event: EventSummary; existed: boolean }>("ad-space/events", { json: body });
}

/* ── Drafting, publishing ─────────────────────────────────────────── */

export function createListing(body: Record<string, unknown>): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>("ad-space/spaces", { json: body });
}

export function getListing(spaceId: string): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>(`ad-space/spaces/${spaceId}`);
}

/**
 * Change a draft.
 *
 * Send only what changed. `updateBody` on the backend carries no zod
 * `.default()` on purpose — zod 4 applies defaults inside `.partial()`, so a
 * field this call omits keeps its value and a field it sends as part of a
 * whole-form dump would be reset to a default nobody asked for.
 */
export function patchListing(spaceId: string, body: Record<string, unknown>): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>(`ad-space/spaces/${spaceId}`, { method: "PATCH", json: body });
}

export function deleteListing(spaceId: string): Promise<{ deleted: boolean }> {
  return call<{ deleted: boolean }>(`ad-space/spaces/${spaceId}`, { method: "DELETE" });
}

/**
 * Go live.
 *
 * The body may name which of the creator's own addresses receives the money,
 * and we name none: the server resolves it (a HOLD wallet wins whenever there
 * is one, the proved address otherwise) and a stale answer from a client is
 * refused rather than quietly paid elsewhere.
 */
export function publishListing(spaceId: string): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>(`ad-space/spaces/${spaceId}/publish`, { json: {} });
}

export function myListings(): Promise<{ spaces: SpaceCard[] }> {
  return call<{ spaces: SpaceCard[] }>("ad-space/spaces/mine");
}

/** The link and the post. Live listings only; a draft answers `not_live`. */
export function shareListing(spaceId: string): Promise<{ url: string; text: string }> {
  return call<{ url: string; text: string }>(`ad-space/spaces/${spaceId}/share`);
}

/* ── Offers and bids ──────────────────────────────────────────────── */

/** Every offer and bid on every listing this creator has, open ones first. */
export function receivedOffers(): Promise<{ offers: OfferView[] }> {
  return call<{ offers: OfferView[] }>("ad-space/offers/received");
}

export function listingOffers(spaceId: string): Promise<{ offers: OfferView[] }> {
  return call<{ offers: OfferView[] }>(`ad-space/spaces/${spaceId}/offers`);
}

/**
 * Say yes.
 *
 * `updatedAt` is the version of the thread the creator was looking at. A
 * sponsor who raised their bid, withdrew, or a sweep that expired it in the
 * meantime moves it, and the call is refused rather than applied to a number
 * nobody on this screen has seen.
 */
export function acceptOffer(offerId: string, updatedAt: string): Promise<{ offer: OfferView }> {
  return call<{ offer: OfferView }>(`ad-space/offers/${offerId}/accept`, { json: { updatedAt } });
}

export function counterOffer(offerId: string, amountCents: number, updatedAt: string): Promise<{ offer: OfferView }> {
  return call<{ offer: OfferView }>(`ad-space/offers/${offerId}/counter`, { json: { amountCents, updatedAt } });
}

export type DeclineReason = "too_low" | "not_a_fit" | "other";

export function declineOffer(offerId: string, reason: DeclineReason, updatedAt: string): Promise<{ offer: OfferView }> {
  return call<{ offer: OfferView }>(`ad-space/offers/${offerId}/decline`, { json: { reason, updatedAt } });
}

/** The floor on one spot. `null` takes it off. Never shown to anybody but the creator. */
export function setPositionFloor(positionId: string, minOfferCents: number | null): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>(`ad-space/positions/${positionId}/min-offer`, {
    method: "PUT",
    json: { minOfferCents },
  });
}

/** The floor on a listing that sells identical slots, where one number is right for all of them. */
export function setListingFloor(spaceId: string, minOfferCents: number | null): Promise<{ space: SpaceView }> {
  return call<{ space: SpaceView }>(`ad-space/spaces/${spaceId}/min-offer`, {
    method: "PUT",
    json: { minOfferCents },
  });
}

/* ── What arrived, and what you owe ───────────────────────────────── */

export function getSales(): Promise<{ sales: SalesSummary }> {
  return call<{ sales: SalesSummary }>("ad-space/sales");
}

/** The link that proves one sponsor's spot was delivered. */
export function markPositionDelivered(positionId: string, url: string): Promise<unknown> {
  return call(`ad-space/positions/${positionId}/delivered`, { json: { url } });
}

/** The link that proves one of the listing's own promises was kept. */
export function markDeliverableDelivered(deliverableId: string, url: string): Promise<unknown> {
  return call(`ad-space/deliverables/${deliverableId}/delivered`, { json: { url } });
}

/**
 * Yes or no to what a sponsor sent.
 *
 * `submittedAt` is the version the creator looked at: an approval applies to
 * that artwork only, never to one the sponsor swapped in since.
 */
export function reviewContent(
  positionId: string,
  approve: boolean,
  submittedAt: string,
  reason?: string | null,
): Promise<unknown> {
  return call(`ad-space/positions/${positionId}/content/review`, {
    json: { approve, submittedAt, reason: reason ?? null },
  });
}

export function addUpdate(spaceId: string, body: string): Promise<{ update: SpaceUpdate }> {
  return call<{ update: SpaceUpdate }>(`ad-space/spaces/${spaceId}/updates`, { json: { body } });
}

export function removeUpdate(spaceId: string, updateId: string): Promise<{ removed: boolean }> {
  return call<{ removed: boolean }>(`ad-space/spaces/${spaceId}/updates/${updateId}`, { method: "DELETE" });
}
