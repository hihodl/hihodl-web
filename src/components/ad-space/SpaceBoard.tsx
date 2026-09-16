"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { currentCheckout, existingCheckoutKey } from "@/lib/ad-space/checkout-client";
import type { Order, Position, Space } from "@/lib/ad-space/types";

import { Checkout } from "./Checkout";
import { PositionCard } from "./PositionCard";
import { ProductBoard } from "./ProductBoard";
import { btnSmall, eyebrow, pill } from "./ui";

/**
 * The interactive middle of the page: the board (a drawn product, or a grid
 * of slots for a service), the spots, and the checkout sheet.
 *
 * Board and list are linked both ways. Hovering a zone lights its card and
 * hovering a card lights its zone. Tapping an open zone goes straight to the
 * checkout, and so does a sold one on a takeover board while its ladder is
 * still going; tapping any other sold or held one scrolls to its card, which
 * says who has it.
 */
export function SpaceBoard({ space }: { space: Space }) {
  const router = useRouter();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<Position | null>(null);
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

  const onPaid = useCallback(() => router.refresh(), [router]);
  const onClose = useCallback(() => setCheckoutFor(null), []);

  const pick = useCallback(
    (p: Position) => {
      // Clicking a spot on the product opens checkout when the spot can be
      // bought — which on a takeover board includes a SOLD one, at double.
      const takeable = p.status === "sold" && p.takeover && !p.takeover.closed && p.takeover.nextPriceUsdc;
      if (buyable && (p.status === "open" || takeable)) {
        setCheckoutFor(p);
        return;
      }
      const el = cards.current.get(p.id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(p.id);
      window.setTimeout(() => setFlashId((f) => (f === p.id ? null : f)), 1600);
    },
    [buyable],
  );

  const active = hoverId ?? flashId;
  const sizeOf = (p: Position) => space.template.zones.find((z) => z.zoneKey === p.zoneKey)?.sizeLabel ?? null;
  const isService = space.template.kind === "service";

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
          onHover={setHoverId}
          onSponsor={setCheckoutFor}
        />
      ))}
    </div>
  );

  return (
    <>
      {resumable && !checkoutFor && (
        <div className="mb-10 flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-text">
            {resumable.order.status === "paid"
              ? `You sponsored ${resumable.position.label}. Send the creator what goes on it.`
              : `Your payment for ${resumable.position.label} is still going through.`}
          </p>
          <button type="button" className={btnSmall} onClick={() => setCheckoutFor(resumable.position)}>
            {resumable.order.status === "paid" ? "Add your logo" : "See the payment"}
          </button>
        </div>
      )}

      {isService ? (
        <div className="flex flex-col gap-8">
          {space.template.service && (
            <div className="max-w-2xl">
              <p className={`${eyebrow} text-moonlight`}>{space.template.name}</p>
              <p className="mt-3 text-lead text-text-muted">{space.template.service.summary}</p>
            </div>
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
            <Legend takeover={space.pricingMode === "takeover"} />
          </div>
          <div>
            <h2 className="mb-6 font-display text-h4 font-light text-text">Every spot</h2>
            {cardList}
          </div>
        </div>
      )}

      {checkoutFor && (
        <Checkout space={space} position={checkoutFor} onClose={onClose} onPaid={onPaid} />
      )}
    </>
  );
}

function Legend({ takeover }: { takeover: boolean }) {
  return (
    <ul className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Legend">
      <li className={pill.open}>Available, tap to sponsor</li>
      <li className={pill.held}>Being paid now</li>
      {/* On a takeover board a sold spot opens checkout like an open one does
          (see `pick`), so the legend cannot call it just "Sold". */}
      <li className={pill.sold}>{takeover ? "Taken, tap to take it" : "Sold"}</li>
    </ul>
  );
}
