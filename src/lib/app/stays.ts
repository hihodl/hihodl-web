/**
 * Stays, read from the web.
 *
 * WHY THE WHOLE PRODUCT FITS HERE
 *
 * Every route on `server/api/travel.router.ts` sits behind `requireAuth` and
 * nothing else — config, places, search, the stay, its photos, its rates, the
 * prebook, the payment intent, the bookings list, a booking, the cancel. No
 * wallet signature, no device signature, no unlock. So the browser can carry
 * the entire product except the one step that moves money, and that step is a
 * transaction the person signs themselves (lib/app/stay-payment.ts).
 *
 * Settled against the backend on 2026-09-20 by reading
 * `.worktrees/backend-together/server/api/travel.router.ts`, and against
 * production:
 *
 *   curl -s -o /dev/null -w '%{http_code}' https://api.hihodl.xyz/api/v1/travel/config
 *   401   # mounted, wants a token
 *
 * THE TYPES ARE THE SERVER'S, NOT THE APP'S
 *
 * They are transcribed from the router's own response builders
 * (`toPublicRate`, `toPublicBooking`, the search payload), because the app's
 * copies are a client's reading of them and can drift. Where the router sends
 * a field the web has no screen for, it is still declared: an optional field
 * nobody reads costs nothing, and discovering later that it was there costs a
 * round trip through the backend repo.
 *
 * MONEY IS IN THE BOOKING'S OWN CURRENCY
 *
 * `price` is EUR (or whatever `currency` says) and never USDC. The USDC figure
 * exists in exactly one place — `payableFor` on the server — and arrives with
 * the payment intent. Nothing here converts anything: an FX rate computed in a
 * browser is a price we cannot honour.
 */

"use client";

import { read } from "./hold-api";

/* ── Config ───────────────────────────────────────────────────────── */

export type Plan = "free" | "pro";

export interface StayPromotion {
  /** What the badge says, e.g. "2x HiPoints". */
  label: string;
  multiplier: number;
  plan: Plan | null;
}

export interface StaysConfig {
  /** False when the supplier is not configured: the product is off, honestly. */
  available: boolean;
  /** True on the sandbox key. Every booking made then is marked. */
  sandbox: boolean;
  plan: Plan;
  headlineEarnRatePct: number;
  proEarnRatePct: number;
  pointsUsdValue: number;
  stayPromotions: StayPromotion[];
}

export function getStaysConfig(signal?: AbortSignal): Promise<StaysConfig> {
  return read<StaysConfig>("travel/config", { signal });
}

/* ── Where ────────────────────────────────────────────────────────── */

export interface Place {
  placeId: string;
  name: string;
  address: string | null;
  countryCode: string | null;
}

/** Destination autocomplete. Under two characters the server answers nothing. */
export function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 2) return Promise.resolve([]);
  return read<{ places: Place[] }>(`travel/places?q=${encodeURIComponent(q.trim())}`, { signal }).then(
    (r) => r.places ?? [],
  );
}

/* ── An image ─────────────────────────────────────────────────────── */

/**
 * A photograph, twice: the variant to ask for, and the original to fall back
 * to (`services/travel/hotel-images.ts`, `toImage`).
 *
 * The resize is a third-party CDN rewrite of liteAPI's URL, and it does fail —
 * which is the whole reason `origin` is sent. A photograph that 404s is a grey
 * rectangle where a hotel should be, so every `<img>` built from one of these
 * retries `origin` once on error.
 */
export interface Image {
  /** Resized for the surface that asked (row, card, hero). */
  url: string;
  /** Untouched liteAPI origin. What to retry with when `url` fails. */
  origin: string;
}

/* ── A price ──────────────────────────────────────────────────────── */

/**
 * One sellable rate. `offerId` is what a prebook is made against and it is
 * short-lived — a rate read ten minutes ago is not a rate you can still buy.
 */
export interface Rate {
  rateId: string;
  offerId: string;
  roomName: string;
  roomId: string | null;
  boardName: string | null;
  refundable: boolean;
  freeCancellationUntil: string | null;
  cancellationFee: number | null;
  maxOccupancy: number | null;
  currency: string;
  /** The whole stay, all nights, what the guest pays us. */
  price: number;
  /** Taxes and fees the property collects itself, on top. */
  payAtProperty: number | null;
  payAtPropertyLines: { description: string; amount: number }[];
  pointsEarned: number;
  /** How far under the public price this sits, in `currency`. Null when we cannot quote one. */
  savingVsPublic: number | null;
  publicPrice: number | null;
  maxPointsRedeemable: number;
  /**
   * What one point takes off `price`, in `currency`: USD 0.01 at the backend's
   * FX, 0 when it holds no rate (and then `maxPointsRedeemable` is 0 too).
   * Absent on a backend that predates it.
   */
  pointValue?: number;
  promotion: { label: string; multiplier: number; coveredShare: number } | null;
}

