/**
 * "Continue with Apple" and "Continue with Google" on app.hihodl.xyz.
 *
 * WHY THE SAME SUPABASE PROVIDERS AS THE APP
 *
 * The app signs in with Google through `signInWithOAuth` and with Apple
 * through a native id token (hihodl-wallet/src/auth/oauth.ts), both against
 * this same Supabase project. A browser has no native Apple sheet, so here
 * both go through `signInWithOAuth` with PKCE: the provider sends the browser
 * to Supabase, Supabase sends it to /auth/callback with a one-time code, and
 * only this browser (which holds the verifier) can exchange it.
 *
 * ONE PERSON, ONE ACCOUNT
 *
 * Supabase links an Apple or Google identity to an existing user with the same
 * VERIFIED email automatically: somebody who signed in with an email code and
 * later presses "Continue with Google" for that address lands on the same
 * account, the same uid, the same HOLD user. Nothing to do in code. The one
 * case it cannot see is Apple's "Hide my email", whose relay address is not the
 * person's email.
 *
 * WHERE THEY COME BACK TO
 *
 * The page they were on is kept in this tab's sessionStorage, not in the
 * redirect URL, so the redirect URL is one fixed address the Supabase
 * allow-list can name exactly. The callback reads it back through `safeNext`.
 */

"use client";

import { clientProductBase, safeNext } from "@/lib/app/paths";
import { creatorDemoEnabled, demoSignIn } from "@/lib/creator/demo";
import { creatorAuth } from "@/lib/creator/session";

import { notePendingMethod } from "./remember";

export type OAuthProvider = "apple" | "google";

const NEXT_KEY = "hold-auth-next";

/** The fixed address the providers return to on this host. */
export function callbackUrl(): string {
  return `${window.location.origin}${clientProductBase()}/auth/callback`;
}

/** Remember where to come back to (this tab only), then leave for the provider. */
export async function continueWith(provider: OAuthProvider): Promise<void> {
  // Demo mode: the provider says yes at once, and the person is in where they were.
  if (creatorDemoEnabled()) {
    notePendingMethod(provider);
    await new Promise((r) => setTimeout(r, 500));
    demoSignIn();
    return;
  }
  const auth = creatorAuth();
  if (!auth) throw new Error("not_configured");
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  try {
    const next = safeNext(here, window.location.origin);
    if (next) window.sessionStorage.setItem(NEXT_KEY, next);
  } catch {
    /* they land on the product's first page instead */
  }
  notePendingMethod(provider);
  const { data, error } = await auth.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl(),
      // Google otherwise signs straight into whichever account the browser
      // last used; a shared laptop needs the choice.
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("no_url");
  window.location.assign(data.url);
}

/** Where the callback sends the person: what they were opening, or the product's first page. */
export function takeNext(fallback: string): string {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(NEXT_KEY);
    window.sessionStorage.removeItem(NEXT_KEY);
  } catch {
    raw = null;
  }
  return safeNext(raw, window.location.origin) ?? fallback;
}

/**
 * Apple on the web needs its own Services ID and return URL in Apple
 * Developer; the app's native sign-in does not. Supabase reports Apple as on
 * because the app uses it, so the web offers Apple only once that Services ID
 * exists and this is set to "1".
 */
const WEB_APPLE = process.env.NEXT_PUBLIC_WEB_APPLE_SIGNIN === "1";

/**
 * Which of the two this Supabase project has switched on, read from its
 * public settings (`/auth/v1/settings`, the same document the dashboard's
 * toggles write). A provider that is off is not offered: pressing it would
 * leave the person on a bare JSON error page at Supabase. If the settings
 * cannot be read, both are offered.
 */
export async function enabledProviders(): Promise<Record<OAuthProvider, boolean>> {
  const on = await providersInSupabase();
  return { apple: on.apple && WEB_APPLE, google: on.google };
}

async function providersInSupabase(): Promise<Record<OAuthProvider, boolean>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const both = { apple: true, google: true };
  if (!url || !key) return both;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return both;
    const body = (await res.json()) as { external?: Partial<Record<string, boolean>> };
    return { apple: body.external?.apple === true, google: body.external?.google === true };
  } catch {
    return both;
  }
}

/** An Apple device: iPhone, iPad (which says "Mac"), Mac. Apple goes first there. */
export function onAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform) || /iPhone|iPad|iPod|Macintosh/.test(nav.userAgent);
}
