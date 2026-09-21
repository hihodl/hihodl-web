/**
 * Briefs: the calls for the side of Spaces where the brand asks first.
 *
 * Every screen in this console is a creator selling something. A brief is the
 * other direction — a brand says what it wants, creators apply, the brand
 * picks — and both sides of it are here, because both sides are the same
 * signed-in person: anybody may write a brief, and anybody may apply to
 * somebody else's. There is no brand account to switch into and nothing to
 * sign up for twice.
 *
 * The contract: documentation/ad-space-briefs-v0.md. Nothing here moves money.
 * A pick creates the creator's draft space and the ordinary checkout takes
 * over, unless the brief pays in kind — then there is no space at all, because
 * there is no price.
 */

"use client";

import { call } from "./api";

/** What the pick will put on the created space's board. Empty when nothing is paid. */
export interface BriefPosition {
  label: string;
  priceCents: number;
}

export interface BriefEvent {
  id?: string;
  key?: string | null;
  name: string;
  city?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
}

export interface BriefView {
  id: string;
  title: string;
  description: string;
  brandName: string | null;
  brandHandle: string | null;
  slug: string;
  city: string | null;
  eventId: string | null;
  event: BriefEvent | null;
  budgetCents: number;
  payMode: "split" | "upfront";
  perks: string | null;
  /** Nothing is paid through HOLD: the brand covers what `perks` says. */
  inKindOnly: boolean;
  positions: BriefPosition[];
  peopleWanted: number;
  pickedCount: number;
  applicantCount: number;
  fallback: "content_anyway" | "creator_refund" | "next_event" | string;
  fallbackNote: string | null;
  status: "open" | "filled" | "closed" | "withdrawn" | string;
  applicationsCloseAt: string | null;
  applicationsOpen: boolean;
  decideBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  mine: boolean;
  myApplication: { id: string; status: string; spaceId: string | null; createdAt: string } | null;
}

export interface ApplicationView {
  id: string;
  briefId: string;
  creatorUserId: string;
  message: string | null;
  link: string | null;
  status: "applied" | "picked" | "declined" | "withdrawn" | string;
  spaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An application with the person behind it, which is what the brand picks on. */
export interface ApplicantView extends ApplicationView {
  creator: {
    xUserId: string | null;
    xHandle: string | null;
    xName: string | null;
    xAvatarUrl: string | null;
    xVerifiedType: string | null;
    xIdentityVerified?: boolean;
    xFollowers: number | null;
    trackRecord: { delivered: number; missed: number; disputed: number };
  };
}

/** What a brand's word has been worth. Counted, never scored. */
export interface BrandRecord {
  briefsPosted: number;
  creatorsPicked: number;
  endedWithNobody: number;
  paidCents: number;
  awaitingPayment: number;
}

export interface BriefDraft {
  title: string;
  description: string;
  brandName: string;
  brandHandle?: string | null;
  eventId?: string | null;
  city?: string | null;
  budgetCents: number;
  perks?: string | null;
  peopleWanted?: number;
  payMode?: "split" | "upfront";
  fallback: string;
  fallbackNote?: string | null;
  applicationsCloseAt?: string | null;
  decideBy?: string | null;
}

/* ── Reading ──────────────────────────────────────────────────────── */

/** Every open brief still taking applications, newest first. */
export const openBriefs = (eventId?: string | null) =>
  call<{ briefs: BriefView[] }>(`ad-space/briefs${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`);

/** Every brief this person wrote, whatever became of it. */
export const myBriefs = () => call<{ briefs: BriefView[] }>("ad-space/briefs/mine");

export const getBrief = (briefId: string) => call<{ brief: BriefView }>(`ad-space/briefs/${briefId}`);

/** The queue, with who is in it. The brand's own brief only. */
export const briefApplications = (briefId: string) =>
  call<{ applications: ApplicantView[] }>(`ad-space/briefs/${briefId}/applications`);

/** What this person applied to, each with the brief it is for. */
export const myApplications = () =>
  call<{ applications: { application: ApplicationView; brief: BriefView }[] }>("ad-space/brief-applications/mine");

/** The brand's own record, as a creator reading a brief would see it. */
export const brandRecord = () => call<{ record: BrandRecord }>("ad-space/briefs/record");

/* ── Writing ──────────────────────────────────────────────────────── */

export const createBrief = (draft: BriefDraft) =>
  call<{ brief: BriefView }>("ad-space/briefs", { method: "POST", json: draft });

export const withdrawBrief = (briefId: string) =>
  call<{ brief: BriefView }>(`ad-space/briefs/${briefId}/withdraw`, { method: "POST" });

export const applyToBrief = (briefId: string, message: string | null, link: string | null) =>
  call<{ application: ApplicationView }>(`ad-space/briefs/${briefId}/applications`, {
    method: "POST",
    json: { message, link },
  });

export const withdrawApplication = (applicationId: string) =>
  call<{ application: ApplicationView }>(`ad-space/brief-applications/${applicationId}/withdraw`, { method: "POST" });

/**
 * The brand picks. What comes back is the creator's DRAFT space, which only
 * they can publish — and nothing at all when the brief pays in kind, because
 * then there is nothing to pay for.
 */
export const pickApplicant = (applicationId: string) =>
  call<{ application: ApplicationView; brief: BriefView; space: { id: string; slug: string } | null }>(
    `ad-space/brief-applications/${applicationId}/pick`,
    { method: "POST" },
  );

/* ── Words the screens share ──────────────────────────────────────── */

export const FALLBACK_LABEL: Record<string, string> = {
  content_anyway: "They post the content anyway",
  creator_refund: "The creator refunds it",
  next_event: "It moves to the next event",
};

/** What the brief pays, in one line: money, a perk, or both. */
export function paysText(brief: Pick<BriefView, "budgetCents" | "perks" | "inKindOnly">): string {
  const money = brief.budgetCents > 0 ? `$${(brief.budgetCents / 100).toLocaleString("en-US")}` : null;
  if (money && brief.perks) return `${money} · ${brief.perks}`;
  return money ?? brief.perks ?? "Nothing stated";
}

/** The public address of a brief, for the link a brand posts. */
export function briefUrl(slug: string, origin = "https://hihodl.xyz"): string {
  return `${origin}/brief/${slug}`;
}
