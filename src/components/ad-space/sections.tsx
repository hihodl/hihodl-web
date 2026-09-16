import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";
import {
  CHAIN_LABEL,
  DELIVERABLE_STATE_LABEL,
  FALLBACK_TEXT,
  SESSION_FALLBACK_TEXT,
  VERIFIED_LABEL,
  accountAge,
  attestationText,
  calendarDate,
  compactNumber,
  deliverableText,
  eventDates,
  isSessionSpace,
  relativeTime,
  spaceSoldOut,
  takeableSpots,
  takeoverVerb,
  trackRecordNeedsAttention,
  trackRecordText,
  usdFromCents,
} from "@/lib/ad-space/format";
import type { Creator, DeliverableState, Space } from "@/lib/ad-space/types";

import { ClosesCountdown } from "./ClosesCountdown";
import { SpaceSiblings } from "./events";
import { btnSmallSecondary, card, eyebrow, pill } from "./ui";

/* ── Chrome ────────────────────────────────────────────────────────── */

/**
 * A slim header, not the site nav. Somebody arriving from a post on X came to
 * look at one board and maybe pay for a spot; five product menus above it are
 * five ways out of the page.
 */
export function SlimHeader() {
  return (
    <header className="container-page flex h-16 items-center justify-between gap-4">
      <Link href="/" className="flex items-center text-text" aria-label="Home">
        <Wordmark className="h-5 w-auto" />
      </Link>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </header>
  );
}

