"use client";

import { forwardRef } from "react";

import {
  CONTENT_KIND_LABEL,
  SESSION_STATUS_LABEL,
  STATUS_LABEL,
  calendarDate,
  clockTime,
  handsText,
  takeoverClosedText,
  takeoverVerb,
  instantUtc,
  timeLeft,
  usdFromCents,
} from "@/lib/ad-space/format";
import type { OfferMode, Position, PositionOffers, Sponsor, Takeover } from "@/lib/ad-space/types";

import { QrCode } from "./qr";
import { btnSmall, btnSmallSecondary, pill } from "./ui";

/**
 * One spot: what it is, what it costs, who has it. The same card is the
 * position list under a product board and the slot grid of a service.
 */

type Props = {
  position: Position;
  sizeLabel: string | null;
  active: boolean;
  /** False once the space is closed: no spot can be bought. */
  buyable: boolean;
  /** What a takeover multiplies the last price by. Null on a fixed-price space. */
  takeoverMultiple: number | null;
  /**
   * A session in person (hispace-in-the-room-v0.md): it is booked, not
   * sponsored, and nothing about the buyer is ever shown on it.
   */
  session?: boolean;
  /**
   * How this spot sells when the sponsor names the price (hispace-offers-v0.md),
   * or null for a fixed price or a takeover. On a service slot this is the
   * space's mode, but the offer itself is made on the space, not the slot.
   */
  offerMode?: OfferMode | null;
  /** The server-clock "now" for the bidding countdown; null before mount. */
  now?: number | null;
  onHover: (id: string | null) => void;
  onSponsor: (p: Position) => void;
  /** Opens the offer or bid form for this spot. Absent on a service slot. */
  onOffer?: (p: Position) => void;
};

export const PositionCard = forwardRef<HTMLElement, Props>(function PositionCard(
  {
    position: p,
    sizeLabel,
    active,
    buyable,
    takeoverMultiple,
    session = false,
    offerMode = null,
    now = null,
    onHover,
    onSponsor,
    onOffer,
  },
  ref,
) {
  const o = p.offers ?? null;
  const bids = offerMode === "bids";
  const namesPrice = offerMode === "offers" || bids || p.sponsorPaysUsdc === null;
  const biddingOpen = bids && biddingIsOpen(o, now);
  const noun = session ? "session" : "spot";
  return (
    <article
      ref={ref}
      id={`spot-${p.id}`}
      onPointerEnter={() => onHover(p.id)}
      onPointerLeave={() => onHover(null)}
      className={`flex scroll-mt-24 flex-col gap-4 rounded-card border p-5 transition-colors duration-180 ${
        active
          ? "border-amber/50 bg-amber/[0.05]"
          : "border-[color:var(--color-hairline)] bg-sp-ink/[0.03]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body text-sp-ink">{p.label}</h3>
          {!session && (
            <p className="mt-1 text-tiny text-sp-ink/80">
              {[sizeLabel, `Takes ${p.accepts.map((k) => CONTENT_KIND_LABEL[k]).join(", ")}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className={pill[p.status]}>{(session ? SESSION_STATUS_LABEL : STATUS_LABEL)[p.status]}</span>
      </header>

      {p.pitch && <p className="text-small text-sp-ink/85">{p.pitch}</p>}

      {offerMode === "fixed_with_offers" && p.status === "open" && (
        <p className="text-tiny text-sp-ink/80">Open to offers.</p>
      )}

      {p.status === "sold" &&
        !session &&
        (p.sponsor ? (
          <SponsorLine sponsor={p.sponsor} />
        ) : (
          <p className="text-small text-sp-ink/85">Sold. Logo coming soon.</p>
        ))}

      {p.delivered && (
        <a
          href={p.delivered.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small text-sp-ok hover:underline"
        >
          Delivered {calendarDate(p.delivered.at)}: see the post
        </a>
      )}

      {p.takeover && <TakeoverLines position={p} takeover={p.takeover} multiple={takeoverMultiple} />}

      {bids && p.status !== "sold" && <BidLines offers={o} now={now} />}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-[color:var(--color-hairline)] pt-4">
        {p.takeover ? (
          <TakeoverPrices position={p} takeover={p.takeover} />
        ) : bids ? (
          <BidFigure offers={o} />
        ) : namesPrice ? (
          <OffersFigure offers={o} status={p.status} />
        ) : (
          <dl className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">You pay</dt>
              <dd className="font-mono text-body text-sp-ink">{p.sponsorPaysUsdc} USDC</dd>
            </div>
          </dl>
        )}

        {p.status === "open" && buyable && offerMode === null && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            {session ? "Book a session" : "Claim this spot"}
          </button>
        )}
        {p.status === "open" && buyable && offerMode === "fixed_with_offers" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
              Buy now
            </button>
            {onOffer && (
              <button type="button" className={btnSmallSecondary} onClick={() => onOffer(p)}>
                Make an offer
              </button>
            )}
          </div>
        )}
        {p.status === "open" && buyable && offerMode === "offers" && onOffer && (
          <button type="button" className={btnSmall} onClick={() => onOffer(p)}>
            Make an offer
          </button>
        )}
        {p.status === "open" && buyable && bids && biddingOpen && onOffer && (
          <button type="button" className={btnSmall} onClick={() => onOffer(p)}>
            Bid
          </button>
        )}
        {/* A sold spot on a takeover board is still for sale — at double. The
            card already says what that costs and what goes back to the sponsor
            holding it, so the button only has to name the act. */}
        {p.status === "sold" && buyable && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            Take this spot
          </button>
        )}
        {p.status === "held" && buyable && (
          <p className="max-w-[16rem] text-tiny text-sp-amber">
            {o?.reservedUntil ? (
              <>
                Held for an accepted {bids ? "bid" : "offer"} until{" "}
                <time dateTime={o.reservedUntil} suppressHydrationWarning>
                  {now === null ? instantUtc(o.reservedUntil) : clockTime(o.reservedUntil)}
                </time>
                .
              </>
            ) : (
              <>Someone is paying for this {noun} right now.</>
            )}
          </p>
        )}
      </div>
    </article>
  );
});

