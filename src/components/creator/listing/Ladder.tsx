/**
 * The ladder: three different things at three prices, on one listing.
 *
 * WHY THIS SHAPE EXISTS AT ALL
 *
 * A creator covering a conference sells a logo in their mini strip for $50, a
 * card and mic placement for $200, and one flagship on-site interview for
 * $1,300. Three things, three prices, each with its own list of what the brand
 * gets. Without a ladder that is three listings, or one that undersells two
 * thirds of itself — and the ladder is the thing that makes the listing work,
 * because it lets a brand come in at $50 and a brand buy the headline.
 *
 * THE RULE THAT SHAPES THIS FILE
 *
 * A RUNG'S WAY OF SELLING IS NOT THE BOARD'S. The same listing can be at fixed
 * prices overall and still send one rung out to the highest bid. So every
 * control on a rung — whether there is a price box at all, whether there is a
 * floor box, how many copies it may sell in — is decided from THAT RUNG's
 * mode, resolved by `saleModeOf`, and never from the listing's. Deriving them
 * from the board was a whole family of bugs; this is where it does not come
 * back.
 *
 * AND THE ONE RULE A RUNG HAS THAT A LISTING DOES NOT
 *
 * A rung sold to the highest bid sells exactly ONE thing. Bidding is one item
 * going to one winner; five identical copies under one countdown is an auction
 * house's problem, not a creator's. Choosing bids here sets the count to one
 * and says why, rather than letting the creator build it and meet
 * `bid_tier_sells_one` at the end.
 */

"use client";

