/**
 * What the brand gets, and by when.
 *
 * THE RULE THE WHOLE CARD EXISTS FOR
 *
 * Every listing must promise at least one thing a venue cannot take away. A
 * sponsor who bought a spot on a suitcase at a conference and nothing else has
 * bought something the organiser can cancel on the door; one who bought the
 * photos, the vlog and the thank-you post still gets those. So a placement
 * lists what it will post, and a service names the day every sponsor has their
 * work by.
 *
 * This was the top half of the old "Go live" step. It is its own card because
 * what a listing promises and what a listing declares are two different
 * questions, and reading them as one wall is how the second one gets skipped.
 */

"use client";

import { Ion } from "@/components/app/ion";
import { Body, Card, Chip, ChipRow, SectionLabel } from "@/components/app/spaces/kit";
import {
  DELIVERABLE_KINDS,
  DELIVERY_WHENS,
  FALLBACKS,
  LIMITS,
  deliveryDayFor,
  isCustomServiceTemplate,
  isProductionTemplate,
  isSessionTemplate,
  windowOfDay,
  type DeliverableDraft,
  type DeliverableKind,
  type DeliveryWhen,
  type EventSummary,
  type Fallback,
  type ListingDraft,
  PLATFORMS,
  type Platform,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { BrandGetsEditor } from "./BrandGetsEditor";
import { btnSmallGlass, Choice, Count, Dropdown, Field, Paragraph, Problems, Text } from "./parts";
import { StepCard } from "./StepPager";
import { DayField, dayPlus, today } from "./WhenField";

/**
 * The three windows, said from the promise's point of view.
 *
 * Shorter than the event card's wording because they sit in a row next to a
 * date, not as a question on their own: "Before it starts" reads as a sentence,
 * "Before" reads as a setting.
 */
const WHEN_LABEL: Record<DeliveryWhen, string> = {
  before: "Before",
  during: "During",
  after: "After",
};

const DELIVERABLE_LABEL: Record<DeliverableKind, string> = {
  in_person: "In person",
  photo_post: "Photo post",
  video: "Video",
  story: "Story",
  thank_you_post: "Thank-you post",
  mention: "Brand mention",
  custom: "Something else",
};

const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  other: "Other",
};

const FALLBACK_LABEL: Record<Fallback, string> = {
  content_anyway: "Content anyway",
  creator_refund: "I refund the price",
  next_event: "Moves to the next event",
};

const FALLBACK_BODY: Record<Fallback, string> = {
  content_anyway: "Every post and video is still delivered as promised.",
  creator_refund: "You send the price back from your own wallet.",
  next_event: "The spot moves to another event within 90 days.",
};

