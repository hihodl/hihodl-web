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
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
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
const WHEN_LABEL: Record<DeliveryWhen, MessageKey> = {
  before: "listings.promise.when.before",
  during: "listings.promise.when.during",
  after: "listings.promise.when.after",
};

const DELIVERABLE_LABEL: Record<DeliverableKind, MessageKey> = {
  in_person: "listings.promise.kind.inPerson",
  photo_post: "listings.promise.kind.photoPost",
  video: "listings.promise.kind.video",
  story: "listings.promise.kind.story",
  thank_you_post: "listings.promise.kind.thankYouPost",
  mention: "listings.promise.kind.mention",
  custom: "listings.promise.kind.custom",
};

/** Platform names are names and stay as they are; only "Other" is a word. */
const PLATFORM_LABEL: Record<Exclude<Platform, "other">, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

const FALLBACK_LABEL: Record<Fallback, MessageKey> = {
  content_anyway: "listings.promise.fallback.contentAnyway",
  creator_refund: "listings.promise.fallback.creatorRefund",
  next_event: "listings.promise.fallback.nextEvent",
};

const FALLBACK_BODY: Record<Fallback, MessageKey> = {
  content_anyway: "listings.promise.fallbackBody.contentAnyway",
  creator_refund: "listings.promise.fallbackBody.creatorRefund",
  next_event: "listings.promise.fallbackBody.nextEvent",
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
  const t = useT();
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const service = template.kind === "service";
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const latestDue = dayPlus(draft.closesAt.slice(0, 10) || today(), LIMITS.DELIVERABLE_DAYS_AFTER_CLOSE);

  return (
    <StepCard title={t("listings.wizard.stage.promise")} help={t("listings.promise.help")}>
      {isCustomServiceTemplate(template) ? (
        <>
          <Field label={t("listings.promise.nameIt")} problems={problemsAt(problems, "serviceName")} htmlFor="service-name">
            <Text id="service-name" value={draft.serviceName} onChange={(serviceName) => set({ serviceName })} maxLength={LIMITS.SERVICE_NAME_MAX} />
          </Field>
          <Field
            label={t("listings.promise.summary")}
            hint={t("listings.promise.summaryHint")}
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
        <Field label={t("listings.promise.whatYouGet")} hint={t("listings.promise.whatYouGetHint")}>
          <BrandGetsEditor draft={draft} template={template} onChange={onChange} problems={problems} />
        </Field>
      )}

      {service ? (
        session ? (
          <Body dim>{t("listings.promise.sessionNothingToSet")}</Body>
        ) : (
          <DayField
            label={t("listings.promise.deliverBy")}
            value={draft.deliverBy}
            onChange={(deliverBy) => set({ deliverBy })}
            min={today()}
            max={latestDue}
            problems={problemsAt(problems, "deliverBy")}
            hint={t("listings.promise.deliverByHint")}
          />
        )
      ) : (
        <Deliverables draft={draft} onChange={onChange} problems={problems} latestDue={latestDue} event={event} />
      )}

      <Field
        label={session ? t("listings.promise.fallbackSession") : t("listings.promise.fallbackVenue")}
        problems={problemsAt(problems, "fallback")}
        hint={t("listings.promise.fallbackHint")}
      >
        <Choice
          name="fallback"
          value={draft.fallback}
          onChange={(fallback) => set({ fallback: fallback as Fallback })}
          options={FALLBACKS.filter((f) => !session || f !== "content_anyway").map((f) => ({
            value: f,
            label: t(FALLBACK_LABEL[f]),
            body: t(FALLBACK_BODY[f]),
          }))}
        />
      </Field>
      {draft.fallback === "next_event" ? (
        <Field
          label={t("listings.promise.whichEvent")}
          problems={problemsAt(problems, "fallbackNote")}
          htmlFor="fallback-note"
          hint={t("listings.promise.whichEventHint")}
        >
          <Text
            id="fallback-note"
            value={draft.fallbackNote}
            onChange={(fallbackNote) => set({ fallbackNote })}
            maxLength={LIMITS.REASON_MAX}
            placeholder={t("listings.promise.whichEventPlaceholder")}
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
  const t = useT();
  const list = draft.deliverables;
  const platformLabel = (p: Platform) => (p === "other" ? t("listings.promise.platformOther") : PLATFORM_LABEL[p]);
  const set = (next: DeliverableDraft[]) => onChange({ ...draft, deliverables: next });
  const patch = (i: number, change: Partial<DeliverableDraft>) => set(list.map((d, j) => (j === i ? { ...d, ...change } : d)));

  return (
    <div className="flex flex-col gap-2.5">
      <Problems list={problemsAt(problems, "deliverables")} />
      {list.map((d, i) => (
        <Card key={i} className="!gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{t("listings.promise.countTimes", { count: d.count, kind: t(DELIVERABLE_LABEL[d.kind]) })}</SectionLabel>
            <button type="button" aria-label={t("common.remove")} className={`${btnSmallGlass} !w-9 !px-0`} onClick={() => set(list.filter((_, j) => j !== i))}>
              <Ion name="trash-outline" size={17} />
            </button>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={t("listings.promise.what")} problems={problemsAt(problems, `deliverable:${i}:kind`)} htmlFor={`d-${i}-kind`}>
              <Dropdown
                id={`d-${i}-kind`}
                value={d.kind}
                onChange={(kind) => patch(i, { kind: kind as DeliverableKind })}
                options={DELIVERABLE_KINDS.map((k) => ({ value: k, label: t(DELIVERABLE_LABEL[k]) }))}
              />
            </Field>
            <Field label={t("listings.promise.howMany")} problems={problemsAt(problems, `deliverable:${i}:count`)} htmlFor={`d-${i}-count`}>
              <Count id={`d-${i}-count`} value={d.count} min={1} max={LIMITS.DELIVERABLE_COUNT_MAX} onChange={(count) => patch(i, { count })} />
            </Field>
            <Field label={t("listings.promise.where")} problems={problemsAt(problems, `deliverable:${i}:platform`)} htmlFor={`d-${i}-platform`}>
              <Dropdown
                id={`d-${i}-platform`}
                value={d.platform ?? "x"}
                onChange={(platform) => patch(i, { platform: platform as Platform })}
                options={PLATFORMS.map((p) => ({ value: p, label: platformLabel(p) }))}
              />
            </Field>
            <div className="flex min-w-0 flex-col gap-2">
              <DayField
                label={t("listings.promise.byWhen")}
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
                      label={t(WHEN_LABEL[w])}
                      selected={windowOfDay(d.dueDate, event) === w}
                      onClick={() => patch(i, { dueDate: deliveryDayFor(w, event) })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Field
            label={d.kind === "custom" ? t("listings.promise.noteCustom") : t("listings.promise.noteOther")}
            hint={d.kind === "custom" ? t("listings.promise.noteCustomHint") : t("listings.promise.noteOtherHint")}
            problems={problemsAt(problems, `deliverable:${i}:note`)}
            htmlFor={`d-${i}-note`}
          >
            <Text id={`d-${i}-note`} value={d.note} onChange={(note) => patch(i, { note })} maxLength={LIMITS.NOTE_MAX} />
          </Field>
        </Card>
      ))}
      {list.length < LIMITS.DELIVERABLES_MAX ? (
        <ChipRow label={t("listings.wizard.stage.promise")}>
          <Chip icon="add" label={t("listings.promise.addDeliverable")} onClick={() => set([...list, { kind: "photo_post", platform: "x", count: 1, dueDate: "", note: "" }])} />
        </ChipRow>
      ) : null}
    </div>
  );
}
