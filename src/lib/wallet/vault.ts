/**
 * The unlocked wallet, held in this tab's memory and nowhere else.
 *
 * No localStorage, sessionStorage, IndexedDB, cookie or service worker ever
 * sees a key: a reload, a closed tab or a lock is the end of it, and the next
 * unlock is a passkey again. What React can read is only `{ status, address }`;
 * the ed25519 seed stays in this module's closure and is wiped on lock.
 *
 * It locks itself after five minutes without input, and when the tab has been
 * hidden for a minute (a laptop left open on another tab is not "in use").
 *
 * Phase 1 signs nothing: the seed is kept only so phase 2 (sending) has
 * somewhere to start from without another design.
 */

"use client";

import { useSyncExternalStore } from "react";

import { wipe } from "./core";

export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const HIDDEN_LOCK_MS = 60 * 1000;

export interface VaultView {
  status: "locked" | "unlocked";
  address: string | null;
}

let seed: Uint8Array | null = null;
let view: VaultView = { status: "locked", address: null };
const listeners = new Set<() => void>();

let lastActivity = 0;
let hiddenAt: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: VaultView) {
  view = next;
  listeners.forEach((l) => l());
}

function onActivity() {
  if (view.status !== "unlocked") return;
  lastActivity = Date.now();
}

function onVisibility() {
  if (view.status !== "unlocked") return;
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(() => lock(), HIDDEN_LOCK_MS);
  } else {
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    // Timers are throttled in a background tab; the clock is not.
    if (hiddenAt && Date.now() - hiddenAt >= HIDDEN_LOCK_MS) lock();
    hiddenAt = null;
    lastActivity = Date.now();
  }
}

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function arm() {
  lastActivity = Date.now();
  for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", lock);
  timer = setInterval(() => {
    if (Date.now() - lastActivity >= IDLE_LOCK_MS) lock();
  }, 5000);
}

function disarm() {
  for (const e of EVENTS) window.removeEventListener(e, onActivity);
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("pagehide", lock);
  if (timer) clearInterval(timer);
  if (hiddenTimer) clearTimeout(hiddenTimer);
  timer = null;
  hiddenTimer = null;
  hiddenAt = null;
}

/** Take ownership of a freshly derived key. The caller must not keep its own copy. */
export function unlockWith(key: { seed: Uint8Array; address: string }) {
  lock();
  seed = key.seed;
  arm();
  emit({ status: "unlocked", address: key.address });
}

export function lock() {
  const was = view.status;
  wipe(seed);
  seed = null;
  disarm();
  if (was !== "locked" || view.address) emit({ status: "locked", address: null });
}

export function useVault(): VaultView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => view,
    () => view,
  );
}
