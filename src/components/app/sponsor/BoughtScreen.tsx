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
 * AND WHAT HAPPENS AFTER PAYING
 *
 * Paying is not the last step: a spot is a promise to print something, and an
 * unfilled one is an empty square somebody has already been charged for. That
 * hand-over used to live only on the listing's own public page, which proves
 * the spot is yours with a checkout key in one browser's localStorage — so a
 * brand who paid on a laptop could not finish on a phone. Here the order is
 * the proof, and `contentStatus` (which `GET /orders/mine` has always
 * answered, and nothing ever read) says where it stands.
 */

import { useEffect, useState } from "react";

import { myOrders, type MyOrder } from "@/lib/app/sponsor";

import { Column } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { Card, Empty, SectionLabel, Tag } from "../spaces/kit";
import { ArtworkSheet } from "./ArtworkSheet";

const money = (usdc: string) => {
  const n = Number(usdc);
  return Number.isFinite(n) ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
};

/**
 * What a status means to the person who PAID, which is not what it means to
 * the creator. `paid_duplicate` is the one that has to be said plainly: money
 * arrived that could not buy the spot, and somebody has to give it back.
 */
function statusOf(o: MyOrder): { label: string; tone: "good" | "caution" | "calm" } {
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
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState<MyOrder | null>(null);

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
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <Tag label={st.label} tone={st.tone} />
                  {contentTag(o) ? <Tag label={contentTag(o)!.label} tone={contentTag(o)!.tone} /> : null}
                </span>
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
                {o.status === "paid" ? (
                  <button
                    type="button"
                    onClick={() => setSending(o)}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-strong text-amber transition-colors hover:text-amber-glow"
                  >
                    <Ion name="image-outline" size={14} />
                    {artworkCta(o.contentStatus)}
                  </button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {sending ? (
        <ArtworkSheet
          order={sending}
          onClose={() => setSending(null)}
          onSent={(status) =>
            setOrders((prev) => prev?.map((o) => (o.id === sending.id ? { ...o, contentStatus: status } : o)) ?? prev)
          }
        />
      ) : null}
    </Column>
  );
}

/**
 * What the button says, which is the shortest honest description of the next
 * thing to do. A spot with nothing sent yet is the one that needs a nudge; one
 * already approved still opens, because a brand is allowed to change its mind
 * and the creator approves the new version too.
 */
function artworkCta(status: MyOrder["contentStatus"]): string {
  if (status === "rejected") return "Send a new version";
  if (status === "pending") return "Waiting for approval";
  if (status === "approved") return "Change your artwork";
  return "Send your artwork";
}

/**
 * The content's state, beside the order's own. Deliberately absent on anything
 * unpaid: `contentStatus` is null there, and a second tag saying nothing has
 * been sent for a spot nobody holds is noise.
 *
 * `rejected` reads as "caution", never as a failure. The creator asking for a
 * different logo is an ordinary step, not something going wrong.
 */
function contentTag(o: MyOrder): { label: string; tone: "good" | "caution" | "calm" } | null {
  if (o.status !== "paid") return null;
  if (o.contentStatus === "approved") return { label: "On the board", tone: "good" };
  if (o.contentStatus === "pending") return { label: "Artwork sent", tone: "calm" };
  if (o.contentStatus === "rejected") return { label: "Change asked for", tone: "caution" };
  return { label: "No artwork yet", tone: "caution" };
}
