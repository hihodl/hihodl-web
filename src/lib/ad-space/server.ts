// Server-only by construction: no "use client" file imports this module.
import { lookOf } from "./product-look";
import { AD_SPACE_API, HANDLE_RE, SLUG_RE } from "./config";
import { isExpiredLink } from "./enquiry-rules";
import { defaultEventTab, openSpots } from "./format";
import { gradientKey } from "./look";
import type {
  Booking,
  BrandProduction,
  PublicBrief,
  CreatorPage,
  EventOrganiser,
  EventPage,
  EventSummary,
  GuestEnquiry,
  ListedEvent,
  LumaTeaser,
  OfferThread,
  PhotoRect,
  Position,
  Space,
  SpaceCard,
  SpacePhoto,
  SpaceTab,
  SponsorPage,
} from "./types";

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

/**
 * The creator's own read of a space, drafts included: what the app's editor
 * draws (`/app/preview/<id>?embed=app`). `token` is the creator's Supabase
 * access token, passed through as the bearer and nothing else: not cached
 * (`no-store`), not logged, not kept.
 *
 * `owner` only when the backend says the caller IS the creator: the owner
 * route answers a live space to anybody signed in, with `isCreator: false`,
 * and that is the public page, not the editor.
 */
export type OwnerLookup =
  | { kind: "owner"; space: Space }
  | { kind: "auth" }
  | { kind: "notOwner" }
  | { kind: "unreachable" };

