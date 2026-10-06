/**
 * An organiser sells its event, on the web: the rules with nothing that needs
 * React or a network, so `organiser-rules.check.ts` runs every one under
 * sucrase-node.
 *
 * Contract: documentation/organiser-sells-its-event-contract.md (sections 2,
 * 5, 6 and 7, items 3 and 6).
 *
 * The server decides everything: who organises, whether the code is on the
 * page, whether a package may close when it says. This only reads its words
 * (statuses, refusal codes) and turns them into ours.
 */

import type { MessageKey } from "./i18n";

/* ── The Luma page and the sponsor link ──────────────────────────── */

/**
 * Whether a pasted text is a Luma page at all (`luma.com/<key>`, `lu.ma/<key>`,
 * with or without the scheme or `www.`). The server canonicalises it; this only
 * keeps "Get my code" from sending a link that is obviously not one.
 */
export function lumaKeyOf(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:lu\.ma|luma\.com)\/([^/?#\s]+)/i.exec(text);
  if (!m) return null;
  let key: string;
  try {
    key = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return /^[\w-]{1,120}$/.test(key) ? key : null;
}

/** The Luma page for a key, as the sponsor page's "Claim it" pre-fills it. */
export function lumaUrlOf(key: string): string {
  return `https://luma.com/${encodeURIComponent(key)}`;
}

/** `https://hihodl.xyz/sponsor/<key>`: the one link the host puts on Luma. */
export function sponsorLinkOf(siteUrl: string, key: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/sponsor/${encodeURIComponent(key)}`;
}

/* ── Claim statuses ──────────────────────────────────────────────── */

export type ClaimStatus = "pending" | "review" | "verified" | "rejected" | "lost" | "expired";

export const CLAIM_STATUSES: readonly ClaimStatus[] = ["pending", "review", "verified", "rejected", "lost", "expired"];

/** An unknown status (a newer server) reads as pending: the row still shows, with the code. */
export function claimStatusOf(raw: unknown): ClaimStatus {
  return (CLAIM_STATUSES as readonly unknown[]).includes(raw) ? (raw as ClaimStatus) : "pending";
}

export type PillTone = "calm" | "good" | "caution" | "dim";

/** The pill on a claim row. Never red: a refusal is dim, waiting is amber, done is green. */
export function claimPill(status: ClaimStatus): { key: MessageKey; tone: PillTone } {
  switch (status) {
    case "verified":
      return { key: "business.events.status.verified", tone: "good" };
    case "review":
      return { key: "business.events.status.review", tone: "calm" };
    case "rejected":
      return { key: "business.events.status.rejected", tone: "dim" };
    case "lost":
      return { key: "business.events.status.lost", tone: "dim" };
    case "expired":
      return { key: "business.events.status.expired", tone: "dim" };
    default:
      return { key: "business.events.status.pending", tone: "caution" };
  }
}

/** Only a pending claim has a code worth pasting and a Verify worth pressing. */
export const canVerify = (status: ClaimStatus): boolean => status === "pending";

/** A claim that is over and can be started again from the same link (a fresh code). */
export const canRestart = (status: ClaimStatus): boolean => status === "expired";

/* ── Refusals ────────────────────────────────────────────────────── */

const CLAIM_ERRORS: Record<string, MessageKey> = {
  luma_url_invalid: "business.events.error.lumaUrlInvalid",
  luma_not_an_event: "business.events.error.notAnEvent",
  event_in_the_past: "business.events.error.inThePast",
  event_already_claimed: "business.events.error.alreadyClaimed",
  code_not_on_luma: "business.events.error.codeNotOnLuma",
  luma_unreachable: "business.events.error.lumaUnreachable",
  claim_expired: "business.events.error.expired",
  claim_rejected: "business.events.error.rejected",
  claim_changed_try_again: "business.events.error.changed",
  not_a_business: "business.events.error.notABusiness",
  role_not_allowed: "business.events.error.roleNotAllowed",
  calendar_has_no_upcoming_events: "business.events.error.calendarEmpty",
  not_found: "business.events.error.notFound",
  rate_limited: "business.events.error.rateLimited",
  RATE_LIMIT_EXCEEDED: "business.events.error.rateLimited",
  NETWORK: "business.error.network",
  UNAUTHORIZED: "business.error.signIn",
};

/** A refusal from a claim call, as a sentence. Every code the contract names has its own. */
export function claimErrorKey(code: string | null | undefined, status = 0): MessageKey {
  if (code && CLAIM_ERRORS[code]) return CLAIM_ERRORS[code];
  if (status === 429) return "business.events.error.rateLimited";
  if (status === 410) return "business.events.error.expired";
  if (status === 503) return "business.events.error.lumaUnreachable";
  if (status === 404) return "business.events.error.notFound";
  return "common.somethingWentWrong";
}

/* ── Packages ────────────────────────────────────────────────────── */

const DAY = 86_400_000;

/**
 * The latest a package may close: the end of the day after the event
 * (`package_closes_after_event`), in UTC like the server's day arithmetic.
 * Null when the event's last day is not a date.
 */
export function packageClosesByMs(endsOn: string | null | undefined): number | null {
  if (!endsOn || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return null;
  const start = Date.parse(`${endsOn}T00:00:00Z`);
  return Number.isFinite(start) ? start + 2 * DAY - 1 : null;
}

/* ── The sponsor's report link ───────────────────────────────────── */

/** 32 random bytes, base64url, no padding (a-sponsor-gets-its-report-contract.md). */
const REPORT_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The page a `reportUrl` opens, as a path on this site (`/r/<token>`), so a
 * preview or staging deployment keeps its own report page. Null for anything
 * that is not a report link: nothing else is ever drawn as one.
 */
export function reportPathOf(reportUrl: unknown): string | null {
  if (typeof reportUrl !== "string" || !reportUrl) return null;
  let path: string;
  try {
    path = new URL(reportUrl, "https://hihodl.xyz").pathname;
  } catch {
    return null;
  }
  const m = /^\/r\/([^/]+)\/?$/.exec(path);
  return m && REPORT_TOKEN.test(m[1]) ? `/r/${m[1]}` : null;
}
