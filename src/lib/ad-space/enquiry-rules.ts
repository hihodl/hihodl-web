/**
 * The rules behind "Ask about this spot" and the guest thread at /e/<token>
 * (spot-enquiries-contract.md), kept apart from the screens so a .check.ts
 * can run them.
 *
 * Pure: no React, no `@/` imports.
 */

/**
 * Whether a spot can still be asked about: an open one, or one this browser
 * is holding at its own checkout. A sold spot, a spot held by somebody
 * else's checkout and a square closed by a whole-listing sale are not for
 * sale, so the question would go nowhere; "Ask the seller" stays for those.
 */
export function canAskAbout(p: { id: string; status: string }, heldByMe: string | null | undefined): boolean {
  if (p.status === "open") return true;
  return p.status === "held" && !!heldByMe && p.id === heldByMe;
}

/** The thread is read again every 20 s while the tab is on screen. */
export const POLL_MS = 20_000;
/** After failures the wait doubles, up to five minutes. */
export const POLL_MAX_MS = 5 * 60_000;

/** How long to wait before the next read, after `failures` reads in a row that did not answer. */
export function nextPollDelay(failures: number): number {
  const n = Math.max(0, Math.min(Math.floor(failures), 10));
  return Math.min(POLL_MS * 2 ** n, POLL_MAX_MS);
}

/**
 * A guest link that stopped working because nobody wrote for 90 days. The
 * backend answers 410 with a code naming the expiry; any 410, or any code
 * that says "expired", reads as that, whatever its exact spelling.
 */
export function isExpiredLink(status: number, code: string | null | undefined): boolean {
  if (status === 410) return true;
  return typeof code === "string" && /expired/i.test(code);
}

/**
 * Whether the thread on screen should take what a read returned: only when
 * it is newer, so a slow read never wipes a reply that just went out.
 */
export function isNewerThread(
  current: { messages: readonly { id: string; createdAt: string }[] },
  next: { messages: readonly { id: string; createdAt: string }[] },
): boolean {
  const a = current.messages;
  const b = next.messages;
  if (b.length !== a.length) return b.length > a.length;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return !!lastB && (!lastA || lastB.id !== lastA.id);
}
