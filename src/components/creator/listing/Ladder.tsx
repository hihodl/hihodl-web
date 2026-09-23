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
function boardModeText(draft: ListingDraft): string {
  switch (draft.pricingMode) {
    case "offers":
      return "by offers, with no price shown";
    case "bids":
      return "to the highest bid";
    case "takeover":
      return "at a price anybody can take by paying double";
    default:
      return draft.acceptsOffers ? "at a price, or by offers under it" : "at a fixed price";
  }
}

const MODE_OPTIONS: readonly { value: SaleMode; label: string }[] = [
  { value: "fixed", label: "Buy now" },
  { value: "fixed_with_offers", label: "Buy now, and offers" },
  { value: "offers", label: "Make an offer" },
  { value: "bids", label: "Bid" },
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
        <ChipRow label="The ladder">
          <Chip
            icon="add"
            label="Add a tier"
            disabled={rungs.length >= LIMITS.MAX_TIERS}
            onClick={() => set([...rungs, newRung(rungs)])}
          />
        </ChipRow>
        <span className="text-[11.5px] font-bold uppercase tracking-[0.4px] text-white/55">
          {copies} of {maxSlots} slots on the ladder
        </span>
      </div>
      {rungs.length > 1 ? (
        <p className="text-[12px] leading-4 text-white/55">
          A new one starts with the lines of the one below it, because a ladder is usually cumulative — everything in
          the $50, plus the mic flag. Edit or delete any of them: a rung that deliberately does not include the one
          under it is allowed to say so.
        </p>
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
          Tier {index + 1} <span className="ml-1 normal-case tracking-normal">of {total}</span>
        </SectionLabel>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Move up" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)}>
            <Ion name="chevron-up" size={18} />
          </button>
          <button type="button" aria-label="Move down" className={iconBtn} disabled={index === total - 1} onClick={() => onMove(1)}>
            <Ion name="chevron-down" size={18} />
          </button>
          <button type="button" aria-label="Take this tier off the ladder" className={iconBtn} disabled={total === 1} onClick={onRemove}>
            <Ion name="trash-outline" size={17} />
          </button>
        </div>
      </div>

      <Field
        label="What this tier is called"
        hint="The line a brand reads before the price. “Flagship on-site interview”, not “Tier 3”."
        problems={at("title")}
        htmlFor={id("title")}
      >
        <Text
          id={id("title")}
          value={rung.title}
          onChange={(title) => onPatch({ title })}
          maxLength={LIMITS.TIER_TITLE_MAX}
          placeholder="Flagship on-site interview"
        />
      </Field>

      <Field
        label="What the brand gets for it"
        hint={`One plain line at a time, up to ${LIMITS.TIER_PERKS_MAX}. This is what somebody is paying for, so it is the part worth writing twice.`}
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
                  placeholder={i === 0 ? "Your logo in the mini strip of every clip" : `Line ${i + 1}`}
                />
              </span>
              <button
                type="button"
                className={`${iconBtn} !h-12 !w-12 !rounded-[24px]`}
                disabled={perks.length === 1}
                onClick={() => onPatch({ perks: perks.filter((_, j) => j !== i) })}
                aria-label="Remove this line"
              >
                <Ion name="remove" size={18} />
              </button>
            </div>
          ))}
          <ChipRow label="Lines">
            <Chip icon="add" label="Add a line" disabled={perks.length >= LIMITS.TIER_PERKS_MAX} onClick={() => onPatch({ perks: [...perks, ""] })} />
          </ChipRow>
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>How this one sells</span>
        <ChipRow label="How this one sells">
          <Chip label="Same as the rest" selected={rung.saleMode === null} onClick={() => onPatch({ saleMode: null })} />
          {MODE_OPTIONS.map((o) => (
            // The count is NOT set from here. A rung that ends up bid for does
            // sell one copy, but "how many of these am I selling" is a number
            // the creator typed, and quietly rewriting six to one on a change
            // of mode loses it. The rule is said beside the field instead, and
            // the step does not advance.
            <Chip key={o.value} label={o.label} selected={rung.saleMode === o.value} onClick={() => onPatch({ saleMode: o.value })} />
          ))}
        </ChipRow>
        <p className="text-[12px] leading-4 text-white/55">
          {rung.saleMode === null
            ? `It sells the way the space does: ${boardModeText(draft)}.`
            : "Just this tier. The rest of the ladder sells the way the space does."}
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {showsPrice ? (
          <Field
            label={bidding ? "Where bidding opens" : "What this tier costs"}
            problems={at("price")}
            htmlFor={id("price")}
            hint={
              split
                ? draft.feePayer === "sponsor"
                  ? `You receive ${usd(split.creatorGetsCents)}.`
                  : `You receive ${usd(split.creatorGetsCents)} after our ${FEE}.`
                : undefined
            }
          >
            <Money id={id("price")} value={rung.priceDollars} onChange={(priceDollars) => onPatch({ priceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>What this tier costs</span>
            <p className="text-[12px] leading-4 text-white/55">No price is shown: brands name theirs.</p>
          </div>
        )}

        <Field
          label="How many of this one"
          problems={at("available")}
          htmlFor={id("available")}
          hint={
            bidding
              ? "One. This one goes to the highest bid, and bidding is one thing going to one winner: five identical copies under a single countdown are five auctions of the same thing, so the brands spread across them and every one ends under what a single one would have fetched. Set it to 1, or sell this rung another way."
              : "Each one is sold separately, to a different brand."
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
          label={bidding ? "The least you'd let it go for" : "The least you'll listen to"}
          problems={at("floor")}
          htmlFor={id("floor")}
          hint={
            bidding
              ? `Nobody sees it. Leave it empty for no floor at all. At least ${usd(isSession ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS)}.`
              : "Nobody sees it. Leave it empty for no floor at all."
          }
        >
          <Money id={id("floor")} value={rung.minOfferDollars} onChange={(minOfferDollars) => onPatch({ minOfferDollars })} />
        </Field>
      ) : null}

      <Field
        label="Pitch (optional)"
        hint="One or two sentences, shown under the lines above."
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
