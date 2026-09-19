/**
 * What has reached you, and who is waiting.
 *
 * WHY THIS NUMBER AND NOT THE ONE ON THE LISTINGS
 *
 * A listing's row says what its spots sold FOR — the agreed price on each paid
 * order. This says what arrived in the creator's own wallet, which is the
 * server's own figure (`receivedUsdc`, the creator leg of every paid order)
 * and is a different number whenever the creator carries our five percent.
 * They are never given each other's words: one says "sold", this one says
 * "reached you".
 *
 * WHY THE INBOX IS HERE AND NOT ONLY ON EACH LISTING
 *
 * An offer waiting on you is the only thing on this whole console that costs
 * money by being ignored: it has 48 hours and then it is gone. A creator with
 * three listings should not have to open three pages to find out.
 */

"use client";

import { useEffect, useState } from "react";

import { relativeTime, timeLeft } from "@/lib/ad-space/format";
import { describeCreatorError } from "@/lib/creator/api";
import type { OfferView, SalesSummary } from "@/lib/creator/listing";
import { getSales, receivedOffers } from "@/lib/creator/listings";

import { Notice as HoldNotice } from "../app/hold";
import { Card, Empty, money, SectionLabel, SheetRow } from "../app/spaces/kit";

export function Sales() {
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [waiting, setWaiting] = useState<OfferView[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [s, o] = await Promise.all([getSales(), receivedOffers()]);
        if (!alive) return;
        setSales(s.sales);
        setWaiting(o.offers.filter((x) => x.status === "pending"));
      } catch (e) {
        if (alive) {
          setSales(null);
          setWaiting([]);
          setNotice(describeCreatorError(e));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (sales === null && waiting === null) {
    return <Empty icon="hourglass-outline" title="Loading…" />;
  }

  // The app's SalesView: the Received card, then the threads waiting on you, then the latest sales.
  return (
    <div className="flex flex-col gap-2.5">
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      {sales ? (
        <Card>
          <p className="text-[12px] font-strong uppercase tracking-[0.4px] text-white/55">Received</p>
          <p className={money}>{sales.receivedUsdc} USDC</p>
          <p className="text-[13px] font-strong leading-[18px] text-white/[0.62]">
            {sales.soldSpots} {sales.soldSpots === 1 ? "spot" : "spots"} sold across {sales.spaces} {sales.spaces === 1 ? "space" : "spaces"}
          </p>
          <p className="text-[12px] leading-4 text-white/55">USDC, straight to your wallet when each brand paid.</p>
        </Card>
      ) : null}

      {waiting && waiting.length > 0 ? (
        <>
          <SectionLabel>Waiting on you</SectionLabel>
          {waiting.map((o) => {
            const left = o.expiresAt ? new Date(o.expiresAt).getTime() - Date.now() : null;
            return (
              <SheetRow
                key={o.id}
                href={`/creator/listings/${o.spaceId}`}
                icon="pricetags-outline"
                attention
                title={`${o.kind === "bid" ? "Bid" : "Offer"} ${o.amountUsdc} USDC · ${o.sponsor.name}`}
                meta={[o.serviceName || o.spaceTitle, o.positionLabel, left !== null && left > 0 ? `${timeLeft(left)} left to answer` : null].filter(Boolean).join(" · ")}
              />
            );
          })}
        </>
      ) : null}

      {sales && sales.recent.length > 0 ? (
        <>
          <SectionLabel>Recent sales</SectionLabel>
          {sales.recent.slice(0, 6).map((r) => (
            <Card key={r.orderId}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{r.serviceName || r.spaceTitle}</p>
                  <p className="truncate text-[12.5px] font-strong text-white/55">{[r.chain, r.paidAt ? relativeTime(r.paidAt) : null].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="shrink-0 text-[15px] font-strong tabular-nums text-[#2FBE8A]">{r.receivedUsdc} USDC</p>
              </div>
            </Card>
          ))}
        </>
      ) : sales ? (
        <Empty icon="cash-outline" title="No sales yet" body="When a brand pays for a spot on one of your spaces, it shows here." />
      ) : null}
    </div>
  );
}
