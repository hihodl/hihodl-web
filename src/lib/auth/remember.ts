/**
 * Who last signed in on this browser, so the door can say "Welcome back".
 *
 * The app shows a returning person their name and photo on the lock screen;
 * the web does the same on its sign-in screen. What is kept is what that
 * screen draws and nothing that opens anything: the way they signed in
 * (Apple, Google or email), the email for the code form, and the name to greet.
 * No token, no uid, no photo URL (ours are signed and expire within the hour).
 * It stays after signing out, which is the point; "Not you?" forgets it.
 */

"use client";

export type SignInMethod = "apple" | "google" | "email";

export interface Remembered {
  method: SignInMethod;
  email: string | null;
  /** "Alex", or "@alex" when there is no display name. */
  name: string | null;
}

const KEY = "hold-last-signin";

export function readRemembered(): Remembered | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Remembered>;
    if (v.method !== "apple" && v.method !== "google" && v.method !== "email") return null;
    return {
      method: v.method,
      email: typeof v.email === "string" ? v.email.slice(0, 320) : null,
      name: typeof v.name === "string" ? v.name.slice(0, 80) : null,
    };
  } catch {
    return null;
  }
}

export function remember(next: Remembered): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* the next visit is greeted as a first one */
  }
}

export function forgetRemembered(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}

const PENDING = "hold-auth-method";

/** Said at the moment somebody chooses a way in (this tab only), read once they are in. */
export function notePendingMethod(method: SignInMethod): void {
  try {
    window.sessionStorage.setItem(PENDING, method);
  } catch {
    /* falls back to Supabase's record */
  }
}

/**
 * How this session signed in: what this tab said when they chose, else what
 * was remembered, else Supabase's record (which is the account's FIRST
 * provider, so it is the last resort).
 */
export function currentMethod(provider: unknown): SignInMethod {
  let pending: string | null = null;
  try {
    pending = window.sessionStorage.getItem(PENDING);
  } catch {
    pending = null;
  }
  if (pending === "apple" || pending === "google" || pending === "email") return pending;
  const known = readRemembered()?.method;
  if (known) return known;
  return provider === "apple" || provider === "google" ? provider : "email";
}
