import Link from "next/link";
import type { ReactNode } from "react";

import { DownloadLink } from "@/components/site/DownloadLink";
import { Wordmark } from "@/components/site/Wordmark";
import { SUPPORT_EMAIL } from "@/lib/ad-space/config";
import {
  CHAIN_LABEL,
  VERIFIED_LABEL,
  attestationText,
  calendarDate,
  compactNumber,
  fundingProgress,
  isSessionSpace,
  isTieredSpace,
  relativeTime,
  serviceName,
  spaceSoldOut,
  takeableSpots,
  onTimeText,
  trackRecordNeedsAttention,
  trackRecordText,
  usdFromCents,
} from "@/lib/ad-space/format";
import type { Creator, Position, Space } from "@/lib/ad-space/types";

import { ClosesCountdown } from "./ClosesCountdown";
import { creatorPath, creatorScreenPath } from "./creator";
import { SpaceSiblings } from "./events";
import { IfItDoesNotHappen } from "./IfItDoesNotHappen";
import { WhatTheBrandGets } from "./WhatTheBrandGets";
import { btnPrimary, btnSmallSecondary, card, eyebrow } from "./ui";

/**
 * The listing page, read by a sponsor who arrived from a creator's post on X.
 *
 * It is written like a brand deal page, not a protocol document: in five
 * seconds they must see what they get, what it costs, how much is left and how
 * to buy. So the numbers are big, every block is a line or two, and anything
 * longer sits behind an (i). How the money moves, and what HOLD charges, is said
 * once, in the checkout, where it is true to the amount being signed.
 */

/* ── Chrome ────────────────────────────────────────────────────────── */

/**
 * A slim header, not the site nav. Somebody arriving from a post on X came to
 * look at one board and maybe pay for a spot; five product menus above it are
 * five ways out of the page.
 */
export function SlimHeader() {
  return (
    <header className="container-page flex h-16 items-center justify-between gap-4">
      <Link href="/" className="flex items-center text-sp-ink" aria-label="Home">
        <Wordmark className="h-5 w-auto" />
      </Link>
      <DownloadLink className={btnSmallSecondary}>Get HOLD</DownloadLink>
    </header>
  );
}

/** The links a page needs, and the HOLD logo at the very bottom. Nothing to read. */
export function SpaceFooter({ space }: { space: Space }) {
  const report = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report HiSpace ${space.id}`)}`;
  const link = "text-sp-ink/80 transition-colors duration-180 hover:text-sp-ink";
  return (
    <footer className="hairline">
      <div className="container-page flex flex-col gap-6 py-10">
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-tiny" aria-label="HiSpace">
          <a href={report} className={link}>
            Report this HiSpace
          </a>
          <Link href="/terms" className={link}>
            Terms
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
        </nav>
        <Link href="/" aria-label="HOLD" className="self-start text-sp-ink/85 transition-colors duration-180 hover:text-sp-ink">
          <Wordmark className="h-5 w-auto" />
        </Link>
      </div>
    </footer>
  );
}

/* ── Head: what this is and whose it is ────────────────────────────── */

/**
 * The words at the top of the banner. The banner itself (the listing's own
 * picture, or its product, or its gradient) is drawn by `SpaceBoard`, because on
 * a placement the product IS the banner and it is the interactive part.
 */
