/**
 * Who is looking, and what is waiting on them, worked out from reads the
 * console already makes. Nothing here calls anything.
 */

import type { XAccountStatus } from "@/lib/creator/types";
import {
  centsFromUsdc,
  type DeliverableView,
  type OfferView,
  type PositionView,
  type ProductionView,
  type SalesListing,
  type SalesSummary,
  type SpaceCard,
  type SpaceView,
  type TemplateKind,
} from "@/lib/creator/listing";
import type { TeamMember, WorkDeliverable, WorkListing, WorkSlot } from "@/lib/creator/team";
import { t, type MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";

/* ── Role ─────────────────────────────────────────────────────────── */

/**
 * `creator`: sells their own listings (or is about to). `manager`: sells for
 * somebody else and has nothing of their own. `rep`: delivers for somebody
 * else and sees no money.
 *
 * Somebody with listings of their own, or an X account linked, is a creator
 * even if they also sit on another creator's team; a brand-new account with
 * no seats is a creator who has not started yet.
 */
export type ShellRole = "creator" | "manager" | "rep";

export function roleOf(listings: readonly SpaceCard[], seats: readonly TeamMember[], x: XAccountStatus | null | undefined): ShellRole {
  const active = seats.filter((s) => s.status === "active");
  if (listings.length > 0 || x?.linked || active.length === 0) return "creator";
  return active.some((s) => s.role === "manager") ? "manager" : "rep";
}

/* ── Deliveries ───────────────────────────────────────────────────── */

export type DeliveryKind = "artwork" | "spot" | "promise" | "production";
export type DeliveryState = "todo" | "overdue" | "waiting" | "done";

export interface DeliveryItem {
  /** `artwork:<positionId>`, `spot:<positionId>`, `promise:<deliverableId>`. */
  id: string;
  kind: DeliveryKind;
  state: DeliveryState;
  spaceId: string;
  listing: string;
  title: string;
  sub: string;
  /** A day to sort by: the promise's date, or the listing's deliver-by. */
  due: string | null;
  owner:
    | { space: SpaceView; position?: PositionView; deliverable?: DeliverableView }
    | null;
  member: { listing: WorkListing; slot?: WorkSlot; deliverable?: WorkDeliverable } | null;
  /** Content production: the spot's brief, due time and private delivery. */
  production?: ProductionView;
}

/**
 * Where a production spot stands, in the list's four words: owed (or owed
 * again after a revision), late, with the brand, accepted.
 */
function productionState(p: ProductionView): DeliveryState {
  switch (p.state) {
    case "accepted":
      return "done";
    case "delivered":
      return "waiting";
    case "overdue":
      return "overdue";
    default:
      return "todo";
  }
}

const GOAL_TEXT: Record<string, MessageKey> = {
  awareness: "spaces.goal.awareness",
  product_launch: "spaces.goal.productLaunch",
  hiring: "spaces.goal.hiring",
  community: "spaces.goal.community",
};

function goalText(goal: string): string | null {
  const k = GOAL_TEXT[goal];
  return k ? t(k) : null;
}

function productionItem(
  spaceId: string,
  listing: string,
  positionId: string,
  label: string,
  sponsorName: string | null,
  production: ProductionView,
): Omit<DeliveryItem, "owner" | "member"> {
  return {
    id: `production:${positionId}`,
    kind: "production",
    state: productionState(production),
    spaceId,
    listing,
    title: label,
    sub: [sponsorName, production.brief ? goalText(production.brief.goal) : null].filter(Boolean).join(" · ") || t("spaces.delivery.production"),
    // An instant, not a day: the countdown is to the hour.
    due: production.state === "accepted" ? null : production.dueAt,
    production,
  };
}

const KIND_TEXT: Record<string, MessageKey> = {
  in_person: "spaces.promiseKind.inPerson",
  photo_post: "spaces.promiseKind.photoPost",
  video: "spaces.promiseKind.video",
  story: "spaces.promiseKind.story",
  thank_you_post: "spaces.promiseKind.thankYouPost",
  mention: "spaces.promiseKind.mention",
  custom: "spaces.promiseKind.custom",
};

function promiseTitle(d: { kind: string; platform: string | null; count: number }): string {
  const key = KIND_TEXT[d.kind];
  const kind = key ? t(key) : d.kind.replace(/_/g, " ");
  return d.platform
    ? t("spaces.delivery.promiseTitlePlatform", { count: d.count, kind, platform: d.platform })
    : t("spaces.delivery.promiseTitle", { count: d.count, kind });
}

/** From the creator's own listings, whole. */
export function ownerDeliveries(spaces: readonly SpaceView[]): DeliveryItem[] {
  const out: DeliveryItem[] = [];
  for (const space of spaces) {
    const listing = space.serviceName || space.title;
    for (const p of space.positions) {
      if (p.content?.status === "pending" && p.sponsor) {
        out.push({
          id: `artwork:${p.id}`,
          kind: "artwork",
          state: "todo",
          spaceId: space.id,
          listing,
          title: t("spaces.delivery.artworkTitle", { sponsor: p.sponsor.name ?? t("spaces.delivery.sponsor") }),
          sub: p.title ?? p.label,
          due: null,
          owner: { space, position: p },
          member: null,
        });
      }
      if (p.status === "sold" && p.production) {
        out.push({ ...productionItem(space.id, listing, p.id, p.title ?? p.label, p.sponsor?.name ?? null, p.production), owner: { space, position: p }, member: null });
        continue;
      }
      if (p.status === "sold") {
        out.push({
          id: `spot:${p.id}`,
          kind: "spot",
          state: p.delivered ? "done" : "todo",
          spaceId: space.id,
          listing,
          title: p.title ?? p.label,
          sub: p.sponsor?.name ?? t("spaces.delivery.sold"),
          due: space.deliverBy,
          owner: { space, position: p },
          member: null,
        });
      }
    }
    for (const d of space.deliverables) {
      out.push({
        id: `promise:${d.id}`,
        kind: "promise",
        state: d.state === "delivered" ? "done" : d.state === "upcoming" ? "todo" : "overdue",
        spaceId: space.id,
        listing,
        title: promiseTitle(d),
        sub: d.note ?? t("spaces.delivery.promise"),
        due: d.dueDate,
        owner: { space, deliverable: d },
        member: null,
      });
    }
  }
  return out;
}

/** From the listings somebody works on for another creator. */
export function memberDeliveries(work: readonly WorkListing[], skip: ReadonlySet<string> = new Set()): DeliveryItem[] {
  const out: DeliveryItem[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const w of work) {
    if (skip.has(w.spaceId)) continue;
    for (const s of w.slots) {
      if (s.production) {
        out.push({
          ...productionItem(w.spaceId, w.title, s.id, s.label ?? s.zoneKey ?? t("spaces.delivery.spot"), s.sponsorName, s.production),
          owner: null,
          member: { listing: w, slot: s },
        });
        continue;
      }
      out.push({
        id: `spot:${s.id}`,
        kind: "spot",
        state: s.deliveredUrl ? "done" : s.contentStatus === "pending" ? "waiting" : "todo",
        spaceId: w.spaceId,
        listing: w.title,
        title: s.label ?? s.zoneKey ?? t("spaces.delivery.spot"),
        sub: s.sponsorName ?? t("spaces.delivery.sold"),
        due: w.deliverBy,
        owner: null,
        member: { listing: w, slot: s },
      });
    }
    for (const d of w.deliverables) {
      out.push({
        id: `promise:${d.id}`,
        kind: "promise",
        state: d.deliveredUrl ? "done" : d.dueDate && d.dueDate < today ? "overdue" : "todo",
        spaceId: w.spaceId,
        listing: w.title,
        title: promiseTitle(d),
        sub: d.note ?? t("spaces.delivery.promise"),
        due: d.dueDate,
        owner: null,
        member: { listing: w, deliverable: d },
      });
    }
  }
  return out;
}

const STATE_ORDER: Record<DeliveryState, number> = { overdue: 0, todo: 1, waiting: 2, done: 3 };
const KIND_ORDER: Record<DeliveryKind, number> = { artwork: 0, production: 1, spot: 1, promise: 2 };

export function sortDeliveries(items: DeliveryItem[]): DeliveryItem[] {
  return [...items].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  );
}

