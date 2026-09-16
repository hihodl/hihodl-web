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
