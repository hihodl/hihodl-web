"use client";

/**
 * Spaces › Overview's own screens: the creator's business, each opened from
 * its card on the Overview hub, each with Back. One big number on the left,
 * the detail on the right, nothing that scrolls for long.
 *
 *   ?view=brands     Brands you work with: one card per brand
 *   ?view=brand      One brand alone (./BrandScreen)
 *   ?view=events     By event: what each event made
 *   ?view=sells      What sells for you: % sold and days to sell, per product, kind, listing
 *   ?view=pay        How brands pay: network, HOLD account or wallet, and the deal
 *   ?view=inspired   Listings other creators credit you for
 *
 * Built from GET /ad-space/me/analytics (lib/creator/analytics.ts): this
 * creator's own paid orders, nothing about anybody else.
 *
 * NO WRITTEN-OUT OBSERVATIONS
 *
 * These screens used to carry a lightbulb note under the big number —
 * "Carry-on suitcase sells best: 75% of its spots", "3 brands came back for a
 * second event". A sentence that only restates the figure next to it is
 * filler, and it pushed every screen past one screenful. The figures say it.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { feePctText } from "@/lib/ad-space/fee";
import { eventDates } from "@/lib/ad-space/format";
import type { BrandRelation, CreatorAnalytics, GroupRow, ListingRow, MixRow } from "@/lib/creator/analytics";
import { t as tr } from "@/lib/app/i18n";
import { fmtDate, fmtPercent } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";
import { useMayCreateSpace } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { dollars } from "../ui";
import { CardGrid, DrillBar, EventBadge, Pager, usePaged, useEventCountry } from "./cards";
import { Card, Empty as KitEmpty, Group as Panel, Pills as FilterPills, ProgressBar as Bar, Tag as KitTag } from "./kit";

/** The shared bar takes a fraction; these screens think in value and max. */
function ProgressBar({ value, max }: { value: number; max: number }) {
  return <Bar value={max > 0 ? value / max : 0} />;
}

export type OverviewView = "brands" | "brand" | "events" | "sells" | "pay" | "inspired" | "needs";

const VIEWS: readonly OverviewView[] = ["brands", "brand", "events", "sells", "pay", "inspired", "needs"];

export function isOverviewView(v: string | null | undefined): v is OverviewView {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}

/* ── Words and numbers ────────────────────────────────────────────── */

