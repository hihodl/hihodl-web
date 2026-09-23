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
 *
 * WHY THIS ONE CARD IS ALLOWED TO SCROLL
 *
 * Every other step in the editor fits. This one holds a ladder the creator
 * builds rung by rung, and it cannot be split from the pricing question above
 * it: the rule that a rung sold to the highest bid sells exactly one thing is
 * fixed by changing either of them, and sending somebody to a card they cannot
 * reach to fix the card they are on is worse than a scrollbar. So it degrades
 * the way the app's own `WizardPage` degrades — it scrolls, and only when the
 * content is taller than the card.
 */

"use client";

import { CHAIN_LABEL } from "@/lib/ad-space/format";
import type { Chain } from "@/lib/ad-space/types";
import {
  CONTENT_KINDS,
  LIMITS,
  WHOLE_ZONE_KEY,
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
  squareZonesOf,
  wholeZoneOf,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { MoreChainsLine } from "@/components/app/MoreChains";

import { Ladder } from "./Ladder";
import { Card, Checkbox, fieldLabel } from "@/components/app/spaces/kit";

import { Block, Choice, Count, Field, Money, Paragraph, Problems, Toggles } from "./parts";
import { StepCard } from "./StepPager";
import { DayTimeField, dayPlus, today } from "./WhenField";
import { feePctText } from "@/lib/ad-space/fee";

const FEE = feePctText();

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
      label: "Buy now",
      body: session ? "You set the price. The first client to pay books it." : "You set the price. The first brand to pay gets it.",
    },
    {
      value: "fixed_with_offers",
      label: "Buy now, and also accept offers",
      body: "Brands can offer less than the price. You accept, counter or decline.",
    },
    {
      value: "offers",
      label: "Make an offer",
      body: "No price shown. Brands name theirs, and you accept, counter or decline.",
      disabled: production,
      why: onlyAtAPrice,
    },
    {
      value: "bids",
      label: "Bid",
      body: "An opening bid and a countdown. When bidding ends, you accept a bid within 24 hours, or the highest one at or above your reserve is accepted for you.",
      disabled: production || (service && draft.sells !== "ladder"),
      why: production
        ? onlyAtAPrice
        : "Identical slots cannot all go to one highest bid. Build a ladder and send one rung out to bids instead.",
    },
    {
      value: "takeover",
      label: "A brand can take a sold spot by doubling",
      body: "Every price becomes an opening one. The brand that is displaced gets back everything it paid, inside the same payment. Solana only.",
      disabled: session || production,
      why: production ? onlyAtAPrice : "A booking a stranger can take off you by paying double is not a booking.",
    },
  ];

  const current: string = draft.pricingMode === "fixed" && draft.acceptsOffers ? "fixed_with_offers" : draft.pricingMode;

  // Bidding has to stop before the listing closes, so the calendar stops there too.
  const closesDay = draft.closesAt.slice(0, 10);
  const biddingMax = closesDay ? dayPlus(closesDay, -2) : dayPlus(today(), LIMITS.MAX_CAMPAIGN_DAYS);

  return (
    <StepCard title="What you sell" help="On a ladder each rung can answer differently, so nothing here locks anything down.">
      <Block title="How do you want to sell?">
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
          <DayTimeField
            label="Bidding ends"
            value={draft.biddingEndsAt}
            onChange={(biddingEndsAt) => set({ biddingEndsAt })}
            min={dayPlus(today(), 1)}
            max={biddingMax}
            problems={problemsAt(problems, "biddingEndsAt")}
            hint={`At least ${LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS} hours before it closes: the room the winner needs to pay.`}
          />
        ) : null}
      </Block>

      <Block title={production ? "The spots" : service ? (draft.sells === "ladder" ? "The ladder" : "The slots") : "The spots"}>
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

      <Block title="What we charge" why={`${FEE} of what a space sells for, and nothing if nothing sells.`}>
        <Choice
          name="feePayer"
          value={draft.feePayer}
          onChange={(feePayer) => set({ feePayer: feePayer as "sponsor" | "creator" })}
          options={[
            {
              value: "sponsor",
              label: session ? "On top, paid by the client" : "On top, paid by the brand",
              body: session
                ? `You receive exactly the price you set. The client pays it plus ${FEE}.`
                : `You receive exactly the price you set. The brand pays it plus ${FEE}.`,
            },
            {
              value: "creator",
              label: "Out of the price, paid by me",
              body: session ? `The client pays the price you set. You receive it minus ${FEE}.` : `The brand pays the price you set. You receive it minus ${FEE}.`,
            },
          ]}
        />
      </Block>

      <Block title="Get paid on" why="USDC, straight to your own address.">
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
    </StepCard>
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
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
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
            label={mode === "bids" ? "Opening bid (USD)" : "Price for each (USD)"}
            problems={problemsAt(problems, "slotPrice")}
            htmlFor="slot-price"
            hint={split ? `You receive ${usd(split.creatorGetsCents)}.` : undefined}
          >
            <Money id="slot-price" value={draft.slotPriceDollars} onChange={(slotPriceDollars) => set({ slotPriceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Price</span>
            <p className="text-[12px] leading-4 text-white/55">No price is shown: brands name theirs.</p>
          </div>
        )}
      </div>

      {modeKeepsFloor(mode) ? (
        <Field
          label={mode === "bids" ? "Reserve (optional, USD)" : "Hidden minimum (optional, USD)"}
          problems={problemsAt(problems, "slotFloor")}
          htmlFor="slot-floor"
          hint={`${mode === "bids" ? "Reserve: below it nothing sells automatically." : "Offers under it get an automatic counter at this price."} Nobody sees it. At least ${usd(session ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS)}.`}
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
  const wholeCents = centsFromDollars(wholeZoneOf(draft)?.priceDollars ?? "");
  const wholeSplit = wholeCents !== null ? feeSplit(wholeCents, draft.feePayer) : null;

  const whole = wholeZoneOf(draft);
  const squaresOn = squareZonesOf(draft).filter((z) => z.on);
  const partsCents = squaresOn.reduce((sum, z) => sum + (centsFromDollars(z.priceDollars) ?? 0), 0);

  return (
    <div className="flex flex-col gap-2.5">
      <Problems list={problemsAt(problems, "zones")} />

      {whole && (
        <Card className={whole.on ? "" : "opacity-90"}>
          <Checkbox
            checked={whole.on}
            onChange={(on) => set(WHOLE_ZONE_KEY, { on })}
            label={
              <span className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-extrabold tracking-[-0.2px] text-white">
                  One brand takes everything
                </span>
                <span className="text-[12px] leading-4 text-white/55">
                  Sell the whole {template.name.toLowerCase()} to one brand, with nobody else on it
                  {partsCents ? ` · at least ${usd(partsCents)}, the spots together` : ""}
                </span>
              </span>
            }
          />

          {whole.on ? (
            <div className="flex flex-col gap-3.5 pl-[34px]">
              {modeShowsPrice(mode) ? (
                <Field
                  label={mode === "bids" ? "Opening bid for all of it (USD)" : "Price for all of it (USD)"}
                  problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:price`)}
                  htmlFor={`zone-${WHOLE_ZONE_KEY}-price`}
                  hint={
                    wholeSplit
                      ? `You receive ${usd(wholeSplit.creatorGetsCents)}. While it is being paid for, no spot sells.`
                      : "While it is being paid for, no spot sells."
                  }
                >
                  <Money
                    id={`zone-${WHOLE_ZONE_KEY}-price`}
                    value={whole.priceDollars}
                    onChange={(priceDollars) => set(WHOLE_ZONE_KEY, { priceDollars })}
                  />
                </Field>
              ) : null}

              {modeKeepsFloor(mode) ? (
                <Field
                  label={mode === "bids" ? "Reserve (optional, USD)" : "Hidden minimum (optional, USD)"}
                  problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:floor`)}
                  htmlFor={`zone-${WHOLE_ZONE_KEY}-floor`}
                >
                  <Money
                    id={`zone-${WHOLE_ZONE_KEY}-floor`}
                    value={whole.minOfferDollars}
                    onChange={(minOfferDollars) => set(WHOLE_ZONE_KEY, { minOfferDollars })}
                  />
                </Field>
              ) : null}

              <Field
                label="What a brand can send"
                problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:accepts`)}
              >
                <Toggles
                  values={whole.accepts}
                  onChange={(accepts) => set(WHOLE_ZONE_KEY, { accepts: accepts as ContentKind[] })}
                  options={CONTENT_KINDS.map((k) => ({ value: k, label: CONTENT_LABEL[k] }))}
                />
              </Field>

              <Field
                label="Pitch (optional)"
                problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:pitch`)}
                htmlFor={`zone-${WHOLE_ZONE_KEY}-pitch`}
              >
                <Paragraph
                  id={`zone-${WHOLE_ZONE_KEY}-pitch`}
                  value={whole.pitch}
                  onChange={(pitch) => set(WHOLE_ZONE_KEY, { pitch })}
                  maxLength={LIMITS.PITCH_MAX}
                  placeholder="The whole piece is yours, and nobody else is on it"
                  rows={2}
                />
              </Field>
            </div>
          ) : null}
        </Card>
      )}

      {template.zones.map((zone, index) => {
        const own = draft.zones.find((z) => z.zoneKey === zone.zoneKey);
        if (!own) return null;
        const cents = centsFromDollars(own.priceDollars);
        const split = cents !== null ? feeSplit(cents, draft.feePayer) : null;
        return (
          <Card key={zone.zoneKey} className={own.on ? "" : "opacity-90"}>
            <Checkbox
              checked={own.on}
              onChange={(on) => set(zone.zoneKey, { on })}
              label={
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14.5px] font-extrabold tracking-[-0.2px] text-white">
                    Spot {String(index + 1).padStart(2, "0")} · {zone.label}
                  </span>
                  <span className="text-[12px] leading-4 text-white/55">
                    {zone.sizeLabel}
                    {zone.suggestedPriceCents ? ` · suggested ${usd(zone.suggestedPriceCents)}` : ""}
                  </span>
                </span>
              }
            />

            {own.on ? (
              <div className="flex flex-col gap-3.5 pl-[34px]">
                {modeShowsPrice(mode) ? (
                  <Field
                    label={mode === "bids" ? "Opening bid (USD)" : "Price (USD)"}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:price`)}
                    htmlFor={`zone-${zone.zoneKey}-price`}
                    hint={split ? `You receive ${usd(split.creatorGetsCents)}.` : undefined}
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
                    label={mode === "bids" ? "Reserve (optional, USD)" : "Hidden minimum (optional, USD)"}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:floor`)}
                    htmlFor={`zone-${zone.zoneKey}-floor`}
                    hint={mode === "bids" ? "Reserve: below it nothing sells automatically. Nobody sees it." : "Offers under it get an automatic counter at this price. Nobody sees it."}
                  >
                    <Money
                      id={`zone-${zone.zoneKey}-floor`}
                      value={own.minOfferDollars}
                      onChange={(minOfferDollars) => set(zone.zoneKey, { minOfferDollars })}
                    />
                  </Field>
                ) : null}

                <Field
                  label="What a brand can send"
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:accepts`)}
                >
                  <Toggles
                    values={own.accepts}
                    onChange={(accepts) => set(zone.zoneKey, { accepts: accepts as ContentKind[] })}
                    options={CONTENT_KINDS.map((k) => ({ value: k, label: CONTENT_LABEL[k] }))}
                  />
                </Field>

                <Field
                  label="Pitch (optional)"
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:pitch`)}
                  htmlFor={`zone-${zone.zoneKey}-pitch`}
                >
                  <Paragraph
                    id={`zone-${zone.zoneKey}-pitch`}
                    value={own.pitch}
                    onChange={(pitch) => set(zone.zoneKey, { pitch })}
                    maxLength={LIMITS.PITCH_MAX}
                    placeholder="Biggest spot, seen in every airport shot"
                    rows={2}
                  />
                </Field>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
