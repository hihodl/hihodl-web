"use client";

/**
 * Spaces › Insights: what sells at an event, at what price, when, and which
 * brands pay, built only from HOLD Spaces' own paid orders.
 *
 * A hub of six cards, each opening its own screen with Back:
 *
 *   /insights                     the hub, with the event switcher
 *   /insights?view=you            Your numbers, against the event's median
 *   /insights?view=sells          What sells, by surface and by product
 *   /insights?view=pricing        Floor price bands, and fixed vs offers vs bids
 *   /insights?view=timing         Fill by listing age, days to a first sale, launch day
 *   /insights?view=brands         Brands that paid, here and all time
 *   /insights?view=pitch&brand=   A pitch built from your own numbers, to copy
 *
 * `event=<slug>` or `event=all` rides along on every one; without it the
 * server picks your nearest event. A figure about other creators is null
 * below three of them, and the screen says so with the sample instead of
 * showing one person's result as a market.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { eventDates } from "@/lib/ad-space/format";
import type { Brand, Insights, InsightsEvent, Median, SellRow } from "@/lib/creator/insights";
import { useInsights } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { btnPrimary, CopyButton, inputCls } from "../front/kit";
import { IconAccount, IconCalendar, IconFloor, IconMegaphone, IconOffers, IconSales } from "../icons";
import { useShell } from "../Shell";
import { dollars, EmptyState, FilterPills, Panel, ProgressBar, Segmented, Skeleton } from "../ui";
import { ReadError } from "./common";
import { cardCls, CardGrid, DrillBar, Pager, usePaged } from "./cards";

export type InsightsView = "you" | "sells" | "pricing" | "timing" | "brands" | "pitch";

const VIEWS: readonly InsightsView[] = ["you", "sells", "pricing", "timing", "brands", "pitch"];

export function isInsightsView(v: string | null | undefined): v is InsightsView {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}

/* ── Words and numbers ────────────────────────────────────────────── */

