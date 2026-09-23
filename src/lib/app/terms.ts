"use client";

/**
 * The record behind the sign-in line "By continuing you agree to the Terms and
 * Privacy Policy" (components/app/front/Door.tsx `Consent`).
 *
 * `POST /me/terms { version, surface: "web" }` writes one row per person and
 * version on the backend and never moves an earlier acceptance of the same
 * version, so sending it again is harmless. It is sent once, after the first
 * successful sign-in in this browser, with the version the line linked to.
 *
 * Only a sign-in that STARTED where the line is shown records it: the Door
 * notes the version when it renders the line (`noteTermsShown`), and the note
 * survives the Apple/Google round trip and a magic link opened in another tab
 * for an hour. A sign-in elsewhere (the creator console's team invite) never
 * showed the line, so it records nothing.
 */

import { read } from "./hold-api";

/**
 * The "Last updated" date on hihodl.xyz/terms and /privacy (src/app/terms and
 * src/app/privacy). Bump it with those pages: the next sign-in records the new
 * version next to the old one.
 */
export const TERMS_VERSION = "2026-08-13";

const KEY = "hold-terms-accepted";
const SHOWN_KEY = "hold-terms-shown";
const SHOWN_FOR_MS = 60 * 60 * 1000;

/** Called by the sign-in line as it renders: this version is on screen now. */
export function noteTermsShown(version: string = TERMS_VERSION): void {
  try {
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify({ version, at: Date.now() }));
  } catch {
    /* no storage: nothing is recorded, which is the honest default */
  }
}

/** The version the line showed within the last hour, or null. */
function shownVersion(): string | null {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    const v = raw ? (JSON.parse(raw) as { version?: unknown; at?: unknown }) : null;
    if (!v || typeof v.version !== "string" || typeof v.at !== "number") return null;
    return Date.now() - v.at <= SHOWN_FOR_MS ? v.version : null;
  } catch {
    return null;
  }
}

export async function recordTermsAcceptance(userId: string): Promise<void> {
  const version = shownVersion();
  if (!version) return;
  const mark = `${userId}:${version}`;
  try {
    if (window.localStorage.getItem(KEY) === mark) return;
  } catch {
    /* no storage: the server's idempotency is the guard */
  }
  try {
    await read<unknown>("me/terms", { json: { version, surface: "web" } });
    try {
      window.localStorage.setItem(KEY, mark);
      window.localStorage.removeItem(SHOWN_KEY);
    } catch {
      /* recorded on the server all the same */
    }
  } catch {
    /* best effort: the next sign-in tries again */
  }
}
