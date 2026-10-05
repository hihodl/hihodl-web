"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { isPartnershipSpace, isTieredSpace, usdFromCents } from "@/lib/ad-space/format";
import { PAY_PARAM, isPositionId } from "@/lib/ad-space/pay-here";
import { offerModeOf } from "@/lib/ad-space/offers-client";
import type { Position, Space } from "@/lib/ad-space/types";
import { useT } from "@/lib/app/i18n/react";

import { Checkout } from "./Checkout";
import { EnquirySheet } from "./EnquirySheet";
import { OfferSheet } from "./OfferSheet";
import { btnSmall, btnSmallSecondary } from "./ui";
import { useServerNow } from "./useServerNow";

/**
 * Buy, Make an offer and Get a quote for one event package, right where the
 * sponsor reads it. The sheets are the listing page's own; this only picks the
 * slot. A package is N identical slots, so Buy takes the cheapest open one and
 * an offer names none, as on an untiered service.
 *
 * Anything this row cannot sell in one tap (a ladder, bidding, a closed or
 * unreadable listing) gets one link to the package's own page instead.
 *
 * A partnership in kind is never bought, offered on or quoted: its only button
 * is Apply as partner, the enquiry. Should a checkout or an offer still meet
 * its 409 `partnership_by_enquiry`, the sheet hands over to the enquiry.
 *
 * `?pay=<slot>` is the checkout's own address (its camera code, a wallet's
 * browser): it opens that slot's checkout again, as the listing page does.
 */
export function PackageActions({ path, space }: { path: string; space: Space | null }) {
  const t = useT();
  const router = useRouter();
  const now = useServerNow();
  const [live, setLive] = useState(space?.status === "live");
  const [checkoutFor, setCheckoutFor] = useState<Position | null>(null);
  const [offering, setOffering] = useState(false);
  const [asking, setAsking] = useState(false);
  /** Set when the server says the package left its event's host (409 `package_not_organised`). */
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // The server says "live"; the clock may already have passed closesAt.
    if (space && space.status === "live" && Date.parse(space.closesAt) <= Date.now()) setLive(false);
  }, [space]);

  const open = space ? space.positions.filter((p) => p.status === "open") : [];
  const cheapest = open.reduce<Position | null>(
    (best, p) => (p.priceCents !== null && (best?.priceCents == null || p.priceCents < best.priceCents) ? p : best),
    null,
  );
  const partnership = !!space && isPartnershipSpace(space);
  const simple = !!space && live && !partnership && !isTieredSpace(space);
  const isService = space?.template.kind === "service";
  const mode = space ? offerModeOf(space, isService ? null : cheapest ?? open[0] ?? null) : null;
  const canBuy = simple && !!cheapest && mode !== "offers" && mode !== "bids";
  const canOffer = simple && open.length > 0 && (mode === "offers" || mode === "fixed_with_offers");

  const payAsked = useRef(false);
  useEffect(() => {
    if (payAsked.current || !space) return;
    payAsked.current = true;
    const id = new URLSearchParams(window.location.search).get(PAY_PARAM);
    if (!isPositionId(id)) return;
    const p = space.positions.find((x) => x.id === id);
    if (p && canBuy && p.status === "open") setCheckoutFor(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);
  const closeCheckout = useCallback(() => setCheckoutFor(null), []);
  const closeOffer = useCallback(() => setOffering(false), []);
  const closeAsk = useCallback(() => setAsking(false), []);
  const noop = useCallback(() => {}, []);
  const toGone = useCallback(() => {
    setCheckoutFor(null);
    setOffering(false);
    setGone(true);
    router.refresh();
  }, [router]);
  const toEnquiry = useCallback(() => {
    setCheckoutFor(null);
    setOffering(false);
    setAsking(true);
  }, []);

  if (gone) return <p className="text-small text-sp-ink/85">{t("publicPages.sponsor.noLongerOnSale")}</p>;

  if (!space || !live) {
    return (
      <Link href={path} className={btnSmallSecondary}>
        {t("publicPages.sponsor.seePackage")}
      </Link>
    );
  }

  if (partnership) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSmall} onClick={() => setAsking(true)}>
          {t("publicPages.sponsor.applyAsPartner")}
        </button>
        {asking && <EnquirySheet space={space} position={null} onClose={closeAsk} onSent={noop} />}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canBuy && cheapest && cheapest.priceCents !== null && (
        <button type="button" className={btnSmall} onClick={() => setCheckoutFor(cheapest)}>
          {t("publicPages.sponsor.buy", { price: usdFromCents(cheapest.priceCents) })}
        </button>
      )}
      {canOffer && (
        <button type="button" className={canBuy ? btnSmallSecondary : btnSmall} onClick={() => setOffering(true)}>
          {t("publicPages.sponsor.makeOffer")}
        </button>
      )}
      {!canBuy && !canOffer && (
        <Link href={path} className={btnSmallSecondary}>
          {t("publicPages.sponsor.seePackage")}
        </Link>
      )}
      <button type="button" className={btnSmallSecondary} onClick={() => setAsking(true)}>
        {t("publicPages.sponsor.getQuote")}
      </button>

      {checkoutFor && (
        <Checkout space={space} position={checkoutFor} onClose={closeCheckout} onPaid={refresh} onByEnquiry={toEnquiry} onNoLongerOnSale={toGone} />
      )}
      {offering && (
        <OfferSheet
          space={space}
          position={isService ? null : cheapest ?? open[0] ?? null}
          kind="offer"
          now={now}
          onClose={closeOffer}
          onSent={refresh}
          onByEnquiry={toEnquiry}
          onNoLongerOnSale={toGone}
        />
      )}
      {asking && <EnquirySheet space={space} position={null} onClose={closeAsk} onSent={noop} />}
    </div>
  );
}