/** Open work due within `days`, or already late. */
export function dueSoon(items: readonly DeliveryItem[], days = 7): DeliveryItem[] {
  const limit = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  return items.filter((i) => i.state === "overdue" || (i.state === "todo" && (i.kind === "artwork" || (i.due !== null && i.due <= limit))));
}

/* ── Offers ───────────────────────────────────────────────────────── */

export const OPEN_OFFER: readonly OfferView["status"][] = ["pending", "countered", "accepted"];

export function waitingOnYou(offers: readonly OfferView[]): OfferView[] {
  return offers.filter((o) => o.status === "pending");
}

/* ── Sales over time ──────────────────────────────────────────────── */

export interface SalesPoint {
  label: string;
  cents: number;
  orders: number;
}

/**
 * Received money per week, oldest first, over the orders the sales read
 * returns. Weeks with nothing are kept, so a quiet week reads as quiet.
 */
export function salesByWeek(sales: SalesSummary | null | undefined, weeks = 8): SalesPoint[] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  const points: SalesPoint[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start.getTime() + i * 7 * 86_400_000);
    return { label: fmtDate(d, { day: "numeric", month: "short" }), cents: 0, orders: 0 };
  });
  for (const r of sales?.recent ?? []) {
    if (!r.paidAt) continue;
    const i = Math.floor((new Date(r.paidAt).getTime() - start.getTime()) / (7 * 86_400_000));
    if (i < 0 || i >= weeks) continue;
    points[i].cents += centsFromUsdc(r.receivedUsdc) ?? 0;
    points[i].orders += 1;
  }
  return points;
}