import { Ion } from "@/components/app/ion";
import { Card, Chip, ChipRow, fieldLabel, SectionLabel } from "@/components/app/spaces/kit";
import type { MessageKey } from "@/lib/app/i18n";
import { Rich, useT } from "@/lib/app/i18n/react";
import {
  LIMITS,
  modeKeepsFloor,
  modeShowsPrice,
  newRung,
  saleModeOf,
  usd,
  feeSplit,
  centsFromDollars,
  type ListingDraft,
  type RungDraft,
  type SaleMode,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { btnSmallGlass, Count, Field, Money, Paragraph, Problems, Text } from "./parts";
import { feePctText } from "@/lib/ad-space/fee";

const FEE = feePctText();

const iconBtn = `${btnSmallGlass} !w-9 !px-0`;

/** How the whole listing sells, said in the words the rung's dropdown uses. */
function boardModeText(draft: ListingDraft): MessageKey {
  switch (draft.pricingMode) {
    case "offers":
      return "listings.ladder.board.offers";
    case "bids":
      return "listings.ladder.board.bids";
    case "takeover":
      return "listings.ladder.board.takeover";
    default:
      return draft.acceptsOffers ? "listings.ladder.board.fixedWithOffers" : "listings.ladder.board.fixed";
  }
}

const MODE_OPTIONS: readonly { value: SaleMode; label: MessageKey }[] = [
  { value: "fixed", label: "listings.ladder.mode.fixed" },
  { value: "fixed_with_offers", label: "listings.ladder.mode.fixedWithOffers" },
  { value: "offers", label: "listings.ladder.mode.offers" },
  { value: "bids", label: "listings.ladder.mode.bids" },
];

export function Ladder({
  draft,
  onChange,
  problems,
  maxSlots,
  isSession,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
  maxSlots: number;
  isSession: boolean;
}) {
  const t = useT();
  const rungs = draft.rungs;
  const set = (next: RungDraft[]) => onChange({ ...draft, rungs: next });
  const patch = (index: number, change: Partial<RungDraft>) =>
    set(rungs.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const copies = rungs.reduce((sum, r) => sum + (Number.isInteger(r.available) ? Math.max(0, r.available) : 0), 0);

  return (
    <div className="flex flex-col gap-2.5">
      {rungs.map((rung, index) => (
        <Rung
          key={rung.key}
          draft={draft}
          rung={rung}
          index={index}
          total={rungs.length}
          maxSlots={maxSlots}
          isSession={isSession}
          problems={problems}
          onPatch={(change) => patch(index, change)}
          onRemove={() => set(rungs.filter((_, i) => i !== index))}
          onMove={(by) => {
            const to = index + by;
            if (to < 0 || to >= rungs.length) return;
            const next = [...rungs];
            const [moved] = next.splice(index, 1);
            next.splice(to, 0, moved);
            set(next);
          }}
        />
      ))}

      <Problems list={problemsAt(problems, "ladder")} />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <ChipRow label={t("listings.ladder.label")}>
          <Chip
            icon="add"
            label={t("listings.ladder.addTier")}
            disabled={rungs.length >= LIMITS.MAX_TIERS}
            onClick={() => set([...rungs, newRung(rungs)])}
          />
        </ChipRow>
        <span className="text-[11.5px] font-bold uppercase tracking-[0.4px] text-white/55">
          {t("listings.ladder.copies", { copies, max: maxSlots })}
        </span>
      </div>
      {rungs.length > 1 ? (
        <p className="text-[12px] leading-4 text-white/55">{t("listings.ladder.cumulative")}</p>
      ) : null}
    </div>
  );
}

function Rung({
  draft,
  rung,
  index,
  total,
  maxSlots,
  isSession,
  problems,
  onPatch,
  onRemove,
  onMove,
}: {
  draft: ListingDraft;
  rung: RungDraft;
  index: number;
  total: number;
  maxSlots: number;
  isSession: boolean;
  problems: readonly Problem[];
  onPatch: (change: Partial<RungDraft>) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
}) {
  const t = useT();
  // THE line this file exists for: the rung's own mode, never the board's.
  const mode = saleModeOf(draft, rung.saleMode);
  const showsPrice = modeShowsPrice(mode);
  const keepsFloor = modeKeepsFloor(mode);
  // Whether this rung is bid for, however it came to be: its own answer or the
  // listing's. The one-copy rule hangs off this and not off who named it,
  // because the rule is about substitutes — see rules.ts.
  const bidding = mode === "bids";
  const at = (part: string) => problemsAt(problems, `rung:${rung.key}:${part}`);
  const id = (part: string) => `rung-${rung.key}-${part}`;

  const priceCents = centsFromDollars(rung.priceDollars);
  const split = showsPrice && priceCents !== null ? feeSplit(priceCents, draft.feePayer) : null;

  const perks = rung.perks.length ? rung.perks : [""];

  return (
    <Card className="!gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>
          <Rich
            k="listings.ladder.tierOf"
            vars={{ n: index + 1, total }}
            tags={{ of: (c) => <span className="ml-1 normal-case tracking-normal">{c}</span> }}
          />
        </SectionLabel>
        <div className="flex gap-1.5">
          <button type="button" aria-label={t("listings.ladder.moveUp")} className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)}>
            <Ion name="chevron-up" size={18} />
          </button>
          <button type="button" aria-label={t("listings.ladder.moveDown")} className={iconBtn} disabled={index === total - 1} onClick={() => onMove(1)}>
            <Ion name="chevron-down" size={18} />
          </button>
          <button type="button" aria-label={t("listings.ladder.removeTier")} className={iconBtn} disabled={total === 1} onClick={onRemove}>
            <Ion name="trash-outline" size={17} />
          </button>
        </div>
      </div>

      <Field
        label={t("listings.ladder.title")}
        hint={t("listings.ladder.titleHint")}
        problems={at("title")}
        htmlFor={id("title")}
      >
        <Text
          id={id("title")}
          value={rung.title}
          onChange={(title) => onPatch({ title })}
          maxLength={LIMITS.TIER_TITLE_MAX}
          placeholder={t("listings.ladder.titlePlaceholder")}
        />
      </Field>

      <Field
        label={t("listings.ladder.perks")}
        hint={t("listings.ladder.perksHint", { max: LIMITS.TIER_PERKS_MAX })}
        problems={at("perks")}
      >
        <div className="flex flex-col gap-2">
          {perks.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <Text
                  value={line}
                  onChange={(v) => onPatch({ perks: perks.map((p, j) => (j === i ? v : p)) })}
                  maxLength={LIMITS.TIER_PERK_MAX}
                  placeholder={i === 0 ? t("listings.ladder.perkPlaceholder") : t("listings.brandGets.line", { n: i + 1 })}
                />
              </span>
              <button
                type="button"
                className={`${iconBtn} !h-12 !w-12 !rounded-[24px]`}
                disabled={perks.length === 1}
                onClick={() => onPatch({ perks: perks.filter((_, j) => j !== i) })}
                aria-label={t("listings.ladder.removeLine")}
              >
                <Ion name="remove" size={18} />
              </button>
            </div>
          ))}
          <ChipRow label={t("listings.ladder.lines")}>
            <Chip icon="add" label={t("listings.brandGets.addLine")} disabled={perks.length >= LIMITS.TIER_PERKS_MAX} onClick={() => onPatch({ perks: [...perks, ""] })} />
          </ChipRow>
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t("listings.ladder.howSells")}</span>
        <ChipRow label={t("listings.ladder.howSells")}>
          <Chip label={t("listings.ladder.sameAsRest")} selected={rung.saleMode === null} onClick={() => onPatch({ saleMode: null })} />
          {MODE_OPTIONS.map((o) => (
            // The count is NOT set from here. A rung that ends up bid for does
            // sell one copy, but "how many of these am I selling" is a number
            // the creator typed, and quietly rewriting six to one on a change
            // of mode loses it. The rule is said beside the field instead, and
            // the step does not advance.
            <Chip key={o.value} label={t(o.label)} selected={rung.saleMode === o.value} onClick={() => onPatch({ saleMode: o.value })} />
          ))}
        </ChipRow>
        <p className="text-[12px] leading-4 text-white/55">
          {rung.saleMode === null
            ? t("listings.ladder.sellsLikeSpace", { how: t(boardModeText(draft)) })
            : t("listings.ladder.justThisTier")}
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {showsPrice ? (
          <Field
            label={bidding ? t("listings.ladder.openingBid") : t("listings.ladder.cost")}
            problems={at("price")}
            htmlFor={id("price")}
            hint={
              split
                ? draft.feePayer === "sponsor"
                  ? t("listings.sell.youReceive", { amount: usd(split.creatorGetsCents) })
                  : t("listings.sell.youReceiveAfterFee", { amount: usd(split.creatorGetsCents), fee: FEE })
                : undefined
            }
          >
            <Money id={id("price")} value={rung.priceDollars} onChange={(priceDollars) => onPatch({ priceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t("listings.ladder.cost")}</span>
            <p className="text-[12px] leading-4 text-white/55">{t("listings.ladder.noPriceShown")}</p>
          </div>
        )}

        <Field
          label={t("listings.ladder.howMany")}
          problems={at("available")}
          htmlFor={id("available")}
          hint={
            bidding
              ? t("listings.ladder.howManyBidding")
              : t("listings.ladder.howManyHint")
          }
        >
          <Count
            id={id("available")}
            value={rung.available}
            min={1}
            max={maxSlots}
            onChange={(available) => onPatch({ available })}
          />
        </Field>
      </div>

      {keepsFloor ? (
        <Field
          label={bidding ? t("listings.ladder.floorBidding") : t("listings.ladder.floor")}
          problems={at("floor")}
          htmlFor={id("floor")}
          hint={
            bidding
              ? t("listings.ladder.floorHintMin", { amount: usd(isSession ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS) })
              : t("listings.ladder.floorHint")
          }
        >
          <Money id={id("floor")} value={rung.minOfferDollars} onChange={(minOfferDollars) => onPatch({ minOfferDollars })} />
        </Field>
      ) : null}

      <Field
        label={t("listings.ladder.pitch")}
        hint={t("listings.ladder.pitchHint")}
        problems={at("pitch")}
        htmlFor={id("pitch")}
      >
        <Paragraph
          id={id("pitch")}
          value={rung.pitch}
          onChange={(pitch) => onPatch({ pitch })}
          maxLength={LIMITS.PITCH_MAX}
          rows={2}
        />
      </Field>
    </Card>
  );
}
