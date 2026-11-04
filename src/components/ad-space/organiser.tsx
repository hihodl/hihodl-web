import Link from "next/link";

import { cardServiceName, closesText, eventDates, usdFromCents } from "@/lib/ad-space/format";
import type { CalendarEvent, CalendarLink, EventOrganiser, EventPartner, Space, SpaceCard, SpaceTab } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";

import { TAB_NAME, eventPath, tabSubtitle } from "./events";
import { PackageActions } from "./PackageActions";
import { card as cardClass, eyebrow } from "./ui";

/**
 * An event's own sponsor packages, sold by the host who proved on Luma that the
 * event is theirs (organiser-sells-its-event-contract.md). Drawn on the sponsor
 * page and above the tabs of the event page.
 *
 * Server components; the buttons are one client island per package, which
 * opens the same Checkout, OfferSheet and EnquirySheet a listing page opens.
 */

/** Who stands behind the packages: the company when they sell for one, else the person. */
export function hostName(o: EventOrganiser): string {
  return o.businessName?.trim() || o.name;
}

/**
 * HOLD's statement that this person hosts the event, the way the business mark
 * says who sells: a hairline pill with words, never a platform's check.
 */
export function VerifiedHostPill({ organiser, className = "" }: { organiser: EventOrganiser; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] border border-sp-ink/25 bg-sp-ink/[0.06] px-2.5 text-tiny font-medium text-sp-ink ${className}`}
      title={t("publicPages.sponsor.verifiedHostAbout", { name: hostName(organiser) })}
    >
      {/* A ticket, not a check: what was verified is who runs the door. */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 0 3V11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.5a1.5 1.5 0 0 0 0-3Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M6 8.1 7.3 9.4 10 6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("publicPages.sponsor.verifiedHost")}
    </span>
  );
}

/** "Hosted by Solana Spaces" with the face and the pill, on one line that wraps. */
export function HostLine({ organiser }: { organiser: EventOrganiser }) {
  const name = hostName(organiser);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {organiser.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the host's avatar, from our own bucket or X
        <img
          src={organiser.avatarUrl}
          alt=""
          width={24}
          height={24}
          referrerPolicy="no-referrer"
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : null}
      <span className="min-w-0 truncate text-small text-white/85">{t("publicPages.sponsor.hostedBy", { name })}</span>
      <VerifiedHostPill organiser={organiser} />
    </div>
  );
}

/**
 * "Partners": who the host took on a partnership package, logo and name, the
 * way a sponsor wall reads. Nothing at all while there are none.
 */
export function PartnersRow({ partners, className = "" }: { partners: EventPartner[] | undefined; className?: string }) {
  const list = (partners ?? []).filter((p) => p.name.trim());
  if (list.length === 0) return null;
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
      <span className="text-tiny text-sp-ink/80">{t("publicPages.sponsor.partners")}</span>
      <ul className="flex min-w-0 flex-wrap items-center gap-2">
        {list.map((p, i) => (
          <li
            key={`${p.name}-${i}`}
            className="inline-flex h-7 min-w-0 max-w-[220px] items-center gap-1.5 rounded-[14px] border border-sp-ink/15 bg-sp-ink/[0.04] pl-1 pr-2.5"
          >
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the partner's logo, from our own bucket
              <img src={p.logoUrl} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full bg-white object-contain" />
            ) : (
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sp-ink/10 text-[10px] font-medium text-sp-ink">
                {p.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-tiny text-sp-ink">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The host's packages, one row each. `spaces` holds the full listing behind a
 * card when it could be read, keyed by space id; without it a row still links
 * to the package's own page, where every way to buy is.
 */
export function OrganiserPackages({
  organiser,
  packages,
  spaces,
  now,
  headingAs: Heading = "h2",
  calendar = false,
}: {
  organiser: EventOrganiser;
  packages: SpaceCard[];
  spaces: Record<string, Space>;
  now: number;
  headingAs?: "h1" | "h2";
  /** A Luma calendar's packages: nothing open points at its events, not at creators. */
  calendar?: boolean;
}) {
  const name = hostName(organiser);
  return (
    <section aria-labelledby="host-packages">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Heading id="host-packages" className="font-display text-h4 font-light text-sp-ink md:text-h3">
          {t("publicPages.sponsor.packages")}
        </Heading>
        <VerifiedHostPill organiser={organiser} />
      </div>
      <p className="mt-2 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">
        {t("publicPages.sponsor.packagesSub", { name })}
      </p>
      {packages.length === 0 ? (
        <p className="mt-6 text-small text-sp-ink/85">
          {calendar ? t("publicPages.sponsor.calendar.noPackages") : t("publicPages.sponsor.noPackages")}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {packages.map((c) => (
            <li key={c.spaceId}>
              <PackageRow card={c} space={spaces[c.spaceId] ?? null} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PackageRow({ card: c, space, now }: { card: SpaceCard; space: Space | null; now: number }) {
  const closed = c.status !== "live" || Date.parse(c.closesAt) <= now;
  const service = cardServiceName(c);
  return (
    <div className={`${cardClass} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-5`}>
      <div className="min-w-0">
        <Link href={c.path} className="block break-words text-body text-sp-ink [overflow-wrap:anywhere] hover:text-sp-amber">
          {c.title}
        </Link>
        {service && service !== c.title && <p className="mt-0.5 truncate text-small text-sp-ink/85">{service}</p>}
        <p className="mt-1 text-tiny text-sp-ink/80">
          <span className="tabular-nums">
            {t("publicPages.sponsor.open", { open: fmtNumber(c.totals.open), total: fmtNumber(c.totals.positions) })}
          </span>{" "}
          · {closesText(c.closesAt, closed, now)}
        </p>
        <PartnersRow partners={c.partners ?? space?.partners} className="mt-3" />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 sm:justify-end">
        {!closed && c.fromPriceCents !== null && (
          <span className="min-w-0">
            <span className="block text-tiny text-sp-ink/80">{t("offers.events.from")}</span>
            <span className="font-display text-h4 font-light tabular-nums text-sp-ink">{usdFromCents(c.fromPriceCents)}</span>
          </span>
        )}
        <PackageActions path={c.path} space={closed ? null : space} />
      </div>
    </div>
  );
}

/** "Creators going": the event page's three tabs as counts, each a link into its tab. */
export function CreatorsGoing({
  slug,
  eventName,
  counts,
}: {
  slug: string;
  eventName: string;
  counts: Record<SpaceTab, number>;
}) {
  const tabs: SpaceTab[] = ["ground", "feed", "room"];
  return (
    <section aria-labelledby="creators-going">
      <p className={`${eyebrow} text-sp-ink/80`}>{t("publicPages.sponsor.creatorsGoing")}</p>
      <h2 id="creators-going" className="mt-2 max-w-2xl font-display text-h4 font-light text-sp-ink md:text-h3">
        {t("publicPages.sponsor.creatorsSub")}
      </h2>
      <nav aria-label={t("publicPages.sponsor.creatorsGoing")} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tabs.map((tab) => (
          <Link
            key={tab}
            href={`${eventPath(slug)}?tab=${tab}`}
            className="group flex min-w-0 flex-col gap-1 rounded-card border border-[color:var(--color-hairline)] bg-sp-ink/[0.02] p-4 transition-colors duration-180 hover:bg-sp-ink/[0.05] md:p-5"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-body text-sp-ink group-hover:text-sp-amber">{TAB_NAME[tab]}</span>
              <span className="text-tiny tabular-nums text-sp-ink/80">{t("offers.events.spaceCount", { count: counts[tab] })}</span>
            </span>
            <span className="break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">{tabSubtitle(tab, eventName)}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

/**
 * "Events in this calendar": a calendar's upcoming events, soonest first, each
 * linking to its Luma page, with "On HOLD" when a Spaces event names it. The
 * day and time are the event's own, read off its offset, never converted.
 */
export function CalendarEvents({ calendarName, events }: { calendarName: string; events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="calendar-events">
      <h2 id="calendar-events" className="font-display text-h4 font-light text-sp-ink md:text-h3">
        {t("publicPages.sponsor.calendar.events")}
      </h2>
      <p className="mt-2 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">
        {t("publicPages.sponsor.calendar.eventsSub", { name: calendarName })}
      </p>
      <ul className="mt-6 flex flex-col divide-y divide-[color:var(--color-hairline)] rounded-card border border-[color:var(--color-hairline)] bg-sp-ink/[0.02]">
        {events.map((e, i) => {
          const day = e.startAt ? e.startAt.slice(0, 10) : null;
          const time = e.startAt && /T\d{2}:\d{2}/.test(e.startAt) ? e.startAt.slice(11, 16) : null;
          return (
            <li key={`${e.lumaUrl}-${i}`} className="flex min-w-0 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-5">
              <div className="min-w-0">
                <a
                  href={e.lumaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-words text-body text-sp-ink [overflow-wrap:anywhere] hover:text-sp-amber"
                >
                  {e.name}
                </a>
                {day && (
                  <p className="mt-0.5 text-tiny tabular-nums text-sp-ink/80">
                    {eventDates(day, day)}
                    {time ? ` · ${time}` : ""}
                  </p>
                )}
              </div>
              {e.onHold && (
                <span className="inline-flex h-6 shrink-0 items-center self-start whitespace-nowrap rounded-[12px] border border-sp-ink/25 bg-sp-ink/[0.06] px-2.5 text-tiny font-medium text-sp-ink sm:self-center">
                  {t("publicPages.sponsor.calendar.onHold")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Sponsor the whole <calendar>": an event's way to the week it belongs to, when its host sells it. */
export function SponsorTheWeek({ calendar }: { calendar: CalendarLink | null }) {
  if (!calendar || calendar.packages <= 0) return null;
  return (
    <Link
      href={`/sponsor/${encodeURIComponent(calendar.key)}`}
      className="group flex min-w-0 items-center justify-between gap-4 rounded-card border border-[color:var(--color-hairline)] bg-sp-ink/[0.03] p-4 transition-colors duration-180 hover:bg-sp-ink/[0.06] md:p-5"
    >
      <span className="min-w-0">
        <span className="block break-words text-body text-sp-ink [overflow-wrap:anywhere] group-hover:text-sp-amber">
          {t("publicPages.sponsor.calendar.wholeWeek", { name: calendar.name })}
        </span>
        <span className="mt-0.5 block text-small text-sp-ink/85">{t("publicPages.sponsor.calendar.wholeWeekSub")}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-sp-ink/80 group-hover:text-sp-amber">
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
