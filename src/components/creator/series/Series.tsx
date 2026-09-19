/**
 * The same listing at several events.
 *
 * WHAT THIS IS, AND WHAT IT IS CAREFUL NOT TO BE
 *
 * A creator doing the same thing at three conferences was typing the listing
 * three times: the same ladder, the same perks, the same wording, drifting
 * apart by the third. This builds it once and hands back three ORDINARY
 * listings, one per event — each with its own link, its own spots, its own
 * closing date and its own bidding clock.
 *
 * They are not one listing with three events on it, and nothing on this panel
 * is allowed to imply that they are. Six logo strips at Breakpoint are six at
 * Devconnect as well, not six between them: each listing sells its own
 * inventory, and a sponsor arriving for one event is buying that event. So the
 * listings are shown as a LIST of listings, each with its own status and its
 * own link, and never as one thing with several dates attached.
 *
 * WHY PUBLISHING IS A LOOP AND NOT A BUTTON THE SERVER OWNS
 *
 * Going live is a compare-and-swap with a dozen conditions on it — the event,
 * the chains, the window, the way it sells, the X account, and the row being
 * untouched since the gate read it. Doing three at once would mean repeating
 * every one of those across three rows in a transaction that can half-fail on a
 * network nobody controls. So the server makes DRAFTS and this publishes them
 * one at a time, saying what happened to each. A copy whose event was hidden in
 * the meantime is one draft left behind, said as that — never three claimed
 * live when two are.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { ctaSecondary, Notice } from "@/components/app/hold";
import { StatusPill } from "@/components/app/spaces/common";
import { btnWhite as btnSmall, btnGlassPill as btnSmallSecondary, Card, EventLine, SectionLabel, SheetRow } from "@/components/app/spaces/kit";
import { closesText } from "@/lib/ad-space/format";
import { spacesPath } from "@/lib/app/paths";
import { describeCreatorError } from "@/lib/creator/api";
import { LIMITS, type SeriesView, type SpaceView } from "@/lib/creator/listing";
import { getSeries, leaveSeries, publishListing } from "@/lib/creator/listings";
import { describeSeriesError, refusalSentence } from "@/lib/creator/problems";

import { Loading } from "../parts";
import { PickEvents } from "./PickEvents";

/** What happened to one listing the last time the drafts were published. */
interface Outcome {
  live: boolean;
  message: string;
}

