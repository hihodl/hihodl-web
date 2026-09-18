import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadLink } from "@/components/site/DownloadLink";
import {
  EVENT_TABS,
  cardServiceName,
  closesText,
  compactNumber,
  eventCountdown,
  eventDates,
  pricingChipText,
  trackRecordNeedsAttention,
  trackRecordText,
  usdFromCents,
} from "@/lib/ad-space/format";
import { type Banner, bannerFor, categoryLabel, gradientCss, gradientOverPhotoCss } from "@/lib/ad-space/look";
import type { EventSummary, SpaceCard, SpaceSibling, SpaceTab, VerifiedType } from "@/lib/ad-space/types";

import { btnSmallSecondary, card as cardClass, eyebrow, pill } from "./ui";

/**
 * The pieces events add to Ad Space: a banner (photo, gradient, small card), the
 * event page's tabs and cards, and the links between a space and its event.
 *
 * All server components. Countdowns here are in days, computed at render: the
 * pages revalidate every 30 s, which is far finer than the unit they count in.
 */

/* ── Banner ────────────────────────────────────────────────────────── */

/**
 * Full bleed. The gradient is always painted underneath, so a photo that fails
 * to load leaves the preset rather than a hole. A photo gets the gradient again
 * over its lower half, which is what lets the small card read on any picture.
 */
export function BannerFrame({
  banner,
  className,
  children,
}: {
  banner: Banner;
  className: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: gradientCss(banner.gradient) }}>
      {banner.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- city photo or creator banner from our bucket */}
          <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: gradientOverPhotoCss(banner.gradient) }}
            aria-hidden
          />
        </>
      )}
      {children}
    </div>
  );
}

function PhotoCredit({ credit }: { credit: string | null }) {
  if (!credit) return null;
  return (
    <p className="absolute bottom-2 right-3 max-w-[45%] truncate text-[10px] leading-4 text-white/55 md:right-4">
      {credit}
    </p>
  );
}

/**
 * The small card over a banner: name, city, dates, countdown, category. Kept
 * narrow on purpose. It never says how many creators are going or how many
 * spots are open; the banner is about the event, the page below is about them.
 */
