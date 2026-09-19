/**
 * The Content-Security-Policy of every wallet page.
 *
 * The browser is where this wallet's keys exist, so the main way to lose
 * them is a script we did not ship running on the page (XSS, or a third-party
 * tag). The policy allows only our own scripts, each carrying the nonce the
 * middleware minted for this response ('strict-dynamic' lets the chunks they
 * load in run too); no inline handlers, no eval in production, no plugins, no
 * framing, and network calls only to ourselves, the HOLD API and Supabase.
 *
 * Styles keep 'unsafe-inline': Tailwind and React's style attributes need it,
 * and a style cannot read a key.
 *
 * No "use client": the middleware imports this at the edge.
 */

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Is this path a page where wallet keys can exist, on either host (`/wallet`
 * on app.hihodl.xyz, `/app/wallet` elsewhere)? Onboarding (`/welcome`) counts:
 * its last step can create the wallet.
 */
export function isWalletPath(pathname: string): boolean {
  return /^\/(app\/)?(wallet|welcome)(\/|$)/.test(pathname);
}

export function walletCsp(nonce: string, dev = process.env.NODE_ENV !== "production"): string {
  const api = originOf(process.env.NEXT_PUBLIC_HIHODL_API_URL ?? process.env.HIHODL_API_BASE_URL) ?? "https://api.hihodl.xyz";
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const connect = ["'self'", api, supabase, supabase?.replace(/^https:/, "wss:"), dev ? "ws:" : null].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // The root layout loads Inter and friends from Google Fonts: a stylesheet
    // and font files, never script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connect}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "worker-src 'none'",
  ].join("; ");
}

/** 16 random bytes, base64: fresh for every response. */
export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
