"use client";

/**
 * Buying a spot from a browser, as YOURSELF.
 *
 * ── THE GAP THIS CLOSES ──
 *
 * Spaces on the web is the creator's console, end to end. A brand has never
 * had a console at all: it buys through the public listing page, which is
 * built for somebody with no HOLD account — a checkout key in localStorage, a
 * Solana Pay QR scanned by an outside wallet, or EVM authorisations signed in
 * MetaMask.
 *
 * A brand that IS signed in was going through that same anonymous door, and it
 * cost them real things, not just polish:
 *
 *   - HiPoints. `awardSponsorPoints` needs `order.sponsorUserId`. An anonymous
 *     order has none, so nothing is credited, to anybody, ever.
 *   - Their name on the deal. `payFromOf()` reads `sponsorUserId ? "hold" :
 *     "wallet"`, so the creator's own analytics filed them as a stranger's
 *     wallet rather than as a brand that pays from HOLD and comes back.
 *   - The gas. `solanaHandoff` sets `relayed = order.sponsorUserId !== null`:
 *     with an account the RELAYER is the fee payer and the purchase is
 *     gasless. Without one the sponsor pays their own SOL.
 *
 * So this is not a nicer skin on the public checkout. It is a different order,
 * and the difference is on the row.
 *
 * ── THE SHAPE, AND WHY EACH STEP IS WHERE IT IS ──
 *
 *   1. claim    POST /ad-space/positions/:id/claim   holds the spot, builds the
 *               transaction, answers a Handoff
 *   2. ask      POST /payment-approvals { kind: "spot", ref: { orderId } }:
 *               the linked phone approves AND signs, in the HOLD app
 *   3. submit   POST /relayer/solana/submit, with what the phone signed
 *   4. confirm  POST /ad-space/orders/:id/confirm
 *
 * ── WHO APPROVES ──
 *
 * The phone, always (Alex, 2026-09-24: the web does not pay any more). The
 * web never opens a key for a spot. `GET /wallet-backup/status`
 * → `canPayFromWeb` says whether it can be asked
 * (documentation/one-wallet-every-device.md, "Payments built by the server,
 * approved on the phone"):
 *
 *   app          a phone (iPhone or Android) with a device key is linked:
 *                steps 2 to 4 above.
 *   link_first   a wallet made in the app with no phone linked: "Link your
 *                phone to pay from here". Never a dead end.
 *   none         no wallet at all: it is made in the HOLD app, so "Get the
 *                HOLD app".
 *
 * ── THE LINE ──
 *
 * `submitted` is the line. Before it, nothing has left and saying so is
 * honest. After it the money is on its way and this never re-sends: the
 * relayer answers a repeated `submitIdempotencyKey` with the signature it
 * already holds, and `confirm` is idempotent, so a failure past that point is
 * something to WAIT on, never something to retry with a fresh transaction.
 */

import { useEffect, useState } from "react";

import type { ContentBody } from "@/lib/ad-space/content-form";
import type { Order } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";
import { call } from "@/lib/creator/api";

import { relayerSubmit } from "@/lib/link/api";
import {
  cancelPaymentApproval,
  describeApprovalRefusal,
  endedWithoutPaying,
  requestPaymentApproval,
  waitForPhone,
  type PaymentApproval,
} from "@/lib/link/payment-approvals";
import { getWalletStatus, payerOf } from "@/lib/wallet/api";

import { creatorStorefront } from "./storefront";

/* ── What the server hands back ───────────────────────────────────── */

/**
 * The relayed Solana handoff — the only one this file deals with.
 *
 * `orders.service.ts` can also answer a wallet handoff (the sponsor pays their
 * own fee) or an EVM one. Neither can happen here: the first is what a
 * signed-out browser gets, and the second needs a chain the web wallet does
 * not hold. `payForSpot` refuses anything else rather than guessing.
 */
export interface RelayedHandoff {
  order: Order;
  transaction: string;
  relayerPublicKey: string;
  lastValidBlockHeight: number;
  submitIdempotencyKey: string;
}

export type PayChain = "solana" | "base" | "polygon";

/** The five cells of the checkout band: the share of OUR fee paid in HiPoints. */
export type PointsFeeShare = 0 | 25 | 50 | 75 | 100;

/* ── Calls ────────────────────────────────────────────────────────── */

/**
 * Hold the spot and get the transaction for it.
 *
 * The idempotency key is what stops a second tap becoming a second order on
 * the same spot. It is generated here and passed as a header, which is where
 * `idemKey(req)` reads it.
 */