export function SpaceFooter({ space }: { space: Space }) {
  const report = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report HiSpace ${space.id}`)}`;
  return (
    <footer className="hairline">
      <div className="container-page flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <Wordmark className="h-5 w-auto self-start text-text" />
          <p className="text-small text-text-muted">
            Powered by HOLD. {isSessionSpace(space) ? "Clients" : "Sponsors"} pay creators directly in USDC, and HOLD
            never holds the money.
          </p>
          {/* Said once. With an invite link on the page, SpaceInvite says it, and says it better. */}
          {!space.creatorInvite && (
            <p className="text-small text-text-faint">Have an audience? Sell your own HiSpace from the HOLD app.</p>
          )}
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-small" aria-label="HiSpace">
          <DownloadLink className="text-text-muted transition-colors duration-180 hover:text-text">Get HOLD</DownloadLink>
          <a href={report} className="text-text-muted transition-colors duration-180 hover:text-text">
            Report this HiSpace
          </a>
          <Link href="/terms" className="text-text-muted transition-colors duration-180 hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="text-text-muted transition-colors duration-180 hover:text-text">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────── */

export function SpaceHero({ space }: { space: Space }) {
  const { totals } = space;
  const session = isSessionSpace(space);
  const noun = session ? "sessions" : space.kind === "service" ? "slots" : "spots";
  const soldWord = session ? "booked" : "sold";
  const isTakeover = space.pricingMode === "takeover";
  /* With no set prices (offers) or prices still being bid up, "of $X" would
     name a total nobody has agreed to. */
  const namesPrice = space.pricingMode === "offers" || space.pricingMode === "bids";

  /* On a takeover board a sold spot is not gone — it can be bought from the
     sponsor holding it. So "sold out" is only true here when there is nothing
     left to take: every spot has an owner AND every ladder has stopped. Counting
     sold spots as unavailable would turn the whole mechanic into a closed sign.
     The link card and the meta description count the same way. */
  const takeable = takeableSpots(space);
  const soldOut = spaceSoldOut(space);
  /* The bar tracks whatever the headline counts, so the two can never disagree. */
  const headline = isTakeover ? takeable : totals.sold;
  const headlineLabel = `${headline} of ${totals.positions} ${noun} ${isTakeover ? "still up for grabs" : soldWord}`;
  const what = session
    ? space.template.name
    : space.kind === "service"
      ? `Sponsored ${space.template.name.toLowerCase()}`
      : `Ad Space on a ${space.template.name.toLowerCase()}`;

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
      <div className="container-page relative pb-14 pt-8 md:pb-20 md:pt-14">
        <SpaceSiblings siblings={space.siblings} />
        <p className={`${eyebrow} break-words text-amber [overflow-wrap:anywhere]`}>
          {[space.eventName, what].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-5 max-w-4xl break-words font-display text-[40px] font-light leading-[1.05] text-text [overflow-wrap:anywhere] md:text-h1">
          {space.title}
        </h1>
        {space.reason && <p className="mt-5 max-w-2xl text-body text-text-muted md:text-lead">{space.reason}</p>}

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CreatorCard creator={space.creator} />

          <div className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-text">
                {soldOut ? (
                  <span className="font-display text-h3 font-light text-amber">
                    {isTakeover ? "Every spot settled" : session ? "Fully booked" : "Sold out"}
                  </span>
                ) : (
                  <>
                    <span className="font-display text-h3 font-light">{headline}</span>
                    <span className="text-body text-text-muted">
                      {" "}
                      of {totals.positions} {noun} {isTakeover ? "still up for grabs" : soldWord}
                    </span>
                  </>
                )}
              </p>
              <p className="text-small">
                <span className="font-mono text-text">{usdFromCents(totals.committedCents)}</span>
                {/* A takeover board has no ceiling to measure against: every
                    takeover raises the total, so "of" would name a number
                    that is already out of date by the next sponsor. */}
                <span className="text-text-faint">
                  {isTakeover || namesPrice ? " committed so far" : ` committed of ${usdFromCents(totals.totalCents)}`}
                </span>
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-[4px] bg-white/[0.06]"
              role="progressbar"
              aria-label={headlineLabel}
              aria-valuemin={0}
              aria-valuemax={totals.positions}
              aria-valuenow={headline}
            >
              <div
                className="h-full rounded-[4px] bg-amber"
                style={{ width: `${totals.positions ? Math.min(100, (headline / totals.positions) * 100) : 0}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-small">
              <ClosesCountdown closesAt={space.closesAt} closed={space.status !== "live"} />
              <span className="text-text-faint">
                Paid in USDC on {space.chains.map((c) => CHAIN_LABEL[c]).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorCard({ creator: c }: { creator: Creator }) {
  const age = accountAge(c.xAccountCreatedAt);
  return (
    <div className={`${card} flex items-start gap-4 p-5 md:p-6`}>
      <Avatar creator={c} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-text">{c.xName}</p>
        <a
          href={`https://x.com/i/user/${encodeURIComponent(c.xUserId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small text-text-muted transition-colors duration-180 hover:text-amber"
        >
          @{c.xHandle}
        </a>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.xVerifiedType ? (
            <span className={pill.neutral}>{VERIFIED_LABEL[c.xVerifiedType]}</span>
          ) : (
            <span className={pill.neutral}>No X checkmark</span>
          )}
          {c.xIdentityVerified && <span className={pill.done}>ID verified by X</span>}
        </div>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-small">
          <Fact label="Followers" value={compactNumber(c.xFollowers)} />
          {age && <Fact label="On X" value={age.replace(/ on X$/, "")} />}
          <Fact
            label="Track record"
            value={trackRecordText(c.trackRecord)}
            tone={trackRecordNeedsAttention(c.trackRecord) ? "attention" : undefined}
          />
        </dl>
      </div>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "attention" }) {
  return (
    <>
      <dt className="whitespace-nowrap text-text-faint">{label}</dt>
      <dd className={tone === "attention" ? "text-amber" : "text-text"}>{value}</dd>
    </>
  );
}

function Avatar({ creator: c }: { creator: Creator }) {
  if (c.xAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img
        src={c.xAvatarUrl}
        alt=""
        width={56}
        height={56}
        referrerPolicy="no-referrer"
        className="h-14 w-14 shrink-0 rounded-full border border-[color:var(--color-hairline-strong)] object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-blue-deep text-h4 font-light text-text"
      aria-hidden
    >
      {(c.xName || c.xHandle).slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ── Takeovers ─────────────────────────────────────────────────────── */

/**
 * The mechanic, said once, immediately above the spots it prices.
 *
 * A sponsor meets these prices on the cards, so the explanation belongs where
 * they are and not with the trust copy further down. Nothing renders on a
 * fixed-price space: the product there is the one it has always been.
 */
export function SpaceTakeover({ space }: { space: Space }) {
  if (space.pricingMode !== "takeover") return null;

  return (
    <section
      aria-label="How takeovers work"
      className={`${card} mb-10 flex flex-col gap-3 p-5 md:p-6`}
    >
      <h2 className={`${eyebrow} text-moonlight`}>Any spot can change hands</h2>
      <p className="max-w-3xl text-small text-text-muted">
        The price on a spot is where bidding opens, not what it will sell for. Once a spot is sold, anyone can take it
        from the sponsor holding it, and doing so {takeoverVerb(space.takeoverMultiple)}. Each card says what taking
        that spot costs today.
      </p>
      <p className="max-w-3xl text-small text-text-muted">
        The sponsor who loses a spot gets back every cent they paid
        {space.feePayer === "sponsor" ? `, HOLD's ${space.feeBps / 100}% fee included,` : ""} in the very same
        transaction that displaces them. Nobody holds that money in between: repaying them is one leg of the new
        sponsor&rsquo;s payment, and if that leg fails the payment fails with it.
      </p>
      {/* Only worth saying where there is a choice of chain to get wrong. */}
      {space.chains.length > 1 && (
        <p className="max-w-3xl text-small text-text-faint">
          A spot changes hands on the chain it was bought on, because the refund travels in that same transaction.
        </p>
      )}
    </section>
  );
}

/**
 * How a sponsor names the price (hispace-offers-v0.md), said once above the
 * spots. Nothing renders on a space that takes no offers.
 */
export function SpaceOffersHowItWorks({ space }: { space: Space }) {
  const mode =
    space.pricingMode === "bids"
      ? "bids"
      : space.pricingMode === "offers"
        ? "offers"
        : space.pricingMode === "fixed" && space.acceptsOffers
          ? "fixed_with_offers"
          : null;
  if (!mode) return null;
  const who = `@${space.creator.xHandle}`;

  return (
    <section aria-label="How offers work" className={`${card} mb-10 flex flex-col gap-3 p-5 md:p-6`}>
      <h2 className={`${eyebrow} text-moonlight`}>
        {mode === "bids" ? "Bid for a spot" : mode === "offers" ? "Name your price" : "Buy now, or make an offer"}
      </h2>
      <p className="max-w-3xl text-small text-text-muted">
        {mode === "bids"
          ? `Each spot is its own bidding. The highest bid backed by a wallet that holds the money leads, and a bid in the last 10 minutes gives everyone 10 more. When bidding ends, ${who} accepts a bid.`
          : mode === "offers"
            ? `There is no set price. Offer what the spot is worth to you, and ${who} accepts, counters or declines.`
            : `Every spot has a price you can pay now. If it's more than you want to spend, offer less, and ${who} accepts, counters or declines.`}
      </p>
      <p className="max-w-3xl text-small text-text-muted">
        Nothing you offer is paid or locked. If your {mode === "bids" ? "bid" : "offer"} is accepted, you have 24 hours
        to pay it from any wallet, straight to the creator, and it goes through like any other sponsorship. Neither side
        is bound to go ahead.
      </p>
    </section>
  );
}

/* ── Promises ──────────────────────────────────────────────────────── */

const STATE_PILL: Record<DeliverableState, string> = {
  upcoming: pill.neutral,
  overdue: pill.attention,
  delivered: pill.done,
  missed: pill.attention,
};

export function SpacePromises({ space }: { space: Space }) {
  const hasDeliverables = space.deliverables.length > 0;
  const declares = space.attestations.map(attestationText);
  const session = isSessionSpace(space);
  return (
    <section className="relative bg-night">
      <div className="container-page py-16 md:py-24">
        <p className={`${eyebrow} text-moonlight`}>Before you pay</p>
        <h2 className="mt-4 font-display text-h3 font-light text-text md:text-h2">What the creator promises</h2>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Block title={session ? "How a session is confirmed" : space.kind === "service" ? "Delivery" : "Deliverables"}>
            {session && (
              <>
                <p className="text-small text-text-muted">
                  Every session happens
                  {space.event ? (
                    <>
                      {" "}
                      at <span className="text-text">{space.event.name}</span>,{" "}
                      {eventDates(space.event.startsOn, space.event.endsOn)},
                    </>
                  ) : space.eventName ? (
                    <>
                      {" "}
                      at <span className="text-text">{space.eventName}</span>,
                    </>
                  ) : null}{" "}
                  at the venue or in a public place. The creator sets the time and place with you after you book.
                </p>
                <p className="text-small text-text-muted">
                  After it, you tell us whether it happened from your booking link. Only a session you confirm counts
                  as delivered on the creator&rsquo;s track record, and one that didn&rsquo;t happen shows there as
                  disputed. If you say nothing within 7 days, the booking closes.
                </p>
              </>
            )}
            {!session && space.kind === "service" && space.deliverBy && (
              <p className="text-small text-text-muted">
                Every sold slot is delivered by{" "}
                <span className="text-text">{calendarDate(space.deliverBy)}</span>, each with its own public link on
                this page.
              </p>
            )}
            {hasDeliverables ? (
              <ul className="flex flex-col divide-y divide-[color:var(--color-hairline)]">
                {space.deliverables.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-small text-text">{deliverableText(d.kind, d.platform, d.count)}</p>
                      <p className="text-tiny text-text-faint">
                        Due {calendarDate(d.dueDate)}
                        {d.deliveredUrl && (
                          <>
                            {" · "}
                            <a
                              href={d.deliveredUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-success hover:underline"
                            >
                              See it
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <span className={STATE_PILL[d.state]}>{DELIVERABLE_STATE_LABEL[d.state]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              space.kind !== "service" && (
                <p className="text-small text-text-muted">The creator hasn&rsquo;t listed deliverables.</p>
              )
            )}
          </Block>

          <Block title="Key dates">
            <ul className="flex flex-col gap-3">
              {space.keyDates.map((k, i) => (
                <li key={`${k.date}-${i}`} className="flex items-baseline justify-between gap-4 text-small">
                  <span className="text-text">{k.label}</span>
                  <span className="shrink-0 font-mono text-text-muted">{calendarDate(k.date)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 text-small">
                <span className="text-text">{session ? "Booking closes" : "Sponsorship closes"}</span>
                <span className="shrink-0 font-mono text-text-muted">{calendarDate(space.closesAt)}</span>
              </li>
            </ul>
          </Block>

          <Block title={session ? "If the session can't happen" : "If a venue says no"}>
            <p className="text-small text-text-muted">
              {(session ? SESSION_FALLBACK_TEXT : FALLBACK_TEXT)[space.fallback]}
            </p>
            {space.fallbackNote && (
              <p className="border-l-2 border-amber/40 pl-3 text-small text-text">
                <span className="sr-only">The creator adds: </span>
                {space.fallbackNote}
              </p>
            )}
          </Block>

          <Block title="How the money moves">
            <p className="text-small text-text-muted">
              You pay the creator directly in USDC, from your own wallet. HOLD&rsquo;s fee is{" "}
              {space.feeBps / 100}%, paid by the {session && space.feePayer === "sponsor" ? "buyer" : space.feePayer}, and it moves in the same transaction. HOLD never
              holds your money, and {session ? "a booking" : "paid spots"} can&rsquo;t be refunded by HOLD.
            </p>
            {/* The two sentences above are true on a takeover board too, and
                together they read as a contradiction of the refund promised
                further up the page. The difference is worth one line: HOLD
                still refunds nobody — the sponsor taking the spot does. */}
            {space.pricingMode === "takeover" && (
              <p className="text-small text-text-muted">
                That holds when a spot changes hands, too. The money that goes back to a sponsor who has been outbid is
                not HOLD&rsquo;s to send: it is part of the payment made by whoever took the spot from them, moving in
                the same transaction.
              </p>
            )}
            {declares.length > 0 && (
              <p className="text-small text-text-muted">
                The creator declares that they {joinWords(declares)}.
              </p>
            )}
          </Block>
        </div>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <h3 className={`${eyebrow} text-text-faint`}>{title}</h3>
      {children}
    </div>
  );
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ── Updates ───────────────────────────────────────────────────────── */

export function SpaceUpdates({ space }: { space: Space }) {
  if (space.updates.length === 0) return null;
  const labelOf = new Map(space.positions.map((p) => [p.id, p.label]));
  const updates = [...space.updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const now = Date.now();

  return (
    <section className="container-page py-16 md:py-24">
      <p className={`${eyebrow} text-amber`}>From @{space.creator.xHandle}</p>
      <h2 className="mt-4 font-display text-h3 font-light text-text md:text-h2">Updates</h2>
      <ol className="mt-10 flex max-w-2xl flex-col gap-5">
        {updates.map((u) => (
          <li key={u.id} className={`${card} overflow-hidden`}>
            {u.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- creator photo from our own bucket
              <img src={u.imageUrl} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />
            )}
            <div className="flex flex-col gap-2 p-5">
              {u.body && <p className="whitespace-pre-line text-body text-text">{u.body}</p>}
              <p className="text-tiny text-text-faint">
                <time dateTime={u.createdAt}>{relativeTime(u.createdAt, now)}</time>
                {u.positionId && labelOf.get(u.positionId) ? ` · Proof for ${labelOf.get(u.positionId)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── The other reader ──────────────────────────────────────────────── */

/**
 * Two kinds of people read this page: sponsors, who buy, and creators, who see
 * it and want one of their own. This is the line for the second kind, and it is
 * deliberately the quietest thing on the page — a hairline strip of small muted
 * text above the footer, with a plain text link instead of a button. The amber
 * fill on this page means "sponsor this spot"; recruiting a creator must never
 * borrow it, or the page starts competing with the job it was built for.
 *
 * Nothing renders without an invite link: a draft has none, and neither does an
 * account old enough to predate invite codes.
 */
export function SpaceInvite({ space }: { space: Space }) {
  const invite = space.creatorInvite;
  if (!invite) return null;

  return (
    <section className="hairline" aria-label="Sell your own HiSpace">
      <div className="container-page flex flex-col gap-3 py-10 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        <p className="max-w-2xl text-small text-text-muted">
          {isSessionSpace(space)
            ? `@${space.creator.xHandle} sells their time at events on HOLD. You can too: clients pay you directly in USDC, and HOLD takes ${space.feeBps / 100}%.`
            : `@${space.creator.xHandle} sells sponsorships on HOLD. If you have an audience, you can too: sponsors pay you directly in USDC, and HOLD takes ${space.feeBps / 100}%.`}
        </p>
        <a
          href={invite.url}
          className="self-start whitespace-nowrap text-small text-text-muted underline-offset-4 transition-colors duration-180 hover:text-text hover:underline"
        >
          Sell your own HiSpace
        </a>
      </div>
    </section>
  );
}

/* ── When the API is down ──────────────────────────────────────────── */

export function SpaceUnavailable() {
  return (
    <section className="container-page flex min-h-[60vh] flex-col justify-center py-20">
      <p className={`${eyebrow} text-amber`}>HiSpace</p>
      <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
        We couldn&rsquo;t load this board just now.
      </h1>
      <p className="mt-5 max-w-xl text-body text-text-muted">
        This is on our side, not the link. Give it a moment and refresh the page.
      </p>
    </section>
  );
}