export function ListingSeries({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const [series, setSeries] = useState<SeriesView | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  const load = useCallback(async () => {
    try {
      const { series: next } = await getSeries(space.id);
      setSeries(next);
      setNotice(null);
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setLoading(false);
    }
  }, [space.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // A listing that has been taken down cannot be copied from, and offering it
  // would only be a button that answers no.
  if (space.status === "delisted") return null;

  const spaces = series?.spaces ?? [];
  const held = Math.max(1, spaces.length);
  const taken = [space.event?.id, ...spaces.map((s) => s.event?.id)].filter((id): id is string => !!id);
  const drafts = spaces.filter((s) => s.status === "draft");
  const full = held >= LIMITS.SERIES_MAX;

  /**
   * Each draft in turn, and what happened to each.
   *
   * One at a time on purpose: publishing is one listing's gate and nothing
   * here pretends otherwise. The set is re-read afterwards so the statuses and
   * the links on screen are the server's answer, not this loop's guess.
   */
  async function publishDrafts() {
    setPublishing(true);
    setNotice(null);
    const out: Record<string, Outcome> = {};
    for (const draft of drafts) {
      try {
        await publishListing(draft.id);
        out[draft.id] = { live: true, message: "" };
      } catch (e) {
        out[draft.id] = { live: false, message: refusalSentence(e, draft.template) };
      }
    }
    await load();
    setOutcomes(out);
    setPublishing(false);
    // The listing this page is about may itself have gone live just now.
    onChanged();
  }

  async function leave() {
    setNotice(null);
    try {
      await leaveSeries(space.id);
      setOutcomes({});
      setLeaving(false);
      await load();
    } catch (e) {
      setNotice(describeSeriesError(e, space.template));
    }
  }

  const live = spaces.filter((s) => s.status === "live").length;

  return (
    <section className="flex flex-col gap-2.5">
      {loading ? (
        <Loading what="your other events" />
      ) : picking ? (
        <PickEvents
          space={space}
          taken={taken}
          held={held}
          // Handed up the moment anything lands, whether or not all of it did:
          // a copy that was made is part of the set from that instant, and the
          // picker stays open only for the events that were refused.
          onSeries={(next) => {
            setSeries(next);
            setOutcomes({});
          }}
          onFinished={() => setPicking(false)}
          onCancel={() => setPicking(false)}
        />
      ) : spaces.length < 2 ? (
        // The app's SeriesPanel with no series yet: the invitation.
        <>
          <SectionLabel>More events</SectionLabel>
          <SheetRow
            icon="calendar-outline"
            title="Take this listing to other events"
            meta="One listing per event, each with its own link and its own spots."
            onClick={() => setPicking(true)}
          />
        </>
      ) : (
        <>
          <SectionLabel>{`This listing is at ${spaces.length} events`}</SectionLabel>
          <p className="text-[12px] leading-[17px] text-white/55">
            One listing per event, each with its own link, its own spots and its own close. What sells at one doesn&apos;t come out of another.
          </p>
          {Object.keys(outcomes).length ? (
            <Notice tone={drafts.length ? "caution" : "good"}>
              {drafts.length === 0
                ? `All ${spaces.length} are live, each with its own link.`
                : `${live} of ${spaces.length} are live. The rest are still drafts — each says why.`}
            </Notice>
          ) : null}

          {spaces.map((s) => {
            const outcome = outcomes[s.id];
            const here = s.id === space.id;
            // The app's SeriesRow: the event and its status tag, the event line, which one this is, why it is still a draft.
            const body = (
              <>
                <div className="flex items-center justify-between gap-2.5">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-strong tracking-[-0.2px] text-white">{s.event?.name ?? s.eventName ?? s.title}</p>
                  <StatusPill status={s.status} />
                </div>
                {s.event ? <EventLine event={s.event} /> : null}
                <p className="text-[12.5px] leading-[17px] text-white/55">
                  {here ? "The one you're looking at" : s.status === "draft" ? "Continue editing" : closesText(s.closesAt, s.status === "closed")}
                  {` · ${s.totals.sold} of ${s.totals.positions} sold`}
                </p>
                {outcome && !outcome.live ? <p className="text-[12.5px] leading-[17px] text-amber">Still a draft: {outcome.message}</p> : null}
              </>
            );
            return here ? (
              <Card key={s.id}>{body}</Card>
            ) : (
              <Card key={s.id} href={spacesPath(s.status === "draft" ? `/listings/${s.id}/edit` : `/listings/${s.id}`)}>
                {body}
              </Card>
            );
          })}

          {drafts.length > 0 ? (
            <button type="button" className={ctaSecondary} disabled={publishing} onClick={() => void publishDrafts()}>
              {publishing ? "Publishing…" : drafts.length === 1 ? "Publish the draft" : `Publish the ${drafts.length} drafts`}
            </button>
          ) : null}

          {full ? null : (
            <SheetRow
              icon="add-circle-outline"
              title="Another event"
              meta={`Room for ${Math.max(0, LIMITS.SERIES_MAX - held)} more`}
              onClick={() => setPicking(true)}
            />
          )}

          {/*
            Asked twice, because it cannot be undone: a listing put back on its
            own is not re-joined later, it is only copied again. The listing
            itself is never touched, and the sentence says so before the click.
          */}
          {leaving ? (
            <Card>
              <p className="text-[14.5px] leading-5 text-white">Take this one out of the series? It keeps its link and spots.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSmall} onClick={() => void leave()}>
                  Take it out
                </button>
                <button type="button" className={btnSmallSecondary} onClick={() => setLeaving(false)}>
                  Cancel
                </button>
              </div>
            </Card>
          ) : (
            <button type="button" className="self-center py-1 text-[13px] font-strong text-white/[0.62] hover:text-white" onClick={() => setLeaving(true)}>
              Take this one out of the series
            </button>
          )}
        </>
      )}

      {notice ? <Notice>{notice}</Notice> : null}
    </section>
  );
}