/** A percent given as 0–100: whole when it is whole, else one decimal. */
export const pctText = (n: number) => fmtPercent(n / 100, Number.isInteger(n) ? 0 : 1);
export function daysText(n: number): string {
  const v = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  if (v === 0) return tr("spaces.days.sameDay");
  return tr("spaces.days.count", { count: v });
}
export const monthYear = (iso: string | null) => (iso ? fmtDate(iso, { month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** "Brands paid our 5% on top" when they did on every sale, else what came out of your price. */
export function feeLine(t: CreatorAnalytics["totals"]): string {
  if (t.orders === 0) return tr("spaces.fee.brandsPayOnTop", { pct: feePctText() });
  if (t.fee.paidByYouCents === 0) return tr("spaces.fee.brandsPaidKept", { pct: feePctText(), all: pctText(100) });
  if (t.fee.paidByBrandsCents === 0) return tr("spaces.fee.cameOutOfPrice", { amount: dollars(t.fee.paidByYouCents) });
  return tr("spaces.fee.brandsPaidOnTop", { amount: dollars(t.fee.paidByBrandsCents) });
}

/* ── Pieces ───────────────────────────────────────────────────────── */

function Screen({
  back,
  title,
  big,
  bigNote,
  extra,
  children,
}: {
  back: string;
  title: string;
  big: ReactNode;
  bigNote: ReactNode;
  /** Under the big number: a short ranked list that belongs with it. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={t("spaces.overview.crumb")} title={title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Card>
            <p className="text-[40px] font-strong leading-none tracking-[-0.8px] tabular-nums text-white">{big}</p>
            <p className="text-[14.5px] leading-5 text-white/[0.82]">{bigNote}</p>
            {extra ? <div className="mt-1.5 border-t border-white/[0.08] pt-3">{extra}</div> : null}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

/** The app's Tag, green: a brand that came back is good news. */
function Tag({ children }: { children: string }) {
  return <KitTag label={children} tone="good" />;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <KitEmpty icon="analytics-outline" title={title} body={body} />;
}

/** A brand's logo as the page shows it, or its initial. */
export function Logo({ brand }: { brand: Pick<BrandRelation, "name" | "logoUrl"> }) {
  const initial = brand.name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "?";
  return brand.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-[18px] border border-white/10 bg-white object-contain p-1" loading="lazy" />
  ) : (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-white/[0.08] text-[14px] font-strong text-white">
      {initial}
    </span>
  );
}

/** One row of a bar list: a label, its money or share, a bar, a small line under it. */
function BarLine({ label, right, value, max, sub }: { label: ReactNode; right: ReactNode; value: number; max: number; sub?: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 border-t border-white/[0.08] py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[14.5px] text-white">{label}</p>
        <p className="shrink-0 text-[14.5px] font-bold tabular-nums text-white">{right}</p>
      </div>
      <ProgressBar value={value} max={max} />
      {sub ? <p className="truncate text-[12.5px] text-white/55">{sub}</p> : null}
    </li>
  );
}

/* ── Brands you work with ─────────────────────────────────────────── */

/**
 * Every brand is a card, and the card opens that brand alone (./BrandScreen).
 * A list of rows made twenty brands look like a ledger; a brand is somebody
 * the creator sells to again, so it gets a face and a way in.
 */
export function BrandsScreen({ data, back, hrefOf }: { data: CreatorAnalytics; back: string; hrefOf: (key: string) => string }) {
  const [filter, setFilter] = useState<"all" | "repeat">("all");
  const list = filter === "repeat" ? data.brands.filter((b) => b.repeat) : data.brands;
  const paged = usePaged(list, filter, 8);
  const tt = useT();
  const t = data.totals;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={tt("spaces.overview.crumb")} title={tt("spaces.overview.brands.title")} />
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-[14.5px] text-white/[0.82]">
          <Rich
            k="spaces.overview.brands.havePaid"
            vars={{ count: t.brands }}
            tags={{ n: (c) => <span className="text-[18px] font-extrabold tabular-nums text-white">{c}</span> }}
          />
        </p>
        <FilterPills
          label={tt("spaces.overview.brands.filter")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: tt("common.all"), count: data.brands.length },
            { value: "repeat", label: tt("spaces.overview.brands.cameBack"), count: t.repeatBrands },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty
          title={filter === "repeat" ? tt("spaces.overview.brands.noneBack") : tt("spaces.overview.brands.nonePaid")}
          body={tt("spaces.overview.brands.emptyBody")}
        />
      ) : (
        <>
          <CardGrid>
            {paged.shown.map((b) => (
              <BrandCard key={b.key} brand={b} href={hrefOf(b.key)} />
            ))}
          </CardGrid>
          <Pager {...paged} size={8} />
        </>
      )}
    </div>
  );
}

/** One brand: its mark, its name, where it paid, and what reached you from it. */
function BrandCard({ brand: b, href }: { brand: BrandRelation; href: string }) {
  const t = useT();
  return (
    <li className="flex">
      <Card href={href} className="w-full sm:min-h-[168px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo brand={b} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{b.name}</p>
            <p className="truncate text-[12.5px] font-strong text-white/[0.82]">
              {b.handle ? `@${b.handle}` : b.firstPaidAt ? t("spaces.overview.brands.since", { when: monthYear(b.firstPaidAt) }) : " "}
            </p>
          </div>
          {b.repeat ? <Tag>{t("spaces.overview.brands.repeat")}</Tag> : null}
        </div>
        <p className="truncate text-[13px] text-white/[0.82]">
          {b.events.length ? b.events.map((e) => e.name).join(", ") : t("spaces.inspire.notTiedToEvent")}
        </p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
          <p className="text-[24px] font-extrabold leading-none tracking-[-0.5px] tabular-nums text-white">{dollars(b.receivedCents)}</p>
          <p className="truncate text-[12.5px] font-strong tabular-nums text-white/55">{t("spaces.n.orders", { count: b.orders })}</p>
        </div>
      </Card>
    </li>
  );
}

/* ── By event ─────────────────────────────────────────────────────── */

export function EventsScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const rows = data.byEvent;
  const max = Math.max(1, ...rows.map((e) => e.receivedCents));
  const paged = usePaged(rows, rows.length, 6);
  const countryOf = useEventCountry();
  const t = useT();
  return (
    <Screen
      back={back}
      title={t("spaces.overview.events.title")}
      big={dollars(data.totals.receivedCents)}
      bigNote={t("spaces.overview.events.earnedAcross", { count: data.totals.events })}
    >
      <Panel title={t("spaces.overview.events.panel")} meta={t("spaces.overview.events.panelMeta")}>
        {rows.length === 0 ? (
          <Empty title={t("spaces.overview.nothingPublished")} body={t("spaces.overview.events.emptyBody")} />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((e) => (
                <BarLine
                  key={e.key}
                  label={
                    <span className="flex min-w-0 items-center gap-2">
                      <EventBadge
                        event={{ key: e.key, name: e.name, city: e.city, country: countryOf({ key: e.slug ?? e.key, name: e.name }), startsOn: e.startsOn, endsOn: e.endsOn }}
                        size={22}
                      />
                      <span className="min-w-0 truncate">
                        {e.name}
                        {e.startsOn ? <span className="ml-2 text-[12.5px] text-white/55">{[e.city, eventDates(e.startsOn, e.endsOn ?? e.startsOn)].filter(Boolean).join(" · ")}</span> : null}
                      </span>
                    </span>
                  }
                  right={dollars(e.receivedCents)}
                  value={e.receivedCents}
                  max={max}
                  sub={[
                    e.sellThroughPct !== null
                      ? t("spaces.overview.spotsSoldPct", { sold: e.spotsSold, total: e.spotsTotal, pct: pctText(e.sellThroughPct) })
                      : t("spaces.overview.spotsSold", { sold: e.spotsSold, total: e.spotsTotal }),
                    t("spaces.n.orders", { count: e.orders }),
                    t("spaces.n.brands", { count: e.brands }),
                  ].join(" · ")}
                />
              ))}
            </ul>
            <div className="mt-3">
              <Pager {...paged} size={6} />
            </div>
          </>
        )}
      </Panel>
    </Screen>
  );
}