export function ListingHead({ space }: { space: Space }) {
  const session = isSessionSpace(space);
  const name = serviceName(space);
  const custom = space.template.service?.custom === true;
  const what = session
    ? name
    : space.kind === "service"
      ? custom
        ? name
        : `Sponsored ${name.toLowerCase()}`
      : `Your brand on a ${name.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Back to this creator's own listings at the event, never the event's
          page: that one lists other creators, and this page sells for this one. */}
      {space.event && (
        <Link
          href={creatorScreenPath(space.creator.xHandle, space.event.slug)}
          className="inline-flex h-8 max-w-full items-center self-start overflow-hidden whitespace-nowrap rounded-[16px] bg-[#141F2E]/60 px-3 text-tiny text-white/85 backdrop-blur-md transition-colors duration-180 hover:bg-[#141F2E]/80 hover:text-white"
        >
          <span aria-hidden className="mr-1.5">
            &larr;
          </span>
          <span className="truncate">
            All of @{space.creator.xHandle} at {space.event.name}
          </span>
        </Link>
      )}
      <div>
        <p className={`${eyebrow} break-words text-sp-amber [overflow-wrap:anywhere]`}>
          {[space.event?.name ?? space.eventName, what].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-3 max-w-4xl break-words font-display text-[40px] font-light leading-[1.05] text-sp-ink [overflow-wrap:anywhere] md:text-h1">
          {space.title}
        </h1>
        {space.reason && (
          <p className="mt-4 max-w-2xl break-words text-body text-sp-ink/85 [overflow-wrap:anywhere] md:text-lead">
            {space.reason}
          </p>
        )}
      </div>
      <CreatorChip creator={space.creator} />
      <InspiredByCredit credit={space.inspiredBy ?? null} />
      <SpaceSiblings siblings={space.siblings} handle={space.creator.xHandle} eventName={space.event?.name ?? space.eventName} />
    </div>
  );
}

/**
 * "Inspired by @handle": a creator crediting another, and the one place this
 * page links to somebody else, on purpose: it is recognition between
 * creators, not a way off the page. A HOLD creator goes to their page, an X
 * handle to x.com. The link is built here from the handle, never taken as a
 * URL from the server.
 */
function InspiredByCredit({ credit }: { credit: NonNullable<Space["inspiredBy"]> | null }) {
  if (!credit || !/^[A-Za-z0-9_.]{1,40}$/.test(credit.handle)) return null;
  const hold = credit.kind === "hold";
  const href = hold ? creatorPath(credit.handle) : `https://x.com/${encodeURIComponent(credit.handle)}`;
  const cls = "text-sp-ink transition-colors duration-180 hover:text-sp-amber";
  return (
    <p className="-mt-2 text-tiny text-sp-ink/85">
      Inspired by{" "}
      {hold ? (
        <Link href={href} className={cls}>
          @{credit.handle}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          @{credit.handle}
        </a>
      )}
    </p>
  );
}

