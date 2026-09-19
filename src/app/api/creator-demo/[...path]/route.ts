/**
 * /api/creator-demo/* — the in-memory backend of the creator console's local
 * DEMO MODE (see src/lib/creator/demo.ts and documentation/creator-console-demo.md).
 *
 * 404 unless `NEXT_PUBLIC_CREATOR_DEMO=1` and NODE_ENV is not production, so
 * a production build serves nothing here whatever its environment says. The
 * store is loaded with a dynamic import behind that gate, so it is never
 * evaluated on a deploy with the flag off.
 *
 * Answers exactly as the real API does: `{ data }` on success and
 * `{ error: { code, details } }` on a refusal, with the real status codes.
 */

import { NextResponse, type NextRequest } from "next/server";

import { creatorDemoEnabled } from "@/lib/creator/demo";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest, { params }: { params: { path?: string[] } }) {
  if (!creatorDemoEnabled()) return new NextResponse("Not found", { status: 404 });

  const { handleDemo } = await import("@/lib/creator/demo-store.dev");
  let body: Record<string, unknown> | null = null;
  if (req.method !== "GET" && req.method !== "DELETE") {
    body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  }
  const url = new URL(req.url);
  const out = handleDemo({
    method: req.method,
    path: (params.path ?? []).join("/"),
    query: url.searchParams,
    body,
    authorization: req.headers.get("authorization"),
    origin: url.origin,
  });
  // A short, honest delay: the console's "Reading…" and "Saving…" states are
  // part of what is being reviewed, and a mock that answers in 1 ms hides them.
  await new Promise((r) => setTimeout(r, 120));
  return NextResponse.json(out.error ? { error: out.error } : { data: out.data }, {
    status: out.status,
    headers: { "cache-control": "no-store" },
  });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
