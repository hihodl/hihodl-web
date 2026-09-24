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

import { ctaPrimary } from "@/components/app/hold";
import { Body, Card, h2, SectionLabel, Tag } from "@/components/app/spaces/kit";
import { calendarDate, deliverableNote, deliverableText, eventDates } from "@/lib/ad-space/format";
import { markDeliverableDelivered, markPositionDelivered, teamWork } from "@/lib/creator/listings";
import { describeRunError, describeTeamError } from "@/lib/creator/problems";
import type { WorkDeliverable, WorkListing, WorkSlot } from "@/lib/creator/team";
import type { MessageKey } from "@/lib/app/i18n";
import { Rich, useT } from "@/lib/app/i18n/react";

import { Text } from "../listing/parts";
import { Loading, Notice, Section } from "../parts";
import { ProductionSpot } from "../run/Production";

/** The app's SheetRow as a box: 14 radius, the card stroke, a 6% wash. */
const rowCls = "flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-[11px]";

const STATUS_LABEL: Record<string, MessageKey> = {
  draft: "creator.work.notLiveYet",
  live: "creator.status.live",
  closed: "creator.status.closed",
  delisted: "creator.status.delisted",
};

export function WorkList() {
  const t = useT();
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

  if (work === null) return <Loading what={t("creator.work.loadingWhat")} />;

  return (
    <>
      {work.length === 0 ? (
        <Section label={t("creator.work.nothingYet")} title={t("creator.listings.noneYet")}>
          <Body dim>{t("creator.work.appearHere")}</Body>
        </Section>
      ) : (
        work.map((w) => <WorkCard key={w.spaceId} listing={w} onChanged={() => void load()} />)
      )}
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

export function WorkCard({ listing, onChanged }: { listing: WorkListing; onChanged: () => void }) {
  const t = useT();
  const toDo =
    listing.slots.filter((s) => !s.deliveredUrl).length + listing.deliverables.filter((d) => !d.deliveredUrl).length;
  const canDeliver = listing.status === "live" || listing.status === "closed";

  return (
    <Card className="!gap-3.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className={`${h2} min-w-0 break-words`}>{listing.title}</h2>
          <Tag label={STATUS_LABEL[listing.status] ? t(STATUS_LABEL[listing.status]) : listing.status} tone={listing.status === "live" ? "good" : "calm"} />
        </div>
        <p className="text-[12.5px] font-strong text-white/[0.62]">
          {[
            listing.eventName ? listing.eventName : t("creator.work.noEvent"),
            listing.eventStartsOn && listing.eventEndsOn ? eventDates(listing.eventStartsOn, listing.eventEndsOn) : "",
            listing.deliverBy ? t("creator.work.deliveredBy", { date: calendarDate(listing.deliverBy) }) : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-[12px] leading-4 text-white/55">
          {t("creator.work.youAreOn", { role: listing.role, count: toDo })}
        </p>
      </div>

      {!canDeliver ? (
        <Body dim>{t("creator.work.notLiveYetDot")}</Body>
      ) : null}

      {listing.slots.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>{t("creator.work.spotsBought")}</SectionLabel>
          {listing.slots.map((s) => (
            s.production ? (
              <ProductionSpot key={s.id} positionId={s.id} production={s.production} canDeliver={canDeliver} onChanged={onChanged} />
            ) : (
              <SlotRow key={s.id} slot={s} canDeliver={canDeliver} onChanged={onChanged} />
            )
          ))}
        </div>
      ) : canDeliver ? (
        <Body dim>{t("creator.work.noSpotsSold")}</Body>
      ) : null}

      {listing.deliverables.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>{t("creator.work.promised")}</SectionLabel>
          {listing.deliverables.map((d) => (
            <DeliverableRow key={d.id} deliverable={d} canDeliver={canDeliver} onChanged={onChanged} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

const CONTENT_TEXT: Record<string, MessageKey> = {
  pending: "creator.work.artworkPending",
  approved: "creator.work.artworkApproved",
  rejected: "creator.work.artworkRejected",
};

export function SlotRow({ slot, canDeliver, onChanged }: { slot: WorkSlot; canDeliver: boolean; onChanged: () => void }) {
  const t = useT();
  return (
    <div className={rowCls}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[14.5px] font-bold text-white">{slot.label ?? slot.zoneKey ?? t("creator.work.aSpot")}</p>
          <p className="mt-0.5 text-[12.5px] text-white/55">{slot.sponsorName ? t("creator.work.forSponsor", { name: slot.sponsorName }) : t("creator.work.sold")}</p>
        </div>
        <Tag label={slot.deliveredUrl ? t("creator.work.delivered") : t("creator.work.toDeliver")} tone={slot.deliveredUrl ? "good" : "caution"} />
      </div>
      {slot.contentStatus && CONTENT_TEXT[slot.contentStatus] ? (
        <p className="text-[12px] leading-4 text-white/55">{t(CONTENT_TEXT[slot.contentStatus])}</p>
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
  const t = useT();
  return (
    <div className={rowCls}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[14.5px] font-bold text-white">{deliverableText(d)}</p>
          <p className="mt-0.5 break-words text-[12.5px] text-white/55">
            {d.dueDate ? t("creator.work.by", { date: calendarDate(d.dueDate) }) : t("creator.work.noDate")}
            {deliverableNote(d) ? ` · ${deliverableNote(d)}` : ""}
          </p>
        </div>
        <Tag label={d.deliveredUrl ? t("creator.work.delivered") : t("creator.work.toDeliver")} tone={d.deliveredUrl ? "good" : "caution"} />
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
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (delivered) {
    return (
      <p className="break-all text-[12px] leading-4 text-white/55">
        <Rich
          k={at ? "creator.work.deliveredOn" : "creator.work.deliveredLink"}
          vars={{ date: at ? calendarDate(at) : "", url: delivered }}
          tags={{ url: (c) => <span className="text-white">{c}</span> }}
        />
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
          className={`${ctaPrimary} sm:!h-12 sm:!w-auto`}
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
          {busy ? t("common.saving") : t("creator.work.markDelivered")}
        </button>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}
