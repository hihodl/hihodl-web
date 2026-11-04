"use client";

/**
 * Spaces › Overview › Brands you work with › one brand.
 *
 * This brand's activity with THIS creator, and nothing else: what it bought,
 * when, for how much, on which listing and event, and what is still owed or
 * still to deliver. No other creator's numbers, no market median, no "brands
 * like this one" — a page about one relationship.
 *
 * It is assembled from reads the console already makes, because no endpoint
 * answers "one brand's history with me":
 *
 *   /ad-space/me/analytics   the relation itself (what reached you, orders,
 *                            events, since when, whether it came back)
 *   /sales                   each paid order, with its day, its spot and what
 *                            reached you
 *   the listings, whole      spots this brand holds: artwork to approve, a
 *                            spot still to deliver
 *   /offers/received         an offer accepted and not yet paid: still owed
 *
 * The only join available is the brand's NAME — sales and offers carry the
 * name the brand gave, not the analytics key — so `sameBrand` normalises it
 * (case, spaces, a leading @). A brand that paid under two spellings shows as
 * two brands, which is what the Overview already counts.
 */

import Link from "next/link";
import { useMemo } from "react";

import type { BrandRelation, CreatorAnalytics } from "@/lib/creator/analytics";
import { cents, ownerDeliveries, paidSales, type DeliveryItem } from "@/lib/app/spaces-model";
import { useListingViews, useOffers, useSales } from "@/lib/app/spaces-data";
import { listText } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { useShell } from "../Shell";
import { dollars, Skeleton } from "../ui";
import { DrillBar, useListingRefs } from "./cards";
import { dueText, shortDay } from "./common";
import { Card, Empty, Group as Panel, ListRow, Tag } from "./kit";
import { Logo } from "./OverviewScreens";

/** Rows on this screen before it would start to scroll: five bought, three each side under them. */
const SHOWN = 5;
const SHOWN_SMALL = 3;

/** A group's "see all": the app's link ink, as the Overview draws it. */
const seeAll = "text-[12.5px] font-strong normal-case tracking-normal text-white/[0.82] hover:text-white";

/** Two brand names are the same brand when they are the same word: case, spaces and a leading @ aside. */
function sameBrand(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = (s: string | null | undefined) => (s ?? "").trim().replace(/^@/, "").toLowerCase();
  const x = key(a);
  return x !== "" && x === key(b);
}

/** Every name this brand answers to on the reads that only carry a name. */
function namesOf(b: BrandRelation): string[] {
  return [b.name, b.handle].filter((s): s is string => !!s);
}

function isThem(b: BrandRelation, name: string | null | undefined): boolean {
  return namesOf(b).some((n) => sameBrand(n, name));
}

export function BrandScreen({ data, brandKey, back }: { data: CreatorAnalytics; brandKey: string; back: string }) {
  const t = useT();
  const brand = data.brands.find((b) => b.key === brandKey) ?? null;
  if (!brand) {
    return (
      <div className="flex flex-col gap-4">
        <DrillBar back={back} crumb={t("creator.brand.crumb")} title={t("creator.brand.title")} />
        <Empty icon="business-outline" title={t("creator.brand.notOnListTitle")} body={t("creator.brand.notOnListBody")} />
      </div>
    );
  }
  return <TheirActivity brand={brand} back={back} />;
}

