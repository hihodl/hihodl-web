/**
 * Inviting friends: the app's `src/store/referrals.store.ts`, read the same way.
 *
 * `GET /referrals/me` is the summary (the link, the counts, the points each
 * side is paid, and what the friend must invest before either is) and `GET
 * /referrals/invites` the list. The numbers are the server's: the fallbacks
 * the app keeps for a cold start are not repeated here, because the web draws
 * a skeleton until the summary lands rather than a figure it made up.
 *
 * The backend only knows "signed up" and "activated", so a pending invite is
 * 1 of 3 and never an invented middle step.
 */

"use client";

import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { read } from "./hold-api";
import { t } from "./i18n";

export interface ReferralSummary {
  inviteCode: string | null;
  inviteLink: string | null;
  invitedCount?: number;
  referredCount?: number;
  activatedCount?: number;
  pointsEarned?: number;
  pointsPerReferrer?: number;
  pointsPerWelcome?: number;
  qualifyUsd?: number;
}

interface ApiInvite {
  id: string;
  status: string;
  friendAlias: string | null;
  friendName: string | null;
  createdAt?: string;
  qualifiedAt?: string | null;
  expiresAt?: string;
}

export type InviteStatus = "activated" | "in_progress" | "expired";

export interface Invite {
  id: string;
  name: string;
  status: InviteStatus;
  /** 0..3 of the activation steps. */
  stepsDone: number;
  /** Whole days left in the invite's window; null once resolved. */
  daysLeft: number | null;
  pointsAwarded: number;
}

function wholeDaysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function toInvite(raw: ApiInvite, perReferrer: number): Invite {
  const activated = raw.status === "qualified" || raw.status === "rewarded";
  const status: InviteStatus = activated ? "activated" : raw.status === "expired" ? "expired" : "in_progress";
  return {
    id: raw.id,
    name: raw.friendAlias || raw.friendName || t("menu.invite.friend"),
    status,
    stepsDone: activated ? 3 : 1,
    daysLeft: status === "in_progress" ? wholeDaysLeft(raw.expiresAt) : null,
    pointsAwarded: activated ? perReferrer : 0,
  };
}

const OPTIONS = { revalidateOnFocus: true, focusThrottleInterval: 30_000, errorRetryCount: 2 };

export function useReferralSummary() {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<ReferralSummary>(uid ? ["referrals", uid, "me"] : null, () => read<ReferralSummary>("referrals/me"), OPTIONS);
}

/** The list, mapped as the app maps it. Needs the summary's per-friend points. */
export function useInvites(perReferrer: number | undefined) {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<Invite[]>(
    uid && perReferrer !== undefined ? ["referrals", uid, "invites", perReferrer] : null,
    async () => {
      const list = await read<{ invites: ApiInvite[] }>("referrals/invites");
      return (list?.invites ?? []).map((r) => toInvite(r, perReferrer ?? 0));
    },
    OPTIONS,
  );
}
