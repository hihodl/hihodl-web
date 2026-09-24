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
  usdFromUsdc,
} from "@/lib/ad-space/format";
import type { OfferMode, Position, PositionOffers, Sponsor, Takeover } from "@/lib/ad-space/types";
import { Rich, useT } from "@/lib/app/i18n/react";

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
  const t = useT();
  const o = p.offers ?? null;
  const bids = offerMode === "bids";
  const namesPrice = offerMode === "offers" || bids || p.sponsorPaysUsdc === null;
  const biddingOpen = bids && biddingIsOpen(o, now);
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
              {[sizeLabel, t("board.card.takes", { kinds: p.accepts.map((k) => CONTENT_KIND_LABEL[k]).join(", ") })]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className={pill[p.status]}>{(session ? SESSION_STATUS_LABEL : STATUS_LABEL)[p.status]}</span>
      </header>

      {p.pitch && <p className="text-small text-sp-ink/85">{p.pitch}</p>}

      {offerMode === "fixed_with_offers" && p.status === "open" && (
        <p className="text-tiny text-sp-ink/80">{t("board.card.openToOffers")}</p>
      )}

      {p.status === "sold" &&
        !session &&
        (p.sponsor ? (
          <SponsorLine sponsor={p.sponsor} />
        ) : (
          <p className="text-small text-sp-ink/85">{t("board.card.logoSoon")}</p>
        ))}

      {p.delivered && (
        <a
          href={p.delivered.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-small text-sp-ok hover:underline"
        >
          {t("board.card.delivered", { date: calendarDate(p.delivered.at) })}
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
              <dt className="sr-only">{t("board.youPay")}</dt>
              <dd className="text-body tabular-nums text-sp-ink">
                {usdFromUsdc(p.sponsorPaysUsdc)}
                <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
              </dd>
            </div>
          </dl>
        )}

        {p.status === "open" && buyable && offerMode === null && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            {session ? t("board.stats.bookSession") : t("board.card.claimThisSpot")}
          </button>
        )}
        {p.status === "open" && buyable && offerMode === "fixed_with_offers" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
              {t("board.tiers.buyNow")}
            </button>
            {onOffer && (
              <button type="button" className={btnSmallSecondary} onClick={() => onOffer(p)}>
                {t("board.chip.makeOffer")}
              </button>
            )}
          </div>
        )}
        {p.status === "open" && buyable && offerMode === "offers" && onOffer && (
          <button type="button" className={btnSmall} onClick={() => onOffer(p)}>
            {t("board.chip.makeOffer")}
          </button>
        )}
        {p.status === "open" && buyable && bids && biddingOpen && onOffer && (
          <button type="button" className={btnSmall} onClick={() => onOffer(p)}>
            {t("board.tiers.bid")}
          </button>
        )}
        {/* A sold spot on a takeover board is still for sale — at double. The
            card already says what that costs and what goes back to the sponsor
            holding it, so the button only has to name the act. */}
        {p.status === "sold" && buyable && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc && (
          <button type="button" className={btnSmall} onClick={() => onSponsor(p)}>
            {t("board.card.takeThisSpot")}
          </button>
        )}
        {p.status === "held" && buyable && (
          <p className="max-w-[16rem] text-tiny text-sp-amber">
            {o?.reservedUntil ? (
              <Rich
                k="board.card.heldUntil"
                vars={{
                  kind: bids ? "bid" : "offer",
                  when: now === null ? instantUtc(o.reservedUntil) : clockTime(o.reservedUntil),
                }}
                tags={{
                  time: (c) => (
                    <time dateTime={o.reservedUntil ?? undefined} suppressHydrationWarning>
                      {c}
                    </time>
                  ),
                }}
              />
            ) : (
              t("board.card.payingNow", { noun: session ? "session" : "spot" })
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
  const t = useT();
  if (!o) return null;
  const end = o.biddingEndsAt ? Date.parse(o.biddingEndsAt) : NaN;
  const ended = o.biddingOpen === false || (Number.isFinite(end) && now !== null && end <= now);
  const count = o.bidCount ?? 0;
  return (
    <div className="flex flex-col gap-2 text-tiny text-sp-ink/85">
      <div className="flex flex-wrap items-center gap-2">
        {o.reserveMet === true && <span className={pill.done}>{t("board.bidLines.reserveMet")}</span>}
        {o.reserveMet === false && <span className={pill.attention}>{t("board.bidLines.reserveNotMet")}</span>}
        <span className={pill.neutral}>
          {t("board.bidLines.bids", { count })}
        </span>
      </div>
      {o.highestBidUsdc && o.leaderName && (
        <p>
          <Rich
            k="board.bidLines.leads"
            vars={{ name: o.leaderName }}
            tags={{ name: (c) => <span className="text-sp-ink">{c}</span> }}
          />
        </p>
      )}
      {ended ? (
        <p>{t("board.bidLines.ended")}</p>
      ) : (
        o.biddingEndsAt && (
          <p>
            {now === null ? (
              t("board.bidLines.endsAt", { when: instantUtc(o.biddingEndsAt) })
            ) : (
              <Rich
                k="board.bidLines.endsIn"
                vars={{ left: timeLeft(end - now) }}
                tags={{ time: (c) => <span className="font-mono text-sp-ink">{c}</span> }}
              />
            )}
            {o.nextMinimumBidUsdc && (
              <>
                {" "}
                <Rich
                  k="board.bidLines.nextFrom"
                  vars={{ amount: usdFromUsdc(o.nextMinimumBidUsdc) }}
                  tags={{ amount: (c) => <span className="tabular-nums text-sp-ink">{c}</span> }}
                />
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
  const t = useT();
  const highest = o?.highestBidUsdc ?? null;
  const shown = highest ?? o?.openingBidUsdc ?? null;
  if (!shown) return <p className="text-small text-sp-ink/85">{t("board.tiers.openForBids")}</p>;
  return (
    <dl className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-tiny text-sp-ink/80">{highest ? t("board.tiers.highestBid") : t("board.tiers.openingBid")}</dt>
        <dd className="text-body tabular-nums text-sp-ink">
          {usdFromUsdc(shown)}
          <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
        </dd>
      </div>
    </dl>
  );
}

/** A spot with no price: how many offers are open on it, never what they are. */
function OffersFigure({ offers: o, status }: { offers: PositionOffers | null; status: Position["status"] }) {
  const t = useT();
  const n = o?.openCount ?? null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-body text-sp-ink">{status === "sold" ? t("board.status.sold") : t("board.stats.nameYourPrice")}</p>
      {status !== "sold" && n !== null && <p className="text-tiny text-sp-ink/80">{t("board.tiers.openOffers", { count: n })}</p>}
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
function TakeoverPrices({ position: p, takeover: tk }: { position: Position; takeover: Takeover }) {
  const t = useT();
  const takeable = p.status === "sold" && !tk.closed && tk.nextSponsorPaysUsdc !== null;
  return (
    <dl className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <dt className="text-tiny text-sp-ink/80">{p.status === "sold" ? t("board.card.soldAt") : t("board.youPay")}</dt>
        <dd className="text-body tabular-nums text-sp-ink">
          {usdFromUsdc(p.status === "sold" ? tk.priceUsdc : p.sponsorPaysUsdc)}
          <span className="ml-1 text-[11px] font-normal text-sp-ink/80">USDC</span>
        </dd>
      </div>
      {takeable ? (
        <div className="flex items-baseline gap-1 text-tiny text-sp-amber">
          <dt>{t("board.card.takeItFor")}</dt>
          <dd className="tabular-nums">{usdFromUsdc(tk.nextSponsorPaysUsdc)}</dd>
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
  takeover: tk,
  multiple,
}: {
  position: Position;
  takeover: Takeover;
  multiple: number | null;
}) {
  const t = useT();
  if (p.status !== "sold") {
    return <p className="text-tiny text-sp-ink/85">{t("board.card.everyTakeover", { verb: takeoverVerb(multiple) })}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5 text-tiny text-sp-ink/85">
      {tk.handsSoFar > 0 && (
        <p>
          {t("board.card.handsSince", { hands: handsText(tk.handsSoFar), amount: usdFromCents(tk.floorPriceCents) })}
        </p>
      )}
      {tk.closed ? (
        <p>{takeoverClosedText(tk.closed)}</p>
      ) : (
        tk.nextPriceUsdc &&
        tk.refundsUsdc && (
          <p>{t("board.card.refund", { amount: usdFromUsdc(tk.refundsUsdc) })}</p>
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
  const t = useT();
  const box = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-tight bg-white";
  if (s.imageUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- sponsor artwork from our own bucket, any host */}
        <img
          src={s.imageUrl}
          alt={t("board.card.sponsorLogo", { name: s.name })}
          className={s.contentKind === "photo" ? "h-full w-full object-cover" : "h-full w-full object-contain p-1"}
          loading="lazy"
        />
      </span>
    );
  }
  if (s.contentKind === "qr" && s.contentText) {
    return (
      <span className={box}>
        <QrCode text={s.contentText} title={t("board.card.sponsorQr", { name: s.name })} className="h-full w-full" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tight bg-amber text-body font-medium text-text-on-amber">
      {s.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
