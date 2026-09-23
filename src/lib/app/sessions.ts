"use client";

/**
 * The devices signed in to HOLD: `GET /sessions`, and this browser among them.
 *
 * The web registers its session the way the app does (hihodl-wallet
 * src/services/api/sessions.service.ts `trackSession`, called from
 * src/store/auth.ts on a genuine SIGNED_IN): `POST /sessions/track` with the
 * refresh token (the backend stores only its sha256), a stable per-install
 * `deviceId`, a device name and type. The backend dedupes on `deviceId`, so
 * this browser is ONE row across sign-ins, and a new row is what sends the
 * "new sign-in" email.
 *
 * WHICH ROW IS THIS BROWSER
 *
 * The web keeps the `sessionId` /sessions/track answered with, and that id is
 * "This browser". The backend now also knows: /sessions/track stores the
 * access token's Supabase `session_id`, and `currentSession` and
 * GET /sessions/current answer by it, with no custom header (the api Worker
 * lets only Content-Type and Authorization through). Before that backend
 * change `currentSession` was never true, so the remembered id stays the
 * first answer here.
 *
 * REMOVED FROM ANOTHER DEVICE
 *
 * Revoking a row does not end a Supabase session: each client has to notice.
 * `useSignOutWhenRemovedElsewhere` asks on focus, on becoming visible and at
 * most every few minutes, and signs this browser out when its row is revoked
 * (or gone from the active list), leaving a note for the Door. A network
 * error, a 401 or any answer it cannot read never signs anybody out.
 *
 * SIGNING OUT
 *
 * The app does not end its own row on sign-out (Supabase's signOut ends the
 * refresh token; the row ages out), and neither does the web: it only forgets
 * which row was its own, so the next sign-in registers again.
 *
 * ENDING ANOTHER SESSION
 *
 * `DELETE /sessions/:id` is open to any signed-in caller for their own rows,
 * the same call the app's Active sessions makes. This browser's own row is
 * never offered: ending it is Sign out.
 */

import { useEffect } from "react";

import { read } from "./hold-api";
import { browserDeviceName } from "@/lib/link/ua";
import { signOut } from "@/lib/creator/session";

export interface ActiveSession {
  id: string;
  deviceName: string;
  deviceType: "mobile" | "desktop" | "tablet" | "unknown";
  city: string | null;
  country: string | null;
  lastActiveAt: string;
  createdAt: string;
  currentSession?: boolean;
}

export async function listSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
  const r = await read<{ sessions?: ActiveSession[] }>("sessions", { signal });
  return Array.isArray(r?.sessions) ? r.sessions : [];
}