export function claimSpot(args: {
  positionId: string;
  sponsorAddress: string;
  idempotencyKey: string;
  offerId?: string | null;
  pointsFeeShare?: PointsFeeShare;
}): Promise<RelayedHandoff> {
  return call<RelayedHandoff>(`ad-space/positions/${args.positionId}/claim`, {
    json: {
      chain: "solana" as PayChain,
      sponsorAddress: args.sponsorAddress,
      ...(args.offerId ? { offerId: args.offerId } : {}),
      ...(args.pointsFeeShare === undefined ? {} : { pointsFeeShare: args.pointsFeeShare }),
    },
    headers: { "Idempotency-Key": args.idempotencyKey },
  });
}

export function confirmSpot(orderId: string, signature: string): Promise<{ outcome: string; order?: Order }> {
  return call(`ad-space/orders/${orderId}/confirm`, { json: { signature } });
}

/**
 * A card on the board, as `spaces.board()` builds it.
 *
 * Named here and not in `lib/ad-space/types.ts` because that file describes the
 * PUBLIC contract and this shape is only ever handed to a signed-in caller —
 * the board narrows by who is asking (a creator they blocked drops out), so it
 * is not the same list twice.
 */
export interface BoardCard {
  id: string;
  slug: string;
  title: string;
  reason: string | null;
  kind: "placement" | "service";
  templateName: string | null;
  serviceName: string | null;
  serviceSummary: string | null;
  eventId: string | null;
  eventName: string | null;
  path: string | null;
  bannerUrl: string | null;
  photoUrl: string | null;
  openCount: number;
  closesAt: string;
  featured: boolean;
  feePayer: "sponsor" | "creator";
  /** The lowest price still payable, in cents. Null on a listing that sells only by offer. */
  fromCents: number | null;
  acceptsOffers: boolean;
  creator: {
    xHandle: string | null;
    xName: string | null;
    xAvatarUrl: string | null;
    xFollowers: number | null;
    trackRecord: { delivered: number; missed: number; disputed: number };
  };
}

/** What is for sale, narrowed to the caller: a creator they blocked is not on it. */
export function boardListings(opts: { kind?: "placement" | "service"; limit?: number; offset?: number } = {}): Promise<{
  spaces: BoardCard[];
}> {
  const q = new URLSearchParams();
  if (opts.kind) q.set("kind", opts.kind);
  q.set("limit", String(opts.limit ?? 20));
  if (opts.offset) q.set("offset", String(opts.offset));
  return call(`ad-space/board?${q.toString()}`);
}

/**
 * One of this account's orders, with the three things `listMyOrders` joins on
 * that a bare `Order` does not carry.
 *
 * `contentStatus` is the whole reason the brand console can now finish the
 * job: the server has always answered it and nothing ever read it, so "have I
 * sent my artwork, and did they take it?" was a question only the public
 * listing page could answer. It is null on anything not yet paid, because
 * there is nothing to hand over for a spot you do not hold.
 */
export interface MyOrder extends Order {
  spaceTitle: string;
  serviceName: string | null;
  serviceSummary: string | null;
  zoneKey: string;
  contentStatus: "pending" | "approved" | "rejected" | null;
}

/** The spots this account has bought, newest first. */
export function myOrders(): Promise<{ orders: MyOrder[] }> {
  return call("ad-space/orders/mine");
}

/* ── What goes ON the spot, once it is yours ──────────────────────── */

/**
 * Upload the image for an order, as the account that paid for it.
 *
 * The anonymous sponsor does this with a checkout key against
 * `/public/orders/:id/media`; this is the same store behind the same rules
 * (PNG, JPEG or WebP, sniffed by magic bytes, metadata stripped, private
 * until the creator approves it) reached with a session instead.
 *
 * The `url` that comes back is a SIGNED link that dies within the hour, so it
 * is good for showing the brand what it just sent and worth nothing saved.
 * Only `path` goes into the content body.
 */
export function uploadOrderImage(orderId: string, image: Blob): Promise<{ path: string; url: string }> {
  return call(`ad-space/orders/${encodeURIComponent(orderId)}/media`, { file: image });
}

/**
 * Hand the artwork over for the creator to approve.
 *
 * Idempotent in the way that matters: sending again replaces what is pending,
 * which is what a brand does after a rejection, so there is no separate
 * "amend" call and no way to end up with two submissions racing.
 */
