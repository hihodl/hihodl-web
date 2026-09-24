/**
 * Offering in an event? Yes or no.
 *
 * WHAT THIS REPLACED
 *
 * Two questions used to sit here. One was "Event (optional)", a search box
 * with a hint under it that a creator could skip without ever deciding
 * anything. The other was "Where this happens" — While travelling, At a
 * conference, Everyday life — which asked the creator to classify their own
 * life so that we could work out which declarations to ask for.
 *
 * Both are gone, and what is left is one question with two answers. Yes puts
 * the event's name and its dates on the card, which is the thing that was
 * missing: a listing tied to an event belongs on that event's page, next to
 * every other creator going.
 *
 * WHERE THE VENUE WENT
 *
 * Nowhere — it is derived. See `venueFor` in lib/creator/listing.ts: an event
 * we hold tells us its own kind from its category, and the venue follows from
 * that. The one thing an event cannot tell us is what kind it is when the
 * creator typed its name by hand, so that question survives, in the creator's
 * words and only when the answer would change what has to be declared.
 *
 * WHEN, NOT WHERE
 *
 * The product is the hook; what the brand actually buys is content. So the
 * second question on this card is when that content lands against the event —
 * before it, while it is on, or in the wrap-up after it. It fills in the days
 * the listing promises, which is the thing "where this happens" never did.
 */

"use client";

import { Notice } from "@/components/app/hold";
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import {
  DELIVERY_WHENS,
  asksEventKind,
  deliveryDayFor,
  eventKindOf,
  isProductionTemplate,
  isSessionTemplate,
  venueFor,
  withDeliveryDay,
  type DeliveryWhen,
  type EventAnswer,
  type EventKind,
  type EventSummary,
  type ListingDraft,
  type Template,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { EventPicker } from "./EventPicker";
import { Choice, Field } from "./parts";
import { StepCard } from "./StepPager";

const KIND_LABEL: Record<EventKind, MessageKey> = {
  public: "listings.event.kind.public",
  race: "listings.event.kind.race",
  private: "listings.event.kind.private",
};

const KIND_BODY: Record<EventKind, MessageKey> = {
  public: "listings.event.kindBody.public",
  race: "listings.event.kindBody.race",
  private: "listings.event.kindBody.private",
};

const WHEN_LABEL: Record<DeliveryWhen, MessageKey> = {
  before: "listings.event.when.before",
  during: "listings.event.when.during",
  after: "listings.event.when.after",
};

export function EventStep({
  draft,
  template,
  picked,
  answer,
  kind,
  when,
  onPickEvent,
  onAnswer,
  onKind,
  onWhen,
  onChange,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  picked: EventSummary | null;
  /** Yes or no, or null while it has not been answered. */
  answer: EventAnswer | null;
  kind: EventKind | null;
  when: DeliveryWhen | null;
  onPickEvent: (event: EventSummary | null) => void;
  onAnswer: (answer: EventAnswer) => void;
  onKind: (kind: EventKind) => void;
  onWhen: (when: DeliveryWhen) => void;
  onChange: (next: ListingDraft) => void;
  problems: readonly Problem[];
}) {
  const t = useT();
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const mustPick = session || production;
  /** A service carries ONE `deliverBy` for every slot; a placement does not. */
  const service = template.kind === "service";
  const kinds = (["public", "race", "private"] as const).filter((k) =>
    template.allowedVenues.includes(k === "public" ? "conference" : k === "race" ? "sports_event" : "private_event"),
  );

  /** Saying yes or no is what sets the venue: nobody is asked for it directly. */
  const answered = (next: EventAnswer) => {
    onAnswer(next);
    const nextKind = next === "yes" ? kind : null;
    onChange({
      ...draft,
      venueType: venueFor(template, next, nextKind),
      ...(next === "no" ? { eventId: null, eventName: "" } : {}),
    });
  };

  return (
    <StepCard
      title={t("listings.event.title")}
      help={mustPick ? t("listings.event.helpMustPick") : t("listings.event.help")}
    >
      <Choice
        name="in-event"
        value={answer ?? ""}
        onChange={(v) => answered(v as EventAnswer)}
        options={[
          { value: "yes", label: t("common.yes") },
          {
            value: "no",
            label: t("common.no"),
            disabled: mustPick,
            why: mustPick ? t("listings.event.alwaysAtEvent") : undefined,
          },
        ]}
      />

      {answer === "yes" ? (
        <>
          <EventPicker
            eventId={draft.eventId}
            eventName={draft.eventName}
            picked={picked}
            mustPick={mustPick}
            onPick={(event) => {
              onPickEvent(event);
              // The event we hold knows its own kind, so picking one is also
              // the answer to what kind of event this is — and so to the venue.
              onChange({
                ...draft,
                eventId: event?.id ?? null,
                eventName: event ? "" : draft.eventName,
                venueType: venueFor(template, "yes", event ? eventKindOf(event) : kind),
              });
            }}
            onName={(eventName) => onChange({ ...draft, eventName })}
            problems={problemsAt(problems, "event")}
          />

          {asksEventKind(template, answer, picked) ? (
            <Field label={t("listings.event.whatKind")} problems={problemsAt(problems, "venueType")}>
              <Choice
                name="event-kind"
                value={kind ?? ""}
                onChange={(v) => {
                  onKind(v as EventKind);
                  onChange({ ...draft, venueType: venueFor(template, "yes", v as EventKind) });
                }}
                options={kinds.map((k) => ({ value: k, label: t(KIND_LABEL[k]), body: t(KIND_BODY[k]) }))}
              />
            </Field>
          ) : null}

          {/*
            One window, and ONLY where the listing really has one.
            A service sells slots that are all delivered by the same date, so
            asking once is asking the truth. A placement promises several
            things that land in different weeks, and its windows are set one
            promise at a time on the next card — see the note below.
          */}
          {picked && service ? (
            <Field label={t("listings.event.whenDeliver")} hint={t("listings.event.whenDeliverHint")}>
              <Choice
                name="delivery-when"
                value={when ?? ""}
                onChange={(v) => {
                  onWhen(v as DeliveryWhen);
                  onChange(withDeliveryDay(draft, deliveryDayFor(v as DeliveryWhen, picked)));
                }}
                options={DELIVERY_WHENS.map((w) => ({ value: w, label: t(WHEN_LABEL[w]) }))}
              />
            </Field>
          ) : null}

          {picked && !service ? (
            <Notice tone="calm">{t("listings.event.perPromiseNotice")}</Notice>
          ) : null}
        </>
      ) : answer === "no" ? (
        <Notice tone="calm">{t("listings.event.noEventNotice")}</Notice>
      ) : null}
    </StepCard>
  );
}
