"use client";

/**
 * What you paid — the acquisitions behind one holding. Read only.
 *
 * Ported from `app/(drawer)/(internal)/invest/cost/[symbol].tsx`: the count
 * of provisional prices, then one card per acquisition with its amount, the
 * owner's date (or ours, bare, when they gave none), where it came from, the
 * price per coin and the line total, and whether that price is Provisional or
 * theirs. The "How this works" sheet is here as a fold under the list.
 *
 * WHAT THE WEB LEAVES OUT
 *
 * The editor. Correcting a price is a write (`PUT /portfolio/lots/:id`) and
 * the web is view mode, so each card says where the correction happens rather
 * than offering a field that cannot save. Only the price is ever editable in
 * the app; the amount, the network and the day it landed are on-chain facts.
 */

import { useState } from "react";

import { maskTokenSymbol } from "@/lib/app/display-mode";
import type { AcquisitionLot } from "@/lib/app/hold-api";
import { useLots } from "@/lib/app/money";
import { longDate, tokenUnits, unitPrice, usd } from "@/lib/app/portfolio";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { useShellPrefs } from "../Shell";
import { Skeleton } from "../ui";
import { InAppNote, ReadFailed } from "./kit";
import { NoteCard, PortfolioHeader, glassCard } from "./portfolio-kit";

/** "4k13…AffK" — enough to recognise your own exchange. */
const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export function CostBasisScreen({ symbol }: { symbol: string }) {
  const href = useProductHref();
  const { displayMode } = useShellPrefs();
  const ticker = decodeURIComponent(symbol).toUpperCase();
  const shown = maskTokenSymbol(ticker, displayMode) || ticker;
  const lots = useLots(ticker);
  const [info, setInfo] = useState(false);

  const list = lots.data ?? [];
  const provisional = list.filter((l) => !l.confirmed).length;
  const confirmed = list.length - provisional;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col">
      <PortfolioHeader title="What you paid" back={href("/invest/performance")} />

      {!lots.data && !lots.error ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      ) : lots.error && !lots.data ? (
        <div className={glassCard}>
          <ReadFailed title={`We couldn't load your ${shown}`} body="That's not the same as having bought none." onRetry={() => void lots.mutate()} />
        </div>
      ) : list.length === 0 ? (
        <NoteCard title={`Nothing to show for ${shown}`}>
          This is where every {shown} you received turns up, with what we think it cost you.
        </NoteCard>
      ) : (
        <>
          <NoteCard
            title={provisional === 0 ? `All ${confirmed} checked` : `${provisional} ${provisional === 1 ? "price is" : "prices are"} provisional`}
          >
            {provisional === 0 ? "Every price here is one you gave us." : "Priced at what it was worth when it reached HOLD."}
          </NoteCard>

          {list.map((lot) => (
            <LotCard key={lot.entryId} lot={lot} label={maskTokenSymbol(lot.tokenId.toUpperCase(), displayMode) || lot.tokenId} />
          ))}

          <div className="mt-3">
            <InAppNote>Change what you paid in the HOLD app. Only the price moves — everything else here is an on-chain fact.</InAppNote>
          </div>

          <button
            type="button"
            onClick={() => setInfo((v) => !v)}
            aria-expanded={info}
            className="mt-[18px] flex items-center gap-1.5 self-start pl-1 text-[12.5px] font-bold text-white/[0.8] hover:text-white"
          >
            How this works
            <Ion name={info ? "chevron-up" : "chevron-down"} size={14} />
          </button>
          {info ? (
            <div className={`${glassCard} mt-2 flex flex-col gap-3 p-4 text-[13px] leading-[19px] text-white/[0.8]`}>
              <Info title="Why we ask">
                Every cost figure is the market price the moment your coin arrived here. For a swap we ran, that is the truth. For a coin you bought
                elsewhere and withdrew to HOLD, it is not — buy at $60,000, move it here at $78,000, sell at $80,000, and we would report a $2,000 gain on a
                $20,000 one.
              </Info>
              <Info title="Nothing here is required">
                Leave a price alone and we keep the one from the day it arrived. It is usable, it is in every total, and very often it is right.
              </Info>
              <Info title="Only the price moves">
                What arrived, when it landed and on which network are on-chain facts, and nothing can edit them. The one number the chain never had is the
                one you are allowed to correct.
              </Info>
              <Info title="Your export knows the difference">
                The tax file says line by line which prices came from the chain and which came from you, and carries both dates — the day you bought and
                the day it reached us.
              </Info>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Info({ title, children }: { title: string; children: string | string[] }) {
  return (
    <div>
      <p className="text-[14px] font-bold text-white">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function LotCard({ lot, label }: { lot: AcquisitionLot; label: string }) {
  const lineTotal = lot.units != null && lot.unitPriceUsd != null ? lot.units * lot.unitPriceUsd : null;
  return (
    <div className={`${glassCard} mt-2.5 p-4`}>
      <div className="flex items-start">
        <div className="min-w-0 flex-1 pr-2.5">
          <p className="truncate text-[15px] font-bold text-white">
            {tokenUnits(lot.units, true)} {label}
          </p>
          {/* One date, and it is the owner's; ours goes out bare. */}
          <p className="mt-0.5 text-[12px] font-strong text-white/[0.7]">{lot.acquiredAt ? `Bought ${longDate(lot.acquiredAt)}` : longDate(lot.arrivedAt)}</p>
          {lot.external ? (
            <p className="mt-0.5 truncate text-[12px] font-strong text-white/[0.7]">
              From outside HOLD{lot.fromAddress ? ` · ${shortAddress(lot.fromAddress)}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <p className="text-[15px] font-bold tabular-nums text-white">{lot.unitPriceUsd != null ? unitPrice(lot.unitPriceUsd) : "—"}</p>
          <p className="mt-0.5 text-[12px] font-strong tabular-nums text-white/[0.7]">{lineTotal != null ? `${usd(lineTotal)} in total` : "each"}</p>
        </div>
      </div>
      {/* One state is marked, not two: the glass pill sits on the lines that are still ours to answer for. */}
      <div className="mt-3 flex items-center">
        {lot.confirmed ? (
          <span className="text-[11px] font-strong tracking-[0.3px] text-white/[0.6]">Your price</span>
        ) : (
          <span className="inline-flex h-6 items-center justify-center rounded-[12px] border border-white/[0.16] bg-white/[0.07] px-2.5 text-[11px] font-bold tracking-[0.3px] text-white/[0.75]">
            Provisional
          </span>
        )}
      </div>
    </div>
  );
}
