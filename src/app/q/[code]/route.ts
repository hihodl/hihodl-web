// hihodl.xyz/q/<code> — the short link printed on a sponsored spot.
//
// Somebody points a phone camera at a creator's leg at a conference. What
// happens next is one HTTP hop: this handler asks the backend where the code
// goes, redirects there, and the backend counts the scan on the way past.
//
// ── Why a Route Handler and not a page ──
// A page would ship HTML and JavaScript to do a client-side redirect: a flash
// of blank screen on a phone with one bar of signal, and a scan that never
// arrives if the JS does not run. A 307 is the whole response.
//
// ── Why it never dead-ends ──
// A code exists from the moment the spot is sold, but it resolves only once
// the creator has approved the sponsor's content — we are not serving a
// stranger's link from our domain before the person wearing it has seen it.
// So between the sale and the approval, and on any backend trouble at all, the
// scan lands on the creator's own page instead of an error. The person
// scanning did nothing wrong and is standing in a room somewhere.

import { NextResponse } from "next/server";

import { AD_SPACE_API, HANDLE_RE, SITE_URL, SLUG_RE } from "@/lib/ad-space/config";
import { upstreamHeaders } from "@/lib/ad-space/server";

/** Always fresh: a destination corrected after a rejection must take effect now. */
export const dynamic = "force-dynamic";

/** Crockford's alphabet, as minted by the backend. */
const CODE_RE = /^[0-9A-HJ-NP-TV-Z]{4,16}$/;

/**
 * A space's own page, as the backend names it: `/s/<handle>/<slug>`, or
 * `/s/id/<spaceId>` for a creator with no handle on record. Anything else is
 * not a path this handler sends a person to.
 */
function spacePathOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\/s\/([^/?#]+)\/([^/?#]+)$/.exec(value);
  if (!m) return null;
  const [, handle, slug] = m;
  const byId = handle === "id" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  return byId || (HANDLE_RE.test(handle) && SLUG_RE.test(slug)) ? value : null;
}

/** Long enough for a cold backend, short enough that nobody walks away. */
const TIMEOUT_MS = 4000;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = String(code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(clean)) return NextResponse.redirect(SITE_URL, 307);

  try {
    const res = await fetch(`${AD_SPACE_API}/public/q/${encodeURIComponent(clean)}`, {
      cache: "no-store",
      // Passed through so the backend can tell a preview card fetcher from a
      // person with a camera. It counts one of those and not the other.
      headers: upstreamHeaders(request.headers, { "user-agent": request.headers.get("user-agent") ?? "" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.redirect(SITE_URL, 307);

    const body = (await res.json()) as { data?: { url?: string | null; spaceId?: string; spacePath?: string } };
    const url = body?.data?.url;

    // A known code whose sponsor content is not approved yet: no destination
    // of its own, so the scan lands on the creator's page, which is where the
    // person scanning was looking anyway.
    if (url === null || url === undefined) {
      const path = spacePathOrNull(body?.data?.spacePath);
      return NextResponse.redirect(path ? `${SITE_URL}${path}` : SITE_URL, 307);
    }

    // https only, checked again here: this handler is what actually moves a
    // person, and it does not move them anywhere the backend did not name.
    if (typeof url !== "string" || !url.startsWith("https://")) return NextResponse.redirect(SITE_URL, 307);

    // 307 and not 301: the destination is a database row that can change, and
    // a permanent redirect would be cached in a phone for as long as it liked.
    return NextResponse.redirect(url, 307);
  } catch {
    return NextResponse.redirect(SITE_URL, 307);
  }
}