/* ── Search ───────────────────────────────────────────────────────── */

export interface SearchQuery {
  placeId?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  /** Free text, when the person typed rather than picked. */
  query?: string;
  /** Echoed from a previous answer. Paging must never re-resolve the place. */
  resolutionToken?: string;
  checkin: string;
  checkout: string;
  adults?: number;
  children?: number[];
  currency?: string;
  guestNationality?: string;
  limit?: number;
  offset?: number;
  starRating?: number[];
  minRating?: number;
}

export interface StayResult {
  hotelId: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  address: string | null;
  photo: Image | null;
  photoLarge: Image | null;
  stars: number | null;
  guestRating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  rate: Rate;
}

export interface SearchAnswer {
  stays: StayResult[];
  nights: number;
  currency: string;
  plan: Plan;
  hasMore: boolean;
  nextOffset: number | null;
  /**
   * Which rung of the ladder answered.
   *
   * `scope` is "exact" when the place asked for is the place searched, and
   * "country" or "alternate" when the resolver had to widen to find anything.
   * A search that widens says so — see the standing rule: a search may widen,
   * never in silence. `label` is what to say it widened to.
   */
  resolution: { scope: "exact" | "country" | "alternate"; label: string | null; token: string };
}

export function searchStays(q: SearchQuery, signal?: AbortSignal): Promise<SearchAnswer> {
  return read<SearchAnswer>("travel/search", { json: q, signal });
}

/* ── The shelf ────────────────────────────────────────────────────── */

export interface FeaturedCard {
  hotelId: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  /** What to send to `searchStays` when this tile is opened. */
  search: { cityName: string; countryCode: string };
  /** The one tile derived from where the person appears to be. */
  near: boolean;
  photo: Image | null;
  stars: number | null;
  guestRating: number | null;
  currency: string;
  price: number;
  pointsEarned: number;
  savingVsPublic: number | null;
  nights: number;
  checkin: string;
  checkout: string;
}

export interface FeaturedAnswer {
  stays: FeaturedCard[];
  checkin: string;
  checkout: string;
  nights: number;
  plan: Plan;
}

export function getFeatured(
  args: { set?: "near" | "longhaul"; currency?: string; nearCity?: string; nearCountry?: string } = {},
  signal?: AbortSignal,
): Promise<FeaturedAnswer> {
  const q = new URLSearchParams();
  if (args.set) q.set("set", args.set);
  if (args.currency) q.set("currency", args.currency);
  if (args.nearCity) q.set("nearCity", args.nearCity);
  if (args.nearCountry) q.set("nearCountry", args.nearCountry);
  const s = q.toString();
  return read<FeaturedAnswer>(`travel/featured${s ? `?${s}` : ""}`, { signal });
}

/* ── One stay ─────────────────────────────────────────────────────── */

export interface GalleryImage extends Image {
  caption: string | null;
  /** The server's own read of the caption: "room", "pool", "food"… or null. */
  category: string | null;
}

export interface RoomInfo {
  id: string;
  name: string;
  description: string | null;
  /** Nearly always "sqm", but the unit is the supplier's to state. */
  sizeSquare: number | null;
  sizeUnit: string | null;
  maxOccupancy: number | null;
  beds: { quantity: number; type: string; size: string | null }[];
  amenities: string[];
  photos: GalleryImage[];
}

export interface StayDetail {
  hotelId: string;
  name: string;
  description: string | null;
  gallery: GalleryImage[];
  photoCount: number;
  rooms: RoomInfo[];
  address: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  stars: number | null;
  guestRating: number | null;
  reviewCount: number | null;
  chain: string | null;
  hotelType: string | null;
  checkinTime: string | null;
  checkinUntil: string | null;
  checkoutTime: string | null;
  facilities: string[];
  importantInfo: string | null;
  childAllowed: boolean | null;
  petsAllowed: boolean | null;
  nearby: { name: string; category: string | null; distanceKm: number | null; iconic: boolean }[];
  reviewSummary: {
    pros: string[];
    cons: string[];
    categories: { name: string; rating: number; note: string | null }[];
    updatedAt: string | null;
  } | null;
}

export function getStay(hotelId: string, signal?: AbortSignal): Promise<StayDetail> {
  return read<StayDetail>(`travel/stays/${encodeURIComponent(hotelId)}`, { signal });
}

export interface RatesQuery {
  checkin: string;
  checkout: string;
  adults?: number;
  children?: number[];
  currency?: string;
  guestNationality?: string;
  radius?: number;
  query?: string;
  resolutionToken?: string;
  starRating?: number[];
  minRating?: number;
}