/** Bidding is open while the server says so and its end is still ahead on the server's clock. */
function biddingIsOpen(o: PositionOffers | null, now: number | null): boolean {
  if (!o || o.biddingOpen === false) return false;
  if (!o.biddingEndsAt || now === null) return true;
  return Date.parse(o.biddingEndsAt) > now;
}

/**
 * Where bidding stands on a spot: the leader, the reserve, the bid count and the
 * time left. Every amount is the creator's side, before our fee, as the bid form
 * asks for it.
 *
 * Exported because a rung of a ladder that sells by bids stands exactly the same
 * way, and two wordings for one fact is how two products start promising
 * different things.
 */
export function BidLines({ offers: o, now }: { offers: PositionOffers | null; now: number | null }) {
  if (!o) return null;
  const end = o.biddingEndsAt ? Date.parse(o.biddingEndsAt) : NaN;
  const ended = o.biddingOpen === false || (Number.isFinite(end) && now !== null && end <= now);
  const count = o.bidCount ?? 0;
  return (
    <div className="flex flex-col gap-2 text-tiny text-sp-ink/85">
      <div className="flex flex-wrap items-center gap-2">
        {o.reserveMet === true && <span className={pill.done}>Reserve met</span>}
        {o.reserveMet === false && <span className={pill.attention}>Reserve not met yet</span>}
        <span className={pill.neutral}>
          {count === 0 ? "No bids yet" : count === 1 ? "1 bid" : `${count} bids`}
        </span>
      </div>
      {o.highestBidUsdc && o.leaderName && (
        <p>
          <span className="text-sp-ink">{o.leaderName}</span> leads.
        </p>
      )}
      {ended ? (
        <p>Bidding has ended. The creator picks a bid within 24 hours.</p>
      ) : (
        o.biddingEndsAt && (
          <p>
            {now === null ? (
              <>Bidding ends {instantUtc(o.biddingEndsAt)}</>
            ) : (
              <>
                Bidding ends in <span className="font-mono text-sp-ink">{timeLeft(end - now)}</span>
              </>
            )}
            {o.nextMinimumBidUsdc && (
              <>
                {" "}
                · next bid from <span className="font-mono text-sp-ink">{o.nextMinimumBidUsdc} USDC</span>
              </>
            )}
          </p>
        )
      )}
    </div>
  );
}

/** The one figure a bids spot leads with, under its own label. */
function BidFigure({ offers: o }: { offers: PositionOffers | null }) {
  const highest = o?.highestBidUsdc ?? null;
  const shown = highest ?? o?.openingBidUsdc ?? null;
  if (!shown) return <p className="text-small text-sp-ink/85">Open for bids</p>;
  return (
    <dl className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-tiny text-sp-ink/80">{highest ? "Highest bid" : "Opening bid"}</dt>
        <dd className="font-mono text-body text-sp-ink">{shown} USDC</dd>
      </div>
    </dl>
  );
}