function CreatorChip({ creator: c }: { creator: Creator }) {
  const attention = trackRecordNeedsAttention(c.trackRecord);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar creator={c} />
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-small">
          <span className="truncate text-sp-ink">{c.xName}</span>
          <a
            href={`https://x.com/i/user/${encodeURIComponent(c.xUserId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sp-ink/85 transition-colors duration-180 hover:text-sp-amber"
          >
            @{c.xHandle}
          </a>
        </p>
        <p className="text-tiny text-sp-ink/85">
          {[
            `${compactNumber(c.xFollowers)} followers`,
            c.xVerifiedType ? VERIFIED_LABEL[c.xVerifiedType] : null,
            c.xIdentityVerified ? "ID verified by X" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {" · "}
          <span className={attention ? "text-sp-amber" : "text-sp-ink"}>{trackRecordText(c.trackRecord)}</span>
          {onTimeText(c.trackRecord) ? <span className="text-sp-ink">{` · ${onTimeText(c.trackRecord)}`}</span> : null}
        </p>
      </div>
    </div>
  );
}

function Avatar({ creator: c }: { creator: Creator }) {
  if (c.xAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
      <img
        src={c.xAvatarUrl}
        alt=""
        width={44}
        height={44}
        referrerPolicy="no-referrer"
        className="h-11 w-11 shrink-0 rounded-full border border-[color:var(--color-hairline-strong)] object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blue-deep text-body text-sp-ink"
      aria-hidden
    >
      {(c.xName || c.xHandle).slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ── The numbers: money, what's left, the price, the dates ─────────── */

/** "131.25" to 13125. Server strings only; a malformed one is simply skipped. */
function centsOf(usdc: string | null | undefined): number | null {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec((usdc ?? "").replace(/,/g, ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0").slice(0, 2));
}

/**
 * The cheapest thing a sponsor can buy right now, as they would pay it: the
 * price on an open spot, what taking a spot over costs, or where bidding opens.
 * Null when nothing left carries a price (a space sold by offers).
 */
function startingPrice(space: Space): { label: string; value: string } | null {
  let least: number | null = null;
  let bids = false;
  const consider = (usdc: string | null | undefined) => {
    const c = centsOf(usdc);
    if (c !== null && c > 0 && (least === null || c < least)) least = c;
  };
  for (const p of space.positions) {
    if (p.status === "open") {
      if (p.offers?.mode === "bids" || p.saleMode === "bids") {
        bids = true;
        consider(p.offers?.highestBidUsdc ?? p.offers?.openingBidUsdc ?? p.sponsorPaysUsdc);
      } else consider(p.sponsorPaysUsdc);
    } else if (p.status === "sold" && p.takeover && !p.takeover.closed) {
      consider(p.takeover.nextSponsorPaysUsdc);
    }
  }
  if (least === null) return null;
  const allBids = bids && space.pricingMode === "bids";
  return { label: allBids ? "Bids from" : "Starting price", value: `from ${usdFromCents(least)}` };
}

/** A segment per spot: sold, being paid, open — and on a takeover board, taken but still takeable. */
function segmentTone(p: Position, takeover: boolean): "sold" | "held" | "open" | "takeable" {
  if (p.status === "open") return "open";
  if (p.status === "held") return "held";
  if (takeover && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc) return "takeable";
  return "sold";
}

const SEGMENT: Record<ReturnType<typeof segmentTone>, string> = {
  sold: "bg-amber",
  takeable: "bg-amber/40",
  held: "bg-amber/20",
  open: "bg-moonlight/30",
};

/**
 * The block a sponsor reads first, modelled on the creator's own campaign page:
 * the money committed and what is left, in big type, a bar with one segment per
 * spot, then the price, the close and the dates in one row, and the button.
 */
export function SpaceStats({ space }: { space: Space }) {
  const { totals } = space;
  const session = isSessionSpace(space);
  const isTakeover = space.pricingMode === "takeover";
  const tiered = isTieredSpace(space);
  const noun = session ? "sessions" : space.kind === "service" ? (tiered ? "packages" : "slots") : "spots";
  const closed = space.status !== "live";
  const soldOut = spaceSoldOut(space);
  const left = takeableSpots(space);
  const funding = fundingProgress(space);
  /* Offers and bids have no listed total: "$0 committed" before the first sale
     would read as a space nobody wants, so the money figure waits for a sale. */
  const noTotal = totals.totalCents === null || space.pricingMode === "offers" || space.pricingMode === "bids";
  const money = funding
    ? { label: "Raised", value: funding.raised, sub: `of ${funding.goal} goal · ${funding.percent}%` }
    : !noTotal || totals.committedCents > 0
      ? { label: "Backed by brands", value: usdFromCents(totals.committedCents), sub: null }
      : null;
  const price = startingPrice(space);
  const segments = space.positions.map((p) => segmentTone(p, isTakeover));
  const cta = session ? "Book a session" : space.kind === "service" ? `Claim your ${tiered ? "package" : "slot"}` : "Claim your spot";

  const facts: { label: string; value: ReactNode }[] = [];
  if (price) facts.push({ label: price.label, value: price.value });
  else if (!soldOut) facts.push({ label: "Price", value: "Name your price" });
  facts.push({
    label: session ? "Booking closes" : "Sales close",
    value: (
      <>
        {calendarDate(space.closesAt)}
        <span className="block text-tiny text-sp-ink/80">
          {closed ? "Closed" : <ClosesCountdown closesAt={space.closesAt} closed={closed} />}
        </span>
      </>
    ),
  });
  for (const k of space.keyDates.slice(0, 2)) facts.push({ label: k.label, value: calendarDate(k.date) });
  if (facts.length < 4) facts.push({ label: "Pay with", value: `USDC · ${space.chains.map((c) => CHAIN_LABEL[c]).join(", ")}` });

  return (
    <section className="container-page py-10 md:py-14" aria-label="Availability">
      <div className={`${card} flex flex-col gap-7 p-5 md:p-8`}>
        <div className={`grid gap-6 ${money ? "grid-cols-2" : "grid-cols-1"}`}>
          {money && (
            <Stat label={money.label} value={money.value} sub={money.sub} />
          )}
          {soldOut ? (
            <Stat
              label="Available"
              value={isTakeover ? "Settled" : session ? "Fully booked" : "Sold out"}
              sub={`All ${totals.positions} ${noun} taken`}
            />
          ) : (
            <Stat
              label={isTakeover ? "Up for grabs" : "Available"}
              value={String(left)}
              of={`of ${totals.positions}`}
              sub={session ? "sessions" : space.kind === "service" ? "slots" : "spots"}
            />
          )}
        </div>

        {segments.length > 0 && segments.length <= 60 ? (
          <div
            className="flex h-3 gap-[3px]"
            role="img"
            aria-label={`${left} of ${totals.positions} ${noun} available`}
          >
            {segments.map((tone, i) => (
              <span key={i} className={`h-full min-w-0 flex-1 rounded-[3px] ${SEGMENT[tone]}`} />
            ))}
          </div>
        ) : (
          <div className="h-3 overflow-hidden rounded-[6px] bg-moonlight/30" role="img" aria-label={`${left} of ${totals.positions} available`}>
            <div
              className="h-full bg-amber"
              style={{ width: `${totals.positions ? ((totals.positions - left) / totals.positions) * 100 : 0}%` }}
            />
          </div>
        )}

        <ul className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 text-tiny text-sp-ink/80" aria-hidden>
          {(isTakeover
            ? ([["sold", "Settled"], ["takeable", "Taken, can be taken over"], ["held", "Being paid"], ["open", "Open"]] as const)
            : ([["sold", session ? "Booked" : "Sold"], ["held", "Being paid"], ["open", "Open"]] as const)
          ).map(([tone, word]) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-[2px] ${SEGMENT[tone]}`} />
              {word}
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          {facts.slice(0, 4).map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className={`${eyebrow} break-words text-sp-ink/80`}>{f.label}</dt>
              <dd className="mt-1 break-words text-body text-sp-ink [overflow-wrap:anywhere]">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ModeNote space={space} />
          {!closed && !soldOut && (
            <a href="#spots" className={`${btnPrimary} self-start sm:self-auto`}>
              {cta}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, of, sub }: { label: string; value: string; of?: string; sub: string | null }) {
  return (
    <div className="min-w-0">
      <p className={`${eyebrow} text-sp-ink/80`}>{label}</p>
      <p className="mt-2 break-words font-display text-[40px] font-light leading-none text-sp-ink md:text-[64px]">
        {value}
        {of && <span className="text-[24px] text-sp-ink/85 md:text-[32px]"> {of}</span>}
      </p>
      {sub && <p className="mt-2 text-small text-sp-ink/85">{sub}</p>}
    </div>
  );
}

/**
 * How this space sells, when it is not a plain price: one line, and the rest
 * behind an (i). A plain fixed price needs no note.
 */
function ModeNote({ space }: { space: Space }) {
  const who = `@${space.creator.xHandle}`;
  const x = space.takeoverMultiple && space.takeoverMultiple !== 2 ? `${space.takeoverMultiple}x` : "double";
  if (space.pricingMode === "takeover") {
    return (
      <Note line={`Any spot can be taken: pay ${x} and it's yours.`}>
        <p>The price on a spot is where bidding opens. Once sold, anyone can take it from its sponsor for {x} the price.</p>
        <p>
          The sponsor who loses a spot gets back everything they paid, in the same transaction.
          {space.chains.length > 1 ? " A spot changes hands on the chain it was bought on." : ""}
        </p>
      </Note>
    );
  }
  if (space.pricingMode === "bids") {
    return (
      <Note line="Highest bid wins.">
        <p>Each spot is its own auction. A bid in the last 10 minutes adds 10 more. When bidding ends, {who} accepts a bid.</p>
        <p>Nothing is paid when you bid. If yours is accepted, you have 24 hours to pay.</p>
      </Note>
    );
  }
  if (space.pricingMode === "offers") {
    return (
      <Note line="No set price: make an offer.">
        <p>{who} accepts, counters or declines. Nothing is paid when you offer.</p>
        <p>If yours is accepted, you have 24 hours to pay.</p>
      </Note>
    );
  }
  if (space.acceptsOffers) {
    return (
      <Note line="Buy now, or make an offer.">
        <p>Offer less than the price and {who} accepts, counters or declines. Nothing is paid when you offer.</p>
        <p>If yours is accepted, you have 24 hours to pay.</p>
      </Note>
    );
  }
  return <span className="hidden sm:block" />;
}

/** One short line, with the details behind an (i). Works without JavaScript. */
export function Note({ line, children }: { line: string; children: ReactNode }) {
  return (
    <details className="group min-w-0 text-small">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sp-ink [&::-webkit-details-marker]:hidden">
        <span>{line}</span>
        <span
          aria-hidden
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] border border-[color:var(--color-hairline-strong)] font-mono text-[11px] text-sp-ink/85 transition-colors duration-180 group-open:bg-sp-ink/10 group-open:text-sp-ink"
        >
          i
        </span>
        <span className="sr-only">How it works</span>
      </summary>
      <div className="mt-3 flex max-w-xl flex-col gap-2 text-sp-ink/85">{children}</div>
    </details>
  );
}

/* ── Before you pay: what you get, and what if it doesn't happen ───── */

export function BeforeYouPay({ space }: { space: Space }) {
  const session = isSessionSpace(space);
  const declares = space.attestations.map(attestationText);
  return (
    <section className="container-page py-12 md:py-16" aria-labelledby="what-you-get">
      <p className={`${eyebrow} text-sp-cool`}>Before you pay</p>
      <h2 id="what-you-get" className="mt-3 font-display text-h3 font-light text-sp-ink md:text-h2">
        What you get
      </h2>
      {/* items-start: each card is as tall as what it says. Stretched to the
          taller column, a two-line list was a big empty box. */}
      <div className="mt-8 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WhatTheBrandGets space={space} />
        <div className="flex flex-col gap-5">
          <IfItDoesNotHappen space={space} />
          <Block title="Key dates">
            <ul className="flex flex-col gap-2.5">
              {space.keyDates.map((k, i) => (
                <li key={`${k.date}-${i}`} className="flex items-baseline justify-between gap-4 text-small">
                  <span className="min-w-0 break-words text-sp-ink [overflow-wrap:anywhere]">{k.label}</span>
                  <span className="shrink-0 font-mono text-sp-ink/85">{calendarDate(k.date)}</span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 text-small">
                <span className="text-sp-ink">{session ? "Booking closes" : "Sales close"}</span>
                <span className="shrink-0 font-mono text-sp-ink/85">{calendarDate(space.closesAt)}</span>
              </li>
            </ul>
          </Block>
        </div>
      </div>
      {declares.length > 0 && (
        <p className="mt-5 text-tiny text-sp-ink/80">
          @{space.creator.xHandle} declares that they {joinWords(declares)}.
        </p>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <h3 className={`${eyebrow} text-sp-ink/80`}>{title}</h3>
      {children}
    </div>
  );
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ── How it works: four steps ──────────────────────────────────────── */

type Step = { title: string; body: string };

function steps(space: Space): Step[] {
  const session = isSessionSpace(space);
  const tiered = isTieredSpace(space);
  const service = space.kind === "service";
  const thing = service ? (tiered ? "package" : "slot") : "spot";
  const chains = space.chains.map((c) => CHAIN_LABEL[c]).join(", ");
  const send = service
    ? { title: "Send your brief", body: "Right after paying, tell the creator what to feature." }
    : { title: "Send your logo", body: "Upload it right after paying. The creator approves it." };
  const last = service
    ? {
        title: "It goes live",
        body: space.deliverBy ? `Delivered by ${calendarDate(space.deliverBy)}, linked on this page.` : "Each delivery is linked on this page.",
      }
    : { title: "Ride along", body: "Your brand goes where the creator goes, in front of their audience, in every post listed above." };

  if (session) {
    return [
      { title: "Book a session", body: "Pick one below." },
      { title: "Pay in USDC", body: `From any wallet, on ${chains}.` },
      { title: "Send your contact", body: "The creator sets the time and place with you." },
      { title: "Meet, then confirm", body: "Only a session you confirm counts as delivered." },
    ];
  }
  if (space.pricingMode === "takeover") {
    return [
      { title: `Pick a ${thing}`, body: "An open one, or one somebody already holds." },
      { title: "Pay in USDC", body: "Taking a held spot pays its sponsor back in full." },
      send,
      { title: "Hold it", body: "It's yours until someone pays more for it." },
    ];
  }
  if (space.pricingMode === "bids") {
    return [
      { title: "Place a bid", body: "Nothing is paid or locked." },
      { title: "Highest bid wins", body: "The creator accepts a bid when bidding ends." },
      { title: "Pay within 24 hours", body: `In USDC, from any wallet, on ${chains}.` },
      send,
    ];
  }
  if (space.pricingMode === "offers") {
    return [
      { title: "Make an offer", body: "Name your price. Nothing is paid or locked." },
      { title: "The creator answers", body: "Accept, counter or decline." },
      { title: "Pay within 24 hours", body: `In USDC, from any wallet, on ${chains}.` },
      send,
    ];
  }
  return [
    { title: `Pick a ${thing}`, body: service ? "Pick one below." : "Tap an open spot on the drawing." },
    {
      title: "Pay in USDC",
      body: tiered ? "Or bid or offer, where a package says so." : `From any wallet, on ${chains}.`,
    },
    send,
    last,
  ];
}

export function HowItWorks({ space }: { space: Space }) {
  return (
    <section className="container-page py-12 md:py-16" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="font-display text-h3 font-light text-sp-ink md:text-h2">
        How it works
      </h2>
      <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps(space).map((s, i) => (
          <li key={s.title} className={`${card} flex flex-col gap-2 p-5`}>
            <span className="font-mono text-small text-sp-amber">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-body text-sp-ink">{s.title}</p>
            <p className="text-small text-sp-ink/85">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Updates ───────────────────────────────────────────────────────── */

export function SpaceUpdates({ space }: { space: Space }) {
  if (space.updates.length === 0) return null;
  const labelOf = new Map(space.positions.map((p) => [p.id, p.label]));
  const updates = [...space.updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const now = Date.now();

  return (
    <section className="container-page py-12 md:py-16">
      <p className={`${eyebrow} text-sp-amber`}>From @{space.creator.xHandle}</p>
      <h2 className="mt-3 font-display text-h3 font-light text-sp-ink md:text-h2">Updates</h2>
      <ol className="mt-8 flex max-w-2xl flex-col gap-5">
        {updates.map((u) => (
          <li key={u.id} className={`${card} overflow-hidden`}>
            {u.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- creator photo from our own bucket
              <img src={u.imageUrl} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />
            )}
            <div className="flex flex-col gap-2 p-5">
              {u.body && <p className="whitespace-pre-line break-words text-body text-sp-ink [overflow-wrap:anywhere]">{u.body}</p>}
              <p className="text-tiny text-sp-ink/80">
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
 * The line for the other reader: a creator who sees this page and wants one of
 * their own. Deliberately the quietest thing on the page, and it never borrows
 * the amber that means "sponsor this spot". Nothing without an invite link.
 */
export function SpaceInvite({ space }: { space: Space }) {
  const invite = space.creatorInvite;
  if (!invite) return null;

  return (
    <section className="hairline" aria-label="Sell your own HiSpace">
      <div className="container-page flex flex-col gap-2 py-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        <p className="text-small text-sp-ink/85">
          {isSessionSpace(space) ? "Sell your time at events, like" : "Have an audience? Sell sponsorships, like"} @
          {space.creator.xHandle}.
        </p>
        <a
          href={invite.url}
          className="self-start whitespace-nowrap text-small text-sp-ink/85 underline-offset-4 transition-colors duration-180 hover:text-sp-ink hover:underline"
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
      <p className={`${eyebrow} text-sp-amber`}>HiSpace</p>
      <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-sp-ink md:text-h2">
        We couldn&rsquo;t load this board just now.
      </h1>
      <p className="mt-5 max-w-xl text-body text-sp-ink/85">
        This is on our side, not the link. Give it a moment and refresh the page.
      </p>
    </section>
  );
}
