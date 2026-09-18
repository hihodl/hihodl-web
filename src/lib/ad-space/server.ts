// Server-only by construction: no "use client" file imports this module.
import { AD_SPACE_API, HANDLE_RE, SLUG_RE } from "./config";
import { defaultEventTab } from "./format";
import { gradientKey } from "./look";
import type { Booking, EventPage, EventSummary, OfferThread, Position, Space, SpaceCard } from "./types";

/**
 * Reading a public Ad Space on the server.
 *
 * `found` and `missing` are answers; `unreachable` is not. A page that turns
 * "the API timed out" into a 404 tells a sponsor holding a shared link that the
 * space is gone, which is the one thing it must never say about a live board.
 */
export type SpaceLookup =
  | { kind: "found"; space: Space }
  | { kind: "missing" }
  | { kind: "unreachable" };

/* ── Calling the backend from our servers ───────────────────────────── */

/** An IPv4 or IPv6 address as a proxy writes it, and nothing that could smuggle a header. */
const IP_RE = /^[0-9A-Fa-f:.]{2,45}$/;

/**
 * The visitor's address from the headers our host sets: the first entry of
 * `x-forwarded-for`, else `x-real-ip`. Null when neither holds an address.
 */
export function visitorIpFrom(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && IP_RE.test(forwarded)) return forwarded;
  const real = h.get("x-real-ip")?.trim();
  return real && IP_RE.test(real) ? real : null;
}

/**
 * Headers for every server-side call to the public Ad Space API. Nothing else
 * builds them, and no client component may import this module.
 *
 * Every render reaches the backend from a handful of Vercel addresses, so the
 * backend's per-IP limiter would otherwise count all our visitors as one.
 * `x-hold-web-key` proves the call is ours (server-only env, never
 * NEXT_PUBLIC); `x-hold-client-ip` names the person the call is for, so the
 * limit still applies to them. Each is left out when it is unknown.
 *
 * Pass the request's headers only to an uncached call (`cache: "no-store"`).
 * Next folds request headers into the Data Cache key, so a visitor IP on a
 * `next: { revalidate }` fetch gives every visitor their own cache entry and
 * the 10 s / 30 s window stops protecting the backend at all. Cached reads
 * go out with the key alone: one call per URL per window, whoever is looking.
 *
 * @param from the incoming request's headers, or null for a cached read or a
 *   call with no visitor behind it (the sitemap, a link card crawler).
 */
export function upstreamHeaders(from: Headers | null, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { accept: "application/json", ...extra };
  const key = process.env.AD_SPACE_WEB_KEY;
  if (key) out["x-hold-web-key"] = key;
  const ip = from ? visitorIpFrom(from) : null;
  if (ip) out["x-hold-client-ip"] = ip;
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The backend's share link is `/s/<handle>/<slug>`, or `/s/id/<spaceId>` for a
 * space whose creator has no handle on record. Both land on this route.
 */
function upstreamPath(handle: string, slug: string): string | null {
  if (handle === "id" && UUID_RE.test(slug)) return `/public/spaces/${slug}`;
  if (!HANDLE_RE.test(handle) || !SLUG_RE.test(slug)) return null;
  return `/public/spaces/by-path/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`;
}

/**
 * Local rendering without a backend. Opt-in, development only, and never a
 * fallback: `AD_SPACE_FIXTURE=1 npm run dev`. A production build ignores the
 * flag entirely, so a missing API can never serve made-up spots to a sponsor.
 */
export function fixtureEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AD_SPACE_FIXTURE === "1";
}

/**
 * @param revalidate seconds. The API sends `max-age=10`; the page matches it
 *   so a sold spot shows as sold within seconds of the chain saying so.
 */
