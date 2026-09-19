/**
 * The demo backend for the public Spaces pages (`/ad-space/public/*`): the
 * brand's checkout, offers and bids, a session's manage link and a content
 * production's delivery page. Answered from the same fixture the pages are
 * rendered from (lib/ad-space/fixture.dev), so what a brand clicks lands on
 * the state it would.
 *
 * No wallet is needed: the Solana Pay QR "is scanned" a few seconds after it
 * shows, and the order is paid on the next confirm.
 */

import { fixtureBooking, fixtureOffer, fixtureProduction, fixtureSpace } from "@/lib/ad-space/fixture.dev";
import type { Order, Position, Space } from "@/lib/ad-space/types";

import type { Answer } from "./account";

const ok = (data: unknown, status = 200): Answer => ({ status, body: { data } });
const refuse = (status: number, code: string): Answer => ({ status, body: { error: { code, message: code, details: {} } } });

const SLUGS = [
  "road-to-token2049",
  "road-to-token2049-photo",
  "token2049-videos",
  "token2049-takeover",
  "token2049-pitch-reviews",
  "token2049-afterparty-host",
  "breakpoint-london-coverage",
  "weekly-x-space-sponsor",
  "token2049-content-production",
  "token2049-bids",
  "token2049-offers",
  "token2049-videos-offers",
];

