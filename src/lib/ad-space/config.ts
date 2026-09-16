/**
 * Where the Ad Space API lives.
 *
 * Unlike /statements/verify, which proxies through our own route, the Ad Space
 * checkout talks to the backend straight from the browser. Two reasons:
 *   - the backend rate-limits the public checkout per IP, and a proxy would put
 *     every sponsor behind one Vercel address and one shared limit;
 *   - the Solana Pay QR is fetched by the sponsor's phone wallet from the
 *     backend anyway, so the backend has to be public for this product.
 * The backend sends CORS on `/api/v1/ad-space/public/*` for hihodl.xyz and
 * www.hihodl.xyz, allowing `Content-Type` and `X-Checkout-Key`. For a local
 * run against a real backend, add your origin (http://localhost:3000) to the
 * backend's `AD_SPACE_PUBLIC_ORIGINS`.
 *
 * `NEXT_PUBLIC_HIHODL_API_URL` is read on both sides. On the server the
 * existing `HIHODL_API_BASE_URL` is honoured as well, so a deployment that
 * already points the statements proxy at staging points this page there too.
 */

import type { Chain } from "./types";

const DEFAULT_API = "https://api.hihodl.xyz/api/v1";

function trim(url: string): string {
  return url.replace(/\/+$/, "");
}

export const API_BASE = trim(
  process.env.NEXT_PUBLIC_HIHODL_API_URL ?? process.env.HIHODL_API_BASE_URL ?? DEFAULT_API,
);

/** Base of every Ad Space route: `${AD_SPACE_API}/public/...`. */
export const AD_SPACE_API = `${API_BASE}/ad-space`;

export const SITE_URL = trim(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hihodl.xyz");

export const SUPPORT_EMAIL = "support@hihodl.xyz";

/** X handles are 1 to 15 of [A-Za-z0-9_]; slugs are lowercase words and dashes. */
export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/**
 * The chains a sold spot can be taken over on, as the backend's TAKEOVER_CHAINS.
 * The displaced sponsor's refund is a leg of the same transaction, and only
 * Solana carries that today. The backend refuses any other with
 * `takeover_chain_unsupported`; this list only keeps the picker from offering it.
 */
export const TAKEOVER_CHAINS: readonly Chain[] = ["solana"];
