/**
 * Proxy for statement verification.
 *
 * The site does not talk to the backend from the browser anywhere else, and
 * this is not the place to start: it would need CORS opened to a public origin
 * for a route that answers questions about documents.
 *
 * Server-side also means the backend URL is not shipped to the client, and the
 * caller — a consular officer or a landlord holding a PDF — gets one origin to
 * trust rather than two.
 */

import { NextResponse } from "next/server";

const API_BASE = (process.env.HIHODL_API_BASE_URL ?? "https://api.hihodl.xyz/api/v1").replace(
  /\/+$/,
  "",
);

/** The fields that make up the challenge. All of them or none — a partial
 *  challenge hashes to a mismatch and tells somebody their genuine document is
 *  fake. */
const FACT_KEYS = [
  "holderLine",
  "opening",
  "totalIn",
  "totalOut",
  "closing",
  "movementCount",
  "periodStart",
  "periodEnd",
  "tokenId",
] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();

  // Same shape the backend accepts. Rejected here too so a malformed code never
  // becomes an upstream request.
  if (!/^[0-9A-Za-z]{8,32}$/.test(code)) {
    return NextResponse.json({ status: "unknown" }, { status: 200 });
  }

  const upstream = new URL(`${API_BASE}/statements/verify/${encodeURIComponent(code)}`);
  const offered = FACT_KEYS.every((k) => {
    const v = url.searchParams.get(k);
    return v !== null && v !== "";
  });
  if (offered) {
    for (const k of FACT_KEYS) upstream.searchParams.set(k, url.searchParams.get(k)!);
  }

  try {
    const res = await fetch(upstream, {
      headers: { accept: "application/json" },
      // A verification answer is about a specific document at a specific
      // moment; a cached "revoked" or a cached "match" is the one thing this
      // page must never serve.
      cache: "no-store",
    });
    const body = await res.json();
    return NextResponse.json(body?.data ?? body, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    // Distinct from `unknown`: "we could not reach the record" is not "we have
    // no record", and telling an officer the second when the first is true
    // invalidates a document that is genuine.
    return NextResponse.json({ status: "unreachable" }, { status: 200 });
  }
}
