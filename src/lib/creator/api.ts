/**
 * The console's calls, straight from the browser to the backend.
 *
 * WHY THERE IS NO LONGER A PROXY
 *
 * This console used to talk through `/api/creator/[...path]` on our own
 * origin, because CORS on the backend was mounted on the PUBLIC routers only
 * and those allow `Content-Type` and `X-Checkout-Key` — not `Authorization`.
 * A browser at hihodl.xyz calling an authenticated route with a Bearer token
 * got a failed preflight and no answer, so the calls were made server to
 * server instead.
 *
 * That proxy carried a literal five-entry allow-list, which was honest while
 * the console only signed in and declared an address. Publishing and running a
 * listing is some fifteen calls, several with an id in the path, and an
 * allow-list that has to grow patterns to fit them stops being the security
 * model it was written as. So the backend now mounts `holdWebAuthedCors()` on
 * the authenticated Ad Space and X routers: the origin is echoed only when it
 * is one of ours, never `*`, and credentials stay off — the token travels as a
 * header this page puts there on purpose, and no ambient cookie can be spent
 * by a page on another origin.
 *
 * THAT BACKEND CHANGE IS NOT DEPLOYED YET
 *
 * It is on `feat/spaces-roles`. Against production `api.hihodl.xyz` every call
 * below fails its preflight until that ships, and the console is unmerged too:
 * they go out together. Running this locally against a real backend needs your
 * dev origin in the backend's `AD_SPACE_PUBLIC_ORIGINS`.
 *
 * Every response is `{ data: ... }` and nothing else. Clients switch on
 * `error.code`, never on the message (see the contract).
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";

import { accessToken } from "./session";
import type { PayoutAddressView, PayoutChain, PayoutChallenge, XAccountStatus } from "./types";

export class CreatorApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
    /** The server's own sentence, when it wrote one (shown only where a screen chooses to). */
    readonly serverMessage: string | null = null,
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

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One call, with the creator's token on it.
 *
 * A body is sent whenever `json` is given, `null` included: several routes
 * take `{ minOfferCents: null }` to mean "no floor at all", which is not the
 * same as sending nothing.
 *
 * `file` sends the bytes themselves with their own type instead (a listing's
 * picture: the route takes the raw image, not JSON).
 */
export async function call<T>(
  path: string,
  init: { method?: Method; json?: unknown; file?: Blob; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await accessToken();
  if (!token) throw new CreatorApiError("UNAUTHORIZED", 401);

  const file = init.file;
  const hasBody = init.json !== undefined || file !== undefined;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path}`, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(file ? { "content-type": file.type } : hasBody ? { "content-type": "application/json" } : {}),
        // `Idempotency-Key` on the routes that create something a second call
        // must not create twice. The Worker in front of the API allows it.
        ...(init.headers ?? {}),
      },
      body: file ?? (hasBody ? JSON.stringify(init.json) : undefined),
      cache: "no-store",
    });
  } catch {
    // A refused preflight lands here too, indistinguishable from a dead
    // network — which is the honest thing to say about either.
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
    throw new CreatorApiError(code, res.status, err?.details ?? {}, err?.message ?? null);
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
 *
 * The listing's own refusals are not here: they belong beside the field they
 * are about, which is `describeProblem` in ./problems.
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
      return "This X account is on a live listing, so it stays connected until that listing closes. Sponsors paid for that handle.";
    default:
      return "Something went wrong. Try again.";
  }
}
