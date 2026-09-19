/**
 * A creator's team, as the backend returns it, and the arithmetic of a share.
 *
 * Mirrors `server/services/ad-space/team.service.ts` and `team-rules.ts` field
 * for field. Nothing here is invented on the web side: the limits are the
 * server's, copied so the screen can say them out loud before a refusal does.
 *
 * WE NEVER MOVE THIS MONEY
 *
 * Worth saying at the top of the file every screen about a team imports. The
 * sponsor's payment is one transaction the sponsor signs, paying the creator's
 * own address, with our fee beside it, and a team changes nothing about that.
 * What a member is owed is the creator's bookkeeping, written down when the
 * chain confirms a sale and PAID BY THE CREATOR. "Paid" on any of these rows
 * means the creator told us they paid; the transaction beside it is their note,
 * and nothing on our side reads it as proof.
 *
 * WHY A SHARE IS BASIS POINTS OF WHAT THE CREATOR RECEIVED
 *
 * Not of what the sponsor paid. When the sponsor carries our five percent the
 * two differ, and a share of the gross would pay the team out of money that was
 * never the creator's. Basis points because a percentage with a decimal in it
 * ("12.5%") has to survive the trip to the server exactly.
 */

import { spacesPath } from "@/lib/app/paths";
import type { ProductionView } from "@/lib/creator/listing";

/** `manager` sells on the creator's behalf; `rep` turns up and does the thing, and sees no money. */
export type TeamRole = "manager" | "rep";

/** `invited`: a seat nobody has taken yet. `active`: somebody has. Removed seats are never listed. */
export type TeamStatus = "invited" | "active" | "removed";

export interface TeamMember {
  id: string;
  role: TeamRole;
  /** The creator's own name for this person, set when they invited them. */
  label: string;
  status: TeamStatus;
  memberUserId: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  /** Only while the seat is still open. */
  inviteExpiresAt: string | null;
  /**
   * Whose team this is, on a seat read from the MEMBER's side (`/team/seats`,
   * `/team/accept`): the creator's linked X account as the server has it.
   * Absent on the owner's own list, where it would only ever be themselves.
   */
  creatorHandle?: string | null;
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
}

/**
 * An invitation, read from the seat code before anybody signs in.
 *
 * The name comes from the seat, which nobody can forge — 24 random bytes,
 * stored hashed — and never from the rest of the link, which anybody can
 * edit. It does not carry the label: that is the creator's private name for
 * the person, and not for the person to read.
 */
export interface InvitePreview {
  role: TeamRole;
  creatorHandle: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
  expiresAt: string | null;
}

/**
 * What the seat preview answered: who made it, or that it is gone or ran out,
 * or nothing at all because the server did not answer in time.
 */
export type SeatLookup =
  | { kind: "found"; invite: InvitePreview }
  | { kind: "refused"; code: string }
  | { kind: "unreachable" };

/** "Alex Creator (@alex)", "@alex", or null when the creator has no X account linked. */
export function creatorText(c: { creatorHandle?: string | null; creatorName?: string | null }): string | null {
  const handle = c.creatorHandle ? `@${c.creatorHandle}` : null;
  if (c.creatorName && handle) return `${c.creatorName} (${handle})`;
  return c.creatorName || handle;
}

/**
 * What `POST /team` answers, once.
 *
 * `code` is stored hashed on the server, so this is the only time anybody can
 * read it. `url` is the creator's own HOLD invite link carrying `?seat=<code>`.
 */
export interface Invitation {
  member: TeamMember;
  code: string;
  url: string;
  /**
   * Whether the invitation email actually went, when an address was given. It
   * can be false with the link still good: a daily cap, an address that looks
   * like junk, or the limiter being down.
   */
  emailed?: boolean;
}

export interface Assignment {
  id: string;
  memberId: string;
  shareBps: number;
  note: string | null;
  label: string;
  role: TeamRole;
  memberUserId: string | null;
  status: TeamStatus;
}

/**
 * One sale's worth of one member's share, with the names it is read by.
 *
 * `amountUsdc` is a USDC string with up to six decimals ("12.345678"), the
 * server's own printing of the stored amount. `memberLabel` is read from the
 * seat even after it was removed, so somebody taken off the team and still
 * owed keeps their name. `creatorHandle` is the X account the listing was
 * published under.
 */
