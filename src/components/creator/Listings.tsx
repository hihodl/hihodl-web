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

import { ctaPrimary } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Empty, SectionLabel } from "@/components/app/spaces/kit";
import { SpaceCard } from "@/components/app/spaces/ListingsScreen";
import { describeCreatorError } from "@/lib/creator/api";
import type { SpaceCard as Listing, SpaceStatus } from "@/lib/creator/listing";
import { myListings } from "@/lib/creator/listings";

import { Loading, Notice } from "./parts";

const ORDER: SpaceStatus[] = ["live", "draft", "closed", "delisted"];
const GROUP_LABEL: Record<SpaceStatus, string> = { live: "Live", draft: "Drafts", closed: "Closed", delisted: "Taken down" };

/** The app's MySpacesList: Create on top, then the listings grouped by status. */
export function Listings() {
  const [spaces, setSpaces] = useState<Listing[] | null>(null);
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

  const groups = ORDER.map((st) => ({ st, rows: (spaces ?? []).filter((s) => s.status === st) })).filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="sm:max-w-[360px]">
        <Link href="/creator/listings/new" className={ctaPrimary}>
          <Ion name="add" size={20} />
          Create a space
        </Link>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
      {spaces === null ? (
        <Loading what="your listings" />
      ) : spaces.length === 0 && !notice ? (
        <Empty
          icon="megaphone-outline"
          title="Sell sponsor spots"
          body="Pick your hook: something you'll carry or wear that makes people look, or content you make. Brands pay for your reach and your content, in USDC, straight to your wallet."
        />
      ) : (
        groups.map((g) => (
          <section key={g.st} className="flex flex-col gap-2.5">
            <SectionLabel>{GROUP_LABEL[g.st]}</SectionLabel>
            {g.rows.map((s) => (
              <SpaceCard key={s.id} listing={s} href={s.status === "draft" ? `/creator/listings/${s.id}/edit` : `/creator/listings/${s.id}`} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
