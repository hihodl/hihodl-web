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
 * The backend's `currentSession` flag compares the hash of the ACCESS token
 * with a column that holds the hash of the REFRESH token, so it is never true.
 * The app works around it with `x-session-refresh-hash` on /sessions/current;
 * a browser cannot send that header through the api Worker, and the refresh
 * token rotates within the hour anyway. So the web keeps the `sessionId`
 * /sessions/track answered with, and that id is "This browser".
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

import { read } from "./hold-api";
import { browserDeviceName } from "@/lib/link/ua";

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
