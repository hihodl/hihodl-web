/**
 * What the Stays screens read, cached across screens — the app's `useTravel.ts`
 * and `tripsStore.ts`, on the web.
 *
 * Every read is one of the travel router's own calls. SWR holds the answers so
 * moving from the shelf to a property to the checkout does not ask the same
 * question three times, and keys carry the signed-in person so a different
 * account in the same tab never reads the last one's trips.
 *
 * TWO THINGS HERE ARE NOT PLAIN CACHING
 *
 * `useSearch` pages: a second page is appended to the first, deduped by hotel
 * id and re-sorted by price, and it echoes the `resolutionToken` from page one
 * so paging can never re-resolve the destination. Page 1 of Zanzibar can
 * legitimately run out at offset 20, and a resolver free to widen there would
 * quietly append the whole of Tanzania to a list being read as Zanzibar.
 *
 * `useTrips` keeps a PROVISIONAL row. The server does not list a booking that
 * nobody has paid for, which is right — an abandoned hold is not a trip — but
 * it means the ten to thirty seconds between paying and the booking appearing
 * would otherwise show the person an empty list right after they paid. So the
 * checkout puts a client-built row in, and the server's copy replaces it the
 * moment it arrives. The server always wins.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import {
  getBookings,
  getBooking,
  getFeatured,
  getPoints,
  getRates,
  getStay,
  getStaysConfig,
  searchPlaces,
  searchStays,
  type Booking,
  type FeaturedAnswer,
  type HiPoints,
  type Place,
  type Rate,
  type SearchAnswer,
  type SearchQuery,
  type StayDetail,
  type StayResult,
  type StaysConfig,
} from "./stays";
import { staysCurrency } from "./display-currency";
import { t } from "./i18n";

/**
 * A stay's photographs and description keep; its prices do not.
 *
 * `dedupingInterval` is 90 s on everything priced, which is deliberately the
 * same window the server caches a search for — asking again inside it can only
 * return what we already have.
 */
const OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 60_000,
  shouldRetryOnError: false,
  dedupingInterval: 90_000,
};

/** How many results a page asks for. Over about 60 the supplier answers empty. */
export const PAGE_SIZE = 40;

function useWho(): string | null {
  const { session } = useCreatorSession();
  return session?.user?.id ?? null;
}

/* ── Config, points, the shelf ────────────────────────────────────── */

export function useStaysConfig() {
  const who = useWho();
  return useSWR<StaysConfig>(who ? [who, "stays/config"] : null, () => getStaysConfig(), {
    ...OPTIONS,
    dedupingInterval: 5 * 60_000,
  });
}

export function usePoints() {
  const who = useWho();
  return useSWR<HiPoints>(who ? [who, "hipoints"] : null, () => getPoints(), OPTIONS);
}

export function useFeatured(set: "near" | "longhaul", currency = staysCurrency()) {
  const who = useWho();
  return useSWR<FeaturedAnswer>(
    who ? [who, "stays/featured", set, currency] : null,
    () => getFeatured({ set, currency }),
    { ...OPTIONS, dedupingInterval: 5 * 60_000 },
  );
}

/* ── Where ────────────────────────────────────────────────────────── */

/**
 * Destination autocomplete, debounced.
 *
 * 250 ms and a two-character floor, both the app's. The floor is the server's
 * too: under two characters it answers an empty list without asking the
 * supplier, and there is no point paying for the round trip to hear it.
 */
export function usePlaceSearch(query: string): { places: Place[]; loading: boolean } {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const ready = debounced.trim().length >= 2;
  const { data, isLoading } = useSWR<Place[]>(
    ready ? ["stays/places", debounced.trim()] : null,
    () => searchPlaces(debounced),
    { ...OPTIONS, dedupingInterval: 60_000 },
  );
  // Typing again is loading, even while the old answer is still on screen:
  // otherwise the list looks settled on a query the person has moved past.
  return { places: data ?? [], loading: ready && (isLoading || debounced !== query) };
}

/* ── Results ──────────────────────────────────────────────────────── */

export interface SearchState {
  stays: StayResult[];
  nights: number;
  currency: string;
  resolution: SearchAnswer["resolution"] | null;
  loading: boolean;
  /** A page is on its way. The list below stays readable while it lands. */
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /** Identifies THIS search, for whoever wants to remember something about it. */
  pageKey: string | null;
}

/**
 * The pages after the first, kept outside React.
 *
 * They used to be component state, and that is why opening a hotel and
 * pressing Back gave you page one again: `ResultsScreen` unmounts on the way
 * out and takes them with it, while SWR only ever cached the first page. Six
 * "Show more" presses, gone, on the one journey where going back and forth is
 * the whole point of the screen.
 *
 * So they live here, keyed by the search they belong to. Four searches is
 * plenty — it covers going back, changing your mind, and going back again —
 * and the oldest is dropped rather than letting a long session keep every
 * hotel it ever listed.
 */
