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
 *   2. approve  POST /withdrawals/tx-challenge + /tx-authorize
 *   3. sign     the wallet's key, over the bytes just approved
 *   4. submit   POST /relayer/solana/submit
 *   5. confirm  POST /ad-space/orders/:id/confirm
 *
 * Step 2 exists because of step 4. A registered web wallet does not reach our
 * relayer without a per-transaction approval (TECH-357), and the two older
 * proofs — a withdrawal row, a linked phone's signature — both need the server
 * to have described the transfer first. It cannot: this transaction is a
 * purchase with the creator's leg, our fee's leg and possibly a takeover
 * refund in it, and the strict transfer check refuses all of that by design.
 * The passkey approval over the bytes themselves is what fits, and it is the
 * same ceremony a stay's bridge deposit uses.
 *
 * The approval is taken BEFORE the wallet is opened, so a refusal costs a
 * prompt and nothing else — and it is one prompt, not two, because
 * `assertWithPrf` signs the server's challenge and evaluates PRF in the same
 * ceremony.
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

import type { Order } from "@/lib/ad-space/types";
import { call } from "@/lib/creator/api";
import { authorizeTxPasskey, relayerSubmit, txApprovalChallenge } from "@/lib/link/api";
import { getWalletBackup, getWalletStatus } from "@/lib/wallet/api";
import { wipe } from "@/lib/wallet/core";
import { openWallet } from "@/lib/wallet/flows";
import { assertWithPrf } from "@/lib/wallet/passkey";
import { messageOf, signSerializedTx } from "@/lib/wallet/sign-tx";

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

/** The spots this account has bought, newest first. */
export function myOrders(): Promise<{ orders: Order[] }> {
  return call("ad-space/orders/mine");
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
  | { kind: "approving" }
  | { kind: "signing" }
  | { kind: "sending" }
  | { kind: "confirming"; order: Order }
  | { kind: "bought"; order: Order; signature: string }
  /** Nothing left the wallet. Saying so is only allowed before `sending` returns. */
  | { kind: "stopped"; message: string }
  /** Money is on its way and we lost the thread. Never retried from here. */
  | { kind: "in-flight"; orderId: string; message: string };

/** A fresh idempotency key: the header wants 10 to 128 characters. */
function newKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `spot-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Buy one spot, start to finish, reporting each step.
 *
 * `uid` is the signed-in person; `onPhase` is called as it goes so a screen can
 * say what is happening without this file knowing anything about a screen.
 *
 * Every refusal before the submit says "nothing has been charged", because
 * nothing has. After it, nothing is ever re-sent — see THE LINE above.
 */
export async function payForSpot(args: {
  uid: string;
  positionId: string;
  offerId?: string | null;
  pointsFeeShare?: PointsFeeShare;
  onPhase: (p: PayPhase) => void;
}): Promise<PayPhase> {
  const say = (p: PayPhase) => {
    args.onPhase(p);
    return p;
  };

  /* 1 ── whose wallet, and does it exist */
  const status = await getWalletStatus().catch(() => null);
  const from = status?.registered_address ?? null;
  if (!from) {
    return say({
      kind: "stopped",
      message: "This account has no HOLD wallet on the web yet. Make one from Wallet, then buy from here.",
    });
  }

  /* 2 ── hold the spot */
  say({ kind: "holding" });
  let handoff: RelayedHandoff;
  try {
    handoff = await claimSpot({
      positionId: args.positionId,
      sponsorAddress: from,
      idempotencyKey: newKey(),
      offerId: args.offerId ?? null,
      pointsFeeShare: args.pointsFeeShare,
    });
  } catch (e) {
    return say({ kind: "stopped", message: describeClaim(e) });
  }
  // A handoff without a relayer is the signed-out shape and must not be signed
  // here: the fee payer would be this wallet, which has no SOL and never
  // agreed to pay one.
  if (!handoff?.transaction || !handoff.relayerPublicKey) {
    return say({ kind: "stopped", message: "We could not prepare that payment. Nothing has been charged." });
  }

  /* 3 ── one ceremony: approve these exact bytes, and open the wallet */
  let prf: Uint8Array | null = null;
  let seed: Uint8Array | null = null;
  let signed: string;
  try {
    say({ kind: "approving" });
    const backup = await getWalletBackup();
    if (backup.wrappings.length === 0) throw new Error("no_passkey");
    const message = await messageOf(handoff.transaction);
    const challenge = await txApprovalChallenge(message);
    const bound = await assertWithPrf(
      challenge.options,
      backup.wrappings.map((w) => w.credential_id),
    );
    prf = bound.prf;
    await authorizeTxPasskey(message, bound.assertion);

    say({ kind: "signing" });
    const key = await openWallet({ uid: args.uid, backup, credentialId: bound.credentialId, prf });
    seed = key.seed;
    signed = await signSerializedTx(handoff.transaction, seed, from);
  } catch {
    return say({ kind: "stopped", message: "We couldn't approve that payment. Nothing has been charged." });
  } finally {
    wipe(prf, seed);
  }

  /* 4 ── send it. PAST THIS LINE NOTHING IS RE-SENT. */
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
        message: "This payment is already going through. Give it a moment and check the spot.",
      });
    }
    return say({ kind: "stopped", message: "We couldn't send that payment. Nothing has been charged — try again." });
  }

  /* 5 ── tell Spaces, which is what turns the spot over */
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
      message: "Your payment is on the network. The spot turns over as soon as it settles.",
    });
  }
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
      return "Somebody took that spot first. Nothing has been charged.";
    case "position_held":
      return "Somebody is paying for that spot right now. Try again in a few minutes.";
    case "own_space":
      return "That is your own listing, so there is nothing to buy on it.";
    case "space_closed":
      return "That listing has closed. Nothing has been charged.";
    case "offer_not_payable":
      return "That offer can no longer be paid — it may have expired. Nothing has been charged.";
    case "relayer_not_configured":
      return "Payments are briefly unavailable. Nothing has been charged.";
    case "not_enough_points":
      return "You do not have enough HiPoints for that share of the fee. Choose a smaller one.";
    default:
      return "We could not hold that spot. Nothing has been charged.";
  }
}
