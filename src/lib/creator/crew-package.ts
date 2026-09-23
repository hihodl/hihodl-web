/**
 * A listing sold as a package with other creators: the pure half, with no
 * React and no network, so it can be proved with `sucrase-node`
 * (crew-package.check.ts). The app's src/features/ad-space/crew.ts holds the
 * same rules, and its jest tests prove the same cases.
 *
 * The split is basis points of what the creator side receives on a sale. Each
 * member who is not the lead has at least 1%; the lead keeps whatever the
 * others leave, and is never set directly. 2 to 6 people.
 */

export const PACKAGE_LIMITS = {
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 6,
  MIN_SHARE_BPS: 100,
  NAME_MAX: 64,
} as const;

export interface PackageMember {
  id: string;
  isLead: boolean;
  status: "invited" | "active";
  agreed: boolean;
  hasPayout: boolean;
  shareBps: number;
  handle: string | null;
  name: string | null;
  byLink: boolean;
}

/** Percent typed by a person ("30", "12,5", "12.5%"), to basis points; null when it is not one. */
export function bpsFromPct(text: string): number | null {
  const t = text.replace(",", ".").replace("%", "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Everything the members who are not the lead take, in basis points. */
export function othersBps(members: readonly Pick<PackageMember, "isLead" | "shareBps">[]): number {
  return members.filter((m) => !m.isLead).reduce((n, m) => n + m.shareBps, 0);
}

/**
 * What the lead keeps if one member's share becomes `bps`. `currentBps` is that
 * member's share today (0 for somebody new). Negative means past 100%.
 */
export function leadKeepsBps(others: number, bps: number, currentBps = 0): number {
  return 10_000 - (others - currentBps + bps);
}

/** A share the server will take: at least 1%, and the others together never past 100%. */
export function shareOk(pct: string, others: number, currentBps = 0): number | null {
  const bps = bpsFromPct(pct);
  if (bps === null || bps < PACKAGE_LIMITS.MIN_SHARE_BPS || leadKeepsBps(others, bps, currentBps) < 0) return null;
  return bps;
}

/**
 * The share offered to the next person before anyone types: an even split of
 * the package in whole percent, never more than leaves the lead 1%. Null when
 * there is no room for another 1%.
 */
export function suggestShareBps(members: readonly Pick<PackageMember, "isLead" | "shareBps">[]): number | null {
  const others = othersBps(members);
  const room = 10_000 - others - PACKAGE_LIMITS.MIN_SHARE_BPS;
  if (room < PACKAGE_LIMITS.MIN_SHARE_BPS) return null;
  const even = Math.floor(10_000 / (members.length + 1) / 100) * 100;
  return Math.max(PACKAGE_LIMITS.MIN_SHARE_BPS, Math.min(even, Math.floor(room / 100) * 100));
}

/** How many more people fit. */
export const roomFor = (members: readonly unknown[]) => Math.max(0, PACKAGE_LIMITS.MAX_MEMBERS - members.length);

/** The package's name before the lead types one: the listing's title, cut to fit. */
export function defaultPackageName(title: string | null | undefined): string {
  return (title ?? "").replace(/\s+/g, " ").trim().slice(0, PACKAGE_LIMITS.NAME_MAX).trim();
}

export type Blocker = "invited" | "not_agreed" | "no_payout";

/**
 * Who is holding the package up, and why: an invitation nobody has taken, a
 * member who hasn't said yes to the current split, or a member with nowhere on
 * Solana to be paid. The lead's own payout is the listing's, so it never
 * blocks. One entry per member, the first reason that applies.
 */
export function packageBlockers(members: readonly PackageMember[]): { memberId: string; reason: Blocker }[] {
  const out: { memberId: string; reason: Blocker }[] = [];
  for (const m of members) {
    if (m.status === "invited") out.push({ memberId: m.id, reason: "invited" });
    else if (!m.agreed) out.push({ memberId: m.id, reason: "not_agreed" });
    else if (!m.isLead && !m.hasPayout) out.push({ memberId: m.id, reason: "no_payout" });
  }
  return out;
}

/** The crew a listing is sold as, among the crews this person leads. */
export function crewOfListing<C extends { youAreLead: boolean; spaces: { id: string }[] }>(crews: readonly C[], spaceId: string): C | null {
  return crews.find((c) => c.youAreLead && c.spaces.some((s) => s.id === spaceId)) ?? null;
}
