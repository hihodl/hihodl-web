/**
 * The organiser's calls on the web (organiser-sells-its-event-contract.md,
 * section 2 and round 2 item 6): claim a Luma event or calendar with a code,
 * verify it, list one's claims, and read how many packages a verified one sells.
 *
 * The claim routes sit behind `requireAuth` like the rest of the business
 * console, so they go through `read` (./hold-api): bearer token, envelope
 * unwrapped, refusals as `HoldApiError` with the server's code. A backend
 * without them answers 404 on `claims/mine`, which reads as null: the tab
 * then says the door is not open yet, never an error.
 */

"use client";

import useSWR from "swr";

import { AD_SPACE_API } from "@/lib/ad-space/config";
import type { EventSummary } from "@/lib/ad-space/types";
import { useCreatorSession } from "@/lib/creator/session";

import { HoldApiError, read } from "./hold-api";
import { claimStatusOf, type ClaimStatus } from "./organiser-rules";

export interface HostClaim {
  id: string;
  /** `HOLD-` and six characters, pasted anywhere in the Luma description. */
  code: string;
  status: ClaimStatus;
  expiresAt: string | null;
  /** The canonical lower-case Luma page. */
  lumaUrl: string;
  verifiedAt: string | null;
  /** The business OWNER's user id the claim was proved for; null for one's own. */
  actingForBusinessId: string | null;
}

export interface ClaimWithEvent {
  claim: HostClaim;
  /** The event (or calendar, `kind: "calendar"`) as a sponsor reads it; null when it is gone. */
  event: EventSummary | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The server's answer, read defensively: a row without an id or a code is dropped. */
export function parseClaim(raw: unknown): ClaimWithEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { claim?: Record<string, unknown>; event?: unknown };
  const c = o.claim;
  if (!c || !str(c.id) || !str(c.code)) return null;
  const event = o.event && typeof o.event === "object" && str((o.event as { id?: unknown }).id) ? (o.event as EventSummary) : null;
  return {
    claim: {
      id: str(c.id),
      code: str(c.code),
      status: claimStatusOf(c.status),
      expiresAt: str(c.expiresAt) || null,
      lumaUrl: str(c.lumaUrl),
      verifiedAt: str(c.verifiedAt) || null,
      actingForBusinessId: str(c.actingForBusinessId) || null,
    },
    event,
  };
}

function claimOrThrow(raw: unknown): ClaimWithEvent {
  const got = parseClaim(raw);
  if (!got) throw new HoldApiError("claim_unreadable", 0);
  return got;
}

/** The code for this page; the same one again while it is live. */
export async function startClaim(lumaUrl: string, actingForBusinessId?: string | null): Promise<ClaimWithEvent> {
  return claimOrThrow(
    await read<unknown>("ad-space/events/claims", {
      json: { lumaUrl, ...(actingForBusinessId ? { actingForBusinessId } : {}) },
    }),
  );
}

/** Reads the Luma page now. Ten an hour per person. */
export async function verifyClaim(claimId: string): Promise<ClaimWithEvent> {
  return claimOrThrow(await read<unknown>(`ad-space/events/claims/${encodeURIComponent(claimId)}/verify`, { json: {} }));
}

/** Newest first. Null when this server has no claims at all (404). */
export async function getMyClaims(): Promise<ClaimWithEvent[] | null> {
  try {
    const body = await read<{ claims?: unknown[] }>("ad-space/events/claims/mine");
    return (Array.isArray(body?.claims) ? body.claims : []).map(parseClaim).filter((c): c is ClaimWithEvent => !!c);
  } catch (e) {
    if (e instanceof HoldApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * How many packages a Luma key sells (`GET /public/events/by-luma/:key`), or
 * null when the server cannot say (404, an older server, a network blip): the
 * count is decoration, so a failure only hides it.
 */
export async function packageCountOf(lumaKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${AD_SPACE_API}/public/events/by-luma/${encodeURIComponent(lumaKey)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { packages?: unknown } } | null;
    const n = body?.data?.packages;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const OPTIONS = { revalidateOnFocus: true, focusThrottleInterval: 30_000, shouldRetryOnError: false, dedupingInterval: 10_000 };

/** The signed-in person's claims, cached per person. `data === null`: no claims on this server. */
export function useMyClaims() {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<ClaimWithEvent[] | null>(uid ? ["organiser", uid, "claims"] : null, getMyClaims, OPTIONS);
}

/** The package count for a verified row, read once per key. */
export function usePackageCount(lumaKey: string | null) {
  return useSWR<number | null>(lumaKey ? ["organiser", "packages", lumaKey] : null, () => packageCountOf(lumaKey!), {
    ...OPTIONS,
    revalidateOnFocus: false,
  });
}
