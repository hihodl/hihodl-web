/**
 * Ways from a web page into the HOLD app. Pure, so the check script runs it.
 *
 *   androidIntentFor   an https address (a link session) as an Android
 *                      intent: the app when it is installed, Google Play when
 *                      it is not (S.browser_fallback_url)
 *   appIntent          a `hihodl://<path>` screen as an Android intent, with
 *                      the same Play fallback (Open HOLD on a withdrawal)
 *   openInAppUrl       hihodl.xyz/open?to=<path>: the site's own opener, which
 *                      tries `hihodl://<path>` and falls back to the store. It
 *                      only works on a phone; on a computer it goes to the
 *                      website, so a computer is told to open HOLD on its phone
 *
 * documentation/one-wallet-every-device.md.
 */

// Relative, so `npx sucrase-node src/lib/link/intent.check.ts` resolves it.
import { PLAY_STORE_URL } from "../appLinks";

/** app.json's Android package. Not the iOS bundle id, which Play does not know. */
export const ANDROID_PACKAGE = "com.sayhihodl.hihodlai";

const fallback = () => encodeURIComponent(PLAY_STORE_URL);

/** An Android intent for this exact https address: the app if installed, Google Play if not. */
export function androidIntentFor(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback()};end`;
}

/** `hihodl://<path>` as an Android intent: the app's screen if installed, Google Play if not. */
export function appIntent(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `intent://${p}#Intent;scheme=hihodl;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback()};end`;
}

/** The app's withdrawal screen, where a linked phone approves a payment started on the web. */
export function withdrawalIntent(id: string): string {
  return appIntent(`withdrawals/${encodeURIComponent(id)}`);
}

/**
 * The app's payment approval screen: a spot or a stay started on the web,
 * approved and signed on the linked phone (hihodl://payments/approve/<id>).
 */
export function paymentApprovalIntent(id: string): string {
  return appIntent(`payments/approve/${encodeURIComponent(id)}`);
}

/** The site's opener for `hihodl://<path>` (src/app/open/page.tsx). Phones only. */
export function openInAppUrl(path: string): string {
  return `https://hihodl.xyz/open?to=${encodeURIComponent(path.replace(/^\/+/, ""))}`;
}
