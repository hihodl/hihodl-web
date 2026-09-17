"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { currentCheckout, existingCheckoutKey } from "@/lib/ad-space/checkout-client";
import { instantUtc, isSessionSpace, serviceName, serviceSummary, timeLeft } from "@/lib/ad-space/format";
import { type SavedOffer, offerModeOf, offerPath, savedOffers } from "@/lib/ad-space/offers-client";
import type { OfferKind, OfferMode, Order, Position, PositionOffers, Space } from "@/lib/ad-space/types";

import { Checkout } from "./Checkout";
import { IfItDoesNotHappen } from "./IfItDoesNotHappen";
import { OfferSheet } from "./OfferSheet";
import { PositionCard } from "./PositionCard";
import { ProductBoard } from "./ProductBoard";
import { btnSmall, btnSmallSecondary, eyebrow, pill } from "./ui";
import { useServerNow } from "./useServerNow";
import { WhatTheBrandGets } from "./WhatTheBrandGets";

/**
 * The interactive middle of the page: the board (a drawn product, or a grid
 * of slots for a service), the spots, and the checkout sheet.
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
export function SpaceBoard({ space }: { space: Space }) {
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
  const spaceMode = offerModeOf(space);
  const modeOf = useCallback(
    (p: Position): OfferMode | null => offerModeOf(space, isService ? null : p),
    [space, isService],
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

  const cardList = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {space.positions.map((p) => (
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
          onOffer={isService ? undefined : openOffer}
        />
      ))}
    </div>
  );

  return (
    <>
      {resumable && !checkoutFor && (
        <div className="mb-10 flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-text">
            {resumable.order.status !== "paid"
              ? `Your payment for ${resumable.position.label} is still going through.`
              : session
                ? `You booked ${resumable.position.label}. Your booking link and your contact for the creator are here.`
                : `You sponsored ${resumable.position.label}. Send the creator what goes on it.`}
          </p>
          <button type="button" className={btnSmall} onClick={() => setCheckoutFor(resumable.position)}>
            {resumable.order.status !== "paid" ? "See the payment" : session ? "See your booking" : "Add your logo"}
          </button>
        </div>
      )}

      {mine.length > 0 && <YourOffers offers={mine} />}

      {isService ? (
        <div className="flex flex-col gap-8">
          {space.template.service && (
            <div className="max-w-2xl">
              <p className={`${eyebrow} break-words text-moonlight [overflow-wrap:anywhere]`}>
                {session ? `Book: ${serviceName(space)}` : serviceName(space)}
              </p>
              {serviceSummary(space) && (
                <p className="mt-3 whitespace-pre-line break-words text-lead text-text-muted [overflow-wrap:anywhere]">
                  {serviceSummary(space)}
                </p>
              )}
            </div>
          )}
          <WhatTheBrandGets space={space} />
          {/* A session space has no "every slot includes" card at all, so this
              is the only thing between the summary and the slots that says what
              happens if the session doesn't. It renders on both boards. */}
          <IfItDoesNotHappen space={space} />
          {spaceMode && spaceMode !== "bids" && (
            <SpaceOffersPanel
              mode={spaceMode}
              offers={space.spaceOffers}
              canOffer={buyable && space.positions.some((p) => p.status === "open")}
              session={session}
              now={now}
              onOffer={() => setOfferFor({ position: null, kind: "offer" })}
            />
          )}
          {cardList}
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          <div className="rounded-card border border-[color:var(--color-hairline)] bg-white/[0.02] px-4 py-10 md:px-10">
            <ProductBoard
              template={space.template}
              positions={space.positions}
              activeId={active}
              onHover={setHoverId}
              onPick={pick}
            />
            <Legend takeover={space.pricingMode === "takeover"} mode={spaceMode} />
          </div>
          <WhatTheBrandGets space={space} />
          <IfItDoesNotHappen space={space} />
          <div>
            <h2 className="mb-6 font-display text-h4 font-light text-text">Every spot</h2>
            {cardList}
          </div>
        </div>
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

function Legend({ takeover, mode }: { takeover: boolean; mode: OfferMode | null }) {
  return (
    <ul className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Legend">
      <li className={pill.open}>
        {mode === "offers" ? "Available, tap to make an offer" : mode === "bids" ? "Available, tap to bid" : "Available, tap to sponsor"}
      </li>
      <li className={pill.held}>Being paid now</li>
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
          {mode === "offers" ? "Name your price" : `Buy a ${noun} now, or make an offer below the price`}
        </p>
        <p className="mt-1 text-small text-text-muted">
          Your offer is for any open {noun}. If the creator accepts it, you get the next free one and 24 hours to pay.
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
