/**
 * Where a HiSpace checkout can be opened from, the way a pay link is: its
 * own address (the camera QR and each wallet's browser open it), and the
 * HOLD app's link to the same spot's payment.
 *
 * Pure, so `pay-here.check.ts` runs it without a browser.
 */

import { HANDLE_RE, SLUG_RE } from "./config";
import type { Chain } from "./types";

/** A spot id as the server writes them. */
const POSITION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The query a space page reads to open one spot's checkout. */
export const PAY_PARAM = "pay";

export function isPositionId(value: unknown): value is string {
  return typeof value === "string" && POSITION_ID.test(value);
}

/**
 * This checkout's address: the space page with `?pay=<spot>`, or, for an
 * accepted offer, the offer's own page as it is. Null when neither can be
 * named (a spot id the server never writes).
 */
export function checkoutPageUrl(
  here: { origin: string; pathname: string; search: string },
  positionId: string,
  offerToken: string | null,
): string | null {
  if (offerToken) return `${here.origin}${here.pathname}${here.search}`;
  if (!isPositionId(positionId)) return null;
  return `${here.origin}${here.pathname}?${PAY_PARAM}=${positionId}`;
}

/**
 * The HOLD app on this spot's payment: `hihodl://s/<handle>/<slug>?pay=<spot>`,
 * which the app opens on the space with the payment on top. Null off a space
 * page (an offer's page), where the app has no such door.
 */
export function holdSpotUrl(pathname: string, positionId: string): string | null {
  const m = /^\/s\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!m || !isPositionId(positionId)) return null;
  const handle = m[1].replace(/^(@|%40)/, "");
  if (!HANDLE_RE.test(handle) || !SLUG_RE.test(m[2])) return null;
  return `hihodl://s/${handle}/${m[2]}?${PAY_PARAM}=${positionId}`;
}

/** The wallets a phone opens this page in, per network: the ones a payer there most likely has. */
export function browseWalletsFor(chain: Chain): ("phantom" | "solflare" | "backpack" | "metamask" | "coinbase" | "trust")[] {
  return chain === "solana" ? ["phantom", "solflare", "backpack"] : ["metamask", "coinbase", "trust"];
}
