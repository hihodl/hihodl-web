/**
 * What you have to deliver, for somebody on a creator's team.
 *
 * The one screen a rep needs: every listing they were put on, the spots that
 * were sold on it, the promises the listing made, and a box on each for the
 * link that proves it happened. The link is what the sponsor checks and what
 * the creator's public record is built from, so "It is up" is the whole job.
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

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { btnSmall, btnSmallSecondary, card, eyebrow, pill } from "@/components/ad-space/ui";
import { calendarDate, deliverableText, eventDates } from "@/lib/ad-space/format";
import { markDeliverableDelivered, markPositionDelivered, teamWork } from "@/lib/creator/listings";
import { describeRunError, describeTeamError } from "@/lib/creator/problems";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import type { WorkDeliverable, WorkListing, WorkSlot } from "@/lib/creator/team";

import { Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";
import { SignIn } from "../SignIn";
import { ROLE_TEXT } from "./Members";

const STATUS_LABEL: Record<string, string> = {
  draft: "Not live yet",
  live: "Live",
  closed: "Closed",
  delisted: "Taken down",
};

export function TeamWork() {
  const { session, configured } = useCreatorSession();

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-6 py-18">
      <header className="flex flex-col gap-3">
        <p className={`${eyebrow} text-text-faint`}>Working on a team</p>
        <h1 className="text-h3 font-light text-text">What you have to deliver</h1>
        <p className="text-lead font-light text-text-muted">
          Every listing you were put on, and what is still to do on each. When something is up, paste the link to it:
          that link is what the sponsor checks.
        </p>
      </header>

      {session === undefined ? (
        <p className="text-small text-text-muted">Checking whether you are signed in…</p>
      ) : session === null ? (
        <SignIn configured={configured} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-small text-text-muted">
            <span className="min-w-0 break-all">
              Signed in as <span className="text-text">{session.user.email}</span>
            </span>
            <button type="button" className={btnSmallSecondary} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
          <WorkList />
        </>
      )}

      <p className="text-tiny text-text-muted">
        <Link href="/creator/team" className="underline decoration-dotted underline-offset-4">
          Back to your team
        </Link>
      </p>
    </div>
  );
}

function WorkList() {
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
        <Section label="Nothing yet" title="No listings for you yet">
          <p className="text-body text-text-muted">
            Once a creator whose team you are on puts you on one of their listings, it shows up here with everything
            that has to be delivered on it.
          </p>
        </Section>
      ) : (
        work.map((w) => <WorkCard key={w.spaceId} listing={w} onChanged={() => void load()} />)
      )}
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

function WorkCard({ listing, onChanged }: { listing: WorkListing; onChanged: () => void }) {
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
        <p className="text-small text-text-muted">
          This listing is not live yet, so nothing has been sold and there is nothing to deliver.
        </p>
      ) : null}

      {listing.slots.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-body text-text">The spots sponsors bought</h3>
          {listing.slots.map((s) => (
            <SlotRow key={s.id} slot={s} canDeliver={canDeliver} onChanged={onChanged} />
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
  pending: "The sponsor sent their artwork and it is waiting for the creator to say yes. Nothing for you to do on that.",
  approved: "The sponsor’s artwork is approved.",
  rejected: "The creator asked the sponsor for different artwork. It has not come back yet.",
};

function SlotRow({ slot, canDeliver, onChanged }: { slot: WorkSlot; canDeliver: boolean; onChanged: () => void }) {
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

function DeliverableRow({
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
            {d.platform ? deliverableText(d.kind, d.platform, d.count) : `${d.count} × ${d.kind.replace(/_/g, " ")}`}
          </p>
          <p className="mt-1 break-words text-tiny text-text-muted">
            {d.dueDate ? `By ${calendarDate(d.dueDate)}` : "No date"}
            {d.note ? ` · ${d.note}` : ""}
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
          {busy ? "Saving…" : "It is up"}
        </button>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}
