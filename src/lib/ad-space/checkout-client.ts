/**
 * The public checkout, from the browser.
 *
 * Every call carries `X-Checkout-Key: K`. K is 32 random bytes, base64url, made
 * once per checkout and kept in localStorage per position, so a sponsor who
 * closes the tab mid-payment comes back to the same order. It is never shown
 * and never put in a URL; the server stores only its hash, and K is what lets
 * this browser see its order and hand over the sponsor's content later.
 * `C = hex(sha256(K))` is the checkout's public id, and the only form of it
 * that leaves the page (inside the Solana Pay QR).
 *
 * Clients switch on `error.code`, never on the message (see the contract).
 */

import { AD_SPACE_API } from "./config";
import { CHAIN_LABEL, clockTime, takeoverClosedText } from "./format";
import type {
  ApiErrorBody,
  Booking,
  BrandProduction,
  BriefBody,
  Chain,
  ConfirmOutcome,
  ContactKind,
  ContentKind,
  EvmPayload,
  Order,
  Space,
} from "./types";

/* ── The checkout key ─────────────────────────────────────────────── */

const KEY_PREFIX = "hihodl:ad-space:checkout:";

/** In-memory fallback for browsers that refuse localStorage (some private modes). */
const memoryKeys = new Map<string, string>();

function storageGet(name: string): string | null {
  try {
    return window.localStorage.getItem(name) ?? memoryKeys.get(name) ?? null;
  } catch {
    return memoryKeys.get(name) ?? null;
  }
}

function storageSet(name: string, value: string): void {
  memoryKeys.set(name, value);
  try {
    window.localStorage.setItem(name, value);
  } catch {
    // The in-memory copy keeps this visit working.
  }
}

function newKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // 32 bytes -> 44 base64 chars with one "=" of padding -> 43 base64url chars.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The key this tab already holds for a position, if any. */
export function existingCheckoutKey(positionId: string): string | null {
  return storageGet(KEY_PREFIX + positionId);
}

/** The key for a position, made on first use. */
export function checkoutKey(positionId: string): string {
  const name = KEY_PREFIX + positionId;
  const found = storageGet(name);
  if (found) return found;
  const key = newKey();
  storageSet(name, key);
  return key;
}

/**
 * A fresh key after an order lapsed or was cancelled, or when the server says
 * `hold_expired` / `checkout_key_reused`. The old one stays bound to the dead
 * order on the server, and a QR poll with it would keep finding that order
 * instead of the new one.
 */
export function rotateCheckoutKey(positionId: string): string {
  const key = newKey();
  storageSet(KEY_PREFIX + positionId, key);
  return key;
}

/**
 * C = hex(sha256(K)), hashing K exactly as it is sent in the header (its 43
 * ASCII characters), which is what the server receives and hashes.
 */
export async function checkoutId(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The Solana Pay transaction-request link the QR and the mobile button carry. */
export function solanaPayLink(positionId: string, c: string): string {
  const url = `${AD_SPACE_API}/public/solana-pay/${encodeURIComponent(positionId)}?c=${c}`;
  return `solana:${encodeURIComponent(url)}`;
}

/* ── Calls ────────────────────────────────────────────────────────── */

export class CheckoutError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/**
 * One call to our API from the browser, answering `data` or throwing a
 * CheckoutError carrying `error.code`. Shared by the HiSpace checkout, the
 * booking page and pay links.
 *
 * @param init.key the checkout key, sent as `X-Checkout-Key` when given.
 * @param init.referrerPolicy "no-referrer" when the URL holds a bearer token.
 */
export async function apiRequest<T>(
  url: string,
  init: {
    method?: string;
    key?: string;
    json?: unknown;
    raw?: Blob;
    contentType?: string;
    referrerPolicy?: ReferrerPolicy;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.key) headers["X-Checkout-Key"] = init.key;
  let body: BodyInit | undefined;
  if (init.raw) {
    headers["Content-Type"] = init.contentType ?? init.raw.type;
    body = init.raw;
  } else if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      ...(init.referrerPolicy ? { referrerPolicy: init.referrerPolicy } : {}),
    });
  } catch {
    throw new CheckoutError("network", 0);
  }

  let parsed: { data?: T; error?: ApiErrorBody } | null = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed || parsed.error || parsed.data === undefined) {
    const err = parsed?.error;
    const code = err?.code ?? (res.status === 429 ? "rate_limited" : res.status === 404 ? "not_found" : "server");
    throw new CheckoutError(code, res.status, err?.details ?? {});
  }
  return parsed.data;
}

