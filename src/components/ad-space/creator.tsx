import Link from "next/link";

import { creatorTotalsText, otherCreatorsLine } from "@/lib/ad-space/creator";
import {
  VERIFIED_LABEL,
  compactNumber,
  trackRecordNeedsAttention,
  trackRecordText,
} from "@/lib/ad-space/format";
import type { CreatorGroup, CreatorPage, CreatorProfile, EventSummary, VerifiedType } from "@/lib/ad-space/types";

import { BannerFrame, EventMiniCard, SpaceCardGrid, VerifiedTick, eventPath } from "./events";
import { card as cardClass, eyebrow, pill } from "./ui";

/**
 * The parts of a creator's hub, `/s/<handle>`: who they are, and then one
 * section per event they are going to.
 *
 * A hub is the one link a creator posts, so it is read by a brand who has never
 * heard of them. Two things follow. The header has to answer "can I trust this
 * person with a campaign" before anything is for sale — hence the checkmark,
 * the followers and the delivery record, in the same words the card and the
 * space page use. And every event section has to offer a way on to that event,
 * because a brand that likes the event but not this creator is not a lost
 * reader; they are the next sponsor for somebody else going.
 *
 * All server components. The cards are the event page's own grid, unchanged: a
 * brand who came from an event page should see the same tile twice, not two
 * designs of the same thing.
 */

export function creatorPath(handle: string): string {
  return `/s/${encodeURIComponent(handle)}`;
}

/* ── Who they are ──────────────────────────────────────────────────── */

/**
 * The header. It takes the space page's hero ground so the two read as one
 * product, and says the totals in a single line: a sponsor's first question is
 * how much there is to buy, not how the page is organised.
 */