/* ── What sells for you ───────────────────────────────────────────── */

function speed(r: { medianDaysToFirstSale?: number | null; daysToFirstSale?: number | null; medianDaysToSellOut?: number | null; daysToSellOut?: number | null }): string {
  const first = r.medianDaysToFirstSale ?? r.daysToFirstSale ?? null;
  const out = r.medianDaysToSellOut ?? r.daysToSellOut ?? null;
  const parts = [
    first !== null ? tr("spaces.overview.sells.firstSale", { days: daysText(first) }) : tr("spaces.overview.sells.noSaleYet"),
    out !== null ? tr("spaces.overview.sells.soldOutIn", { days: daysText(out) }) : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function SellsScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const [by, setBy] = useState<"product" | "kind" | "listing">("product");
  const tt = useT();
  const t = data.totals;
  const rows: { key: string; label: string; sub: string; pct: number | null; cents: number; sold: number; total: number; speed: string }[] =
    by === "listing"
      ? data.byListing.map((l: ListingRow) => ({
          key: l.id,
          label: l.title,
          sub: `${l.product} · ${l.event}`,
          pct: l.soldPct,
          cents: l.receivedCents,
          sold: l.spotsSold,
          total: l.spotsTotal,
          speed: speed(l),
        }))
      : (by === "kind" ? data.byKind : data.byProduct).map((g: GroupRow) => ({
          key: g.key,
          label: g.label,
          sub: tt("spaces.n.listings", { count: g.listings }),
          pct: g.soldPct,
          cents: g.receivedCents,
          sold: g.spotsSold,
          total: g.spotsTotal,
          speed: speed(g),
        }));
  const paged = usePaged(rows, by, 6);

  return (
    <Screen
      back={back}
      title={tt("spaces.overview.sells.title")}
      big={t.sellThroughPct !== null ? pctText(t.sellThroughPct) : "—"}
      bigNote={tt("spaces.overview.sells.bigNote", { sold: t.spotsSold, total: t.spotsTotal })}
    >
      <Panel
        title={tt("spaces.overview.sells.panel")}
        action={
          <FilterPills
            label={tt("spaces.overview.sells.groupBy")}
            value={by}
            onChange={setBy}
            options={[
              { value: "product", label: tt("spaces.overview.sells.product") },
              { value: "kind", label: tt("spaces.overview.sells.kind") },
              { value: "listing", label: tt("spaces.sales.listing") },
            ]}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty title={tt("spaces.overview.nothingPublished")} body={tt("spaces.overview.sells.emptyBody")} />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((r) => (
                <BarLine
                  key={r.key}
                  label={r.label}
                  right={
                    <>
                      {r.pct !== null ? pctText(r.pct) : "—"}
                      <span className="ml-2 text-[12.5px] text-white/55">{dollars(r.cents)}</span>
                    </>
                  }
                  value={r.sold}
                  max={Math.max(1, r.total)}
                  sub={[r.sub, tt("spaces.overview.sells.soldOf", { sold: r.sold, total: r.total }), r.speed].join(" · ")}
                />
              ))}
            </ul>
            <div className="mt-3">
              <Pager {...paged} size={6} />
            </div>
          </>
        )}
      </Panel>
    </Screen>
  );
}

