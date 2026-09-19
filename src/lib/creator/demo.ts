/**
 * DEMO MODE: every screen of the web (app.hihodl.xyz and the public Spaces
 * pages) clickable in a browser with no backend, no Supabase and no account.
 *
 * ALWAYS ON, ON THIS BRANCH ONLY
 *
 * This file lives on `preview/web-together-demo`, which is never merged. The
 * gate below answers true in every build, production included, because a
 * Vercel preview IS a production build and nobody sets env vars for it.
 *
 * WHAT IS FAKE
 *
 *  - the session (no Supabase): who you are is the demo state below, kept in
 *    this browser's localStorage;
 *  - the backend: every call to the HOLD API (and to Supabase) is answered in
 *    this browser by an in-memory store (lib/demo/*), which a window.fetch
 *    shim installs before any screen asks anything. Nothing leaves the page;
 *  - passkeys: the ceremonies answer at once with a demo credential and a
 *    fixed PRF, so the real wallet crypto runs on a real (demo) backup;
 *  - browser wallets (Phantom, MetaMask): demo addresses and signatures.
 *
 * Every screen is the real component, fed the shapes the real backend
 * returns. Runbook: documentation/web-demo.md.
 */

import type { Session } from "@supabase/supabase-js";

export function creatorDemoEnabled(): boolean {
  return true;
}

/** Where the console's calls go in demo mode. Answered in the browser by lib/demo/fetch. */
export const DEMO_API_BASE = "/api/creator-demo";

/**
 * Who is looking. The console differs by role, so the demo lets you BE each
 * of them rather than describing what they would see.
 *
 *  - owner:   @demo_creator, the creator whose account this is;
 *  - manager: Dana, on the creator's team, sells for them;
 *  - rep:     Kai, on the creator's team, turns up and delivers;
 *  - invitee: somebody with a fresh account who was sent a seat link.
 */
export type DemoRole = "owner" | "manager" | "rep" | "invitee";

export const DEMO_ROLES: readonly DemoRole[] = ["owner", "manager", "rep", "invitee"];

export const DEMO_PEOPLE: Record<DemoRole, { email: string; name: string; userId: string }> = {
  owner: { email: "creator@example.com", name: "Demo Creator (@demo_creator)", userId: "demo-user-owner" },
  manager: { email: "dana@example.com", name: "Dana, sells for @demo_creator", userId: "demo-user-manager" },
  rep: { email: "kai@example.com", name: "Kai, delivers for @demo_creator", userId: "demo-user-rep" },
  invitee: { email: "sam@example.com", name: "Sam, holding a seat link", userId: "demo-user-invitee" },
};

export function isDemoRole(v: unknown): v is DemoRole {
  return typeof v === "string" && (DEMO_ROLES as readonly string[]).includes(v);
}

/** The bearer token the mock reads the role from. Not a secret: it is a demo. */
export function demoToken(role: DemoRole): string {
  return `demo-${role}`;
}

/** The seat code of the seeded pending invitation, so the accept page has one that works. */
export const DEMO_SEAT_CODE = "demo-seat-singapore-crew-2026";

/** The creator's own HOLD invite code, which a seat link is built on. */
export const DEMO_INVITE_CODE = "demo-3f2a1";

/** Addresses the demo "wallets" answer with. The Solana one is the seeded, already-proved one. */
export const DEMO_WALLETS = {
  solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  evm: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
} as const;

/* ── The account's state: what the store answers ─────────────────── */

/** web: a web wallet · app: made in the HOLD app · none: no wallet yet · other: a web wallet on an earlier account. */
export type DemoWallet = "web" | "app" | "none" | "other";
/** Which phone approves withdrawals: none linked, an Android phone, an iPhone. */
export type DemoPhone = "none" | "android" | "ios";
/** done: onboarded · new: nothing set up (no username, no passkey) · half: username and passkey, no codes, no wallet. */
export type DemoAccount = "done" | "new" | "half";
/** How this browser last signed in, for the door's "Welcome back". */
export type DemoRemembered = "none" | "google" | "email";
/** The X account behind the listings (owner only). */
export type DemoX = "linked" | "none" | "unverified" | "too-new" | "relink";

export interface DemoState {
  signedIn: boolean;
  role: DemoRole;
  wallet: DemoWallet;
  phone: DemoPhone;
  account: DemoAccount;
  remembered: DemoRemembered;
  x: DemoX;
  seed: "seeded" | "empty";
}

export const DEMO_WALLET_KINDS: readonly DemoWallet[] = ["web", "app", "none", "other"];
export const DEMO_PHONES: readonly DemoPhone[] = ["none", "android", "ios"];
export const DEMO_ACCOUNTS: readonly DemoAccount[] = ["done", "new", "half"];
export const DEMO_XS: readonly DemoX[] = ["linked", "none", "unverified", "too-new", "relink"];

const KEY = "hold-web-demo";

export const DEFAULT_DEMO: DemoState = {
  signedIn: true,
  role: "owner",
  wallet: "web",
  phone: "android",
  account: "done",
  remembered: "none",
  x: "linked",
  seed: "seeded",
};

function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

