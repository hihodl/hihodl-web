/**
 * Who is looking, and what is waiting on them, worked out from reads the
 * console already makes. Nothing here calls anything.
 */

import type { XAccountStatus } from "@/lib/creator/types";
import { centsFromUsdc, type DeliverableView, type OfferView, type PositionView, type SalesSummary, type SpaceCard, type SpaceView } from "@/lib/creator/listing";
import type { TeamMember, WorkDeliverable, WorkListing, WorkSlot } from "@/lib/creator/team";

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

export type DeliveryKind = "artwork" | "spot" | "promise";
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
}

const KIND_TEXT: Record<string, string> = {
  in_person: "In person",
  photo_post: "Photo post",
  video: "Video",
  story: "Story",
  thank_you_post: "Thank-you post",
  mention: "Mention",
  custom: "Custom",
};

function promiseTitle(d: { kind: string; platform: string | null; count: number }): string {
  const kind = KIND_TEXT[d.kind] ?? d.kind.replace(/_/g, " ");
  return `${d.count} × ${kind}${d.platform ? ` · ${d.platform}` : ""}`;
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
          title: `Artwork · ${p.sponsor.name ?? "Sponsor"}`,
          sub: p.title ?? p.label,
          due: null,
          owner: { space, position: p },
          member: null,
        });
      }
      if (p.status === "sold") {
        out.push({
          id: `spot:${p.id}`,
          kind: "spot",
          state: p.delivered ? "done" : "todo",
          spaceId: space.id,
          listing,
          title: p.title ?? p.label,
          sub: p.sponsor?.name ?? "Sold",
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
        sub: d.note ?? "Promise",
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
      out.push({
        id: `spot:${s.id}`,
        kind: "spot",
        state: s.deliveredUrl ? "done" : s.contentStatus === "pending" ? "waiting" : "todo",
        spaceId: w.spaceId,
        listing: w.title,
        title: s.label ?? s.zoneKey ?? "Spot",
        sub: s.sponsorName ?? "Sold",
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
        sub: d.note ?? "Promise",
        due: d.dueDate,
        owner: null,
        member: { listing: w, deliverable: d },
      });
    }
  }
  return out;
}

const STATE_ORDER: Record<DeliveryState, number> = { overdue: 0, todo: 1, waiting: 2, done: 3 };
const KIND_ORDER: Record<DeliveryKind, number> = { artwork: 0, spot: 1, promise: 2 };

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
    return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), cents: 0, orders: 0 };
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