/* ── How brands pay ───────────────────────────────────────────────── */

function MixPanel({ title, rows }: { title: string; rows: MixRow[] }) {
  const t = useT();
  return (
    <Panel title={title} meta={t("spaces.overview.pay.panelMeta")}>
      {rows.length === 0 ? (
        <Empty title={t("spaces.overview.pay.emptyTitle")} body={t("spaces.overview.pay.emptyBody")} />
      ) : (
        <ul className="flex flex-col">
          {rows.map((m) => (
            <BarLine
              key={m.key}
              label={m.label}
              right={m.receivedPct !== null ? pctText(m.receivedPct) : "—"}
              value={m.receivedPct ?? 0}
              max={100}
              sub={`${dollars(m.receivedCents)} · ${t("spaces.n.orders", { count: m.orders })}`}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function PayScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const top = data.payMix.byChain[0] ?? null;
  const t = useT();
  return (
    <Screen
      back={back}
      title={t("spaces.overview.pay.title")}
      big={top?.receivedPct != null ? pctText(top.receivedPct) : "—"}
      bigNote={top ? t("spaces.overview.pay.cameOn", { network: top.label }) : t("spaces.overview.pay.noPayment")}
      // How to read "Paid from", not an observation about it: a QR scan and a
      // wallet connected in the browser are the same payment to us.
      extra={<p className="text-[12.5px] leading-[17px] text-white/[0.82]">{t("spaces.overview.pay.qrNote")}</p>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <MixPanel title={t("common.network")} rows={data.payMix.byChain} />
        <MixPanel title={t("spaces.overview.pay.paidFrom")} rows={data.payMix.byPayFrom} />
      </div>
      <MixPanel title={t("spaces.overview.pay.deal")} rows={data.payMix.byDeal} />
    </Screen>
  );
}

/* ── You inspired ─────────────────────────────────────────────────── */

export function InspiredScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const block = data.inspired ?? { listings: 0, creators: 0, recent: [] };
  const href = useHref();
  const t = useT();
  const mayCreate = useMayCreateSpace();
  return (
    <Screen
      back={back}
      title={t("spaces.overview.inspired.title")}
      big={String(block.listings)}
      bigNote={t("spaces.overview.inspired.bigNote", { count: block.listings })}
    >
      <Panel
        title={t("spaces.overview.inspired.panel")}
        meta={t("spaces.n.listings", { count: block.recent.length })}
        action={
          mayCreate ? (
            <Link href={href("/listings/new")} className="text-[12.5px] font-strong normal-case tracking-normal text-white/[0.82] hover:text-white">
              {t("spaces.overview.inspired.newListing")}
            </Link>
          ) : undefined
        }
      >
        {block.recent.length === 0 ? (
          <Empty title={t("spaces.overview.inspired.emptyTitle")} body={t("spaces.overview.inspired.emptyBody")} />
        ) : (
          <ul className="flex flex-col">
            {block.recent.map((l) => (
              <li key={l.spaceId} className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.08] py-2.5 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] text-white">{l.title}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-white/55">
                    {l.creatorHandle ? `@${l.creatorHandle}` : t("spaces.overview.inspired.aCreator")}
                    {l.creditedAt ? ` · ${monthYear(l.creditedAt)}` : ""}
                  </p>
                </div>
                {l.path ? (
                  <a href={`${SITE_URL}${l.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-[34px] shrink-0 items-center rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white/[0.82] hover:bg-white/10">
                    {t("spaces.overview.inspired.view")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Screen>
  );
}