export function EventMiniCard({
  event,
  now,
  href,
  as: Heading = "p",
}: {
  event: EventSummary;
  now: number;
  href?: string;
  /** `h2` on a creator's hub, where each event is a section of a longer page. */
  as?: "h1" | "h2" | "p";
}) {
  const countdown = eventCountdown(event.startsOn, event.endsOn, now);
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-white/[0.12] px-2.5 text-tiny text-white/85">
          {categoryLabel(event.category)}
        </span>
        <span
          className={
            countdown.phase === "now"
              ? "inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-amber/20 px-2.5 text-tiny text-amber"
              : "inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-white/[0.12] px-2.5 text-tiny text-white/85"
          }
        >
          {countdown.phase === "upcoming" ? `Starts ${countdown.text}` : capitalise(countdown.text)}
        </span>
      </div>
      <Heading className="mt-3 break-words font-display text-h4 font-light leading-tight text-white [overflow-wrap:anywhere]">{event.name}</Heading>
      <p className="mt-1 break-words text-small text-white/75">
        {event.city} · {eventDates(event.startsOn, event.endsOn)}
      </p>
    </>
  );
  const shell =
    "block w-full max-w-[320px] rounded-card border border-white/[0.14] bg-[#141F2E]/70 p-4 backdrop-blur-md";
  return href ? (
    <Link href={href} className={`${shell} transition-colors duration-180 hover:border-white/30`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The event page's banner: the city photo (or steel) with the small card. */
export function EventBanner({ event, now }: { event: EventSummary; now: number }) {
  const banner: Banner = { imageUrl: event.coverUrl, gradient: "steel", credit: event.coverUrl ? event.coverCredit : null };
  return (
    <BannerFrame banner={banner} className="h-[320px] sm:h-[380px] md:h-[440px]">
      <div className="container-page relative flex h-full items-end pb-10">
        <EventMiniCard event={event} now={now} as="h1" />
      </div>
      <PhotoCredit credit={banner.credit} />
    </BannerFrame>
  );
}

/* ── A creator's page ──────────────────────────────────────────────── */

export function eventPath(slug: string): string {
  return `/events/${encodeURIComponent(slug)}`;
}

/**
 * A space's banner: the creator's image, then the event's city photo, then the
 * creator's gradient. With an event, the way back to every space for it sits top
 * left and the event's card sits over the picture. A space with no event and no
 * image gets a short strip of its gradient and nothing else.
 */
export function SpaceBanner({
  space,
  now,
}: {
  space: { bannerUrl: string | null; bannerGradient: SpaceCard["bannerGradient"]; event: EventSummary | null };
  now: number;
}) {
  const banner = bannerFor(space, space.event);
  const { event } = space;

  if (!event && !banner.imageUrl) {
    return <BannerFrame banner={banner} className="h-20 md:h-28" />;
  }

  return (
    <BannerFrame banner={banner} className={event ? "flex min-h-[260px] md:min-h-[340px]" : "h-[180px] md:h-[240px]"}>
      {event && (
        // A minimum height, not a fixed one: a long event name grows the banner
        // instead of pushing the card down over the credit. pb-10 below md: the
        // credit sits in the bottom 24px, under a card as wide as the screen.
        <div className="container-page relative flex w-full flex-col justify-between gap-4 pb-10 pt-4 md:py-6">
          <Link
            href={eventPath(event.slug)}
            className="inline-flex h-9 max-w-full items-center self-start overflow-hidden whitespace-nowrap rounded-[18px] bg-[#141F2E]/60 px-3.5 text-small text-white backdrop-blur-md transition-colors duration-180 hover:bg-[#141F2E]/80"
          >
            <span aria-hidden className="mr-1.5">
              &larr;
            </span>
            <span className="truncate">View all spaces for {event.name}</span>
          </Link>
          <EventMiniCard event={event} now={now} href={eventPath(event.slug)} />
        </div>
      )}
      <PhotoCredit credit={banner.credit} />
    </BannerFrame>
  );
}

export const TAB_NAME: Record<SpaceTab, string> = { ground: "On the ground", feed: "On the feed", room: "In the room" };

/** Each tab's line under its name, named from the buyer's side. */
export function tabSubtitle(tab: SpaceTab, eventName: string): string {
  if (tab === "ground") return `Your logo, walking ${eventName}`;
  if (tab === "feed") return `Content from inside ${eventName}`;
  return `Time with creators at ${eventName}`;
}

/** "Also on the feed: TOKEN2049 short videos". Nothing when there are none. */
export function SpaceSiblings({ siblings }: { siblings: SpaceSibling[] }) {
  if (siblings.length === 0) return null;
  return (
    <ul className="mb-6 flex flex-col gap-1.5">
      {siblings.map((s) => (
        <li key={s.path} className="text-small">
          <Link href={s.path} className="group text-text-muted transition-colors duration-180 hover:text-text">
            Also {TAB_NAME[s.tab].toLowerCase()}:{" "}
            <span className="text-text underline-offset-4 group-hover:underline">{s.title}</span>
            <span aria-hidden className="ml-1 text-text-faint">
              &rarr;
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── The event page ────────────────────────────────────────────────── */

export function EventTabs({
  slug,
  eventName,
  active,
  tabs,
}: {
  slug: string;
  eventName: string;
  active: SpaceTab;
  tabs: Record<SpaceTab, SpaceCard[]>;
}) {
  return (
    <div>
      {/* Three across at every width. Below sm the subtitles would not fit in a
          third of a phone, so only the active one is shown, under the row. */}
      <nav aria-label="Kinds of space" className="grid grid-cols-3 gap-2 sm:gap-3">
        {EVENT_TABS.map((tab) => {
          const on = tab === active;
          const n = tabs[tab].length;
          return (
            <Link
              key={tab}
              href={`${eventPath(slug)}?tab=${tab}`}
              scroll={false}
              replace
              aria-current={on ? "page" : undefined}
              className={`flex min-w-0 flex-col gap-1 rounded-card border p-3 transition-colors duration-180 sm:p-4 md:p-5 ${
                on
                  ? "border-amber/50 bg-amber/[0.07]"
                  : "border-[color:var(--color-hairline)] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <span className="flex flex-col gap-x-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                <span className={`text-small sm:text-body ${on ? "text-amber" : "text-text"}`}>{TAB_NAME[tab]}</span>
                <span className="text-tiny text-text-faint">
                  {n} {n === 1 ? "space" : "spaces"}
                </span>
              </span>
              <span className="hidden break-words text-small text-text-muted [overflow-wrap:anywhere] sm:block">
                {tabSubtitle(tab, eventName)}
              </span>
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 break-words text-small text-text-muted [overflow-wrap:anywhere] sm:hidden">
        {tabSubtitle(active, eventName)}
      </p>
    </div>
  );
}

/**
 * The same grid on both pages that show a list of spaces. A creator's hub
 * groups by event rather than by tab and can hold a group tied to no event at
 * all, so both are nullable here — and with neither there is nothing to invite
 * anybody to, which is why an empty group simply draws nothing.
 */
export function SpaceCardGrid({
  cards,
  event,
  tab,
  now,
}: {
  cards: SpaceCard[];
  event: EventSummary | null;
  tab: SpaceTab | null;
  now: number;
}) {
  if (cards.length === 0) return event && tab ? <EmptyTab event={event} tab={tab} /> : null;
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <li key={c.spaceId} className="flex">
          <SpaceCardTile card={c} event={event} now={now} />
        </li>
      ))}
    </ul>
  );
}

function SpaceCardTile({ card: c, event, now }: { card: SpaceCard; event: EventSummary | null; now: number }) {
  const banner = bannerFor(c, event);
  const closed = c.status !== "live";
  const { xHandle, xName, xFollowers } = c.creator;
  const room = c.tab === "room";
  // How it sells: "Accepts offers", "Make an offer", "Bidding · 2d left", "Open bidding".
  const chip = closed ? null : pricingChipText(c, now);
  const handleLine = [
    // Without a name the handle is already the line above.
    xHandle && xName ? `@${xHandle}` : null,
    typeof xFollowers === "number" ? `${compactNumber(xFollowers)} followers` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={c.path}
      className={`${cardClass} group flex w-full flex-col overflow-hidden transition-colors duration-180 hover:border-[color:var(--color-hairline-strong)] hover:bg-white/[0.05]`}
    >
      <BannerFrame banner={banner} className="h-28 shrink-0" />
      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="relative -mt-7 flex items-end justify-between gap-3">
          <CreatorAvatar name={xName || xHandle || ""} url={c.creator.xAvatarUrl} />
          {closed ? (
            <span className={pill.neutral}>Closed</span>
          ) : chip ? (
            <span className={pill.open}>{chip}</span>
          ) : null}
        </div>

        <div className="mt-3 min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-body text-text">
            <span className="truncate">{xName || (xHandle ? `@${xHandle}` : "A creator")}</span>
            <VerifiedTick type={c.creator.xVerifiedType} />
          </p>
          {handleLine && <p className="truncate text-small text-text-muted">{handleLine}</p>}
        </div>

        <h3 className="mt-4 line-clamp-2 break-words text-body [overflow-wrap:anywhere] text-text group-hover:text-amber">{c.title}</h3>
        {cardServiceName(c) && (
          <p className="mt-1 truncate text-small text-text-muted">{cardServiceName(c)}</p>
        )}
        <p className={`mt-1 text-tiny ${trackRecordNeedsAttention(c.creator.trackRecord) ? "text-amber" : "text-text-faint"}`}>
          {trackRecordText(c.creator.trackRecord)}
        </p>

        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-5 text-small">
          {/* A closed space sells nothing more, so it says what it sold and names no price. */}
          <span>
            <span className="tabular-nums text-text">
              {closed ? c.totals.sold : c.totals.open} of {c.totals.positions}
            </span>
            <span className="text-text-muted">{closed ? (room ? " booked" : " sold") : room ? " sessions open" : " open"}</span>
          </span>
          {!closed && c.fromPriceCents !== null && (
            <span>
              <span className="text-text-muted">{room ? "book from " : "from "}</span>
              <span className="font-mono text-text">{usdFromCents(c.fromPriceCents)}</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-tiny text-text-faint">{closesText(c.closesAt, closed, now)}</p>
      </div>
    </Link>
  );
}

function CreatorAvatar({ name, url }: { name: string; url: string | null }) {
  const ring = "h-14 w-14 shrink-0 rounded-full border-2 border-[#141F2E]";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img src={url} alt="" width={56} height={56} referrerPolicy="no-referrer" className={`${ring} object-cover`} />
    );
  }
  return (
    <span className={`${ring} flex items-center justify-center bg-brand-blue-deep text-h4 font-light text-text`} aria-hidden>
      {name.replace(/^@/, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

const TICK_COLOR: Record<Exclude<VerifiedType, null>, string> = {
  blue: "#5B7CFF",
  business: "#FFB703",
  government: "#9BA3B0",
};

const TICK_INK: Record<Exclude<VerifiedType, null>, string> = {
  blue: "#FFFFFF",
  business: "#0A0500",
  government: "#0A0500",
};

const TICK_LABEL: Record<Exclude<VerifiedType, null>, string> = {
  blue: "Verified on X",
  business: "Verified business on X",
  government: "Verified government on X",
};

function isVerifiedType(type: string | null): type is Exclude<VerifiedType, null> {
  return type === "blue" || type === "business" || type === "government";
}

/** Nothing for no verification, and nothing for a kind this page has no tick for. */
export function VerifiedTick({ type }: { type: string | null }) {
  if (!isVerifiedType(type)) return null;
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} className="shrink-0" role="img" aria-label={TICK_LABEL[type]}>
      <circle cx="8" cy="8" r="8" fill={TICK_COLOR[type]} />
      <path d="M4.6 8.2 7 10.5l4.4-4.8" fill="none" stroke={TICK_INK[type]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyTab({ event, tab }: { event: EventSummary; tab: SpaceTab }) {
  const what: Record<SpaceTab, string> = {
    ground: "Sell spots on what you carry there, from a suitcase to a blazer, and let sponsors pay for the trip.",
    feed: "Sell interviews, short videos or a wrap of the event to sponsors who can’t be there.",
    room: "Sell your time there: host a side event, moderate a panel, review pitches or hold office hours.",
  };
  const paidBy = tab === "room" ? "Clients pay you directly in USDC." : "Sponsors pay you directly in USDC.";
  return (
    <div className={`${cardClass} flex flex-col items-start gap-4 p-6 md:p-8`}>
      <p className={`${eyebrow} text-text-faint`}>No spaces here yet</p>
      <h3 className="max-w-xl break-words font-display text-h4 font-light text-text [overflow-wrap:anywhere]">
        Going to {event.name}? Open your space in the HOLD app.
      </h3>
      <p className="max-w-xl text-small text-text-muted">
        {what[tab]} {paidBy}
      </p>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </div>
  );
}