export interface Earning {
  id: string;
  orderId: string;
  spaceId: string;
  listingTitle: string | null;
  memberId: string;
  memberLabel: string | null;
  creatorHandle: string | null;
  amountUsdc: string;
  shareBps: number;
  chain: string;
  status: "owed" | "paid" | "void";
  paidTx: string | null;
  paidAt: string | null;
  paidNote: string | null;
  createdAt: string;
}

/**
 * What somebody on a team has to deliver, on one listing they were put on.
 *
 * There is no money in it, and not because it is hidden here: the server
 * never selects a price, an amount or an offer for this view.
 */
export interface WorkListing {
  spaceId: string;
  role: TeamRole;
  title: string;
  slug: string | null;
  status: string;
  eventName: string | null;
  eventStartsOn: string | null;
  eventEndsOn: string | null;
  deliverBy: string | null;
  closesAt: string | null;
  slots: WorkSlot[];
  deliverables: WorkDeliverable[];
}

export interface WorkSlot {
  id: string;
  spaceId: string;
  label: string | null;
  zoneKey: string | null;
  sponsorName: string | null;
  contentStatus: string | null;
  deliveredUrl: string | null;
  deliveredAt: string | null;
  /** A sold content production spot: its brief, due time and private delivery. */
  production?: ProductionView | null;
}

export interface WorkDeliverable {
  id: string;
  spaceId: string;
  kind: string;
  platform: string | null;
  count: number;
  note: string | null;
  dueDate: string | null;
  deliveredUrl: string | null;
  deliveredAt: string | null;
}

/** The server's limits. Mirrored, never the authority: it checks all of them again. */
export const TEAM_LIMITS = {
  /** `TEAM_MAX`: seats that are not removed, pending invitations included. */
  MAX_MEMBERS: 25,
  LABEL_MAX: 64,
  NOTE_MAX: 200,
  PAID_TX_MAX: 100,
  PAID_NOTE_MAX: 200,
  /** How long a seat stays open before its link stops working. */
  INVITE_DAYS: 14,
  SHARE_MIN_BPS: 1,
  SHARE_MAX_BPS: 10_000,
  /** Everything on one listing together. It may reach 100%; it may never pass it. */
  SHARE_TOTAL_MAX_BPS: 10_000,
  /** `earningIds` in one "mark as paid". */
  PAID_BATCH_MAX: 200,
} as const;

/** A seat code as the server issues them: 24 random bytes, base64url. */
export function isSeatCode(v: string | null | undefined): v is string {
  return !!v && /^[A-Za-z0-9_-]{16,128}$/.test(v);
}


/* ── Shares ───────────────────────────────────────────────────────── */