const pages = new Map<string, { extra: StayResult[]; offset: number | null }>();
const PAGES_KEPT = 4;

function remember(stamp: string, extra: StayResult[], offset: number | null): void {
  pages.delete(stamp);
  pages.set(stamp, { extra, offset });
  while (pages.size > PAGES_KEPT) pages.delete(pages.keys().next().value as string);
}

/**
 * A search, and every page after the first.
 *
 * The first page is SWR's (so coming back to the tab re-reads it); the pages
 * after it are appended locally, because there is no honest way to key a
 * growing list and re-validating page three in place would reorder the list
 * under the reader.
 */
export function useSearch(query: SearchQuery | null): SearchState {
  const who = useWho();
  const key = query ? [who, "stays/search", JSON.stringify(query)] : null;
  const stamp = key ? JSON.stringify(key) : null;

  const first = useSWR<SearchAnswer>(query && who ? key : null, () => searchStays({ ...query!, limit: PAGE_SIZE, offset: 0 }), {
    ...OPTIONS,
    keepPreviousData: false,
  });

  // Mounted straight from the store, not from empty: a remount that started
  // blank would paint page one, then jump as the rest arrived.
  const held = stamp ? pages.get(stamp) : undefined;
  const [extra, setExtra] = useState<StayResult[]>(held?.extra ?? []);
  const [offset, setOffset] = useState<number | null>(held?.offset ?? null);
  const [more, setMore] = useState(false);
  // Which search the appended pages belong to. A changed query throws them
  // away — appending Lisbon's page two onto Madrid's page one is the bug this
  // guards, and it is invisible until somebody books the wrong city.
  const belongsTo = useRef<string | null>(stamp);

  useEffect(() => {
    if (belongsTo.current === stamp) return;
    belongsTo.current = stamp;
    const kept = stamp ? pages.get(stamp) : undefined;
    setExtra(kept?.extra ?? []);
    setOffset(kept?.offset ?? null);
    setMore(false);
  }, [stamp]);

  const loadMore = useCallback(() => {
    if (!query || more || !stamp) return;
    const next = offset ?? first.data?.nextOffset ?? null;
    const token = first.data?.resolution?.token;
    if (next === null) return;
    const mine = stamp;
    setMore(true);
    searchStays({ ...query, limit: PAGE_SIZE, offset: next, ...(token ? { resolutionToken: token } : {}) })
      .then((page) => {
        // The person searched something else while this was in the air.
        if (belongsTo.current !== mine) return;
        // The store is what is true; the state is the copy React draws from.
        const grown = [...(pages.get(mine)?.extra ?? []), ...page.stays];
        remember(mine, grown, page.nextOffset);
        setExtra(grown);
        setOffset(page.nextOffset);
      })
      // A page that fails stops the paging rather than retrying forever: the
      // list already on screen is still good, and an endless spinner at the
      // foot of it is worse than a list that ends.
      .catch(() => setOffset(null))
      .finally(() => setMore(false));
  }, [query, offset, first.data, more, stamp]);

  const stays = useMemo(() => {
    const all = [...(first.data?.stays ?? []), ...extra];
    const seen = new Set<string>();
    const unique = all.filter((s) => (seen.has(s.hotelId) ? false : (seen.add(s.hotelId), true)));
    return unique.sort((a, b) => a.rate.price - b.rate.price);
  }, [first.data, extra]);

  const nextOffset = offset ?? first.data?.nextOffset ?? null;

  return {
    stays,
    nights: first.data?.nights ?? 1,
    currency: first.data?.currency ?? query?.currency ?? "EUR",
    resolution: first.data?.resolution ?? null,
    loading: Boolean(query) && first.isLoading,
    loadingMore: more,
    error: first.error,
    hasMore: nextOffset !== null && Boolean(first.data?.hasMore || extra.length),
    loadMore,
    pageKey: stamp,
  };
}

/* ── One property ─────────────────────────────────────────────────── */

/**
 * The property, and what can be bought in it — asked apart, painted apart.
 *
 * The description and the photographs keep for hours; an `offerId` is good for
 * minutes. Waiting for both before drawing either would hold a finished page
 * behind the slower half of it.
 */
export function useStay(hotelId: string | null) {
  const who = useWho();
  return useSWR<StayDetail>(hotelId && who ? [who, "stays/stay", hotelId] : null, () => getStay(hotelId!), {
    ...OPTIONS,
    dedupingInterval: 10 * 60_000,
  });
}

export interface RatesQuery {
  checkin: string;
  checkout: string;
  adults: number;
  children?: number[];
  currency: string;
}

