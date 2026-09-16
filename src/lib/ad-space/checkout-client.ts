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
import { CHAIN_LABEL, clockTime } from "./format";
import type { ApiErrorBody, Chain, ConfirmOutcome, ContentKind, EvmPayload, Order, Space } from "./types";

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

async function call<T>(
  path: string,
  key: string,
  init: { method?: string; json?: unknown; raw?: Blob; contentType?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", "X-Checkout-Key": key };
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
    res = await fetch(`${AD_SPACE_API}${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
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
  body: { chain: "solana"; sponsorAddress: string },
): Promise<SolanaCheckout>;
export function startCheckout(
  positionId: string,
  key: string,
  body: { chain: "base" | "polygon"; sponsorAddress: string },
): Promise<EvmCheckout>;
export function startCheckout(
  positionId: string,
  key: string,
  body: { chain: Chain; sponsorAddress: string },
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

/* ── Errors in plain words ─────────────────────────────────────────── */

/**
 * Why `POST /authorizations` turned the signatures down. On Base and Polygon
 * the checkout is only a quote, so another sponsor can sign first; in every
 * one of these cases nothing moved. Null for anything else.
 */
export function describeAuthorizationRefusal(e: unknown, chain: Chain): string | null {
  if (!(e instanceof CheckoutError)) return null;
  const net = CHAIN_LABEL[chain];
  switch (e.code) {
    case "position_held":
      return "Another sponsor signed for this spot a moment before you. Nothing was paid.";
    case "position_sold":
      return "This spot sold while you were signing. Nothing was paid.";
    case "space_closed":
      return "This Ad Space closed while you were signing. Nothing was paid.";
    case "insufficient_funds":
      return `This wallet no longer has enough USDC on ${net} for this spot. Nothing was paid.`;
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
export function describeError(e: unknown, chain?: Chain | null): string {
  const net = chain ? CHAIN_LABEL[chain] : "this network";

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

  const d = e.details;
  switch (e.code) {
    case "position_sold":
      return "Someone has just bought this spot. Pick another one on the board.";
    case "position_held": {
      const until = str(d.heldUntil);
      return until
        ? `Someone is paying for this spot right now. It frees up at ${clockTime(until)} if they don't.`
        : "Someone is paying for this spot right now. It frees up in a few minutes if they don't.";
    }
    case "space_closed":
    case "space_not_live":
      return "This Ad Space has closed, so its spots can't be bought any more.";
    case "insufficient_funds": {
      const need = str(d.neededUsdc);
      const have = str(d.balanceUsdc);
      return need && have
        ? `This wallet has ${have} USDC on ${net} and this spot needs ${need}. Add USDC or pay from another wallet.`
        : `This wallet doesn't have enough USDC on ${net} for this spot. Add USDC or pay from another wallet.`;
    }
    case "chain_not_accepted":
      return `This creator doesn't take payments on ${net}. Pick one of the other networks.`;
    case "own_address":
      return "That wallet belongs to the creator of this Ad Space. Sponsor from a different wallet.";
    case "invalid_address":
      return `Your wallet gave us an address we can't use on ${net}. Reconnect it and try again.`;
    case "bad_signature":
      return "Those signatures didn't match the payment. Sign again with the same wallet you connected.";
    case "too_many_holds":
      return "This connection is already holding spots that aren't paid. Finish those, or wait for them to lapse.";
    case "too_many_lapsed_holds":
      return "Too many unpaid holds from this connection lately. Try again later today.";
    case "space_busy":
      return "Two other people are paying for spots here right now. Try again in a few minutes, or pay on Base or Polygon.";
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
      return "Your hold on this spot ran out before the payment arrived. Start again to hold it for you.";
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
      return "We can't find this spot or order any more. Refresh the page.";
    case "network":
      return "We couldn't reach HOLD. Check your connection and try again.";
    default:
      return "Something went wrong on our side. Try again in a moment.";
  }
}
