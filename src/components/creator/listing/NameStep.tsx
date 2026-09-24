/**
 * What to call it.
 *
 * One card, four boxes, three of them optional. The name is the headline on
 * the page and in every link anybody shares, and it is the only thing on this
 * card a listing cannot go live without.
 */

"use client";

import { useT } from "@/lib/app/i18n/react";
import { LIMITS, type ListingDraft } from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { InspiredByField } from "./InspiredByField";
import { Field, Money, Paragraph, Text } from "./parts";
import { StepCard } from "./StepPager";

export function NameStep({
  draft,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const t = useT();
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });

  return (
    <StepCard title={t("listings.wizard.stage.name")} help={t("listings.name.help")}>
      <Field label={t("listings.name.name")} problems={problemsAt(problems, "title")} htmlFor="listing-title">
        <Text
          id="listing-title"
          value={draft.title}
          onChange={(title) => set({ title })}
          maxLength={LIMITS.TITLE_MAX}
          placeholder={t("listings.name.namePlaceholder")}
        />
      </Field>
      <Field
        label={t("listings.name.reason")}
        hint={t("listings.name.reasonHint")}
        problems={problemsAt(problems, "reason")}
        htmlFor="listing-reason"
      >
        <Paragraph id="listing-reason" value={draft.reason} onChange={(reason) => set({ reason })} maxLength={LIMITS.REASON_MAX} />
      </Field>
      <Field
        label={t("listings.name.goal")}
        hint={t("listings.name.goalHint")}
        problems={problemsAt(problems, "goal")}
        htmlFor="listing-goal"
      >
        <Money id="listing-goal" value={draft.fundingGoalDollars} onChange={(fundingGoalDollars) => set({ fundingGoalDollars })} />
      </Field>
      <InspiredByField value={draft.inspiredBy} onChange={(inspiredBy) => set({ inspiredBy })} problems={problemsAt(problems, "inspiredBy")} />
    </StepCard>
  );
}
