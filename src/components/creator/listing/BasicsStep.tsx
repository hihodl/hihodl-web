/**
 * Name it and set the dates.
 *
 * WHY THE CLOSING TIME IS ASKED HERE AND NOT AT THE END
 *
 * Almost everything else on a listing is measured against it: bidding has to
 * stop fifty hours before it, deliverables are due within ninety days of it,
 * and the campaign itself runs between a day and sixty from now. Asked late,
 * every one of those becomes a correction to a form the creator thought they
 * had finished.
 *
 * WHY THE GOAL IS OPTIONAL AND THE REASON IS NOT A PITCH
 *
 * The goal is a number we print beside the reason and nothing more: no sale,
 * offer or payout reads it, and the listing goes on taking money past it. It
 * is worth saying so, because a creator who thinks it is a cap will set it
 * wrong.
 */

"use client";

import {
  LIMITS,
  VENUE_TYPES,
  type EventSummary,
  type ListingDraft,
  type Template,
  type VenueType,
  isSessionTemplate,
} from "@/lib/creator/listing";
import { problemsAt, type Problem } from "@/lib/creator/rules";

import { EventPicker } from "./EventPicker";
import { Block, Field, Money, Paragraph, Problems, Text } from "./parts";

const VENUE_LABEL: Record<VenueType, string> = {
  travel: "While travelling",
  conference: "At a conference",
  sports_event: "At a race or a match",
  private_event: "At a private event",
  everyday: "Everyday life",
};

const VENUE_BODY: Record<VenueType, string> = {
  travel: "Airports, hotels, trains — wherever you happen to be.",
  conference: "A named conference. You will be asked to confirm its rules on branded items.",
  sports_event: "A named race or match, where the organiser's rules on logos also apply.",
  private_event: "Somebody else's wedding or party, where the host has to have agreed.",
  everyday: "No particular occasion. Day to day, wherever you go.",
};

export function BasicsStep({
  draft,
  template,
  picked,
  onChange,
  onPickEvent,
  problems,
}: {
  draft: ListingDraft;
  template: Template;
  picked: EventSummary | null;
  onChange: (next: ListingDraft) => void;
  onPickEvent: (event: EventSummary | null) => void;
  problems: readonly Problem[];
}) {
  const set = (change: Partial<ListingDraft>) => onChange({ ...draft, ...change });
  const session = isSessionTemplate(template);
  const venues = VENUE_TYPES.filter((v) => template.allowedVenues.includes(v));

  return (
    <div className="flex flex-col gap-10">
      <Block
        title="What to call it"
        why="This is the headline on your page and in every link anybody shares. Say where you are going and what you are doing there."
      >
        <Field label="Name" problems={problemsAt(problems, "title")} htmlFor="listing-title">
          <Text
            id="listing-title"
            value={draft.title}
            onChange={(title) => set({ title })}
            maxLength={LIMITS.TITLE_MAX}
            placeholder="Covering Breakpoint London, 15 to 17 November"
          />
        </Field>
        <Field
          label="Why you are doing it"
          hint="Optional. A few lines under the headline — what the trip is, what you are making, who it reaches."
          problems={problemsAt(problems, "reason")}
          htmlFor="listing-reason"
        >
          <Paragraph
            id="listing-reason"
            value={draft.reason}
            onChange={(reason) => set({ reason })}
            maxLength={LIMITS.REASON_MAX}
          />
        </Field>
        <Field
          label="What you need to raise"
          hint="Optional, and a figure we print rather than a limit we keep: the listing goes on taking sponsors past it. Leave it empty and your page simply says what it is for."
          problems={problemsAt(problems, "goal")}
          htmlFor="listing-goal"
        >
          <Money id="listing-goal" value={draft.fundingGoalDollars} onChange={(fundingGoalDollars) => set({ fundingGoalDollars })} />
        </Field>
      </Block>

      <Block
        title="When it stops taking sponsors"
        why={`Between a day and ${LIMITS.MAX_CAMPAIGN_DAYS} days from now. Set it a little before you travel: a sponsor who buys the night before has no time to send you anything.`}
      >
        <Field label="Closes" problems={problemsAt(problems, "closesAt")} htmlFor="listing-closes">
          <Text id="listing-closes" type="datetime-local" value={draft.closesAt} onChange={(closesAt) => set({ closesAt })} />
        </Field>
        <Field
          label="Dates worth showing"
          hint="Optional. “Filming starts”, “everything posted by” — the days a sponsor will want to know about, shown on your page."
          problems={problemsAt(problems, "keyDates")}
        >
          <div className="flex flex-col gap-3">
            {draft.keyDates.map((k, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <Text
                      value={k.label}
                      onChange={(label) =>
                        set({ keyDates: draft.keyDates.map((d, j) => (j === i ? { ...d, label } : d)) })
                      }
                      maxLength={60}
                      placeholder="Everything posted by"
                    />
                  </div>
                  <div className="sm:w-48">
                    <Text
                      type="date"
                      value={k.date}
                      onChange={(date) => set({ keyDates: draft.keyDates.map((d, j) => (j === i ? { ...d, date } : d)) })}
                    />
                  </div>
                  <button
                    type="button"
                    className="h-12 shrink-0 rounded-[24px] border border-[color:var(--color-hairline-strong)] px-5 text-small text-text transition-colors duration-180 hover:bg-white/5"
                    onClick={() => set({ keyDates: draft.keyDates.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <Problems list={problemsAt(problems, `keyDate:${i}`)} />
              </div>
            ))}
            {draft.keyDates.length < LIMITS.KEY_DATES_MAX ? (
              <div>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-[20px] border border-[color:var(--color-hairline-strong)] px-5 text-small text-text transition-colors duration-180 hover:bg-white/5"
                  onClick={() => set({ keyDates: [...draft.keyDates, { label: "", date: "" }] })}
                >
                  Add a date
                </button>
              </div>
            ) : null}
          </div>
        </Field>
      </Block>

      {venues.length > 1 ? (
        <Block
          title="Where this happens"
          why="It decides what you will be asked to confirm before it goes live — a conference has rules about branded items, a private event has a host who has to have agreed."
        >
          <Field label="Occasion" problems={problemsAt(problems, "venueType")}>
            <div className="flex flex-col gap-2">
              {venues.map((v) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-3 rounded-input border px-4 py-3 transition-colors duration-180 ${
                    draft.venueType === v
                      ? "border-amber bg-amber/10"
                      : "border-[color:var(--color-hairline-strong)] hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="venue"
                    className="mt-1 accent-amber"
                    checked={draft.venueType === v}
                    onChange={() => set({ venueType: v })}
                  />
                  <span className="min-w-0">
                    <span className="block text-small text-text">{VENUE_LABEL[v]}</span>
                    <span className="mt-1 block text-tiny text-text-muted">{VENUE_BODY[v]}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </Block>
      ) : null}

      <Block
        title="The event"
        why={
          session
            ? "Time in person is always sold at an event: its last day is what sets the day you have to have delivered by, and a slot cannot be sold after it."
            : "Picking it from the list puts your listing on that event's page, next to every other creator going. It is where sponsors who are not already following you look."
        }
      >
        <EventPicker
          eventId={draft.eventId}
          eventName={draft.eventName}
          picked={picked}
          mustPick={session}
          onPick={(event) => {
            onPickEvent(event);
            set({ eventId: event?.id ?? null, eventName: event ? "" : draft.eventName });
          }}
          onName={(eventName) => set({ eventName })}
          problems={problemsAt(problems, "event")}
        />
      </Block>
    </div>
  );
}
