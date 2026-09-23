/**
 * A crew: creators who sell one package together, each paid their part by the
 * sponsor's own transaction. The contract is the backend's
 * documentation/ad-space-crew-v0.md.
 *
 * Not a team. A team member works for the creator and is paid by the creator;
 * a crew member is on the page and is paid like the lead, in the same payment.
 */

"use client";

import { call, CreatorApiError } from "./api";
import type { Blocker } from "./crew-package";

export const CREW_LIMITS = {
  MAX_MEMBERS: 6,
  /** 1%: nobody is in a crew for nothing. */
  MIN_SHARE_BPS: 100,
  NAME_MAX: 64,
  SERVICE_MAX: 120,
  INVITE_DAYS: 14,
} as const;

export type CrewNotReady =
  | "crew_too_small"
  | "crew_has_pending_invites"
  | "crew_not_agreed"
  | "crew_member_has_no_payout";

export interface CrewMember {
  id: string;
  isLead: boolean;
  status: "invited" | "active";
  service: string;
  shareBps: number;
  share: string;
  agreed: boolean;
  hasPayout: boolean;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** Invited by link, and nobody has opened it yet. */
  byLink: boolean;
  inviteExpiresAt: string | null;
}

export interface Crew {
  id: string;
  name: string;
  termsVersion: number;
  /** The crew's expenses group in the app (`/groups`), or null if it could not be made. */
  groupId: string | null;
  ready: boolean;
  notReady: CrewNotReady | null;
  youAreLead: boolean;
  you: { memberId: string; status: "invited" | "active"; shareBps: number; share: string; agreed: boolean } | null;
  members: CrewMember[];
  spaces: { id: string; slug: string; title: string; status: string }[];
}

export interface CrewInvitePreview {
  crewId: string;
  name: string;
  termsVersion: number;
  leadHandle: string | null;
  service: string;
  shareBps: number;
  share: string;
  members: { handle: string | null; service: string; isLead: boolean }[];
  expiresAt: string | null;
}

export interface CrewSale {
  orderId: string;
  spaceId: string;
  title: string;
  paidAt: string | null;
  txSignature: string | null;
  totalUsdc: string;
  yoursUsdc: string;
}

/** What a sponsor sees on the listing page: never the split. */
export interface PublicCrew {
  name: string;
  ready: boolean;
  members: { isLead: boolean; service: string; handle: string | null; name: string | null; avatarUrl: string | null }[];
}

const base = "ad-space/crews";

export const myCrews = () => call<{ crews: Crew[] }>(base);
export const getCrew = (crewId: string) => call<{ crew: Crew }>(`${base}/${crewId}`);
export const createCrew = (name: string, service: string) => call<{ crew: Crew }>(base, { json: { name, service } });
export const renameCrew = (crewId: string, body: { name?: string; service?: string }) =>
  call<{ crew: Crew }>(`${base}/${crewId}`, { method: "PATCH", json: body });
export const addCreator = (crewId: string, handle: string, service: string, shareBps: number) =>
  call<{ crew: Crew }>(`${base}/${crewId}/members`, { json: { handle, service, shareBps } });
export const inviteByLink = (crewId: string, service: string, shareBps: number) =>
  call<{ crew: Crew; code: string; url: string }>(`${base}/${crewId}/invites`, { json: { service, shareBps } });
export const updateMember = (crewId: string, memberId: string, body: { service?: string; shareBps?: number }) =>
  call<{ crew: Crew }>(`${base}/${crewId}/members/${memberId}`, { method: "PATCH", json: body });
export const removeMember = (crewId: string, memberId: string) =>
  call<{ crew: Crew }>(`${base}/${crewId}/members/${memberId}`, { method: "DELETE" });
export const agreeToCrew = (crewId: string, termsVersion: number) =>
  call<{ crew: Crew }>(`${base}/${crewId}/agree`, { json: { termsVersion } });
export const leaveCrew = (crewId: string) => call<{ left: boolean }>(`${base}/${crewId}/leave`, { method: "POST" });
export const crewSales = (crewId: string) => call<{ sales: CrewSale[]; yoursUsdc: string }>(`${base}/${crewId}/sales`);
export const previewCrewInvite = (code: string) =>
  call<{ invite: CrewInvitePreview }>(`${base}/invites/${encodeURIComponent(code)}`);
