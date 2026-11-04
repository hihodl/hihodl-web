"use client";

/**
 * One result, in two sizes — the app's `StayCard.tsx`.
 *
 * WHY THERE ARE TWO
 *
 * The first result is a HERO: a wide photograph, the points it earns, the
 * price at 21px. Every result after it is a COMPACT row with an 84px
 * thumbnail. That is not variety for its own sake. The hero teaches what a
 * result is — a photograph, a score, a total for the whole stay, not a nightly
 * rate — and once that is learnt the rows can be scanned.
 *
 * THE STRUCK-THROUGH PRICE IS A CLAIM, SO IT IS GATED
 *
 * It appears only when the saving is at least 2 % of the public price, and
 * only when the server could quote a public price at all. A crossed-out figure
 * is us saying "this is cheaper than booking direct"; below 2 % that is inside
 * the noise of which rate the supplier happened to return, and we would be
 * saying something we cannot stand behind. It is drawn dim with a line through
 * it — never red, because nothing in this product is red.
 *
 * A SEEN CARD FADES
 *
 * A result already opened this session drops to 58 % — the same trick a
 * browser plays with a visited link, and for the same reason: on the fourth
 * pass down a list of forty hotels, "which of these have I already looked at"
 * is the only question left.
 */

import { Ion } from "../ion";

import { Photo, ScorePill } from "./kit";
import { P, count, money, pointsOff, provablyCheaper, ratingLabel } from "./look";
import type { StayResult } from "@/lib/app/stays";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

function Tag({ refundable }: { refundable: boolean }) {
  const t = useT();
  return (
    <span
      className="mb-0.5 shrink-0 rounded-[8px] px-[9px] py-[5px] text-[11px] font-semibold tracking-[-0.1px]"
      style={{
        background: refundable ? P.greenSoft : "rgba(255,255,255,0.06)",
        color: refundable ? P.greenText : P.textMuted,
      }}
    >
      {refundable ? t("stays.rate.freeCancellation") : t("stays.rate.nonRefundable")}
    </span>
  );
}

