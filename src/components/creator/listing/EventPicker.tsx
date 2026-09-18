/**
 * Which event this listing is for.
 *
 * WHY IT IS A LIST AND NOT A TEXT BOX
 *
 * An event that everyone types by hand is six events: "TOKEN2049", "Token
 * 2049", "token2049 singapore". Picked from the list, every creator at the
 * same conference lands on the same page, and a sponsor looking for that
 * conference finds all of them at once. So the search comes first and typing
 * the name is what is left when the search has nothing.
 *
 * WHY "NONE OF THESE" IS A SEPARATE ANSWER
 *
 * Adding one answers 409 `similar_events` with the ones that already look like
 * it — the same name, the same city, or dates a week either side. That is a
 * question, not a refusal, and it is asked once: saying none of these is it
 * sends the same event back with `confirmNew` and it is made.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { btnSmall, btnSmallSecondary, card, pill } from "@/components/ad-space/ui";
import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import { EVENT_CATEGORIES, type EventSummary } from "@/lib/creator/listing";
import { createEvent, searchEvents } from "@/lib/creator/listings";
import { eventDates } from "@/lib/ad-space/format";

import { Field, Dropdown, Text } from "./parts";

const CATEGORY_LABEL: Record<string, string> = {
  crypto: "Crypto",
  fintech: "Fintech",
  ai: "AI",
  tech: "Tech",
  robotics: "Robotics",
  science: "Science",
  motorsport: "Motorsport",
  sports: "Sports",
  travel: "Travel",
  culture: "Culture",
  other: "Something else",
};

export function EventPicker({
  eventId,
  eventName,
  picked,
  onPick,
  onName,
  problems,
  /** A session is always at an event from the list: typing a name is not enough. */
  mustPick,
}: {
  eventId: string | null;
  eventName: string;
  picked: EventSummary | null;
  onPick: (event: EventSummary | null) => void;
  onName: (name: string) => void;
  problems: readonly string[];
  mustPick: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const latest = useRef(0);

  const run = useCallback(async (q: string) => {
    const ticket = ++latest.current;
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const { events } = await searchEvents(q.trim());
      // An answer for a search the creator has already typed past is thrown
      // away: otherwise the slower of two calls paints over the faster one.
      if (ticket === latest.current) setResults(events);
    } catch (e) {
      if (ticket === latest.current) setNotice(describeCreatorError(e));
    } finally {
      if (ticket === latest.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void run(query), 250);
    return () => clearTimeout(t);
  }, [query, run]);

  if (eventId && picked) {
    return (
      <div className="flex flex-col gap-3">
        <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <div className="min-w-0">
            <p className="text-body text-text">{picked.name}</p>
            <p className="text-tiny text-text-muted">
              {picked.city} · {eventDates(picked.startsOn, picked.endsOn)}
            </p>
          </div>
          <button type="button" className={btnSmallSecondary} onClick={() => onPick(null)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Search for the event"
        hint="Two letters is enough to start. Conferences, races and festivals other creators have already added come up first."
        problems={problems}
        htmlFor="event-search"
      >
        <Text id="event-search" value={query} onChange={setQuery} placeholder="TOKEN2049" />
      </Field>

      {searching ? <p className="text-tiny text-text-muted">Looking…</p> : null}

      {results && results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onPick(e)}
                className={`${card} flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors duration-180 hover:bg-white/[0.06]`}
              >
                <span className="min-w-0">
                  <span className="block text-body text-text">{e.name}</span>
                  <span className="block text-tiny text-text-muted">
                    {e.city} · {eventDates(e.startsOn, e.endsOn)}
                  </span>
                </span>
                {e.spaceCount > 0 ? (
                  <span className={pill.neutral}>
                    {e.spaceCount} {e.spaceCount === 1 ? "listing" : "listings"}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {results && results.length === 0 ? (
        <p className="text-small text-text-muted">Nothing by that name yet.</p>
      ) : null}

      {notice ? <p className="text-small text-amber">{notice}</p> : null}

      {adding ? (
        <AddEvent
          initialName={query}
          onCancel={() => setAdding(false)}
          onAdded={(e) => {
            setAdding(false);
            onPick(e);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnSmallSecondary} onClick={() => setAdding(true)}>
            Add the event
          </button>
          {!mustPick ? (
            <span className="text-tiny text-text-muted">or just type its name below</span>
          ) : null}
        </div>
      )}

      {!mustPick && !adding ? (
        <Field
          label="The event's name"
          hint="Only used if it is not in the list. A listing with a name and no event still publishes; it just does not show up on that event's page."
          htmlFor="event-name"
        >
          <Text id="event-name" value={eventName} onChange={onName} maxLength={120} placeholder="Breakpoint London" />
        </Field>
      ) : null}
    </div>
  );
}

/** The form for an event nobody has added, and the one question it may ask back. */
function AddEvent({
  initialName,
  onAdded,
  onCancel,
}: {
  initialName: string;
  onAdded: (e: EventSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [category, setCategory] = useState<string>("crypto");
  const [candidates, setCandidates] = useState<EventSummary[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(confirmNew: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      const { event } = await createEvent({
        name,
        city,
        country: country.trim() ? country.trim().toUpperCase() : null,
        startsOn,
        endsOn,
        category,
        ...(confirmNew ? { confirmNew: true } : {}),
      });
      onAdded(event);
    } catch (e) {
      if (e instanceof CreatorApiError && e.code === "similar_events") {
        const list = Array.isArray(e.details.candidates) ? (e.details.candidates as EventSummary[]) : [];
        setCandidates(list);
      } else if (e instanceof CreatorApiError && e.code === "event_dates_invalid") {
        setNotice("Check the dates: the last day cannot be before the first, and an event runs at most a month.");
      } else if (e instanceof CreatorApiError && e.code === "event_in_the_past") {
        setNotice("That event is already over.");
      } else if (e instanceof CreatorApiError && e.code === "event_too_far") {
        setNotice("That is more than two years away, which is a typo more often than a plan.");
      } else if (e instanceof CreatorApiError && e.code === "country_invalid") {
        setNotice("Use the two-letter country code, like SG.");
      } else if (e instanceof CreatorApiError && e.code === "rate_limited") {
        setNotice("That is as many events as one account can add in a day.");
      } else if (
        e instanceof CreatorApiError &&
        (e.code === "x_not_linked" || e.code === "x_not_verified" || e.code === "x_account_too_new")
      ) {
        setNotice("Adding an event needs the same verified X account publishing does. Set that up on your account page first.");
      } else {
        setNotice(describeCreatorError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (candidates) {
    return (
      <div className={`${card} flex flex-col gap-4 p-5`}>
        <p className="text-small text-text">
          One of these may already be it. Picking the one that exists puts your listing on the same page as everybody
          else at that event, which is where sponsors look.
        </p>
        <ul className="flex flex-col gap-2">
          {candidates.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onAdded(e)}
                className="flex w-full flex-col rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3 text-left transition-colors duration-180 hover:bg-white/5"
              >
                <span className="text-small text-text">{e.name}</span>
                <span className="text-tiny text-text-muted">
                  {e.city} · {eventDates(e.startsOn, e.endsOn)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnSmall} disabled={busy} onClick={() => void submit(true)}>
            {busy ? "Adding…" : "None of these — add mine"}
          </button>
          <button type="button" className={btnSmallSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
        {notice ? <p className="text-small text-amber">{notice}</p> : null}
      </div>
    );
  }

  return (
    <div className={`${card} flex flex-col gap-4 p-5`}>
      <p className="text-small text-text-muted">
        An event is shared: every creator going to it lists under the same one, and it stays after your listing closes.
      </p>
      <Field label="Name" htmlFor="new-event-name">
        <Text id="new-event-name" value={name} onChange={setName} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="new-event-city">
          <Text id="new-event-city" value={city} onChange={setCity} maxLength={80} />
        </Field>
        <Field label="Country" hint="Two letters, like SG. Leave it out if you are not sure." htmlFor="new-event-country">
          <Text id="new-event-country" value={country} onChange={setCountry} maxLength={2} />
        </Field>
        <Field label="First day" htmlFor="new-event-start">
          <Text id="new-event-start" type="date" value={startsOn} onChange={setStartsOn} />
        </Field>
        <Field label="Last day" htmlFor="new-event-end">
          <Text id="new-event-end" type="date" value={endsOn} onChange={setEndsOn} />
        </Field>
      </div>
      <Field label="What kind of event" htmlFor="new-event-category">
        <Dropdown
          id="new-event-category"
          value={category}
          onChange={setCategory}
          options={EVENT_CATEGORIES.map((c) => ({ value: c as string, label: CATEGORY_LABEL[c] ?? c }))}
        />
      </Field>
      {notice ? <p className="text-small text-amber">{notice}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btnSmall} disabled={busy} onClick={() => void submit(false)}>
          {busy ? "Adding…" : "Add it"}
        </button>
        <button type="button" className={btnSmallSecondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
