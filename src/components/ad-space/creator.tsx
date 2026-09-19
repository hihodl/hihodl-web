import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/site/Wordmark";
import { compactNumber, eventDates, eventCountdown, onTimeText, openSpots, trackRecordNeedsAttention, usdFromCents } from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
import type { CreatorGroup, CreatorProfile, EventSummary, SpaceCard } from "@/lib/ad-space/types";

import { BannerFrame, VerifiedTick, eventBanner } from "./events";
import { BENEFITS_GROUND, SpacesGround } from "./ground";

/**
 * A creator's page, `/s/<handle>`, and the screens under it.
 *
 * The one link a creator shares, read by a brand who arrived from their tweet.
 * Its job is to sell THIS creator, so it never points the reader at anybody
 * else: no "more creators at this event", no fee talk, no HOLD pitch. Two
 * levels, so nothing scrolls forever:
 *
 *   /s/<handle>                       who they are, then one banner per event
 *                                     they sell at (and one for "all year")
 *   /s/<handle>/events/<eventSlug>    that event's listings, at most six at once
 *   /s/<handle>/events/all-year       what they sell tied to no event
 *   /s/<handle>/events/past           the events that are over: their record
 *
 * `/events/…` under a handle cannot collide with a listing: a listing lives at
 * `/s/<handle>/<slug>`, one segment, and these are two. `events/` has no page
 * of its own, so a listing slugged `events` still opens at `/s/<handle>/events`
 * (checked against the dev fixture). And the second segment
 * cannot collide with an event either: the backend's `eventSlug` always ends in
 * the year (`token2049-singapore-2026`), which `all-year` and `past` never do.
 *
 * Event banners are the only place the event's photo appears. A listing card
 * shows its own picture (see `SpaceCardGrid`).
 */

export function creatorPath(handle: string): string {
  return `/s/${encodeURIComponent(handle)}`;
}

export const ALL_YEAR = "all-year";
/** The no-event group has no photo of its own; it wears one preset, everywhere. */
const ALL_YEAR_GRADIENT = "ember";
export const PAST = "past";

/** What a screen under the handle shows: one event, the no-event group, or the past. */
export function creatorScreenPath(handle: string, key: string, kind?: Kind | null): string {
  const base = `${creatorPath(handle)}/events/${encodeURIComponent(key)}`;
  return kind ? `${base}?kind=${kind}` : base;
}

function groupKey(group: CreatorGroup): string {
  return group.event ? group.event.slug : ALL_YEAR;
}

/* ── Spaces and services ───────────────────────────────────────────── */

/**
 * "Spaces" are placements (something the creator carries, tab `ground`);
 * "services" are everything else they sell: content (`feed`) and their time in
 * person (`room`). The same split the templates make with `kind`.
 */
export type Kind = "spaces" | "services";

export function cardKind(card: Pick<SpaceCard, "tab">): Kind {
  return card.tab === "ground" ? "spaces" : "services";
}

/** The kinds present in some cards, spaces first. */
export function kindsIn(cards: SpaceCard[]): Kind[] {
  const out: Kind[] = [];
  if (cards.some((c) => cardKind(c) === "spaces")) out.push("spaces");
  if (cards.some((c) => cardKind(c) === "services")) out.push("services");
  return out;
}

/**
 * The kind a screen filters by: the one asked for when there is a choice to
 * make, spaces when nothing was asked, and none at all when the cards are all
 * one kind (then there are no pills and nothing to filter).
 */
export function activeKind(param: string | string[] | undefined, kinds: Kind[]): Kind | null {
  if (kinds.length < 2) return null;
  return param === "services" ? "services" : "spaces";
}

function ofKind(cards: SpaceCard[], kind: Kind | null): SpaceCard[] {
  return kind ? cards.filter((c) => cardKind(c) === kind) : cards;
}

/* ── Which groups are current ──────────────────────────────────────── */

/**
 * The backend's rule (`compareEventGroups` in events-rules.ts): an event is over
 * the day AFTER it ends, in UTC. A sponsor looking on the closing day of
 * TOKEN2049 is still at TOKEN2049.
 */
export function eventIsOver(event: Pick<EventSummary, "endsOn">, now: number): boolean {
  return event.endsOn < new Date(now).toISOString().slice(0, 10);
}

