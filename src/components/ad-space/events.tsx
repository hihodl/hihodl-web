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
import { type Banner, bannerFor, categoryLabel, gradientCss, gradientKey, gradientOverPhotoCss } from "@/lib/ad-space/look";
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
        <span className="inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-sp-ink/[0.12] px-2.5 text-tiny text-white/85">
          {categoryLabel(event.category)}
        </span>
        <span
          className={
            countdown.phase === "now"
              ? "inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-amber/20 px-2.5 text-tiny text-sp-amber"
              : "inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-sp-ink/[0.12] px-2.5 text-tiny text-white/85"
          }
        >
          {countdown.phase === "upcoming" ? `Starts ${countdown.text}` : capitalise(countdown.text)}
        </span>
      </div>
      <Heading className="mt-3 break-words font-display text-h4 font-light leading-tight text-white [overflow-wrap:anywhere]">{event.name}</Heading>
      <p className="mt-1 break-words text-small text-white/85">
        {event.city} · {eventDates(event.startsOn, event.endsOn)}
      </p>
    </>
  );
  const shell =
    "block w-full max-w-[320px] rounded-card border border-sp-ink/[0.14] bg-[#141F2E]/70 p-4 backdrop-blur-md";
  return href ? (
    <Link href={href} className={`${shell} transition-colors duration-180 hover:border-sp-ink/30`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * An event's own picture: its cover or city photo, else steel. The one place a
 * page draws it, so no listing ever borrows it. No photo credit is printed over
 * it: the founder asked for the caption to go.
 */
export function eventBanner(event: Pick<EventSummary, "coverUrl">): Banner {
  return { imageUrl: event.coverUrl, gradient: "steel", credit: null };
}

/** The event page's banner: the city photo (or steel) with the small card. */
export function EventBanner({ event, now }: { event: EventSummary; now: number }) {
  return (
    <BannerFrame banner={eventBanner(event)} className="h-[320px] sm:h-[380px] md:h-[440px]">
      <div className="container-page relative flex h-full items-end pb-10">
        <EventMiniCard event={event} now={now} as="h1" />
      </div>
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
        // instead of pushing the card off the bottom.
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

/** What a sibling is, in the brand's words: a spot to wear their logo, content, or time in person. */
const SIBLING_KIND: Record<SpaceTab, string> = { ground: "Spot", feed: "Content", room: "In person" };

/**
 * "More from @demo_creator at TOKEN2049": the same creator's other listings at
 * this event, each a link with what it is. It sells more of THIS creator (a
 * brand that came for the suitcase may want the videos too), never anybody
 * else. Nothing when there are none.
 */
export function SpaceSiblings({
  siblings,
  handle,
  eventName,
}: {
  siblings: SpaceSibling[];
  handle: string;
  eventName?: string | null;
}) {
  if (siblings.length === 0) return null;
  return (
    <nav aria-label={`More from @${handle}`} className="mb-6 flex min-w-0 flex-col gap-2.5">
      <p className="text-tiny uppercase tracking-wider text-sp-ink/80">
        More from @{handle}
        {eventName ? ` at ${eventName}` : ""}
      </p>
      <ul className="flex min-w-0 flex-wrap gap-2">
        {siblings.map((s) => (
          <li key={s.path} className="min-w-0 max-w-full">
            <Link
              href={s.path}
              className="group inline-flex h-10 max-w-full items-center gap-2 whitespace-nowrap rounded-[20px] border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.06] pl-3 pr-3.5 text-small text-sp-ink transition-colors duration-180 hover:bg-sp-ink/[0.12]"
            >
              <span className="shrink-0 text-tiny uppercase tracking-wider text-sp-ink/80">{SIBLING_KIND[s.tab]}</span>
              <span className="min-w-0 truncate">{s.title}</span>
              <span aria-hidden className="shrink-0 text-sp-ink/80 transition-transform duration-180 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
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
                  : "border-[color:var(--color-hairline)] bg-sp-ink/[0.02] hover:bg-sp-ink/[0.05]"
              }`}
            >
              <span className="flex flex-col gap-x-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                <span className={`text-small sm:text-body ${on ? "text-sp-amber" : "text-sp-ink"}`}>{TAB_NAME[tab]}</span>
                <span className="text-tiny text-sp-ink/80">
                  {n} {n === 1 ? "space" : "spaces"}
                </span>
              </span>
              <span className="hidden break-words text-small text-sp-ink/85 [overflow-wrap:anywhere] sm:block">
                {tabSubtitle(tab, eventName)}
              </span>
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere] sm:hidden">
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
  showCreator = true,
  readOnly = false,
}: {
  cards: SpaceCard[];
  event: EventSummary | null;
  tab: SpaceTab | null;
  now: number;
  /** See `SpaceCardTile`: false on a creator's own hub. */
  showCreator?: boolean;
  /** An event that is over: every card reads as closed, whatever it says. */
  readOnly?: boolean;
}) {
  if (cards.length === 0) return event && tab ? <EmptyTab event={event} tab={tab} /> : null;
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <li key={c.spaceId} className="flex min-w-0">
          <SpaceCardTile card={c} now={now} showCreator={showCreator} readOnly={readOnly} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A card's picture, and only its own: the creator's banner when they set one,
 * else the product itself drawn on the creator's gradient for something they
 * carry, else the gradient alone. Never the event's photo — the event has its
 * own banner, and six cards wearing the same city are six cards that look like
 * one.
 */
function CardVisual({ card: c }: { card: SpaceCard }) {
  const banner: Banner = { imageUrl: c.bannerUrl, gradient: gradientKey(c.bannerGradient), credit: null };
  return (
    <BannerFrame banner={banner} className="aspect-[16/10] w-full shrink-0">
      {!c.bannerUrl && c.tab === "ground" && <ProductGlyph name={c.templateName} />}
      <span className="absolute left-3 top-3 inline-flex h-6 items-center whitespace-nowrap rounded-[12px] bg-[#141F2E]/70 px-2.5 text-tiny text-white backdrop-blur-md">
        {TAB_NAME[c.tab]}
      </span>
    </BannerFrame>
  );
}

/**
 * The product a placement goes on, as a line drawing: what a sponsor is buying
 * space on, when the creator has not photographed it. Only the catalogue's
 * common shapes; anything else keeps the plain gradient rather than a wrong
 * picture.
 */
function ProductGlyph({ name }: { name: string | null }) {
  const paths = productPaths(name);
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 100 140"
      className="absolute inset-0 m-auto h-[68%] w-auto"
      fill="none"
      stroke="rgba(244,246,250,0.72)"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function productPaths(name: string | null): string[] | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("suitcase") || n.includes("luggage")) {
    return [
      "M19 28 H81 a7 7 0 0 1 7 7 V121 a7 7 0 0 1 -7 7 H19 a7 7 0 0 1 -7 -7 V35 a7 7 0 0 1 7 -7 Z",
      "M41 28 V7 a2 2 0 0 1 2 -2 H57 a2 2 0 0 1 2 2 V28",
      "M36 28 V128 M64 28 V128",
      "M22 132 a4.5 4.5 0 1 0 0.1 0 M78 132 a4.5 4.5 0 1 0 0.1 0",
    ];
  }
  if (n.includes("backpack")) {
    return [
      "M22 50 a28 28 0 0 1 56 0 V122 a8 8 0 0 1 -8 8 H30 a8 8 0 0 1 -8 -8 Z",
      "M40 22 a10 10 0 0 1 20 0",
      "M32 84 H68 V114 H32 Z",
      "M32 96 H68",
    ];
  }
  if (n.includes("tote") || n.includes("bag")) {
    return ["M16 50 H84 L78 128 H22 Z", "M34 50 V38 a16 16 0 0 1 32 0 V50"];
  }
  if (n.includes("blazer") || n.includes("jacket")) {
    return [
      "M36 14 L50 40 L64 14 L86 24 L90 124 H60 L50 60 L40 124 H10 L14 24 Z",
      "M36 14 L42 48 L50 40 M64 14 L58 48 L50 40",
      "M72 70 H82",
    ];
  }
  if (n.includes("hoodie") || n.includes("t-shirt") || n.includes("tee") || n.includes("shirt")) {
    return [
      "M36 18 L14 30 L6 62 L22 66 L26 50 V126 H74 V50 L78 66 L94 62 L86 30 L64 18",
      "M36 18 a14 12 0 0 0 28 0",
    ];
  }
  return null;
}

function SpaceCardTile({
  card: c,
  now,
  showCreator = true,
  readOnly = false,
}: {
  card: SpaceCard;
  now: number;
  /**
   * False on a creator's own hub, where every card is the same person and the
   * page said who they are once, at the top. Repeating the avatar, the name,
   * the followers and the record on every tile buries the part that actually
   * differs between them.
   */
  showCreator?: boolean;
  readOnly?: boolean;
}) {
  const closed = readOnly || c.status !== "live";
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
  const status = closed ? (
    <span className={pill.neutral}>{c.totals.sold > 0 && c.totals.sold >= c.totals.positions ? "Sold out" : "Closed"}</span>
  ) : chip ? (
    <span className={pill.open}>{chip}</span>
  ) : null;
  const service = cardServiceName(c);

  return (
    <Link
      href={c.path}
      className={`${cardClass} group flex w-full min-w-0 flex-col overflow-hidden transition-colors duration-180 hover:border-[color:var(--color-hairline-strong)] hover:bg-sp-ink/[0.05]`}
    >
      <CardVisual card={c} />
      <div className={`flex flex-1 flex-col px-5 pb-5 ${showCreator ? "" : "pt-4"}`}>
        {showCreator && (
          <>
            {/* The avatar rides up over the picture, so this row hangs above the padding. */}
            <div className="relative -mt-7 flex items-end justify-between gap-3">
              <CreatorAvatar name={xName || xHandle || ""} url={c.creator.xAvatarUrl} />
            </div>

            <div className="mt-3 min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 text-body text-sp-ink">
                <span className="truncate">{xName || (xHandle ? `@${xHandle}` : "A creator")}</span>
                <VerifiedTick type={c.creator.xVerifiedType} />
              </p>
              {handleLine && <p className="truncate text-small text-sp-ink/85">{handleLine}</p>}
              <p className={`mt-0.5 text-tiny ${trackRecordNeedsAttention(c.creator.trackRecord) ? "text-sp-amber" : "text-sp-ink/80"}`}>
                {trackRecordText(c.creator.trackRecord)}
              </p>
            </div>
          </>
        )}

        <h3
          className={`${showCreator ? "mt-4 text-body" : "text-lead"} line-clamp-2 break-words text-sp-ink [overflow-wrap:anywhere] group-hover:text-sp-amber`}
        >
          {c.title}
        </h3>
        {service && service !== c.title && <p className="mt-1 truncate text-small text-sp-ink/85">{service}</p>}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-5">
          {/* A closed space sells nothing more, so it says what it sold and names no price. */}
          {!closed && c.fromPriceCents !== null ? (
            <span className="min-w-0">
              <span className="block text-tiny text-sp-ink/80">{room ? "Book from" : "From"}</span>
              <span className="font-display text-h4 font-light tabular-nums text-sp-ink">{usdFromCents(c.fromPriceCents)}</span>
            </span>
          ) : (
            <span className="text-small">
              <span className="tabular-nums text-sp-ink">
                {closed ? c.totals.sold : c.totals.open} of {c.totals.positions}
              </span>
              <span className="text-sp-ink/85">{closed ? (room ? " booked" : " sold") : room ? " sessions open" : " open"}</span>
            </span>
          )}
          {status}
        </div>
        {!closed && (
          <p className="mt-2 text-tiny text-sp-ink/80">
            <span className="tabular-nums">
              {c.totals.open} of {c.totals.positions}
            </span>
            {room ? " sessions open" : " open"} · {closesText(c.closesAt, closed, now)}
          </p>
        )}
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
    <span className={`${ring} flex items-center justify-center bg-brand-blue-deep text-h4 font-light text-sp-ink`} aria-hidden>
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
      <p className={`${eyebrow} text-sp-ink/80`}>No spaces here yet</p>
      <h3 className="max-w-xl break-words font-display text-h4 font-light text-sp-ink [overflow-wrap:anywhere]">
        Going to {event.name}? Open your space in the HOLD app.
      </h3>
      <p className="max-w-xl text-small text-sp-ink/85">
        {what[tab]} {paidBy}
      </p>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </div>
  );
}