export function sendArtwork(
  orderId: string,
  body: ContentBody,
): Promise<{ content: { status: "pending" | "approved" | "rejected"; rejectedReason?: string | null } }> {
  return call(`ad-space/orders/${encodeURIComponent(orderId)}/content`, { method: "PUT", json: body });
}

/** Where to buy from somebody, or null when they sell nothing. */
export function storefrontOf(userId: string): Promise<{ storefront: { handle: string; live: number } | null }> {
  return call(`ad-space/creators/${encodeURIComponent(userId)}/storefront`);
}

/* ── What you bought from one person ──────────────────────────────── */

/**
 * The spots this account has bought from ONE creator, for their thread.
 *
 * ── WHY IT IS DERIVED AND NEVER STORED ──
 *
 * A purchase is a fact about two people, and the conversation between them is
 * where it belongs. The tempting shortcut is to post a chat message when the
 * payment lands — but a message is editable and deletable by whoever wrote it,
 * and a fact is not. So nothing is written: the orders and the creator's
 * listings are read and intersected, exactly the way the thread already
 * derives its payment requests.
 *
 * Two reads, and only for somebody who sells: `storefrontOf` answers null for
 * everybody else, and this never runs.
 */
export interface SpotBought {
  orderId: string;
  ts: number;
  /** What was paid, already formatted by the server as a USDC string. */
  amountUsdc: string;
  status: Order["status"];
  explorerUrl: string | null;
}

export function useSpotsBoughtFrom(peerId: string | null): SpotBought[] {
  const [spots, setSpots] = useState<SpotBought[]>([]);

  useEffect(() => {
    if (!peerId) {
      setSpots([]);
      return;
    }
    let alive = true;
    void (async () => {
      const shop = await storefrontOf(peerId).catch(() => null);
      const handle = shop?.storefront?.handle;
      if (!alive || !handle) return;
      const [page, mine] = await Promise.all([
        creatorStorefront(handle).catch(() => null),
        myOrders().catch(() => null),
      ]);
      if (!alive || !page || !mine) return;
      const theirs = new Set(page.groups.flatMap((g) => g.cards.map((c) => c.spaceId)));
      setSpots(
        mine.orders
          .filter((o) => theirs.has(o.spaceId) && (o.status === "paid" || o.status === "outbid"))
          .map((o) => ({
            orderId: o.id,
            ts: Date.parse(o.paidAt ?? "") || 0,
            amountUsdc: o.sponsorPaysUsdc,
            status: o.status,
            explorerUrl: o.explorerUrl,
          }))
          .filter((s) => s.ts > 0),
      );
    })();
    return () => {
      alive = false;
    };
  }, [peerId]);

  return spots;
}

/* ── Paying ───────────────────────────────────────────────────────── */

export type PayPhase =
  | { kind: "idle" }
  | { kind: "holding" }
  | { kind: "sending" }
  | { kind: "confirming"; order: Order }
  | { kind: "bought"; order: Order; signature: string }
  /** Nothing left the wallet. Saying so is only allowed before `sending` returns. */
  | { kind: "stopped"; message: string }
  /** Money is on its way and we lost the thread. Never retried from here. */
  | { kind: "in-flight"; orderId: string; message: string }
  /** Asking the linked phone (POST /payment-approvals). */
  | { kind: "asking-phone" }
  /**
   * The linked phone approves and signs; this page polls and submits. `order`
   * is the held order, confirmed once the phone's transaction is sent.
   */
  | { kind: "on-phone"; approval: PaymentApproval; order: Order }
  /**
   * A wallet made in the HOLD app with no phone linked: the web holds no key
   * for it, so the way to pay from here is to link the phone once.
   */
  | { kind: "link-first" }
  /** No wallet at all: it is made in the HOLD app, never here. */
  | { kind: "no-wallet" };

