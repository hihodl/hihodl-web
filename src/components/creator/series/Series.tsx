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

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnWhite as btnPrimary, btnWhite as btnSmall, btnGlassPill as btnSmallSecondary, cardBox as card, tagCls as pill } from "@/components/app/spaces/kit";
import { closesText } from "@/lib/ad-space/format";
import { spacesPath } from "@/lib/app/paths";
import { describeCreatorError } from "@/lib/creator/api";
import { LIMITS, type SeriesView, type SpaceView } from "@/lib/creator/listing";
import { getSeries, leaveSeries, publishListing } from "@/lib/creator/listings";
import { describeSeriesError, refusalSentence } from "@/lib/creator/problems";

import { Loading, Section } from "../parts";
import { PickEvents } from "./PickEvents";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

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

  return (
    <Section title="Events">
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
      ) : spaces.length === 0 ? (
        <div className="flex flex-col gap-5">
          <p className="text-[14.5px] text-white/[0.62]">{space.event?.name ?? space.eventName ?? "No event"}</p>
          <div>
            <button type="button" className={btnSmall} onClick={() => setPicking(true)}>
              Add events
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3">
            {spaces.map((s) => {
              const outcome = outcomes[s.id];
              const here = s.id === space.id;
              return (
                <li key={s.id} className={`${card} flex flex-col gap-3 p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15.5px] text-white">{s.event?.name ?? s.eventName ?? "No event"}</p>
                      <p className="mt-1 text-[12.5px] text-white/[0.62]">
                        {s.status === "draft" ? "Only you can see this" : closesText(s.closesAt, s.status === "closed")}
                        {" · "}
                        {s.totals.sold} of {s.totals.positions} sold
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {here ? <span className={pill.neutral}>This one</span> : null}
                      <span
                        className={
                          s.status === "live" ? pill.open : s.status === "draft" ? pill.attention : pill.neutral
                        }
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </div>
                  </div>

                  {outcome ? (
                    <p className={`text-[14.5px] ${outcome.live ? "text-[#2FBE8A]" : "text-amber"}`}>
                      {outcome.live ? "Published" : "Still a draft. "}
                      {outcome.message}
                    </p>
                  ) : null}

                  {!here ? (
                    <div>
                      <Link
                        href={spacesPath(s.status === "draft" ? `/listings/${s.id}/edit` : `/listings/${s.id}`)}
                        className={btnSmallSecondary}
                      >
                        {s.status === "draft" ? "Finish draft" : "Open"}
                      </Link>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {drafts.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[14.5px] text-white/[0.62]">
                {drafts.length === 1 ? "1 draft in this series." : `${drafts.length} drafts in this series.`}
              </p>
              <div>
                <button type="button" className={btnPrimary} disabled={publishing} onClick={() => void publishDrafts()}>
                  {publishing
                    ? "Publishing…"
                    : drafts.length === 1
                      ? "Publish the draft"
                      : `Publish the ${drafts.length} drafts`}
                </button>
              </div>
            </div>
          ) : null}

          {full ? (
            <p className="text-[14.5px] text-white/[0.62]">
              {LIMITS.SERIES_MAX} events maximum.
            </p>
          ) : (
            <div>
              <button type="button" className={btnSmall} onClick={() => setPicking(true)}>
                Add event
              </button>
            </div>
          )}

          {/*
            Asked twice, because it cannot be undone: a listing put back on its
            own is not re-joined later, it is only copied again. The listing
            itself is never touched, and the sentence says so before the click.
          */}
          {leaving ? (
            <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-5">
              <p className="text-[14.5px] text-white">Take this one out of the series? It keeps its link and spots.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={btnSmall} onClick={() => void leave()}>
                  Take it out
                </button>
                <button type="button" className={btnSmallSecondary} onClick={() => setLeaving(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-white/[0.62]">
              <button
                type="button"
                className="underline decoration-dotted underline-offset-4"
                onClick={() => setLeaving(true)}
              >
                Take this one out of the series
              </button>
            </p>
          )}
        </div>
      )}

      {notice ? (
        <p role="status" className="mt-5 rounded-[12px] bg-amber/[0.12] px-3 py-2.5 text-[13px] font-strong leading-[18px] text-amber">
          {notice}
        </p>
      ) : null}
    </Section>
  );
}
