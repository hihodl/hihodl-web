/**
 * Display helpers for Ad Space.
 *
 * Every figure the page shows comes from the server. These turn it into words
 * and never compute a price: cents are rendered as dollars, USDC strings are
 * printed as they arrive.
 */

import type {
  Chain,
  ContentKind,
  DeliverableState,
  Fallback,
  PositionStatus,
  VerifiedType,
} from "./types";

export const CHAIN_LABEL: Record<Chain, string> = {
  solana: "Solana",
  base: "Base",
  polygon: "Polygon",
};

/** Integer cents to "$1,775" (or "$1,775.50" when there are cents). */
export function usdFromCents(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/** "48210" to "48.2K". */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** How long an X account has existed, in the unit a person would say it. */
export function accountAge(createdAt: string | null, now = Date.now()): string | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  const months = Math.floor((now - t) / (1000 * 60 * 60 * 24 * 30.44));
  if (months >= 24) return `${Math.floor(months / 12)} years on X`;
  if (months >= 12) return "1 year on X";
  if (months >= 2) return `${months} months on X`;
  return "New on X";
}

/** "2026-10-04" (a calendar date, no time zone) to "4 Oct 2026". */
export function calendarDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** An instant to "6 Oct 2026, 16:00 UTC". Server-rendered, so UTC is stated. */
export function instantUtc(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

/** "3 days ago", "just now". For the updates feed. */
export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return "";
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "yesterday" : `${d} days ago`;
  return calendarDate(iso);
}

/** Time left as "12d 4h", "3h 20m", "4m 05s". */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "0m";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** "HH:MM" in the reader's own clock. Client side only. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const VERIFIED_LABEL: Record<Exclude<VerifiedType, null>, string> = {
  blue: "Verified (X Premium)",
  business: "Verified business",
  government: "Verified government",
};

export const STATUS_LABEL: Record<PositionStatus, string> = {
  open: "Available",
  held: "Being paid",
  sold: "Sold",
};

export const DELIVERABLE_STATE_LABEL: Record<DeliverableState, string> = {
  upcoming: "Upcoming",
  overdue: "Overdue",
  delivered: "Delivered",
  missed: "Missed",
};

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  logo: "Logo",
  qr: "QR code",
  text: "Text",
  photo: "Photo",
};

/**
 * The fallback policy in plain words. The creator picks one when they publish;
 * HOLD is never the party that refunds, and the copy does not suggest it is.
 */
export const FALLBACK_TEXT: Record<Fallback, string> = {
  content_anyway:
    "If a venue does not let the item in, the creator still delivers every post, photo and video they promised.",
  creator_refund:
    "If a venue does not let the item in, the creator refunds sponsors themselves, from their own wallet.",
  next_event:
    "If a venue does not let the item in, the creator carries every sponsor to their next event instead.",
};

/**
 * How many times a spot has changed hands, in the words a person says out loud.
 * The caller renders nothing at all for a spot still on its first sponsor.
 */
export function handsText(hands: number): string {
  if (hands === 1) return "Changed hands once";
  if (hands === 2) return "Changed hands twice";
  return `Changed hands ${hands} times`;
}

/**
 * How much room the ladder has left AFTER the takeover being described.
 *
 * `handsLeft` from the API counts the takeover on offer as one of them, so the
 * number a sponsor actually cares about is one less: having paid, how many more
 * times can this be taken off me? Reaching zero is the good news on this page —
 * it means the spot is theirs and nobody can outbid them — so it gets said
 * rather than left as silence.
 */
export function handsLeftText(handsLeft: number): string | null {
  const after = handsLeft - 1;
  if (after < 0) return null;
  if (after === 0) return "That is the last time it can change hands, so it would stay with whoever takes it now.";
  if (after === 1) return "After that it could be taken off them once more, and then it is settled for good.";
  return `After that it could be taken off them ${after} more times.`;
}

/**
 * What a takeover does to the price. Two is the only multiple nobody has to
 * think about, so it is a verb; anything else is stated as a factor rather than
 * given a word of its own.
 */
export function takeoverVerb(multiple: number | null): string {
  return multiple === 2 || multiple === null ? "doubles the price" : `multiplies the price by ${multiple}`;
}

/**
 * Why a spot can go no higher, without the server's words for it. An unknown
 * reason still says the only thing a sponsor needs: the ladder has stopped.
 */