export function CreatorHero({ creator, totals }: { creator: CreatorProfile; totals: CreatorPage["totals"] }) {
  const name = creator.xName || `@${creator.xHandle}`;
  const attention = trackRecordNeedsAttention(creator.trackRecord);
  const label = verifiedLabel(creator.xVerifiedType);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #1B2638 0%, #243246 60%, #141F2E 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 70% at 20% 10%, rgba(255,183,3,0.10), transparent 70%)" }}
        aria-hidden
      />
      <div className="container-page relative pb-12 pt-8 md:pb-16 md:pt-14">
        <p className={`${eyebrow} text-amber`}>HiSpace</p>
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <HeroAvatar creator={creator} />
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 break-words font-display text-[32px] font-light leading-[1.1] text-text [overflow-wrap:anywhere] md:text-h2">
              <span>{name}</span>
              <VerifiedTick type={creator.xVerifiedType} />
            </h1>
            {creator.xName && (
              <a
                href={`https://x.com/${encodeURIComponent(creator.xHandle)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-body text-text-muted transition-colors duration-180 hover:text-amber"
              >
                @{creator.xHandle}
              </a>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {label && <span className={pill.neutral}>{label}</span>}
              {typeof creator.xFollowers === "number" && (
                <span className={pill.neutral}>{compactNumber(creator.xFollowers)} followers</span>
              )}
              <span className={attention ? pill.attention : pill.neutral}>{trackRecordText(creator.trackRecord)}</span>
            </div>
          </div>
        </div>
        <p className="mt-8 break-words text-body text-text [overflow-wrap:anywhere] md:text-lead">
          {creatorTotalsText(totals)}
        </p>
        <p className="mt-2 max-w-2xl text-small text-text-muted">
          Everything {name} has on sale, grouped by where they are going. You pay them directly in USDC; HOLD never
          holds the money.
        </p>
      </div>
    </section>
  );
}

/** The kinds of X verification this page has words for; nothing for the rest. */
function verifiedLabel(type: string | null): string | null {
  return type === "blue" || type === "business" || type === "government"
    ? VERIFIED_LABEL[type as Exclude<VerifiedType, null>]
    : null;
}

function HeroAvatar({ creator }: { creator: CreatorProfile }) {
  const ring =
    "h-20 w-20 shrink-0 rounded-full border border-[color:var(--color-hairline-strong)] md:h-24 md:w-24";
  if (creator.xAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img
        src={creator.xAvatarUrl}
        alt=""
        width={96}
        height={96}
        referrerPolicy="no-referrer"
        className={`${ring} object-cover`}
      />
    );
  }
  return (
    <span className={`${ring} flex items-center justify-center bg-brand-blue-deep text-h3 font-light text-text`} aria-hidden>
      {(creator.xName || creator.xHandle).replace(/^@/, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/* ── What they sell, by where they are going ───────────────────────── */

/**
 * The groups exactly as the server sent them: upcoming events first, then past
 * ones, then whatever is tied to no event. Nothing here sorts, and nothing here
 * drops a group — a past event still on the page is a creator who has done this
 * before, which is the most useful thing a first-time sponsor can see.
 */
export function CreatorGroups({ groups, now }: { groups: CreatorGroup[]; now: number }) {
  return (
    <>
      {groups.map((group) => (
        <GroupSection key={group.event ? group.event.id : "no-event"} group={group} now={now} />
      ))}
    </>
  );
}

function GroupSection({ group, now }: { group: CreatorGroup; now: number }) {
  const { event } = group;
  return (
    <section className="container-page py-8 md:py-12" aria-label={event ? event.name : "Not tied to an event"}>
      {event ? <EventHeading event={event} now={now} /> : <OffEventHeading />}
      <div className="mt-6">
        <SpaceCardGrid cards={group.cards} event={event} tab={null} now={now} />
      </div>
      {event && <EventJump event={event} othersAtEvent={group.othersAtEvent} />}
    </section>
  );
}

/**
 * The event this group is for, drawn the way the event's own page draws it: the
 * cover photo where there is one, the preset gradient where there is not, and
 * the same small card holding the name, city and dates.
 */
function EventHeading({ event, now }: { event: EventSummary; now: number }) {
  return (
    <BannerFrame
      banner={{ imageUrl: event.coverUrl, gradient: "steel", credit: event.coverUrl ? event.coverCredit : null }}
      className="h-[200px] rounded-card md:h-[230px]"
    >
      <div className="relative flex h-full items-end p-4 md:p-6">
        <EventMiniCard event={event} now={now} as="h2" />
      </div>
    </BannerFrame>
  );
}

function OffEventHeading() {
  return (
    <div className={`${cardClass} p-5 md:p-6`}>
      <p className={`${eyebrow} text-text-faint`}>Not tied to an event</p>
      <h2 className="mt-3 font-display text-h4 font-light text-text">On sale all year</h2>
      <p className="mt-2 max-w-xl text-small text-text-muted">
        These spaces are not attached to a conference or a trip, so they run whenever your campaign needs them.
      </p>
    </div>
  );
}

/**
 * The exit, and the point of the whole page: from one creator's spaces to every
 * creator at the same event.
 *
 * It is given the width of the grid above it on purpose. A brand that reads
 * this creator's cards and is not convinced has exactly one useful next move,
 * and burying it under the fold sends them back to X instead.
 */
function EventJump({ event, othersAtEvent }: { event: EventSummary; othersAtEvent: number }) {
  const others = othersAtEvent > 0;
  return (
    <Link
      href={eventPath(event.slug)}
      className="group mt-6 flex items-center justify-between gap-4 rounded-card border border-amber/40 bg-amber/[0.07] p-5 transition-colors duration-180 hover:bg-amber/[0.12] md:p-6"
    >
      <span className="min-w-0">
        <span className={`${eyebrow} text-amber`}>{others ? "More at this event" : "The event"}</span>
        <span className="mt-2 block break-words font-display text-h4 font-light text-text [overflow-wrap:anywhere]">
          {otherCreatorsLine(othersAtEvent, event.name)}
        </span>
        <span className="mt-1 block text-small text-text-muted">
          {others
            ? "Compare what they carry, post and host, then pay whoever fits the campaign."
            : "Every space anyone has opened for it, on one page."}
        </span>
      </span>
      <span
        aria-hidden
        className="shrink-0 text-h4 text-amber transition-transform duration-180 group-hover:translate-x-1"
      >
        &rarr;
      </span>
    </Link>
  );
}
