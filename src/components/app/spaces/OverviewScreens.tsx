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
import { eventDates } from "@/lib/ad-space/format";
import type { BrandRelation, CreatorAnalytics, GroupRow, ListingRow, MixRow } from "@/lib/creator/analytics";

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

export const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function daysText(n: number): string {
  const v = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  if (v === 0) return "same day";
  return `${v} ${v === 1 ? "day" : "days"}`;
}
export const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "";

/** "Brands paid our 5% on top" when they did on every sale, else what came out of your price. */
export function feeLine(t: CreatorAnalytics["totals"]): string {
  if (t.orders === 0) return "Brands pay our 5% on top of your price";
  if (t.fee.paidByYouCents === 0) return "Brands paid the 5% · you kept 100%";
  if (t.fee.paidByBrandsCents === 0) return `${dollars(t.fee.paidByYouCents)} fee came out of your price`;
  return `Brands paid ${dollars(t.fee.paidByBrandsCents)} of our fee on top`;
}

/* ── Pieces ───────────────────────────────────────────────────────── */

const CROSS = "Overview";

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
  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={CROSS} title={title} />
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
  const t = data.totals;

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={CROSS} title="Brands you work with" />
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-[14.5px] text-white/[0.82]">
          <span className="text-[18px] font-extrabold tabular-nums text-white">{t.brands}</span>{" "}
          {t.brands === 1 ? "brand has" : "brands have"} paid you
        </p>
        <FilterPills
          label="Brands"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: data.brands.length },
            { value: "repeat", label: "Came back", count: t.repeatBrands },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty
          title={filter === "repeat" ? "Nobody has come back yet." : "No brand has paid you yet."}
          body="A brand shows here the moment its payment lands, with the events it sponsored and how it paid."
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
  return (
    <li className="flex">
      <Card href={href} className="w-full sm:min-h-[168px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo brand={b} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-strong tracking-[-0.2px] text-white">{b.name}</p>
            <p className="truncate text-[12.5px] font-strong text-white/[0.82]">
              {b.handle ? `@${b.handle}` : b.firstPaidAt ? `since ${monthYear(b.firstPaidAt)}` : " "}
            </p>
          </div>
          {b.repeat ? <Tag>Repeat</Tag> : null}
        </div>
        <p className="truncate text-[13px] text-white/[0.82]">
          {b.events.length ? b.events.map((e) => e.name).join(", ") : "Not tied to an event"}
        </p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
          <p className="text-[24px] font-extrabold leading-none tracking-[-0.5px] tabular-nums text-white">{dollars(b.receivedCents)}</p>
          <p className="truncate text-[12.5px] font-strong tabular-nums text-white/55">{plural(b.orders, "order")}</p>
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
  return (
    <Screen
      back={back}
      title="By event"
      big={dollars(data.totals.receivedCents)}
      bigNote={`earned across ${plural(data.totals.events, "event")}`}
    >
      <Panel title="Money per event" meta="what reached you">
        {rows.length === 0 ? (
          <Empty title="Nothing published yet." body="Publish a listing at an event and its money, spots and brands add up here." />
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
                  sub={`${e.spotsSold} of ${e.spotsTotal} spots sold${e.sellThroughPct !== null ? ` (${pctText(e.sellThroughPct)})` : ""} · ${plural(e.orders, "order")} · ${plural(e.brands, "brand")}`}
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
  const parts = [first !== null ? `first sale ${daysText(first)}` : "no sale yet", out !== null ? `sold out in ${daysText(out)}` : null];
  return parts.filter(Boolean).join(" · ");
}

export function SellsScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const [by, setBy] = useState<"product" | "kind" | "listing">("product");
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
          sub: plural(g.listings, "listing"),
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
      title="What sells for you"
      big={t.sellThroughPct !== null ? pctText(t.sellThroughPct) : "—"}
      bigNote={`of your spots sold · ${t.spotsSold} of ${t.spotsTotal}`}
    >
      <Panel
        title="Sold, and how fast"
        action={
          <FilterPills
            label="Group by"
            value={by}
            onChange={setBy}
            options={[
              { value: "product", label: "Product" },
              { value: "kind", label: "Kind" },
              { value: "listing", label: "Listing" },
            ]}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty title="Nothing published yet." body="Publish a listing and what sells, and how fast, shows here." />
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
                  sub={`${r.sub} · ${r.sold} of ${r.total} sold · ${r.speed}`}
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
  return (
    <Panel title={title} meta="share of what reached you">
      {rows.length === 0 ? (
        <Empty title="No payment yet." body="The first payment shows its network and where it came from here." />
      ) : (
        <ul className="flex flex-col">
          {rows.map((m) => (
            <BarLine
              key={m.key}
              label={m.label}
              right={m.receivedPct !== null ? pctText(m.receivedPct) : "—"}
              value={m.receivedPct ?? 0}
              max={100}
              sub={`${dollars(m.receivedCents)} · ${plural(m.orders, "order")}`}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function PayScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const top = data.payMix.byChain[0] ?? null;
  return (
    <Screen
      back={back}
      title="How brands pay"
      big={top?.receivedPct != null ? pctText(top.receivedPct) : "—"}
      bigNote={top ? `of your money came on ${top.label}` : "No payment yet"}
      // How to read "Paid from", not an observation about it: a QR scan and a
      // wallet connected in the browser are the same payment to us.
      extra={<p className="text-[12.5px] leading-[17px] text-white/[0.82]">A QR scan and a connected wallet both show as External wallet.</p>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <MixPanel title="Network" rows={data.payMix.byChain} />
        <MixPanel title="Paid from" rows={data.payMix.byPayFrom} />
      </div>
      <MixPanel title="How the deal was struck" rows={data.payMix.byDeal} />
    </Screen>
  );
}

/* ── You inspired ─────────────────────────────────────────────────── */

export function InspiredScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const block = data.inspired ?? { listings: 0, creators: 0, recent: [] };
  const href = useHref();
  return (
    <Screen
      back={back}
      title="You inspired"
      big={String(block.listings)}
      bigNote={`${block.listings === 1 ? "listing credits" : "listings credit"} you as the inspiration`}
    >
      <Panel
        title="Who credited you"
        meta={plural(block.recent.length, "listing")}
        action={
          <Link href={href("/listings/new")} className="text-[12.5px] font-strong normal-case tracking-normal text-white/[0.82] hover:text-white">
            New listing
          </Link>
        }
      >
        {block.recent.length === 0 ? (
          <Empty title="Nobody has credited you yet." body="When a creator names you as the inspiration for a listing, it shows here and you get a notification." />
        ) : (
          <ul className="flex flex-col">
            {block.recent.map((l) => (
              <li key={l.spaceId} className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.08] py-2.5 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] text-white">{l.title}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-white/55">
                    {l.creatorHandle ? `@${l.creatorHandle}` : "A creator"}
                    {l.creditedAt ? ` · ${monthYear(l.creditedAt)}` : ""}
                  </p>
                </div>
                {l.path ? (
                  <a href={`${SITE_URL}${l.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-[34px] shrink-0 items-center rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white/[0.82] hover:bg-white/10">
                    View
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
