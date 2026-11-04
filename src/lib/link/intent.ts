/**
 * Ways from a web page into the HOLD app. Pure, so the check script runs it.
 *
 *   androidIntentFor   an https address (a link session) as an Android
 *                      intent: the app when it is installed, Google Play when
 *                      it is not (S.browser_fallback_url)
 *   appIntent          a `hihodl://<path>` screen as an Android intent, with
 *                      the same Play fallback (Open HOLD on a withdrawal)
 *   openInAppUrl       hihodl.xyz/open?to=<path>: the site's own opener. The
 *                      iOS app claims it as a universal link; otherwise the
 *                      page tries `hihodl://<path>` and falls back to the
 *                      store. On a computer it goes to app.hihodl.xyz, so a
 *                      computer is told to open HOLD on its phone
 *   linkUniversalUrl   a link session's address as the iOS app claims it
 *                      (app.hihodl.xyz/link/*), whatever host made it
 *   openOnPhone        `hihodl://<path>` from the phone this page is on: the
 *                      intent on Android, the opener on an iPhone, null on a
 *                      computer
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

/** The site's opener for `hihodl://<path>` (src/app/open/page.tsx), and the iOS app's universal link. Phones only. */
export function openInAppUrl(path: string): string {
  return `https://hihodl.xyz/open?to=${encodeURIComponent(path.replace(/^\/+/, ""))}`;
}

/** The host the iOS app claims `/link/*` on (public/.well-known/apple-app-site-association). */
export const APP_HOST = "app.hihodl.xyz";

/**
 * A link session's address, as the iOS app claims it: app.hihodl.xyz/link/<id>?k=…
 * The same session opened under hihodl.xyz/app/link/… (the product off its
 * own host) is moved onto the app host, where the universal link lives.
 */
export function linkUniversalUrl(href: string): string {
  const u = new URL(href);
  const path = u.pathname.replace(/^\/app(?=\/link\/)/, "");
  return `https://${APP_HOST}${path}${u.search}`;
}

/**
 * `hihodl://<path>` from the phone this page is on: the intent on Android
 * (Google Play when HOLD is missing), the site's universal link on an iPhone
 * (the App Store when it is missing), null on a computer.
 */
export function openOnPhone(path: string, phone: "android" | "ios" | null | undefined): string | null {
  if (phone === "android") return appIntent(path);
  if (phone === "ios") return openInAppUrl(path);
  return null;
}

/**
 * The link page, open in a phone's browser, handed to the HOLD app: the
 * Android intent for the same address; on an iPhone the site's opener on
 * hihodl.xyz, because Safari never hands a link to an app on the host it is
 * already showing (app.hihodl.xyz), and the app claims the opener too.
 */
export function openLinkFromBrowser(href: string, phone: "android" | "ios"): string {
  if (phone === "android") return androidIntentFor(href);
  const u = new URL(href);
  const path = u.pathname.replace(/^\/app(?=\/link\/)/, "");
  return openInAppUrl(`${path}${u.search}`);
}