export async function getOwnerSpace(spaceId: string, token: string, from: Headers | null): Promise<OwnerLookup> {
  if (!UUID_RE.test(spaceId)) return { kind: "notOwner" };
  if (fixtureEnabled()) {
    const { fixtureSpace } = await import("./fixture.dev");
    const space = fixtureSpace("id", spaceId);
    return space ? { kind: "owner", space: withEventFields(space) } : { kind: "notOwner" };
  }
  try {
    const res = await fetch(`${AD_SPACE_API}/spaces/${spaceId}`, {
      headers: upstreamHeaders(from, { authorization: `Bearer ${token}` }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 401) return { kind: "auth" };
    if (res.status === 403 || res.status === 404) return { kind: "notOwner" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { space?: Space & { isCreator?: boolean } } };
    const space = body?.data?.space;
    if (!space) return { kind: "unreachable" };
    if (space.isCreator !== true) return { kind: "notOwner" };
    return { kind: "owner", space: withEventFields(space) };
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
  const positions = (Array.isArray(raw.positions) ? raw.positions : []).map(withTierFields);
  const photo = usablePhoto(raw.photo, positions);
  // One photo for the whole product wins; the two are never both set by the API.
  const viewPhotos = photo ? {} : usableViewPhotos(raw.viewPhotos, raw.template, positions);
  const onSides = new Set(
    (raw.template?.zones ?? []).filter((z) => viewPhotos[z.viewKey]).map((z) => z.zoneKey),
  );
  return {
    ...raw,
    // An organiser's event package (`event_asset`) is N identical slots with
    // no zones, which is exactly how this page draws a service.
    ...serviceKindOf(raw),
    // With no photo to draw them on, squares are dropped too, so nothing
    // downstream can place one on the catalog drawing by mistake.
    positions: photo ? positions : positions.map((p) => (onSides.has(p.zoneKey) ? p : { ...p, rect: null })),
    photo,
    viewPhotos,
    productLook: lookOf(raw.productLook),
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

/**
 * `event_asset` (organiser-sells-its-event-contract.md) read as `service`, on
 * the space and on its template, so every reader that branches on the kind
 * sells an event package the way it sells slots. Nothing for any other kind.
 */
function serviceKindOf(raw: Space): Partial<Pick<Space, "kind" | "template">> {
  const own = (raw.kind as string) === "event_asset";
  const tpl = raw.template && (raw.template.kind as string) === "event_asset";
  if (!own && !tpl) return {};
  return {
    kind: own ? "service" : raw.kind,
    ...(raw.template ? { template: { ...raw.template, kind: tpl ? "service" : raw.template.kind } } : {}),
  };
}

/** A square that is really inside the photo, or null. */
function usableRect(r: unknown): PhotoRect | null {
  if (!r || typeof r !== "object") return null;
  const { x, y, w, h } = r as Record<string, unknown>;
  if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const q = { x: x as number, y: y as number, w: w as number, h: h as number };
  if (q.x < 0 || q.y < 0 || q.w <= 0 || q.h <= 0 || q.x + q.w > 1.00001 || q.y + q.h > 1.00001) return null;
  return q;
}

/**
 * The creator's photo, only when it can be drawn whole: a URL, a real size and
 * a square for every position. Anything less (a server older than photos, a
 * creator halfway through placing squares) draws the catalog, as before.
 */
function usablePhoto(raw: unknown, positions: Position[]): SpacePhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.url !== "string" || !p.url.startsWith("https://")) return null;
  if (typeof p.width !== "number" || typeof p.height !== "number" || p.width <= 0 || p.height <= 0) return null;
  if (p.ready === false) return null;
  // The position that sells the WHOLE listing has no square on the product by
  // design — what it sells IS the product. Asking it for a rectangle would
  // throw away the creator's real photo on exactly the listings this feature
  // exists for (ad-space-whole-listing-v0.md).
  const squares = positions.filter((pos) => !pos.takesEverything);
  if (squares.length === 0 || squares.some((pos) => !usableRect(pos.rect))) return null;
  return { url: p.url, width: p.width, height: p.height };
}

/** A photo URL this page may draw: the API's public bucket is https. */
function drawableUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("https://");
}

/**
 * The sides with their own photo that can be drawn whole: a URL, a real size
 * and a square for every spot on that side. A side that is not ready keeps
 * the drawing; the others show their photo.
 */
function usableViewPhotos(raw: unknown, template: Space["template"] | undefined, positions: Position[]): Record<string, SpacePhoto> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !template) return {};
  const out: Record<string, SpacePhoto> = {};
  for (const [view, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const p = v as Record<string, unknown>;
    if (!drawableUrl(p.url)) continue;
    if (typeof p.width !== "number" || typeof p.height !== "number" || p.width <= 0 || p.height <= 0) continue;
    if (p.ready === false) continue;
    const keys = new Set(template.zones.filter((z) => z.viewKey === view).map((z) => z.zoneKey));
    const onSide = positions.filter((pos) => keys.has(pos.zoneKey));
    if (onSide.length === 0 || onSide.some((pos) => !usableRect(pos.rect))) continue;
    out[view] = { url: p.url, width: p.width, height: p.height };
  }
  return out;
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
    data?: {
      event?: EventSummary;
      tabs?: Partial<EventPage["tabs"]>;
      defaultTab?: unknown;
      redirectTo?: string;
      packages?: unknown;
      organiser?: unknown;
    };
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
  // A backend older than organiser packages sends neither key: no packages, no host.
  const packages = cardsOf(data.packages);
  const sold = new Set(packages.map((c) => c.spaceId));
  // A package is said once, above the tabs, even if a server lists it in one too.
  const notAPackage = (c: SpaceCard) => !sold.has(c.spaceId);
  const tabs = {
    ground: (data.tabs?.ground ?? []).map(withCardDefaults).filter(notAPackage),
    feed: (data.tabs?.feed ?? []).map(withCardDefaults).filter(notAPackage),
    // A backend that predates sessions sends no `room`.
    room: (data.tabs?.room ?? []).map(withCardDefaults).filter(notAPackage),
  };
  const fromApi =
    data.defaultTab === "ground" || data.defaultTab === "feed" || data.defaultTab === "room" ? data.defaultTab : null;
  const organiser = organiserOf(data.event.organiser) ?? organiserOf(data.organiser);
  return {
    kind: "found",
    page: { event: { ...data.event, organiser }, tabs, defaultTab: fromApi ?? defaultEventTab(tabs), packages },
  };
}

/** Cards from an API list, or none for anything that is not one. */
function cardsOf(raw: unknown): SpaceCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is SpaceCard => !!c && typeof c === "object" && typeof (c as SpaceCard).spaceId === "string")
    .map(withCardDefaults);
}

/** The verified host, or null: an unverified or nameless one is shown as nobody. */
function organiserOf(raw: unknown): EventOrganiser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.verified !== true || typeof o.name !== "string" || !o.name.trim()) return null;
  return {
    name: o.name.trim(),
    avatarUrl: typeof o.avatarUrl === "string" && /^https:\/\//.test(o.avatarUrl) ? o.avatarUrl : null,
    verified: true,
    businessName: typeof o.businessName === "string" && o.businessName.trim() ? o.businessName.trim() : null,
  };
}

/* ── An organiser's sponsor page (/sponsor/<lumaKey>) ────────────────── */

/** A Luma event's path, as `luma.com/<key>` writes it. */
export const LUMA_KEY_RE = /^[A-Za-z0-9_-]{1,120}$/;