function findPosition(positionId: string): { space: Space; position: Position } | null {
  // Fixtures share position ids: the page this checkout runs on says which space it is.
  const here = /^\/s\/[^/]+\/([^/?#]+)/.exec(window.location.pathname)?.[1];
  for (const slug of here ? [here, ...SLUGS] : SLUGS) {
    const space = fixtureSpace("demo_creator", slug);
    const position = space?.positions.find((p) => p.id === positionId);
    if (space && position) return { space, position };
  }
  return null;
}

/** The demo's checkout keys carry the position: `demo-<positionId>-<random>`, `demo-paid-<positionId>`. */
function positionOfKey(key: string | null): string | null {
  if (!key) return null;
  const m = /^demo-(?:paid-)?([0-9a-f-]{36})/.exec(key);
  return m ? m[1] : null;
}

/** When this tab first asked about a key: the QR is "scanned" six seconds later. */
const firstAsked = new Map<string, number>();
const paidOrders = new Map<string, Order>();

function orderFor(_key: string, space: Space, position: Position, status: Order["status"]): Order {
  const price = position.priceCents ?? 10_000;
  const fee = Math.round(price * 0.05);
  const id = `0f000000-0000-4000-8000-${position.id.slice(-12)}`;
  const production = space.template.service?.format === "production";
  const session = space.template.service?.format === "session";
  const origin = window.location.origin;
  return {
    id,
    positionId: position.id,
    spaceId: space.id,
    status,
    chain: "solana",
    priceUsdc: (price / 100).toFixed(2),
    creatorReceivesUsdc: (price / 100).toFixed(2),
    feeUsdc: (fee / 100).toFixed(2),
    sponsorPaysUsdc: ((price + fee) / 100).toFixed(2),
    takeover: null,
    feeBps: 500,
    feePayer: "sponsor",
    creatorAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    feeAddress: "HoLDfeeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    sponsorAddress: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT",
    reservedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
    txSignature: status === "paid" ? "5demoSignatureXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" : null,
    paidAt: status === "paid" ? new Date().toISOString() : null,
    explorerUrl: null,
    share: status === "paid" ? { url: `${origin}/s/demo_creator/${space.slug}`, text: `I'm sponsoring ${space.title} ${origin}/s/demo_creator/${space.slug}` } : null,
    manageUrl: production ? `${origin}/p/fixture_production_making` : session ? `${origin}/b/fixture_scheduled` : null,
  };
}

export async function publicAnswer(method: string, path: string, body: Record<string, unknown> | null, checkoutKey: string | null): Promise<Answer | null> {
  const seg = path.split("/").filter(Boolean);
  if (seg[0] !== "ad-space" || seg[1] !== "public") return null;
  const rest = seg.slice(2);

  // The space as this browser sees it.
  if (method === "GET" && rest[0] === "spaces" && rest[1]) {
    const space = fixtureSpace("id", decodeURIComponent(rest[1]));
    return space ? ok({ space }) : refuse(404, "not_found");
  }

  // The order bound to this checkout key.
  if (method === "GET" && rest[0] === "checkout" && rest.length === 1) {
    const key = checkoutKey ?? "";
    const pid = positionOfKey(key);
    const hit = pid ? findPosition(pid) : null;
    if (!hit) return ok({ order: null });
    if (key.startsWith("demo-paid-")) return ok({ order: orderFor(key, hit.space, hit.position, "paid") });
    const paid = paidOrders.get(key);
    if (paid) return ok({ order: paid });
    const first = firstAsked.get(key) ?? Date.now();
    firstAsked.set(key, first);
    return ok({ order: Date.now() - first > 6000 ? orderFor(key, hit.space, hit.position, "awaiting_payment") : null });
  }
  if (method === "PUT" && rest[0] === "checkout" && rest[1] === "brief") return ok({ brief: (body as { brief?: unknown })?.brief ?? null });

  // Paying: the confirm answers paid.
  if (method === "POST" && rest[0] === "orders" && rest[2] === "confirm") {
    const pid = positionOfKey(checkoutKey);
    const hit = pid ? findPosition(pid) : null;
    if (!hit) return refuse(404, "not_found");
    const order = orderFor(checkoutKey ?? "", hit.space, hit.position, "paid");
    if (checkoutKey) paidOrders.set(checkoutKey, order);
    return ok({ outcome: "paid", order });
  }
  if (method === "POST" && rest[0] === "orders" && rest[2] === "media") {
    return ok({ path: "demo/artwork.png", url: "/demo/suitcase-back.jpg" });
  }
  if (method === "PUT" && rest[0] === "orders" && rest[2] === "content") {
    const pid = positionOfKey(checkoutKey);
    const hit = pid ? findPosition(pid) : null;
    if (!hit) return refuse(404, "not_found");
    return ok({ order: orderFor(checkoutKey ?? "", hit.space, hit.position, "paid"), content: { status: "pending", rejectedReason: null } });
  }
  if (method === "POST" && rest[0] === "positions" && rest[2] === "checkout") return refuse(409, "demo_use_the_qr");

  // Offers and bids.
  if (method === "POST" && rest[0] === "offers" && rest[1] === "challenge") {
    return ok({ nonce: "demo-nonce", message: "HOLD offer: prove this wallet holds the amount.\n(Demo: any signature is accepted.)", expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
  }
  if (method === "POST" && rest[0] === "offers" && rest.length === 1) {
    const thread = fixtureOffer("fixture_pendingxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    return thread ? ok({ offer: thread.offer, manageUrl: `${window.location.origin}/o/fixture_pendingxxxxxxxxxxxxxxxxxxxxxxxxxxxx` }, 201) : refuse(500, "server");
  }
  if (rest[0] === "offers" && rest[1]) {
    const token = decodeURIComponent(rest[1]);
    const thread = fixtureOffer(token);
    if (!thread) return refuse(404, "not_found");
    if (method === "GET") return ok(thread);
    if (rest[2] === "respond") {
      const action = (body as { action?: string })?.action;
      if (action === "withdraw") return ok({ ...thread, offer: { ...thread.offer, status: "withdrawn" } });
      if (action === "accept_counter") return ok({ ...thread, offer: { ...thread.offer, status: "accepted" } });
      return ok(thread);
    }
    if (rest[2] === "checkout") return ok({ solanaPayUrl: `solana:${encodeURIComponent(`https://api.demo.invalid/solana-pay/${token}`)}` });
  }

  // A session's manage link.
  if (rest[0] === "bookings" && rest[1]) {
    const booking = fixtureBooking(decodeURIComponent(rest[1]));
    if (!booking) return refuse(404, "not_found");
    return ok({ booking });
  }

  // A content production's delivery page: accept, or one revision.
  if (rest[0] === "productions" && rest[1]) {
    const token = decodeURIComponent(rest[1]);
    const production = fixtureProduction(token);
    if (!production) return refuse(404, "not_found");
    if (rest[2] === "accept") {
      return ok({ production: { ...production, production: { ...production.production, state: "accepted", accepted: { at: new Date().toISOString(), auto: false }, revisionAvailable: false, autoAcceptAt: null } } });
    }
    if (rest[2] === "revision") {
      const note = String((body as { note?: string })?.note ?? "");
      return ok({ production: { ...production, production: { ...production.production, state: "revision_requested", revision: { note, requestedAt: new Date().toISOString() }, revisionAvailable: false, autoAcceptAt: null } } });
    }
    return ok({ production });
  }

  return refuse(404, "not_found");
}
