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

import Link from "next/link";
import { useEffect, useState } from "react";

import { btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { relativeTime, timeLeft } from "@/lib/ad-space/format";
import { describeCreatorError } from "@/lib/creator/api";
import type { OfferView, SalesSummary } from "@/lib/creator/listing";
import { getSales, receivedOffers } from "@/lib/creator/listings";

import { Loading, Notice, Section } from "./parts";

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
    return (
      <Section label="Your money" title="What has reached you">
        <Loading what="your sales" />
      </Section>
    );
  }

  return (
    <Section label="Your money" title="What has reached you">
      <div className="flex flex-col gap-8">
        {sales ? (
          <div className="flex flex-col gap-3">
            <p className="text-h4 font-light text-text">{sales.receivedUsdc} USDC</p>
            <p className="text-small text-text-muted">
              What arrived in your own wallet, across {sales.spaces} {sales.spaces === 1 ? "listing" : "listings"} and{" "}
              {sales.soldSpots} {sales.soldSpots === 1 ? "spot" : "spots"}. Not what sponsors were charged: this is your
              side of it, after our five percent wherever you were the one carrying it.
            </p>
            {sales.recent.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {sales.recent.slice(0, 6).map((r) => (
                  <li key={r.orderId} className="flex flex-wrap items-baseline justify-between gap-2 text-small">
                    <span className="min-w-0 text-text-muted">
                      {r.serviceName || r.spaceTitle} · {r.chain}
                      {r.paidAt ? ` · ${relativeTime(r.paidAt)}` : ""}
                    </span>
                    <span className="font-mono text-text">{r.receivedUsdc} USDC</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {waiting && waiting.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-body text-text">Waiting on you</h3>
              <p className="text-small text-text-muted">
                Each of these runs out on its own clock, and a brand that hears nothing does not come back. Answering is
                two clicks.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {waiting.map((o) => {
                const left = o.expiresAt ? new Date(o.expiresAt).getTime() - Date.now() : null;
                return (
                  <li key={o.id} className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
                    <div className="min-w-0">
                      <p className="text-small text-text">
                        {o.amountUsdc} USDC from {o.sponsor.name}
                      </p>
                      <p className="mt-1 text-tiny text-text-muted">
                        {o.serviceName || o.spaceTitle}
                        {o.positionLabel ? ` · ${o.positionLabel}` : ""} ·{" "}
                        {o.kind === "bid" ? "a bid" : "an offer"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {left !== null && left > 0 ? <span className={pill.attention}>{timeLeft(left)} left</span> : null}
                      <Link href={`/creator/listings/${o.spaceId}`} className={btnSmallSecondary}>
                        Answer it
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {notice ? <Notice>{notice}</Notice> : null}
      </div>
    </Section>
  );
}
