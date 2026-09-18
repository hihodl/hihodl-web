/**
 * The console's calls, from the browser.
 *
 * Every one goes to `/api/creator/...` on this origin, which forwards it to
 * the backend with the creator's Bearer token — see that route for why it is
 * not a direct call. The shapes and the error codes are the backend's own, so
 * the indirection is invisible from here.
 *
 * Clients switch on `error.code`, never on the message (see the contract).
 */

"use client";

import { accessToken } from "./session";
import type { PayoutAddressView, PayoutChain, PayoutChallenge, XAccountStatus } from "./types";

export class CreatorApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "CreatorApiError";
  }
}

interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; json?: unknown } = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new CreatorApiError("UNAUTHORIZED", 401);

  let res: Response;
  try {
    res = await fetch(`/api/creator/${path}`, {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(init.json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new CreatorApiError("network", 0);
  }

  let parsed: { data?: T; error?: ApiErrorBody } | null = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed || parsed.error || parsed.data === undefined) {
    const err = parsed?.error;
    const code = err?.code ?? (res.status === 429 ? "rate_limited" : res.status === 404 ? "not_found" : "server");
    throw new CreatorApiError(code, res.status, err?.details ?? {});
  }
  return parsed.data;
}

/* ── Where you get paid ───────────────────────────────────────────── */

export function getPayoutAddress(): Promise<PayoutAddressView> {
  return call<PayoutAddressView>("ad-space/payout-address");
}

export function requestPayoutChallenge(chain: PayoutChain, address: string): Promise<PayoutChallenge> {
  return call<PayoutChallenge>("ad-space/payout-address/challenge", { json: { chain, address } });
}

/**
 * Keep the address, having proved it.
 *
 * The nonce is spent by this call whether or not the signature holds, so a
 * refusal means starting again from a new challenge — never retrying this one.
 */
export function declarePayoutAddress(body: {
  chain: PayoutChain;
  address: string;
  nonce: string;
  signature: string;
}): Promise<PayoutAddressView> {
  return call<PayoutAddressView>("ad-space/payout-address", { json: body });
}

/* ── Your X account ───────────────────────────────────────────────── */

export function getXAccount(): Promise<XAccountStatus> {
  return call<XAccountStatus>("x-account");
}

/** `surface: "web"` is what sends the browser back to /creator/x instead of into the app. */
export function startXLink(): Promise<{ authorizeUrl: string; returnUrl: string }> {
  return call<{ authorizeUrl: string; returnUrl: string }>("x-account/link", { json: { surface: "web" } });
}

export function completeXLink(ticket: string): Promise<{ result: string; account: XAccountStatus }> {
  return call<{ result: string; account: XAccountStatus }>("x-account/complete", { json: { ticket } });
}

/* ── Errors, in words ─────────────────────────────────────────────── */

/**
 * What went wrong, said to the creator.
 *
 * One sentence per code the console can actually meet, and every one of them
 * says what to do next. A code with no sentence here falls through to a line
 * that at least does not pretend to know.
 */
export function describeCreatorError(e: unknown): string {
  if (!(e instanceof CreatorApiError)) return "Something went wrong. Try again.";
  switch (e.code) {
    case "network":
      return "We could not reach HOLD. Check your connection and try again.";
    case "UNAUTHORIZED":
    case "ACCOUNT_DELETED":
      return "Your sign-in has expired. Sign in again and pick up where you left off.";
    case "rate_limited":
    case "RATE_LIMIT_EXCEEDED":
      return "That is more tries than we allow in a minute. Wait a moment and try again.";
    case "payout_address_invalid":
      return "That is not an address we can pay. Copy it again from your wallet.";
    case "payout_chain_unknown":
      return "That network is not one HiSpace pays on.";
    case "payout_nonce_invalid":
      return "That request timed out or was already used. Start again and sign the new message.";
    case "payout_signature_invalid":
      return "That signature was not this address's. Make sure the wallet you signed with is the one you connected, and try again.";
    case "x_fronts_a_live_space":
      return "This X account is on a space that is live, so it cannot be unlinked until that space closes.";
    default:
      return "Something went wrong. Try again.";
  }
}