function TheirActivity({ brand, back }: { brand: BrandRelation; back: string }) {
  const t = useT();
  const href = useHref();
  const { listings } = useShell();
  const refs = useListingRefs();
  const sales = useSales();
  const offers = useOffers();
  const running = useMemo(() => listings.filter((l) => l.status !== "draft").map((l) => l.id), [listings]);
  const views = useListingViews(running);

  /** What they bought: one line per paid order of theirs, newest first. */
  const bought = useMemo(
    () =>
      paidSales(sales.data)
        .filter((r) => isThem(brand, r.sponsorName))
        .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? "")),
    [sales.data, brand],
  );

  /** Still to deliver: their spots and their artwork, on the creator's own listings. */
  const owedToThem = useMemo(
    () =>
      ownerDeliveries(views.data ?? [])
        .filter((d) => d.state !== "done")
        .filter((d) => theirDelivery(d, brand)),
    [views.data, brand],
  );

  /** Still owed: an offer of theirs the creator accepted that has not been paid. */
  const owedByThem = useMemo(
    () => (offers.data ?? []).filter((o) => o.status === "accepted" && isThem(brand, o.sponsor.name)),
    [offers.data, brand],
  );

  const loadingSales = !sales.data && !sales.error;
  const loadingWork = !views.data && !views.error;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={t("creator.brand.crumb")} title={brand.name} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Card>
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo brand={brand} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{brand.name}</p>
              {brand.handle ? <p className="truncate text-[12.5px] font-strong text-white/[0.82]">@{brand.handle}</p> : null}
            </div>
            {brand.repeat ? <Tag label={t("creator.brand.repeat")} tone="good" /> : null}
          </div>
          <p className="text-[40px] font-strong leading-none tracking-[-0.8px] tabular-nums text-white">{dollars(brand.receivedCents)}</p>
          <p className="text-[14.5px] leading-5 text-white/[0.82]">
            {brand.firstPaidAt
              ? t("creator.brand.reachedYouSince", { orders: brand.orders, since: fmtDate(brand.firstPaidAt, { month: "short", year: "numeric", timeZone: "UTC" }) })
              : t("creator.brand.reachedYou", { orders: brand.orders })}
          </p>
          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-white/[0.08] pt-3 text-[12.5px] leading-[17px] text-white/[0.82]">
            <p className="truncate">{brand.events.length ? brand.events.map((e) => e.name).join(", ") : t("creator.cards.noEvent")}</p>
            <p className="truncate">
              {[t("creator.offers.countListings", { count: brand.listings }), listText(brand.chains.map((c) => c.label)), listText(brand.payFrom.map((p) => p.label))]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title={t("creator.brand.bought")}
            meta={loadingSales ? "" : t("creator.brand.countOrders", { count: bought.length })}
            action={
              bought.length > SHOWN ? (
                <Link href={href("/sales")} className={seeAll}>
                  {t("creator.brand.allSales")}
                </Link>
              ) : null
            }
          >
            {loadingSales ? (
              <Skeleton className="h-28" />
            ) : bought.length === 0 ? (
              <Empty icon="cash-outline" title={t("creator.brand.noOrdersTitle")} body={t("creator.brand.noOrdersBody")} />
            ) : (
              <ul className="flex flex-col divide-y divide-white/[0.08]">
                {bought.slice(0, SHOWN).map((r) => {
                  const ref = refs.get(r.spaceId);
                  const listing = r.serviceName || r.spaceTitle;
                  return (
                    <li key={r.orderId}>
                      <ListRow
                        href={`${href("/sales")}?listing=${encodeURIComponent(r.spaceId)}`}
                        title={listing}
                        meta={[r.zoneKey, ref?.event?.name ?? null, shortDay(r.paidAt)].filter(Boolean).join(" · ")}
                        right={<span className="text-[15px] font-strong tabular-nums text-[#2FBE8A]">{dollars(cents(r.receivedUsdc))}</span>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Panel title={t("creator.brand.toDeliver")} meta={loadingWork ? "" : `${owedToThem.length}`}>
              {loadingWork ? (
                <Skeleton className="h-20" />
              ) : owedToThem.length === 0 ? (
                <Empty icon="checkmark-done" title={t("creator.brand.nothingOwedTo")} />
              ) : (
                <ul className="flex flex-col divide-y divide-white/[0.08]">
                  {owedToThem.slice(0, SHOWN_SMALL).map((d) => (
                    <li key={d.id}>
                      <ListRow
                        href={`${href("/deliveries")}?item=${encodeURIComponent(d.id)}`}
                        title={d.title}
                        meta={d.listing}
                        right={d.due ? <Tag label={dueText(d.due)} tone={d.state === "overdue" ? "caution" : "calm"} /> : null}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t("creator.brand.stillOwed")} meta={offers.data ? `${owedByThem.length}` : ""}>
              {!offers.data ? (
                <Skeleton className="h-20" />
              ) : owedByThem.length === 0 ? (
                <Empty icon="checkmark-done" title={t("creator.brand.nothingToBePaid")} />
              ) : (
                <ul className="flex flex-col divide-y divide-white/[0.08]">
                  {owedByThem.slice(0, SHOWN_SMALL).map((o) => (
                    <li key={o.id}>
                      <ListRow
                        href={`${href("/offers")}?id=${o.id}`}
                        title={o.serviceName || o.spaceTitle}
                        meta={[o.positionLabel, t("creator.brand.acceptedUnpaid")].filter(Boolean).join(" · ")}
                        right={<span className="text-[15px] font-strong tabular-nums text-white">{dollars(cents(o.agreedUsdc ?? o.amountUsdc))}</span>}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A delivery is theirs when the spot they hold, or the artwork they sent, names them. */
function theirDelivery(d: DeliveryItem, brand: BrandRelation): boolean {
  const sponsor = d.owner?.position?.sponsor?.name ?? null;
  if (sponsor && isThem(brand, sponsor)) return true;
  // A promise belongs to the listing, not to one brand, so it is never theirs.
  return false;
}

/** Exported so the Overview can build the link without knowing the shape. */
export function brandParam(key: string): string {
  return `view=brand&brand=${encodeURIComponent(key)}`;
}
