/**
 * The demo's network: a window.fetch shim, installed once per page before any
 * screen asks anything, that answers every call to the HOLD API and to
 * Supabase in this browser. Nothing leaves the page:
 *
 *   <API_BASE>/…, /api/creator-demo/…   the demo stores (account, money, public, Spaces)
 *   Supabase                             its public settings; {} for anything else
 *   api.hihodl.xyz, any *.supabase.co    refused on the spot (never sent), and logged
 *
 * Everything else (this origin's pages and assets, fonts, images) goes out as
 * usual.
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";
import { applyDemoParams, DEMO_API_BASE } from "@/lib/creator/demo";

type Json = Record<string, unknown> | null;

const G = globalThis as typeof globalThis & { __holdDemoFetch?: boolean };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function isBlocked(url: URL): boolean {
  const h = url.hostname;
  return h === "api.hihodl.xyz" || h.endsWith(".supabase.co") || h.endsWith(".supabase.in") || h.endsWith(".invalid");
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<Json> {
  const body = init?.body ?? (input instanceof Request ? await input.clone().text().catch(() => null) : null);
  if (typeof body !== "string" || !body) return null;
  try {
    return JSON.parse(body) as Json;
  } catch {
    return null;
  }
}

function headerOf(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
  const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return h.get(name);
}

async function answer(method: string, path: string, query: URLSearchParams, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const body = await readBody(input, init);
  const origin = window.location.origin;
  // A short, honest delay: "Reading…" and "Saving…" are part of what is reviewed.
  await new Promise((r) => setTimeout(r, 120));

  const { publicAnswer } = await import("./public");
  const pub = await publicAnswer(method, path, body, headerOf(input, init, "x-checkout-key"));
  if (pub) return json(pub.status, pub.body);

  const { accountAnswer } = await import("./account");
  const acc = await accountAnswer(method, path, query, body, origin);
  if (acc) return json(acc.status, acc.body);

  const { moneyAnswer } = await import("./money");
  const mon = moneyAnswer(method, path, query);
  if (mon) return json(mon.status, mon.body);

  const { handleDemo, saveDemo } = await import("@/lib/creator/demo-store.dev");
  const out = handleDemo({ method, path, query, body, authorization: headerOf(input, init, "authorization"), origin });
  if (method !== "GET") saveDemo();
  return json(out.status, out.error ? { error: out.error } : { data: out.data });
}

export function installDemoFetch(): void {
  if (typeof window === "undefined" || G.__holdDemoFetch) return;
  G.__holdDemoFetch = true;
  const q = new URLSearchParams(window.location.search);
  try {
    // A link that names a state lands on exactly that state: what this tab did before is forgotten.
    if ([...q.keys()].some((k) => k.startsWith("demo-") && k !== "demo-open" && k !== "demo-checkout" && k !== "demo-fail")) {
      window.sessionStorage.removeItem("hold-web-demo-account");
    }
    if (q.get("demo") === "seeded" || q.get("demo") === "empty") window.sessionStorage.removeItem("hold-web-demo-spaces");
  } catch {
    /* nothing was kept */
  }
  applyDemoParams();

  const real = window.fetch.bind(window);
  const apiBase = new URL(API_BASE);
  const supabase = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
    } catch {
      return null;
    }
  })();

  const shim = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url: URL;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      return real(input, init);
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.host === apiBase.host && url.pathname.startsWith(apiBase.pathname)) {
      const path = url.pathname.slice(apiBase.pathname.length).replace(/^\/+/, "");
      return answer(method, path, url.searchParams, input, init);
    }
    if (url.origin === window.location.origin && url.pathname.startsWith(`${DEMO_API_BASE}/`)) {
      const path = url.pathname.slice(DEMO_API_BASE.length + 1);
      return answer(method, path, url.searchParams, input, init);
    }
    if (supabase && url.host === supabase) {
      if (url.pathname.endsWith("/auth/v1/settings")) return json(200, { external: { apple: true, google: true, email: true } });
      return json(200, {});
    }
    if (isBlocked(url)) {
      console.warn(`[demo] refused a call to ${url.origin}${url.pathname}: the demo answers everything itself.`);
      return json(503, { error: { code: "demo_offline", message: "The demo sends nothing to a backend." } });
    }
    return real(input, init);
  };
  window.fetch = shim as typeof window.fetch;
}

installDemoFetch();
