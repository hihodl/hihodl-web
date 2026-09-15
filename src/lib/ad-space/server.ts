// Server-only by construction: no "use client" file imports this module.
import { AD_SPACE_API, HANDLE_RE, SLUG_RE } from "./config";
import type { Space } from "./types";

/**
 * Reading a public Ad Space on the server.
 *
 * `found` and `missing` are answers; `unreachable` is not. A page that turns
 * "the API timed out" into a 404 tells a sponsor holding a shared link that the
 * space is gone, which is the one thing it must never say about a live board.
 */
export type SpaceLookup =
  | { kind: "found"; space: Space }
  | { kind: "missing" }
  | { kind: "unreachable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The backend's share link is `/s/<handle>/<slug>`, or `/s/id/<spaceId>` for a
 * space whose creator has no handle on record. Both land on this route.
 */
function upstreamPath(handle: string, slug: string): string | null {
  if (handle === "id" && UUID_RE.test(slug)) return `/public/spaces/${slug}`;
  if (!HANDLE_RE.test(handle) || !SLUG_RE.test(slug)) return null;
  return `/public/spaces/by-path/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`;
}

/**
 * Local rendering without a backend. Opt-in, development only, and never a
 * fallback: `AD_SPACE_FIXTURE=1 npm run dev`. A production build ignores the
 * flag entirely, so a missing API can never serve made-up spots to a sponsor.
 */
function fixtureEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AD_SPACE_FIXTURE === "1";
}

/**
 * @param revalidate seconds. The API sends `max-age=10`; the page matches it
 *   so a sold spot shows as sold within seconds of the chain saying so.
 */
export async function getPublicSpace(
  handle: string,
  slug: string,
  revalidate = 10,
): Promise<SpaceLookup> {
  if (fixtureEnabled()) {
    const { fixtureSpace } = await import("./fixture.dev");
    const space = fixtureSpace(handle, slug);
    return space ? { kind: "found", space } : { kind: "missing" };
  }

  const path = upstreamPath(handle, slug);
  if (!path) return { kind: "missing" };

  try {
    const res = await fetch(`${AD_SPACE_API}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "unreachable" };
    const body = (await res.json()) as { data?: { space?: Space } };
    const space = body?.data?.space;
    return space ? { kind: "found", space } : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}
