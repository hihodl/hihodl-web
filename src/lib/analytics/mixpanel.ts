/**
 * Mixpanel on the website (tracking-plan.md, "Web"): three events, nothing else.
 *
 *   web_page_viewed          path + utm_* on every App Router navigation
 *   web_store_button_tapped  store (ios / android), path
 *   pay_link_viewed          link_id
 *
 * Client only. The SDK is imported on demand, so a visitor who never gets
 * tracked never downloads it, and only its core build (no session recorder).
 *
 * Where it never runs:
 * - without NEXT_PUBLIC_MIXPANEL_TOKEN (local, previews without the var);
 * - when the browser says Do Not Track or Global Privacy Control;
 * - on the product (app.hihodl.xyz, /app) and on every page where wallet keys
 *   exist: those pages ship a CSP that allows no third-party code or network.
 *
 * What it never sends: a full URL. Several pages here take their only
 * credential in the path (/b, /p, /r, /o, /e, /pay/r) or the query
 * (/account/undo-email), so `$current_url` is dropped from every event and
 * `path` is the address with its tokens replaced by placeholders.
 */

import { isWalletPath } from "@/lib/wallet/csp";

type Props = Record<string, string | number | boolean | null | undefined>;
type Client = {
  init: (token: string, config: Record<string, unknown>) => void;
  track: (event: string, props?: Props, options?: { transport?: "xhr" | "sendBeacon"; send_immediately?: boolean }) => void;
};

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

/** Our project is in the EU region: events sent to the US host are not ingested. */
const API_HOST = "https://api-eu.mixpanel.com";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Bearer-link pages: the segment after the prefix is a credential, never sent. */
const REDACT: Array<[RegExp, string]> = [
  [/^\/(b|p|r|o|e)\/[^/]+/, "/$1/:token"],
  [/^\/pay\/r\/[^/]+/, "/pay/r/:token"],
  [/^\/pay\/[^/]+\/w\/[^/]+/, "/pay/:code/w/:state"],
  [/^\/pay\/(?!r\/)[^/]+/, "/pay/:code"],
  [/^\/statements\/verify\/[^/]+/, "/statements/verify/:code"],
  [/^\/invite\/[^/]+/, "/invite/:code"],
  [/^\/q\/[^/]+/, "/q/:code"],
];

/** The path as it is safe to report: no query, no hash, tokens replaced. */
export function safePath(pathname: string): string {
  for (const [re, to] of REDACT) {
    if (re.test(pathname)) return pathname.replace(re, to);
  }
  return pathname;
}

function privacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes" || nav.globalPrivacyControl === true;
}

/** Pages that are not the website, or hold wallet keys. */
function offLimits(): boolean {
  const { hostname, pathname } = window.location;
  if (hostname.startsWith("app.")) return true;
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname === "/link" || pathname.startsWith("/link/")) return true;
  return isWalletPath(pathname);
}

let client: Promise<Client | null> | null = null;

function load(): Promise<Client | null> {
  if (client) return client;
  if (typeof window === "undefined" || !TOKEN || privacySignal()) return (client = Promise.resolve(null));

  client = import("mixpanel-browser/dist/mixpanel-core.cjs")
    .then((mod) => {
      const mp = ((mod as { default?: unknown }).default ?? mod) as Client;
      mp.init(TOKEN, {
        api_host: API_HOST,
        autocapture: false,
        track_pageview: false,
        record_sessions_percent: 0,
        persistence: "localStorage",
        // Belt and braces: the SDK also checks DNT itself.
        ignore_dnt: false,
        property_blacklist: ["$current_url"],
      });
      return mp;
    })
    .catch(() => null);
  return client;
}

export function track(event: string, props: Props = {}, leaving = false): void {
  if (typeof window === "undefined" || offLimits()) return;
  void load().then((mp) => {
    // A tap that leaves the site has to go now, not in the next batch.
    mp?.track(event, props, leaving ? { transport: "sendBeacon", send_immediately: true } : undefined);
  });
}

/* ------------------------------------------------------------------ */
/* Store attribution                                                    */
/* ------------------------------------------------------------------ */

const UTM_STORE = "hold.utm";

/**
 * The visit's UTMs: the current address's, else the ones the visit landed
 * with (kept for the tab's session, so a later page still knows them).
 * Works with or without Mixpanel.
 */
export function visitUtms(): Partial<Record<(typeof UTM_KEYS)[number], string>> {
  if (typeof window === "undefined") return {};
  const here = new URLSearchParams(window.location.search);
  const found: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  for (const k of UTM_KEYS) {
    const v = here.get(k);
    if (v) found[k] = v;
  }
  try {
    if (Object.keys(found).length > 0) {
      window.sessionStorage.setItem(UTM_STORE, JSON.stringify(found));
      return found;
    }
    const kept = window.sessionStorage.getItem(UTM_STORE);
    return kept ? (JSON.parse(kept) as typeof found) : {};
  } catch {
    return found;
  }
}

export type Store = "ios" | "android";

/** Which store a link goes to; the smart link goes to the visitor's own. */
export function storeOf(href: string): Store | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.hostname === "apps.apple.com") return "ios";
  if (url.hostname === "play.google.com") return "android";
  if (url.hostname === "go.hihodl.xyz" && url.pathname.startsWith("/app")) {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "ios";
    if (/Android/i.test(navigator.userAgent)) return "android";
  }
  return null;
}

/**
 * A store link carrying the visit's campaign, so installs split by source in
 * the store consoles: App Store `ct` (campaign, else "web"), Play `referrer`
 * (the utm pairs, URL-encoded). There is no App Store provider token (`pt`)
 * anywhere in this code, so none is added. The smart link is left alone.
 */
export function withStoreAttribution(href: string): string {
  if (typeof window === "undefined") return href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const utms = visitUtms();
  if (url.hostname === "apps.apple.com") {
    url.searchParams.set("ct", (utms.utm_campaign ?? "web").slice(0, 40));
    return url.toString();
  }
  if (url.hostname === "play.google.com") {
    const pairs = new URLSearchParams({ utm_source: "web", ...utms });
    url.searchParams.set("referrer", pairs.toString());
    return url.toString();
  }
  return href;
}
