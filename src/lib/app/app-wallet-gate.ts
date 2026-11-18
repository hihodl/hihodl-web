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
 *   inside the shell   every Spaces route (the creator's console, a brand's
 *                      /spaces/board and /spaces/bought), but ONLY for a HOLD
 *                      Partner (spacesWithoutApp), while SPACES_OPEN_WITHOUT_APP
 *                      is true
 *   outside the shell  /app/preview/*, /app/link/*, /auth/callback, /welcome,
 *                      the invitation page /spaces/team?seat=, and every public
 *                      token page (/p/ /b/ /o/ /pay/ /s/ /events/ /invite/):
 *                      none of them is drawn behind this gate
 */

/**
 * Spaces is open without a wallet from the app, to HOLD Partners only.
 *
 * Alex, 2026-11-18: Spaces is for HOLD Partners. Before this, every Spaces
 * page opened for anybody signed in, and "Get the HOLD app" offered "Go to
 * Spaces" to everyone: a traveller who signed up on the web on their phone
 * went from "Get the HOLD app" into the brands' Board and briefs, empty, and
 * left without ever seeing a way to the app. Now a person without a wallet
 * from the app opens Spaces only when GET /ad-space/access says allowed
 * (an active partner team, or someone who already owns a space, lists or
 * hosts an event, or holds a seat). Everybody else gets "Get the HOLD app",
 * with no way around it.
 *
 * Set to false to close Spaces behind the app for partners too.
 */
export const SPACES_OPEN_WITHOUT_APP = true;

/**
 * Whether a person WITHOUT a wallet from the app may open Spaces, from
 * GET /ad-space/access. Only an explicit `allowed: true` opens it: no answer,
 * a failed read or an unknown body is never read as permission.
 */
export function spacesWithoutApp(access: { allowed?: unknown } | null | undefined, spacesOpen: boolean = SPACES_OPEN_WITHOUT_APP): boolean {
  return spacesOpen && access?.allowed === true;
}

/** Whether this product-relative path (`/spaces/listings`, `/wallet`, `` for Home) may open without a wallet from the app: for a partner (spacesWithoutApp). */
export function openWithoutApp(rel: string, spacesOpen: boolean = SPACES_OPEN_WITHOUT_APP): boolean {
  if (!spacesOpen) return false;
  const path = rel.split(/[?#]/)[0];
  return path === "/spaces" || path.startsWith("/spaces/");
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