/**
 * What can actually be bought, tonight's answer.
 *
 * Asked apart from the stay because it is the perishable half: the description
 * and the photographs keep, an `offerId` does not.
 */
export function getRates(
  hotelId: string,
  q: RatesQuery,
  signal?: AbortSignal,
): Promise<{ hotelId: string; rates: Rate[]; plan: Plan }> {
  return read(`travel/stays/${encodeURIComponent(hotelId)}/rates`, { json: q, signal });
}

export interface Review {
  /** The row's place in the supplier's ordering, not an index into this array. */
  seq: number;
  /** Stable identity, minted server-side. */
  key: string;
  /** 0–10, the same scale as the property's own rating. */
  score: number | null;
  headline: string | null;
  name: string | null;
  date: string | null;
  country: string | null;
  /** liteAPI's bucket: `couple`, `solo_traveller`, `family_with_children`. */
  travellerType: string | null;
  pros: string | null;
  cons: string | null;
  /** ISO 639-1 of what the guest WROTE in. */
  language: string | null;
  source: string | null;
}

/**
 * Reviews, a page at a time.
 *
 * `nextOffset` is the server's and not `reviews.length`: rows with a score and
 * no words are dropped server-side, so counting what arrived would skip the
 * ones behind them.
 */
export function getReviews(
  hotelId: string,
  args: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<{ reviews: Review[]; hasMore: boolean; nextOffset: number }> {
  const q = new URLSearchParams();
  if (args.limit) q.set("limit", String(args.limit));
  if (args.offset) q.set("offset", String(args.offset));
  const s = q.toString();
  return read(`travel/stays/${encodeURIComponent(hotelId)}/reviews${s ? `?${s}` : ""}`, { signal });
}

/* ── Holding a room ───────────────────────────────────────────────── */

export interface Guest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface PrebookQuery {
  offerId: string;
  hotelId: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  guest: Guest;
  /** Clamped server-side to the balance that actually exists. */
  pointsRequested: number;
  specialRequest?: string;
}

export interface PrebookAnswer {
  bookingId: string;
  currency: string;
  /** Re-priced from the supplier's confirmation, not from the search result. */
  price: number;
  pointsApplied: number;
  /** What those points took off, in `currency`. Absent on an older backend. */
  pointsDiscountValue?: number;
  pointsEarned: number;
  savingVsPublic: number | null;
  freeCancellationUntil: string | null;
  /** The rate moved between searching and holding. Say so before taking money. */
  priceChanged: boolean;
  /** So did the cancellation policy. */
  cancellationChanged: boolean;
}

export function prebook(q: PrebookQuery, signal?: AbortSignal): Promise<PrebookAnswer> {
  return read<PrebookAnswer>("travel/prebook", { json: q, signal });
}

/* ── Paying ───────────────────────────────────────────────────────── */

export interface IntentLeg {
  kind: "same_chain" | "bridge" | "unwind";
  chain: string;
  txHash: string;
  amount: number;
  creditedBase?: string;
}

export interface SettlementIntent {
  id: string;
  status: "awaiting_funds" | "funded" | "expired" | "failed";
  product: "esim" | "stay" | "topup";
  reference: string;
  /** Exactly what must be sent, human-readable USDC — the dust nonce included. */
  amount: string;
  received: string;
  target: { chain: string; token: string; tokenAddress: string; decimals: number; address: string };
  legs: IntentLeg[];
  expiresAt: number;
  fundedAt: number | null;
  liquidityNotice?: string;
}

export interface BookingPayable {
  /** What the guest sees, in the booking's own currency. */
  amount: number;
  currency: string;
  /** What must actually be sent, rounded UP to the cent. */
  amountUsdc: number;
  /** Units of `currency` per 1 USD, so the screen can show its own arithmetic. */
  rate: number;
  rateAsOf: string;
}

export type PayAnswer =
  | { alreadyBooked: true; booking: Booking }
  | { alreadyBooked?: false; intent: SettlementIntent; payable: BookingPayable };

/**
 * Open the payment. Split from the prebook on the server because only one of
 * the two is retryable: a prebook failure means the room is gone, a pay
 * failure means we could not price it in USDC this second and the same locked
 * rate is still good.
 *
 * `sourceAddresses` are the person's own addresses on the settlement chain, so
 * an arriving transfer attributes by sender instead of by the dust nonce. They
 * are a help, not a requirement.
 */
export function openPayment(
  bookingId: string,
  sourceAddresses: readonly string[] = [],
  signal?: AbortSignal,
): Promise<PayAnswer> {
  return read<PayAnswer>(`travel/bookings/${encodeURIComponent(bookingId)}/pay`, {
    json: { sourceAddresses: [...sourceAddresses] },
    signal,
  });
}

/**
 * Has it landed.
 *
 * Reading the intent is what runs the arrival scan, so this is not a passive
 * status check — it is the thing that notices the money.
 */
export function readPayment(bookingId: string, signal?: AbortSignal): Promise<{ intent: SettlementIntent }> {
  return read(`travel/bookings/${encodeURIComponent(bookingId)}/payment`, { signal });
}

/**
 * Tell the intent which transaction is on its way.
 *
 * Not proof of payment — the chain is that. This is what lets the arrival scan
 * know which sender to expect, and what makes a slow bridge readable as a
 * named step instead of a total that never fills.
 */
export function reportLeg(
  intentId: string,
  leg: { kind: IntentLeg["kind"]; chain: string; txHash: string; amount: number },
  signal?: AbortSignal,
): Promise<SettlementIntent> {
  return read<SettlementIntent>(`settlement/intent/${encodeURIComponent(intentId)}/leg`, { json: leg, signal });
}

/**
 * The money is in; buy the room.
 *
 * The gate is the CHAIN, not us: the server re-reads the intent on the way
 * through and refuses anything short of `funded`. Calling this early costs a
 * 409 and nothing else.
 */
export function bookIt(bookingId: string, signal?: AbortSignal): Promise<Booking> {
  return read<Booking>("travel/book", { json: { bookingId }, signal });
}

/* ── A booking ────────────────────────────────────────────────────── */

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "failed";

export interface Booking {
  id: string;
  /** The code to read down the phone, when there is one. */
  reference: string | null;
  /**
   * Which code it is. "hotel" is the property's own confirmation — the
   * strongest proof this product owns. "supplier" is our supplier's id, which
   * the hotel has never seen, so the screen keeps a neutral label for it.
   */
  referenceKind: "hotel" | "supplier" | null;
  status: BookingStatus;
  hotel: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    city: string | null;
    countryCode: string | null;
    photo: Image | null;
    photoLarge: Image | null;
    latitude: number | null;
    longitude: number | null;
  };
  room: string | null;
  board: string | null;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  guestName: string;
  /**
   * The same person in parts, so the next booking's form opens filled in.
   * Null on bookings made before the columns existed (2026-08-24).
   */
  guest: { firstName: string; lastName: string; email: string; phone: string | null } | null;
  specialRequest: string | null;
  currency: string;
  price: number;
  pointsRedeemed: number;
  /**
   * Three states and no fourth: `none` when the stay earns nothing, so the
   * screen says nothing rather than printing a zero; `credited` once the lot
   * exists; `pending` otherwise, with the day it is due.
   */
  points: {
    earned: number;
    state: "none" | "pending" | "credited";
    creditedAt: string | null;
    dueAt: string | null;
  };
  freeCancelUntil: string | null;
  cancelledAt: string | null;
  /** A cancel button may only exist when the flow exists end to end. */
  cancellable: boolean;
  createdAt: string;
  isSandbox: boolean;
}

