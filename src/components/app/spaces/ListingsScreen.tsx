"use client";

/**
 * Spaces › Listings: the app's "My spaces" (MySpacesList). What publishing
 * still needs sits on top (the app's X card), then "Create a space", then the
 * listings grouped Live, Drafts, Closed, Taken down, each a SpaceCard: title
 * and status tag, the event, what waits for review, the bar, the money and
 * the count, and when it closes.
 *
 * Web-only, kept: the kind filter (Spaces sell zones on a product, Services
 * sell the creator's own work) and `?status=` for the links that open one
 * group. On a wide screen the cards of a group sit side by side.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { SpaceCard as Listing, SpaceStatus } from "@/lib/creator/listing";
import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { useMayCreateSpace } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { ctaPrimary } from "../hold";
import { Ion } from "../ion";
import { CreateInTheAppCard } from "../main/GetTheApp";
import { useShell } from "../Shell";
import { StatusPill } from "./common";
import { useListingKind } from "./cards";
import { Card, centsText, Chip, ChipRow, dateTimeText, Empty, EventLine, ProgressBar, SectionLabel, Tag } from "./kit";
import { ReadyToPublish } from "./ReadyToPublish";

type StatusFilter = "all" | "live" | "draft" | "closed";
type KindFilter = "all" | "placement" | "service";

const STATUS_OPTIONS: { value: StatusFilter; label: MessageKey }[] = [
  { value: "all", label: "common.all" },
  { value: "live", label: "creator.status.live" },
  { value: "draft", label: "creator.listings.drafts" },
  { value: "closed", label: "creator.status.closed" },
];

const ORDER: SpaceStatus[] = ["live", "draft", "closed", "delisted"];
const GROUP_LABEL: Record<SpaceStatus, MessageKey> = {
  live: "creator.status.live",
  draft: "creator.listings.drafts",
  closed: "creator.status.closed",
  delisted: "creator.status.delisted",
};

const GRID = "grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2 2xl:grid-cols-3";

export function ListingsScreen() {
  const { role } = useShell();
  return role === "manager" ? <ManagedListings /> : <OwnListings />;
}

/**
 * "Create a space": the app's TravelCta with the add icon. Without the HOLD
 * app, Spaces is view only: "Create a space in the HOLD app" and the stores.
 */
function CreateCta() {
  const t = useT();
  const href = useHref();
  const mayCreate = useMayCreateSpace();
  if (mayCreate === undefined) return null;
  if (!mayCreate) {
    return (
      <div className="sm:max-w-[360px]">
        <CreateInTheAppCard />
      </div>
    );
  }
  return (
    <div className="sm:max-w-[360px]">
      <Link href={href("/listings/new")} className={ctaPrimary}>
        <Ion name="add" size={20} />
        {t("creator.listings.create")}
      </Link>
    </div>
  );
}

