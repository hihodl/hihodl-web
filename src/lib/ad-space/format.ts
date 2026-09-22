/**
 * Display helpers for Ad Space.
 *
 * Every figure the page shows comes from the server. These turn it into words
 * and never compute a price: cents are rendered as dollars, USDC strings are
 * printed as they arrive.
 */

import type {
  Chain,
  ContactKind,
  ContentKind,
  Deliverable,
  DeliverableState,
  Fallback,
  Position,
  PositionOffers,
  PositionStatus,
  SessionState,
  Space,
  SpaceCard,
  SpaceTab,
  TrackRecord,
  VerifiedType,
} from "./types";

export const CHAIN_LABEL: Record<Chain, string> = {
  solana: "Solana",
  base: "Base",
  polygon: "Polygon",
};

/**
 * The networks this page may offer for a space: where the creator can be paid
 * right now. The server says so in `payableChains`; an older server only sends
 * `payTo`, whose families narrow `chains` the same way.
 */
export function payChainsOf(space: Pick<Space, "chains" | "payTo" | "payableChains">): Chain[] {
  const payable = space.payableChains;
  const payTo = space.payTo;
  const narrowed = payable
    ? space.chains.filter((c) => payable.includes(c))
    : payTo
      ? space.chains.filter((c) => Boolean(c === "solana" ? payTo.solana : payTo.evm))
      : space.chains;
  // Never an empty picker: with nothing payable the checkout's own refusal
  // (`chain_unavailable`) says why, which is better than a sheet with no network.
  return narrowed.length > 0 ? narrowed : space.chains;
}