/** "12.5%" for 1,250 basis points, the way `shareText` on the server prints it. */
export function shareText(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/**
 * A percentage as typed, in basis points. Null when it is not a percentage.
 *
 * Two decimals at most, because a basis point is a hundredth of a percent and
 * anything finer would be rounded by somebody other than the person typing it.
 */
export function bpsFromPercent(typed: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{0,2}))?$/.exec(typed.trim().replace(/%$/, "").trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

/** Basis points back into the box, without trailing zeros. */
export function percentFromBps(bps: number): string {
  return shareText(bps).replace(/%$/, "");
}

/**
 * What is left of 100% on a listing once everybody but `except` has theirs.
 *
 * `except` is the member being edited: changing somebody's share is measured
 * against everybody ELSE, exactly as the server measures it, or raising one
 * person from 20% to 30% would be refused for counting their own 20% twice.
 */
export function roomLeftBps(assignments: readonly Pick<Assignment, "memberId" | "shareBps">[], except?: string): number {
  const taken = assignments.filter((a) => a.memberId !== except).reduce((n, a) => n + a.shareBps, 0);
  return Math.max(0, TEAM_LIMITS.SHARE_TOTAL_MAX_BPS - taken);
}

/** Why a share cannot be given, in the server's own code, or null when it can. */
export function shareProblem(
  bps: number | null,
  assignments: readonly Pick<Assignment, "memberId" | "shareBps">[],
  memberId?: string,
): "share_out_of_range" | "shares_over_a_hundred" | null {
  if (bps === null || !Number.isInteger(bps) || bps < TEAM_LIMITS.SHARE_MIN_BPS || bps > TEAM_LIMITS.SHARE_MAX_BPS) {
    return "share_out_of_range";
  }
  return bps > roomLeftBps(assignments, memberId) ? "shares_over_a_hundred" : null;
}

/* ── Money ────────────────────────────────────────────────────────── */

/**
 * A USDC string as a bigint of base units, so totals are added exactly; zero
 * for anything unreadable rather than a crash.
 */
export function baseOf(usdc: string | null | undefined): bigint {
  const m = /^(\d+)(?:\.(\d{0,6}))?$/.exec((usdc ?? "").trim());
  if (!m) return 0n;
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
}

/**
 * Base units as dollars a person reads: "$1,234.50", or "$12.345678" when a
 * share left fractions of a cent. Those are kept rather than rounded, because
 * this is the figure a creator copies into their wallet to pay somebody, and a
 * screen that rounds it has them a fraction off every time. Never floating
 * point on the way.
 */
export function usdcText(base: bigint): string {
  const whole = base / 1_000_000n;
  const frac = (base % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `$${whole.toLocaleString("en-US")}.${frac.length < 2 ? frac.padEnd(2, "0") : frac}`;
}

export interface OwedGroup {
  memberId: string;
  /** Owed and not yet marked paid. */
  owed: Earning[];
  paid: Earning[];
  owedBase: bigint;
  paidBase: bigint;
}

/**
 * Earnings, one group per person, whoever is owed most first.
 *
 * Grouped by the SEAT (`memberId`), not by the account behind it: a seat is
 * who the creator named and put on a listing, and the same person on two
 * creators' teams is two debts from two different people.
 */
export function groupByMember(rows: readonly Earning[]): OwedGroup[] {
  const groups = new Map<string, OwedGroup>();
  for (const r of rows) {
    if (r.status === "void") continue;
    const g = groups.get(r.memberId) ?? { memberId: r.memberId, owed: [], paid: [], owedBase: 0n, paidBase: 0n };
    const amount = baseOf(r.amountUsdc);
    if (r.status === "owed") {
      g.owed.push(r);
      g.owedBase += amount;
    } else {
      g.paid.push(r);
      g.paidBase += amount;
    }
    groups.set(r.memberId, g);
  }
  return [...groups.values()].sort((a, b) => (b.owedBase > a.owedBase ? 1 : b.owedBase < a.owedBase ? -1 : 0));
}

/** What a chain is called to somebody who has never heard the word "chain". */
export function chainName(chain: string): string {
  switch (chain) {
    case "solana":
      return "Solana";
    case "base":
      return "Base";
    case "polygon":
      return "Polygon";
    default:
      return chain;
  }
}

/** "3 May 2026" — a day, not an instant. */
export function dayText(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ── An invitation waiting for a sign-in ──────────────────────────── */

/*
 * WHY THE SEAT IS WRITTEN DOWN IN THE BROWSER
 *
 * Signing in by typing the six digits keeps the invitee on /creator/team with
 * the seat still in the address bar. Signing in by clicking the link in the
 * email does not: that link lands on /creator, in whatever tab the mail app
 * opens, and the seat would be lost between the two. So the seat is kept in
 * this browser until it is accepted or turned down, and /creator offers it back.
 *
 * It is the code a creator chose to send this person, kept on this person's
 * own device for at most the fourteen days the server would honour it anyway.
 * Storage that throws (a private window, blocked site data) costs the reminder,
 * never the page.
 */

const SEAT_KEY = "hold-creator-seat";

export interface PendingSeat {
  seat: string;
  at: number;
}

export function rememberSeat(seat: string): void {
  try {
    window.localStorage.setItem(SEAT_KEY, JSON.stringify({ seat, at: Date.now() } satisfies PendingSeat));
  } catch {
    /* the reminder is a convenience */
  }
}

export function pendingSeat(): PendingSeat | null {
  try {
    const raw = window.localStorage.getItem(SEAT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingSeat>;
    const fresh = typeof v.at === "number" && Date.now() - v.at < TEAM_LIMITS.INVITE_DAYS * 86_400_000;
    if (!isSeatCode(v.seat) || !fresh) {
      window.localStorage.removeItem(SEAT_KEY);
      return null;
    }
    return { seat: v.seat, at: v.at as number };
  } catch {
    return null;
  }
}

export function forgetSeat(): void {
  try {
    window.localStorage.removeItem(SEAT_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** Where a pending seat is opened. The seat alone says whose it is. */
export function seatHref(seat: string): string {
  return spacesPath(`/team?${new URLSearchParams({ seat }).toString()}`);
}
