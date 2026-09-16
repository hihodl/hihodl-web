import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadLink } from "@/components/site/DownloadLink";
import { closesText, compactNumber, eventCountdown, eventDates, usdFromCents } from "@/lib/ad-space/format";
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
  as?: "h1" | "p";
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
      <Heading className="mt-3 font-display text-h4 font-light leading-tight text-white">{event.name}</Heading>
      <p className="mt-1 text-small text-white/75">
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
      <div className="container-page relative flex h-full items-end pb-8 md:pb-10">
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
    <BannerFrame banner={banner} className={event ? "h-[260px] md:h-[340px]" : "h-[180px] md:h-[240px]"}>
      {event && (
        <div className="container-page relative flex h-full flex-col justify-between py-4 md:py-6">
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

const TAB_NAME: Record<SpaceTab, string> = { ground: "On the ground", feed: "On the feed" };

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
  const subtitle: Record<SpaceTab, string> = {
    ground: `Your logo, walking ${eventName}`,
    feed: `Content from inside ${eventName}`,
  };
  return (
    <nav aria-label="Kinds of space" className="grid grid-cols-2 gap-3">
      {(["ground", "feed"] as const).map((tab) => {
        const on = tab === active;
        const n = tabs[tab].length;
        return (
          <Link
            key={tab}
            href={`${eventPath(slug)}?tab=${tab}`}
            scroll={false}
            replace
            aria-current={on ? "page" : undefined}
            className={`flex min-w-0 flex-col gap-1 rounded-card border p-4 transition-colors duration-180 md:p-5 ${
              on
                ? "border-amber/50 bg-amber/[0.07]"
                : "border-[color:var(--color-hairline)] bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className={`text-body ${on ? "text-amber" : "text-text"}`}>{TAB_NAME[tab]}</span>
              <span className="text-tiny text-text-faint">
                {n} {n === 1 ? "space" : "spaces"}
              </span>
            </span>
            <span className="text-small text-text-muted">{subtitle[tab]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SpaceCardGrid({
  cards,
  event,
  tab,
  now,
}: {
  cards: SpaceCard[];
  event: EventSummary;
  tab: SpaceTab;
  now: number;
}) {
  if (cards.length === 0) return <EmptyTab event={event} tab={tab} />;
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

function SpaceCardTile({ card: c, event, now }: { card: SpaceCard; event: EventSummary; now: number }) {
  const banner = bannerFor(c, event);
  const closed = c.status !== "live";
  const { delivered, missed } = c.creator.trackRecord;
  const record =
    delivered + missed === 0 ? "First HiSpace" : `${delivered} delivered${missed ? `, ${missed} missed` : ", none missed"}`;

  return (
    <Link
      href={c.path}
      className={`${cardClass} group flex w-full flex-col overflow-hidden transition-colors duration-180 hover:border-[color:var(--color-hairline-strong)] hover:bg-white/[0.05]`}
    >
      <BannerFrame banner={banner} className="h-28 shrink-0" />
      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="relative -mt-7 flex items-end justify-between gap-3">
          <CreatorAvatar name={c.creator.xName || c.creator.xHandle} url={c.creator.xAvatarUrl} />
          {closed ? (
            <span className={pill.neutral}>Closed</span>
          ) : c.pricingMode === "takeover" ? (
            <span className={pill.open}>Open bidding</span>
          ) : null}
        </div>

        <div className="mt-3 min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-body text-text">
            <span className="truncate">{c.creator.xName || `@${c.creator.xHandle}`}</span>
            <VerifiedTick type={c.creator.xVerifiedType} />
          </p>
          <p className="truncate text-small text-text-muted">
            @{c.creator.xHandle} · {compactNumber(c.creator.xFollowers)} followers
          </p>
        </div>

        <h3 className="mt-4 line-clamp-2 text-body text-text group-hover:text-amber">{c.title}</h3>
        <p className="mt-1 text-small text-text-muted">{c.templateName}</p>
        <p className={`mt-1 text-tiny ${missed > 0 ? "text-amber" : "text-text-faint"}`}>{record}</p>

        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-5 text-small">
          <span>
            <span className="tabular-nums text-text">
              {c.totals.open} of {c.totals.positions}
            </span>
            <span className="text-text-muted"> open</span>
          </span>
          {c.fromPriceCents !== null && (
            <span>
              <span className="text-text-muted">from </span>
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
      {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
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

export function VerifiedTick({ type }: { type: VerifiedType }) {
  if (!type) return null;
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} className="shrink-0" role="img" aria-label={TICK_LABEL[type]}>
      <circle cx="8" cy="8" r="8" fill={TICK_COLOR[type]} />
      <path d="M4.6 8.2 7 10.5l4.4-4.8" fill="none" stroke={TICK_INK[type]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyTab({ event, tab }: { event: EventSummary; tab: SpaceTab }) {
  const what =
    tab === "ground"
      ? "Sell spots on what you carry there, from a suitcase to a blazer, and let sponsors pay for the trip."
      : "Sell interviews, short videos or a wrap of the event to sponsors who can’t be there.";
  return (
    <div className={`${cardClass} flex flex-col items-start gap-4 p-6 md:p-8`}>
      <p className={`${eyebrow} text-text-faint`}>No spaces here yet</p>
      <h3 className="max-w-xl font-display text-h4 font-light text-text">
        Going to {event.name}? Open your space in the HOLD app.
      </h3>
      <p className="max-w-xl text-small text-text-muted">{what} Sponsors pay you directly in USDC.</p>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </div>
  );
}
