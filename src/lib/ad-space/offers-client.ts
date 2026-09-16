/**
 * Offers and bids from the browser (hispace-offers-v0.md).
 *
 * A sponsor with no account names a price: a funds check signed with their
 * wallet (optional for an offer, required for a bid), the offer itself, and
 * then a manage link, `/o/<token>`, which is the offer's only credential. The
 * token is treated like a password: it goes into the API path and this
 * browser's localStorage, never into a log line, a Referer or anything else.
 *
 * Nothing here moves money. An accepted offer is paid through the ordinary
 * checkout, at the agreed amount, bound to the offer by its token.
 *
 * Clients switch on `error.code`, never on the message.
 */

import { AD_SPACE_API } from "./config";
import { CheckoutError, apiRequest, describeSessionError, type EvmCheckout, type SolanaCheckout } from "./checkout-client";
import { CHAIN_LABEL, clockTime } from "./format";
import type {
  Chain,
  ContactKind,
  OfferKind,
  OfferMode,
  OfferProof,
  OfferThread,
  OfferView,
  Position,
  PositionOffers,
  Space,
} from "./types";

/* ── Limits the contract sets ─────────────────────────────────────────── */

/** Every offer, counter and bid is at least $25 … */
export const OFFER_MIN_CENTS = 2_500;
/** … and at most the existing price ceiling, $25,000. */
export const OFFER_MAX_CENTS = 2_500_000;
/** A session keeps its own $50 floor (`price_below_minimum`). */
export const SESSION_MIN_CENTS = 5_000;
export const OFFER_NAME_MAX = 60;
export const OFFER_MESSAGE_MAX = 280;

/* ── Amounts ──────────────────────────────────────────────────────────── */

/**
 * What a sponsor typed, in whole cents: "300", "300.5", "$1,200.50". Null when
 * it is not an amount of dollars with at most two decimals.
 */
export function parseUsdToCents(input: string): number | null {
  const v = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) ? cents : null;
}

/** A server amount, "441.00", in cents, for comparing and prefilling only. */
export function usdcToCents(usdc: string | null | undefined): number | null {
  return usdc ? parseUsdToCents(usdc) : null;
}

/** 31500 to "315.00", the way the server writes USDC. */
export function usdcFromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

export interface OfferFigures {
  /** What the wallet would sign for. */
  sponsorPaysCents: number;
  /** What would reach the creator. */
  creatorReceivesCents: number;
  feeCents: number;
}

/**
 * What an amount the sponsor is still typing comes to, before the server has
 * seen it. The amount is the creator's side, before our fee, as `amountCents`
 * is in the contract. The fee is rounded to the cent, half up.
 *
 * ASSUMPTION: the server rounds the same way. Once an offer exists every
 * figure on screen is the server's (`sponsorPaysUsdc`, `agreedSponsorPaysUsdc`),
 * and this is only the preview under the input.
 */
export function offerFigures(amountCents: number, feeBps: number, feePayer: "sponsor" | "creator"): OfferFigures {
  const feeCents = Math.round((amountCents * feeBps) / 10_000);
  return feePayer === "sponsor"
    ? { sponsorPaysCents: amountCents + feeCents, creatorReceivesCents: amountCents, feeCents }
    : { sponsorPaysCents: amountCents, creatorReceivesCents: amountCents - feeCents, feeCents };
}

/* ── How a space sells ────────────────────────────────────────────────── */

/**
 * The offer mode of a spot, or of a service space when no position is given.
 * The server's `offers.mode` wins; without it the space's own fields decide,
 * so a board whose offers block has not arrived yet still reads right.
 */