/** A USDC string as cents, zero when unreadable. */
export function cents(usdc: string | null | undefined): number {
  return centsFromUsdc(usdc) ?? 0;
}

/* ── Events and the listings under them ───────────────────────────── */

/** The key of the "Not tied to an event" group, in a URL too. */
export const NO_EVENT = "none";

export interface EventRef {
  /** The event's slug: what `?event=` carries. */
  key: string;
  name: string;
  city: string | null;
  /** ISO 3166-1 alpha-2, for the flag on the event's card. Null when nobody told us. */
  country: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

/** What a drill-down card needs to know about one listing. */
export interface ListingRef {
  id: string;
  title: string;
  event: EventRef | null;
  /** Ad space (placement) or service; null when only a team seat is known. */
  kind: TemplateKind | null;
  status: string;
  bannerUrl: string | null;
  bannerGradient: string | null;
}

export function eventSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || NO_EVENT
  );
}

/**
 * Every listing this person can see, by id: their own (with the event's own
 * slug) and the ones they work on for somebody else (which carry only the
 * event's name, matched back to the same slug when the creator also has a
 * listing there).
 */
export function listingRefs(
  own: readonly SpaceCard[],
  kindOf: (l: SpaceCard) => TemplateKind,
  others: readonly WorkListing[] = [],
): Map<string, ListingRef> {
  const out = new Map<string, ListingRef>();
  // The event's slug and country, by name: what a team seat's listing is missing.
  const byName = new Map<string, { slug: string; country: string | null }>();
  for (const l of own) {
    const e = l.event;
    if (e) byName.set(e.name.toLowerCase(), { slug: e.slug, country: e.country ?? null });
    out.set(l.id, {
      id: l.id,
      title: l.serviceName || l.title,
      event: e ? { key: e.slug, name: e.name, city: e.city, country: e.country ?? null, startsOn: e.startsOn, endsOn: e.endsOn } : null,
      kind: kindOf(l),
      status: l.status,
      bannerUrl: l.bannerUrl ?? null,
      bannerGradient: l.bannerGradient ?? null,
    });
  }
  for (const w of others) {
    if (out.has(w.spaceId)) continue;
    const name = w.eventName?.trim() || null;
    const known = name ? byName.get(name.toLowerCase()) ?? null : null;
    out.set(w.spaceId, {
      id: w.spaceId,
      title: w.title,
      event: name
        ? {
            key: known?.slug ?? eventSlug(name),
            name,
            city: null,
            country: known?.country ?? null,
            startsOn: w.eventStartsOn,
            endsOn: w.eventEndsOn,
          }
        : null,
      kind: null,
      status: w.status,
      bannerUrl: null,
      bannerGradient: null,
    });
  }
  return out;
}

