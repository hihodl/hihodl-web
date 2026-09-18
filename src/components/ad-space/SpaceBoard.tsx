"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { currentCheckout, existingCheckoutKey } from "@/lib/ad-space/checkout-client";
import {
  instantUtc,
  isSessionSpace,
  isTieredSpace,
  serviceSummary,
  spaceTiers,
  timeLeft,
} from "@/lib/ad-space/format";
import { gradientCss } from "@/lib/ad-space/look";
import { type SavedOffer, offerModeOf, offerPath, savedOffers } from "@/lib/ad-space/offers-client";
import type { OfferKind, OfferMode, Order, Position, PositionOffers, Space } from "@/lib/ad-space/types";

import { Checkout } from "./Checkout";
import { OfferSheet } from "./OfferSheet";
import { PositionCard } from "./PositionCard";
import { ProductBoard } from "./ProductBoard";
import { TierLadder } from "./TierLadder";
import { btnSmall, btnSmallSecondary, pill } from "./ui";
import { useServerNow } from "./useServerNow";

/**
 * The listing page's interactive body, and its layout: the banner with the
 * product on it (a placement) or the slots and packages (a service), the spots,
 * and the checkout and offer sheets. The server-rendered parts (the head, the
 * numbers, what you get) come in as slots, so they stay plain HTML.
 *
 * Board and list are linked both ways. Hovering a zone lights its card and
 * hovering a card lights its zone. Tapping an open zone goes straight to the
 * checkout, and so does a sold one on a takeover board while its ladder is
 * still going; tapping any other sold or held one scrolls to its card, which
 * says who has it.
 *
 * On a space where the sponsor names the price (hispace-offers-v0.md), an open
 * zone opens the offer or bid form instead, and a fixed price that also takes
 * offers keeps Buy now on the zone and adds Make an offer on the card. A service
 * space takes offers once, for the space, above its slots.
 */
