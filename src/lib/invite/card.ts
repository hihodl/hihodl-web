/**
 * The link card a chat app draws for a group's join link
 * (hihodl.xyz/invite/<ref>?group=<code>), as words. The image stays the HOLD
 * banner: nothing a member chose is drawn as a picture.
 *
 * The backend's GET /group-cards/:code says only the group's name, emoji, how
 * many are in it and the plan's own days and place (no person, no photo). A
 * group is made for a plan (21 Oct 2026), so "Thu 23 Oct · Lisbon" is what
 * the people in the chat read first. A code that is not a code, or a group
 * the backend does not answer for, gets no card of its own: the page keeps
 * the site's.
 *
 * Pure: no React, no `@/` imports, so a .check.ts can load it.
 */

export interface GroupPlan {
  startsOn: string | null;
  endsOn: string | null;
  place: string | null;
}

export interface GroupCard {
  name: string;
  emoji: string | null;
  memberCount: number;
  /** The plan the group is for, when it has days or a place. */
  plan: GroupPlan | null;
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
  const { name, emoji, memberCount, plan } = d as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || typeof memberCount !== "number") return null;
  return { name: name.trim(), emoji: typeof emoji === "string" && emoji.trim() ? emoji.trim() : null, memberCount, plan: planOf(plan) };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown): string | null => (typeof v === "string" && DAY.test(v) ? v : null);

/** The card's plan, or null when it says neither a day nor a place. */
function planOf(raw: unknown): GroupPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const place = typeof r.place === "string" && r.place.trim() ? clip(r.place.trim(), 40) : null;
  const startsOn = day(r.startsOn);
  const endsOn = day(r.endsOn);
  if (!startsOn && !endsOn && !place) return null;
  return { startsOn, endsOn, place };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Read as a calendar day (UTC), never shifted by the server's time zone. */
function parts(d: string) {
  const at = new Date(`${d}T00:00:00Z`);
  return { day: at.getUTCDate(), month: MONTHS[at.getUTCMonth()], weekday: WEEKDAYS[at.getUTCDay()] };
}

/** "Thu 23 Oct", "12 to 15 Oct", "30 Oct to 2 Nov"; null with no day. */
export function whenText(plan: Pick<GroupPlan, "startsOn" | "endsOn">): string | null {
  const from = plan.startsOn ?? plan.endsOn;
  const to = plan.startsOn && plan.endsOn && plan.endsOn !== plan.startsOn ? plan.endsOn : null;
  if (!from) return null;
  const a = parts(from);
  if (!to) return `${a.weekday} ${a.day} ${a.month}`;
  const b = parts(to);
  return a.month === b.month ? `${a.day} to ${b.day} ${b.month}` : `${a.day} ${a.month} to ${b.day} ${b.month}`;
}

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

/**
 * "Join 🏝️ Lisbon trip on HOLD" / "12 to 15 Oct · Lisbon. 5 people are going.
 * Join and pay your share from your phone." Without a plan, the group's line.
 */
export function invitePreview(card: GroupCard): InvitePreview {
  const name = clip(card.name, NAME_MAX);
  const title = `Join ${card.emoji ? `${card.emoji} ` : ""}${name} on HOLD`;
  const where = [card.plan ? whenText(card.plan) : null, card.plan?.place ?? null].filter(Boolean).join(" · ");
  if (where) {
    const going = card.memberCount === 1 ? "1 person is going" : `${card.memberCount} people are going`;
    return { title, description: `${where}. ${going}. Join and pay your share from your phone.` };
  }
  const who = card.memberCount === 1 ? "1 person is" : `${card.memberCount} people are`;
  return { title, description: `${who} in this group, splitting costs. Join and pay your share from your phone.` };
}
