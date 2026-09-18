/**
 * Your listings.
 *
 * WHY A DRAFT IS SHOWN AS LOUDLY AS A LIVE ONE
 *
 * A draft is invisible to everybody else, which is exactly why it is easy to
 * forget: a creator who built a ladder last night and closed the tab has a
 * finished listing nobody can buy from. So drafts come first, they say they
 * are drafts, and the button on them is the one that finishes them.
 *
 * WHAT THE MONEY LINE SAYS, AND WHAT IT DOES NOT
 *
 * `committedCents` is what the sold spots sold FOR — the agreed price on each
 * paid order. It is not the creator's receipt: when the creator carries our
 * five percent, what reaches them is that figure less the fee. So this row
 * says "sold" and the account page's own total says "reached you", and neither
 * borrows the other's word.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { btnPrimary, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { closesText } from "@/lib/ad-space/format";
import { describeCreatorError } from "@/lib/creator/api";
import { usd, type SpaceCard } from "@/lib/creator/listing";
import { myListings } from "@/lib/creator/listings";

import { Loading, Notice, Section } from "./parts";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

export function Listings() {
  const [spaces, setSpaces] = useState<SpaceCard[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { spaces: list } = await myListings();
        if (alive) setSpaces(list);
      } catch (e) {
        if (alive) {
          setSpaces([]);
          setNotice(describeCreatorError(e));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Section label="Your listings" title="What you are selling">
      {spaces === null ? (
        <Loading what="your listings" />
      ) : spaces.length === 0 ? (
        <div className="flex flex-col gap-5">
          <p className="text-body text-text-muted">
            Nothing yet. A listing is the thing a brand buys from: what you are doing, what they get for what price, and
            when it happens. It takes a few minutes and it lives at a link you can post.
          </p>
          <div>
            <Link href="/creator/listings/new" className={btnPrimary}>
              Start a listing
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3">
            {[...spaces]
              .sort((a, b) => (a.status === "draft" ? -1 : 0) - (b.status === "draft" ? -1 : 0))
              .map((s) => (
                <li key={s.id} className={`${card} flex flex-col gap-3 p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-text">{s.serviceName || s.title}</p>
                      <p className="mt-1 text-tiny text-text-muted">
                        {s.status === "draft"
                          ? "Only you can see this"
                          : closesText(s.closesAt, s.status === "closed")}
                        {s.event ? ` · ${s.event.name}` : ""}
                      </p>
                    </div>
                    <span className={s.status === "live" ? pill.open : s.status === "draft" ? pill.attention : pill.neutral}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>

                  <p className="text-small text-text-muted">
                    {s.totals.sold} of {s.totals.positions} sold
                    {s.totals.sold > 0 ? ` · ${usd(s.totals.committedCents)} at the agreed prices` : ""}
                    {s.fundingGoalCents ? ` · goal ${usd(s.fundingGoalCents)}` : ""}
                  </p>

                  {s.awaitingReview > 0 ? (
                    <p className="text-small text-amber">
                      {s.awaitingReview} {s.awaitingReview === 1 ? "sponsor is" : "sponsors are"} waiting for you to say
                      yes or no to what they sent.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {s.status === "draft" ? (
                      <Link href={`/creator/listings/${s.id}/edit`} className={btnSmallSecondary}>
                        Finish it
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>

          <div>
            <Link href="/creator/listings/new" className={btnPrimary}>
              Start another
            </Link>
          </div>
        </div>
      )}

      {notice ? <div className="mt-5">{<Notice>{notice}</Notice>}</div> : null}
    </Section>
  );
}
