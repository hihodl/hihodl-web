/**
 * Undoing a login email change from the OLD inbox
 * (documentation/change-your-login-email-spec-2026-09-27.md, sections B and D).
 *
 * The old address gets `hihodl.xyz/account/undo-email?t=<token>`, valid 48 h.
 * Opening it never undoes anything (mail scanners open links): the page asks
 * with `check`, and only a press of "Undo it" sends `undo`.
 *
 *   POST /account/email/undo/check { token } → { state: 'ready' | 'retry' | 'undone' | 'expired', new_email?, ends_at? }
 *   POST /account/email/undo       { token } → { state: 'undone' }
 *
 * Public routes, no sign-in: the token is the proof. It goes to these two
 * calls and nowhere else, in the body (never a URL), with no Referer.
 */

import { API_BASE } from "@/lib/ad-space/config";
import { CheckoutError, apiRequest } from "@/lib/ad-space/checkout-client";

const UNDO = `${API_BASE}/account/email/undo`;

/** What the page shows. `note` is one amber line under the button, after a failed try. */
export type UndoView =
  | { kind: "loading" }
  | { kind: "ask"; masked: string | null; busy: boolean; note: UndoNote | null }
  | { kind: "done" }
  | { kind: "already" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "taken" }
  /** `check` itself failed: nothing is known about the link yet. */
  | { kind: "unchecked"; note: UndoNote };

export type UndoNote = "again" | "later";

interface CheckAnswer {
  state?: unknown;
  new_email?: unknown;
  ends_at?: unknown;
}

/** The token from the link's query, or null when there is none worth sending. */
export function tokenFrom(search: string): string | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get("t");
  } catch {
    return null;
  }
  const token = raw?.trim() ?? "";
  // No shape is promised beyond "a string"; this only keeps junk off the API.
  if (!token || token.length > 512 || /\s/.test(token)) return null;
  return token;
}

/** The view for what `check` answered. An unknown state is read as a link we cannot act on. */
export function viewFromCheck(answer: CheckAnswer | null | undefined): UndoView {
  const masked = typeof answer?.new_email === "string" && answer.new_email.trim() ? answer.new_email.trim().slice(0, 320) : null;
  switch (answer?.state) {
    case "ready":
    case "retry":
      return { kind: "ask", masked, busy: false, note: null };
    case "undone":
      return { kind: "already" };
    case "expired":
      return { kind: "expired" };
    default:
      return { kind: "invalid" };
  }
}

/** The view for a failed `check`. */
export function viewFromCheckError(e: unknown): UndoView {
  const status = e instanceof CheckoutError ? e.status : 0;
  if (status === 404 || status === 400) return { kind: "invalid" };
  if (status === 410) return { kind: "expired" };
  return { kind: "unchecked", note: status === 429 ? "later" : "again" };
}

/**
 * The view for a failed `undo`, from the one it was pressed on. A failure
 * that can pass (503, including `sign_out`; 429; a network drop) keeps the
 * button and says so on one line.
 */
export function viewFromUndoError(e: unknown, from: Extract<UndoView, { kind: "ask" }>): UndoView {
  const status = e instanceof CheckoutError ? e.status : 0;
  if (status === 404 || status === 400) return { kind: "invalid" };
  if (status === 410) return { kind: "expired" };
  if (status === 409) return { kind: "taken" };
  return { ...from, busy: false, note: status === 429 ? "later" : "again" };
}

export function checkUndo(token: string): Promise<CheckAnswer> {
  return apiRequest<CheckAnswer>(`${UNDO}/check`, { json: { token }, referrerPolicy: "no-referrer" });
}

export function undoEmailChange(token: string): Promise<{ state?: unknown }> {
  return apiRequest<{ state?: unknown }>(UNDO, { json: { token }, referrerPolicy: "no-referrer" });
}
