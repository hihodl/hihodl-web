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

const KIND_LABEL: Record<EventKind, string> = {
  public: "A conference or a public event",
  race: "A race or a match",
  private: "Somebody's private event",
};

const KIND_BODY: Record<EventKind, string> = {
  public: "It has rules about branded items.",
  race: "The organiser's rules on logos apply.",
  private: "The host has to have agreed.",
};

const WHEN_LABEL: Record<DeliveryWhen, string> = {
  before: "Before it starts",
  during: "While it is on",
  after: "In the wrap-up after it",
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
  const session = isSessionTemplate(template);
  const production = isProductionTemplate(template);
  const mustPick = session || production;
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
      title="Offering in an event?"
      help={mustPick ? "This one is always sold at an event: its dates are the window you work in." : "Say yes and your listing shows on that event's page, next to everyone else going."}
    >
      <Choice
        name="in-event"
        value={answer ?? ""}
        onChange={(v) => answered(v as EventAnswer)}
        options={[
          { value: "yes", label: "Yes" },
          {
            value: "no",
            label: "No",
            disabled: mustPick,
            why: mustPick ? "This one is always sold at an event." : undefined,
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
            <Field label="What kind of event" problems={problemsAt(problems, "venueType")}>
              <Choice
                name="event-kind"
                value={kind ?? ""}
                onChange={(v) => {
                  onKind(v as EventKind);
                  onChange({ ...draft, venueType: venueFor(template, "yes", v as EventKind) });
                }}
                options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k], body: KIND_BODY[k] }))}
              />
            </Field>
          ) : null}

          {picked ? (
            <Field label="When you deliver" hint="It fills in the days you promise. You can change any of them.">
              <Choice
                name="delivery-when"
                value={when ?? ""}
                onChange={(v) => {
                  onWhen(v as DeliveryWhen);
                  onChange(withDeliveryDay(draft, deliveryDayFor(v as DeliveryWhen, picked)));
                }}
                options={DELIVERY_WHENS.map((w) => ({ value: w, label: WHEN_LABEL[w] }))}
              />
            </Field>
          ) : null}
        </>
      ) : answer === "no" ? (
        <Notice tone="calm">It publishes and sells the same way. It just does not appear on any event&rsquo;s page.</Notice>
      ) : null}
    </StepCard>
  );
}