/**
 * `notOnHold`: no Spaces event for that Luma page, or one nobody has proved
 * they host. It is also what a backend older than this page answers (a plain
 * 404), so an old server shows the invitation to sell rather than an error.
 */
export type SponsorLookup =
  | { kind: "found"; page: SponsorPage }
  | { kind: "notOnHold"; luma: LumaTeaser | null }
  | { kind: "unreachable" };

/** @param revalidate seconds; the same window as an event page. */
export async function getSponsorPage(lumaKey: string, revalidate = 30): Promise<SponsorLookup> {
  if (!LUMA_KEY_RE.test(lumaKey)) return { kind: "notOnHold", luma: null };
  if (fixtureEnabled()) return { kind: "notOnHold", luma: null };

  let body: unknown;
  let status: number;
  try {
    const res = await fetch(`${AD_SPACE_API}/public/sponsor/${encodeURIComponent(lumaKey)}`, {
      headers: upstreamHeaders(null),
      next: { revalidate },
      signal: AbortSignal.timeout(6_000),
    });
    status = res.status;
    if (status !== 404 && !res.ok) return { kind: "unreachable" };
    body = await res.json().catch(() => null);
  } catch {
    return { kind: "unreachable" };
  }

  if (status === 404) return { kind: "notOnHold", luma: lumaTeaserOf(body) };

  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  const event = data?.event as EventSummary | undefined;
  if (!event || typeof event.slug !== "string" || typeof event.name !== "string") return { kind: "unreachable" };
  const organiser = organiserOf(event.organiser);
  // The page exists to show a verified host's packages; without the host it is not theirs to sell.
  if (!organiser) return { kind: "notOnHold", luma: { name: event.name, coverUrl: event.coverUrl, startAt: event.startsOn, city: event.city } };
  const slug = typeof data?.slug === "string" && SLUG_RE.test(data.slug) ? data.slug : event.slug;
  return {
    kind: "found",
    page: {
      event: { ...event, organiser },
      packages: cardsOf(data?.packages),
      creators: creatorCounts(data?.creators),
      slug,
    },
  };
}

/**
 * The full listing behind each live package, read in parallel, so its row can
 * open the same checkout and sheets as its own page. A package that cannot be
 * read is left out of the map, and its row links to its page instead.
 */
export async function getPackageSpaces(cards: SpaceCard[]): Promise<Record<string, Space>> {
  const out: Record<string, Space> = {};
  await Promise.all(
    cards.slice(0, 12).map(async (c) => {
      const m = /^\/s\/([^/?#]+)\/([^/?#]+)\/?$/.exec(c.path);
      if (!m || c.status !== "live") return;
      let handle: string;
      let slug: string;
      try {
        handle = decodeURIComponent(m[1]).replace(/^@/, "");
        slug = decodeURIComponent(m[2]);
      } catch {
        return;
      }
      const found = await getPublicSpace(handle, slug);
      if (found.kind === "found" && found.space.id === c.spaceId) out[c.spaceId] = found.space;
    }),
  );
  return out;
}

/** `{ ground, feed, room }` as numbers; a list counts as its length, anything else as zero. */
function creatorCounts(raw: unknown): Record<SpaceTab, number> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = (v: unknown) =>
    Array.isArray(v) ? v.length : typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  return { ground: n(o.ground), feed: n(o.feed), room: n(o.room) };
}

/**
 * The Luma event's name and picture from a 404 `event_not_on_hold`. The
 * backend's error envelope puts extra fields under `error.details`; the other
 * places are read too, so a small change of envelope never loses the name.
 */
function lumaTeaserOf(body: unknown): LumaTeaser | null {
  const b = body && typeof body === "object" ? (body as Record<string, any>) : null;
  const raw = b?.error?.details?.luma ?? b?.error?.luma ?? b?.data?.luma ?? b?.luma ?? null;
  if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || !raw.name.trim()) return null;
  return {
    name: raw.name.trim(),
    coverUrl: typeof raw.coverUrl === "string" && /^https:\/\//.test(raw.coverUrl) ? raw.coverUrl : null,
    startAt: typeof raw.startAt === "string" ? raw.startAt : null,
    city: typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : null,
  };
}

/**
 * Upcoming events with something for sale, for the /events index. `hasPackages`
 * asks for those whose organiser sells on HOLD; a server older than packages
 * ignores the flag, so the rows are filtered again here.
 * Null when the API did not answer, which the page says rather than "nothing".
 */