/**
 * A property's rates.
 *
 * `frozen` IS NOT AN OPTIMISATION, IT IS THE CHECKOUT'S CORRECTNESS
 *
 * Every call to the supplier mints a FRESH set of `offerId`s. On the property
 * page that is fine — the rows re-render with whatever came back. On the
 * checkout it is fatal: that screen is holding one `offerId` pinned in the
 * URL, and a revalidation replaces the list with offers that do not include
 * it. The screen then finds no rate and says "That rate has gone" over an
 * offer that had not gone anywhere.
 *
 * `revalidateOnFocus` made that a routine event rather than an edge case:
 * alt-tab to check a date, take a screenshot, glance at another window, and
 * the click that brings the tab back also fires the revalidation that throws
 * the person out of a checkout they were halfway through filling in.
 *
 * So the checkout asks once. The header's reasoning — an `offerId` lives for
 * minutes, so re-read it rather than carrying the price — is about the FIRST
 * read, and it still holds: the screen re-reads on arrival and says so
 * honestly if the offer is already gone. What it must not do is keep asking a
 * question whose answer destroys its own state.
 */
export function useRates(hotelId: string | null, q: RatesQuery | null, frozen = false) {
  const who = useWho();
  return useSWR<{ hotelId: string; rates: Rate[] }>(
    hotelId && q && who ? [who, "stays/rates", hotelId, JSON.stringify(q)] : null,
    () => getRates(hotelId!, q!),
    frozen
      ? { ...OPTIONS, revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false }
      : OPTIONS,
  );
}

/* ── Trips ────────────────────────────────────────────────────────── */

interface TripsSnapshot {
  server: Booking[];
  provisional: Record<string, Booking>;
  /** Null until the SERVER has answered once. Tells "empty" from "unread". */
  loadedAt: number | null;
  loading: boolean;
  error: string | null;
}

let trips: TripsSnapshot = { server: [], provisional: {}, loadedAt: null, loading: false, error: null };
let merged: Booking[] = [];
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
/** Whose trips are in the store. A different person empties it. */
let owner: string | null = null;

function remerge() {
  const ids = new Set(trips.server.map((b) => b.id));
  // Newest first, and a real row always beats the placeholder it replaces.
  merged = [...Object.values(trips.provisional).filter((b) => !ids.has(b.id)), ...trips.server];
}

function publish(next: Partial<TripsSnapshot>) {
  trips = { ...trips, ...next };
  remerge();
  for (const l of listeners) l();
}

/**
 * Read the list, once, however many screens ask.
 *
 * Never rejects: a failure lands in `error` and the list already on screen
 * stays. A background refresh that blanks a rendered list is worse than a
 * stale one.
 */
export function refreshTrips(): Promise<void> {
  if (inflight) return inflight;
  publish({ loading: true });
  inflight = getBookings()
    .then((bookings) => publish({ server: bookings, loadedAt: Date.now(), error: null }))
    .catch(() => publish({ error: t("trips.list.errorTitle") }))
    .finally(() => {
      inflight = null;
      publish({ loading: false });
    });
  return inflight;
}

/** A booking the server produced. Prepends or replaces, and drops its placeholder. */
export function upsertTrip(booking: Booking): void {
  const { [booking.id]: _gone, ...rest } = trips.provisional;
  publish({
    server: [booking, ...trips.server.filter((b) => b.id !== booking.id)],
    provisional: rest,
  });
}

/**
 * Hold a client-built row while the money lands.
 *
 * It claims as little as it can — no reference, no coordinates, no points, and
 * `cancellable: false`, because no cancel flow exists for a booking the server
 * has never confirmed.
 */
export function holdTripProvisionally(booking: Booking): void {
  publish({ provisional: { ...trips.provisional, [booking.id]: booking } });
}

/** Only ever called when payment was refused with nothing sent. */
export function releaseProvisionalTrip(id: string): void {
  const { [id]: _gone, ...rest } = trips.provisional;
  publish({ provisional: rest });
}

export function clearTrips(): void {
  owner = null;
  publish({ server: [], provisional: {}, loadedAt: null, error: null });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const EMPTY: Booking[] = [];

export interface TripsView {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTrips(): TripsView {
  const who = useWho();
  const bookings = useSyncExternalStore(
    subscribe,
    () => merged,
    () => EMPTY,
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => trips,
    () => trips,
  );

  useEffect(() => {
    if (!who) return;
    if (owner !== who) {
      owner = who;
      publish({ server: [], provisional: {}, loadedAt: null, error: null });
    }
    if (trips.loadedAt === null && !inflight) void refreshTrips();
  }, [who]);

  return {
    bookings,
    // Content on screen wins outright; a failure beats the spinner, or a failed
    // first read spins forever and the retry is never offered; and `loadedAt`
    // being null covers the frame between mounting and the read starting —
    // without it the empty state flashes at somebody who has trips.
    loading: bookings.length === 0 && !snap.error && (snap.loading || snap.loadedAt === null),
    error: bookings.length > 0 ? null : snap.error,
    refetch: refreshTrips,
  };
}

/** One booking, read fresh. The list's copy is a summary; this is the record. */
export function useBooking(id: string | null) {
  const who = useWho();
  return useSWR<Booking>(id && who ? [who, "stays/booking", id] : null, () => getBooking(id!), {
    ...OPTIONS,
    dedupingInterval: 5_000,
  });
}