const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
const daysText = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const perFollower = (n: number) => (n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function sampleText(s: { creators: number; listings: number }): string {
  return `${plural(s.creators, "creator")} · ${plural(s.listings, "listing")}`;
}

function where(event: InsightsEvent | null): string {
  return event ? event.name : "HOLD Spaces";
}

/** The event's own line: city and dates. */
function eventLine(event: InsightsEvent | null): string {
  if (!event) return "Every event, all time";
  return [event.city, eventDates(event.startsOn, event.endsOn)].filter(Boolean).join(" · ");
}

/* ── The screen ───────────────────────────────────────────────────── */

export function InsightsScreen({ event, view, brand }: { event: string | null; view: string | null; brand: string | null }) {
  const read = useInsights(event);
  const href = useHref();
  const base = href("/insights");
  const eventQ = event ? `event=${encodeURIComponent(event)}` : "";
  const to = (v: InsightsView | null, extra = "") => {
    const q = [eventQ, v ? `view=${v}` : "", extra].filter(Boolean).join("&");
    return q ? `${base}?${q}` : base;
  };

  if (!read.data) {
    return read.error ? <ReadError error={read.error} /> : <Skeleton className="h-[320px]" />;
  }
  const data = read.data;
  const current = isInsightsView(view) ? view : null;
  const back = to(null);

  if (current === "you") return <YouScreen data={data} back={back} />;
  if (current === "sells") return <SellsScreen data={data} back={back} />;
  if (current === "pricing") return <PricingScreen data={data} back={back} />;
  if (current === "timing") return <TimingScreen data={data} back={back} />;
  if (current === "brands") return <BrandsScreen data={data} back={back} pitchHref={(name) => to("pitch", `brand=${encodeURIComponent(name)}`)} />;
  if (current === "pitch") return <PitchScreen data={data} back={back} initialBrand={brand} />;
  return <Hub data={data} to={to} />;
}

/* ── The hub ──────────────────────────────────────────────────────── */

function EventSwitch({ data }: { data: Insights }) {
  const router = useRouter();
  const href = useHref();
  const value = data.event?.slug ?? "all";
  const options = [...data.events.map((e) => ({ value: e.slug, label: e.name })), { value: "all", label: "All of Spaces" }];
  // An event the creator has not listed at (a link from somewhere) still shows as chosen.
  if (data.event && !data.events.some((e) => e.slug === data.event!.slug)) options.unshift({ value: data.event.slug, label: data.event.name });
  return (
    <FilterPills
      label="Event"
      options={options}
      value={value}
      onChange={(v) => router.push(`${href("/insights")}?event=${encodeURIComponent(v)}`, { scroll: false })}
    />
  );
}

function best<T extends { pct: number | null }>(rows: readonly T[]): T | null {
  return rows.filter((r) => r.pct !== null).sort((a, b) => b.pct! - a.pct!)[0] ?? null;
}

function Hub({ data, to }: { data: Insights; to: (v: InsightsView | null, extra?: string) => string }) {
  const { you, whatSells, pricing, timing, brands } = data;
  const topSurface = best(whatSells.surfaces.map((s) => ({ ...s, pct: s.filledPct })));
  const topBand = best(pricing.bands);
  const brandList = brands.event ?? brands.allTime;
  const needMore = `Not enough sales yet at ${where(data.event)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-body font-medium text-text">{where(data.event)}</h2>
          <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">
            {eventLine(data.event)} · {sampleText(you.sample)} on HOLD Spaces
          </p>
        </div>
        <EventSwitch data={data} />
      </div>
      <CardGrid>
        <HubCard
          href={to("you")}
          icon={IconAccount}
          title="Your numbers"
          line={you.listings ? `${you.placements.filled} of ${you.placements.total} spots filled` : "No listing here yet"}
          value={dollars(you.raisedCents)}
          note="raised"
        />
        <HubCard
          href={to("sells")}
          icon={IconSales}
          title="What sells"
          line={topSurface ? `${topSurface.label} fill best` : needMore}
          value={topSurface ? pctText(topSurface.pct!) : "—"}
          note={topSurface ? "of spots filled" : sampleText(whatSells.sample)}
        />
        <HubCard
          href={to("pricing")}
          icon={IconFloor}
          title="Pricing"
          line={topBand ? `${topBand.label} floors sell most often` : needMore}
          value={topBand ? pctText(topBand.pct!) : "—"}
          note={topBand ? "sold at least one" : sampleText(pricing.sample)}
        />
        <HubCard
          href={to("timing")}
          icon={IconCalendar}
          title="Timing"
          line={timing.medianDaysToFirstSale !== null ? "to a first sale, median" : needMore}
          value={timing.medianDaysToFirstSale !== null ? daysText(timing.medianDaysToFirstSale) : "—"}
          note={sampleText(timing.medianDaysToFirstSaleSample)}
        />
        <HubCard
          href={to("brands")}
          icon={IconOffers}
          title="Brands buying"
          line={brandList.brands.length ? brandList.brands.slice(0, 3).map((b) => b.name).join(", ") : "No named brand yet"}
          value={String(brandList.brands.length)}
          note={brands.event ? "here" : "all time"}
        />
        <HubCard
          href={to("pitch")}
          icon={IconMegaphone}
          title="Pitch a brand"
          line="A plan built from your numbers"
          value="Write"
          note="copy and send"
        />
      </CardGrid>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  line,
  value,
  note,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  line: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <li>
      <Link href={href} scroll={false} className={`${cardCls} gap-3 p-4 sm:min-h-[176px] sm:gap-4 sm:p-5 xl:min-h-[200px]`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[#CFE3EC]">
            <Icon />
          </span>
          <p className="truncate text-small font-medium text-text">{title}</p>
        </div>
        <p className="truncate text-tiny text-[#CFE3EC]">{line}</p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
          <p className="text-[26px] font-medium leading-none tabular-nums text-text xl:text-[30px]">{value}</p>
          {note ? <p className="truncate text-tiny tabular-nums text-[#9FB7C2]">{note}</p> : null}
        </div>
      </Link>
    </li>
  );
}

/* ── Pieces the screens share ─────────────────────────────────────── */

/** Back, then a big number on the left and the detail on the right. */
function Screen({
  back,
  data,
  title,
  big,
  bigNote,
  aside,
  children,
}: {
  back: string;
  data: Insights;
  title: string;
  big: ReactNode;
  bigNote: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={`Insights · ${where(data.event)}`} title={title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Panel>
          <p className="text-[40px] font-medium leading-none tracking-tight tabular-nums text-text">{big}</p>
          <p className="mt-3 text-small text-[#CFE3EC]">{bigNote}</p>
          {aside ? <div className="mt-5 border-t border-white/[0.06] pt-4 text-tiny leading-relaxed text-[#9FB7C2]">{aside}</div> : null}
        </Panel>
        {children}
      </div>
    </div>
  );
}

/** What to do while the market is too thin to show. */
function TooFew({ data, sample, watch }: { data: Insights; sample: { creators: number; listings: number }; watch: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <p className="text-small text-text">Not enough sales yet at {where(data.event)}.</p>
      <p className="text-tiny text-[#9FB7C2]">
        {sampleText(sample)} so far; a figure shows from {data.minSample} creators. {watch}
      </p>
    </div>
  );
}

/** One row: a label, a bar, the figure; or the counts and "not enough" when there is no figure. */
function BarRow({
  label,
  sub,
  pct,
  filled,
  total,
  right,
}: {
  label: string;
  sub: string;
  pct: number | null;
  filled?: number;
  total?: number;
  right?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-small text-text">{label}</p>
        <p className="shrink-0 text-small tabular-nums text-text">{right ?? (pct !== null ? pctText(pct) : <span className="text-tiny text-[#7F97A3]">not enough yet</span>)}</p>
      </div>
      {pct !== null ? <ProgressBar value={pct} max={100} /> : filled !== undefined && total ? <div className="h-1.5 w-full rounded-[3px] bg-white/[0.05]" /> : null}
      <p className="truncate text-tiny text-[#9FB7C2]">{sub}</p>
    </li>
  );
}

/* ── Your numbers ─────────────────────────────────────────────────── */

function medianText(m: Median, fmt: (n: number) => string): ReactNode {
  return m.value !== null ? fmt(m.value) : <span className="text-tiny text-[#7F97A3]">{plural(m.creators, "creator")}, not enough</span>;
}

function YouScreen({ data, back }: { data: Insights; back: string }) {
  const href = useHref();
  const y = data.you;
  const m = y.median;
  if (y.listings === 0) {
    return (
      <Screen
        back={back}
        data={data}
        title="Your numbers"
        big="$0"
        bigNote={`You have no published listing at ${where(data.event)}.`}
        aside="Your raised, spots filled and days to a first sale appear here once a listing is live, next to the median creator at the same event."
      >
        <Panel>
          <EmptyState
            title="Publish a listing to see how you compare."
            action={
              <Link href={href("/listings/new")} className={btnPrimary}>
                New listing
              </Link>
            }
          />
        </Panel>
      </Screen>
    );
  }
  const rows: { label: string; you: ReactNode; median: ReactNode }[] = [
    { label: "Raised (paid)", you: dollars(y.raisedCents), median: medianText(m.raisedCents, dollars) },
    {
      label: "Spots filled",
      you: `${y.placements.filled} of ${y.placements.total}${y.placements.pct !== null ? ` · ${pctText(y.placements.pct)}` : ""}`,
      median: medianText(m.filledPct, pctText),
    },
    { label: "Days live", you: y.daysLive !== null ? daysText(y.daysLive) : "—", median: medianText(m.daysLive, daysText) },
    {
      label: "Days to first sale",
      you: y.daysToFirstSale !== null ? daysText(y.daysToFirstSale) : "No sale yet",
      median: medianText(m.daysToFirstSale, daysText),
    },
    {
      label: "Raised per X follower",
      you: y.usdPerFollower !== null ? perFollower(y.usdPerFollower) : y.followers === null ? "No follower count" : "—",
      median: medianText(m.usdPerFollower, perFollower),
    },
    { label: "Your floor price", you: y.floorCents !== null ? dollars(y.floorCents) : "—", median: medianText(m.floorCents, dollars) },
  ];
  return (
    <Screen
      back={back}
      data={data}
      title="Your numbers"
      big={dollars(y.raisedCents)}
      bigNote={`raised at ${where(data.event)}, from paid orders only`}
      aside={
        <>
          {y.followers !== null ? `${compact(y.followers)} followers on X, as of your last check. ` : "Link X again to count your followers. "}
          Medians are the middle creator of {sampleText(y.sample)}; money medians are rounded, and nobody&apos;s exact receipt is shown.
        </>
      }
    >
      <Panel title="You and the median creator" meta={where(data.event)}>
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-tiny text-[#9FB7C2]">
          <span />
          <span>You</span>
          <span>Median</span>
        </div>
        <ul className="mt-2 flex flex-col">
          {rows.map((r) => (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-3 border-t border-white/[0.06] py-2.5 first:border-t-0"
            >
              <span className="truncate text-small text-[#CFE3EC]">{r.label}</span>
              <span className="truncate text-small tabular-nums text-text">{r.you}</span>
              <span className="truncate text-small tabular-nums text-[#CFE3EC]">{r.median}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </Screen>
  );
}

/* ── What sells ───────────────────────────────────────────────────── */

function sellSub(r: SellRow): string {
  const money = r.moneyShare !== null ? ` · ${pctText(r.moneyShare)} of the money` : "";
  return `${plural(r.listings, "listing")} · ${r.filled} of ${r.placements} spots${money}`;
}

function SellsScreen({ data, back }: { data: Insights; back: string }) {
  const [by, setBy] = useState<"surface" | "product">("surface");
  const w = data.whatSells;
  const rows = by === "surface" ? w.surfaces : w.products;
  const paged = usePaged(rows, by, 6);
  const top = best(w.surfaces.map((s) => ({ ...s, pct: s.filledPct })));
  const objects = w.surfaces.find((s) => s.key === "object")?.filledPct ?? null;
  const clothing = w.surfaces.find((s) => s.key === "clothing")?.filledPct ?? null;
  const ratio = objects !== null && clothing !== null && clothing > 0 ? objects / clothing : null;

  return (
    <Screen
      back={back}
      data={data}
      title="What sells"
      big={top ? pctText(top.pct!) : "—"}
      bigNote={top ? `of spots filled on ${top.label.toLowerCase()}, the best surface here` : `Not enough sales yet at ${where(data.event)}`}
      aside={
        ratio !== null && ratio >= 1.5
          ? `Objects fill ${ratio.toFixed(ratio >= 10 ? 0 : 1)}x more than outfits here. A brand sees a suitcase or a laptop in every photo; an outfit changes daily.`
          : "Watch which surface fills first: a sponsor pays for a logo that stays in shot."
      }
    >
      <Panel title="Spots filled" meta={sampleText(w.sample)} action={<Segmented label="Group by" value={by} onChange={setBy} options={[{ value: "surface", label: "Surface" }, { value: "product", label: "Product" }]} />}>
        {rows.length === 0 ? (
          <TooFew data={data} sample={w.sample} watch="The first listings here will show which surfaces sponsors pick." />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((r) => (
                <BarRow key={r.key} label={r.label} pct={r.filledPct} filled={r.filled} total={r.placements} sub={`${sellSub(r)} · ${sampleText(r.sample)}`} />
              ))}
            </ul>
            <div className="mt-3">
              <Pager {...paged} />
            </div>
          </>
        )}
      </Panel>
    </Screen>
  );
}

/* ── Pricing ──────────────────────────────────────────────────────── */

function PricingScreen({ data, back }: { data: Insights; back: string }) {
  const [by, setBy] = useState<"floor" | "way">("floor");
  const p = data.pricing;
  const top = best(p.bands);
  const mine = data.you.floorCents;
  const ways = p.ways.filter((w) => w.placements > 0);

  return (
    <Screen
      back={back}
      data={data}
      title="Pricing"
      big={top ? pctText(top.pct!) : "—"}
      bigNote={top ? `of listings with a ${top.label} floor sold at least one spot` : `Not enough sales yet at ${where(data.event)}`}
      aside={
        <>
          A listing counts in the band of its cheapest spot.{" "}
          {mine !== null ? `Your floor is ${dollars(mine)}.` : "Set a floor to see where you sit."}
          {p.sample.unpriced ? ` ${plural(p.sample.unpriced, "listing")} on offers with no minimum are left out.` : ""}
        </>
      }
    >
      <Panel
        title={by === "floor" ? "Floor price" : "How it sells"}
        meta={sampleText(p.sample)}
        action={<Segmented label="Show" value={by} onChange={setBy} options={[{ value: "floor", label: "Floor price" }, { value: "way", label: "Fixed or offers" }]} />}
      >
        {p.sample.listings === 0 ? (
          <TooFew data={data} sample={p.sample} watch="Watch the first prices that sell here before you set yours." />
        ) : by === "floor" ? (
          <ul className="flex flex-col">
            {p.bands.map((b) => (
              <BarRow key={b.key} label={b.label} pct={b.pct} filled={b.withSale} total={b.listings} sub={`${b.withSale} of ${plural(b.listings, "listing")} sold · ${sampleText(b.sample)}`} />
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col">
            {ways.map((w) => (
              <BarRow key={w.key} label={w.label} pct={w.filledPct} filled={w.filled} total={w.placements} sub={`${w.filled} of ${plural(w.placements, "spot")} filled · ${sampleText(w.sample)}`} />
            ))}
          </ul>
        )}
      </Panel>
    </Screen>
  );
}

/* ── Timing ───────────────────────────────────────────────────────── */

function TimingScreen({ data, back }: { data: Insights; back: string }) {
  const [by, setBy] = useState<"age" | "day">("age");
  const t = data.timing;
  const bestDay = t.weekdays.filter((d) => d.soldFirstWeekPct !== null).sort((a, b) => b.soldFirstWeekPct! - a.soldFirstWeekPct!)[0] ?? null;

  return (
    <Screen
      back={back}
      data={data}
      title="Timing"
      big={t.medianDaysToFirstSale !== null ? daysText(t.medianDaysToFirstSale) : "—"}
      bigNote={t.medianDaysToFirstSale !== null ? "from going live to a first sale, median" : `Not enough sales yet at ${where(data.event)}`}
      aside={
        <>
          {bestDay ? `Listings that went live on a ${bestDay.label} sold in their first week most often. ` : ""}
          {data.you.daysToFirstSale !== null ? `Your first sale came after ${daysText(data.you.daysToFirstSale)}. ` : ""}
          Days are counted in UTC.
        </>
      }
    >
      <Panel
        title={by === "age" ? "Spots filled by listing age" : "Launch day"}
        meta={sampleText(t.sample)}
        action={<Segmented label="Show" value={by} onChange={setBy} options={[{ value: "age", label: "Listing age" }, { value: "day", label: "Launch day" }]} />}
      >
        {t.sample.listings === 0 ? (
          <TooFew data={data} sample={t.sample} watch="The first week of the first listings is what to watch." />
        ) : by === "age" ? (
          <ul className="flex flex-col">
            {t.ages.map((a) => (
              <BarRow key={a.key} label={a.label} pct={a.filledPct} filled={a.filled} total={a.placements} sub={`${a.filled} of ${plural(a.placements, "spot")} · ${sampleText(a.sample)}`} />
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-6 sm:grid-cols-2">
            {t.weekdays.map((d) => (
              <BarRow
                key={d.day}
                label={d.label}
                pct={d.soldFirstWeekPct}
                filled={0}
                total={d.listings}
                sub={`${plural(d.listings, "listing")}${d.firstWeekSalesPerListing !== null ? ` · ${d.firstWeekSalesPerListing} sales each in week one` : ""}`}
              />
            ))}
          </ul>
        )}
      </Panel>
    </Screen>
  );
}

/* ── Brands buying ────────────────────────────────────────────────── */

function BrandsScreen({ data, back, pitchHref }: { data: Insights; back: string; pitchHref: (name: string) => string }) {
  const [scope, setScope] = useState<"event" | "all">(data.brands.event ? "event" : "all");
  const list = scope === "event" && data.brands.event ? data.brands.event : data.brands.allTime;
  const paged = usePaged(list.brands, scope, 6);
  const top = list.brands[0] ?? null;

  return (
    <Screen
      back={back}
      data={data}
      title="Brands buying"
      big={String(list.brands.length)}
      bigNote={`${list.brands.length === 1 ? "brand has" : "brands have"} paid for a spot ${scope === "event" ? `at ${where(data.event)}` : "on HOLD Spaces"}`}
      aside={
        <>
          Names as the listings show them publicly, from paid orders only. Spend is a band, never an amount.
          {top ? ` ${top.name} bought the most spots.` : ""}
        </>
      }
    >
      <Panel
        title="Who paid"
        meta={`${plural(list.sample.paidOrders, "paid order")} · ${list.sample.named} named`}
        action={
          data.brands.event ? (
            <Segmented
              label="Where"
              value={scope}
              onChange={setScope}
              options={[
                { value: "event", label: where(data.event) },
                { value: "all", label: "All time" },
              ]}
            />
          ) : null
        }
      >
        {list.brands.length === 0 ? (
          <div className="flex flex-col gap-1.5 py-2">
            <p className="text-small text-text">No brand has paid here yet.</p>
            <p className="text-tiny text-[#9FB7C2]">
              Brands appear once a spot is paid and its artwork is approved. Until then, pitch the brands you already know: Pitch a brand writes it from your numbers.
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((b) => (
                <BrandRow key={`${b.name}-${b.handle ?? ""}`} brand={b} pitch={pitchHref(b.name)} />
              ))}
            </ul>
            <div className="mt-3">
              <Pager {...paged} />
            </div>
          </>
        )}
      </Panel>
    </Screen>
  );
}

function BrandRow({ brand, pitch }: { brand: Brand; pitch: string }) {
  const bits = [plural(brand.placements, "spot"), brand.spendBandLabel, brand.country].filter(Boolean).join(" · ");
  return (
    <li className="flex min-w-0 items-center gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-small text-text">
          {brand.name}
          {brand.handle ? <span className="ml-2 text-tiny text-[#9FB7C2]">@{brand.handle}</span> : null}
        </p>
        <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">{bits}</p>
      </div>
      <Link
        href={pitch}
        scroll={false}
        className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text"
      >
        Pitch
      </Link>
    </li>
  );
}

/* ── Pitch a brand ────────────────────────────────────────────────── */

/** What this creator sells at the event, from their own listings. */
function useWhatISell(data: Insights) {
  const { listings } = useShell();
  return useMemo(() => {
    const here = listings.filter((l) => l.status !== "draft" && (!data.event || l.event?.slug === data.event.slug));
    const titles = here.map((l) => l.serviceName || l.title);
    const open = here.reduce((n, l) => n + Math.max(0, l.totals.positions - l.totals.sold), 0);
    return { titles, open };
  }, [listings, data.event]);
}

/** The strongest honest line the market gives for this pitch; null when it gives none. */
function marketLine(data: Insights): string | null {
  const s = data.whatSells.surfaces;
  const objects = s.find((r) => r.key === "object")?.filledPct ?? null;
  const clothing = s.find((r) => r.key === "clothing")?.filledPct ?? null;
  const at = data.event ? `at ${data.event.name}` : "on HOLD Spaces";
  if (objects !== null && clothing !== null && clothing > 0 && objects / clothing >= 1.5) {
    return `On HOLD Spaces ${at}, spots on objects fill ${(objects / clothing).toFixed(objects / clothing >= 10 ? 0 : 1)}x more than spots on outfits: a logo on a suitcase or a laptop is in every shot, all week.`;
  }
  const top = best(s.map((r) => ({ ...r, pct: r.filledPct })));
  if (top) return `On HOLD Spaces ${at}, ${pctText(top.pct!)} of spots on ${top.label.toLowerCase()} have been bought by brands.`;
  return null;
}

export function pitchText(input: {
  brand: string;
  handle: string | null;
  followers: number | null;
  data: Insights;
  titles: string[];
  open: number;
  link: string | null;
}): string {
  const { brand, handle, followers, data, titles, open, link } = input;
  const y = data.you;
  const me = handle ? `@${handle}` : "a creator on HOLD Spaces";
  const event = data.event;
  const lines: string[] = [];
  lines.push(`Hi ${brand} team,`, "");
  lines.push(
    event
      ? `I'm ${me}, and I'll be at ${event.name} in ${event.city} (${eventDates(event.startsOn, event.endsOn)}).`
      : `I'm ${me}, and I sell sponsor spots on HOLD Spaces.`,
  );
  if (titles.length) {
    const what = titles.slice(0, 3).join(", ");
    const floor = y.floorCents !== null ? `, from ${dollars(y.floorCents)}` : "";
    lines.push(`I'm selling sponsor spots on ${what}${floor}${open ? `, with ${plural(open, "spot")} still open` : ""}.`);
  }
  lines.push("");
  const why: string[] = [];
  if (followers) why.push(`${compact(followers)} followers on X see what I carry and post.`);
  if (y.placements.filled > 0) why.push(`${y.placements.filled} of my ${y.placements.total} spots here are already taken by brands.`);
  const market = marketLine(data);
  if (market) why.push(market);
  if (why.length) {
    lines.push("Why it works:");
    for (const w of why) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push(`What I'd plan for ${brand}:`);
  lines.push(`- Your logo on the spot you choose${event ? `, carried through ${event.name}` : ""}.`);
  lines.push(`- Photos and a post on X tagging ${brand}, with the link you want.`);
  lines.push("- Paid in USDC straight to me, and your spot is yours the moment it is paid.");
  lines.push("");
  lines.push(link ? `Everything is here: ${link}` : "I can send the link to the listing.");
  lines.push("Happy to shape it around what you are launching.", "", handle ? `@${handle}` : "");
  return lines.join("\n").trimEnd();
}

function PitchScreen({ data, back, initialBrand }: { data: Insights; back: string; initialBrand: string | null }) {
  const { x } = useShell();
  const mine = useWhatISell(data);
  const known = useMemo(() => {
    const names = [...(data.brands.event?.brands ?? []), ...data.brands.allTime.brands].map((b) => b.name);
    return [...new Set(names)].slice(0, 8);
  }, [data.brands]);
  const [brand, setBrand] = useState(initialBrand ?? known[0] ?? "");
  const handle = x && x.linked ? x.handle : null;
  const followers = x && x.linked ? x.followers : null;
  const name = brand.trim();
  const text = name
    ? pitchText({
        brand: name,
        handle,
        followers: followers ?? data.you.followers,
        data,
        titles: mine.titles,
        open: mine.open,
        link: handle ? `${SITE_URL}/s/${handle}` : null,
      })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={`Insights · ${where(data.event)}`} title="Pitch a brand" right={text ? <CopyButton value={text} label="Copy pitch" /> : null} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Panel title="Which brand">
          <input
            className={inputCls}
            value={brand}
            maxLength={60}
            placeholder="Type a brand"
            onChange={(e) => setBrand(e.target.value)}
            aria-label="Brand"
          />
          {known.length ? (
            <div className="mt-4">
              <p className="mb-2 text-tiny text-[#9FB7C2]">Brands that already paid on HOLD Spaces</p>
              <FilterPills label="Brands" value={known.includes(name) ? name : ""} onChange={setBrand} options={known.map((b) => ({ value: b, label: b }))} />
            </div>
          ) : (
            <p className="mt-4 text-tiny text-[#9FB7C2]">No brand has paid here yet. Type the one you want to reach.</p>
          )}
          <p className="mt-5 border-t border-white/[0.06] pt-4 text-tiny leading-relaxed text-[#9FB7C2]">
            Built from your own numbers and what sells here. Nothing is sent: copy it and send it where you talk to brands.
          </p>
        </Panel>
        <Panel title={name ? `For ${name}` : "Your pitch"} meta={name ? `${text.split("\n").length} lines` : ""}>
          {name ? (
            <pre className="max-h-[calc(var(--app-vh,100dvh)-260px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-small leading-relaxed text-text">
              {text}
            </pre>
          ) : (
            <EmptyState title="Pick a brand or type one to write the pitch." />
          )}
        </Panel>
      </div>
    </div>
  );
}

