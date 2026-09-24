/**
 * The signed-in product needs a wallet made in the HOLD app.
 *
 * Alex, 2026-09-24: the web does not create wallets and does not pay by
 * itself any more. It is for people who already made their wallet in the app
 * (iPhone or Android), whose phone is linked and approves every sensitive step.
 * So after sign-in the shell reads GET /wallet-backup/status, and anything but
 * `app_wallet` gets "Get the HOLD app" instead of the product (Shell.tsx,
 * `Onboarded`). A failed read is a Retry, never access.
 *
 * Pure, so `npx sucrase-node src/lib/app/app-wallet-gate.check.ts` runs it.
 *
 * What stays reachable WITHOUT a wallet from the app:
 *
 *   inside the shell   Spaces, VIEW ONLY (SPACES_WITHOUT_APP = "view"): the
 *                      creator's console, their spaces and sales, a brand's
 *                      /spaces/board and /spaces/bought, /spaces/team?seat=.
 *                      Making or publishing a space is not: /spaces/listings/new
 *                      gets the get-the-app screen, and every "create a space"
 *                      and Publish button is hidden or says to create it in
 *                      the HOLD app (mayCreateSpace). A draft can still be
 *                      edited. The backend refuses the same with 403
 *                      APP_REQUIRED_TO_CREATE_A_SPACE (create, series, publish).
 *   outside the shell  /app/preview/*, /app/link/*, /auth/callback, /welcome,
 *                      and every public token page (/p/ /b/ /o/ /pay/ /s/
 *                      /events/ /invite/): none of them is drawn by the shell,
 *                      so this gate never sees them
 */

/**
 * What Spaces is for somebody with no wallet from the app (Alex, 2026-09-24):
 *
 *   view     they can open Spaces and see everything in it, but not create a
 *            space: that is done in the HOLD app
 *   closed   every Spaces page asks for the app, like the rest of the product
 *
 * A money action inside Spaces already shows "Get the HOLD app" to someone
 * without a wallet, in either mode.
 */
export type SpacesWithoutApp = "view" | "closed";

export const SPACES_WITHOUT_APP: SpacesWithoutApp = "view";

/** The product-relative paths that make a new space: only the app may. */
export function createsASpace(rel: string): boolean {
  const path = rel.split(/[?#]/)[0];
  return /^\/spaces\/listings\/new\/?$/.test(path);
}

/** Whether this product-relative path (`/spaces/listings`, `/wallet`, `` for Home) opens without a wallet from the app. */
export function openWithoutApp(rel: string, mode: SpacesWithoutApp = SPACES_WITHOUT_APP): boolean {
  if (mode !== "view") return false;
  const path = rel.split(/[?#]/)[0];
  if (createsASpace(path)) return false;
  return path === "/spaces" || path.startsWith("/spaces/");
}

/**
 * May this person see the ways to make a new space? Only with a wallet from
 * the app. `undefined` while the status is being read, so a button neither
 * flashes in nor out. A read that failed with nothing read before is false,
 * never permission; one that failed on a later refresh keeps what was read
 * (the backend refuses a create without the app either way).
 */
export function mayCreateSpace(status: { state?: string } | null | undefined, failed = false): boolean | undefined {
  if (status !== undefined) return hasAppWallet(status);
  return failed ? false : undefined;
}

/**
 * Who approves a payment started on the web (`canPayFromWeb`), read
 * defensively. The web never pays by itself, so it is always the phone:
 *
 *   app          a phone (iPhone or Android) with a device key is linked
 *   link_first   a wallet, and no phone to approve on: link it first
 *   none         no wallet: it is made in the HOLD app
 *
 * A value this web no longer knows (an older backend's `web_passkey`) or none
 * at all is never read as permission: a wallet reads as link_first, no
 * wallet as none.
 */
export type CanPayFromWeb = "app" | "link_first" | "none";

export function payerOf(s: { state?: string; canPayFromWeb?: unknown } | null | undefined): CanPayFromWeb {
  const said = s?.canPayFromWeb ?? (s as { can_pay_from_web?: unknown } | null | undefined)?.can_pay_from_web;
  if (said === "app" || said === "link_first" || said === "none") return said;
  return s && s.state && s.state !== "none" ? "link_first" : "none";
}

/** Only a wallet made in the app lets the product in. */
export function hasAppWallet(status: { state?: string } | null | undefined): boolean {
  return status?.state === "app_wallet";
}
