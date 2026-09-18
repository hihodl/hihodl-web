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

import { btnSmallSecondary, card } from "@/components/ad-space/ui";
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

import { Count, Dropdown, Field, Money, Paragraph, Problems, Text } from "./parts";

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
  { value: "fixed", label: "At a fixed price — first to pay gets it" },
  { value: "fixed_with_offers", label: "At a price, and I will also read offers under it" },
  { value: "offers", label: "By offers only, with no price shown" },
  { value: "bids", label: "To the highest bid, on a countdown" },
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
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnSmallSecondary}
          disabled={rungs.length >= LIMITS.MAX_TIERS}
          onClick={() => set([...rungs, newRung(rungs)])}
        >
          Add another
        </button>
        <span className="text-tiny text-text-muted">
          {rungs.length} of {LIMITS.MAX_TIERS} · {copies} {copies === 1 ? "thing" : "things"} for sale, out of {maxSlots}
        </span>
      </div>
      {rungs.length > 1 ? (
        <p className="text-tiny text-text-muted">
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
  const bidding = mode === "bids";
  // A rung that CHOOSES bidding sells one thing. A rung that simply follows a
  // bidding listing is one of that listing's spots, each its own bidding, and
  // the rule does not reach it — which is exactly where the backend draws it.
  const ownBids = rung.saleMode === "bids";
  const at = (part: string) => problemsAt(problems, `rung:${rung.key}:${part}`);
  const id = (part: string) => `rung-${rung.key}-${part}`;

  const priceCents = centsFromDollars(rung.priceDollars);
  const split = showsPrice && priceCents !== null ? feeSplit(priceCents, draft.feePayer) : null;

  const perks = rung.perks.length ? rung.perks : [""];

  return (
    <div className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-tiny uppercase tracking-wider text-text-faint">
          {index + 1} of {total}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmallSecondary} disabled={index === 0} onClick={() => onMove(-1)}>
            Move up
          </button>
          <button type="button" className={btnSmallSecondary} disabled={index === total - 1} onClick={() => onMove(1)}>
            Move down
          </button>
          <button type="button" className={btnSmallSecondary} disabled={total === 1} onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      <Field
        label="What it is called"
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
        label="What the brand gets"
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
                  placeholder={i === 0 ? "A 6 to 10 minute interview, shot and edited by me" : "One more line"}
                />
              </span>
              <button
                type="button"
                className={`${btnSmallSecondary} shrink-0`}
                disabled={perks.length === 1}
                onClick={() => onPatch({ perks: perks.filter((_, j) => j !== i) })}
                aria-label="Remove this line"
              >
                −
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className={btnSmallSecondary}
              disabled={perks.length >= LIMITS.TIER_PERKS_MAX}
              onClick={() => onPatch({ perks: [...perks, ""] })}
            >
              Add a line
            </button>
          </div>
        </div>
      </Field>

      <Field
        label="How this one sells"
        hint="Each rung answers for itself. The $50 logo can go to whoever pays first while the one interview goes to the highest bid, on the same listing."
        htmlFor={id("mode")}
      >
        <Dropdown
          id={id("mode")}
          value={rung.saleMode ?? "inherit"}
          onChange={(value) => {
            const next = value === "inherit" ? null : (value as SaleMode);
            // Choosing bidding for this rung sets the count to one rather than
            // letting the creator build something the API refuses at the very
            // end. Following the listing's own bidding does not: those are the
            // listing's spots and each is its own bidding.
            onPatch({ saleMode: next, ...(next === "bids" ? { available: 1 } : {}) });
          }}
          options={[
            { value: "inherit", label: `The same as the whole listing — ${boardModeText(draft)}` },
            ...MODE_OPTIONS.map((o) => ({ value: o.value as string, label: o.label })),
          ]}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        {showsPrice ? (
          <Field
            label={bidding ? "Where bidding opens" : "Price"}
            problems={at("price")}
            htmlFor={id("price")}
            hint={
              split
                ? draft.feePayer === "sponsor"
                  ? `The sponsor pays ${usd(split.sponsorPaysCents)} and you receive ${usd(split.creatorGetsCents)}.`
                  : `The sponsor pays ${usd(split.sponsorPaysCents)} and you receive ${usd(split.creatorGetsCents)} after our 5%.`
                : undefined
            }
          >
            <Money id={id("price")} value={rung.priceDollars} onChange={(priceDollars) => onPatch({ priceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-small text-text">Price</span>
            <p className="text-tiny text-text-muted">
              Nothing to set. This one is sold by offers, so the page shows no price at all and a brand names its own
              number.
            </p>
          </div>
        )}

        <Field
          label="How many of these"
          problems={at("available")}
          htmlFor={id("available")}
          hint={
            ownBids
              ? "One. You have sent this rung out to the highest bid, and bidding is one thing going to one winner — five identical copies under a single countdown is an auction house's problem, not yours. Sell it another way if you have more than one."
              : bidding
                ? "Each one is its own bidding, with its own winner."
                : "Each one is sold separately, to a different brand."
          }
        >
          <Count
            id={id("available")}
            value={rung.available}
            min={1}
            max={maxSlots}
            disabled={ownBids}
            onChange={(available) => onPatch({ available })}
          />
        </Field>
      </div>

      {keepsFloor ? (
        <Field
          label={bidding ? "Your reserve" : "The least you would take"}
          problems={at("floor")}
          htmlFor={id("floor")}
          hint={
            bidding
              ? `Private. Bidding that ends under this wins nothing, and no brand is ever shown the number — they only see whether it has been met. Leave it empty for no reserve. At least ${usd(isSession ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS)}.`
              : `Private. Anything under it is turned away before it reaches you, and no brand is ever shown the number. Leave it empty to read every offer yourself.`
          }
        >
          <Money id={id("floor")} value={rung.minOfferDollars} onChange={(minOfferDollars) => onPatch({ minOfferDollars })} />
        </Field>
      ) : null}

      <Field
        label="Anything else about it"
        hint="Optional. One or two sentences, shown under the lines above."
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
    </div>
  );
}
