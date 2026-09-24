"use client";

/**
 * Spaces › Find a spot — the brand's side of the product.
 *
 * ── WHY THE BOARD AND NOT A CHAT ──
 *
 * The first cut put buying behind a button above a conversation, and the
 * reasoning did not survive being said out loud: most sponsors have no HOLD
 * account at all (a public listing page asks for none), every offer already
 * carries an email or a Telegram, and an offer's rounds are a better record of
 * a negotiation than free text beside it. A chat needed a Buy button bolted on
 * to be worth anything, which is the tell — the button was the product.
 *
 * So buying lives where a brand already is: a board of what is for sale.
 * `GET /ad-space/board` has answered this since Ad Space shipped, with the
 * caller's own id so blocked creators drop out, and nothing on the web asked
 * it. The chat keeps a shortcut to the same sheet, third in line and no more.
 *
 * ── WHAT BUYING SIGNED IN IS ACTUALLY WORTH ──
 *
 * Not polish. Three things on the row, all of them from
 * `order.sponsorUserId` being set:
 *
 *   gasless   `solanaHandoff` reads `relayed = sponsorUserId !== null`, so the
 *             relayer is the fee payer and the brand needs no SOL
 *   HiPoints  `awardSponsorPoints` needs it. An anonymous order credits nobody
 *   the name  `payFromOf()` files the sale as "hold" instead of a stranger's
 *             wallet, so the creator sees a brand that pays from HOLD and
 *             comes back
 *
 * ── ONE SOURCE FOR WHAT IS OPEN ──
 *
 * The cards come from the authenticated board; the spots inside a listing come
 * from the same public read the listing page uses. There is no second,
 * console-only view of "what is still available" — the first time two of those
 * disagreed, a brand would be paying for a spot the page called gone.
 */

import { useCallback, useEffect, useState } from "react";

import { boardListings, type BoardCard } from "@/lib/app/sponsor";

import { Column } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { Card, Chip, ChipRow, Empty, SectionLabel } from "../spaces/kit";
import { BuyFromListing } from "./SponsorFlow";

type Kind = "all" | "placement" | "service";

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function BoardScreen() {
  const [kind, setKind] = useState<Kind>("all");
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [buying, setBuying] = useState<BoardCard | null>(null);

  const load = useCallback(() => {
    setCards(null);
    setFailed(false);
    boardListings({ kind: kind === "all" ? undefined : kind, limit: 30 }).then(
      (r) => setCards(r.spaces),
      () => setFailed(true),
    );
  }, [kind]);

  useEffect(load, [load]);

  return (
    <Column>
      <SectionLabel>What creators are selling</SectionLabel>
      <p className="mt-1 px-1 text-[13px] leading-[19px] text-white/[0.62]">
        Pay from your HOLD wallet and it goes straight to the creator. No gas, and you earn HiPoints on our fee.
      </p>

      <div className="mt-3">
      <ChipRow>
        {(
          [
            { k: "all", label: "Everything" },
            { k: "placement", label: "On a product" },
            { k: "service", label: "Services" },
          ] as { k: Kind; label: string }[]
        ).map((c) => (
          <Chip key={c.k} label={c.label} selected={kind === c.k} onClick={() => setKind(c.k)} />
        ))}
      </ChipRow>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {cards === null && !failed ? <BoardSkeleton /> : null}

        {failed ? (
          <div className="flex flex-col items-center px-4 pt-10 text-center">
            <Ion name="alert-circle-outline" size={44} className="text-white/40" />
            <p className="mt-3 text-[14px] text-white/[0.62]">Could not load what is for sale</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 rounded-[12px] bg-white/10 px-5 py-2.5 text-[14px] font-strong text-white transition-colors hover:bg-white/[0.16]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {cards?.length === 0 ? (
          <Empty
            icon="megaphone-outline"
            title="Nothing listed here yet"
            body={kind === "all" ? "Creators are still building their first listings." : "Try another kind."}
          />
        ) : null}

        {cards?.map((c) => (
          <Listing key={c.id} card={c} onBuy={() => setBuying(c)} />
        ))}
      </div>

      {buying ? (
        <BuyFromListing
          spaceId={buying.id}
          listingTitle={buying.serviceName?.trim() || buying.title}
          creatorName={buying.creator.xHandle ? `@${buying.creator.xHandle}` : "the creator"}
          onClose={() => setBuying(null)}
          onBought={() => {
            setBuying(null);
            load();
          }}
        />
      ) : null}
    </Column>
  );
}

/**
 * One listing, said the way a brand reads it: what it is, who is selling,
 * whether they deliver, what it costs and how long is left.
 *
 * The track record is SHOWN and never scored. Delivered and missed are facts
 * a brand can weigh; a badge from us saying "trusted" would be a claim we
 * would then have to stand behind.
 */
function Listing({ card, onBuy }: { card: BoardCard; onBuy: () => void }) {
  const handle = card.creator.xHandle ? `@${card.creator.xHandle}` : "A creator on HOLD";
  const record = card.creator.trackRecord;
  const closes = daysLeft(card.closesAt);
  const priced = card.fromCents !== null && card.openCount > 0;

  return (
    <Card>
      <div className="flex items-start gap-3">
        {card.photoUrl || card.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(card.photoUrl ?? card.bannerUrl)!}
            alt=""
            className="h-[52px] w-[52px] shrink-0 rounded-[12px] object-cover"
          />
        ) : (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] bg-white/[0.08]">
            <Ion name="megaphone-outline" size={20} className="text-white/50" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">
            {card.serviceName?.trim() || card.title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-white/70">
            {handle}
            {card.eventName ? ` · ${card.eventName}` : ""}
          </p>
          {record.delivered + record.missed > 0 ? (
            <p className="mt-0.5 text-[11.5px] text-white/50">
              {record.delivered} delivered{record.missed > 0 ? ` · ${record.missed} missed` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {card.reason?.trim() ? (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-[18px] text-white/[0.62]">{card.reason.trim()}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.08] pt-2.5">
        <span className="min-w-0 flex-1 text-[12.5px] text-white/[0.62]">
          {card.openCount > 0 ? `${card.openCount} ${card.openCount === 1 ? "spot" : "spots"} open` : "Fully booked"}
          {closes ? ` · ${closes}` : ""}
        </span>
        <button
          type="button"
          onClick={onBuy}
          disabled={!priced}
          title={priced ? undefined : "Nothing on this listing has a price to pay right now."}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-amber px-3.5 text-[12.5px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:cursor-not-allowed disabled:bg-white/[0.12] disabled:text-white/50"
        >
          {priced ? `Book from ${money(card.fromCents!)}` : "Not on sale"}
        </button>
      </div>
    </Card>
  );
}

/** "3 days left", and nothing at all once it is a month away: a deadline is only news when it is near. */
function daysLeft(iso: string): string | null {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "closed";
  const days = Math.ceil(ms / 86_400_000);
  if (days > 30) return null;
  return days === 1 ? "1 day left" : `${days} days left`;
}

function BoardSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5">
          <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-[12px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-[60%] rounded-[7px]" />
            <Skeleton className="h-3 w-[40%] rounded-[6px]" />
            <Skeleton className="h-3 w-[70%] rounded-[6px]" />
          </div>
        </div>
      ))}
    </>
  );
}
