"use client";

/**
 * Spaces › Your spots — what this account has bought.
 *
 * `GET /ad-space/orders/mine` has answered this since Ad Space shipped and
 * nothing on the web asked it, because the web had no brand at all: an
 * anonymous sponsor's orders are found by a checkout key in that one browser's
 * localStorage, so "your spots" was a list that only existed on the device
 * that bought them. With an account it is a list that follows the account.
 *
 * WHAT THIS DOES NOT DO YET, AND SAYS SO
 *
 * Sending the creator your artwork — `PUT /ad-space/orders/:id/content` and
 * the image upload beside it — is the brand's next job after paying, and it
 * has no screen here yet. Rather than a button that goes nowhere, a paid spot
 * links to the listing's own public page, where the flow the anonymous sponsor
 * uses already works. A promise we cannot keep on this screen is worse than a
 * link to the one that can.
 */

import { useEffect, useState } from "react";

import type { Order } from "@/lib/ad-space/types";
import { myOrders } from "@/lib/app/sponsor";

import { Column } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { Card, Empty, SectionLabel, Tag } from "../spaces/kit";

const money = (usdc: string) => {
  const n = Number(usdc);
  return Number.isFinite(n) ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
};

/**
 * What a status means to the person who PAID, which is not what it means to
 * the creator. `paid_duplicate` is the one that has to be said plainly: money
 * arrived that could not buy the spot, and somebody has to give it back.
 */
function statusOf(o: Order): { label: string; tone: "good" | "caution" | "calm" } {
  switch (o.status) {
    case "paid":
      return { label: "Yours", tone: "good" };
    case "awaiting_payment":
      return { label: "Not paid yet", tone: "caution" };
    case "quoted":
      return { label: "Not paid yet", tone: "caution" };
    case "outbid":
      return { label: "Taken over — you were repaid", tone: "calm" };
    case "paid_duplicate":
      return { label: "Paid twice — we are on it", tone: "caution" };
    case "expired":
      return { label: "The hold ran out", tone: "calm" };
    default:
      return { label: "Cancelled", tone: "calm" };
  }
}

export function BoughtScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    myOrders().then(
      (r) => alive && setOrders(r.orders),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Column>
      <SectionLabel>Spots you have bought</SectionLabel>

      <div className="mt-3 flex flex-col gap-3">
        {orders === null && !failed ? (
          <>
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
                <Skeleton className="h-4 w-[55%] rounded-[7px]" />
                <Skeleton className="h-3 w-[35%] rounded-[6px]" />
              </div>
            ))}
          </>
        ) : null}

        {failed ? <Empty icon="alert-circle-outline" title="Could not load your spots" body="Reload the page to try again." /> : null}

        {orders?.length === 0 ? (
          <Empty icon="megaphone-outline" title="No spots yet" body="Find one on the board and it lands here." />
        ) : null}

        {orders?.map((o) => {
          const st = statusOf(o);
          return (
            <Card key={o.id}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">
                    {money(o.sponsorPaysUsdc)}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-white/[0.62]">
                    {o.paidAt ? new Date(o.paidAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "Not paid"}
                    {" · "}
                    {o.chain}
                  </span>
                </span>
                <Tag label={st.label} tone={st.tone} />
              </div>

              <div className="mt-2.5 flex items-center gap-3 border-t border-white/[0.08] pt-2.5">
                {o.explorerUrl ? (
                  <a
                    href={o.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-strong text-white/70 transition-colors hover:text-white"
                  >
                    <Ion name="open-outline" size={14} />
                    Receipt
                  </a>
                ) : null}
                {/* The artwork flow lives on the listing's own page for now —
                    see the note at the top of this file. */}
                {o.status === "paid" && o.share?.url ? (
                  <a
                    href={o.share.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-strong text-white/70 transition-colors hover:text-white"
                  >
                    <Ion name="image-outline" size={14} />
                    Send your artwork
                  </a>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </Column>
  );
}
