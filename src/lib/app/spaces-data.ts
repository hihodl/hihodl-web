/**
 * What the Spaces screens read, cached across screens.
 *
 * Every read here is one of the console's existing calls (lib/creator/*): no
 * new route, no new shape. SWR holds the answers so moving from Overview to
 * Offers to a listing does not ask the same question three times.
 *
 * Keys carry the signed-in user, so a different person in the same tab (the
 * demo's role switch, a sign-out and back in) never reads the last one's data.
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig, type SWRConfiguration } from "swr";

import { getPayoutAddress, getXAccount } from "@/lib/creator/api";
import type { OfferView, SpaceView } from "@/lib/creator/listing";
import {
  getListing,
  getSales,
  getTemplates,
  listingOffers,
  mySeats,
  myListings,
  receivedOffers,
  teamEarnings,
  teamOwed,
  teamWork,
  getTeam,
  getCreatorSettings,
} from "@/lib/creator/listings";
import { useCreatorSession } from "@/lib/creator/session";
import { getInsights } from "@/lib/creator/insights";
import { getWalletStatus } from "@/lib/wallet/api";

import { getMe, getMyAddresses } from "./me";

/* ── When the numbers were read ───────────────────────────────────── */

let lastRead: number | null = null;
const listeners = new Set<() => void>();

function stamp() {
  lastRead = Date.now();
  for (const l of listeners) l();
}

export function useLastRead(): number | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => lastRead,
    () => null,
  );
}

/**
 * Coming back to the tab reads again (at most every 30 s), and so does every
 * screen that mounts a read: there is no refresh control for a person to find.
 */
const OPTIONS: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 30_000,
  shouldRetryOnError: false,
  dedupingInterval: 10_000,
};

function useUserId(): string | null {
  const { session } = useCreatorSession();
  return session?.user?.id ?? null;
}

function useRead<T>(name: string | null, fetcher: () => Promise<T>, extra = "") {
  const uid = useUserId();
  return useSWR<T>(
    uid && name ? ["spaces", uid, name, extra] : null,
    async () => {
      const out = await fetcher();
      stamp();
      return out;
    },
    OPTIONS,
  );
}

/** Re-read everything the screens have asked for. */
export function useRefreshAll(): () => Promise<unknown> {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate((key) => Array.isArray(key) && key[0] === "spaces"), [mutate]);
}

/** Re-read the named reads only (after an answer, a delivery, an invitation). */
export function useRefresh(): (...names: string[]) => Promise<unknown> {
  const { mutate } = useSWRConfig();
  return useCallback(
    (...names: string[]) =>
      mutate((key) => Array.isArray(key) && key[0] === "spaces" && (names.length === 0 || names.includes(key[2] as string))),
    [mutate],
  );
}

/* ── The reads ────────────────────────────────────────────────────── */

export const useListings = () => useRead("listings", async () => (await myListings()).spaces);
export const useOffers = (on = true) => useRead(on ? "offers" : null, async () => (await receivedOffers()).offers);
export const useSales = (on = true) => useRead(on ? "sales" : null, async () => (await getSales()).sales);
/** One listing's sales, all of them rather than the latest across every listing. */
export const useListingSales = (spaceId: string | null) =>
  useRead(spaceId ? "sales" : null, async () => (await getSales(spaceId!)).sales, spaceId ?? "");
export const useSeats = () => useRead("seats", async () => (await mySeats()).seats);
export const useWork = (on = true) => useRead(on ? "work" : null, async () => (await teamWork()).work);
export const useOwed = (on = true) => useRead(on ? "owed" : null, async () => (await teamOwed()).owed);
export const useEarnings = (on = true) => useRead(on ? "earnings" : null, async () => (await teamEarnings()).earnings);
export const useTeam = (on = true) => useRead(on ? "team" : null, async () => (await getTeam()).team);
export const useX = () => useRead("x", getXAccount);
export const useCreatorSettings = () => useRead("settings", async () => (await getCreatorSettings()).settings);
export const usePayout = (on = true) => useRead(on ? "payout" : null, getPayoutAddress);
export const useTemplates = (on = true) => useRead(on ? "templates" : null, getTemplates);
/** The person: profile, username, photo (GET /me). */
export const useMe = () => useRead("me", getMe);
/** The web wallet's state and registered address (GET /wallet-backup/status). */
export const useWalletStatus = (on = true) => useRead(on ? "wallet-status" : null, getWalletStatus);
/** The app wallet's addresses (GET /me/addresses). */
export const useMyAddresses = (on = true) => useRead(on ? "my-addresses" : null, getMyAddresses);

/** Market data for an event (a slug), all of Spaces (`all`), or the creator's nearest event (null). */
export const useInsights = (event: string | null) =>
  useRead("insights", async () => (await getInsights(event)).insights, event ?? "");

/** One listing, whole. */
export const useListing = (spaceId: string | null) =>
  useRead(spaceId ? "listing" : null, async () => (await getListing(spaceId!)).space, spaceId ?? "");

/**
 * Several listings, whole: what Deliveries and the Overview's "needs you" are
 * built from, because artwork waiting and promises due live on the listing and
 * not on its card. One call per listing, in parallel; a creator has a handful.
 */
export function useListingViews(ids: readonly string[] | null) {
  const key = ids ? [...ids].sort().join(",") : "";
  return useRead(
    ids ? "views" : null,
    async () => {
      const out = await Promise.all(ids!.map((id) => getListing(id).then((r) => r.space).catch(() => null)));
      return out.filter((s): s is SpaceView => s !== null);
    },
    key,
  );
}

/**
 * Offers on listings somebody sells FOR a creator. `offers/received` is the
 * owner's inbox only, so a manager's inbox is read listing by listing.
 */
export function useManagedOffers(ids: readonly string[] | null) {
  const key = ids ? [...ids].sort().join(",") : "";
  return useRead(
    ids && ids.length ? "managed-offers" : null,
    async () => {
      const lists = await Promise.all(ids!.map((id) => listingOffers(id).then((r) => r.offers).catch(() => [] as OfferView[])));
      return lists.flat();
    },
    key,
  );
}
