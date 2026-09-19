/**
 * What you have to deliver, for somebody on a creator's team.
 *
 * The one screen a rep needs: every listing they were put on, the spots that
 * were sold on it, the promises the listing made, and a box on each for the
 * link that proves it happened. The link is what the sponsor checks and what
 * the creator's public record is built from, so "Mark delivered" is the whole job.
 *
 * NO MONEY, BY CONSTRUCTION
 *
 * `/team/work` never selects a price, an amount, a fee or an offer, and this
 * page has nothing it could print one from. That is deliberate and not only a
 * rep's rule: a manager lands here too, and reads the money where they are
 * allowed to — on the listing itself. Nothing below may add a figure fetched
 * from anywhere else.
 *
 * WHAT A REP CANNOT DO HERE
 *
 * Say yes or no to a sponsor's artwork: that is the creator's call, and a rep
 * who sees "waiting" should know it is waiting on the creator, not on them.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { btnSmall, card, pill } from "@/components/ad-space/ui";
import { calendarDate, deliverableNote, deliverableText, eventDates } from "@/lib/ad-space/format";
import { markDeliverableDelivered, markPositionDelivered, teamWork } from "@/lib/creator/listings";
import { describeRunError, describeTeamError } from "@/lib/creator/problems";
import type { WorkDeliverable, WorkListing, WorkSlot } from "@/lib/creator/team";

import { Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";
import { ProductionSpot } from "../run/Production";
import { ROLE_TEXT } from "./Members";

const STATUS_LABEL: Record<string, string> = {
  draft: "Not live yet",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

export function WorkList() {
  const [work, setWork] = useState<WorkListing[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { work: list } = await teamWork();
      setWork(list);
      setNotice(null);
    } catch (e) {
      setWork((w) => w ?? []);
      setNotice(describeTeamError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (work === null) return <Loading what="what you have to deliver" />;

  return (
    <>
      {work.length === 0 ? (
        <Section label="Nothing yet" title="No listings yet">
          <p className="text-small text-text-muted">Listings you’re put on appear here.</p>
        </Section>
      ) : (
        work.map((w) => <WorkCard key={w.spaceId} listing={w} onChanged={() => void load()} />)
      )}
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

export function WorkCard({ listing, onChanged }: { listing: WorkListing; onChanged: () => void }) {
  const toDo =
    listing.slots.filter((s) => !s.deliveredUrl).length + listing.deliverables.filter((d) => !d.deliveredUrl).length;
  const canDeliver = listing.status === "live" || listing.status === "closed";

  return (
    <section className={`${card} flex flex-col gap-5 p-6 sm:p-8`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-h4 font-light text-text">{listing.title}</h2>
          <span className={listing.status === "live" ? pill.open : pill.neutral}>
            {STATUS_LABEL[listing.status] ?? listing.status}
          </span>
        </div>
        <p className="text-small text-text-muted">
          {listing.eventName ? listing.eventName : "No event"}
          {listing.eventStartsOn && listing.eventEndsOn ? ` · ${eventDates(listing.eventStartsOn, listing.eventEndsOn)}` : ""}
          {listing.deliverBy ? ` · everything delivered by ${calendarDate(listing.deliverBy)}` : ""}
        </p>
        <p className="text-tiny text-text-muted">
          You are on this as: {ROLE_TEXT[listing.role].label.toLowerCase()} ·{" "}
          {toDo === 0 ? "nothing left to deliver" : `${toDo} still to deliver`}
        </p>
      </div>

      {!canDeliver ? (
        <p className="text-small text-text-muted">Not live yet.</p>
      ) : null}

      {listing.slots.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-body text-text">The spots sponsors bought</h3>
          {listing.slots.map((s) => (
            s.production ? (
              <ProductionSpot key={s.id} positionId={s.id} production={s.production} canDeliver={canDeliver} onChanged={onChanged} />
            ) : (
              <SlotRow key={s.id} slot={s} canDeliver={canDeliver} onChanged={onChanged} />
            )
          ))}
        </div>
      ) : canDeliver ? (
        <p className="text-small text-text-muted">No spots sold on this one yet.</p>
      ) : null}

      {listing.deliverables.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-body text-text">What the listing promised</h3>
          {listing.deliverables.map((d) => (
            <DeliverableRow key={d.id} deliverable={d} canDeliver={canDeliver} onChanged={onChanged} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const CONTENT_TEXT: Record<string, string> = {
  pending: "Artwork waiting on the creator’s approval.",
  approved: "Artwork approved.",
  rejected: "New artwork requested from the sponsor.",
};

export function SlotRow({ slot, canDeliver, onChanged }: { slot: WorkSlot; canDeliver: boolean; onChanged: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-input border border-[color:var(--color-hairline)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-small text-text">{slot.label ?? slot.zoneKey ?? "A spot"}</p>
          <p className="mt-1 text-tiny text-text-muted">{slot.sponsorName ? `For ${slot.sponsorName}` : "Sold"}</p>
        </div>
        <span className={slot.deliveredUrl ? pill.done : pill.attention}>
          {slot.deliveredUrl ? "Delivered" : "To deliver"}
        </span>
      </div>
      {slot.contentStatus && CONTENT_TEXT[slot.contentStatus] ? (
        <p className="text-tiny text-text-muted">{CONTENT_TEXT[slot.contentStatus]}</p>
      ) : null}
      <Delivered
        url={slot.deliveredUrl}
        at={slot.deliveredAt}
        canDeliver={canDeliver}
        send={(url) => markPositionDelivered(slot.id, url)}
        onChanged={onChanged}
      />
    </div>
  );
}

export function DeliverableRow({
  deliverable: d,
  canDeliver,
  onChanged,
}: {
  deliverable: WorkDeliverable;
  canDeliver: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-input border border-[color:var(--color-hairline)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-small text-text">
            {deliverableText(d)}
          </p>
          <p className="mt-1 break-words text-tiny text-text-muted">
            {d.dueDate ? `By ${calendarDate(d.dueDate)}` : "No date"}
            {deliverableNote(d) ? ` · ${deliverableNote(d)}` : ""}
          </p>
        </div>
        <span className={d.deliveredUrl ? pill.done : pill.attention}>{d.deliveredUrl ? "Delivered" : "To deliver"}</span>
      </div>
      <Delivered
        url={d.deliveredUrl}
        at={d.deliveredAt}
        canDeliver={canDeliver}
        send={(url) => markDeliverableDelivered(d.id, url)}
        onChanged={onChanged}
      />
    </div>
  );
}

/** The link that proves it, or the box to paste it in. */
function Delivered({
  url: delivered,
  at,
  canDeliver,
  send,
  onChanged,
}: {
  url: string | null;
  at: string | null;
  canDeliver: boolean;
  send: (url: string) => Promise<unknown>;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (delivered) {
    return (
      <p className="break-all text-tiny text-text-muted">
        {at ? `Delivered ${calendarDate(at)}: ` : "Delivered: "}
        <span className="text-text">{delivered}</span>
      </p>
    );
  }
  if (!canDeliver) return null;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Text type="url" value={url} onChange={setUrl} placeholder="https://x.com/you/status/…" />
        </div>
        <button
          type="button"
          className={btnSmall}
          disabled={busy || !url.trim()}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void send(url.trim())
              .then(() => {
                setUrl("");
                onChanged();
              })
              .catch((e) => setNotice(describeRunError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Saving…" : "Mark delivered"}
        </button>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}