function call<T>(
  path: string,
  key: string,
  init: { method?: string; json?: unknown; raw?: Blob; contentType?: string } = {},
): Promise<T> {
  return apiRequest<T>(`${AD_SPACE_API}${path}`, { ...init, key });
}

export interface SolanaCheckout {
  order: Order;
  solana: { transaction: string; lastValidBlockHeight: number };
}

export interface EvmCheckout {
  order: Order;
  evm: EvmPayload;
}

export function startCheckout(
  positionId: string,
  key: string,
  body: { chain: "solana"; sponsorAddress: string; brief?: BriefBody },
): Promise<SolanaCheckout>;
export function startCheckout(
  positionId: string,
  key: string,
  body: { chain: "base" | "polygon"; sponsorAddress: string; brief?: BriefBody },
): Promise<EvmCheckout>;
export function startCheckout(
  positionId: string,
  key: string,
  body: { chain: Chain; sponsorAddress: string; brief?: BriefBody },
): Promise<SolanaCheckout | EvmCheckout> {
  return call(`/public/positions/${encodeURIComponent(positionId)}/checkout`, key, { json: body });
}

export function confirmOrder(
  orderId: string,
  key: string,
  signature?: string,
): Promise<{ outcome: ConfirmOutcome; order: Order }> {
  return call(`/public/orders/${encodeURIComponent(orderId)}/confirm`, key, {
    json: signature ? { signature } : {},
  });
}

/** Codes that mean "this key is spent": drop it and retry with a fresh one. */
export const SPENT_KEY_CODES = new Set(["hold_expired", "checkout_key_reused"]);

/**
 * The space as this browser sees it. With the key of a paid checkout, the
 * sponsor's own position also carries `content` (pending, or rejected with a
 * reason), which the public view hides from everybody else.
 */
export async function spaceForCheckout(spaceId: string, key: string): Promise<Space> {
  const data = await call<{ space: Space }>(`/public/spaces/${encodeURIComponent(spaceId)}`, key);
  return data.space;
}

/** The order bound to this key, if a wallet has created one (Solana Pay). */
export async function currentCheckout(key: string): Promise<Order | null> {
  const data = await call<{ order: Order | null }>("/public/checkout", key);
  return data.order ?? null;
}

export function submitAuthorizations(
  orderId: string,
  key: string,
  sigs: { creatorSignature: string; feeSignature: string },
): Promise<{ outcome: ConfirmOutcome; order: Order; txHash: string | null }> {
  return call(`/public/orders/${encodeURIComponent(orderId)}/authorizations`, key, { json: sigs });
}

export function uploadMedia(orderId: string, key: string, image: Blob): Promise<{ path: string; url: string }> {
  return call(`/public/orders/${encodeURIComponent(orderId)}/media`, key, { raw: image });
}

export interface ContentBody {
  sponsorName: string;
  sponsorUrl?: string;
  xHandle?: string;
  contentKind: ContentKind;
  contentText?: string;
  imagePath?: string;
}

export function putContent(
  orderId: string,
  key: string,
  body: ContentBody,
): Promise<{ order: Order; content: { status: "pending" | "approved" | "rejected"; rejectedReason?: string | null } }> {
  return call(`/public/orders/${encodeURIComponent(orderId)}/content`, key, { method: "PUT", json: body });
}

/* ── Content production: the brief, and the brand's delivery page ─────── */

/**
 * File the brand's brief under this checkout key before any order exists.
 * The Solana Pay QR needs it: the wallet that scans it opens the order and
 * cannot carry a brief, so the order picks up this one.
 */
export function fileBrief(positionId: string, key: string, brief: BriefBody): Promise<{ brief: BriefBody }> {
  return call("/public/checkout/brief", key, { method: "PUT", json: { positionId, brief } });
}

const BRAND_PREFIX = "hihodl:ad-space:brand:";