export function StayCard({
  stay,
  nights,
  hero = false,
  seen = false,
  onOpen,
}: {
  stay: StayResult;
  nights: number;
  hero?: boolean;
  /** Already opened this session. */
  seen?: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const { rate } = stay;
  const was = provablyCheaper(rate) ? money(rate.publicPrice!, rate.currency) : null;
  const sub = t("trips.card.total", { count: nights });
  const word = ratingLabel(stay.guestRating);

  if (!hero) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mb-[10px] flex w-full items-center gap-3 rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04] p-[10px] text-left transition-opacity hover:bg-white/[0.06] active:opacity-90"
        style={{ opacity: seen ? 0.58 : 1 }}
      >
        <span className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: "rgba(255,255,255,0.03)" }}>
          <Photo image={stay.photo} alt={stay.name} iconSize={20} sizes="84px" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-[14.5px] font-bold leading-[19px] tracking-[-0.3px]" style={{ color: P.text }}>
            {stay.name}
          </span>
          <span className="truncate text-[12.5px] font-medium" style={{ color: P.textDim }}>
            {[rate.roomName || stay.city || word, rate.boardName].filter(Boolean).join(" · ")}
          </span>
          {stay.guestRating !== null ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px] font-extrabold tabular-nums tracking-[-0.2px]" style={{ color: P.text }}>
                {fmtNumber(stay.guestRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              {word ? (
                <span className="truncate text-[12px]" style={{ color: P.textDim }}>
                  {word}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        {/* A fixed column, so the decimals line up down the list. */}
        <span className="flex min-w-[74px] shrink-0 flex-col items-end gap-0.5">
          {was ? (
            // Above the price, never beside it: at this width they would wrap
            // and the reader would be left deciding which number is the price.
            <span className="text-[11.5px] font-semibold tabular-nums tracking-[-0.2px] line-through" style={{ color: P.textDim }}>
              {was}
            </span>
          ) : null}
          <span className="text-[16.5px] font-extrabold tabular-nums tracking-[-0.5px]" style={{ color: P.text }}>
            {money(rate.price, rate.currency)}
          </span>
          <span className="text-[11px] font-medium" style={{ color: P.textDim }}>
            {sub}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-3 flex w-full flex-col overflow-hidden rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04] text-left transition-opacity active:opacity-90"
      style={{ opacity: seen ? 0.58 : 1 }}
    >
      <span className="relative block h-[178px] w-full" style={{ background: "rgba(255,255,255,0.03)" }}>
        <Photo image={stay.photoLarge ?? stay.photo} alt={stay.name} iconSize={22} priority sizes="(min-width: 1024px) 720px, 100vw" />
        {rate.maxPointsRedeemable > 0 ? (
          <span
            className="absolute right-3 top-3 flex items-center gap-1 rounded-[999px] px-[9px] py-[5px] text-[11px] font-extrabold tracking-[-0.1px]"
            style={{ background: "rgba(10,20,32,0.72)", border: `0.5px solid rgba(255,183,3,0.34)`, color: P.caution }}
          >
            <Ion name="star" size={10} />
            {pointsOff(rate.maxPointsRedeemable)}
          </span>
        ) : null}
      </span>

      <span className="flex flex-col gap-1.5 p-[14px]">
        <span className="line-clamp-2 text-[16.5px] font-bold leading-[21px] tracking-[-0.35px]" style={{ color: P.text }}>
          {stay.name}
        </span>

        <span className="flex items-center gap-1.5">
          {stay.guestRating !== null ? (
            <>
              <ScorePill rating={stay.guestRating} />
              {word ? (
                <span className="text-[12.5px] font-medium" style={{ color: P.textMuted }}>
                  {word}
                </span>
              ) : null}
              {stay.reviewCount ? (
                <span className="text-[12px]" style={{ color: P.textDim }}>
                  {`· ${count(stay.reviewCount)}`}
                </span>
              ) : null}
            </>
          ) : stay.city ? (
            <span className="truncate text-[12.5px] font-medium" style={{ color: P.textMuted }}>
              {stay.city}
            </span>
          ) : null}
        </span>

        <span className="truncate text-[12.5px] font-medium" style={{ color: P.textDim }}>
          {[rate.roomName, rate.boardName].filter(Boolean).join(" · ")}
        </span>

        <span className="mt-1 flex items-end gap-2.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline gap-2">
              <span className="mt-px text-[21px] font-extrabold tabular-nums tracking-[-0.6px]" style={{ color: P.text }}>
                {money(rate.price, rate.currency)}
              </span>
              {was ? (
                <span className="text-[13px] font-semibold tabular-nums tracking-[-0.2px] line-through" style={{ color: P.textDim }}>
                  {was}
                </span>
              ) : null}
            </span>
            <span className="mt-px text-[11.5px] font-medium" style={{ color: P.textDim }}>
              {sub}
            </span>
          </span>
          <Tag refundable={rate.refundable} />
        </span>
      </span>
    </button>
  );
}

/**
 * The loading state, and it is static.
 *
 * No shimmer: a sweeping highlight reads as a mobile game rather than as a
 * bank, and this is a screen where somebody is about to spend a few hundred
 * euros. Bars at the widths the real content takes, so nothing jumps when it
 * arrives.
 */
export function StayCardSkeleton({ hero = false }: { hero?: boolean }) {
  const bar = (w: string, h: number, mt = 0) => (
    <span className="block rounded-[5px]" style={{ width: w, height: h, marginTop: mt, background: "rgba(255,255,255,0.09)" }} />
  );
  const fill = { background: "rgba(255,255,255,0.06)" };

  if (!hero) {
    return (
      <div className="mb-[10px] flex items-center gap-3 rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04] p-[10px]">
        <span className="h-[84px] w-[84px] shrink-0 rounded-[14px]" style={fill} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {bar("76%", 12)}
          {bar("52%", 10)}
          {bar("34%", 10)}
        </span>
        <span className="flex min-w-[74px] flex-col items-end gap-1">
          {bar("56px", 14)}
          {bar("38px", 9)}
        </span>
      </div>
    );
  }
  return (
    <div className="mb-3 overflow-hidden rounded-[24px] border-[0.5px] border-white/10 bg-white/[0.04]">
      <span className="block h-[178px] w-full" style={fill} />
      <span className="flex flex-col gap-1.5 p-[14px]">
        {bar("62%", 15)}
        {bar("40%", 11)}
        {bar("50%", 11)}
        {bar("34%", 19, 6)}
      </span>
    </div>
  );
}