function OwnListings() {
  const t = useT();
  const { listings } = useShell();
  const mayCreate = useMayCreateSpace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kindOf = useListingKind();
  const [kind, setKind] = useState<KindFilter>("all");

  const status = (STATUS_OPTIONS.some((o) => o.value === params.get("status")) ? params.get("status") : "all") as StatusFilter;
  const setStatus = (v: StatusFilter) => router.replace(v === "all" ? pathname : `${pathname}?status=${v}`, { scroll: false });

  const byStatus = (l: Listing, s: StatusFilter) =>
    s === "all" || (s === "closed" ? l.status === "closed" || l.status === "delisted" : l.status === s);
  const shown = listings.filter((l) => byStatus(l, status) && (kind === "all" || kindOf(l) === kind));
  const groups = ORDER.map((st) => ({ st, rows: shown.filter((l) => l.status === st) })).filter((g) => g.rows.length > 0);
  const hasServices = listings.some((l) => kindOf(l) === "service");

  return (
    <div className="flex flex-col gap-3.5">
      {/* The publish checklist only for somebody who can publish here. */}
      {mayCreate ? <ReadyToPublish compact /> : null}

      <CreateCta />

      {listings.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ChipRow label={t("common.status")}>
            {STATUS_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={t(o.label)}
                selected={status === o.value}
                onClick={() => setStatus(o.value)}
                count={listings.filter((l) => byStatus(l, o.value)).length}
              />
            ))}
          </ChipRow>
          {hasServices ? (
            <ChipRow label={t("creator.offers.kind")}>
              <Chip label={t("creator.listings.allKinds")} selected={kind === "all"} onClick={() => setKind("all")} />
              <Chip label={t("creator.listings.kindSpaces")} selected={kind === "placement"} onClick={() => setKind("placement")} />
              <Chip label={t("creator.listings.kindServices")} selected={kind === "service"} onClick={() => setKind("service")} />
            </ChipRow>
          ) : null}
        </div>
      ) : null}

      {listings.length === 0 ? (
        <Empty
          icon="megaphone-outline"
          title={t("creator.listings.emptyTitle")}
          body={t("creator.listings.emptyBody")}
        />
      ) : groups.length === 0 ? (
        <Empty icon="funnel-outline" title={t("creator.listings.noMatch")} />
      ) : (
        groups.map((g) => (
          <section key={g.st} className="flex flex-col gap-2.5">
            <SectionLabel>{t(GROUP_LABEL[g.st])}</SectionLabel>
            <ul className={GRID}>
              {g.rows.map((l) => (
                <li key={l.id} className="flex">
                  <SpaceCard listing={l} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** The app's SpaceCard (MySpacesList), line for line. */
export function SpaceCard({ listing: l, href: to }: { listing: Listing; href?: string }) {
  const t = useT();
  const href = useHref();
  const { totals } = l;
  const takeover = l.pricingMode === "takeover";
  const meta = "text-[12.5px] font-strong text-white/55";
  return (
    <Card href={to ?? href(`/listings/${l.id}`)} className="w-full">
      <div className="flex items-center justify-between gap-2.5">
        <p className="line-clamp-2 min-w-0 flex-1 text-[16px] font-strong tracking-[-0.2px] text-white">{l.serviceName || l.title}</p>
        <StatusPill status={l.status} />
      </div>
      {l.event ? <EventLine event={l.event} /> : null}
      {l.awaitingReview ? <Tag label={t("creator.listings.toReview", { count: l.awaitingReview })} tone="caution" /> : null}
      {l.status !== "draft" ? (
        <>
          <ProgressBar value={totals.positions > 0 ? totals.sold / totals.positions : 0} />
          <div className="flex items-center justify-between gap-2.5">
            <p className="text-[15px] font-strong tabular-nums text-white">
              {takeover || (totals.totalCents == null && totals.committedCents > 0)
                ? t("creator.listings.soFar", { amount: centsText(totals.committedCents) })
                : totals.totalCents == null
                  ? t("creator.listings.noSales")
                  : t("creator.listings.amountOf", { amount: centsText(totals.committedCents), total: centsText(totals.totalCents) })}
            </p>
            <p className={meta}>{takeover
                ? t("creator.listings.taken", { sold: totals.sold, total: totals.positions })
                : t("creator.listings.sold", { sold: totals.sold, total: totals.positions })}</p>
          </div>
        </>
      ) : (
        <p className={meta}>
          {totals.totalCents == null
            ? t("creator.listings.spots", { count: totals.positions })
            : t("creator.listings.spotsWorth", { count: totals.positions, amount: centsText(totals.totalCents) })}
        </p>
      )}
      <div className="mt-auto flex items-center gap-1.5">
        <Ion name="time-outline" size={13} className="text-white/55" />
        <p className={meta}>
          {l.status === "live"
            ? t("creator.listings.closes", { when: dateTimeText(l.closesAt) })
            : l.status === "draft"
              ? t("creator.listings.continueEditing")
              : t("creator.listings.closedOn", { when: dateTimeText(l.closesAt) })}
        </p>
      </div>
    </Card>
  );
}

function ManagedListings() {
  const t = useT();
  const { managed } = useShell();
  const href = useHref();
  if (managed.length === 0) return <Empty icon="megaphone-outline" title={t("creator.listings.noneYet")} />;
  // A status the list does not know reads as closed: it is not selling.
  const statusOf = (m: (typeof managed)[number]): SpaceStatus => ((ORDER as string[]).includes(m.status) ? (m.status as SpaceStatus) : "closed");
  const groups = ORDER.map((st) => ({ st, rows: managed.filter((m) => statusOf(m) === st) })).filter((g) => g.rows.length > 0);
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((g) => (
        <section key={g.st} className="flex flex-col gap-2.5">
          <SectionLabel>{t(GROUP_LABEL[g.st])}</SectionLabel>
          <ul className={GRID}>
            {g.rows.map((m) => (
              <li key={m.spaceId} className="flex">
                <Card href={href(`/listings/${m.spaceId}`)} className="w-full">
                  <div className="flex items-center justify-between gap-2.5">
                    <p className="line-clamp-2 min-w-0 flex-1 text-[16px] font-strong tracking-[-0.2px] text-white">{m.title}</p>
                    <StatusPill status={m.status} />
                  </div>
                  {m.eventName ? <EventLine event={{ name: m.eventName, startsOn: m.eventStartsOn, endsOn: m.eventEndsOn }} /> : null}
                  {m.closesAt && m.status !== "draft" ? (
                    <div className="mt-auto flex items-center gap-1.5">
                      <Ion name="time-outline" size={13} className="text-white/55" />
                      <p className="text-[12.5px] font-strong text-white/55">
                        {m.status === "live"
                          ? t("creator.listings.closes", { when: dateTimeText(m.closesAt) })
                          : t("creator.listings.closedOn", { when: dateTimeText(m.closesAt) })}
                      </p>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