export async function listUpcomingEvents({
  hasPackages = false,
  limit = 100,
}: { hasPackages?: boolean; limit?: number } = {}): Promise<ListedEvent[] | null> {
  if (fixtureEnabled()) {
    const { fixtureEvents } = await import("./fixture.dev");
    return hasPackages ? [] : fixtureEvents();
  }
  try {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (hasPackages) qs.set("hasPackages", "true");
    const res = await fetch(`${AD_SPACE_API}/public/events?${qs}`, {
      headers: upstreamHeaders(null),
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { events?: ListedEvent[] } };
    const events = body?.data?.events;
    if (!Array.isArray(events)) return null;
    const rows = events
      .filter((e) => e && typeof e.slug === "string" && typeof e.name === "string")
      .map((e) => ({ ...e, organiser: organiserOf(e.organiser) }));
    // Packages need a verified host: a row without the count is kept only when
    // it has one, which also leaves an old server's list (no hosts) empty.
    const sells = (e: ListedEvent) => (typeof e.packages === "number" ? e.packages > 0 : !!e.organiser);
    return hasPackages ? rows.filter(sells) : rows;
  } catch {
    return null;
  }
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

/* ── A creator's hub ─────────────────────────────────────────────────── */

export type CreatorLookup =
  | { kind: "found"; page: CreatorPage }
  | { kind: "missing" }
  | { kind: "unreachable" };

/**
 * `GET /public/creators/:handle`. The handle is case-insensitive upstream, and
 * a reader who pasted `@handle` from a post gets the same page: the `@` is
 * dropped here rather than turned into a 404 nobody can explain.
 *
 * A 404 covers both a handle nobody has and a handle with nothing listable, and
 * so does an answer with no groups at all — an empty hub is a page that says a
 * creator sells nothing, which is worse than the honest "there is nothing at
 * this link". `unreachable` stays separate, as everywhere else here.
 *
 * @param revalidate seconds; the hub is an event page's sibling and matches it.
 */
export async function getPublicCreator(handle: string, revalidate = 30): Promise<CreatorLookup> {
  const bare = handle.replace(/^@/, "");
  if (!HANDLE_RE.test(bare)) return { kind: "missing" };

  let body: { data?: Partial<CreatorPage> } | null;
  if (fixtureEnabled()) {
    const { fixtureCreator } = await import("./fixture.dev");
    const page = fixtureCreator(bare);
    if (!page) return { kind: "missing" };
    body = { data: page };
  } else {
    try {
      const res = await fetch(`${AD_SPACE_API}/public/creators/${encodeURIComponent(bare)}`, {
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
  const creator = data?.creator;
  if (!creator?.xHandle) return { kind: "unreachable" };

  const groups = (Array.isArray(data?.groups) ? (data?.groups ?? []) : [])
    // Kept in the server's order, which is the one thing about this list the
    // page must not have an opinion about.
    .map((g) => ({
      event: g?.event ?? null,
      othersAtEvent: Math.max(0, Math.trunc(Number(g?.othersAtEvent) || 0)),
      cards: (Array.isArray(g?.cards) ? g.cards : []).map(withCardDefaults),
    }))
    .filter((g) => g.cards.length > 0);
  if (groups.length === 0) return { kind: "missing" };

  const totals = data?.totals;
  return {
    kind: "found",
    page: {
      creator,
      groups,
      totals: {
        spaces: totals?.spaces ?? groups.reduce((n, g) => n + g.cards.length, 0),
        openSpots: totals?.openSpots ?? groups.reduce((n, g) => n + openSpots(g.cards), 0),
        events: totals?.events ?? groups.filter((g) => g.event).length,
      },
    },
  };
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

/* ── Content production: the brand's delivery page ───────────────────── */

export type ProductionLookup =
  | { kind: "found"; production: BrandProduction }
  | { kind: "missing" }
  | { kind: "unreachable" };

/**
 * `GET /public/productions/:token`, never cached: a delivery can arrive at any
 * moment. The token is a bearer secret, so it goes into the upstream URL and
 * nowhere else.
 */
export async function getProduction(token: string, from: Headers | null): Promise<ProductionLookup> {
  if (!BOOKING_TOKEN_RE.test(token)) return { kind: "missing" };

  if (fixtureEnabled()) {
    const { fixtureProduction } = await import("./fixture.dev");
    const production = fixtureProduction(token);
    return production ? { kind: "found", production } : { kind: "missing" };
  }

  try {
    const res = await fetch(`${AD_SPACE_API}/public/productions/${encodeURIComponent(token)}`, {
      headers: upstreamHeaders(from),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { production?: BrandProduction } };
    const production = body?.data?.production;
    return production?.production ? { kind: "found", production } : { kind: "unreachable" };
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

/* ── A guest's question to a seller, by its link ───────────────────── */

export type EnquiryLookup =
  | { kind: "found"; enquiry: GuestEnquiry }
  | { kind: "missing" }
  /** The link went 90 days without a message (410, or a code naming the expiry). */
  | { kind: "expired" }
  | { kind: "unreachable" };

/**
 * `GET /public/enquiries/:token` (spot-enquiries-contract.md), never cached: a
 * seller's reply can arrive at any moment, and opening it tells the seller the
 * guest has seen the thread. The token is a bearer secret, handled like an
 * offer's: the upstream URL and nowhere else.
 */
export async function getEnquiry(token: string, from: Headers | null): Promise<EnquiryLookup> {
  if (!OFFER_TOKEN_RE.test(token)) return { kind: "missing" };
  if (fixtureEnabled()) {
    const { fixtureEnquiry } = await import("./fixture.dev");
    const enquiry = fixtureEnquiry(token);
    return enquiry ? { kind: "found", enquiry } : { kind: "missing" };
  }
  try {
    const res = await fetch(`${AD_SPACE_API}/public/enquiries/${encodeURIComponent(token)}`, {
      headers: upstreamHeaders(from),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      const code = await res
        .json()
        .then((b: { error?: { code?: unknown } }) => (typeof b?.error?.code === "string" ? b.error.code : null))
        .catch(() => null);
      if (isExpiredLink(res.status, code)) return { kind: "expired" };
      if (res.status === 404) return { kind: "missing" };
      return { kind: "unreachable" };
    }
    const body = (await res.json()) as { data?: { enquiry?: Partial<GuestEnquiry> } };
    const e = body?.data?.enquiry;
    return e?.space && e.business && Array.isArray(e.messages)
      ? {
          kind: "found",
          enquiry: {
            space: e.space,
            position: e.position ?? null,
            business: e.business,
            you: e.you ?? { name: "", company: null },
            messages: e.messages,
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


/* ── Briefs: the page a brand posts the link to ────────────────────── */

/**
 * Reading one brief on the server.
 *
 * Ten seconds of cache, the same as a space: what changes here is somebody
 * entering and the winner being named, and both are worth showing quickly.
 *
 * A withdrawn brief is `missing` — the backend answers 404 for it, because a
 * brand that takes its call down must be able to take the page down with it.
 * `unreachable` is never turned into `missing`: telling somebody who followed
 * the link that the campaign does not exist, when the truth is that our API
 * timed out, is the one thing this page must not say.
 */
export type BriefLookup =
  | { kind: "found"; brief: PublicBrief }
  | { kind: "missing" }
  | { kind: "unreachable" };

/** The shape of a brief's public address: words, then the tail that keeps it unique. */
export const BRIEF_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,88}[a-z0-9])?$/i;

export async function getPublicBrief(slug: string, revalidate = 10): Promise<BriefLookup> {
  if (!BRIEF_SLUG_RE.test(slug)) return { kind: "missing" };
  try {
    const res = await fetch(`${AD_SPACE_API}/public/briefs/${encodeURIComponent(slug.toLowerCase())}`, {
      headers: upstreamHeaders(null),
      next: { revalidate },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body: { data?: { brief?: PublicBrief } } = await res.json();
    const brief = body?.data?.brief;
    // A brief with no title is not a brief we can draw a page from, and it is
    // an answer we did not understand rather than one that said "gone".
    if (!brief?.slug || !brief.title) return { kind: "unreachable" };
    return { kind: "found", brief };
  } catch {
    return { kind: "unreachable" };
  }
}

/**
 * The open briefs, for the sitemap and any board that lists them.
 *
 * An empty list on any failure, on purpose: the sitemap ships without them
 * rather than not at all.
 */
export async function listPublicBriefs(limit = 50): Promise<PublicBrief[]> {
  try {
    const res = await fetch(`${AD_SPACE_API}/public/briefs?limit=${Math.min(Math.max(limit, 1), 50)}`, {
      headers: upstreamHeaders(null),
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const body: { data?: { briefs?: PublicBrief[] } } = await res.json();
    return (body?.data?.briefs ?? []).filter((b) => !!b?.slug);
  } catch {
    return [];
  }
}