export async function getPublicSpace(
  handle: string,
  slug: string,
  revalidate = 10,
): Promise<SpaceLookup> {
  if (fixtureEnabled()) {
    const { fixtureSpace } = await import("./fixture.dev");
    const space = fixtureSpace(handle, slug);
    return space ? { kind: "found", space: withEventFields(space) } : { kind: "missing" };
  }

  const path = upstreamPath(handle, slug);
  if (!path) return { kind: "missing" };

  try {
    const res = await fetch(`${AD_SPACE_API}${path}`, {
      headers: upstreamHeaders(null),
      next: { revalidate },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { space?: Space } };
    const space = body?.data?.space;
    return space ? { kind: "found", space: withEventFields(space) } : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}

/** The only per-rung modes the page knows how to sell (ad-space-tiers-v0.md). */
const SALE_MODES = new Set(["fixed", "fixed_with_offers", "offers", "bids"]);

/**
 * A position's tier fields (ad-space-tiers-v0.md), filled in for a server that
 * predates tiers and for one that sends them as something other than a list of
 * strings. `perks` is plain text by contract; here it is also made plain text
 * by construction, so nothing downstream can be handed an object to render.
 *
 * `tierKey` null is the old shapes — a placement's zones, N identical slots —
 * and every reader keeps rendering them exactly as it did.
 */
function withTierFields(p: Position): Position {
  const perks = Array.isArray(p.perks) ? p.perks : [];
  return {
    ...p,
    tierKey: typeof p.tierKey === "string" && p.tierKey ? p.tierKey : null,
    // A mode this page has no button for is not a mode: it reads as null, which
    // is "sells the way its space does" and the behaviour of every space that
    // predates per-rung modes. `takeover` is deliberately among them — it is
    // the space's to declare, never a rung's.
    saleMode: SALE_MODES.has(p.saleMode as string) ? (p.saleMode as Position["saleMode"]) : null,
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : null,
    // Five is the database's limit; a longer list would be a server we do not
    // know, and the page still shows the five the creator was allowed to write.
    perks: perks.filter((line): line is string => typeof line === "string" && line.trim().length > 0).slice(0, 5),
  };
}

/**
 * The event fields, filled in when a backend that predates them leaves them
 * out, and the gradient held to the five presets. Every reader downstream can
 * then trust the type instead of checking for undefined.
 */
function withEventFields(space: Space): Space {
  const raw = space as Partial<Space> & Space;
  return {
    ...raw,
    positions: (Array.isArray(raw.positions) ? raw.positions : []).map(withTierFields),
    event: raw.event ?? null,
    bannerUrl: raw.bannerUrl ?? null,
    bannerGradient: gradientKey(raw.bannerGradient),
    siblings: Array.isArray(raw.siblings) ? raw.siblings : [],
    // hispace-offers-v0.md: absent on a server older than offers.
    acceptsOffers: raw.acceptsOffers === true,
    biddingEndsAt: raw.biddingEndsAt ?? null,
    spaceOffers: raw.spaceOffers ?? null,
    // A server older than custom services and free-text deliverables.
    serviceName: raw.serviceName ?? null,
    serviceSummary: raw.serviceSummary ?? null,
    /* A server older than funding goals sends no key, and a creator who named
       none sends null. Zero is treated as none too: a goal of nothing has no
       percentage to be at, and the page must never print "null%" or divide by
       it. Anything that is not a positive number reads as "no goal", so the
       hero falls back to counting spots exactly as it does today. */
    fundingGoalCents:
      typeof raw.fundingGoalCents === "number" && Number.isFinite(raw.fundingGoalCents) && raw.fundingGoalCents > 0
        ? Math.round(raw.fundingGoalCents)
        : null,
    deliverables: (Array.isArray(raw.deliverables) ? raw.deliverables : []).map((d) => ({
      ...d,
      platform: d.platform ?? null,
      note: d.note ?? null,
    })),
  };
}

/* ── Events ──────────────────────────────────────────────────────────── */

/**
 * `moved`: the slug belonged to an event merged into another. The page answers
 * with a permanent redirect so a link already shared on X keeps working.
 */
export type EventLookup =
  | { kind: "found"; page: EventPage }
  | { kind: "moved"; slug: string }
  | { kind: "missing" }
  | { kind: "unreachable" };

function withCardDefaults(card: SpaceCard): SpaceCard {
  return { ...card, bannerUrl: card.bannerUrl ?? null, bannerGradient: gradientKey(card.bannerGradient) };
}

/** @param revalidate seconds; the API sends `max-age=30` for event pages. */
export async function getPublicEvent(slug: string, revalidate = 30): Promise<EventLookup> {
  if (!SLUG_RE.test(slug)) return { kind: "missing" };

  let body: {
    data?: { event?: EventSummary; tabs?: Partial<EventPage["tabs"]>; defaultTab?: unknown; redirectTo?: string };
  } | null;
  if (fixtureEnabled()) {
    const { fixtureEvent } = await import("./fixture.dev");
    const data = fixtureEvent(slug);
    if (!data) return { kind: "missing" };
    body = { data };
  } else {
    try {
      const res = await fetch(`${AD_SPACE_API}/public/events/${encodeURIComponent(slug)}`, {
        headers: upstreamHeaders(null),
        next: { revalidate },
        signal: AbortSignal.timeout(6_000),
      });
      if (res.status === 404) return { kind: "missing" };
      if (!res.ok) return { kind: "unreachable" };
      body = await res.json();
    } catch {
      return { kind: "unreachable" };
    }
  }

  const data = body?.data;
  if (typeof data?.redirectTo === "string" && SLUG_RE.test(data.redirectTo) && data.redirectTo !== slug) {
    return { kind: "moved", slug: data.redirectTo };
  }
  if (!data?.event) return { kind: "unreachable" };
  const tabs = {
    ground: (data.tabs?.ground ?? []).map(withCardDefaults),
    feed: (data.tabs?.feed ?? []).map(withCardDefaults),
    // A backend that predates sessions sends no `room`.
    room: (data.tabs?.room ?? []).map(withCardDefaults),
  };
  const fromApi =
    data.defaultTab === "ground" || data.defaultTab === "feed" || data.defaultTab === "room" ? data.defaultTab : null;
  return {
    kind: "found",
    page: { event: data.event, tabs, defaultTab: fromApi ?? defaultEventTab(tabs) },
  };
}

/**
 * Upcoming and ongoing events with at least one live space, for the sitemap.
 * An empty list on any failure: a sitemap that cannot list events still lists
 * every other page.
 */
export async function listPublicEvents(limit = 50): Promise<EventSummary[]> {
  if (fixtureEnabled()) {
    const { fixtureEvents } = await import("./fixture.dev");
    return fixtureEvents();
  }
  try {
    const res = await fetch(`${AD_SPACE_API}/public/events?limit=${limit}`, {
      headers: upstreamHeaders(null),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { events?: EventSummary[] } };
    const events = body?.data?.events;
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

/* ── A booked session, by its manage link ────────────────────────────── */

/**
 * The token in `/b/<token>`: 32 random bytes. The contract does not fix the
 * encoding, so anything URL-safe of a sane length is passed on and the server
 * decides; the check only keeps junk out of the upstream path.
 */
export const BOOKING_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export type BookingLookup =
  | { kind: "found"; booking: Booking }
  | { kind: "missing" }
  | { kind: "unreachable" };

/**
 * `GET /public/bookings/:token`, never cached: the page is the buyer's own and
 * changes when the creator schedules. The token is a bearer secret, so it goes
 * into the upstream URL and nowhere else: no log line, no error message, no
 * cache key of ours.
 *
 * @param from the visitor's request headers, so the backend limits the visitor
 *   and not our server.
 */
export async function getBooking(token: string, from: Headers | null): Promise<BookingLookup> {
  if (!BOOKING_TOKEN_RE.test(token)) return { kind: "missing" };

  if (fixtureEnabled()) {
    const { fixtureBooking } = await import("./fixture.dev");
    const booking = fixtureBooking(token);
    return booking ? { kind: "found", booking } : { kind: "missing" };
  }

  try {
    const res = await fetch(`${AD_SPACE_API}/public/bookings/${encodeURIComponent(token)}`, {
      headers: upstreamHeaders(from),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { booking?: Booking } };
    const booking = body?.data?.booking;
    return booking?.order?.session ? { kind: "found", booking } : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}

/* ── An offer or bid, by its manage link ─────────────────────────────── */

/** 32 random bytes, base64url, no padding (hispace-offers-v0.md). */
export const OFFER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export type OfferLookup =
  | { kind: "found"; thread: OfferThread }
  | { kind: "missing" }
  | { kind: "unreachable" };

/**
 * `GET /public/offers/:token`, never cached: a counter or an acceptance can
 * arrive at any moment. The token is a bearer secret, so it goes into the
 * upstream URL and nowhere else: no log line, no error message, no cache key.
 *
 * @param from the visitor's request headers, so the backend limits the visitor
 *   and not our server.
 */
export async function getOffer(token: string, from: Headers | null): Promise<OfferLookup> {
  if (!OFFER_TOKEN_RE.test(token)) return { kind: "missing" };

  if (fixtureEnabled()) {
    const { fixtureOffer } = await import("./fixture.dev");
    const thread = fixtureOffer(token);
    return thread ? { kind: "found", thread } : { kind: "missing" };
  }

  try {
    const res = await fetch(`${AD_SPACE_API}/public/offers/${encodeURIComponent(token)}`, {
      headers: upstreamHeaders(from),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: Partial<OfferThread> };
    const data = body?.data;
    return data?.offer && data.space
      ? {
          kind: "found",
          // The spot comes from a different endpoint than the board, so its
          // tier fields are filled here too: the offer page prints a tier's
          // name and its lines from the same shape the board does.
          thread: {
            offer: data.offer,
            space: data.space,
            position: data.position ? withTierFields(data.position) : null,
          },
        }
      : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}

/** The full public space by id, for paying an accepted offer with the page's checkout. */
export function getPublicSpaceById(spaceId: string): Promise<SpaceLookup> {
  return getPublicSpace("id", spaceId);
}