/**
 * The groups on the profile's top level, and the ones behind "Past events".
 * Current: every event not over, with all its cards (a sold-out space at an
 * upcoming event is still part of it), and the no-event group while it has
 * something live. The no-event group is never past. Server order kept.
 */
export function splitGroups(groups: CreatorGroup[], now: number): { current: CreatorGroup[]; past: CreatorGroup[] } {
  const current: CreatorGroup[] = [];
  const past: CreatorGroup[] = [];
  for (const g of groups) {
    if (g.event) (eventIsOver(g.event, now) ? past : current).push(g);
    else if (g.cards.some((c) => c.status === "live")) current.push(g);
  }
  return { current, past };
}

/** The group a screen under the handle names, and whether it is over. */
export function findGroup(
  groups: CreatorGroup[],
  key: string,
  now: number,
): { group: CreatorGroup; over: boolean } | null {
  const lower = key.toLowerCase();
  const { current, past } = splitGroups(groups, now);
  const hit = current.find((g) => groupKey(g) === lower);
  if (hit) return { group: hit, over: false };
  const old = past.find((g) => groupKey(g) === lower);
  return old ? { group: old, over: true } : null;
}

/* ── The page's ground ─────────────────────────────────────────────── */

/**
 * The one place the page background is set, for the profile and every screen
 * under it: the Benefits ground (see ./ground), the same as every Spaces page.
 */
export const PROFILE_GROUND = BENEFITS_GROUND;

export function ProfileGround({ background = PROFILE_GROUND, children }: { background?: string; children: ReactNode }) {
  return <SpacesGround background={background}>{children}</SpacesGround>;
}

/**
 * The bottom of every screen: the HOLD mark and nothing else. `note` is for the
 * one sentence that must stay, "not affiliated with <event>", wherever the page
 * shows an event's name and picture.
 */
export function ProfileFooter({ note }: { note?: string }) {
  return (
    <footer className="container-page mt-auto flex flex-col items-center gap-3 pb-10 pt-16">
      {note && <p className="text-center text-tiny text-sp-ink/80">{note}</p>}
      <Wordmark className="h-4 w-auto text-sp-ink/80" />
    </footer>
  );
}

/* ── The bar at the top ────────────────────────────────────────────── */

const barLink =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[18px] bg-sp-ink/[0.06] px-3.5 text-small text-sp-ink/85 transition-colors duration-180 hover:bg-sp-ink/[0.1] hover:text-sp-ink";

/** "← Demo Creator": the way back up, always top left. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`${barLink} min-w-0 max-w-full`}>
      <span aria-hidden>&larr;</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Top right of the profile, and only when there is a past to show. */
export function PastEventsLink({ href }: { href: string }) {
  return (
    <Link href={href} className={barLink}>
      Past events
    </Link>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="container-page flex min-h-16 w-full flex-wrap items-center justify-between gap-3 pt-4">
      <div className="flex min-w-0 items-center">{left}</div>
      <div className="flex shrink-0 items-center">{right}</div>
    </div>
  );
}

/**
 * Spaces / Services, as a segmented control. Only drawn when a creator sells
 * both. Selecting changes the colour, never the border.
 */