export function PromiseStep({
  draft,
  template,
  event,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  /** The event this listing sits in, so each promise can name its window. */
  event: EventSummary | null;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const latestDue = dayPlus(draft.closesAt.slice(0, 10) || today(), LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE);

  return (
    <StepCard title="What the brand gets" help="At least one thing a venue cannot take away, and the day it lands.">
      {isCustomServiceTemplate(template) ? (
        <>
          <Field label="Name it" problems={problemsAt(problems, "serviceName")} htmlFor="service-name">
            <Text id="service-name" value={draft.serviceName} onChange={(serviceName) => set({ serviceName })} maxLength={LIMITS.SERVICE_NAME_MAX} />
          </Field>
          <Field
            label="Say what a brand gets"
            hint="This one is not in our catalogue, so your words are the only description there is."
            problems={problemsAt(problems, "serviceSummary")}
            htmlFor="service-summary"
          >
            <Paragraph
              id="service-summary"
              value={draft.serviceSummary}
              onChange={(serviceSummary) => set({ serviceSummary })}
              maxLength={LIMITS.SERVICE_SUMMARY_MAX}
            />
          </Field>
        </>
      ) : null}

      {session || production ? null : (
        <Field label="What you get" hint="The list a brand reads before paying, in your words and your order.">
          <BrandGetsEditor draft={draft} template={template} onChange={onChange} problems={problems} />
        </Field>
      )}

      {service ? (
        session ? (
          <Body dim>
            Nothing to set: time in person is delivered by the day after the event ends, and that date comes from the event you
            picked.
          </Body>
        ) : (
          <DayField
            label="Every slot delivered by"
            value={draft.deliverBy}
            onChange={(deliverBy) => set({ deliverBy })}
            min={today()}
            max={latestDue}
            problems={problemsAt(problems, "deliverBy")}
            hint="One date for the whole listing, on the page before anybody pays."
          />
        )
      ) : (
        <Deliverables draft={draft} onChange={onChange} problems={problems} latestDue={latestDue} event={event} />
      )}

      <Field
        label={session ? "If a session can't happen" : "If the venue says no"}
        problems={problemsAt(problems, "fallback")}
        hint="Your promise, on the page before anybody pays."
      >
        <Choice
          name="fallback"
          value={draft.fallback}
          onChange={(fallback) => set({ fallback: fallback as Fallback })}
          options={FALLBACKS.filter((f) => !session || f !== "content_anyway").map((f) => ({
            value: f,
            label: FALLBACK_LABEL[f],
            body: FALLBACK_BODY[f],
          }))}
        />
      </Field>
      {draft.fallback === "next_event" ? (
        <Field
          label="Which event, and when"
          problems={problemsAt(problems, "fallbackNote")}
          htmlFor="fallback-note"
          hint="Within 90 days. Without a name and a date this promises nothing."
        >
          <Text
            id="fallback-note"
            value={draft.fallbackNote}
            onChange={(fallbackNote) => set({ fallbackNote })}
            maxLength={LIMITS.REASON_MAX}
            placeholder="Devcon, 12 November"
          />
        </Field>
      ) : null}
    </StepCard>
  );
}

/* ── What a placement posts ───────────────────────────────────────── */

function Deliverables({
  draft,
  onChange,
  problems,
  latestDue,
  event,
}: {
  draft: ListingDraft;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
  latestDue: string;
  /** The event this listing sits in, when it sits in one. */
  event: EventSummary | null;
}) {
  const list = draft.deliverables;
  const set = (next: DeliverableDraft[]) => onChange({ ...draft, deliverables: next });
  const patch = (i: number, change: Partial<DeliverableDraft>) => set(list.map((d, j) => (j === i ? { ...d, ...change } : d)));

  return (
    <div className="flex flex-col gap-2.5">
      <Problems list={problemsAt(problems, "deliverables")} />
      {list.map((d, i) => (
        <Card key={i} className="!gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{`${d.count}× ${DELIVERABLE_LABEL[d.kind]}`}</SectionLabel>
            <button type="button" aria-label="Remove" className={`${btnSmallGlass} !w-9 !px-0`} onClick={() => set(list.filter((_, j) => j !== i))}>
              <Ion name="trash-outline" size={17} />
            </button>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="What" problems={problemsAt(problems, `deliverable:${i}:kind`)} htmlFor={`d-${i}-kind`}>
              <Dropdown
                id={`d-${i}-kind`}
                value={d.kind}
                onChange={(kind) => patch(i, { kind: kind as DeliverableKind })}
                options={DELIVERABLE_KINDS.map((k) => ({ value: k, label: DELIVERABLE_LABEL[k] }))}
              />
            </Field>
            <Field label="How many" problems={problemsAt(problems, `deliverable:${i}:count`)} htmlFor={`d-${i}-count`}>
              <Count id={`d-${i}-count`} value={d.count} min={1} max={LIMITS.DELIVERABLE_COUNT_MAX} onChange={(count) => patch(i, { count })} />
            </Field>
            <Field label="Where" problems={problemsAt(problems, `deliverable:${i}:platform`)} htmlFor={`d-${i}-platform`}>
              <Dropdown
                id={`d-${i}-platform`}
                value={d.platform ?? "x"}
                onChange={(platform) => patch(i, { platform: platform as Platform })}
                options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
              />
            </Field>
            <div className="flex min-w-0 flex-col gap-2">
              <DayField
                label="By when"
                value={d.dueDate}
                onChange={(dueDate) => patch(i, { dueDate })}
                min={today()}
                max={latestDue}
                problems={problemsAt(problems, `deliverable:${i}:dueDate`)}
              />
              {/*
                The window, per promise — the whole point of this row.
                It is a shortcut to a DATE and not a second thing to store: the
                chip picks the day, the day is what is saved, and typing a date
                by hand lights the chip it falls in. So the two can never
                disagree, because there is only one of them.
              */}
              {event ? (
                <div className="flex flex-wrap gap-1.5">
                  {DELIVERY_WHENS.map((w) => (
                    <Chip
                      key={w}
                      label={WHEN_LABEL[w]}
                      selected={windowOfDay(d.dueDate, event) === w}
                      onClick={() => patch(i, { dueDate: deliveryDayFor(w, event) })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Field
            label={d.kind === "custom" ? "Say exactly what it is" : "Anything to add"}
            hint={d.kind === "custom" ? "Required, and a sponsor reads it." : "Optional."}
            problems={problemsAt(problems, `deliverable:${i}:note`)}
            htmlFor={`d-${i}-note`}
          >
            <Text id={`d-${i}-note`} value={d.note} onChange={(note) => patch(i, { note })} maxLength={LIMITS.NOTE_MAX} />
          </Field>
        </Card>
      ))}
      {list.length < LIMITS.DELIVERABLES_MAX ? (
        <ChipRow label="What the brand gets">
          <Chip icon="add" label="Add a deliverable" onClick={() => set([...list, { kind: "photo_post", platform: "x", count: 1, dueDate: "", note: "" }])} />
        </ChipRow>
      ) : null}
    </div>
  );
}