export interface Group<T> {
  key: string;
  items: T[];
}

/** Items grouped by the event of their listing, in first-seen order. Unknown listings go to NO_EVENT. */
export function byEvent<T>(items: readonly T[], spaceOf: (t: T) => string, refs: ReadonlyMap<string, ListingRef>): Group<T>[] {
  return groupBy(items, (t) => refs.get(spaceOf(t))?.event?.key ?? NO_EVENT);
}

/** Items grouped by listing, in first-seen order. */
export function byListing<T>(items: readonly T[], spaceOf: (t: T) => string): Group<T>[] {
  return groupBy(items, spaceOf);
}

function groupBy<T>(items: readonly T[], keyOf: (t: T) => string): Group<T>[] {
  const map = new Map<string, T[]>();
  for (const t of items) {
    const k = keyOf(t);
    const list = map.get(k);
    if (list) list.push(t);
    else map.set(k, [t]);
  }
  return [...map.entries()].map(([key, list]) => ({ key, items: list }));
}

/** "1 ad space · 2 services", from the listings' kinds. */
export function kindsText(kinds: readonly (TemplateKind | null)[]): string {
  const spaces = kinds.filter((k) => k === "placement").length;
  const services = kinds.filter((k) => k === "service").length;
  const other = kinds.length - spaces - services;
  const parts: string[] = [];
  if (spaces) parts.push(t("spaces.kinds.adSpaces", { count: spaces }));
  if (services) parts.push(t("spaces.kinds.services", { count: services }));
  if (other) parts.push(t("spaces.kinds.listings", { count: other }));
  return parts.join(" · ");
}

/* ── Sales ────────────────────────────────────────────────────────── */

/**
 * The order statuses that mean money reached the creator, as the server's
 * `SALE_STATUSES`: `paid`, and `outbid` (it paid and held the spot, and the
 * next sponsor repaid it, not the creator). `/sales` sends nothing else; the
 * filter is here so a sale is never anything but money that arrived.
 */
export const SALE_STATUSES: readonly string[] = ["paid", "outbid"];

export type SaleRow = SalesSummary["recent"][number];

export function paidSales(sales: SalesSummary | null | undefined): SaleRow[] {
  return (sales?.recent ?? []).filter((r) => SALE_STATUSES.includes(r.status));
}

export function receivedCents(rows: readonly { receivedUsdc: string }[]): number {
  return rows.reduce((n, r) => n + cents(r.receivedUsdc), 0);
}

/**
 * The server's per-listing totals. A server older than them sends none, and
 * then they are rebuilt from `recent` — the only case where a screen adds up
 * sales itself.
 */
export function listingTotals(sales: SalesSummary | null | undefined): SalesListing[] {
  if (sales?.listings) return sales.listings;
  return byListing(paidSales(sales), (r) => r.spaceId).map((g) => ({
    spaceId: g.key,
    spaceTitle: g.items[0].spaceTitle,
    serviceName: g.items[0].serviceName,
    receivedUsdc: (receivedCents(g.items) / 100).toFixed(2),
    orders: g.items.length,
    soldSpots: g.items.filter((r) => r.status === "paid").length,
    lastPaidAt: g.items[0].paidAt,
  }));
}
