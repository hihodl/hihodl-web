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

import { ctaPrimary } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Card, Chip, ChipRow, Divider, EventLine, eventDatesText, fieldLabel } from "@/components/app/spaces/kit";
import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import { EVENT_CATEGORIES, type EventSummary } from "@/lib/creator/listing";
import { createEvent, searchEvents } from "@/lib/creator/listings";

import { Field, Problems, Text } from "./parts";
import { DayField, dayPlus, today } from "./WhenField";

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

  // Whether there is an event at all is the question before this one, so this
  // field is never the place that says "optional".
  const label = "Event";
  const typed = query.trim();

  if (eventId && picked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{label}</span>
        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-extrabold text-white">{picked.name}</span>
            <button type="button" onClick={() => onPick(null)} className="shrink-0 text-[13px] font-extrabold text-white hover:opacity-80">
              Change
            </button>
          </div>
          <EventLine event={picked} />
        </Card>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{label}</span>
        <AddEvent
          initialName={query}
          onCancel={() => setAdding(false)}
          onAdded={(e) => {
            setAdding(false);
            onPick(e);
          }}
        />
      </div>
    );
  }

  const list = results ?? [];
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Field label={label} problems={problems} htmlFor="event-search">
          <Text id="event-search" value={query} onChange={setQuery} placeholder="Search events, like TOKEN2049" />
        </Field>
        {typed.length >= 2 ? (
          <Card className="!gap-0 !py-1.5">
            {list.map((e, i) => (
              <div key={e.id}>
                {i > 0 ? <Divider /> : null}
                <EventOption event={e} onPick={() => onPick(e)} />
              </div>
            ))}
            {searching && !list.length ? <p className="py-2.5 text-center text-[12px] text-white/55">Looking…</p> : null}
            {notice ? (
              <p className="py-2 text-[12px] leading-4 text-white/55">Suggestions aren&rsquo;t loading right now. You can still create the event.</p>
            ) : results && !searching && !list.length ? (
              <p className="py-2 text-[12px] leading-4 text-white/55">No event by that name yet.</p>
            ) : null}
            {list.length ? <Divider /> : null}
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2.5 py-[11px] text-left hover:opacity-80">
              <Ion name="add-circle-outline" size={20} className="shrink-0 text-white" />
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-white">Create &ldquo;{typed}&rdquo;</span>
            </button>
          </Card>
        ) : null}
        {typed ? <p className="text-[12px] leading-4 text-white/55">Pick it, or create it, so brands looking at that event find you.</p> : null}
      </div>

      {!mustPick ? (
        <Field label="Or type its name" hint="Only if it is not in the list. It then shows on your page but not on an event page." htmlFor="event-name">
          <Text id="event-name" value={eventName} onChange={onName} maxLength={120} placeholder="Breakpoint London" />
        </Field>
      ) : null}
    </div>
  );
}

/** The app's EventOption: the event, "City, CC · dates · N spaces", a chevron. */
function EventOption({ event, onPick }: { event: EventSummary; onPick: () => void }) {
  const count = event.spaceCount;
  return (
    <button type="button" onClick={onPick} className="flex w-full min-w-0 items-center gap-3 py-[9px] text-left hover:opacity-80">
      <span aria-hidden className="h-9 w-9 shrink-0 rounded-[10px] bg-[linear-gradient(135deg,#5B7083,#2A3A48)]" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-extrabold text-white">{event.name}</span>
        <span className="truncate text-[12.5px] font-strong text-white/55">
          {[
            [event.city, event.country].filter(Boolean).join(", "),
            eventDatesText(event.startsOn, event.endsOn),
            typeof count === "number" ? `${count} ${count === 1 ? "space" : "spaces"}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <Ion name="chevron-forward" size={16} className="shrink-0 text-white/55" />
    </button>
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
      <Card>
        <p className="text-[15px] font-extrabold text-white">Is it one of these?</p>
        <p className="text-[13px] leading-[18px] text-white/[0.62]">Joining one puts your space on the same event page as everyone else going.</p>
        <div className="flex flex-col">
          {candidates.map((e, i) => (
            <div key={e.id}>
              {i > 0 ? <Divider /> : null}
              <EventOption event={e} onPick={() => onAdded(e)} />
            </div>
          ))}
        </div>
        {notice ? <Problems list={[notice]} /> : null}
        <button type="button" className={ctaPrimary} disabled={busy} onClick={() => void submit(true)}>
          {busy ? "Creating…" : "No, create mine"}
        </button>
        <button type="button" onClick={() => setCandidates(null)} className="self-center py-1 text-[13px] font-extrabold text-white hover:opacity-80">
          Edit the details
        </button>
      </Card>
    );
  }

  return (
    <Card className="!gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-[15px] font-extrabold text-white">New event</p>
        <button type="button" aria-label="Cancel" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-[16px] text-white/[0.62] hover:bg-white/10">
          <Ion name="close" size={20} />
        </button>
      </div>
      <p className="text-[13px] leading-[18px] text-white/[0.62]">It goes live as soon as you create it, and every creator going can join it.</p>
      <Field label="Name" htmlFor="new-event-name">
        <Text id="new-event-name" value={name} onChange={setName} maxLength={120} />
      </Field>
      <Field label="City" htmlFor="new-event-city">
        <Text id="new-event-city" value={city} onChange={setCity} maxLength={80} />
      </Field>
      <Field label="Country code (optional)" hint="Two letters, like SG." htmlFor="new-event-country">
        <Text id="new-event-country" value={country} onChange={setCountry} maxLength={2} />
      </Field>
      {/* Our own month, not the browser's white sheet. An event is never in the
          past, and two years out is a typo more often than a plan. */}
      <DayField label="Starts" value={startsOn} onChange={setStartsOn} min={today()} max={dayPlus(today(), 730)} />
      <DayField label="Ends" value={endsOn} onChange={setEndsOn} min={startsOn || today()} max={dayPlus(startsOn || today(), 31)} />
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>What kind of event</span>
        <ChipRow label="What kind of event">
          {EVENT_CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c] ?? c} selected={category === c} onClick={() => setCategory(c)} />
          ))}
        </ChipRow>
      </div>
      {notice ? <Problems list={[notice]} /> : null}
      <button type="button" className={ctaPrimary} disabled={busy} onClick={() => void submit(false)}>
        {busy ? "Creating…" : "Create event"}
      </button>
    </Card>
  );
}