export const joinCrew = (code: string, termsVersion: number) => call<{ crew: Crew }>(`${base}/join`, { json: { code, termsVersion } });
export const setListingCrew = (spaceId: string, crewId: string | null) =>
  call<{ spaceId: string; crewId: string | null }>(`ad-space/spaces/${spaceId}/crew`, { method: "PUT", json: { crewId } });

/** "40%" from basis points, for a field the creator types in percent. */
export const pctText = (bps: number) => `${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(1)}%`;
export { bpsFromPct, leadKeepsBps, othersBps, shareOk } from "./crew-package";

/** Why the crew cannot sell yet, said to its members. */
export function notReadyText(reason: CrewNotReady | null): string | null {
  switch (reason) {
    case "crew_too_small":
      return "A crew is at least two people. Add a creator to start selling together.";
    case "crew_has_pending_invites":
      return "Waiting for everyone you asked to say yes. Brands can't buy until they have.";
    case "crew_not_agreed":
      return "The split changed, so everyone has to say yes again before brands can buy.";
    case "crew_member_has_no_payout":
      return "Someone in the crew has nowhere to be paid yet.";
    default:
      return null;
  }
}

/** The one line about the crew's group, wherever somebody is about to say yes or add people. */
export const CREW_GROUP_LINE = "Everyone who says yes joins the crew's group for shared costs at the event.";

/** Why one member is holding the package up, next to their name. */
export function blockerText(reason: Blocker): string {
  switch (reason) {
    case "invited":
      return "Invited";
    case "not_agreed":
      return "Hasn't said yes";
    case "no_payout":
      return "No Solana payout";
  }
}

/** A person, as the crew shows them. */
export const whoText = (m: { handle: string | null; name: string | null }) =>
  m.handle ? `@${m.handle}` : m.name ?? "A creator on HOLD";

/** Link codes are 24 random bytes, base64url: anything else is not one. */
export const isCrewCode = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(v);

/**
 * A link opened before signing in: kept in this browser so the crew screen can
 * reopen it after the sign-in round trip, which lands without the query.
 */
const PENDING_KEY = "hold.crew.join";
export function keepPendingJoin(code: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* private window: the link still works if they open it again */
  }
}
export function takePendingJoin(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: number };
    if (!isCrewCode(code) || !at || Date.now() - at > 86_400_000) return null;
    return code;
  } catch {
    return null;
  }
}

/** What went wrong, in words, with what to do next. */
export function describeCrewError(e: unknown): string {
  if (!(e instanceof CreatorApiError)) return "Something went wrong. Try again.";
  switch (e.code) {
    case "crew_creator_not_found":
      return "No creator on HOLD goes by that name. Check the username or X handle.";
    case "crew_already_in":
      return "They're already in this crew.";
    case "crew_too_large":
      return `A crew is at most ${CREW_LIMITS.MAX_MEMBERS} people.`;
    case "crew_share_out_of_range":
      return "Each share is between 1% and 100%.";
    case "crew_shares_over_a_hundred":
      return "The shares add up to more than 100%. Lower someone's share first.";
    case "crew_lead_only":
      return "Only the person who made the crew can change it.";
    case "crew_lead_cannot_leave":
      return "The lead can't leave the crew. Take the listings off the crew instead.";
    case "crew_terms_changed":
      return "The split changed while you were reading. Check the new one and say yes again.";
    case "crew_payout_address_required":
      return "You need somewhere to be paid first. Add your payout address in Spaces settings, then come back.";
    case "crew_name_required":
      return "Give the crew a name.";
    case "crew_service_required":
      return "Say what this person brings, like cameras or interviews.";
    case "invite_not_found":
      return "This invitation isn't open any more. Ask for a new link.";
    case "invite_expired":
      return "This invitation has expired. Ask for a new link.";
    case "crew_not_found":
    case "not_found":
      return "That crew isn't here any more.";
    default:
      return "Something went wrong. Try again.";
  }
}
