/**
 * "Ask about this spot", from the public page (spot-enquiries-contract.md).
 *
 * Two ways to ask, same sheet:
 *   - a visitor with no HOLD session on this origin: a guest thread,
 *     `POST /public/spaces/:id/enquiries`, read and answered at /e/<token>,
 *     with the seller's replies announced by email;
 *   - a visitor signed in to HOLD here: `POST /spaces/:id/enquiries` with
 *     their token, which opens (or adds to) their Payment Thread with the
 *     seller. The conversation then lives in HOLD, not on this page.
 *
 * The guest token is the thread's only credential: it is kept in this
 * browser (localStorage) so the page can link back to it, and it never goes
 * into a Referer.
 *
 * No red: problems are amber and say what to do next.
 */

"use client";

import { AD_SPACE_API } from "@/lib/ad-space/config";
import { CheckoutError, apiRequest } from "@/lib/ad-space/checkout-client";
import { HoldApiError, read } from "@/lib/app/hold-api";
import { currentLocale, t } from "@/lib/app/i18n";

import type { GuestEnquiry } from "./types";

/** The backend's limits (enquiries-rules.ts), after cleaning. */
export const ENQUIRY_NAME_MAX = 80;
export const ENQUIRY_COMPANY_MAX = 120;
export const ENQUIRY_EMAIL_MAX = 254;
export const ENQUIRY_WEB_MESSAGE_MAX = 2000;
/** An in-app enquiry is a payment note, and a note is 280. */
export const ENQUIRY_APP_MESSAGE_MAX = 280;

/** 32 random bytes, base64url: the same shape as an offer link. */
export const ENQUIRY_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function enquiryPath(token: string): string {
  return `/e/${encodeURIComponent(token)}`;
}

/** The token in a `threadUrl` (`https://hihodl.xyz/e/<token>`), or null. */
export function enquiryToken(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/e\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(url);
  return m ? m[1] : null;
}

/* ── Sending ────────────────────────────────────────────────────────── */

export interface GuestEnquiryBody {
  positionId: string | null;
  name: string;
  company?: string;
  email: string;
  message: string;
  /** The honeypot, exactly as the hidden input holds it. A person leaves it empty. */
  website: string;
  locale?: string;
}

export function sendGuestEnquiry(spaceId: string, body: GuestEnquiryBody): Promise<{ token: string; threadUrl: string }> {
  return apiRequest(`${AD_SPACE_API}/public/spaces/${encodeURIComponent(spaceId)}/enquiries`, {
    json: { ...body, locale: body.locale ?? currentLocale() },
  });
}

/** Signed in to HOLD: the enquiry is a note in the Payment Thread with `peerUserId`. */
export function sendAppEnquiry(spaceId: string, body: { positionId: string | null; message: string }): Promise<{ peerUserId: string }> {
  return read<{ peerUserId: string }>(`ad-space/spaces/${encodeURIComponent(spaceId)}/enquiries`, { json: body });
}

/** Calls under `/public/enquiries/:token`. The token is the only credential. */
function tokenCall<T>(token: string, init: { method: string; json?: unknown }): Promise<T> {
  return apiRequest<T>(`${AD_SPACE_API}/public/enquiries/${encodeURIComponent(token)}${init.method === "POST" ? "/messages" : ""}`, {
    ...init,
    referrerPolicy: "no-referrer",
  });
}

export async function getGuestEnquiry(token: string): Promise<GuestEnquiry> {
  return (await tokenCall<{ enquiry: GuestEnquiry }>(token, { method: "GET" })).enquiry;
}

export async function replyToGuestEnquiry(token: string, message: string): Promise<GuestEnquiry> {
  return (await tokenCall<{ enquiry: GuestEnquiry }>(token, { method: "POST", json: { message } })).enquiry;
}

/* ── What the visitor typed, checked before it is sent ─────────────── */

const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

/** Our reading of the backend's rules. The server's codes are the real check. */
export function guestFormProblem(f: { name: string; company: string; email: string; message: string }): string | null {
  const name = f.name.trim();
  if (!name) return t("enquiries.problem.name");
  if (name.length > ENQUIRY_NAME_MAX) return t("enquiries.problem.nameMax", { max: ENQUIRY_NAME_MAX });
  if (f.company.trim().length > ENQUIRY_COMPANY_MAX) return t("enquiries.problem.companyMax", { max: ENQUIRY_COMPANY_MAX });
  const email = f.email.trim();
  if (!email || email.length > ENQUIRY_EMAIL_MAX || !EMAIL_RE.test(email)) return t("enquiries.problem.email");
  return messageProblem(f.message, ENQUIRY_WEB_MESSAGE_MAX);
}

export function messageProblem(message: string, max: number): string | null {
  const m = message.trim();
  if (!m) return t("enquiries.problem.message");
  if (m.length > max) return t("enquiries.problem.messageMax", { max });
  return null;
}

/**
 * Every code the contract names, in words. `max` is the message limit of the
 * route that answered (2000 on the web, 280 in the app).
 */
export function describeEnquiryError(e: unknown, max = ENQUIRY_WEB_MESSAGE_MAX): string {
  const code = e instanceof CheckoutError || e instanceof HoldApiError ? e.code : null;
  const status = e instanceof CheckoutError || e instanceof HoldApiError ? e.status : 0;
  switch (code) {
    case "position_not_found":
      return t("enquiries.error.positionNotFound");
    case "not_found":
    case "NOT_FOUND":
      return t("enquiries.error.notFound");
    case "space_not_taking_enquiries":
      return t("enquiries.error.notTaking");
    case "enquiry_name_invalid":
      return t("enquiries.error.nameInvalid", { max: ENQUIRY_NAME_MAX });
    case "enquiry_company_invalid":
      return t("enquiries.error.companyInvalid", { max: ENQUIRY_COMPANY_MAX });
    case "enquiry_email_invalid":
      return t("enquiries.problem.email");
    case "enquiry_message_invalid":
      return t("enquiries.error.messageInvalid", { max });
    case "own_space":
      return t("enquiries.error.ownSpace");
    case "rate_limited":
    case "RATE_LIMITED":
      return t("enquiries.error.rateLimited");
    case "network":
    case "NETWORK":
      return t("enquiries.error.network");
  }
  if (status === 429) return t("enquiries.error.rateLimited");
  if (status === 400) return t("enquiries.error.checkFields");
  return t("enquiries.error.generic");
}

/* ── The threads this browser opened ───────────────────────────────── */

export interface SavedEnquiry {
  token: string;
  /** The spot asked about, or null for the whole space. */
  label: string | null;
  at: string;
}

const SAVED_PREFIX = "hold-enquiries:";
const SAVED_MAX = 10;

export function savedEnquiries(spaceId: string): SavedEnquiry[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PREFIX + spaceId);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (o): o is SavedEnquiry => typeof o === "object" && o !== null && typeof o.token === "string" && ENQUIRY_TOKEN_RE.test(o.token),
    );
  } catch {
    return [];
  }
}

export function rememberEnquiry(spaceId: string, entry: SavedEnquiry): void {
  try {
    const rest = savedEnquiries(spaceId).filter((o) => o.token !== entry.token);
    window.localStorage.setItem(SAVED_PREFIX + spaceId, JSON.stringify([entry, ...rest].slice(0, SAVED_MAX)));
  } catch {
    // Storage refused (a private window): the link on screen is the copy.
  }
}
