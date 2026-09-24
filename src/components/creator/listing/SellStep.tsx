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
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
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

const CONTENT_LABEL: Record<ContentKind, MessageKey> = {
  logo: "listings.sell.content.logo",
  qr: "listings.sell.content.qr",
  text: "listings.sell.content.text",
  photo: "listings.sell.content.photo",
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
  const t = useT();
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  // Content production sells N identical spots at a price; brands may offer under it.
  const production = isProductionTemplate(template);
  const onlyAtAPrice = t("listings.problems.productionSellsAtPrice");
  const maxSlots = template.service?.maxSlots ?? 0;
  const needsCountdown = draft.pricingMode === "bids" || anyRungBids(draft);

  const pricingOptions: { value: PricingMode | "fixed_with_offers"; label: string; body: string; disabled?: boolean; why?: string }[] = [
    {
      value: "fixed",
      label: t("listings.ladder.mode.fixed"),
      body: session ? t("listings.sell.pricing.fixedSession") : t("listings.sell.pricing.fixed"),
    },
    {
      value: "fixed_with_offers",
      label: t("listings.sell.pricing.fixedWithOffers"),
      body: t("listings.sell.pricing.fixedWithOffersBody"),
    },
    {
      value: "offers",
      label: t("listings.ladder.mode.offers"),
      body: t("listings.sell.pricing.offersBody"),
      disabled: production,
      why: onlyAtAPrice,
    },
    {
      value: "bids",
      label: t("listings.ladder.mode.bids"),
      body: t("listings.sell.pricing.bidsBody"),
      disabled: production || (service && draft.sells !== "ladder"),
      why: production
        ? onlyAtAPrice
        : t("listings.sell.pricing.bidsWhy"),
    },
    {
      value: "takeover",
      label: t("listings.sell.pricing.takeover"),
      body: t("listings.sell.pricing.takeoverBody"),
      disabled: session || production,
      why: production ? onlyAtAPrice : t("listings.problems.takeoverNotForSessions"),
    },
  ];

  const current: string = draft.pricingMode === "fixed" && draft.acceptsOffers ? "fixed_with_offers" : draft.pricingMode;

  // Bidding has to stop before the listing closes, so the calendar stops there too.
  const closesDay = draft.closesAt.slice(0, 10);
  const biddingMax = closesDay ? dayPlus(closesDay, -2) : dayPlus(today(), LIMITS.MAX_CAMPAIGN_DAYS);

  return (
    <StepCard title={t("listings.wizard.stage.sell")} help={t("listings.sell.help")}>
      <Block title={t("listings.sell.how")}>
        <Field label={t("listings.sell.default")} problems={problemsAt(problems, "pricing")}>
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
            label={t("listings.sell.biddingEnds")}
            value={draft.biddingEndsAt}
            onChange={(biddingEndsAt) => set({ biddingEndsAt })}
            min={dayPlus(today(), 1)}
            max={biddingMax}
            problems={problemsAt(problems, "biddingEndsAt")}
            hint={t("listings.sell.biddingEndsHint", { hours: LIMITS.BIDDING_MIN_BEFORE_CLOSE_HOURS })}
          />
        ) : null}
      </Block>

      <Block
        title={
          production
            ? t("listings.wizard.stage.spots")
            : service
              ? draft.sells === "ladder"
                ? t("listings.ladder.label")
                : t("listings.sell.slots")
              : t("listings.wizard.stage.spots")
        }
      >
        {service ? (
          <>
            <Field label={t("listings.sell.whatItIs")}>
              <Choice
                name="sells"
                value={draft.sells === "ladder" ? "ladder" : "slots"}
                onChange={(value) => set({ sells: value as "ladder" | "slots" })}
                options={[
                  {
                    value: "ladder",
                    label: t("listings.sell.ladderOption"),
                    body: t("listings.sell.ladderOptionBody"),
                    disabled: production,
                    why: t("listings.sell.ladderOptionWhy"),
                  },
                  {
                    value: "slots",
                    label: t("listings.sell.slotsOption"),
                    body: t("listings.sell.slotsOptionBody"),
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

      <Block title={t("listings.sell.fee")} why={t("listings.sell.feeWhy", { fee: FEE })}>
        <Choice
          name="feePayer"
          value={draft.feePayer}
          onChange={(feePayer) => set({ feePayer: feePayer as "sponsor" | "creator" })}
          options={[
            {
              value: "sponsor",
              label: session ? t("listings.sell.feeOnTopClient") : t("listings.sell.feeOnTopBrand"),
              body: session ? t("listings.sell.feeOnTopClientBody", { fee: FEE }) : t("listings.sell.feeOnTopBrandBody", { fee: FEE }),
            },
            {
              value: "creator",
              label: t("listings.sell.feeOutOf"),
              body: session ? t("listings.sell.feeOutOfClientBody", { fee: FEE }) : t("listings.sell.feeOutOfBrandBody", { fee: FEE }),
            },
          ]}
        />
      </Block>

      <Block title={t("listings.sell.paidOn")} why={t("listings.sell.paidOnWhy")}>
        <Field label={t("listings.sell.networks")} problems={problemsAt(problems, "chains")}>
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
  const t = useT();
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const mode = saleModeOf(draft, null);
  const cents = centsFromDollars(draft.slotPriceDollars);
  const split = cents !== null ? feeSplit(cents, draft.feePayer) : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label={t("listings.promise.howMany")}
          hint={t("listings.sell.slotsHint", { max: maxSlots })}
          problems={problemsAt(problems, "slots")}
          htmlFor="slots"
        >
          <Count id="slots" value={draft.slots} min={1} max={maxSlots} onChange={(slots) => set({ slots })} />
        </Field>

        {modeShowsPrice(mode) ? (
          <Field
            label={mode === "bids" ? t("listings.sell.openingBidUsd") : t("listings.sell.priceEachUsd")}
            problems={problemsAt(problems, "slotPrice")}
            htmlFor="slot-price"
            hint={split ? t("listings.sell.youReceive", { amount: usd(split.creatorGetsCents) }) : undefined}
          >
            <Money id="slot-price" value={draft.slotPriceDollars} onChange={(slotPriceDollars) => set({ slotPriceDollars })} />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t("listings.sell.price")}</span>
            <p className="text-[12px] leading-4 text-white/55">{t("listings.ladder.noPriceShown")}</p>
          </div>
        )}
      </div>

      {modeKeepsFloor(mode) ? (
        <Field
          label={mode === "bids" ? t("listings.sell.reserveUsd") : t("listings.sell.hiddenMinUsd")}
          problems={problemsAt(problems, "slotFloor")}
          htmlFor="slot-floor"
          hint={t(mode === "bids" ? "listings.sell.reserveHintMin" : "listings.sell.hiddenMinHintMin", {
            amount: usd(session ? LIMITS.SESSION_MIN_CENTS : LIMITS.OFFER_MIN_CENTS),
          })}
        >
          <Money id="slot-floor" value={draft.slotMinOfferDollars} onChange={(slotMinOfferDollars) => set({ slotMinOfferDollars })} />
        </Field>
      ) : null}

      <Field
        label={t("listings.wizard.stage.promise")}
        hint={t("listings.sell.slotPitchHint")}
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
  const t = useT();
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
                  {t("listings.sell.whole")}
                </span>
                <span className="text-[12px] leading-4 text-white/55">
                  {partsCents
                    ? t("listings.sell.wholeBodyWithParts", { product: template.name.toLowerCase(), amount: usd(partsCents) })
                    : t("listings.sell.wholeBody", { product: template.name.toLowerCase() })}
                </span>
              </span>
            }
          />

          {whole.on ? (
            <div className="flex flex-col gap-3.5 pl-[34px]">
              {modeShowsPrice(mode) ? (
                <Field
                  label={mode === "bids" ? t("listings.sell.wholeOpeningBidUsd") : t("listings.sell.wholePriceUsd")}
                  problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:price`)}
                  htmlFor={`zone-${WHOLE_ZONE_KEY}-price`}
                  hint={
                    wholeSplit
                      ? t("listings.sell.wholeYouReceive", { amount: usd(wholeSplit.creatorGetsCents) })
                      : t("listings.sell.wholeHint")
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
                  label={mode === "bids" ? t("listings.sell.reserveUsd") : t("listings.sell.hiddenMinUsd")}
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
                label={t("listings.sell.canSend")}
                problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:accepts`)}
              >
                <Toggles
                  values={whole.accepts}
                  onChange={(accepts) => set(WHOLE_ZONE_KEY, { accepts: accepts as ContentKind[] })}
                  options={CONTENT_KINDS.map((k) => ({ value: k, label: t(CONTENT_LABEL[k]) }))}
                />
              </Field>

              <Field
                label={t("listings.ladder.pitch")}
                problems={problemsAt(problems, `zone:${WHOLE_ZONE_KEY}:pitch`)}
                htmlFor={`zone-${WHOLE_ZONE_KEY}-pitch`}
              >
                <Paragraph
                  id={`zone-${WHOLE_ZONE_KEY}-pitch`}
                  value={whole.pitch}
                  onChange={(pitch) => set(WHOLE_ZONE_KEY, { pitch })}
                  maxLength={LIMITS.PITCH_MAX}
                  placeholder={t("listings.sell.wholePitchPlaceholder")}
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
                    {t("listings.sell.spotLine", { n: String(index + 1).padStart(2, "0"), label: zone.label })}
                  </span>
                  <span className="text-[12px] leading-4 text-white/55">
                    {zone.suggestedPriceCents
                      ? t("listings.sell.sizeSuggested", { size: zone.sizeLabel, amount: usd(zone.suggestedPriceCents) })
                      : zone.sizeLabel}
                  </span>
                </span>
              }
            />

            {own.on ? (
              <div className="flex flex-col gap-3.5 pl-[34px]">
                {modeShowsPrice(mode) ? (
                  <Field
                    label={mode === "bids" ? t("listings.sell.openingBidUsd") : t("listings.sell.priceUsd")}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:price`)}
                    htmlFor={`zone-${zone.zoneKey}-price`}
                    hint={split ? t("listings.sell.youReceive", { amount: usd(split.creatorGetsCents) }) : undefined}
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
                    label={mode === "bids" ? t("listings.sell.reserveUsd") : t("listings.sell.hiddenMinUsd")}
                    problems={problemsAt(problems, `zone:${zone.zoneKey}:floor`)}
                    htmlFor={`zone-${zone.zoneKey}-floor`}
                    hint={mode === "bids" ? t("listings.sell.reserveHint") : t("listings.sell.hiddenMinHint")}
                  >
                    <Money
                      id={`zone-${zone.zoneKey}-floor`}
                      value={own.minOfferDollars}
                      onChange={(minOfferDollars) => set(zone.zoneKey, { minOfferDollars })}
                    />
                  </Field>
                ) : null}

                <Field
                  label={t("listings.sell.canSend")}
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:accepts`)}
                >
                  <Toggles
                    values={own.accepts}
                    onChange={(accepts) => set(zone.zoneKey, { accepts: accepts as ContentKind[] })}
                    options={CONTENT_KINDS.map((k) => ({ value: k, label: t(CONTENT_LABEL[k]) }))}
                  />
                </Field>

                <Field
                  label={t("listings.ladder.pitch")}
                  problems={problemsAt(problems, `zone:${zone.zoneKey}:pitch`)}
                  htmlFor={`zone-${zone.zoneKey}-pitch`}
                >
                  <Paragraph
                    id={`zone-${zone.zoneKey}-pitch`}
                    value={own.pitch}
                    onChange={(pitch) => set(zone.zoneKey, { pitch })}
                    maxLength={LIMITS.PITCH_MAX}
                    placeholder={t("listings.sell.zonePitchPlaceholder")}
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
