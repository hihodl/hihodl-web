/**
 * The declarations, and then it goes live.
 *
 * WHY THEY ARE TICK BOXES AND NOT SMALL PRINT
 *
 * Each is a sentence the creator is telling sponsors is true, and which of
 * them are asked for depends on the event: a conference asks about the venue's
 * rules on branded items, a race asks about logos on athletes' gear, somebody
 * else's private event asks whether the host agreed. They are the publish
 * gate, not a disclaimer, so they are shown as what they are.
 *
 * WHICH ONES ARE ASKED FOR
 *
 * Exactly the ones `requiredAttestations` names — the same function the
 * backend's `requiredAttestationsFor` is mirrored from — and it is fed
 * `draft.venueType`, which is now derived from the event answers rather than
 * asked. Nothing was taken out of that list: see `venueFor`.
 */

"use client";

import { btnGlass, Notice } from "@/components/app/hold";
import { Body, Card } from "@/components/app/spaces/kit";
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import {
  isProductionTemplate,
  isSessionTemplate,
  requiredAttestations,
  type Attestation,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { ListingPackage } from "../crew/ListingPackage";
import { Problems, Tick } from "./parts";
import { StepCard } from "./StepPager";

/** Each declaration in the first person, because that is who is saying it. */
const ATTESTATION_TEXT: Record<Attestation, MessageKey> = {
  owns_item: "listings.attest.ownsItem",
  venue_rules_checked: "listings.attest.venueRulesChecked",
  sports_rules_allow_logos: "listings.attest.sportsRulesAllowLogos",
  host_consent: "listings.attest.hostConsent",
  temporary_skin_safe_adult: "listings.attest.temporarySkinSafeAdult",
  discloses_sponsorship: "listings.attest.disclosesSponsorship",
  public_place: "listings.attest.publicPlace",
  no_investment_advice: "listings.attest.noInvestmentAdvice",
  no_investor_intros: "listings.attest.noInvestorIntros",
};

export function PublishStep({
  draft,
  template,
  onChange,
  problems,
  banner,
  fix,
  canPublish,
  spaceId,
}: {
  /** The saved draft: this card is only reached once the draft is on the server. */
  spaceId: string | null;
  draft: ListingDraft;
  template: Template;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
  banner: string | null;
  fix: { href: string; label: string } | null;
  canPublish: boolean;
}) {
  const t = useT();
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const required = requiredAttestations(
    template.requiredAttestations,
    draft.venueType,
    template.kind,
    isSessionTemplate(template),
    isProductionTemplate(template),
  );

  return (
    <StepCard title={t("listings.wizard.stage.publish")} help={t("listings.publish.help")}>
      <div className="flex flex-col gap-1.5">
        {required.map((a) => (
          <Tick
            key={a}
            checked={draft.attestations.includes(a)}
            onChange={(on) =>
              set({
                attestations: on ? [...draft.attestations.filter((x) => x !== a), a] : draft.attestations.filter((x) => x !== a),
              })
            }
            label={t(ATTESTATION_TEXT[a])}
          />
        ))}
        <Problems list={problemsAt(problems, "attestations")} />
      </div>

      <Card>
        <Body dim>{t("listings.publish.howPaid")}</Body>
        {fix ? (
          <a href={fix.href} className={btnGlass}>
            {fix.label}
          </a>
        ) : null}
      </Card>
      {/* The listing as a package with other creators, decided before it goes live. */}
      {spaceId ? (
        <ListingPackage spaceId={spaceId} title={draft.title} offersSolana={draft.chains.includes("solana")} />
      ) : null}

      <Problems list={problemsAt(problems, "form")} />
      {banner ? <Notice icon="alert-circle-outline">{banner}</Notice> : null}
      {!canPublish ? (
        <p className="text-[12px] leading-4 text-white/55">{t("listings.publish.savedEitherWay")}</p>
      ) : null}
    </StepCard>
  );
}
