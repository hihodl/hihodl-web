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
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import { EVENT_CATEGORIES, type EventSummary } from "@/lib/creator/listing";
import { createEvent, searchEvents } from "@/lib/creator/listings";

import { Field, Problems, Text } from "./parts";
import { DayField, dayPlus, today } from "./WhenField";

const CATEGORY_LABEL: Record<string, MessageKey> = {
  crypto: "listings.eventPicker.category.crypto",
  fintech: "listings.eventPicker.category.fintech",
  ai: "listings.eventPicker.category.ai",
  tech: "listings.eventPicker.category.tech",
  robotics: "listings.eventPicker.category.robotics",
  science: "listings.eventPicker.category.science",
  motorsport: "listings.eventPicker.category.motorsport",
  sports: "listings.eventPicker.category.sports",
  travel: "listings.eventPicker.category.travel",
  culture: "listings.eventPicker.category.culture",
  other: "listings.eventPicker.category.other",
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
  const t = useT();
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
    const timer = setTimeout(() => void run(query), 250);
    return () => clearTimeout(timer);
  }, [query, run]);

  // Whether there is an event at all is the question before this one, so this
  // field is never the place that says "optional".
  const label = t("listings.eventPicker.label");
  const typed = query.trim();

  if (eventId && picked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{label}</span>
        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-extrabold text-white">{picked.name}</span>
            <button type="button" onClick={() => onPick(null)} className="shrink-0 text-[13px] font-extrabold text-white hover:opacity-80">
              {t("listings.eventPicker.change")}
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
          <Text id="event-search" value={query} onChange={setQuery} placeholder={t("listings.eventPicker.searchPlaceholder")} />
        </Field>
        {typed.length >= 2 ? (
          <Card className="!gap-0 !py-1.5">
            {list.map((e, i) => (
              <div key={e.id}>
                {i > 0 ? <Divider /> : null}
                <EventOption event={e} onPick={() => onPick(e)} />
              </div>
            ))}
            {searching && !list.length ? <p className="py-2.5 text-center text-[12px] text-white/55">{t("listings.eventPicker.looking")}</p> : null}
            {notice ? (
              <p className="py-2 text-[12px] leading-4 text-white/55">{t("listings.eventPicker.suggestionsDown")}</p>
            ) : results && !searching && !list.length ? (
              <p className="py-2 text-[12px] leading-4 text-white/55">{t("listings.eventPicker.noneByName")}</p>
            ) : null}
            {list.length ? <Divider /> : null}
            <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2.5 py-[11px] text-left hover:opacity-80">
              <Ion name="add-circle-outline" size={20} className="shrink-0 text-white" />
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-white">{t("listings.eventPicker.create", { name: typed })}</span>
            </button>
          </Card>
        ) : null}
        {typed ? <p className="text-[12px] leading-4 text-white/55">{t("listings.eventPicker.pickOrCreate")}</p> : null}
      </div>

      {!mustPick ? (
        <Field label={t("listings.eventPicker.orType")} hint={t("listings.eventPicker.orTypeHint")} htmlFor="event-name">
          <Text id="event-name" value={eventName} onChange={onName} maxLength={120} placeholder={t("listings.eventPicker.namePlaceholder")} />
        </Field>
      ) : null}
    </div>
  );
}

/** The app's EventOption: the event, "City, CC · dates · N spaces", a chevron. */
function EventOption({ event, onPick }: { event: EventSummary; onPick: () => void }) {
  const t = useT();
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
            typeof count === "number" ? t("listings.eventPicker.spaceCount", { count }) : null,
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
  const t = useT();
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
        setNotice(t("listings.eventPicker.datesInvalid"));
      } else if (e instanceof CreatorApiError && e.code === "event_in_the_past") {
        setNotice(t("listings.eventPicker.inThePast"));
      } else if (e instanceof CreatorApiError && e.code === "event_too_far") {
        setNotice(t("listings.eventPicker.tooFar"));
      } else if (e instanceof CreatorApiError && e.code === "country_invalid") {
        setNotice(t("listings.plain.countryInvalid"));
      } else if (e instanceof CreatorApiError && e.code === "rate_limited") {
        setNotice(t("listings.eventPicker.rateLimited"));
      } else if (
        e instanceof CreatorApiError &&
        (e.code === "x_not_linked" || e.code === "x_not_verified" || e.code === "x_account_too_new")
      ) {
        setNotice(t("listings.eventPicker.needsX"));
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
        <p className="text-[15px] font-extrabold text-white">{t("listings.eventPicker.isItOne")}</p>
        <p className="text-[13px] leading-[18px] text-white/[0.62]">{t("listings.eventPicker.joiningOne")}</p>
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
          {busy ? t("listings.eventPicker.creating") : t("listings.eventPicker.createMine")}
        </button>
        <button type="button" onClick={() => setCandidates(null)} className="self-center py-1 text-[13px] font-extrabold text-white hover:opacity-80">
          {t("listings.eventPicker.editDetails")}
        </button>
      </Card>
    );
  }

  return (
    <Card className="!gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-[15px] font-extrabold text-white">{t("listings.eventPicker.newEvent")}</p>
        <button type="button" aria-label={t("common.cancel")} onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-[16px] text-white/[0.62] hover:bg-white/10">
          <Ion name="close" size={20} />
        </button>
      </div>
      <p className="text-[13px] leading-[18px] text-white/[0.62]">{t("listings.eventPicker.goesLive")}</p>
      <Field label={t("listings.name.name")} htmlFor="new-event-name">
        <Text id="new-event-name" value={name} onChange={setName} maxLength={120} />
      </Field>
      <Field label={t("listings.eventPicker.city")} htmlFor="new-event-city">
        <Text id="new-event-city" value={city} onChange={setCity} maxLength={80} />
      </Field>
      <Field label={t("listings.eventPicker.country")} hint={t("listings.eventPicker.countryHint")} htmlFor="new-event-country">
        <Text id="new-event-country" value={country} onChange={setCountry} maxLength={2} />
      </Field>
      {/* Our own month, not the browser's white sheet. An event is never in the
          past, and two years out is a typo more often than a plan. */}
      <DayField label={t("listings.eventPicker.starts")} value={startsOn} onChange={setStartsOn} min={today()} max={dayPlus(today(), 730)} />
      <DayField label={t("listings.eventPicker.ends")} value={endsOn} onChange={setEndsOn} min={startsOn || today()} max={dayPlus(startsOn || today(), 31)} />
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t("listings.event.whatKind")}</span>
        <ChipRow label={t("listings.event.whatKind")}>
          {EVENT_CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c] ? t(CATEGORY_LABEL[c]) : c} selected={category === c} onClick={() => setCategory(c)} />
          ))}
        </ChipRow>
      </div>
      {notice ? <Problems list={[notice]} /> : null}
      <button type="button" className={ctaPrimary} disabled={busy} onClick={() => void submit(false)}>
        {busy ? t("listings.eventPicker.creating") : t("listings.eventPicker.createEvent")}
      </button>
    </Card>
  );
}