/** Ends another device's session. Never this browser's (that is Sign out). */
export async function revokeSession(id: string): Promise<void> {
  if (id === thisBrowserSessionId()) throw new Error("this_browser");
  await read<unknown>(`sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ── This browser ─────────────────────────────────────────────────── */

const DEVICE_KEY = "hold-web-device-id";
const SESSION_KEY = "hold-web-session";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A stable id for this browser, like the app's per-install `deviceId`. */
function deviceId(): string | null {
  const s = store();
  if (!s) return null;
  try {
    let id = s.getItem(DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      s.setItem(DEVICE_KEY, id);
    }
    return `web-${id}`;
  } catch {
    return null;
  }
}

function remembered(): { userId: string; sessionId: string } | null {
  try {
    const raw = store()?.getItem(SESSION_KEY);
    const v = raw ? (JSON.parse(raw) as { userId?: unknown; sessionId?: unknown }) : null;
    return v && typeof v.userId === "string" && typeof v.sessionId === "string" ? { userId: v.userId, sessionId: v.sessionId } : null;
  } catch {
    return null;
  }
}

/** The row this browser registered, or null when it has not (or signed out since). */
export function thisBrowserSessionId(): string | null {
  return remembered()?.sessionId ?? null;
}

/** Forget which row is ours. Called on sign-out; the next sign-in registers again. */
export function forgetThisBrowser(): void {
  try {
    store()?.removeItem(SESSION_KEY);
  } catch {
    /* nothing to forget */
  }
}

/**
 * Register this browser's session once per signed-in person. Best effort, as
 * in the app: a failure leaves the list without this row until the next try.
 */
export async function registerThisBrowser(userId: string, refreshToken: string | undefined): Promise<void> {
  if (!refreshToken || refreshToken.length < 10) return;
  if (remembered()?.userId === userId) return;
  const id = deviceId();
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const touch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints ?? 0;
  const { name, type } = browserDeviceName(ua, touch);
  try {
    const r = await read<{ sessionId?: string }>("sessions/track", {
      json: {
        refreshToken,
        ...(id ? { deviceId: id } : {}),
        deviceName: name,
        deviceType: type,
        platform: "web",
      },
    });
    if (typeof r?.sessionId === "string") store()?.setItem(SESSION_KEY, JSON.stringify({ userId, sessionId: r.sessionId }));
  } catch {
    /* best effort, like the app */
  }
}

/* ── Removed from another device ──────────────────────────────────── */

const ELSEWHERE_KEY = "hold-web-signed-out-elsewhere";
/** At most one check per minute, whatever fires it. */
const MIN_GAP_MS = 60_000;
/** And one every few minutes while the tab is open and visible. */
const POLL_MS = 3 * 60_000;

interface CurrentSessionAnswer {
  revoked?: boolean;
  reason?: "deleted" | "signed_out_elsewhere" | "expired";
  id?: string;
}

/**
 * What the server says about this browser's session.
 *
 *   "removed"  revoked from another device, or no longer among the active
 *              sessions this browser registered as its own
 *   "deleted"  the account itself is gone
 *   "ok"       anything else, including every failure: a network error or an
 *              answer we cannot read is never a reason to sign somebody out
 */
export async function thisBrowserStanding(userId: string): Promise<"ok" | "removed" | "deleted"> {
  let current: CurrentSessionAnswer | null;
  try {
    current = await read<CurrentSessionAnswer>("sessions/current");
  } catch {
    return "ok";
  }
  if (!current || typeof current !== "object") return "ok";
  if (current.revoked === true && current.reason === "signed_out_elsewhere") return "removed";
  if (current.revoked === true && current.reason === "deleted") return "deleted";
  // The server found this browser's row by its session id and it is live.
  if (current.revoked === false && typeof current.id === "string") return "ok";

  // No row matched by session id (a row registered before the backend stored
  // it). Fall back to the row this browser remembers: if it is no longer in
  // the active list, it was removed from elsewhere.
  const mine = remembered();
  if (!mine || mine.userId !== userId) return "ok";
  let list: ActiveSession[];
  try {
    const r = await read<{ sessions?: ActiveSession[] }>("sessions");
    if (!Array.isArray(r?.sessions)) return "ok";
    list = r.sessions;
  } catch {
    return "ok";
  }
  return list.some((x) => x.id === mine.sessionId) ? "ok" : "removed";
}

/** Read once by the Door: was this browser just signed out from another device? */
export function takeSignedOutElsewhereNote(): boolean {
  try {
    const s = typeof window === "undefined" ? null : window.sessionStorage;
    if (!s || s.getItem(ELSEWHERE_KEY) !== "1") return false;
    s.removeItem(ELSEWHERE_KEY);
    return true;
  } catch {
    return false;
  }
}

function leaveSignedOutElsewhereNote(): void {
  try {
    window.sessionStorage.setItem(ELSEWHERE_KEY, "1");
  } catch {
    /* the sign-out still happens; only the note is lost */
  }
}

/**
 * Sign this browser out when its session is removed from another device.
 * Mounted by the shell for as long as somebody is signed in.
 */
export function useSignOutWhenRemovedElsewhere(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    let alive = true;
    let busy = false;
    let last = 0;

    const check = async () => {
      if (!alive || busy || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      busy = true;
      try {
        const standing = await thisBrowserStanding(userId);
        if (!alive || standing === "ok") return;
        if (standing === "removed") leaveSignedOutElsewhereNote();
        await signOut();
      } finally {
        busy = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, POLL_MS);
    return () => {
      alive = false;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [userId]);
}
