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
 */

"use client";

import { useState } from "react";

import { btnPrimary, btnSecondary, btnSmallSecondary, card } from "@/components/ad-space/ui";
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
import { describeSeriesError } from "@/lib/creator/problems";

import { EventPicker } from "../listing/EventPicker";
import { Field, Problems, Text } from "../listing/parts";

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
  onDone,
  onRefused,
  onCancel,
}: {
  space: SpaceView;
  /** The events this listing already has a page at, its own included. */
  taken: readonly string[];
  /** How many listings the set holds right now, the original counted. */
  held: number;
  onDone: (series: SeriesView) => void;
  /** Re-read the set: a refused call may still have made the copies before it. */
  onRefused: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = isSessionTemplate(space.template);
  // A copy that was actually made is one the parent now knows about, so it
  // leaves this list on its own: what is left after a half-refused call is
  // exactly the ones that did not happen, next to the reason.
  const pending = rows.filter((r) => !taken.includes(r.event.id));
  const room = Math.max(0, LIMITS.SERIES_MAX - held - pending.length);
  const now = Date.now();
  const problemsByEvent = new Map(pending.map((r) => [r.event.id, closeProblems(r, session, now)]));
  const blocked = pending.length === 0 || [...problemsByEvent.values()].some((list) => list.length > 0);

  function add(event: EventSummary) {
    setNotice(null);
    if (taken.includes(event.id) || pending.some((r) => r.event.id === event.id)) {
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

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const { seriesId, spaces } = await addToSeries(
        space.id,
        pending.map((r) => ({ eventId: r.event.id, closesAt: instantOf(r.closesAt)! })),
      );
      onDone({ seriesId, spaces });
    } catch (e) {
      setNotice(describeSeriesError(e, space.template));
      // Copies are made one after another, so a call refused on the third has
      // already made the first two. The set is re-read rather than guessed at,
      // and the rows that did land drop out of this list by themselves.
      onRefused();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-text-muted">
        Pick the events. Each one becomes its own listing with everything this one has — the same ladder, the same
        wording, the same promises — and its own link. What it does not share is what is for sale: {space.totals.positions}{" "}
        {space.totals.positions === 1 ? "spot" : "spots"} here means {space.totals.positions} at each of them, not{" "}
        {space.totals.positions} between them.
      </p>

      <p className="text-small text-text">
        {held === 1
          ? "This listing is at one event so far."
          : `This listing already goes to ${held} events.`}{" "}
        {pending.length > 0
          ? `Adding ${pending.length} more makes ${held + pending.length} of ${LIMITS.SERIES_MAX}.`
          : `You can add ${room} more, up to ${LIMITS.SERIES_MAX} in all.`}
      </p>

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
        <p className="text-small text-text-muted">
          That is {LIMITS.SERIES_MAX}, which is as many as one listing goes to. Take one off the list to pick another.
        </p>
      )}

      {pending.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {pending.map((row) => (
            <li key={row.event.id} className={`${card} flex flex-col gap-4 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body text-text">{row.event.name}</p>
                  <p className="text-tiny text-text-muted">
                    {row.event.city} · {eventDates(row.event.startsOn, row.event.endsOn)}
                  </p>
                </div>
                <button
                  type="button"
                  className={btnSmallSecondary}
                  onClick={() => setRows((list) => list.filter((r) => r.event.id !== row.event.id))}
                >
                  Take it off
                </button>
              </div>
              <Field
                label="This one stops selling"
                hint="The day the event starts, unless you say otherwise. Every date you set on the original — the countdown, the day you deliver by — moves with it."
                problems={problemsByEvent.get(row.event.id) ?? []}
                htmlFor={`series-closes-${row.event.id}`}
              >
                <Text
                  id={`series-closes-${row.event.id}`}
                  type="datetime-local"
                  value={row.closesAt}
                  onChange={(closesAt) =>
                    setRows((list) => list.map((r) => (r.event.id === row.event.id ? { ...r, closesAt } : r)))
                  }
                />
              </Field>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
          {notice}
        </p>
      ) : null}

      <Problems list={pending.length === 0 ? ["Pick at least one event. Nothing is made until you do."] : []} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={blocked || busy} onClick={() => void submit()}>
          {busy
            ? "Making them…"
            : pending.length <= 1
              ? "Make the listing"
              : `Make the ${pending.length} listings`}
        </button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>

      <p className="text-tiny text-text-muted">
        They are made as drafts. Nobody can see one until it is published, and publishing happens one listing at a time —
        so you will be told which ones went live and which did not.
      </p>
    </div>
  );
}
