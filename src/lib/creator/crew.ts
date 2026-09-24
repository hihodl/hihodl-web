/**
 * A crew: creators who sell one package together, each paid their part by the
 * sponsor's own transaction. The contract is the backend's
 * documentation/ad-space-crew-v0.md.
 *
 * Not a team. A team member works for the creator and is paid by the creator;
 * a crew member is on the page and is paid like the lead, in the same payment.
 */

"use client";

import { t } from "@/lib/app/i18n";
import { fmtPercent } from "@/lib/app/i18n/format";

import { call, CreatorApiError } from "./api";

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
export const pctText = (bps: number) => fmtPercent(bps / 10_000, Number.isInteger(bps / 100) ? 0 : 1);
/** Percent typed by a person, to basis points; null when it is not a number. */
export function bpsFromPct(text: string): number | null {
  const n = Number(text.replace(",", ".").replace("%", "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Why the crew cannot sell yet, said to its members. */
export function notReadyText(reason: CrewNotReady | null): string | null {
  switch (reason) {
    case "crew_too_small":
      return t("creator.crew.notReady.tooSmall");
    case "crew_has_pending_invites":
      return t("creator.crew.notReady.pendingInvites");
    case "crew_not_agreed":
      return t("creator.crew.notReady.notAgreed");
    case "crew_member_has_no_payout":
      return t("creator.crew.notReady.noPayout");
    default:
      return null;
  }
}

/** A person, as the crew shows them. */
export const whoText = (m: { handle: string | null; name: string | null }) =>
  m.handle ? `@${m.handle}` : m.name ?? t("creator.members.aCreator");

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
  if (!(e instanceof CreatorApiError)) return t("common.somethingWentWrong");
  switch (e.code) {
    case "crew_creator_not_found":
      return t("creator.crew.error.creatorNotFound");
    case "crew_already_in":
      return t("creator.crew.error.alreadyIn");
    case "crew_too_large":
      return t("creator.crew.error.tooLarge", { max: CREW_LIMITS.MAX_MEMBERS });
    case "crew_share_out_of_range":
      return t("creator.crew.error.shareOutOfRange");
    case "crew_shares_over_a_hundred":
      return t("creator.crew.error.sharesOver");
    case "crew_lead_only":
      return t("creator.crew.error.leadOnly");
    case "crew_lead_cannot_leave":
      return t("creator.crew.error.leadCannotLeave");
    case "crew_terms_changed":
      return t("creator.crew.error.termsChanged");
    case "crew_payout_address_required":
      return t("creator.crew.error.payoutRequired");
    case "crew_name_required":
      return t("creator.crew.error.nameRequired");
    case "crew_service_required":
      return t("creator.crew.error.serviceRequired");
    case "invite_not_found":
      return t("creator.crew.error.inviteNotFound");
    case "invite_expired":
      return t("creator.crew.error.inviteExpired");
    case "crew_not_found":
    case "not_found":
      return t("creator.crew.error.notFound");
    default:
      return t("common.somethingWentWrong");
  }
}