/** The networks a space is paid on, in words: "Solana", "Solana and Base". */
export function payChainsText(space: Pick<Space, "chains" | "payTo" | "payableChains">): string {
  const names = payChainsOf(space).map((c) => CHAIN_LABEL[c]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

/**
 * A USDC amount as the server writes it ("525.00", "131.250000") in dollars,
 * the way the checkout shows money: "$525", "$131.25". Cents only when the
 * amount is not whole. Anything that is not an amount is printed as it came.
 */
export function usdFromUsdc(usdc: string | null | undefined): string {
  const raw = (usdc ?? "").trim().replace(/,/g, "");
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(raw);
  if (!m) return usdc ? `${usdc} USDC` : "";
  const frac = (m[2] ?? "").padEnd(2, "0");
  const up = frac.length > 2 && /[1-9]/.test(frac.slice(2)) ? 1 : 0;
  return usdFromCents(Number(m[1]) * 100 + Number(frac.slice(0, 2)) + up);
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

/**
 * The zone name if this runtime's `Intl` knows it, else null. A missing, empty
 * or unknown zone never throws out of a render: the caller falls back.
 */
export function knownTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * An instant as a wall clock in one zone: "Wed 7 Oct, 10:00 GMT+8". With no
 * zone it is the reader's own clock. Null for a date that doesn't parse or a
 * zone this runtime refuses.
 */
export function instantIn(iso: string, timeZone?: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return null;
  }
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
  // One brand bought the whole listing, so this square was never sold and is
  // not for sale. Saying "Sold" would credit it with money it never took.
  closed: "Taken",
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

/** The same three states, for a session: a buyer books, nobody "sponsors". */
export const SESSION_STATUS_LABEL: Record<PositionStatus, string> = {
  open: "Available",
  held: "Being booked",
  sold: "Booked",
  closed: "Taken",
};

/**
 * A space that sells a creator's time in person (hispace-in-the-room-v0.md).
 * Everything that says "sponsor" on a content space says "book" on one of these.
 */
export function isSessionSpace(space: { template: Pick<Space["template"], "service"> }): boolean {
  return space.template.service?.format === "session";
}

/** A content production space: a package made for the brand, delivered privately. */
export function isProductionSpace(space: { template: Pick<Space["template"], "service"> }): boolean {
  return space.template.service?.format === "production";
}

/**
 * "3 delivered, none missed", and " · 1 disputed" only when there is one.
 * "First HiSpace" when there is nothing to count yet.
 */
export function trackRecordText(record: TrackRecord): string {
  const { delivered, missed } = record;
  const disputed = Math.max(0, record.disputed ?? 0);
  if (delivered + missed + disputed === 0) return "First HiSpace";
  const base = `${delivered} delivered${missed ? `, ${missed} missed` : ", none missed"}`;
  return disputed > 0 ? `${base} · ${disputed} disputed` : base;
}

const USAGE_SCOPE: Record<string, string> = { organic: "organic social only", organic_and_paid: "organic and paid ads" };
const USAGE_TERM: Record<string, string> = { "6m": "6 months", "12m": "12 months" };

/** A production spot's rights: "Use it on organic and paid ads, for 12 months." */
export function usageText(pkg: { usage: { scope: string; term: string } }): string {
  const scope = USAGE_SCOPE[pkg.usage.scope] ?? pkg.usage.scope;
  const term = pkg.usage.term === "perpetual" ? "with no end date" : `for ${USAGE_TERM[pkg.usage.term] ?? pkg.usage.term}`;
  return `Use it on ${scope}, ${term}.`;
}

/**
 * "Delivered on time: 7 of 8", from content production spots brands accepted.
 * Null when there are none to count, so the page says nothing rather than 0 of 0.
 */
export function onTimeText(record: TrackRecord): string | null {
  const p = record.production;
  if (!p || p.accepted <= 0) return null;
  return `Delivered on time: ${Math.min(p.onTime, p.accepted)} of ${p.accepted}`;
}

/** Whether a track record has anything a buyer should look at twice. */
export function trackRecordNeedsAttention(record: TrackRecord): boolean {
  return record.missed > 0 || (record.disputed ?? 0) > 0;
}

/**
 * The fallback policy for a session, from the app's `sessionFallbackHint`.
 * `content_anyway` is refused for sessions (`fallback_not_for_sessions`), so it
 * only appears here if the server sends something it should not, and then it
 * promises nothing — the app has no line for that case either.
 */
export const SESSION_FALLBACK_TEXT: Record<Fallback, string> = {
  creator_refund:
    "If the session can't happen, the creator sends the price back from their own wallet. It's their promise: HOLD never holds the money.",
  next_event: "If the session can't happen, it moves to another event within 90 days.",
  content_anyway: "If the session can't happen, talk to the creator: HOLD can't refund a booking.",
};

/** The fallback policy for a content production spot: nothing gets filmed without the event. */
export const PRODUCTION_FALLBACK_TEXT: Record<Fallback, string> = {
  creator_refund:
    "If the event doesn't happen, the creator sends the price back from their own wallet. It's their promise: HOLD never holds the money.",
  next_event: "If the event doesn't happen, your spot moves to another event within 90 days.",
  content_anyway: "If the event doesn't happen, talk to the creator: HOLD can't refund a spot.",
};

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  x: "X",
  telegram: "Telegram",
  email: "Email",
};

/** Where a booked session stands, from the buyer's side. */
export const SESSION_STATE_LABEL: Record<SessionState, string> = {
  awaiting_contact: "Send your contact",
  awaiting_schedule: "Waiting for a time",
  scheduled: "Scheduled",
  awaiting_confirmation: "Did it happen?",
  delivered: "Delivered",
  disputed: "You said it didn't happen",
};

/** The limits the contract sets on what a buyer types. */
export const SESSION_TEXT_MAX = 280;

/**
 * The name of the policy the creator picked, exactly as the app writes it
 * (`fallbackLabel`). It is the creator's own answer to the question, so it is
 * left in their voice: "I refund the price" is a promise somebody signed, which
 * is the whole point of showing it on a page a brand reads before paying.
 */
export const FALLBACK_LABEL: Record<Fallback, string> = {
  content_anyway: "Content anyway",
  creator_refund: "I refund the price",
  next_event: "Moves to the next event",
};

/**
 * The fallback policy in plain words, from the app's `fallbackHint` so the two
 * products cannot promise different things — the 90 days on `next_event` is the
 * contract's, not a rounding of "their next event".
 *
 * One thing is not carried across verbatim: the app says "you send the price
 * back from your own wallet" because in the app the reader is the creator. Here
 * the reader is the brand about to pay, and telling them THEY send the money
 * back would be the opposite of what happens, so the same sentence is said
 * about the creator. HOLD is never the party that refunds, and neither copy
 * suggests it is.
 */
export const FALLBACK_TEXT: Record<Fallback, string> = {
  content_anyway: "If the venue says no, every post and video is still delivered as promised.",
  creator_refund: "If the venue says no, the creator sends the price back from their own wallet.",
  next_event: "If the venue says no, the spot moves to another event within 90 days.",
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
  public_place: "meet only at the venue or in a public place, never at a private address",
  no_investment_advice: "give no investment advice",
  no_investor_intros: "make no introductions to investors",
};

export function attestationText(key: string): string {
  return ATTESTATION_TEXT[key] ?? key.replace(/_/g, " ");
}

function platformName(platform: string): string {
  const p = platform.trim();
  return p.toLowerCase() === "x" ? "X" : p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * One deliverable in words, as the brand reads it:
 *   video, x, 2              "2 videos on X"
 *   mention, x, 1            "Mentions your brand on X"
 *   mention, x, 3            "Mentions your brand on X, 3 times"
 *   custom, null, 1, "…"     the creator's note as written
 */
export function deliverableText(d: Pick<Deliverable, "kind" | "platform" | "count" | "note">): string {
  const times = d.count > 1 ? `, ${d.count} times` : "";
  const where = d.platform?.trim() ? ` on ${platformName(d.platform)}` : "";
  if (d.kind === "mention") return `Mentions your brand${where}${times}`;
  if (d.kind === "custom") {
    const note = d.note?.trim();
    return `${note || "Something extra from the creator"}${where}${times}`;
  }
  const noun = d.kind.replace(/_/g, " ");
  const plural = d.count === 1 ? noun : noun.endsWith("s") ? noun : `${noun}s`;
  return `${d.count} ${plural}${where}`;
}

/**
 * The creator's note under a deliverable, when it adds something. On a
 * `custom` one the note already is the line, so it is never repeated.
 */
export function deliverableNote(d: Pick<Deliverable, "kind" | "note">): string | null {
  if (d.kind === "custom") return null;
  return d.note?.trim() || null;
}

/**
 * What a space sells, by name. A `custom-service` space is named by its creator;
 * everything else by its template ("Carry-on suitcase", "Booth appearance").
 */
export function serviceName(space: Pick<Space, "template" | "serviceName">): string {
  const own = space.serviceName?.trim();
  return space.template.kind === "service" && own ? own : space.template.name;
}

/** The service's description, the creator's own on a `custom-service` space. */
export function serviceSummary(space: Pick<Space, "template" | "serviceSummary">): string | null {
  const own = space.serviceSummary?.trim();
  if (space.template.kind === "service" && own) return own;
  return space.template.service?.summary ?? null;
}

/* ── Tiers: a ladder, not N of one thing (ad-space-tiers-v0.md) ──────── */

/**
 * One rung of a ladder, as the page shows it: a price, a name, what the brand
 * gets for it, and how many are left.
 *
 * A tier is not a row of its own in the API — it IS the positions that sell it,
 * all sharing a `tierKey` — so everything a rung needs is read off its copies
 * and nothing is computed twice. A tier with five available is five positions,
 * and they are one card saying "5 left", never five cards.
 */
export interface SpaceTier {
  key: string;
  /** The rung's name. Falls back to a copy's label, which the server already fills from the title. */
  title: string;
  /** What the brand gets, one plain-text line each. Printed as text, never as markup. */
  perks: string[];
  /** Every copy of this rung, in the creator's order. */
  positions: Position[];
  /** The copies a brand can still buy. */
  open: Position[];
  held: number;
  sold: number;
  /** What a click buys, offers on or bids for: the first copy still open, else null. */
  buy: Position | null;
  /** The rung's figures, from the copy on offer: every copy of a tier is priced alike. */
  priceCents: number | null;
  sponsorPaysUsdc: string | null;
  creatorReceivesUsdc: string | null;
  /** How offers or bids stand on the copy on offer, or null when the space takes none. */
  offers: PositionOffers | null;
  /** The rung's own pitch, when a creator wrote one. */
  pitch: string | null;
}

/**
 * A space that sells a ladder. Only a service can: a placement's zones are
 * priced by the size of a rectangle, and mixing a drawing and a service in one
 * space is not in v0. So a placement is never read as tiered, and its zones
 * keep rendering exactly as they do today.
 *
 * It is also where offers live: on a tiered space they sit on the positions,
 * like a placement's, because "$900" means nothing unless it says $900 for the
 * interview.
 */
export function isTieredSpace(space: Pick<Space, "kind" | "positions">): boolean {
  return space.kind === "service" && space.positions.some((p) => Boolean(p.tierKey));
}

/**
 * The ladder, in the creator's order — which is the order the API sends the
 * positions in, and the order the creator built it in, so it is kept as it
 * arrives rather than sorted by price.
 *
 * Empty on every space that is not tiered, so a caller that renders nothing for
 * an empty ladder is a caller that has not changed.
 */
export function spaceTiers(space: Pick<Space, "kind" | "positions">): SpaceTier[] {
  if (!isTieredSpace(space)) return [];
  const order: string[] = [];
  const copies = new Map<string, Position[]>();
  for (const p of space.positions) {
    if (!p.tierKey) continue;
    const seen = copies.get(p.tierKey);
    if (seen) seen.push(p);
    else {
      copies.set(p.tierKey, [p]);
      order.push(p.tierKey);
    }
  }
  return order.map((key) => {
    const all = copies.get(key)!;
    const open = all.filter((p) => p.status === "open");
    // The copy on offer carries the figures a sponsor would pay. With none open
    // the first copy still holds the price, so a sold-out rung can say what it
    // went for instead of showing a blank where its price was.
    const shown = open[0] ?? all[0];
    return {
      key,
      title: all.find((p) => p.title)?.title ?? all[0].label,
      perks: all.find((p) => p.perks && p.perks.length > 0)?.perks ?? [],
      positions: all,
      open,
      held: all.filter((p) => p.status === "held").length,
      sold: all.filter((p) => p.status === "sold").length,
      buy: open[0] ?? null,
      priceCents: shown.priceCents,
      sponsorPaysUsdc: shown.sponsorPaysUsdc,
      creatorReceivesUsdc: shown.creatorReceivesUsdc,
      offers: shown.offers ?? null,
      pitch: all.find((p) => p.pitch)?.pitch ?? null,
    };
  });
}

/**
 * The cheapest thing a brand can actually buy right now, for the "Spots start
 * at $50" line the whole ladder is written around. Null when nothing is left to
 * buy, or when the rungs carry no prices at all (a space sold by offers).
 */
export function tiersStartAtCents(tiers: SpaceTier[]): number | null {
  let least: number | null = null;
  for (const t of tiers) {
    if (!t.buy || t.priceCents === null) continue;
    if (least === null || t.priceCents < least) least = t.priceCents;
  }
  return least;
}

/** The same name for a board or event card, which carries it flat. */
export function cardServiceName(card: Pick<SpaceCard, "templateName" | "serviceName">): string | null {
  return card.serviceName?.trim() || card.templateName;
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

/** What a sponsor can still get on a tab: open spots on live spaces only. */
export function openSpots(cards: SpaceCard[]): number {
  return cards.reduce((sum, c) => sum + (c.status === "live" ? Math.max(0, c.totals.open) : 0), 0);
}

/* ── A creator's hub ─────────────────────────────────────────────────── */

/**
 * What a creator has on sale, in one line under their name: "9 spaces · 34
 * spots open · 3 events". Events are left out when everything they sell is tied
 * to none, rather than printed as a zero a sponsor has to interpret.
 */
export function creatorTotalsText(totals: { spaces: number; openSpots: number; events: number }): string {
  const parts = [
    `${totals.spaces} ${totals.spaces === 1 ? "space" : "spaces"}`,
    `${totals.openSpots} ${totals.openSpots === 1 ? "spot" : "spots"} open`,
  ];
  if (totals.events > 0) parts.push(`${totals.events} ${totals.events === 1 ? "event" : "events"}`);
  return parts.join(" · ");
}

/**
 * The way out of a creator's hub and into the event's own page, which is how a
 * brand this creator did not win still finds one that fits — and how the event
 * page finds its next reader.
 *
 * With nobody else listed there it names no number. "0 other creators are
 * going" is both true and useless, and a link that invents a crowd is worse
 * than one that simply opens the event.
 */
export function otherCreatorsLine(othersAtEvent: number, eventName: string): string {
  if (othersAtEvent <= 0) return `See everything on sale at ${eventName}`;
  if (othersAtEvent === 1) return `1 more creator is going to ${eventName}`;
  return `${othersAtEvent} more creators are going to ${eventName}`;
}

/** The event page's tabs, in the order they are shown. */
export const EVENT_TABS: readonly SpaceTab[] = ["ground", "feed", "room"];

/**
 * The tab an event page opens on when the API does not say. More open spots on
 * live spaces wins; on a tie, a tab with something on it beats an empty one, and
 * after that the earlier tab (ground, feed, room) wins.
 */
export function defaultEventTab(tabs: Record<SpaceTab, SpaceCard[]>): SpaceTab {
  let best: SpaceTab = "ground";
  for (const tab of EVENT_TABS) {
    const open = openSpots(tabs[tab]);
    const bestOpen = openSpots(tabs[best]);
    if (open > bestOpen || (open === bestOpen && tabs[best].length === 0 && tabs[tab].length > 0)) best = tab;
  }
  return best;
}

/**
 * How many spots a sponsor can still get on a space. An open spot counts; on a
 * takeover board so does a sold spot whose ladder has not stopped, because it
 * can be bought from the sponsor holding it.
 */
export function takeableSpots(space: Pick<Space, "pricingMode" | "positions">): number {
  const isTakeover = space.pricingMode === "takeover";
  return space.positions.filter(
    (p) =>
      p.status === "open" ||
      (isTakeover && p.status === "sold" && !!p.takeover && !p.takeover.closed && !!p.takeover.nextPriceUsdc),
  ).length;
}

/**
 * "Sold out" only when it is true. On a fixed-price board that is every spot
 * sold; on a takeover board it is nothing left to take, since a sold spot there
 * is still for sale.
 */
export function spaceSoldOut(space: Pick<Space, "pricingMode" | "positions" | "totals">): boolean {
  const { totals } = space;
  if (totals.positions === 0) return false;
  // A spot being paid for right now is not settled either way: it may lapse.
  if (totals.sold < totals.positions) return false;
  return space.pricingMode === "takeover" ? takeableSpots(space) === 0 : true;
}

/**
 * One line on how a space is doing, for a link card or a meta description:
 * "3 of 8 spots sold", "Sold out: all 8 spots taken", and on a takeover board
 * "5 of 8 spots still up for grabs" or "Every spot settled: all 8 taken".
 */
export function spaceProgressText(
  space: Pick<Space, "pricingMode" | "positions" | "totals" | "kind" | "template">,
): string {
  const { totals } = space;
  if (isSessionSpace(space) && space.pricingMode !== "takeover") {
    return spaceSoldOut(space)
      ? `Fully booked: all ${totals.positions} sessions taken`
      : `${totals.sold} of ${totals.positions} sessions booked`;
  }
  const noun = space.kind === "service" ? "slots" : "spots";
  const soldOut = spaceSoldOut(space);
  if (space.pricingMode === "takeover") {
    return soldOut
      ? `Every ${noun.slice(0, -1)} settled: all ${totals.positions} taken`
      : `${takeableSpots(space)} of ${totals.positions} ${noun} still up for grabs`;
  }
  return soldOut ? `Sold out: all ${totals.positions} ${noun} taken` : `${totals.sold} of ${totals.positions} ${noun} sold`;
}

/**
 * A campaign measured against the goal it named: "$1,900 of $2,400 · 79%".
 *
 * Spots sold out of spots listed is the creator's arithmetic. What a campaign is
 * FOR is money, so a space that named a goal is counted in money — in the figure
 * and in the bar — and says the percentage out loud, which is how every board of
 * this kind is read. The app counts it the same way (`ProgressCard`).
 *
 * Null when no goal was named, and the caller then counts spots exactly as it
 * did before goals existed. Past 100% only `fill` stops, at full: beating the
 * goal is the good ending, so the number itself keeps climbing.
 */
export function fundingProgress(
  space: Pick<Space, "fundingGoalCents" | "totals">,
): { raised: string; goal: string; percent: number; fill: number } | null {
  const goal = space.fundingGoalCents;
  if (!goal || goal <= 0) return null;
  const raised = Math.max(0, space.totals.committedCents);
  return {
    raised: usdFromCents(raised),
    goal: usdFromCents(goal),
    percent: Math.round((raised / goal) * 100),
    fill: Math.min(100, (raised / goal) * 100),
  };
}

/* ── Offers and bids (hispace-offers-v0.md) ──────────────────────────────── */

/** "2d", "5h", "40m": coarse on purpose, for chips and link cards. */
function coarseLeft(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** "Bidding · 2d left", "Bidding ended", or "Bidding" when no end is known. */
export function biddingChipText(biddingEndsAt: string | null | undefined, now = Date.now()): string {
  if (!biddingEndsAt) return "Bidding";
  const left = Date.parse(biddingEndsAt) - now;
  if (!Number.isFinite(left)) return "Bidding";
  return left > 0 ? `Bidding · ${coarseLeft(left)} left` : "Bidding ended";
}

/**
 * How a space sells, as a chip on an event card: "Accepts offers", "Make an
 * offer", "Bidding · 2d left", "Open bidding" for a takeover board, or null for
 * a plain fixed price.
 */
export function pricingChipText(
  card: { pricingMode: string; acceptsOffers?: boolean; biddingEndsAt?: string | null },
  now = Date.now(),
): string | null {
  switch (card.pricingMode) {
    case "takeover":
      return "Open bidding";
    case "offers":
      return "Make an offer";
    case "bids":
      return biddingChipText(card.biddingEndsAt, now);
    default:
      return card.acceptsOffers ? "Accepts offers" : null;
  }
}

/**
 * "420.00" to 42000, only to compare two server amounts. The server writes up to
 * six decimals ("441.525"); past the cent it rounds up, never down.
 */
function centsOf(usdc: string | null | undefined): number | null {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec((usdc ?? "").replace(/,/g, ""));
  if (!m) return null;
  const f = (m[2] ?? "").padEnd(2, "0");
  return Number(m[1]) * 100 + Number(f.slice(0, 2)) + (f.length > 2 && /[1-9]/.test(f.slice(2)) ? 1 : 0);
}

/**
 * The bids line of a link card: the highest bid among spots still open for
 * bidding with that spot's own time left, or else where bidding opens and the
 * soonest end still ahead. "Highest bid $420 · 2d left", "Bidding opens at $100
 * · 2d left", "Bidding ended". Null when nothing on the space is up for bids.
 *
 * Which spot bids is read off the SPOTS, never off the board. A service ladder
 * sells its rungs however each rung says: the Breakpoint listing is a $50 logo
 * strip and a $200 mid-tier at a fixed price, with the flagship interview going
 * to the highest bid. That board's `pricingMode` is `fixed`, and reading it
 * alone left the one rung anybody would bid on unmentioned on the link card.
 */
export function bidsSummaryText(space: Pick<Space, "pricingMode" | "positions" | "biddingEndsAt">, now = Date.now()): string | null {
  let anyBids = false;
  let highest: { cents: number; usdc: string } | null = null;
  let opening: { cents: number; usdc: string } | null = null;
  let soonest: number | null = null;
  let highestEnds: number | null = null;
  for (const p of space.positions) {
    const o = p.offers;
    if (!o || o.mode !== "bids") continue;
    // Counted before the sold check: a rung that bid and has since been won
    // still means this space had bidding, and "Bidding ended" is the honest
    // line for it — the same thing a fully sold bids board already said.
    anyBids = true;
    if (p.status === "sold") continue;
    const h = centsOf(o.highestBidUsdc);
    const endAt = o.biddingEndsAt ? Date.parse(o.biddingEndsAt) : NaN;
    const stillOpen = o.biddingOpen !== false && Number.isFinite(endAt) && endAt > now;
    // The highest bid is paired with its OWN spot's end, never another spot's.
    if (h !== null && o.highestBidUsdc && stillOpen && (!highest || h > highest.cents)) {
      highest = { cents: h, usdc: o.highestBidUsdc };
      highestEnds = endAt;
    }
    const op = centsOf(o.openingBidUsdc);
    if (op !== null && o.openingBidUsdc && (!opening || op < opening.cents)) opening = { cents: op, usdc: o.openingBidUsdc };
    const end = o.biddingEndsAt ? Date.parse(o.biddingEndsAt) : NaN;
    if (Number.isFinite(end) && end > now && (soonest === null || end < soonest)) soonest = end;
  }
  // A board that bids, whose spots have not each been given their own clock
  // yet, still counts as bidding: the space's own end is the one they share.
  if (space.pricingMode === "bids") anyBids = true;
  if (!anyBids) return null;
  if (soonest === null && space.biddingEndsAt) {
    const end = Date.parse(space.biddingEndsAt);
    if (Number.isFinite(end) && end > now) soonest = end;
  }
  if (highest && highestEnds !== null) return `Highest bid ${usdFromCents(highest.cents)} · ${coarseLeft(highestEnds - now)} left`;
  if (soonest === null) return "Bidding ended";
  const left = `${coarseLeft(soonest - now)} left`;
  if (opening) return `Bidding opens at ${usdFromCents(opening.cents)} · ${left}`;
  return `Bidding · ${left}`;
}