const TAKEOVER_CLOSED_TEXT: Record<string, string> = {
  too_many_takeovers:
    "This spot has changed hands as many times as an Ad Space spot is allowed to, so it can go no higher. It stays with the sponsor who has it now.",
  price_ceiling:
    "Doubling this spot again would take it past the most an Ad Space spot can cost, so it can go no higher. It stays with the sponsor who has it now.",
};

export function takeoverClosedText(reason: string): string {
  return TAKEOVER_CLOSED_TEXT[reason] ?? "This spot can go no higher. It stays with the sponsor who has it now.";
}

/** Phrased to follow "The creator declares that they …". */
const ATTESTATION_TEXT: Record<string, string> = {
  owns_item: "own the item",
  venue_rules_checked: "have checked the venue's rules",
  discloses_sponsorship: "will label sponsored content as sponsored",
  temporary_skin_safe_adult: "are an adult and use skin-safe temporary tattoos",
};

export function attestationText(key: string): string {
  return ATTESTATION_TEXT[key] ?? key.replace(/_/g, " ");
}

/** "video" + "x" + 2 to "2 videos on X". */
export function deliverableText(kind: string, platform: string, count: number): string {
  const noun = kind.replace(/_/g, " ");
  const plural = count === 1 ? noun : noun.endsWith("s") ? noun : `${noun}s`;
  const where = platform.toLowerCase() === "x" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1);
  return `${count} ${plural} on ${where}`;
}

/* ── Events ──────────────────────────────────────────────────────────── */

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymd(date: string): [number, number, number] | null {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return y && m && d ? [y, m, d] : null;
}

/**
 * An event's dates as a person writes them: "7 Oct 2026", "7 to 8 Oct 2026",
 * "30 Sep to 2 Oct 2026", "30 Dec 2026 to 2 Jan 2027". Words, not a dash, so
 * the range still reads when a screen reader says it.
 */
export function eventDates(startsOn: string, endsOn: string): string {
  const a = ymd(startsOn);
  const b = ymd(endsOn);
  if (!a || !b) return startsOn;
  const [ay, am, ad] = a;
  const [by, bm, bd] = b;
  if (ay === by && am === bm && ad === bd) return `${ad} ${MONTH[am - 1]} ${ay}`;
  if (ay === by && am === bm) return `${ad} to ${bd} ${MONTH[am - 1]} ${ay}`;
  if (ay === by) return `${ad} ${MONTH[am - 1]} to ${bd} ${MONTH[bm - 1]} ${ay}`;
  return `${ad} ${MONTH[am - 1]} ${ay} to ${bd} ${MONTH[bm - 1]} ${by}`;
}

/** Whole days from today (UTC) to a calendar date; negative once it has passed. */
function daysUntil(date: string, now: number): number {
  const p = ymd(date);
  if (!p) return NaN;
  const t = new Date(now);
  const today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - today) / 86_400_000);
}

export type EventPhase = "upcoming" | "now" | "ended";

/**
 * "in 21 days", "tomorrow", "happening now", "ended". Counted in whole calendar
 * days in UTC: an event's dates carry no time zone, and a day either way at the
 * edges is the honest precision of "in 21 days".
 */
export function eventCountdown(startsOn: string, endsOn: string, now = Date.now()): { phase: EventPhase; text: string } {
  const toStart = daysUntil(startsOn, now);
  const toEnd = daysUntil(endsOn, now);
  if (toEnd < 0) return { phase: "ended", text: "ended" };
  if (toStart <= 0) return { phase: "now", text: "happening now" };
  if (toStart === 1) return { phase: "upcoming", text: "tomorrow" };
  return { phase: "upcoming", text: `in ${toStart} days` };
}

/**
 * A card's closing time, coarse on purpose: a grid of cards ticking every second
 * is noise, and the space's own page has the exact countdown.
 */
export function closesText(closesAt: string, closed: boolean, now = Date.now()): string {
  const left = Date.parse(closesAt) - now;
  if (closed || !Number.isFinite(left) || left <= 0) return "Closed";
  const h = Math.floor(left / 3_600_000);
  if (h >= 48) return `Closes in ${Math.floor(h / 24)} days`;
  if (h >= 1) return `Closes in ${h} h`;
  return "Closes within the hour";
}