function read(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DEMO;
    const v = JSON.parse(raw) as Partial<DemoState>;
    return {
      signedIn: v.signedIn !== false,
      role: isDemoRole(v.role) ? v.role : "owner",
      wallet: oneOf(v.wallet, DEMO_WALLET_KINDS, DEFAULT_DEMO.wallet),
      phone: oneOf(v.phone, DEMO_PHONES, DEFAULT_DEMO.phone),
      account: oneOf(v.account, DEMO_ACCOUNTS, DEFAULT_DEMO.account),
      remembered: oneOf(v.remembered, ["none", "google", "email"] as const, DEFAULT_DEMO.remembered),
      x: oneOf(v.x, DEMO_XS, DEFAULT_DEMO.x),
      seed: v.seed === "empty" ? "empty" : "seeded",
    };
  } catch {
    return DEFAULT_DEMO;
  }
}

const listeners = new Set<() => void>();

function write(next: DemoState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a private window keeps the default: signed in as the owner */
  }
  syncBrowserFacts(next);
  for (const l of listeners) l();
}

export function demoState(): DemoState {
  return typeof window === "undefined" ? DEFAULT_DEMO : read();
}

export function subscribeDemo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function updateDemo(patch: Partial<DemoState>): void {
  write({ ...read(), ...patch });
}

export function demoSignIn(): void {
  updateDemo({ signedIn: true });
}

export function demoSignOut(): void {
  updateDemo({ signedIn: false });
}

export function setDemoRole(role: DemoRole): void {
  updateDemo({ signedIn: true, role });
}

/** A Session-shaped object: the web reads `user.id`, `user.email` and the token, nothing else. */
export function demoSession(state: DemoState): Session | null {
  if (!state.signedIn) return null;
  const who = DEMO_PEOPLE[state.role];
  return {
    access_token: demoToken(state.role),
    refresh_token: "demo",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: who.userId,
      email: who.email,
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: {},
      aud: "authenticated",
      created_at: "",
    },
  } as unknown as Session;
}

export function demoAccessToken(): string | null {
  const s = demoState();
  return s.signedIn ? demoToken(s.role) : null;
}

/* ── Browser facts the screens read on their own ──────────────────── */

/**
 * Onboarding keeps "done" and "not now" in localStorage, and the door keeps
 * who signed in last. Those follow the demo state, so an account set to
 * `new` really is asked everything and `done` never is.
 */
function syncBrowserFacts(s: DemoState): void {
  try {
    for (const who of Object.values(DEMO_PEOPLE)) {
      const done = `hold-onboarded:v2:${who.userId}`;
      const choices = `hold-onboarding:${who.userId}`;
      if (s.account === "done") window.localStorage.setItem(done, "1");
      else {
        window.localStorage.removeItem(done);
        window.localStorage.removeItem(choices);
      }
    }
    if (s.remembered === "none") window.localStorage.removeItem("hold-last-signin");
    else
      window.localStorage.setItem(
        "hold-last-signin",
        JSON.stringify({ method: s.remembered, email: DEMO_PEOPLE[s.role].email, name: s.role === "owner" ? "Demo" : DEMO_PEOPLE[s.role].name.split(",")[0] }),
      );
  } catch {
    /* the screens ask the store instead */
  }
}

/**
 * The address bar, read once when the page loads: a link from the screen
 * index lands straight on a state. Every one is optional.
 *
 *   ?demo-role=owner|manager|rep|invitee
 *   ?demo-wallet=web|app|none|other
 *   ?demo-phone=none|android|ios
 *   ?demo-account=done|new|half
 *   ?demo-signed=in|out
 *   ?demo-remembered=none|google|email
 *   ?demo-x=linked|none|unverified|too-new|relink
 *   ?demo=seeded|empty                 (resets the Spaces account)
 */
export function applyDemoParams(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  const patch: Partial<DemoState> = {};
  const role = q.get("demo-role");
  if (isDemoRole(role)) patch.role = role;
  const wallet = q.get("demo-wallet");
  if (wallet) patch.wallet = oneOf(wallet, DEMO_WALLET_KINDS, DEFAULT_DEMO.wallet);
  const phone = q.get("demo-phone");
  if (phone) patch.phone = oneOf(phone, DEMO_PHONES, DEFAULT_DEMO.phone);
  const account = q.get("demo-account");
  if (account) patch.account = oneOf(account, DEMO_ACCOUNTS, DEFAULT_DEMO.account);
  const signed = q.get("demo-signed");
  if (signed) patch.signedIn = signed !== "out";
  const remembered = q.get("demo-remembered");
  if (remembered) patch.remembered = oneOf(remembered, ["none", "google", "email"] as const, "none");
  const x = q.get("demo-x");
  if (x) patch.x = oneOf(x, DEMO_XS, DEFAULT_DEMO.x);
  const seed = q.get("demo");
  if (seed === "seeded" || seed === "empty") patch.seed = seed;
  if (Object.keys(patch).length === 0) {
    syncBrowserFacts(read());
    return false;
  }
  write({ ...read(), ...patch });
  return true;
}

/** A demo-only screen state from the address bar (`?state=`), or null. */
export function demoParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
