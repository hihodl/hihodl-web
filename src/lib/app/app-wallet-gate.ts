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
 *                      /spaces/board and /spaces/bought, /spaces/team?seat=),
 *                      while SPACES_OPEN_WITHOUT_APP is true
 *   outside the shell  /app/preview/*, /app/link/*, /auth/callback, /welcome,
 *                      and every public token page (/p/ /b/ /o/ /pay/ /s/
 *                      /events/ /invite/): none of them is drawn by the shell,
 *                      so this gate never sees them
 */

/**
 * Spaces is open to creators and brands who have no wallet from the app yet.
 * Set to false to close Spaces behind the app too: every Spaces page then
 * asks for the app like the rest of the product. A money action inside Spaces
 * already shows "Get the HOLD app" to someone without a wallet.
 */
export const SPACES_OPEN_WITHOUT_APP = true;

/** Whether this product-relative path (`/spaces/listings`, `/wallet`, `` for Home) opens without a wallet from the app. */
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
