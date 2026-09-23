"use client";

/**
 * The devices signed in to HOLD, read-only: `GET /sessions`.
 *
 * The rows are the app's. A phone registers its session (`POST /sessions`)
 * when it signs in, with a device name, and the app's Security › Active
 * sessions lists and revokes them. The web registers none, so this browser is
 * never in the list and `currentSession` is never true here. Revoking stays in
 * the app, next to the device it protects.
 */

import { read } from "./hold-api";

export interface ActiveSession {
  id: string;
  deviceName: string;
  deviceType: "mobile" | "desktop" | "tablet" | "unknown";
  city: string | null;
  country: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export async function listSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
  const r = await read<{ sessions?: ActiveSession[] }>("sessions", { signal });
  return Array.isArray(r?.sessions) ? r.sessions : [];
}
