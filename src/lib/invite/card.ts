/**
 * The link card a chat app draws for a group's join link
 * (hihodl.xyz/invite/<ref>?group=<code>), as words. The image stays the HOLD
 * banner: nothing a member chose is drawn as a picture.
 *
 * The backend's GET /group-cards/:code says only the group's name, emoji and
 * how many are in it (no person, no photo). A code that is not a code, or a
 * group the backend does not answer for, gets no card of its own: the page
 * keeps the site's.
 *
 * Pure: no React, no `@/` imports, so a .check.ts can load it.
 */

export interface GroupCard {
  name: string;
  emoji: string | null;
  memberCount: number;
}

export interface InvitePreview {
  title: string;
  description: string;
}

const NAME_MAX = 50;

/** The shape the app and the backend give a join code (groups-rules isJoinCode). */
export function isGroupCode(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9]{10,32}$/.test(v);
}

/** The backend's answer, or null for anything that is not one. */
export function groupCardOf(body: unknown): GroupCard | null {
  const d = (body as { data?: unknown } | null)?.data ?? body;
  if (!d || typeof d !== "object") return null;
  const { name, emoji, memberCount } = d as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || typeof memberCount !== "number") return null;
  return { name: name.trim(), emoji: typeof emoji === "string" && emoji.trim() ? emoji.trim() : null, memberCount };
}

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

/** "Join 🏝️ Lisbon trip on HOLD" / "5 people split costs here. Pay your share from your phone." */
export function invitePreview(card: GroupCard): InvitePreview {
  const name = clip(card.name, NAME_MAX);
  const who = card.memberCount === 1 ? "1 person is" : `${card.memberCount} people are`;
  return {
    title: `Join ${card.emoji ? `${card.emoji} ` : ""}${name} on HOLD`,
    description: `${who} in this group, splitting costs. Join and pay your share from your phone.`,
  };
}
