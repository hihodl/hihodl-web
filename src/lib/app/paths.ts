/**
 * Where the HOLD product lives, as a URL.
 *
 * The product is `app.hihodl.xyz`. Inside this Next app it is the `/app` tree,
 * and the middleware rewrites the one onto the other, so the same page answers
 * at two addresses:
 *
 *   app.hihodl.xyz/spaces/listings     (production, and app.localhost in dev)
 *   <any other host>/app/spaces/listings  (plain localhost, previews)
 *
 * Every link inside the product is built from the base that matches the host
 * the page was served on. A link written as `/app/spaces/...` on the app host
 * would be rewritten to `/app/app/spaces/...` and 404.
 *
 * No "use client": the middleware and server components import this too.
 */

/** `app.hihodl.xyz`, `app.localhost:3350`, `app.<preview>.vercel.app` if one is ever pointed here. */
export function isAppHost(host: string | null | undefined): boolean {
  return !!host && host.toLowerCase().startsWith("app.");
}

/** The path prefix of the product on this host: nothing on the app host, `/app` everywhere else. */
export function appPrefixFor(host: string | null | undefined): "" | "/app" {
  return isAppHost(host) ? "" : "/app";
}

/** Where Spaces lives on this host. */
export function spacesBaseFor(host: string | null | undefined): string {
  return `${appPrefixFor(host)}/spaces`;
}

/**
 * The same, read in the browser. For library code that builds a link after
 * something happened (a refusal's "fix it" link, a remembered invitation), and
 * never during a render the server also made.
 */
export function clientSpacesBase(): string {
  if (typeof window === "undefined") return "/app/spaces";
  return spacesBaseFor(window.location.host);
}

export function spacesPath(path = ""): string {
  return `${clientSpacesBase()}${path}`;
}

/**
 * The product's own origin, for links FROM the website INTO the product.
 *
 * Sessions are per origin, so production must send people to
 * https://app.hihodl.xyz rather than serve the product under hihodl.xyz/app.
 * `NEXT_PUBLIC_APP_ORIGIN` wins; otherwise production (Vercel's own
 * `VERCEL_ENV`) means app.hihodl.xyz, and anything else (local, previews)
 * keeps the product on the same origin under `/app`.
 */
export function productOrigin(): string {
  const set = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (set) return set.replace(/\/+$/, "");
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  return env === "production" ? "https://app.hihodl.xyz" : "";
}

/** A product path (`/spaces/team?seat=…`) as a URL the website can send people to. */
export function productUrl(path: string): string {
  const origin = productOrigin();
  return origin ? `${origin}${path}` : `/app${path}`;
}

/**
 * The old console's addresses, mapped onto the product's.
 *
 * `/creator/x` stays reachable because the backend builds that return URL
 * itself (`returnBase("web")` in x-account.router.ts): X sends the browser
 * there and this sends it on, query string and all.
 */
export function productPathForCreator(pathname: string): string {
  const rest = pathname.replace(/^\/creator/, "");
  if (rest === "" || rest === "/") return "/spaces";
  if (rest === "/team/work" || rest.startsWith("/team/work/")) return "/spaces/deliveries";
  if (rest === "/x" || rest.startsWith("/x/")) return "/spaces/x";
  return `/spaces${rest}`;
}

/** The product's own prefix on this host: `` on app.hihodl.xyz, `/app` elsewhere. */
export function clientProductBase(): "" | "/app" {
  if (typeof window === "undefined") return "/app";
  return appPrefixFor(window.location.host);
}

/**
 * A place to send somebody back to after signing in, or null.
 *
 * Only a path on THIS origin: `/spaces/listings?x=1` is kept, while
 * `https://evil.example`, `//evil.example`, `/\evil.example` and anything
 * with a scheme are refused, so a link carrying `next` can never turn the
 * domain people sign in on into a redirect to somewhere else. The auth
 * callback itself is refused too (it would loop).
 */
export function safeNext(raw: string | null | undefined, origin: string): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // No control characters or whitespace: browsers strip tabs and newlines
  // from URLs, so "/\t/evil.example" would otherwise read as "//evil.example".
  if (/[\s\x00-\x1f\x7f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (/^\/(app\/)?auth\/callback\/?$/.test(url.pathname)) return null;
  const path = url.pathname.replace(/^\/{2,}/, "/");
  return `${path}${url.search}${url.hash}`;
}