export function KindPills({
  kinds,
  active,
  hrefFor,
  counts,
}: {
  kinds: Kind[];
  active: Kind | null;
  hrefFor: (kind: Kind) => string;
  counts: Record<Kind, number>;
}) {
  if (kinds.length < 2 || !active) return null;
  return (
    <nav aria-label="What they sell" className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[22px] bg-sp-ink/[0.06] p-1">
      {kinds.map((k) => {
        const on = k === active;
        return (
          <Link
            key={k}
            href={hrefFor(k)}
            scroll={false}
            replace
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[18px] px-4 text-small transition-colors duration-180 ${
              on ? "bg-amber text-text-on-amber" : "text-sp-ink/85 hover:text-sp-ink"
            }`}
          >
            {k === "spaces" ? "Spaces" : "Services"}
            <span className={`tabular-nums ${on ? "text-text-on-amber/70" : "text-sp-ink/80"}`}>{counts[k]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function kindCounts(cards: SpaceCard[]): Record<Kind, number> {
  return {
    spaces: cards.filter((c) => cardKind(c) === "spaces").length,
    services: cards.filter((c) => cardKind(c) === "services").length,
  };
}

/* ── Who they are ──────────────────────────────────────────────────── */

/**
 * Name, handle and three big numbers. A sponsor's first question is whether to
 * trust this person with a campaign; the numbers answer it without a sentence.
 */
export function CreatorHero({ creator, openNow }: { creator: CreatorProfile; openNow: number }) {
  const name = creator.xName || `@${creator.xHandle}`;
  const record = creator.trackRecord;
  const flagged = trackRecordNeedsAttention(record);
  const disputed = Math.max(0, record.disputed ?? 0);

  return (
    <section className="container-page pb-8 pt-6 md:pb-12 md:pt-10">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <HeroAvatar creator={creator} />
        <div className="min-w-0">
          <h1 className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 break-words font-display text-[36px] font-light leading-[1.05] text-sp-ink [overflow-wrap:anywhere] md:text-h2">
            <span>{name}</span>
            <VerifiedTick type={creator.xVerifiedType} />
          </h1>
          <a
            href={`https://x.com/${encodeURIComponent(creator.xHandle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-body text-sp-ink/85 transition-colors duration-180 hover:text-sp-amber"
          >
            @{creator.xHandle}
          </a>
        </div>
      </div>

      <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 md:mt-10 md:gap-4">
        {typeof creator.xFollowers === "number" && <Stat value={compactNumber(creator.xFollowers)} label="Followers" />}
        <Stat value={String(openNow)} label={openNow === 1 ? "Spot open" : "Spots open"} />
        <Stat
          value={String(record.delivered)}
          label="Delivered"
          note={flagged ? [record.missed ? `${record.missed} missed` : null, disputed ? `${disputed} disputed` : null].filter(Boolean).join(" · ") : null}
        />
      </div>
      {/* What a brand buys here, as creators learned to sell it: the product gets the look, the reach and the content are the point. */}
      <p className="mt-6 max-w-2xl text-body text-sp-ink/85">
        Every spot comes with {name}&rsquo;s reach and the content they make. The product is what makes people look.
      </p>
      {onTimeText(record) ? (
        <p className="mt-6 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[20px] border border-success/40 bg-success/10 px-4 text-small text-sp-ink">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="text-sp-ok">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {onTimeText(record)}
        </p>
      ) : null}
    </section>
  );
}

function Stat({ value, label, note = null }: { value: string; label: string; note?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-[32px] font-light leading-none tabular-nums text-sp-ink md:text-h2">{value}</p>
      <p className="mt-2 truncate text-tiny text-sp-ink/85">{label}</p>
      {note && <p className="mt-0.5 truncate text-tiny text-sp-amber">{note}</p>}
    </div>
  );
}

function HeroAvatar({ creator }: { creator: CreatorProfile }) {
  const ring = "h-20 w-20 shrink-0 rounded-full border border-[color:var(--color-hairline-strong)] md:h-28 md:w-28";
  if (creator.xAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img src={creator.xAvatarUrl} alt="" width={112} height={112} referrerPolicy="no-referrer" className={`${ring} object-cover`} />
    );
  }
  return (
    <span className={`${ring} flex items-center justify-center bg-brand-blue-deep text-h3 font-light text-sp-ink`} aria-hidden>
      {(creator.xName || creator.xHandle).replace(/^@/, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/* ── The grid of banners ───────────────────────────────────────────── */

/**
 * One banner per group. Each opens that group's own screen. The event is named
 * (name, city, dates) but never linked: its page lists other creators, and a
 * creator's page sells for that creator and never sends the brand away.
 */
export function GroupGrid({
  handle,
  groups,
  kind,
  now,
  over = false,
}: {
  handle: string;
  groups: CreatorGroup[];
  kind: Kind | null;
  now: number;
  /** The past screen: every banner is an event that is over. */
  over?: boolean;
}) {
  const shown = groups
    .map((g) => ({ group: g, cards: ofKind(g.cards, kind) }))
    .filter((x) => x.cards.length > 0);
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      {shown.map(({ group, cards }) => (
        <li key={groupKey(group)} className="min-w-0">
          <GroupTile
            href={creatorScreenPath(handle, groupKey(group), kind)}
            event={group.event}
            cards={cards}
            kind={kind}
            now={now}
            over={over}
          />
        </li>
      ))}
    </ul>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fromPrice(cards: SpaceCard[]): number | null {
  const prices = cards
    .filter((c) => c.status === "live" && c.fromPriceCents !== null)
    .map((c) => c.fromPriceCents as number);
  return prices.length ? Math.min(...prices) : null;
}

const glassChip =
  "inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-[#141F2E]/70 px-2.5 text-tiny text-white backdrop-blur-md";

function GroupTile({
  href,
  event,
  cards,
  kind,
  now,
  over,
}: {
  href: string;
  event: EventSummary | null;
  cards: SpaceCard[];
  kind: Kind | null;
  now: number;
  over: boolean;
}) {
  const n = cards.length;
  const noun = kind === "spaces" ? "space" : kind === "services" ? "service" : "listing";
  const counted = `${noun}${n === 1 ? "" : "s"}`;
  const from = over ? null : fromPrice(cards);
  const sold = cards.reduce((s, c) => s + c.totals.sold, 0);
  const title = event ? event.name : "On sale all year";
  const countdown = event ? eventCountdown(event.startsOn, event.endsOn, now) : null;
  const chip = !event
    ? "No event"
    : countdown?.phase === "ended"
      ? "Ended"
      : countdown?.phase === "now"
        ? "Happening now"
        : capitalise(countdown?.text ?? "");

  const body = (
    <div className="pointer-events-none relative flex h-full min-h-[210px] flex-col justify-between p-5 md:min-h-[260px] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className={countdown?.phase === "now" ? `${glassChip} text-sp-amber` : glassChip}>{chip}</span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words font-display text-[30px] font-light leading-[1.05] text-white [overflow-wrap:anywhere] md:text-h3">
            {title}
          </h2>
          <p className="mt-1.5 truncate text-small text-white/85">
            {event ? `${event.city} · ${eventDates(event.startsOn, event.endsOn)}` : "Whenever your campaign runs"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[40px] font-light leading-none tabular-nums text-white md:text-[48px]">
            {over ? sold : n}
          </p>
          <p className="mt-1 text-tiny text-white/85">
            {over ? "sold" : counted}
            {from !== null && <span className="block text-white">from {usdFromCents(from)}</span>}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="group relative overflow-hidden rounded-card border border-sp-ink/[0.08]">
      {event ? (
        <BannerFrame banner={eventBanner(event)} className="h-full">
          <div className="pointer-events-none absolute inset-0 bg-[#141F2E]/25" aria-hidden />
          {body}
        </BannerFrame>
      ) : (
        <div className="relative h-full" style={{ background: gradientCss(ALL_YEAR_GRADIENT) }}>
          {body}
        </div>
      )}
      <Link
        href={href}
        aria-label={`${title}: ${over ? `${sold} sold` : `${n} ${counted}`}`}
        className="absolute inset-0 rounded-card outline-offset-2 transition-colors duration-180 group-hover:bg-sp-ink/[0.04]"
      />
    </div>
  );
}

/* ── One group's screen ────────────────────────────────────────────── */

/**
 * The header of an event's screen: the event's picture again, shorter, with
 * its name and dates. The no-event group gets its gradient.
 */
export function GroupHeader({ event, now }: { event: EventSummary | null; now: number }) {
  const inner = (
    <div className="container-page relative flex h-full flex-col justify-end pb-6 md:pb-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-[36px] font-light leading-[1.05] text-white [overflow-wrap:anywhere] md:text-h2">
            {event ? event.name : "On sale all year"}
          </h1>
          <p className="mt-2 text-small text-white/80">
            {event
              ? `${event.city} · ${eventDates(event.startsOn, event.endsOn)}${eventIsOver(event, now) ? " · Ended" : ""}`
              : "Not tied to an event"}
          </p>
        </div>
      </div>
    </div>
  );
  if (event) {
    return (
      <BannerFrame banner={eventBanner(event)} className="h-[200px] md:h-[280px]">
        {inner}
      </BannerFrame>
    );
  }
  return (
    <div className="relative h-[160px] md:h-[200px]" style={{ background: gradientCss(ALL_YEAR_GRADIENT) }}>
      {inner}
    </div>
  );
}

/** How many listings a screen shows before "Show all". */
export const SCREEN_LIMIT = 6;

export function openNowIn(groups: CreatorGroup[]): number {
  return groups.reduce((n, g) => n + openSpots(g.cards), 0);
}