export function offerModeOf(
  space: Pick<Space, "pricingMode" | "acceptsOffers" | "spaceOffers" | "kind">,
  position?: Pick<Position, "offers"> | null,
): OfferMode | null {
  const fromServer = position?.offers?.mode ?? (space.kind === "service" ? space.spaceOffers?.mode : undefined);
  if (fromServer) return fromServer;
  if (space.pricingMode === "offers") return "offers";
  if (space.pricingMode === "bids") return "bids";
  if (space.pricingMode === "fixed" && space.acceptsOffers) return "fixed_with_offers";
  return null;
}

/** The public offers block for a spot, or for the whole space on a service. */
export function offersFor(space: Pick<Space, "kind" | "spaceOffers">, position?: Position | null): PositionOffers | null {
  if (space.kind === "service") return space.spaceOffers ?? null;
  return position?.offers ?? null;
}

/**
 * The least a sponsor may type here, in cents: the contract's floor (or the
 * session floor), and on a bid the next minimum the server named.
 */
export function minimumCents(kind: OfferKind, session: boolean, offers: PositionOffers | null): number {
  const floor = session ? SESSION_MIN_CENTS : OFFER_MIN_CENTS;
  if (kind !== "bid") return floor;
  const next = usdcToCents(offers?.nextMinimumBidUsdc ?? offers?.openingBidUsdc ?? null);
  return next !== null ? Math.max(floor, next) : floor;
}

/* ── Calls ────────────────────────────────────────────────────────────── */

const PUBLIC_OFFERS = `${AD_SPACE_API}/public/offers`;

export interface Challenge {
  nonce: string;
  /** The exact text the wallet signs. */
  message: string;
  expiresAt: string;
}

export function requestOfferChallenge(body: {
  spaceId: string;
  positionId?: string;
  chain: Chain;
  address: string;
  amountCents: number;
}): Promise<Challenge> {
  return apiRequest<Challenge>(`${PUBLIC_OFFERS}/challenge`, { json: body });
}

export interface NewOfferBody {
  spaceId: string;
  positionId?: string;
  amountCents: number;
  sponsorName: string;
  contact: { kind: ContactKind; value: string };
  message?: string;
  proof?: OfferProof;
}

export function submitOffer(body: NewOfferBody): Promise<{ offer: OfferView; manageUrl: string }> {
  return apiRequest(PUBLIC_OFFERS, { json: body });
}

/** Calls under `/public/offers/:token`. The token is the only credential. */
function tokenCall<T>(token: string, path: string, init: { method: string; json?: unknown; key?: string }): Promise<T> {
  return apiRequest<T>(`${PUBLIC_OFFERS}/${encodeURIComponent(token)}${path}`, {
    ...init,
    // The token is in the path: never let it leave in a Referer.
    referrerPolicy: "no-referrer",
  });
}

export function getOfferClient(token: string): Promise<OfferThread> {
  return tokenCall<OfferThread>(token, "", { method: "GET" });
}

export type RespondBody =
  | { action: "accept_counter" }
  | { action: "withdraw" }
  | { action: "raise"; amountCents: number; proof?: OfferProof };

export function respondToOffer(token: string, body: RespondBody): Promise<OfferThread> {
  return tokenCall<OfferThread>(token, "/respond", { method: "POST", json: body });
}

/**
 * The checkout for an accepted offer: exactly the position checkout's answer,
 * priced at the agreed amount. It carries the browser's checkout key like any
 * web checkout, so the confirm, content and media calls that follow work the
 * same way.
 */
export function startOfferCheckout(
  token: string,
  key: string,
  body: { chain: "solana"; sponsorAddress: string },
): Promise<SolanaCheckout>;
export function startOfferCheckout(
  token: string,
  key: string,
  body: { chain: "base" | "polygon"; sponsorAddress: string },
): Promise<EvmCheckout>;
export function startOfferCheckout(
  token: string,
  key: string,
  body: { chain: Chain; sponsorAddress: string },
): Promise<SolanaCheckout | EvmCheckout> {
  return tokenCall(token, "/checkout", { method: "POST", json: body, key });
}

/* ── The manage link ──────────────────────────────────────────────────── */

