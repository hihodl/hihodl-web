/**
 * Choosing the other events this listing goes to.
 *
 * WHAT COMES OUT OF THIS SCREEN
 *
 * Not one listing with three events on it. Three ordinary listings, one per
 * event, each with its own link, its own spots, its own closing date and its
 * own bidding clock. That distinction is the whole design and it is said on
 * screen, because a creator who thinks the six logo strips are shared between
 * three conferences has sold five of them twice.
 *
 * WHY EVERY ROW CARRIES ITS OWN CLOSING DATE
 *
 * Because the events are on different days — which is the only reason anybody
 * wants this. One closing date shared by three listings is in the past for the
 * conference that already happened and three months early for the one in
 * spring. So each row gets its own, defaulted to the day that event starts at
 * the same time of day the original closes, and shown as an ordinary editable
 * box rather than hidden behind a "sensible default" nobody was told about.
 *
 * WHY THE SEARCH IS THE ONE FROM THE WIZARD
 *
 * It is the same act: find the event other creators have already added, or add
 * it once for everybody. A second event picker would be a second set of rules
 * about what an event is, and the two would drift.
 *
 * WHY ONE EVENT BEING REFUSED LEAVES THE OTHERS ALONE
 *
 * Because the server answers per event: `created` holds the listings it made
 * and `refused` names the events it could not, each with its own reason, and
 * both arrive together in a 2xx. A creator taking their listing to three
 * conferences wants the two that worked, so the two that worked leave this
 * screen and join the set, and the third stays here with its reason under it,
 * ready to be fixed or taken off. Nothing about that reads as the whole thing
 * having failed, because it has not.
 */

"use client";

import { useState } from "react";

import { btnWhite as btnPrimary, btnGlassPill as btnSecondary, btnGlassPill as btnSmallSecondary, cardBox as card } from "@/components/app/spaces/kit";
import { eventDates } from "@/lib/ad-space/format";
import {
  LIMITS,
  instantOf,
  isSessionTemplate,
  localValueOf,
  type EventSummary,
  type SeriesView,
  type SpaceView,
} from "@/lib/creator/listing";
import { addToSeries } from "@/lib/creator/listings";
import { describeSeriesError, seriesRefusalError } from "@/lib/creator/problems";

import { EventPicker } from "../listing/EventPicker";
import { Problems } from "../listing/parts";
import { DayTimeField, dayPlus, today } from "../listing/WhenField";

const HOUR = 3_600_000;
const DAY = 86_400_000;

interface Row {
  event: EventSummary;
  /** A `datetime-local` value, in the creator's own clock. */
  closesAt: string;
}

/**
 * When a copy at this event stops selling, before anybody edits it.
 *
 * The day the event starts, at the same time of day the original closes. The
 * day is the part that matters and the part the creator cannot be expected to
 * work out for five conferences; the time of day is theirs already, so it is
 * carried across rather than invented.
 */
function defaultCloseFor(event: EventSummary, sourceClosesAt: string): string {
  const [y, m, d] = event.startsOn.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const source = new Date(sourceClosesAt);
  const ok = Number.isFinite(source.getTime());
  const when = new Date(y, m - 1, d, ok ? source.getHours() : 9, ok ? source.getMinutes() : 0, 0, 0);
  return localValueOf(when.toISOString());
}

/**
 * What is wrong with one closing date, checked here so the creator is not told
 * about it three copies into a call that half-succeeded. The server checks all
 * of it again and its answer wins.
 */
function closeProblems(row: Row, session: boolean, now: number): string[] {
  const iso = instantOf(row.closesAt);
  if (!iso) return ["Say the day this one stops selling."];
  const at = Date.parse(iso);
  const out: string[] = [];
  if (at - now < LIMITS.MIN_CAMPAIGN_HOURS * HOUR) {
    out.push(
      `A listing runs for at least ${LIMITS.MIN_CAMPAIGN_HOURS} hours, and this one would be over before then. Give it a later day, or leave this event out.`,
    );
  } else if (at - now > LIMITS.MAX_CAMPAIGN_DAYS * DAY) {
    out.push(
      `A listing runs for at most ${LIMITS.MAX_CAMPAIGN_DAYS} days. This event is further off than that, so come back to it nearer the time.`,
    );
  }
  if (session) {
    // A session is delivered by the day after the event ends, and selling time
    // after that is selling time that no longer exists.
    const lastDay = Date.parse(`${row.event.endsOn.slice(0, 10)}T00:00:00Z`);
    if (Number.isFinite(lastDay) && at > lastDay + 2 * DAY) {
      out.push("Time in person cannot be sold once the event is over. Close this one by the day after it ends.");
    }
  }
  return out;
}