export function SpaceBoard({
  space,
  head,
  stats,
  details,
}: {
  space: Space;
  /** The title and the creator, server-rendered, drawn on the banner. */
  head: ReactNode;
  /** The big numbers, between the banner and the rest. */
  stats: ReactNode;
  /** What you get and how it works, before the full list of spots. */
  details: ReactNode;
}) {
  const router = useRouter();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<Position | null>(null);
  /** The offer or bid form: a spot, or null for a service space's own offer. */
  const [offerFor, setOfferFor] = useState<{ position: Position | null; kind: OfferKind } | null>(null);
  const [mine, setMine] = useState<SavedOffer[]>([]);
  const now = useServerNow();
  const [resumable, setResumable] = useState<{ position: Position; order: Order } | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  const [buyable, setBuyable] = useState(space.status === "live");
  useEffect(() => {
    // The server says "live"; the clock may already have passed closesAt.
    if (space.status === "live" && Date.parse(space.closesAt) <= Date.now()) setBuyable(false);
  }, [space.status, space.closesAt]);

  /* A checkout this tab started earlier (a reload, or a sponsor coming back
     to hand over their logo) is offered again at the top of the board. */
  useEffect(() => {
    let live = true;
    (async () => {
      for (const p of space.positions) {
        const key = existingCheckoutKey(p.id);
        if (!key) continue;
        try {
          const order = await currentCheckout(key);
          if (!live) return;
          if (order && order.positionId === p.id && (order.status === "paid" || order.status === "awaiting_payment")) {
            setResumable({ position: p, order });
            return;
          }
        } catch {
          // Nothing to offer.
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [space.positions]);

  /* The offers this browser made here, so a sponsor finds their way back. */
  useEffect(() => setMine(savedOffers(space.id)), [space.id]);

  const onPaid = useCallback(() => router.refresh(), [router]);
  const onClose = useCallback(() => setCheckoutFor(null), []);
  const onOfferClose = useCallback(() => setOfferFor(null), []);
  const onOfferSent = useCallback(() => {
    setMine(savedOffers(space.id));
    router.refresh();
  }, [router, space.id]);

  const isService = space.template.kind === "service";
  /* A ladder, or N of one thing (ad-space-tiers-v0.md). On a ladder every rung
     carries its own price, its own lines and its own offers, so the offer sits
     on the rung and not on the space, exactly as it does on a placement. */
  const tiered = isTieredSpace(space);
  const tiers = tiered ? spaceTiers(space) : [];
  const spaceMode = offerModeOf(space);
  const modeOf = useCallback(
    (p: Position): OfferMode | null => offerModeOf(space, isService && !tiered ? null : p),
    [space, isService, tiered],
  );
  /** Bidding is open while the server says so and its end is still ahead on the server's clock. */
  const biddingOpen = useCallback(
    (p: Position) => {
      const o = p.offers;
      if (!o || o.biddingOpen === false) return false;
      if (!o.biddingEndsAt || now === null) return true;
      return Date.parse(o.biddingEndsAt) > now;
    },
    [now],
  );
  const openOffer = useCallback(
    (p: Position) => setOfferFor({ position: p, kind: modeOf(p) === "bids" ? "bid" : "offer" }),
    [modeOf],
  );

  const pick = useCallback(
    (p: Position) => {
      // Clicking a spot on the product opens checkout when the spot can be
      // bought — which on a takeover board includes a SOLD one, at double.
      const takeable = p.status === "sold" && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc;
      const mode = modeOf(p);
      if (buyable && p.status === "open" && (mode === "offers" || mode === "bids")) {
        const ends = p.offers?.biddingEndsAt ? Date.parse(p.offers.biddingEndsAt) : NaN;
        const biddingOver = mode === "bids" && (p.offers?.biddingOpen === false || (now !== null && ends <= now));
        if (!biddingOver) {
          openOffer(p);
          return;
        }
      } else if (buyable && (p.status === "open" || takeable)) {
        setCheckoutFor(p);
        return;
      }
      const el = cards.current.get(p.id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(p.id);
      window.setTimeout(() => setFlashId((f) => (f === p.id ? null : f)), 1600);
    },
    [buyable, modeOf, now, openOffer],
  );

  const active = hoverId ?? flashId;
  const sizeOf = (p: Position) => space.template.zones.find((z) => z.zoneKey === p.zoneKey)?.sizeLabel ?? null;
  const session = isSessionSpace(space);

  /* Everything the ladder does not already show. Without a ladder that is every
     position, whatever the positions carry, so a placement or an untiered
     service is the board exactly as it has always been. */
  const loose = tiered ? space.positions.filter((p) => !p.tierKey) : space.positions;
  const cardList = loose.length === 0 ? null : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loose.map((p) => (
        <PositionCard
          key={p.id}
          ref={(el) => {
            if (el) cards.current.set(p.id, el);
            else cards.current.delete(p.id);
          }}
          position={p}
          sizeLabel={sizeOf(p)}
          active={active === p.id}
          buyable={buyable}
          takeoverMultiple={space.takeoverMultiple}
          session={session}
          offerMode={modeOf(p)}
          now={now}
          onHover={setHoverId}
          onSponsor={setCheckoutFor}
          onOffer={isService && !tiered ? undefined : openOffer}
        />
      ))}
    </div>
  );

  const notices = (resumable && !checkoutFor) || mine.length > 0 ? (
    <div className="container-page flex flex-col gap-4">
      {resumable && !checkoutFor && (
        <div className="flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-text">
            {resumable.order.status !== "paid"
              ? `Your payment for ${resumable.position.label} is still going through.`
              : session
                ? `You booked ${resumable.position.label}.`
                : `You sponsored ${resumable.position.label}. Send the creator your logo.`}
          </p>
          <button type="button" className={btnSmall} onClick={() => setCheckoutFor(resumable.position)}>
            {resumable.order.status !== "paid" ? "See the payment" : session ? "See your booking" : "Add your logo"}
          </button>
        </div>
      )}
      {mine.length > 0 && <YourOffers offers={mine} />}
    </div>
  ) : null;

  const noun = session ? "session" : isService ? (tiered ? "package" : "slot") : "spot";

  return (
    <>
      <ListingBand space={space}>
        {head}
        {/* On a placement the product IS the banner: the suitcase itself, with
            every spot on it live. `ListingStage` is the one boundary a photo
            of the real object would replace (see its comment). */}
        {!isService && (
          <div id="spots" className="mt-10 scroll-mt-20">
            <ListingStage space={space} activeId={active} onHover={setHoverId} onPick={pick} mode={spaceMode} />
          </div>
        )}
      </ListingBand>

      {stats}
      {notices}

      {isService && (
        <section id="spots" className="container-page scroll-mt-20 py-10 md:py-14" aria-labelledby="pick">
          <h2 id="pick" className="font-display text-h3 font-light text-text md:text-h2">
            {session ? "Book a session" : `Pick your ${noun}`}
          </h2>
          {serviceSummary(space) && (
            <p className="mt-3 max-w-2xl whitespace-pre-line break-words text-body text-text-muted [overflow-wrap:anywhere]">
              {serviceSummary(space)}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-6">
            {!tiered && spaceMode && spaceMode !== "bids" && (
              <SpaceOffersPanel
                mode={spaceMode}
                offers={space.spaceOffers}
                canOffer={buyable && space.positions.some((p) => p.status === "open")}
                session={session}
                now={now}
                onOffer={() => setOfferFor({ position: null, kind: "offer" })}
              />
            )}
            {tiered && (
              <TierLadder
                tiers={tiers}
                buyable={buyable}
                session={session}
                modeOf={modeOf}
                biddingOpen={biddingOpen}
                now={now}
                onSponsor={setCheckoutFor}
                onOffer={openOffer}
              />
            )}
            {cardList}
          </div>
        </section>
      )}

      {details}

      {!isService && cardList && (
        <section className="container-page py-12 md:py-16" aria-labelledby="every-spot">
          <h2 id="every-spot" className="font-display text-h3 font-light text-text md:text-h2">
            Every spot
          </h2>
          <div className="mt-8">{cardList}</div>
        </section>
      )}

      {checkoutFor && (
        <Checkout space={space} position={checkoutFor} onClose={onClose} onPaid={onPaid} />
      )}

      {offerFor && (
        <OfferSheet
          space={space}
          position={offerFor.position}
          kind={offerFor.kind}
          now={now}
          onClose={onOfferClose}
          onSent={onOfferSent}
        />
      )}
    </>
  );
}

/** The banner fades out over its last 45%, into whatever ground is behind it. */
const BAND_FADE = "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)";

/**
 * The banner, drawn from the listing itself and never from its event: the
 * creator's own picture when they set one, else (on a placement) the product
 * drawn below the title on the creator's gradient, else the gradient alone.
 */
function ListingBand({ space, children }: { space: Space; children: ReactNode }) {
  const photo = space.bannerUrl;
  return (
    <section className="relative overflow-hidden">
      {/* The banner fades into whatever ground is behind it, by its own
          transparency rather than by painting a colour that has to match. */}
      <div className="absolute inset-0" style={{ background: gradientCss(space.bannerGradient), maskImage: BAND_FADE, WebkitMaskImage: BAND_FADE }} aria-hidden>
        {photo && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- the creator's banner, from our own bucket */}
            <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,25,41,0.3) 0%, rgba(10,25,41,0.7) 100%)" }} />
          </>
        )}
      </div>
      <div className="container-page relative pb-10 pt-6 md:pb-14 md:pt-10">{children}</div>
    </section>
  );
}

/**
 * The listing's own picture: today the catalog drawing of the product with its
 * zones on it, live.
 *
 * Phase 2 (real photos) plugs in here and nowhere else. Every zone is already a
 * rectangle in FRACTIONS of its view, so a photo of the real suitcase taken (or
 * cropped) to a view's aspect ratio can carry the very same rectangles: an
 * <img> per view with the same absolutely-positioned zone layer on top, and a
 * creator who uploads their own photo only has to drag those fractions. The
 * board's contract (positions, activeId, onHover, onPick) stays as it is, so
 * the stats, the cards and the checkout never know which one is drawn.
 */
function ListingStage({
  space,
  activeId,
  onHover,
  onPick,
  mode,
}: {
  space: Space;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onPick: (p: Position) => void;
  mode: OfferMode | null;
}) {
  return (
    <div>
      <ProductBoard template={space.template} photo={space.photo} positions={space.positions} activeId={activeId} onHover={onHover} onPick={onPick} />
      <Legend takeover={space.pricingMode === "takeover"} mode={mode} />
    </div>
  );
}

function Legend({ takeover, mode }: { takeover: boolean; mode: OfferMode | null }) {
  return (
    <ul className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Legend">
      <li className={pill.open}>
        {mode === "offers" ? "Open, tap to offer" : mode === "bids" ? "Open, tap to bid" : "Open, tap to claim"}
      </li>
      <li className={pill.held}>Being paid</li>
      {/* On a takeover board a sold spot opens checkout like an open one does
          (see `pick`), so the legend cannot call it just "Sold". */}
      <li className={pill.sold}>{takeover ? "Taken, tap to take it" : "Sold"}</li>
    </ul>
  );
}

/**
 * A service space takes offers once, for the space: slots are identical, and an
 * accepted offer is given the lowest open one. So the offer button sits here,
 * above the slots, and never on a slot.
 */
function SpaceOffersPanel({
  mode,
  offers,
  canOffer,
  session,
  now,
  onOffer,
}: {
  mode: OfferMode;
  offers: PositionOffers | null;
  canOffer: boolean;
  session: boolean;
  now: number | null;
  onOffer: () => void;
}) {
  const n = offers?.openCount ?? null;
  const reserved = offers?.reservedUntil ?? null;
  const noun = session ? "session" : "slot";
  return (
    <div className="flex flex-col gap-4 rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-body text-text">
          {mode === "offers" ? "Name your price" : `Buy a ${noun} now, or offer less`}
        </p>
        <p className="mt-1 text-small text-text-muted">
          For any open {noun}. Accepted? You get the next free one and 24 hours to pay.
          {n !== null && (n === 0 ? " No offers yet." : n === 1 ? " 1 open offer." : ` ${n} open offers.`)}
        </p>
        {reserved && (
          <p className="mt-1 text-tiny text-amber">
            An accepted offer holds a {noun} for{" "}
            {now === null ? `until ${instantUtc(reserved)}` : timeLeft(Date.parse(reserved) - now)} while it waits for
            its payment.
          </p>
        )}
      </div>
      {canOffer && (
        <button type="button" className={mode === "offers" ? btnSmall : btnSmallSecondary} onClick={onOffer}>
          Make an offer
        </button>
      )}
    </div>
  );
}

/** The offers and bids this browser made on the space, each with its link. */
function YourOffers({ offers }: { offers: SavedOffer[] }) {
  return (
    <div className="mb-10 flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/[0.06] p-5">
      <p className="text-small text-text">
        {offers.length === 1 ? "You made an offer here from this browser." : `You made ${offers.length} offers here from this browser.`}
      </p>
      <ul className="flex flex-wrap gap-2">
        {offers.slice(0, 6).map((o) => (
          <li key={o.token}>
            <a href={offerPath(o.token)} rel="noreferrer" className={btnSmallSecondary}>
              {o.kind === "bid" ? "Your bid" : "Your offer"}
              {o.label ? ` on ${o.label}` : ""}: {o.amountUsdc} USDC
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