/** The token out of a brand link, `https://hihodl.xyz/p/<token>`, or null. */
export function brandToken(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url, "https://hihodl.xyz").pathname.match(/^\/p\/([A-Za-z0-9_-]{16,128})\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** The brand link for a paid production order, kept per order like the booking link. */
export function rememberBrandToken(order: Order): string | null {
  const name = BRAND_PREFIX + order.id;
  const fresh = brandToken(order.manageUrl);
  if (fresh) {
    storageSet(name, fresh);
    return fresh;
  }
  return storageGet(name);
}

/** Calls under `/public/productions/:token`. The token is the only credential. */
function productionCall<T>(token: string, path: string, init: { method: string; json?: unknown }): Promise<T> {
  return apiRequest<T>(`${AD_SPACE_API}/public/productions/${encodeURIComponent(token)}${path}`, {
    ...init,
    referrerPolicy: "no-referrer",
  });
}

export async function acceptProduction(token: string): Promise<BrandProduction> {
  return (await productionCall<{ production: BrandProduction }>(token, "/accept", { method: "POST", json: {} })).production;
}

export async function askForRevision(token: string, note: string): Promise<BrandProduction> {
  return (await productionCall<{ production: BrandProduction }>(token, "/revision", { method: "POST", json: { note } }))
    .production;
}

/* ── Sessions: the manage link and what the buyer sends ───────────────── */

const MANAGE_PREFIX = "hihodl:ad-space:manage:";

/**
 * The token out of a manage link, `https://hihodl.xyz/b/<token>`, or null if
 * the link is not one. Only the path is read: whatever host the server writes,
 * the page links to its own `/b/`.
 */
export function manageToken(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url, "https://hihodl.xyz").pathname.match(/^\/b\/([A-Za-z0-9_-]{16,128})\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * The manage link for a paid session order: the one on the order if the server
 * sent it, else the copy this browser kept the first time it saw it. Kept per
 * order in localStorage, like the checkout key, because the server stores only
 * the token's hash and may not be able to hand it out twice.
 */
export function rememberManageToken(order: Order): string | null {
  const name = MANAGE_PREFIX + order.id;
  const fresh = manageToken(order.manageUrl);
  if (fresh) {
    storageSet(name, fresh);
    return fresh;
  }
  return storageGet(name);
}

export interface ContactBody {
  contact: { kind: ContactKind; value: string };
  brief: string;
}

/** Calls under `/public/bookings/:token`. The token is the only credential. */
function bookingCall<T>(token: string, path: string, init: { method: string; json?: unknown }): Promise<T> {
  return apiRequest<T>(`${AD_SPACE_API}/public/bookings/${encodeURIComponent(token)}${path}`, {
    ...init,
    // The token is in the path: never let it leave in a Referer.
    referrerPolicy: "no-referrer",
  });
}

export async function getBookingClient(token: string): Promise<Booking> {
  return (await bookingCall<{ booking: Booking }>(token, "", { method: "GET" })).booking;
}

export async function putSessionContact(token: string, body: ContactBody): Promise<Booking> {
  return (await bookingCall<{ booking: Booking }>(token, "/contact", { method: "PUT", json: body })).booking;
}

export async function confirmSession(
  token: string,
  body: { outcome: "delivered" | "didnt_happen"; note?: string },
): Promise<Booking> {
  return (await bookingCall<{ booking: Booking }>(token, "/confirm", { method: "POST", json: body })).booking;
}

/**
 * The session codes, in plain words. Null for any other code, so the caller
 * falls through to `describeError`.
 */
export function describeSessionError(e: unknown): string | null {
  if (!(e instanceof CheckoutError)) return null;
  switch (e.code) {
    case "not_a_session":
      return "This booking isn't a session, so there is nothing to confirm here.";
    case "session_not_started":
      return "The session hasn't started yet. You can answer once its time comes.";
    case "confirm_window_closed":
      return "The 7 days to answer have passed, so this booking is closed and your answer can't change any more.";
    case "already_confirmed":
      return "This session has already been answered, so it can't be changed any more. The page now shows where it stands.";
    case "order_not_paid":
      return "This payment hasn't confirmed yet. Once it does, you can send your contact and confirm the session here.";
    case "session_event_over":
      return "This event has ended, so its sessions can't be booked any more. Nothing was paid.";
    case "session_already_started":
      return "The session has already started, so its time and place can't change any more.";
    case "session_in_the_past":
      return "That time has already passed. Pick a time that's still to come.";
    // The next three come from the creator's side (scheduling, publishing,
    // creating an event in the app); no call this site makes can get them.
    // Mapped anyway so a sentence never falls back to a raw code.
    case "confirm_window_open":
      return "The buyer can already say whether the session happened, so its time and place can't change any more.";
    case "session_closes_after_event":
      return "A session space has to close by the end of the day after its event.";
    case "time_zone_invalid":
      return "That time zone isn't one we recognise. Use a name like \"Asia/Singapore\".";
    case "session_place_invalid":
      return "Say where the session is in up to 120 characters, like \"TOKEN2049 venue, Level 4 lounge\".";
    case "no_dispute":
      return "The buyer hasn't said this session didn't happen, so there is nothing to reply to.";
    case "already_replied":
      return "There is already a reply on this dispute, and there can only be one.";
    case "reply_invalid":
      return "A reply is 1 to 280 characters.";
    case "not_for_sessions":
      return "A session is confirmed by the person who booked it, so there is no link to send for it.";
    case "takeover_not_for_sessions":
      return "A booked session can't be taken over by paying more.";
    case "session_outside_event":
      return "That time is outside the event's dates. A session has to fall between the day before the event and the day after it.";
    case "contact_invalid":
      return "That contact doesn't look right. An X or Telegram handle, or a full email address.";
    case "room_needs_an_event":
      return "A session is always at an event, so this space needs one.";
    case "fallback_not_for_sessions":
      return "For a session the creator can refund you or offer their next event; delivering content instead doesn't apply.";
    case "price_below_minimum":
      return "A session costs at least $50.";
    case "not_found":
      return "This booking link doesn't work. Check you copied all of it.";
    default:
      return null;
  }
}

/* ── Errors in plain words ─────────────────────────────────────────── */

/**
 * Why `POST /authorizations` turned the signatures down. On Base and Polygon
 * the checkout is only a quote, so another sponsor can sign first; in every
 * one of these cases nothing moved. Null for anything else.
 */
/**
 * What is being bought, for the sentences below: a spot a sponsor pays for, or
 * a session a buyer books (hispace-in-the-room-v0.md).
 */
export type Subject = "spot" | "session";

export function describeAuthorizationRefusal(e: unknown, chain: Chain, subject: Subject = "spot"): string | null {
  if (!(e instanceof CheckoutError)) return null;
  const net = CHAIN_LABEL[chain];
  const session = subject === "session";
  switch (e.code) {
    case "position_held":
      return session
        ? "Someone else signed for this session a moment before you. Nothing was paid."
        : "Another sponsor signed for this spot a moment before you. Nothing was paid.";
    case "position_sold":
      return `This ${subject} ${session ? "was booked" : "sold"} while you were signing. Nothing was paid.`;
    // One brand takes everything (ad-space-whole-listing-v0.md): the listing
    // and its spots refuse each other, and the sponsor is told which way round
    // it went — "sold" would be a lie about a square nobody bought.
    case "whole_listing_taken":
      return `A brand took this whole listing while you were signing, so its ${subject}s aren't for sale. Nothing was paid.`;
    case "parts_already_sold":
      return `A ${subject} on this listing sold while you were signing, so it can't be bought whole any more. Nothing was paid.`;
    case "space_closed":
      return "This HiSpace closed while you were signing. Nothing was paid.";
    case "insufficient_funds":
      return `This wallet no longer has enough USDC on ${net} for this ${subject}. Nothing was paid.`;
    case "bad_signature":
      return "Those signatures didn't match the payment, so we didn't send it. Nothing was paid.";
    case "would_revert":
      return `That payment would fail on ${net}, so we didn't send it. Nothing was paid.`;
    default:
      return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * One sentence per error code, saying what happened and what to do. The
 * server's message is never shown: it is written for developers.
 */
export function describeError(e: unknown, chain?: Chain | null, subject: Subject = "spot"): string {
  const net = chain ? CHAIN_LABEL[chain] : "this network";
  const session = subject === "session";

  // Wallets reject with EIP-1193 code 4001 or a message; Solana wallets differ.
  const walletCode = (e as { code?: unknown })?.code;
  if (walletCode === 4001 || walletCode === "ACTION_REJECTED") {
    return "You closed your wallet without signing. Nothing was paid.";
  }
  if (!(e instanceof CheckoutError)) {
    const msg = String((e as { message?: unknown })?.message ?? "").toLowerCase();
    if (msg.includes("reject") || msg.includes("denied") || msg.includes("cancel")) {
      return "You closed your wallet without signing. Nothing was paid.";
    }
    return "Your wallet could not finish that. Nothing was paid; try again, or pay another way.";
  }

  const sessionText = describeSessionError(e);
  if (sessionText && e.code !== "not_found") return sessionText;

  const d = e.details;
  switch (e.code) {
    case "brief_required":
      return "Fill in the brief first: the creator films from it. Nothing was paid.";
    case "brief_invalid":
      return "Something in the brief doesn't fit. Check the key messages, the assets link (https://) and the contact handle.";
    case "position_sold":
      return session
        ? "Someone has just booked this session. Pick another one."
        : "Someone has just bought this spot. Pick another one on the board.";
    case "position_held": {
      const until = str(d.heldUntil);
      return until
        ? `Someone is paying for this ${subject} right now. It frees up at ${clockTime(until)} if they don't.`
        : `Someone is paying for this ${subject} right now. It frees up in a few minutes if they don't.`;
    }
    case "position_reserved": {
      // hispace-offers-v0.md: an accepted offer holds the spot for its sponsor.
      const until = str(d.reservedUntil);
      return until
        ? `An accepted offer holds this ${subject} until ${clockTime(until)}. If it isn't paid by then, it opens again.`
        : `An accepted offer holds this ${subject} while it waits for its payment. If it isn't paid in time, it opens again.`;
    }
    // A brand that came for one square, on a listing somebody is taking whole.
    case "whole_listing_taken":
      return `One brand is taking this whole listing, so no single ${subject} on it is for sale.`;
    // And the other way round: a brand that came for all of it, too late.
    case "parts_already_sold":
      return `A ${subject} on this listing has already gone, so it can't be bought whole any more. You can still take the ${subject}s that are left.`;
    case "space_closed":
    case "space_not_live":
      return `This HiSpace has closed, so its ${subject}s can't be ${session ? "booked" : "bought"} any more.`;
    case "insufficient_funds": {
      const need = str(d.neededUsdc);
      const have = str(d.balanceUsdc);
      return need && have
        ? `This wallet has ${have} USDC on ${net} and this ${subject} needs ${need}. Add USDC or pay from another wallet.`
        : `This wallet doesn't have enough USDC on ${net} for this ${subject}. Add USDC or pay from another wallet.`;
    }
    case "chain_not_accepted":
      return `This creator doesn't take payments on ${net}. Pick one of the other networks.`;
    case "takeover_chain_unsupported":
      return `A sold spot can't be taken over on ${net} yet. Pay on Solana to take it.`;
    case "wrong_chain": {
      const was = str(d.chain);
      const label = was && was in CHAIN_LABEL ? CHAIN_LABEL[was as Chain] : null;
      return label
        ? `This spot was bought on ${label}, so it can only be taken over on ${label}: the sponsor who holds it is repaid in the same payment. Pay on ${label} instead.`
        : "This spot was bought on another network, and it can only be taken over on that one. Pick that network instead.";
    }
    case "already_yours":
      return "This wallet already holds this spot, so there is nothing to take over. Nothing was paid.";
    case "creator_cannot_bid":
      return "That wallet belongs to the creator of this HiSpace, so it can't take over a spot here. Use a different wallet.";
    case "nothing_to_take_over":
      return "This spot isn't held by a sponsor right now, so there is nothing to take over. Refresh the page to see it as it is.";
    case "too_many_takeovers":
    case "price_ceiling":
      return takeoverClosedText(e.code);
    case "own_address":
      return `That wallet belongs to the creator of this HiSpace. ${session ? "Book" : "Sponsor"} from a different wallet.`;
    case "invalid_address":
      return `Your wallet gave us an address we can't use on ${net}. Reconnect it and try again.`;
    case "bad_signature":
      return "Those signatures didn't match the payment. Sign again with the same wallet you connected.";
    case "too_many_holds":
      return `This connection is already holding ${subject}s that aren't paid. Finish those, or wait for them to lapse.`;
    case "too_many_lapsed_holds":
      return "Too many unpaid holds from this connection lately. Try again later today.";
    case "space_busy":
      return `Two other people are paying for ${subject}s here right now. Try again in a few minutes.`;
    case "would_revert":
      return `That payment would fail on ${net}, so we didn't send it. Nothing was paid. Check the wallet's USDC, or try another wallet.`;
    case "chain_unavailable":
      return `Payments on ${net} are paused right now. Pick another network, or try again shortly.`;
    case "relayer_not_configured":
      return `Payments on ${net} aren't switched on yet. Pick another network.`;
    case "gas_too_expensive":
      return `${net} fees are unusually high right now. Try again in a few minutes, or pick another network.`;
    case "hold_expired":
    case "checkout_key_reused":
      return `Your hold on this ${subject} ran out before the payment arrived. Start again to hold it for you.`;
    case "already_paid":
      return "This order is already paid.";
    case "payment_pending":
      return "Your payment is still on its way. This page updates on its own.";
    case "order_uses_another_wallet":
      return "This order was started with a different wallet. Connect that one, or start again.";
    case "rate_limited":
      // 503 means our limiter is down and checkout fails closed; 429 is a burst.
      return e.status === 503
        ? "Checkout is paused for a moment on our side. Nothing was paid; try again in a minute."
        : "Too many requests from this connection. Wait a moment and try again.";
    case "not_found":
      return `We can't find this ${subject} or order any more. Refresh the page.`;
    case "network":
      return "We couldn't reach HOLD. Check your connection and try again.";
    default:
      return "Something went wrong on our side. Try again in a moment.";
  }
}