/**
 * Every booking worth showing.
 *
 * The server hides a `pending` row that nobody has paid for — a hold that was
 * abandoned is not a trip. So a room just held does NOT appear here until its
 * money is seen, which is why the checkout keeps its own copy on screen while
 * it finishes (see `useStays`' provisional row).
 */
export function getBookings(signal?: AbortSignal): Promise<Booking[]> {
  return read<{ bookings?: Booking[] }>("travel/bookings", { signal }).then((r) => r.bookings ?? []);
}

export function getBooking(id: string, signal?: AbortSignal): Promise<Booking> {
  return read<Booking>(`travel/bookings/${encodeURIComponent(id)}`, { signal });
}

/**
 * What a cancellation answers.
 *
 * Note what it is NOT: the booking. The screen that cancelled has to re-read
 * the booking, the trips list and the HiPoints balance — the points reversal
 * is the one nothing else asks for (the app's `afterCancel.ts` names the same
 * three surfaces).
 *
 * `refund` is null when nothing comes back, and that is an answer, not a gap:
 * a stay cancelled after its free window can refund zero.
 */
export interface CancelAnswer {
  id: string;
  status: "cancelled";
  refund: { amountUsdc: number; currency: "USDC" } | null;
}

export function cancelBooking(id: string, signal?: AbortSignal): Promise<CancelAnswer> {
  return read(`travel/bookings/${encodeURIComponent(id)}/cancel`, { json: {}, signal });
}

/* ── HiPoints ─────────────────────────────────────────────────────── */

export interface HiPoints {
  balance: string;
  lifetimeEarned: string;
  lifetimeRedeemed: string;
  lifetimeExpired: string;
  usdValue: number;
  pointUsdValue: number;
  nextExpiry: { points: string; at: string } | null;
}

export function getPoints(signal?: AbortSignal): Promise<HiPoints> {
  return read<HiPoints>("hipoints/me", { signal });
}
