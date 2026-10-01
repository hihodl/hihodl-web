import { NextResponse } from "next/server";

import { getOwnerSpace } from "@/lib/ad-space/server";

/**
 * The creator's own read of a space, drafts included, for the preview inside
 * the HOLD app (../page.tsx, `PreviewCanvas`).
 *
 * The app's WebView has no web session: the app injects its Supabase access
 * token as `window.__HOLD_ACCESS_TOKEN__`, the page sends it here as the
 * bearer, and this passes it to the backend's owner route and normalises the
 * answer with the same reader the public page uses. The token is never
 * stored, cached or logged, and this answer is never cached either.
 *
 *   200 { space }   the caller is the creator
 *   401             no token, or the backend refused it (expired)
 *   403             a valid token, but not this space's creator
 *   502             the backend could not be read
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" };

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([A-Za-z0-9_.-]{1,8192})$/.exec(auth)?.[1] ?? null;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const found = await getOwnerSpace(params.id, token, request.headers);
  switch (found.kind) {
    case "owner":
      return NextResponse.json({ space: found.space }, { headers: NO_STORE });
    case "auth":
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
    case "notOwner":
      return NextResponse.json({ error: "not_owner" }, { status: 403, headers: NO_STORE });
    default:
      return NextResponse.json({ error: "unreachable" }, { status: 502, headers: NO_STORE });
  }
}