/** A spot with no price: how many offers are open on it, never what they are. */
function OffersFigure({ offers: o, status }: { offers: PositionOffers | null; status: Position["status"] }) {
  const n = o?.openCount ?? null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-body text-sp-ink">{status === "sold" ? "Sold" : "Name your price"}</p>
      {status !== "sold" && n !== null && (
        <p className="text-tiny text-sp-ink/80">{n === 0 ? "No offers yet" : n === 1 ? "1 open offer" : `${n} open offers`}</p>
      )}
    </div>
  );
}

/**
 * The two figures a takeover spot leads with, each under its own visible label.
 *
 * At a multiple of two the price a spot last went for and the money a takeover
 * hands the creator are the SAME number, so the sr-only label the fixed-price
 * card uses is not enough here: a reader who sees one amount has to be told
 * which one it is without asking a screen reader.
 */
function TakeoverPrices({ position: p, takeover: t }: { position: Position; takeover: Takeover }) {
  const takeable = p.status === "sold" && !t.closed && t.nextSponsorPaysUsdc !== null;
  return (
    <dl className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-tiny text-sp-ink/80">{p.status === "sold" ? "Sold at" : "You pay"}</dt>
        <dd className="font-mono text-body text-sp-ink">
          {p.status === "sold" ? t.priceUsdc : p.sponsorPaysUsdc} USDC
        </dd>
      </div>
      {takeable ? (
        <div className="flex items-baseline gap-1 text-tiny text-sp-amber">
          <dt>Take it for</dt>
          <dd className="font-mono">{t.nextSponsorPaysUsdc} USDC</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * What the ladder has done to this spot and what happens next, in sentences.
 *
 * No amount here appears twice and none appears bare: the price, what a
 * takeover costs and the refund sit within two lines of each other, and at a
 * multiple of two a pair of them can be the same figure.
 */
function TakeoverLines({
  position: p,
  takeover: t,
  multiple,
}: {
  position: Position;
  takeover: Takeover;
  multiple: number | null;
}) {
  if (p.status !== "sold") {
    return (
      <p className="text-tiny text-sp-ink/85">
        Every takeover {takeoverVerb(multiple)}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 text-tiny text-sp-ink/85">
      {t.handsSoFar > 0 && (
        <p>
          {handsText(t.handsSoFar)} since bidding opened at {usdFromCents(t.floorPriceCents)}.
        </p>
      )}
      {t.closed ? (
        <p>{takeoverClosedText(t.closed)}</p>
      ) : (
        t.nextPriceUsdc &&
        t.refundsUsdc && (
          <p>The current sponsor gets their {t.refundsUsdc} USDC back.</p>
        )
      )}
    </div>
  );
}

/** Only http(s) links are ever rendered from sponsor content. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function SponsorLine({ sponsor: s }: { sponsor: Sponsor }) {
  const href = safeHref(s.url);
  const handle = s.xHandle?.replace(/^@/, "");
  return (
    <div className="flex items-center gap-3">
      <SponsorMark sponsor={s} />
      <div className="min-w-0">
        <p className="truncate text-small text-sp-ink">
          {href ? (
            <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="hover:underline">
              {s.name}
            </a>
          ) : (
            s.name
          )}
        </p>
        {handle && (
          <a
            href={`https://x.com/${encodeURIComponent(handle)}`}
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            className="text-tiny text-sp-ink/80 hover:text-sp-ink/85"
          >
            @{handle}
          </a>
        )}
        {s.contentKind === "text" && s.contentText && (
          <p className="mt-0.5 truncate font-mono text-tiny text-sp-ink/85">{s.contentText}</p>
        )}
      </div>
    </div>
  );
}

function SponsorMark({ sponsor: s }: { sponsor: Sponsor }) {
  const box = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-tight bg-white";
  if (s.imageUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- sponsor artwork from our own bucket, any host */}
        <img
          src={s.imageUrl}
          alt={`${s.name} logo`}
          className={s.contentKind === "photo" ? "h-full w-full object-cover" : "h-full w-full object-contain p-1"}
          loading="lazy"
        />
      </span>
    );
  }
  if (s.contentKind === "qr" && s.contentText) {
    return (
      <span className={box}>
        <QrCode text={s.contentText} title={`QR code for ${s.name}`} className="h-full w-full" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tight bg-amber text-body font-medium text-text-on-amber">
      {s.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
