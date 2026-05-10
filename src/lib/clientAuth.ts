/**
 * Client-side helpers for the waitlist session token (issued by
 * /api/waitlist/join, required by /api/referral/stats and /api/milestones).
 *
 * The token is stored in localStorage rather than a cookie because:
 *   - It's only ever sent in an Authorization header by the SPA, never
 *     submitted with a regular form (no CSRF surface).
 *   - The waitlist user has no auth session beyond this token; if they
 *     clear localStorage they just have to re-submit the join form.
 *
 * 7-day TTL is enforced server-side in security.ts; we don't try to
 * proactively expire client-side.
 */
const TOKEN_KEY = "hihodl_waitlist_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* localStorage disabled — no-op, user will just be asked to re-signup */
  }
}

/**
 * SWR-compatible fetcher that attaches the stored token as a Bearer header.
 * Use anywhere /api/referral/stats or /api/milestones is consumed.
 */
export async function authedFetcher(url: string): Promise<any> {
  const token = getStoredToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err: any = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