/** A fresh idempotency key: the header wants 10 to 128 characters. */
function newKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `spot-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * ONE KEY PER SPOT, FOR AS LONG AS THIS PAGE LIVES.
 *
 * Pay can be tapped again (after a phone that declined, or a wait that
 * ended). With a new key each time that second claim was a second
 * order: a second hold on a spot this person already holds, counted against
 * their holds for the day. The same key makes the server answer with the
 * order it already made, and a fresh transaction for it when the old one's
 * blockhash has lapsed (orders.service `openOrder` → `solanaHandoff`).
 *
 * The key is per spot, offer and points share, because the server refuses a
 * replay that changes any of them (`idempotency_key_reused`).
 */
const claimKeys = new Map<string, string>();
function claimKeyFor(positionId: string, offerId: string | null, share: PointsFeeShare | undefined): string {
  const id = `${positionId}|${offerId ?? ""}|${share ?? ""}`;
  let key = claimKeys.get(id);
  if (!key) {
    key = newKey();
    claimKeys.set(id, key);
  }
  return key;
}

/**
 * Buy one spot: whose wallet, hold the spot, ask the phone, send what it
 * signed. Ends in `bought`, or in a phase that says why not.
 *
 * Every refusal before the submit says "nothing has been charged", because
 * nothing has. Past `submitted` nothing is ever re-sent (THE LINE above).
 */
export async function payForSpot(args: {
  positionId: string;
  offerId?: string | null;
  pointsFeeShare?: PointsFeeShare;
  onPhase: (p: PayPhase) => void;
  /** Stops following the phone (the sheet closed). Nothing is sent after it. */
  signal?: AbortSignal;
}): Promise<PayPhase> {
  const say = (p: PayPhase) => {
    args.onPhase(p);
    return p;
  };

  /* 1 ── whose wallet, and whether the phone can be asked */
  const status = await getWalletStatus().catch(() => null);
  if (!status) return say({ kind: "stopped", message: t("sponsor.pay.walletUnreadable") });
  const payer = payerOf(status);
  if (payer === "link_first") return say({ kind: "link-first" });
  if (payer !== "app") return say(status.state === "none" ? { kind: "no-wallet" } : { kind: "link-first" });
  const from = status.registered_address ?? null;
  if (!from) return say({ kind: "stopped", message: t("sponsor.pay.addressUnreadable") });

  /* 2 ── hold the spot */
  say({ kind: "holding" });
  let handoff: RelayedHandoff;
  const claim = () =>
    claimSpot({
      positionId: args.positionId,
      sponsorAddress: from,
      idempotencyKey: claimKeyFor(args.positionId, args.offerId ?? null, args.pointsFeeShare),
      offerId: args.offerId ?? null,
      pointsFeeShare: args.pointsFeeShare,
    });
  try {
    try {
      handoff = await claim();
    } catch (e) {
      // The order this key made is over (its hold lapsed), or the key no
      // longer fits it: that key can only ever answer the same refusal. Drop
      // it and ask once more with a new one.
      const code = codeOf(e);
      if (code !== "hold_expired" && code !== "idempotency_key_reused") throw e;
      claimKeys.delete(`${args.positionId}|${args.offerId ?? ""}|${args.pointsFeeShare ?? ""}`);
      handoff = await claim();
    }
  } catch (e) {
    return say({ kind: "stopped", message: describeClaim(e) });
  }
  // A handoff without a relayer is the signed-out shape: the fee payer would
  // be this wallet, which has no SOL and never agreed to pay one.
  if (!handoff?.transaction || !handoff.relayerPublicKey) {
    return say({ kind: "stopped", message: t("sponsor.pay.notPrepared") });
  }

  /* 3 ── the phone approves and signs; this page sends what comes back */
  const onPhone = await payOnPhone({ order: handoff.order, say, signal: args.signal });
  // The phone was removed meanwhile: link one again to pay from here.
  return onPhone === "no_phone" ? say({ kind: "link-first" }) : onPhone;
}

/**
 * Send the spot the phone signed, then tell Spaces. PAST THE SUBMIT NOTHING
 * IS RE-SENT.
 */
async function sendAndConfirm(args: {
  signed: string;
  submitIdempotencyKey: string;
  order: Order;
  say: (p: PayPhase) => PayPhase;
}): Promise<PayPhase> {
  const { signed, order, say } = args;
  const handoff = { order, submitIdempotencyKey: args.submitIdempotencyKey };

  /* 3 ── send it. PAST THIS LINE NOTHING IS RE-SENT. */
  say({ kind: "sending" });
  let signature: string;
  try {
    const sent = await relayerSubmit({ serializedTx: signed, idempotencyKey: handoff.submitIdempotencyKey });
    signature = sent.signature;
  } catch (e) {
    // 409 is the relayer saying this key is already in flight: a transaction
    // may well be going, so we do not say nothing was charged and we do not
    // send another. The order's own page is where this finishes.
    if (statusOf(e) === 409) {
      return say({
        kind: "in-flight",
        orderId: handoff.order.id,
        message: t("sponsor.pay.alreadyGoing"),
      });
    }
    return say({ kind: "stopped", message: t("sponsor.pay.notSent") });
  }

  /* 4 ── tell Spaces, which is what turns the spot over */
  say({ kind: "confirming", order: handoff.order });
  try {
    const done = await confirmSpot(handoff.order.id, signature);
    return say({ kind: "bought", order: done.order ?? handoff.order, signature });
  } catch {
    // The money moved. A confirm that failed is bookkeeping we can do again by
    // opening the order, and must never read as a payment that did not happen.
    return say({
      kind: "in-flight",
      orderId: handoff.order.id,
      message: t("sponsor.pay.onNetwork"),
    });
  }
}

/* ── The phone ────────────────────────────────────────────────────── */

/**
 * Ask the linked phone for a held order, wait for it, and send what it signed.
 *
 * "no_phone" is the one answer that is not a phase: the server says no phone
 * is linked any more (409 NO_PHONE_LINKED or LINK_YOUR_PHONE_FIRST), and
 * the caller sends the person to the link screen.
 *
 * Every end before the submit says "nothing has been charged", because until
 * this page submits, nothing has: the phone only signs, and the gate's
 * approval is withdrawn on a cancel.
 */
async function payOnPhone(args: { order: Order; say: (p: PayPhase) => PayPhase; signal?: AbortSignal }): Promise<PayPhase | "no_phone"> {
  const { order, say } = args;
  say({ kind: "asking-phone" });
  let approval: PaymentApproval;
  try {
    approval = await requestPaymentApproval({ kind: "spot", orderId: order.id });
  } catch (e) {
    const code = codeOf(e);
    if (code === "NO_PHONE_LINKED" || code === "LINK_YOUR_PHONE_FIRST") return "no_phone";
    if (code === "ALREADY_PAID") {
      return say({ kind: "in-flight", orderId: order.id, message: t("sponsor.pay.alreadyPaid") });
    }
    return say({ kind: "stopped", message: describeApprovalRefusal(code, "spot") });
  }
  say({ kind: "on-phone", approval, order });

  const end = await waitForPhone(approval, {
    signal: args.signal,
    onUpdate: (a) => {
      if (a.status === "pending") say({ kind: "on-phone", approval: a, order });
    },
  });
  if (!end) return say({ kind: "stopped", message: t("sponsor.pay.stoppedWaiting") });

  switch (end.status) {
    case "rejected":
    case "expired":
    case "cancelled":
      return say({ kind: "stopped", message: endedWithoutPaying(end.status) });
    case "submitted":
      // Sent already (another tab of this page, most likely). Never a second time.
      return say({ kind: "in-flight", orderId: order.id, message: t("sponsor.pay.alreadyGoing") });
    case "approved": {
      const c = end.continuation;
      if (!end.signedTx || !c || c.kind !== "spot" || !c.submitIdempotencyKey) {
        return say({ kind: "stopped", message: t("sponsor.pay.phoneUnreadable") });
      }
      say({ kind: "on-phone", approval: end, order });
      return sendAndConfirm({ signed: end.signedTx, submitIdempotencyKey: c.submitIdempotencyKey, order, say });
    }
    default:
      return say({ kind: "stopped", message: t("sponsor.pay.stoppedWaiting") });
  }
}

/** Cancel what the phone has not decided: the phone cannot approve it after, and the wait ends on "cancelled". */
export function cancelSpotApproval(id: string): Promise<PaymentApproval> {
  return cancelPaymentApproval(id);
}

/* ── Reading a refusal ────────────────────────────────────────────── */

function statusOf(e: unknown): number | null {
  const s = (e as { status?: unknown })?.status;
  return typeof s === "number" ? s : null;
}

function codeOf(e: unknown): string {
  const c = (e as { code?: unknown })?.code;
  return typeof c === "string" ? c : "";
}

/**
 * Why the hold was refused, in the words of the thing that happened.
 *
 * Only the cases a brand can act on are named. Everything else gets one
 * sentence that is true of all of them, which is better than a code.
 */
function describeClaim(e: unknown): string {
  switch (codeOf(e)) {
    case "position_taken":
    case "position_not_available":
      return t("sponsor.claim.taken");
    case "position_held":
      return t("sponsor.claim.held");
    case "own_space":
      return t("sponsor.claim.ownSpace");
    case "space_closed":
      return t("sponsor.claim.closed");
    case "offer_not_payable":
      return t("sponsor.claim.offerNotPayable");
    case "relayer_not_configured":
      return t("sponsor.claim.unavailable");
    case "not_enough_points":
      return t("sponsor.claim.notEnoughPoints");
    default:
      return t("sponsor.claim.other");
  }
}
