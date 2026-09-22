"use client";

/**
 * A creator's shop window, read from inside the product.
 *
 * The same two public reads the page at `/s/<handle>` is built from — the
 * creator's groups and one listing whole — asked from the signed-in shell so a
 * brand never has to leave the conversation to see what is for sale.
 *
 * WHY PUBLIC READS AND NOT A CONSOLE ENDPOINT
 *
 * What a brand may see before it buys is exactly what anybody may see: that is
 * the definition of a listing. A second, authenticated view of the same rows
 * would be a second place for "what is still open" to be decided, and the
 * first time the two disagreed the brand would be paying for a spot the page
 * said was gone. One source, thirty seconds of cache, no drift.
 *
 * Only the CLAIM is authenticated, and it is authenticated because of who is
 * buying, never because of what is shown.
 */

import { API_BASE } from "@/lib/ad-space/config";
import type { CreatorPage, Position, Space } from "@/lib/ad-space/types";

async function publicRead<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/ad-space/public/${path}`, {
    headers: { accept: "application/json" },
    // No token and no cookie: this is the same request the public page makes,
    // and sending credentials it does not need would only widen what a CORS
    // answer has to be trusted for.
    credentials: "omit",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: { code?: string } } | null;
  if (!res.ok) {
    const err = new Error(body?.error?.code ?? `HTTP_${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

/** Everything this creator sells, grouped by event, in the server's order. */
export function creatorStorefront(handle: string): Promise<CreatorPage> {
  return publicRead<CreatorPage>(`creators/${encodeURIComponent(handle.replace(/^@/, ""))}`);
}

/** One listing whole, with its spots. */
export async function listingSpots(spaceId: string): Promise<Space> {
  const r = await publicRead<{ space: Space }>(`spaces/${encodeURIComponent(spaceId)}`);
  return r.space;
}

/**
 * The spots on a listing a brand can actually take right now, in the order the
 * server put them.
 *
 * `open` is the only status that can be claimed. `held` is somebody else's
 * checkout in progress, and `sold` on a takeover board CAN be taken over — but
 * at a doubled price and by displacing a sponsor who gets repaid. That is a
 * different decision with a different screen, and putting it in a list of
 * things to buy would let it be tapped by accident.
 *
 * A spot with no price is one that sells by offer or by bid. There is nothing
 * to charge, so there is nothing to put a Pay button on; the brand makes an
 * offer instead, which is a conversation and not a checkout.
 */
export function claimableSpots(space: Space): Position[] {
  return space.positions.filter((p) => p.status === "open" && p.priceCents !== null && p.sponsorPaysUsdc !== null);
}

/** What the brand pays for this spot, as a number, or null when it has no price. */
export function spotPrice(p: Position): number | null {
  const n = Number(p.sponsorPaysUsdc ?? "");
  return Number.isFinite(n) && n > 0 ? n : null;
}
