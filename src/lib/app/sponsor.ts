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
 * It takes two taps. Steps 1 and 2 (and reading what the prompt needs) run on
 * "Pay" (`prepareSpot`); the prompt is the first thing the second tap does,
 * "Approve with passkey" (`approveSpot`). Safari refuses a passkey prompt that
 * starts after several network calls, because the tap no longer counts.
 *
 * ── WHO APPROVES ──
 *
 * `GET /wallet-backup/status` → `canPayFromWeb` picks it
 * (documentation/one-wallet-every-device.md, rule 4 and "Payments built by
 * the server, approved on the phone"):
 *
 *   app          an Android phone is linked. After the claim, `POST
 *                /payment-approvals { kind: "spot", ref: { orderId } }`; the
 *                phone approves AND signs, and this page submits what comes
 *                back signed. Every wallet, including one made in the app,
 *                whose key the web never holds. The passkey is never opened.
 *   web_passkey  the two taps above, unchanged. A 409 APPROVE_ON_YOUR_PHONE
 *                from the passkey doors (a phone linked meanwhile) switches
 *                to the phone.
 *   link_first   a wallet made in the app with no Android phone: "Link your
 *                phone to pay from here". Never a dead end.
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
import { call } from "@/lib/creator/api";
import { sha256 } from "@noble/hashes/sha256";

import { authorizeTxPasskey, relayerSubmit, txApprovalChallenge, type AssertionOptionsJSON } from "@/lib/link/api";
import {
  cancelPaymentApproval,
  describeApprovalRefusal,
  endedWithoutPaying,
  requestPaymentApproval,
  waitForPhone,
  type PaymentApproval,
} from "@/lib/link/payment-approvals";
import { getWalletBackup, getWalletStatus, payerOf, type WalletBackup } from "@/lib/wallet/api";
import { fromBase64, wipe } from "@/lib/wallet/core";
import { openWallet } from "@/lib/wallet/flows";
import { assertWithPrf } from "@/lib/wallet/passkey";
import { messageOf, signSerializedTx } from "@/lib/wallet/sign-tx";
import { sameBytes, txChallenge } from "@/lib/wallet/withdraw-core";

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
  /** Held and built: the passkey is asked on the NEXT tap ("Approve with passkey"). */
  | { kind: "ready"; prepared: PreparedSpot }
  | { kind: "approving" }
  | { kind: "signing" }
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
   * A wallet made in the HOLD app with no Android phone linked: the web holds
   * no key for it, so the way to pay from here is to link the phone once.
   * documentation/one-wallet-every-device.md, rule 4.
   */
  | { kind: "link-first" }
  /** No wallet at all. `canMake`: the web can make one now (the rollout gate is open). */
  | { kind: "no-wallet"; canMake: boolean };

/**
 * Everything the passkey needs, read BEFORE the tap that asks for it.
 *
 * Safari only lets a page start a passkey prompt inside a user gesture, and a
 * gesture does not survive several network calls. So the spot is held, the
 * transaction built, the backup read and the challenge fetched (and checked
 * against our own digest of the bytes) first; the prompt is then the very
 * first thing the second tap does, as Withdraw.tsx does it.
 */
export interface PreparedSpot {
  from: string;
  handoff: RelayedHandoff;
  backup: WalletBackup;
  /** base64 of the compiled message: what the approval is bound to. */
  message: string;
  options: AssertionOptionsJSON;
  preparedAt: number;
}

/** The transaction's blockhash is good for about a minute: past this, prepare again rather than prompt. */
const FRESH_MS = 60_000;

/** A fresh idempotency key: the header wants 10 to 128 characters. */
function newKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `spot-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * ONE KEY PER SPOT, FOR AS LONG AS THIS PAGE LIVES.
 *
 * Pay is two taps now, and a payment left unapproved past FRESH_MS is
 * prepared again. With a new key each time that second claim was a second
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
 * Buy one spot, first half: whose wallet, hold the spot, and get the passkey
 * ready. Ends in `ready` (then `approveSpot`, on its own tap), or in a phase
 * that says why not.
 *
 * Every refusal here says "nothing has been charged", because nothing has.
 */
export async function prepareSpot(args: {
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

  /* 1 ── whose wallet, and who approves */
  const status = await getWalletStatus().catch(() => null);
  if (!status) return say({ kind: "stopped", message: "We couldn't read your wallet. Nothing has been charged. Try again." });
  const payer = payerOf(status);
  // A wallet made in the app, with no Android phone to approve on (or a
  // backend too old to say): linking the phone is the way to pay from here.
  if (payer === "link_first" || (status.state === "app_wallet" && payer === "none")) return say({ kind: "link-first" });
  const from = payer === "app" || payer === "web_passkey" ? (status.registered_address ?? null) : null;
  if (!from) {
    if (status.state === "app_wallet") {
      return say({ kind: "stopped", message: "We couldn't read your wallet's address. Nothing has been charged. Try again in a moment." });
    }
    if (status.state === "web_wallet") {
      // Made, but the backend does not watch it yet: one unlock on Wallet registers it.
      return say({ kind: "stopped", message: "Open Wallet and unlock it once, then buy from here. Nothing has been charged." });
    }
    return say({ kind: "no-wallet", canMake: status.enabled !== false });
  }

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
  // A handoff without a relayer is the signed-out shape and must not be signed
  // here: the fee payer would be this wallet, which has no SOL and never
  // agreed to pay one.
  if (!handoff?.transaction || !handoff.relayerPublicKey) {
    return say({ kind: "stopped", message: "We could not prepare that payment. Nothing has been charged." });
  }

  /* 3a ── a linked phone approves and signs: the passkey is never opened */
  if (payer === "app") {
    const onPhone = await payOnPhone({ order: handoff.order, say, signal: args.signal });
    if (onPhone !== "no_phone") return onPhone;
    // The phone was removed meanwhile: read who approves now, and fall back.
    const now = payerOf(await getWalletStatus().catch(() => null));
    if (now !== "web_passkey") return say({ kind: "link-first" });
  }

  /* 3b ── the passkey's challenge, bound to these exact bytes and checked here */
  try {
    const backup = await getWalletBackup();
    if (backup.wrappings.length === 0) throw new Error("no_passkey");
    const message = await messageOf(handoff.transaction);
    const challenge = await txApprovalChallenge(message);
    // The passkey approves only what this page is holding: the server's challenge must be our own digest.
    const bytes = fromBase64(message);
    if (!sameBytes(fromBase64(challenge.options.challenge), txChallenge(bytes))) throw new Error("challenge_mismatch");
    if (challenge.messageHash && !sameDigest(challenge.messageHash, sha256(bytes))) throw new Error("challenge_mismatch");
    return say({ kind: "ready", prepared: { from, handoff, backup, message, options: challenge.options, preparedAt: Date.now() } });
  } catch (e) {
    // A phone was linked meanwhile: it is the approver now, never the passkey.
    if (codeOf(e) === "APPROVE_ON_YOUR_PHONE") return phoneOrLink(handoff.order, say, args.signal);
    return say({ kind: "stopped", message: "We couldn't prepare the approval for that payment. Nothing has been charged." });
  }
}

/**
 * Buy one spot, second half: the passkey, then send. Call it straight from
 * the click: the prompt is its first await, so Safari sees the tap.
 *
 * Past `submitted` nothing is ever re-sent (THE LINE above).
 */
export async function approveSpot(args: {
  uid: string;
  prepared: PreparedSpot;
  onPhase: (p: PayPhase) => void;
  signal?: AbortSignal;
}): Promise<PayPhase> {
  const say = (p: PayPhase) => {
    args.onPhase(p);
    return p;
  };
  const { from, handoff, backup, message, options } = args.prepared;
  if (Date.now() - args.prepared.preparedAt > FRESH_MS) {
    return say({ kind: "stopped", message: "That waited too long to be sent, so it was not. Nothing has been charged. Tap Pay again." });
  }

  /* 4 ── one ceremony: approve these exact bytes, and open the wallet */
  let prf: Uint8Array | null = null;
  let seed: Uint8Array | null = null;
  let signed: string;
  try {
    const pending = assertWithPrf(
      options,
      backup.wrappings.map((w) => w.credential_id),
    );
    say({ kind: "approving" });
    const bound = await pending;
    prf = bound.prf;
    await authorizeTxPasskey(message, bound.assertion);

    say({ kind: "signing" });
    const key = await openWallet({ uid: args.uid, backup, credentialId: bound.credentialId, prf });
    seed = key.seed;
    signed = await signSerializedTx(handoff.transaction, seed, from);
  } catch (e) {
    // A phone was linked between the two taps: it approves now, not the passkey.
    if (codeOf(e) === "APPROVE_ON_YOUR_PHONE") return phoneOrLink(handoff.order, say, args.signal);
    return say({ kind: "stopped", message: "We couldn't approve that payment. Nothing has been charged." });
  } finally {
    wipe(prf, seed);
  }

  return sendAndConfirm({ signed, submitIdempotencyKey: handoff.submitIdempotencyKey, order: handoff.order, say });
}

/**
 * Send a signed spot, then tell Spaces. Shared by the passkey and the phone:
 * both end with the same bytes-plus-key, and past the submit there is one
 * way to behave. PAST THE SUBMIT NOTHING IS RE-SENT.
 */
async function sendAndConfirm(args: {
  signed: string;
  submitIdempotencyKey: string;
  order: Order;
  say: (p: PayPhase) => PayPhase;
}): Promise<PayPhase> {
  const { signed, order, say } = args;
  const handoff = { order, submitIdempotencyKey: args.submitIdempotencyKey };

  /* 5 ── send it. PAST THIS LINE NOTHING IS RE-SENT. */
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
    return say({ kind: "stopped", message: "We couldn't send that payment. Nothing has been charged. Try again." });
  }

  /* 6 ── tell Spaces, which is what turns the spot over */
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

/* ── The phone ────────────────────────────────────────────────────── */

/**
 * Ask the linked phone for a held order, wait for it, and send what it signed.
 *
 * "no_phone" is the one answer that is not a phase: the server says no
 * Android phone is linked any more (409 NO_PHONE_LINKED), and the caller
 * reads the status again to pick the passkey or the link screen.
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
    if (code === "NO_PHONE_LINKED") return "no_phone";
    if (code === "ALREADY_PAID") {
      return say({ kind: "in-flight", orderId: order.id, message: "This spot is already paid for. It turns over as soon as the payment settles." });
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
  if (!end) return say({ kind: "stopped", message: "We stopped waiting for your phone. Nothing has been charged." });

  switch (end.status) {
    case "rejected":
    case "expired":
    case "cancelled":
      return say({ kind: "stopped", message: endedWithoutPaying(end.status) });
    case "submitted":
      // Sent already (another tab of this page, most likely). Never a second time.
      return say({ kind: "in-flight", orderId: order.id, message: "This payment is already going through. Give it a moment and check the spot." });
    case "approved": {
      const c = end.continuation;
      if (!end.signedTx || !c || c.kind !== "spot" || !c.submitIdempotencyKey) {
        return say({ kind: "stopped", message: "Your phone approved it, but we couldn't read what it signed. Nothing has been charged. Try again." });
      }
      say({ kind: "on-phone", approval: end, order });
      return sendAndConfirm({ signed: end.signedTx, submitIdempotencyKey: c.submitIdempotencyKey, order, say });
    }
    default:
      return say({ kind: "stopped", message: "We stopped waiting for your phone. Nothing has been charged." });
  }
}

/** The passkey was refused for a linked phone: ask the phone, or send to the link screen when it has gone since. */
async function phoneOrLink(order: Order, say: (p: PayPhase) => PayPhase, signal?: AbortSignal): Promise<PayPhase> {
  const out = await payOnPhone({ order, say, signal });
  return out === "no_phone" ? say({ kind: "link-first" }) : out;
}

/** Cancel what the phone has not decided: the phone cannot approve it after, and the wait ends on "cancelled". */
export function cancelSpotApproval(id: string): Promise<PaymentApproval> {
  return cancelPaymentApproval(id);
}

/** The server's `messageHash` (hex or base64) against our own sha256 of the bytes. */
function sameDigest(given: string, mine: Uint8Array): boolean {
  const hex = Array.from(mine, (b) => b.toString(16).padStart(2, "0")).join("");
  if (/^[0-9a-f]{64}$/i.test(given)) return given.toLowerCase() === hex;
  try {
    return sameBytes(fromBase64(given), mine);
  } catch {
    return false;
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
