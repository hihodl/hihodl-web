/**
 * Every store link on the site. Import from here — do not inline store URLs.
 *
 * The Android package and the iOS bundle identifier are NOT the same string
 * (app.json declares `com.sayhihodl.hihodlai` for Android and
 * `com.sayhihodl.hihodlyes` for iOS). Using the iOS one on Play returns a 404.
 */

export const APP_STORE_URL =
  "https://apps.apple.com/nl/app/hihodl-stablecoin-wallet/id6755203065?l=en-GB";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sayhihodl.hihodlai";

/**
 * UA-sniffing redirector. Sends iPhone and Android to their own store, but
 * 302s Windows and Linux desktop straight to Google Play — so it is only safe
 * on surfaces we already know are mobile. Desktop CTAs use DOWNLOAD_ANCHOR.
 */
export const SMART_LINK_URL = "https://go.hihodl.xyz/app";

/** The homepage section holding both store badges. Absolute so it also resolves from /faq. */
export const DOWNLOAD_ANCHOR = "/#download";