export function PickEvents({
  space,
  taken,
  held,
  onSeries,
  onFinished,
  onCancel,
}: {
  space: SpaceView;
  /** The events this listing already has a page at, its own included. */
  taken: readonly string[];
  /** How many listings the set holds right now, the original counted. */
  held: number;
  /** The set as it now stands. Handed up as soon as any copy is made. */
  onSeries: (series: SeriesView) => void;
  /** Every event asked for is now a listing: there is nothing left on screen. */
  onFinished: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  /** Why one event did not become a listing, kept beside that event's row. */
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  /** How many this screen has set up so far, so a partial result says so out loud. */
  const [made, setMade] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = isSessionTemplate(space.template);
  const room = Math.max(0, LIMITS.SERIES_MAX - held - rows.length);
  const now = Date.now();
  const problemsByEvent = new Map(rows.map((r) => [r.event.id, closeProblems(r, session, now)]));
  const blocked = rows.length === 0 || [...problemsByEvent.values()].some((list) => list.length > 0);

  function add(event: EventSummary) {
    setNotice(null);
    if (taken.includes(event.id) || rows.some((r) => r.event.id === event.id)) {
      setNotice(
        `This listing already goes to ${event.name}. Two pages at the same event only take sponsors off each other.`,
      );
      return;
    }
    if (room === 0) {
      setNotice(`${LIMITS.SERIES_MAX} listings is as far as one of these goes, counting the one you are on.`);
      return;
    }
    setRows((list) => [...list, { event, closesAt: defaultCloseFor(event, space.closesAt) }]);
  }

  function drop(eventId: string) {
    setRows((list) => list.filter((r) => r.event.id !== eventId));
    setRefusals(({ [eventId]: _gone, ...rest }) => rest);
  }

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const { seriesId, created, refused, spaces } = await addToSeries(
        space.id,
        rows.map((r) => ({ eventId: r.event.id, closesAt: instantOf(r.closesAt)! })),
      );
      // The set has grown by whatever landed, whether or not everything did.
      onSeries({ seriesId, spaces });
      if (refused.length === 0) {
        onFinished();
        return;
      }
      // The events that were made are listings now and have no business still
      // being on a form. The ones that were not stay exactly where they were,
      // each under its own reason, editable and re-sendable.
      const byEvent = new Map(refused.map((r) => [r.eventId, r]));
      setRows((list) => list.filter((r) => byEvent.has(r.event.id)));
      setRefusals(
        Object.fromEntries(
          refused.map((r) => [r.eventId, describeSeriesError(seriesRefusalError(r), space.template)]),
        ),
      );
      // Added up rather than replaced: a creator who fixes one date and sends
      // again has three set up, not the one this second call happened to make.
      setMade((n) => n + created.length);
    } catch (e) {
      // Thrown refusals are about the source listing, not one event, and none
      // of them writes anything — so the list on screen is still the truth.
      setNotice(describeSeriesError(e, space.template));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[15.5px] text-white/[0.62]">
        Pick the events. Each one becomes its own listing with everything this one has — the same ladder, the same
        wording, the same promises — and its own link. What it does not share is what is for sale: {space.totals.positions}{" "}
        {space.totals.positions === 1 ? "spot" : "spots"} here means {space.totals.positions} at each of them, not{" "}
        {space.totals.positions} between them.
      </p>

      <p className="text-[14.5px] text-white">
        {held === 1 ? "This listing is at one event so far." : `This listing already goes to ${held} events.`}{" "}
        {rows.length > 0
          ? `Adding ${rows.length} more makes ${held + rows.length} of ${LIMITS.SERIES_MAX}.`
          : `You can add ${room} more, up to ${LIMITS.SERIES_MAX} in all.`}
      </p>

      {/*
        A partial result, said as what it is. The listings that were made are
        already with the others behind this screen; what is left here is the
        one that was not, and it says why under its own row.
      */}
      {made > 0 ? (
        <p role="status" className="text-[14.5px] text-[#2FBE8A]">
          {made === 1 ? "One listing is set up" : `${made} listings are set up`} and waiting with the others.{" "}
          {rows.length === 1
            ? "This one is not, and the reason is under it."
            : "These are not, and each says why under it."}
        </p>
      ) : null}

      {room > 0 ? (
        <EventPicker
          eventId={null}
          eventName=""
          picked={null}
          onPick={(event) => {
            if (event) add(event);
          }}
          onName={() => {}}
          problems={[]}
          mustPick
        />
      ) : (
        <p className="text-[14.5px] text-white/[0.62]">
          That is {LIMITS.SERIES_MAX}, which is as many as one listing goes to. Take one off the list to pick another.
        </p>
      )}

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.event.id} className={`${card} flex flex-col gap-4 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15.5px] text-white">{row.event.name}</p>
                  <p className="text-[12.5px] text-white/[0.62]">
                    {row.event.city} · {eventDates(row.event.startsOn, row.event.endsOn)}
                  </p>
                </div>
                <button type="button" className={btnSmallSecondary} onClick={() => drop(row.event.id)}>
                  Take it off
                </button>
              </div>
              {refusals[row.event.id] ? (
                <p className="text-[14.5px] text-amber">{refusals[row.event.id]}</p>
              ) : null}
              <DayTimeField
                label="This one stops selling"
                hint="The day the event starts, unless you say otherwise. Every other date moves with it."
                problems={problemsByEvent.get(row.event.id) ?? []}
                value={row.closesAt}
                min={dayPlus(today(), 1)}
                max={dayPlus(today(), LIMITS.MAX_CAMPAIGN_DAYS)}
                onChange={(closesAt) => setRows((list) => list.map((r) => (r.event.id === row.event.id ? { ...r, closesAt } : r)))}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-[12px] bg-amber/[0.12] px-3 py-2.5 text-[13px] font-strong leading-[18px] text-amber">
          {notice}
        </p>
      ) : null}

      <Problems list={rows.length === 0 ? ["Pick at least one event. Nothing is made until you do."] : []} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={blocked || busy} onClick={() => void submit()}>
          {busy ? "Making them…" : rows.length <= 1 ? "Make the listing" : `Make the ${rows.length} listings`}
        </button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>
          {made > 0 ? "Done" : "Cancel"}
        </button>
      </div>

      <p className="text-[12.5px] text-white/[0.62]">
        Each one is made on its own, so an event that cannot take this listing costs you that event and nothing else.
        They are made as drafts: nobody can see one until it is published, and publishing happens one listing at a time.
      </p>
    </div>
  );
}
