/**
 * When it stops taking sponsors, and the days worth showing.
 *
 * WHY THE CLOSING TIME IS ASKED THIS EARLY
 *
 * Almost everything else is measured against it: bidding has to stop fifty
 * hours before it, deliverables are due within ninety days of it, and the
 * campaign runs between a day and sixty from now. Asked late, every one of
 * those becomes a correction to a form the creator thought they had finished.
 *
 * The rules have not moved. What has moved is the picker: the date and the
 * time are ours now, not the browser's white sheet.
 */

"use client";

import { Ion } from "@/components/app/ion";
import { emptyBtn } from "@/components/app/spaces/kit";
import { LIMITS, type ListingDraft } from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { btnSmallGlass, Field, Problems, Text } from "./parts";
import { StepCard } from "./StepPager";
import { DayField, DayTimeField, dayPlus, today } from "./WhenField";

export function DatesStep({
  draft,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const from = today();
  // The earliest valid close is a day out, and the latest is sixty: the
  // calendar refuses what the rules would have refused underneath it.
  const closesMin = dayPlus(from, 1);
  const closesMax = dayPlus(from, LIMITS.MAX_CAMPAIGN_DAYS);
  const keyMax = dayPlus(draft.closesAt.slice(0, 10) || closesMax, LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE);

  return (
    <StepCard title="Dates" help={`It stops taking sponsors between a day and ${LIMITS.MAX_CAMPAIGN_DAYS} days from now.`}>
      <DayTimeField
        label="Closes"
        value={draft.closesAt}
        onChange={(closesAt) => set({ closesAt })}
        min={closesMin}
        max={closesMax}
        problems={problemsAt(problems, "closesAt")}
        hint="Set it a little before you travel."
      />

      <Field label="Dates worth showing" hint="Optional. The days a sponsor will want to know about." problems={problemsAt(problems, "keyDates")}>
        <div className="flex flex-col gap-3">
          {draft.keyDates.map((k, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Text
                    value={k.label}
                    onChange={(label) => set({ keyDates: draft.keyDates.map((d, j) => (j === i ? { ...d, label } : d)) })}
                    maxLength={60}
                    placeholder="Everything posted by"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove this date"
                  className={`${btnSmallGlass} !h-12 !w-12 !rounded-[24px] !px-0`}
                  onClick={() => set({ keyDates: draft.keyDates.filter((_, j) => j !== i) })}
                >
                  <Ion name="trash-outline" size={18} />
                </button>
              </div>
              <DayField
                label="On"
                value={k.date}
                onChange={(date) => set({ keyDates: draft.keyDates.map((d, j) => (j === i ? { ...d, date } : d)) })}
                min={from}
                max={keyMax}
              />
              <Problems list={problemsAt(problems, `keyDate:${i}`)} />
            </div>
          ))}
          {draft.keyDates.length < LIMITS.KEY_DATES_MAX ? (
            <div>
              <button type="button" className={emptyBtn} onClick={() => set({ keyDates: [...draft.keyDates, { label: "", date: "" }] })}>
                <Ion name="add" size={16} className="mr-1.5" />
                Add a date
              </button>
            </div>
          ) : null}
        </div>
      </Field>
    </StepCard>
  );
}
