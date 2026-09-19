/**
 * Build what you sell.
 *
 * THE ORDER IS DELIBERATE
 *
 * How the listing sells comes first, because it decides what the rest of the
 * form even shows: a listing sold by offers has no price boxes at all, and one
 * sold by bidding needs a countdown. Asking it last would mean re-drawing
 * everything the creator had already filled in.
 *
 * WHAT THE BOARD'S ANSWER IS, AND IS NOT
 *
 * It is the DEFAULT every rung starts from, not a rule over them. A creator
 * who never opens the question on a rung gets exactly this; one who does gets
 * their own answer on that rung and this one everywhere else. See Ladder.tsx.
 */

"use client";

import { CHAIN_LABEL } from "@/lib/ad-space/format";
import type { Chain } from "@/lib/ad-space/types";
import {
  CONTENT_KINDS,
  LIMITS,
  anyRungBids,
  centsFromDollars,
  feeSplit,
  modeKeepsFloor,
  modeShowsPrice,
  saleModeOf,
  usd,
  type ContentKind,
  type ListingDraft,
  type PricingMode,
  type Template,
  isProductionTemplate,
  isSessionTemplate,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { MoreChainsLine } from "@/components/app/MoreChains";

import { Ladder } from "./Ladder";
import { Block, Choice, Count, Field, Money, Paragraph, Problems, Text, Toggles } from "./parts";

const CONTENT_LABEL: Record<ContentKind, string> = {
  logo: "A logo",
  qr: "A QR code",
  text: "A line of text",
  photo: "A photo",
};

export function SellStep({
  draft,
  template,
  availableChains,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  availableChains: readonly Chain[];
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  // Content production sells N identical spots at a price; brands may offer under it.
  const production = isProductionTemplate(template);
  const onlyAtAPrice = "A production spot is sold at a price. You can still read offers under it.";
  const maxSlots = template.service?.maxSlots ?? 0;
  const needsCountdown = draft.pricingMode === "bids" || anyRungBids(draft);

  const pricingOptions: { value: PricingMode | "fixed_with_offers"; label: string; body: string; disabled?: boolean; why?: string }[] = [
    {
      value: "fixed",
      label: "At a fixed price",
      body: "Whoever pays first gets it. The simplest thing to buy, and the one most brands act on the same day.",
    },
    {
      value: "fixed_with_offers",
      label: "At a price, and I will read offers under it",
      body: "The price still buys it outright. A brand that wants to pay less can name a number, and you say yes, no, or here is mine.",
    },
    {
      value: "offers",
      label: "By offers only, with no price shown",
      body: "Nothing on the page says what it costs. Every brand names its own number and you answer each one.",
      disabled: production,
      why: onlyAtAPrice,
    },
    {
      value: "bids",
      label: "To the highest bid",
      body: "A price to open at and a moment bidding stops. Each spot is its own bidding, and the highest bid at the end is the one you decide on.",
      disabled: production || (service && draft.sells !== "ladder"),
      why: production
        ? onlyAtAPrice
        : "Identical slots cannot all go to one highest bid. Build a ladder and send one rung out to bids instead.",
    },
    {
      value: "takeover",
      label: "At a price anybody can take by paying double",
      body: "A sold spot never stops being for sale: the next brand pays double and the one it displaces is repaid in full inside the same payment. Solana only.",
      disabled: session || production,
      why: production ? onlyAtAPrice : "A booking a stranger can take off you by paying double is not a booking.",
    },
  ];

  const current: string = draft.pricingMode === "fixed" && draft.acceptsOffers ? "fixed_with_offers" : draft.pricingMode;

  return (
    <div className="flex flex-col gap-10">
      <Block
        title="How this listing sells"
        why="This is where every part of it starts. On a ladder each rung can answer differently — the $50 logo first come first served, the one interview to the highest bid — so nothing here locks anything down."
      >
        <Field label="The default for the whole listing" problems={problemsAt(problems, "pricing")}>
          <Choice
            name="pricing"
            value={current}
            onChange={(value) => {
              const change: Partial<ListingDraft> =
                value === "fixed_with_offers"
                  ? { pricingMode: "fixed", acceptsOffers: true }
                  : { pricingMode: value as PricingMode, acceptsOffers: false };
              // Turning the whole listing over to bidding does NOT rewrite the
              // rungs that follow it. It would mean one click silently cutting
              // six logo strips down to one, on several rungs at once, with no
              // way back to the number the creator typed. Each of those rungs
              // says so itself, beside its own count, and the step holds until
              // they are answered.
              set(change);
            }}
            options={pricingOptions.map((o) => ({ ...o, value: o.value as string }))}
          />
        </Field>

        {needsCountdown ? (
          <Field
            label="Bidding stops"
            problems={problemsAt(problems, "biddingEndsAt")}
            htmlFor="bidding-ends"
            hint={`At least ${LIMITS.BIDDING_MIN_AFTER_PUBLISH_HOURS} hours after it goes live, and at least ${LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS} hours before it closes. That gap is the room the winner needs: a day for you to decide, a day for them to pay, and a little slack for a bid that lands in the last ten minutes and pushes the clock back.`}
          >
            <Text
              id="bidding-ends"
              type="datetime-local"
              value={draft.biddingEndsAt}
              onChange={(biddingEndsAt) => set({ biddingEndsAt })}
            />
          </Field>
        ) : null}
      </Block>

      <Block
        title={production ? "The spots" : service ? (draft.sells === "ladder" ? "The ladder" : "The slots") : "The spots"}
        why={
          production
            ? "Each spot is one brand's package, at one price. Sell as many as you can film well at one event."
            : service
            ? "A ladder is several different things at several prices, on one listing — a $50 logo, a $200 placement, one $1,300 interview. Selling the same thing several times over is the other shape."
            : "Each spot on the product is sold separately, to a different brand."
        }
      >
        {service ? (
          <>
            <Field label="What this listing is">
              <Choice
                name="sells"
                value={draft.sells === "ladder" ? "ladder" : "slots"}
                onChange={(value) => set({ sells: value as "ladder" | "slots" })}
                options={[
                  {
                    value: "ladder",
                    label: "Several different things, at different prices",
                    body: "Each one names itself, lists what the brand gets, and can sell its own way.",
                    disabled: production,
                    why: "Every production spot is the package you set in the step before, so they share one price.",
                  },
                  {
                    value: "slots",
                    label: "The same thing, several times",
                    body: "One description, one price, and however many of them you are willing to do.",
                  },
                ]}
              />
            </Field>

            {draft.sells === "ladder" ? (
              <Ladder draft={draft} onChange={onChange} problems={problems} maxSlots={maxSlots} isSession={session} />
            ) : (
              <Slots draft={draft} onChange={onChange} problems={problems} maxSlots={maxSlots} session={session} />
            )}
          </>
        ) : (
          <Zones draft={draft} template={template} onChange={onChange} problems={problems} />
        )}
      </Block>

      <Block
        title="Who carries our 5%"
        why="HiSpace takes five percent of the listed price. The amount is the same either way; this only says whether it sits on top of your price or comes out of it."
      >
        <Choice
          name="feePayer"
          value={draft.feePayer}
          onChange={(feePayer) => set({ feePayer: feePayer as "sponsor" | "creator" })}
          options={[
            {
              value: "sponsor",
              label: "The sponsor pays it on top",
              body: "You receive exactly the price you set. A $1,300 spot costs the brand $1,365.",
            },
            {
              value: "creator",
              label: "I carry it",
              body: "The brand pays exactly the price on the page. A $1,300 spot reaches you as $1,235.",
            },
          ]}
        />
      </Block>

      <Block
        title="Where you can be paid"
        why="A sponsor pays in USDC on Solana, straight to your own address. Nothing is bridged and nothing waits in between."
      >
        <Field label="Networks" problems={problemsAt(problems, "chains")}>
          <Toggles
            values={draft.chains}
            onChange={(chains) => set({ chains: chains as Chain[] })}
            // The web sets up Solana only. A chain is still listed when this
            // draft already takes it (made in the app), so it can be dropped.
            options={availableChains
              .filter((c) => c === "solana" || draft.chains.includes(c))
              .map((c) => ({ value: c, label: CHAIN_LABEL[c] ?? c }))}
          />
        </Field>
        <MoreChainsLine />
      </Block>
    </div>
  );
}

/* ── The same thing, several times ────────────────────────────────── */

function Slots({
  draft,
  onChange,
  problems,
  maxSlots,
  session,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
  maxSlots: number;
  session: boolean;
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const mode = saleModeOf(draft, null);
  const cents = centsFromDollars(draft.slotPriceDollars);
  const split = cents !== null ? feeSplit(cents, draft.feePayer) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="How many"
          hint={`Up to ${maxSlots}. Each one goes to a different brand.`}
          problems={problemsAt(problems, "slots")}
          htmlFor="slots"
        >
          <Count id="slots" value={draft.slots} min={1} max={maxSlots} onChange={(slots) => set({ slots })} />
        </Field>

        {modeShowsPrice(mode) ? (
          <Field
            label={mode === "bids" ? "Where bidding opens" : "Price for each"}
            problems={problemsAt(problems, "slotPrice")}
            htmlFor="slot-price"
            hint={split ? `The sponsor pays ${usd(split.sponsorPaysCents)} and you receive ${usd(split.creatorGetsCents)}.` : undefined}
          >
            <Money id="slot-price" value={draft.slotPriceDollars} onChange={(slotPriceDollars) => set({ slotPriceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-small text-text">Price</span>
            <p className="text-tiny text-text-muted">
              Nothing to set: this listing is sold by offers, so the page shows no price and every brand names its own.
            </p>
          </div>
        )}
      </div>

      {modeKeepsFloor(mode) ? (
        <Field
          label={mode === "bids" ? "Your reserve" : "The least you would take"}
          problems={problemsAt(problems, "slotFloor")}
          htmlFor="slot-floor"
          hint={`Private. No brand is ever shown this number; anything under it is turned away before it reaches you. Leave it empty to read everything yourself. At least ${usd(session ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS)}.`}
        >
          <Money id="slot-floor" value={draft.slotMinOfferDollars} onChange={(slotMinOfferDollars) => set({ slotMinOfferDollars })} />
        </Field>
      ) : null}

      <Field
        label="What the brand gets"
        hint="Optional. Lead with who sees it and the content you make: that is what a brand pays for. A few sentences."
        htmlFor="slot-pitch"
      >
        <Paragraph id="slot-pitch" value={draft.slotPitch} onChange={(slotPitch) => set({ slotPitch })} maxLength={LIMITS.PITCH_MAX} />
      </Field>
    </div>
  );
}

/* ── Spots on a product ───────────────────────────────────────────── */

function Zones({
  draft,
  template,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const mode = saleModeOf(draft, null);
  const set = (zoneKey: string, change: Partial<ListingDraft["zones"][number]>) =>
    onChange({ ...draft, zones: draft.zones.map((z) => (z.zoneKey === zoneKey ? { ...z, ...change } : z)) });

  return (
    <div className="flex flex-col gap-5">
      <Problems list={problemsAt(problems, "zones")} />
      {template.zones.map((zone) => {
        const own = draft.zones.find((z) => z.zoneKey === zone.zoneKey);
        if (!own) return null;
        const cents = centsFromDollars(own.priceDollars);
        const split = cents !== null ? feeSplit(cents, draft.feePayer) : null;
        return (
          <div
            key={zone.zoneKey}
            className={`flex flex-col gap-4 rounded-card border p-5 transition-colors duration-180 ${
              own.on ? "border-amber/40 bg-amber/[0.04]" : "border-[color:var(--color-hairline)]"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 accent-amber"
                checked={own.on}
                onChange={(e) => set(zone.zoneKey, { on: e.target.checked })}
              />
              <span className="min-w-0">
                <span className="block text-body text-text">{zone.label}</span>
                <span className="mt-1 block text-tiny text-text-muted">{zone.sizeLabel}</span>
              </span>
            </label>

            {own.on ? (
              <div className="flex flex-col gap-4 pl-7">
                {modeShowsPrice(mode) ? (
                  <Field
                    label={mode === "bids" ? "Where bidding opens" : "Price"}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:price`)}
                    htmlFor={`zone-${zone.zoneKey}-price`}
                    hint={
                      split ? `The sponsor pays ${usd(split.sponsorPaysCents)} and you receive ${usd(split.creatorGetsCents)}.` : undefined
                    }
                  >
                    <Money
                      id={`zone-${zone.zoneKey}-price`}
                      value={own.priceDollars}
                      onChange={(priceDollars) => set(zone.zoneKey, { priceDollars })}
                    />
                  </Field>
                ) : null}

                {modeKeepsFloor(mode) ? (
                  <Field
                    label={mode === "bids" ? "Your reserve" : "The least you would take"}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:floor`)}
                    htmlFor={`zone-${zone.zoneKey}-floor`}
                    hint="Private. No brand is ever shown this number."
                  >
                    <Money
                      id={`zone-${zone.zoneKey}-floor`}
                      value={own.minOfferDollars}
                      onChange={(minOfferDollars) => set(zone.zoneKey, { minOfferDollars })}
                    />
                  </Field>
                ) : null}

                <Field
                  label="What a sponsor may put here"
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:accepts`)}
                >
                  <Toggles
                    values={own.accepts}
                    onChange={(accepts) => set(zone.zoneKey, { accepts: accepts as ContentKind[] })}
                    options={CONTENT_KINDS.map((k) => ({ value: k, label: CONTENT_LABEL[k] }))}
                  />
                </Field>

                <Field
                  label="Anything else about this spot"
                  hint="Optional."
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:pitch`)}
                  htmlFor={`zone-${zone.zoneKey}-pitch`}
                >
                  <Paragraph
                    id={`zone-${zone.zoneKey}-pitch`}
                    value={own.pitch}
                    onChange={(pitch) => set(zone.zoneKey, { pitch })}
                    maxLength={LIMITS.PITCH_MAX}
                    rows={2}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