/** 32 random bytes, base64url, no padding. */
export const OFFER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The token out of a manage link, `https://hihodl.xyz/o/<token>`, or null. Only
 * the path is read: whatever host the server writes, the page links to its own.
 */
export function offerToken(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url, "https://hihodl.xyz").pathname.match(/^\/o\/([A-Za-z0-9_-]{43})\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function offerPath(token: string): string {
  return `/o/${token}`;
}

/** What this browser remembers of an offer it made, to find the way back to it. */
export interface SavedOffer {
  token: string;
  kind: OfferKind;
  positionId: string | null;
  label: string | null;
  amountUsdc: string;
  at: string;
}

const SAVED_PREFIX = "hihodl:ad-space:offers:";
const SAVED_MAX = 20;

/** The offers this browser made on a space, newest first. Empty when storage is refused. */
export function savedOffers(spaceId: string): SavedOffer[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PREFIX + spaceId);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (o): o is SavedOffer =>
        typeof o === "object" && o !== null && typeof o.token === "string" && OFFER_TOKEN_RE.test(o.token),
    );
  } catch {
    return [];
  }
}

/** Keep an offer's link in this browser, keyed by space. The server keeps only its hash. */
export function rememberOffer(spaceId: string, entry: SavedOffer): void {
  try {
    const rest = savedOffers(spaceId).filter((o) => o.token !== entry.token);
    window.localStorage.setItem(SAVED_PREFIX + spaceId, JSON.stringify([entry, ...rest].slice(0, SAVED_MAX)));
  } catch {
    // Storage refused (a private window): the link on screen is the copy.
  }
}

/* ── Errors in plain words ────────────────────────────────────────────── */

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export interface OfferErrorContext {
  kind?: OfferKind;
  chain?: Chain | null;
  /** "session" on a session space, else "spot". */
  subject?: "spot" | "session";
}

/**
 * One sentence per offer code (hispace-offers-v0.md, "Errors" and the creator
 * and publish refusals), saying what happened and what to do. Null for a code
 * that is not about offers, so the caller falls through to `describeError`.
 */
