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
 * backend answers 410 `enquiry_link_expired`; any 410, or a code naming an
 * expired LINK, reads as that. A quote's own `offer_expired` (409) is not the
 * link: it must never close the conversation.
 */
export function isExpiredLink(status: number, code: string | null | undefined): boolean {
  if (status === 410) return true;
  return typeof code === "string" && /link/i.test(code) && /expired/i.test(code);
}

/**
 * Whether the thread on screen should take what a read returned: only when
 * it is newer, so a slow read never wipes a reply that just went out.
 */
export function isNewerThread(current: ThreadShape, next: ThreadShape): boolean {
  const a = current.messages;
  const b = next.messages;
  if (b.length !== a.length) return b.length > a.length;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  if (lastB && (!lastA || lastB.id !== lastA.id)) return true;
  return quotesMoved(current.quotes ?? [], next.quotes ?? []);
}

type QuoteShape = { quoteId: string; state: string; updatedAt: string; expiresAt?: string | null };
type ThreadShape = {
  messages: readonly { id: string; createdAt: string }[];
  quotes?: readonly QuoteShape[] | null;
};

/**
 * Whether a read brings a quote change the screen lacks: a quote it has not
 * seen, one written since (accepted in the app, paid, withdrawn), or one whose
 * state moved without a write (the server reads an open quote past its end as
 * expired). A read older than what an Accept just returned has an older
 * `updatedAt`, so it never puts an accepted quote back to open.
 */
export function quotesMoved(current: readonly QuoteShape[], next: readonly QuoteShape[]): boolean {
  for (const q of next) {
    const cur = current.find((c) => c.quoteId === q.quoteId);
    if (!cur) return true;
    const tq = Date.parse(q.updatedAt);
    const tc = Date.parse(cur.updatedAt);
    if (Number.isFinite(tq) && Number.isFinite(tc) && tq !== tc) {
      if (tq > tc) return true;
      continue;
    }
    if (q.state !== cur.state) return true;
  }
  return false;
}

/**
 * The state to draw for a quote at `now`: the server's, except that an open
 * quote or an accepted hold whose time ran out on screen reads as expired
 * before the next read says so.
 */
export function quoteStateAt<S extends string>(q: { state: S; expiresAt: string | null }, now: number | null): S | "expired" {
  if ((q.state === "open" || q.state === "accepted") && q.expiresAt && now !== null) {
    const end = Date.parse(q.expiresAt);
    if (Number.isFinite(end) && end <= now) return "expired";
  }
  return q.state;
}

/**
 * The freshest copy of the quote a message carries: the thread's `quotes`
 * list when it names it, else the message's own copy.
 */
export function quoteOfMessage<Q extends { quoteId: string }>(
  message: { quote?: Q | null },
  quotes: readonly Q[] | null | undefined,
): Q | null {
  const own = message.quote ?? null;
  if (!own) return null;
  return quotes?.find((q) => q.quoteId === own.quoteId) ?? own;
}
