/**
 * The creator console's one door to the backend.
 *
 * WHY A PROXY AND NOT A DIRECT CALL
 *
 * The public HiSpace page does talk to `api.hihodl.xyz` straight from the
 * browser, and for good reason: the backend rate-limits a public checkout per
 * visitor IP, and a proxy would put every sponsor behind one Vercel address.
 * None of that applies here, and one thing rules it out.
 *
 * CORS on the backend is mounted on the PUBLIC routers only
 * (`server/middleware/hold-web-public.ts`, used by `ad-space-public.router.ts`
 * and `pay-links-public.router.ts`). It allows `Content-Type` and
 * `X-Checkout-Key` — not `Authorization`. `/ad-space/payout-address` and
 * `/x-account` sit behind `requireAuth` on routers with no CORS at all, so a
 * browser at hihodl.xyz calling them with a Bearer token gets a failed
 * preflight and no answer. This route makes those calls server to server,
 * where CORS does not apply, and the console works against the backend exactly
 * as it is deployed today.
 *
 * It costs nothing on limits: `advancedRateLimit` keys an authenticated
 * request by `user.id` (rate-limit-advanced.ts), not by the caller's address,
 * so every creator still gets their own bucket through one Vercel IP.
 *
 * WHAT IT WILL AND WILL NOT FORWARD
 *
 * Only the five calls this console makes, by method and by exact path. This is
 * a route that carries somebody's session token to another host: an open path
 * would let any page on the internet aim that token wherever it liked. The
 * allow-list is the whole security model here, so it is a literal, not a
 * prefix test.
 *
 * The upstream body and status are passed through untouched, because clients
 * switch on `error.code` and never on the message (see the contract).
 */

import { NextResponse } from "next/server";

const API_BASE = (
  process.env.HIHODL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_HIHODL_API_URL ??
  "https://api.hihodl.xyz/api/v1"
).replace(/\/+$/, "");

type Method = "GET" | "POST";

/** Exactly what the console calls. Anything else is a 404 from us. */
const ALLOWED: Record<string, readonly Method[]> = {
  "ad-space/payout-address": ["GET", "POST"],
  "ad-space/payout-address/challenge": ["POST"],
  "x-account": ["GET"],
  "x-account/link": ["POST"],
  "x-account/complete": ["POST"],
};

/** Bodies here are a nonce, a signature, an address or a ticket: small by nature. */
const MAX_BODY_BYTES = 4096;

function refuse(code: string, status: number) {
  return NextResponse.json({ error: { code, message: code } }, { status, headers: { "cache-control": "no-store" } });
}

async function forward(request: Request, path: string[], method: Method) {
  const route = path.join("/");
  if (!ALLOWED[route]?.includes(method)) return refuse("not_found", 404);

  // The session token is the creator's, held by the browser and sent here for
  // this one hop. We never read it, store it or log it.
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return refuse("UNAUTHORIZED", 401);

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body.length > MAX_BODY_BYTES) return refuse("payload_too_large", 413);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/${route}`, {
      method,
      headers: {
        accept: "application/json",
        authorization,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });
  } catch {
    // Distinct from anything the backend says: "we could not reach it" is not
    // "it refused", and a creator told the wrong one stops trying.
    return refuse("network", 502);
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  return forward(request, params.path, "GET");
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  return forward(request, params.path, "POST");
}