export function describeOfferError(e: unknown, ctx: OfferErrorContext = {}): string | null {
  if (!(e instanceof CheckoutError)) return null;
  const d = e.details;
  const bid = ctx.kind === "bid";
  const thing = bid ? "bid" : "offer";
  const subject = ctx.subject ?? "spot";
  const net = ctx.chain ? CHAIN_LABEL[ctx.chain] : "that network";

  switch (e.code) {
    case "offers_not_accepted":
      return "This space doesn't take offers or bids. Refresh the page to see how it sells now.";
    case "offer_too_low": {
      const min = str(d.minimumUsdc);
      return min
        ? `That's too low: an ${thing} here starts at ${min} USDC.`
        : `That's too low: an ${thing} starts at $${subject === "session" ? 50 : 25}.`;
    }
    case "price_below_minimum":
      return `That's too low: an ${thing} on a session starts at $50.`;
    case "offer_too_high":
      return `That's more than any ${subject} can cost ($25,000). Lower the amount.`;
    case "offer_not_below_price":
      return "That's the listed price or more, so there is nothing to negotiate: use Buy now instead.";
    case "bid_too_low": {
      const next = str(d.nextMinimumBidUsdc);
      return next
        ? `Someone bid in the meantime. The next bid has to be at least ${next} USDC.`
        : "That bid is too low. Refresh the page to see the next minimum bid.";
    }
    case "bid_needs_backing": {
      const need = str(d.neededUsdc);
      const have = str(d.balanceUsdc);
      const base = "A bid has to be backed by a wallet holding what you would pay.";
      return need && have
        ? `${base} The wallet you checked has ${have} USDC on ${net} and this bid needs ${need}. Check a wallet with enough USDC, or bid less.`
        : `${base} Check your funds with a wallet that holds enough USDC, then send it again.`;
    }
    case "bidding_closed":
      return "Bidding on this spot has ended, so it takes no more bids.";
    case "name_not_allowed":
      return "That name can't be shown on the page. Use your own name or your brand's, with no links.";
    case "contact_invalid":
      return "That contact doesn't look right. An X or Telegram handle, or a full email address.";
    case "message_invalid":
      return `A message is up to ${OFFER_MESSAGE_MAX} characters.`;
    case "proof_invalid":
      return "Your wallet's signature didn't check out. Check your funds again with the same wallet.";
    case "proof_expired":
      return "Your funds check expired: it lasts 5 minutes. Check your funds again, then send.";
    case "chain_not_accepted":
      return `This creator doesn't take payments on ${net}. Pick another network.`;
    case "raise_too_low":
      return `A raise has to be more than your last ${thing}.`;
    case "space_closed":
    case "space_not_live":
      return "This HiSpace has closed, so it takes no more offers or bids.";
    case "position_sold":
      return subject === "session" ? "Every session here has been booked." : "This spot has just sold.";
    case "own_space":
      return "This is your own space, so you can't make an offer on it.";
    case "too_many_offers":
      return "You already have 5 open offers on this space with this contact. Wait for an answer, or withdraw one first.";
    case "position_reserved": {
      const until = str(d.reservedUntil);
      return until
        ? `An accepted offer holds this ${subject} until ${clockTime(until)}. If it isn't paid by then, it opens again.`
        : `An accepted offer holds this ${subject} while it waits for its payment. If it isn't paid in time, it opens again.`;
    }
    case "offer_not_accepted":
      return "This offer isn't accepted, so there is nothing to pay yet. The page now shows where it stands.";
    case "offer_not_open":
      return `This ${thing} has already closed, so it can't change. The page now shows where it stands.`;
    case "offer_changed":
      return `This ${thing} changed while you were looking. The page now shows the latest.`;
    case "too_many_rounds":
      return "This offer has had all the counter-offers it can. The creator can still accept or decline it.";
    case "no_slot_free":
      return "Every slot here is already sold or held for another sponsor.";
    case "too_close_to_closing":
      return "This space closes too soon to leave 24 hours to pay, so the offer can't be accepted now.";
    // The rest come from the creator's side (countering, publishing). No call
    // this page makes should get them; mapped so a raw code never shows.
    case "counter_not_above_offer":
      return "A counter-offer has to be above the offer it answers.";
    case "counter_above_price":
      return "A counter-offer can't be above the listed price.";
    case "not_for_bids":
      return "A bid can't be countered. It can only be accepted or declined.";
    case "bids_need_placement":
      return "Bidding is only for spots on an item, not for services.";
    case "offers_only_on_fixed":
      return "Only a space with a fixed price can also take offers.";
    case "bidding_end_invalid":
      return "The end of bidding has to be at least a day after publishing and two days before the space closes.";
    case "reserve_below_opening_bid":
      return "The reserve can't be below the opening bid.";
    case "minimum_not_below_price":
      return "The hidden minimum has to be below the listed price.";
    case "offer_price_invalid":
      return "A price has to be between $25 and $25,000.";
    case "VALIDATION_ERROR":
      return "Something in the form isn't right. Check the amount, your name, your contact and the message.";
    case "rate_limited":
      return e.status === 503
        ? "Offers are paused for a moment on our side. Try again in a minute."
        : "Too many offers from this connection lately. Wait a while and try again.";
    case "not_found":
      return "We can't find this offer. Check you copied the whole link.";
    default:
      return describeSessionError(e);
  }
}

/** Codes after which the page shows an old state: read the offer again. */
export const OFFER_STALE_CODES: ReadonlySet<string> = new Set([
  "offer_not_open",
  "offer_changed",
  "offer_not_accepted",
  "bidding_closed",
  "position_sold",
  "space_closed",
  "too_many_rounds",
]);
