/**
 * The creator console's local DEMO MODE: every screen of /creator clickable
 * in a browser with no backend and no sign-in.
 *
 * ON ONLY WHEN BOTH ARE TRUE
 *
 *   NEXT_PUBLIC_CREATOR_DEMO=1   and   NODE_ENV !== "production"
 *
 * Both are inlined at build time, so a production bundle carries `false` for
 * the gate and every demo branch below it is dead code. With the flag off the
 * console behaves exactly as it does without this file: every caller asks
 * `creatorDemoEnabled()` first and falls through to the real path.
 *
 * WHAT IS FAKE
 *
 *  - the session (no Supabase): who you are is the demo ROLE below, kept in
 *    this browser's localStorage;
 *  - the backend: `/api/creator-demo/*`, a stateful in-memory mock served by
 *    this same Next server (see `demo-store.dev.ts`);
 *  - the wallets: connecting and signing answer at once with a demo address
 *    and a signature the mock accepts.
 *
 * Nothing else is. Every screen is the real component, fed the shapes the
 * real backend returns.
 *
 * Runbook: documentation/creator-console-demo.md
 */

import type { Session } from "@supabase/supabase-js";

export function creatorDemoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CREATOR_DEMO === "1" && process.env.NODE_ENV !== "production";
}

/** Where the console's calls go in demo mode, instead of `API_BASE`. Same origin. */
export const DEMO_API_BASE = "/api/creator-demo";

/**
 * Who is looking. The console differs by role, so the demo lets you BE each
 * of them rather than describing what they would see.
 *
 *  - owner:   coinempress, the creator whose account this is;
 *  - manager: Dana, on coinempress's team, sells for them;
 *  - rep:     Kai, on coinempress's team, turns up and delivers;
 *  - invitee: somebody with a fresh account who was sent a seat link.
 */
export type DemoRole = "owner" | "manager" | "rep" | "invitee";

export const DEMO_ROLES: readonly DemoRole[] = ["owner", "manager", "rep", "invitee"];

export const DEMO_PEOPLE: Record<DemoRole, { email: string; name: string; userId: string }> = {
  owner: { email: "coin@coinempress.xyz", name: "Coin Empress (@coinempress)", userId: "demo-user-owner" },
  manager: { email: "dana@studio-dana.co", name: "Dana, sells for coinempress", userId: "demo-user-manager" },
  rep: { email: "kai@kaifilms.io", name: "Kai, delivers for coinempress", userId: "demo-user-rep" },
  invitee: { email: "sam.newcomer@gmail.com", name: "Sam, holding a seat link", userId: "demo-user-invitee" },
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

/** coinempress's own HOLD invite code, which a seat link is built on. */
export const DEMO_INVITE_CODE = "coin-3f2a1";

/** Addresses the demo "wallets" answer with. The Solana one is the seeded, already-proved one. */
export const DEMO_WALLETS = {
  solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  evm: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
} as const;

/* ── The demo session, in this browser ────────────────────────────── */

const KEY = "hold-creator-demo";

interface DemoState {
  signedIn: boolean;
  role: DemoRole;
}

const DEFAULT_STATE: DemoState = { signedIn: true, role: "owner" };

function read(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const v = JSON.parse(raw) as Partial<DemoState>;
    return { signedIn: v.signedIn !== false, role: isDemoRole(v.role) ? v.role : "owner" };
  } catch {
    return DEFAULT_STATE;
  }
}

const listeners = new Set<() => void>();

function write(next: DemoState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a private window keeps the default: signed in as the owner */
  }
  for (const l of listeners) l();
}

export function demoState(): DemoState {
  return typeof window === "undefined" ? DEFAULT_STATE : read();
}

export function subscribeDemo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function demoSignIn(): void {
  write({ ...read(), signedIn: true });
}

export function demoSignOut(): void {
  write({ ...read(), signedIn: false });
}

export function setDemoRole(role: DemoRole): void {
  write({ signedIn: true, role });
}

/** A Session-shaped object: the console reads `user.email` and the token, nothing else. */
export function demoSession(state: DemoState): Session | null {
  if (!state.signedIn) return null;
  const who = DEMO_PEOPLE[state.role];
  return {
    access_token: demoToken(state.role),
    refresh_token: "demo",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: who.userId, email: who.email, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" },
  } as unknown as Session;
}

export function demoAccessToken(): string | null {
  const s = demoState();
  return s.signedIn ? demoToken(s.role) : null;
}
