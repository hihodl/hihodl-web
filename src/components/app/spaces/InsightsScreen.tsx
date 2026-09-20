"use client";

/**
 * Spaces › Insights: what sells at an event, at what price, when, and which
 * brands pay, built only from HOLD Spaces' own paid orders.
 *
 * A hub of seven cards, each opening its own screen with Back:
 *
 *   /insights                     the hub, with the event switcher
 *   /insights?view=hook           Your hook: be early, be unusual, a spot leads to content
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
 *
 * The note under a big number says how to READ the figure — the sample, the
 * time zone, what a band counts — and never restates it as a sentence
 * ("Objects fill 3.2x more than outfits here"). A written-out observation is
 * filler next to the number it came from, and it costs a screenful.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { eventDates } from "@/lib/ad-space/format";
import type { Brand, HookBlock, Insights, InsightsEvent, Median, SellRow } from "@/lib/creator/insights";
import { useInsights } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { CopyButton } from "../front/kit";
import { ctaPrimary } from "../hold";
import { Ion, type IonName } from "../ion";
import { useShell } from "../Shell";
import { dollars, Skeleton } from "../ui";
import { ReadError } from "./common";
import { PRODUCTION_TEMPLATE, useProductionAt } from "./ContentOffer";
import { cardCls, CardGrid, DrillBar, Pager, useListingKind, usePaged } from "./cards";
import { Card, Empty, Group, inputCls, money, Pills, ProgressBar as Bar } from "./kit";

/* ── The app's parts, under the names these screens were written with ── */

/** A titled group: the app's SectionLabel over its Card. */
const Panel = Group;
const Segmented = Pills;
const FilterPills = Pills;

function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return <Empty icon="stats-chart-outline" title={title} action={action} />;
}

/** The app's green bar, fed a percentage. */
function ProgressBar({ value, max }: { value: number; max: number }) {
  return <Bar value={max > 0 ? value / max : 0} />;
}

/** The app's Chip, as a link or a button: 34 high, radius half of it. */
const chipLink =
  "inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white transition-colors hover:bg-white/10";

export type InsightsView = "hook" | "you" | "sells" | "pricing" | "timing" | "brands" | "pitch";

const VIEWS: readonly InsightsView[] = ["hook", "you", "sells", "pricing", "timing", "brands", "pitch"];

export function isInsightsView(v: string | null | undefined): v is InsightsView {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}

/* ── Words and numbers ────────────────────────────────────────────── */

const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
const daysText = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const perFollower = (n: number) => (n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

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

  if (current === "hook") return <HookScreen data={data} back={back} />;
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
  const hook = hookHeadline(data);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-extrabold tracking-[-0.3px] text-white">{where(data.event)}</h2>
          <p className="mt-0.5 truncate text-[12px] leading-4 text-white/55">
            {eventLine(data.event)} · {sampleText(you.sample)} on HOLD Spaces
          </p>
        </div>
        <EventSwitch data={data} />
      </div>
      <CardGrid>
        <HubCard href={to("hook")} icon="bulb-outline" title="Your hook" line={hook.line} value={hook.value} note={hook.note} />
        <HubCard
          href={to("you")}
          icon="person-outline"
          title="Your numbers"
          line={you.listings ? `${you.placements.filled} of ${you.placements.total} spots filled` : "No listing here yet"}
          value={dollars(you.raisedCents)}
          note="raised"
        />
        <HubCard
          href={to("sells")}
          icon="stats-chart-outline"
          title="What sells"
          line={topSurface ? `${topSurface.label} fill best` : needMore}
          value={topSurface ? pctText(topSurface.pct!) : "—"}
          note={topSurface ? "of spots filled" : sampleText(whatSells.sample)}
        />
        <HubCard
          href={to("pricing")}
          icon="pricetag-outline"
          title="Pricing"
          line={topBand ? `${topBand.label} floors sell most often` : needMore}
          value={topBand ? pctText(topBand.pct!) : "—"}
          note={topBand ? "sold at least one" : sampleText(pricing.sample)}
        />
        <HubCard
          href={to("timing")}
          icon="calendar-outline"
          title="Timing"
          line={timing.medianDaysToFirstSale !== null ? "to a first sale, median" : needMore}
          value={timing.medianDaysToFirstSale !== null ? daysText(timing.medianDaysToFirstSale) : "—"}
          note={plural(timing.medianDaysToFirstSaleSample.creators, "creator")}
        />
        <HubCard
          href={to("brands")}
          icon="business-outline"
          title="Brands buying"
          line={brandList.brands.length ? brandList.brands.slice(0, 3).map((b) => b.name).join(", ") : "No named brand yet"}
          value={String(brandList.brands.length)}
          note={brands.event ? "here" : "all time"}
        />
        <HubCard
          href={to("pitch")}
          icon="megaphone-outline"
          title="Pitch a brand"
          line="Lead with your reach and content"
          value="Write"
          note="copy and send"
        />
      </CardGrid>
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  line,
  value,
  note,
}: {
  href: string;
  icon: IonName;
  title: string;
  line: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <li>
      <Link href={href} scroll={false} className={`${cardCls} gap-2.5 p-3.5 sm:min-h-[168px] xl:min-h-[190px]`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Ion name={icon} size={18} className="shrink-0 text-white/[0.82]" />
          <p className="truncate text-[14.5px] font-bold text-white">{title}</p>
        </div>
        <p className="truncate text-[12.5px] font-strong text-white/[0.82]">{line}</p>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2">
          <p className={`${money} whitespace-nowrap leading-none`}>{value}</p>
          {note ? <p className="truncate text-[12.5px] font-strong tabular-nums text-white/55">{note}</p> : null}
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
    <div className="flex flex-col gap-3.5">
      <DrillBar back={back} crumb={`Insights · ${where(data.event)}`} title={title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Card>
          <p className="text-[34px] font-extrabold leading-none tracking-[-0.6px] tabular-nums text-white">{big}</p>
          <p className="text-[14px] leading-5 text-white/[0.82]">{bigNote}</p>
          {aside ? <div className="mt-1 border-t border-white/[0.08] pt-3 text-[12px] leading-[17px] text-white/55">{aside}</div> : null}
        </Card>
        {children}
      </div>
    </div>
  );
}

/** What to do while the market is too thin to show. */
function TooFew({ data, sample, watch }: { data: Insights; sample: { creators: number; listings: number }; watch: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <p className="text-[14.5px] text-white">Not enough sales yet at {where(data.event)}.</p>
      <p className="text-[12px] leading-4 text-white/55">
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
  grid = false,
}: {
  label: string;
  sub: string;
  /** In a two-column grid every row keeps its rule and padding, so the columns line up. */
  grid?: boolean;
  pct: number | null;
  filled?: number;
  total?: number;
  right?: ReactNode;
}) {
  return (
    <li className={`flex min-w-0 flex-col gap-1.5 border-t border-white/[0.08] py-2.5 ${grid ? "" : "first:border-t-0 first:pt-0"}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-[14.5px] text-white">{label}</p>
        <p className="shrink-0 text-[14px] font-strong tabular-nums text-white">{right ?? (pct !== null ? pctText(pct) : <span className="text-[12px] text-white/55">not enough yet</span>)}</p>
      </div>
      {pct !== null ? <ProgressBar value={pct} max={100} /> : filled !== undefined && total ? <div className="h-1.5 w-full rounded-[3px] bg-white/[0.05]" /> : null}
      <p className="truncate text-[12px] leading-4 text-white/55">{sub}</p>
    </li>
  );
}

/* ── Your hook ────────────────────────────────────────────────────── */

/**
 * What creators learned selling at TOKEN2049, and the part our data can show.
 * The product is the hook: a suitcase, a dress, a photo with squares is why
 * people look. What the brand buys is the creator's reach and the content they
 * make, and a spot is often the start of a content deal. Two things got the
 * suitcase seen: going up before the timeline filled, and being something out
 * of the ordinary.
 */

/** The creator's first listing here, the one the hook is about. */
function firstOfMine(hook: HookBlock | undefined) {
  return hook?.mine[0] ?? null;
}

function earlyText(days: number): string {
  if (days > 0) return `${daysText(days)} before it starts`;
  if (days === 0) return "on the first day";
  return "after it started";
}

function hookHeadline(data: Insights): { line: string; value: string; note: string } {
  const hook = data.hook;
  const mine = firstOfMine(hook);
  if (mine && mine.rank !== null) {
    const d = mine.daysBeforeEvent;
    return {
      line: `${mine.product}${d === null ? "" : d > 0 ? ` · ${daysText(d)} early` : d === 0 ? " · on day one" : " · after it started"}`,
      value: ordinal(mine.rank),
      note: `of ${plural(mine.sameProduct, "listing")} on it`,
    };
  }
  const open = hook?.leastCrowded ?? [];
  return {
    line: open.length ? `Fewest here: ${open.slice(0, 2).map((p) => p.label).join(", ")}` : "The product is why people look",
    value: mine ? "—" : "Pick",
    note: mine ? "pick an event" : "one that stands out",
  };
}

function HookScreen({ data, back }: { data: Insights; back: string }) {
  const href = useHref();
  const hook = data.hook;
  const mine = firstOfMine(hook);
  const production = useProductionAt(data.event?.slug ?? null);
  const event = data.event;

  const early = hook?.early ?? null;
  const earlyData = !early
    ? null
    : early.sold.medianDays !== null
      ? `Listings here that sold went up a median ${earlyText(early.sold.medianDays)} (${sampleText(early.sold.sample)}).${
          early.unsold.medianDays !== null ? ` Those that did not: ${earlyText(early.unsold.medianDays)}.` : ""
        }`
      : `Not enough sales yet to compare: ${sampleText(early.sold.sample)} sold so far; a figure shows from ${data.minSample} creators.`;

  const deals = hook?.contentDeals ?? null;
  const dealData = !deals
    ? null
    : deals.pct !== null
      ? `${pctText(deals.pct)} of the brands that took a spot also bought content from the same creator (${plural(deals.sample.sponsors, "brand")}, ${plural(deals.sample.creators, "creator")}).`
      : `Not enough yet to show how often: ${plural(deals.sample.creators, "creator")} with a spot sold so far; a figure shows from ${data.minSample}.`;

  const rows: { key: string; title: string; body: string; data: string | null; action?: ReactNode }[] = [
    {
      key: "early",
      title: "Be early",
      body: mine
        ? mine.rank !== null
          ? `Your ${mine.product.toLowerCase()} went up ${mine.daysBeforeEvent !== null ? earlyText(mine.daysBeforeEvent) : ""}, the ${ordinal(mine.rank)} of ${mine.sameProduct} at ${where(event)}. The first ones land on a timeline that is not full yet.`
          : "Pick an event to see how early you went up, and in what order on your product."
        : "Go up before the timeline fills: the first listings on a product get seen before the rest.",
      data: earlyData,
    },
    {
      key: "unusual",
      title: "Be out of the ordinary",
      body: hook?.leastCrowded.length
        ? `Fewest listings ${event ? `at ${event.name}` : "on HOLD Spaces"}: ${hook.leastCrowded.map((p) => `${p.label} (${p.listings})`).join(", ")}. Something people do not expect to see is what they stop for.`
        : "Something people do not expect to see is what they stop for.",
      data: hook ? sampleText(hook.sample) : null,
      action: hook?.leastCrowded[0] ? (
        <Link href={href(`/listings/new?template=${encodeURIComponent(hook.leastCrowded[0].key)}`)} className={chipLink}>
          List a {hook.leastCrowded[0].label.toLowerCase()}
        </Link>
      ) : null,
    },
    {
      key: "content",
      title: "A spot is the start of a content deal",
      body: "The product gets their attention. What they pay for is your reach and the content you make, so when a brand takes a spot, offer them content for their own channels.",
      data: dealData,
      action: production ? (
        <Link href={href("/sales")} className={chipLink}>
          Your sales
        </Link>
      ) : (
        <Link href={href(`/listings/new?template=${PRODUCTION_TEMPLATE}`)} className={chipLink}>
          Create a Content production listing
        </Link>
      ),
    },
  ];

  const head = hookHeadline(data);
  return (
    <Screen
      back={back}
      data={data}
      title="Your hook"
      big={mine && mine.rank !== null ? ordinal(mine.rank) : head.value}
      bigNote={
        mine && mine.rank !== null
          ? `${mine.product} of ${mine.sameProduct} at ${where(event)}${mine.daysBeforeEvent !== null ? `, ${earlyText(mine.daysBeforeEvent)}` : ""}`
          : head.line
      }
      aside={
        <>
          The product is the hook: it is why people look. What a brand pays for is your reach and the content you make.
          {!hook ? " Your order and the least crowded products show once this screen can read them." : ""}
        </>
      }
    >
      <Panel title="What worked" meta={where(event)}>
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.key} className="flex min-w-0 flex-col gap-1.5 border-t border-white/[0.08] py-3 first:border-t-0 first:pt-0">
              <p className="text-[14.5px] font-bold text-white">{r.title}</p>
              <p className="text-[14px] leading-5 text-white/[0.82]">{r.body}</p>
              {r.data ? <p className="text-[12px] leading-4 text-white/55">{r.data}</p> : null}
              {r.action ? <div className="pt-1">{r.action}</div> : null}
            </li>
          ))}
        </ul>
      </Panel>
    </Screen>
  );
}


/* ── Your numbers ─────────────────────────────────────────────────── */

function medianText(m: Median, fmt: (n: number) => string): ReactNode {
  return m.value !== null ? fmt(m.value) : <span className="text-[12px] text-white/55">{plural(m.creators, "creator")}, not enough</span>;
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
              <Link href={href("/listings/new")} className={`${ctaPrimary} !w-auto`}>
                Create a space
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
        m.raisedCents.value === null
          ? `The median shows from ${data.minSample} creators at the same event.`
          : `Medians are the middle creator of ${sampleText(y.sample)}, rounded; nobody's exact receipt is shown.`
      }
    >
      <Panel title="You and the median creator" meta={where(data.event)}>
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-[12px] leading-4 text-white/55">
          <span />
          <span>You</span>
          <span>Median</span>
        </div>
        <ul className="mt-2 flex flex-col">
          {rows.map((r) => (
            <li
              key={r.label}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-3 border-t border-white/[0.08] py-2.5 first:border-t-0"
            >
              <span className="truncate text-[14px] leading-5 text-white/[0.82]">{r.label}</span>
              <span className="truncate text-[14px] font-strong tabular-nums text-white">{r.you}</span>
              <span className="truncate text-[14px] tabular-nums text-white/[0.82]">{r.median}</span>
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

  return (
    <Screen
      back={back}
      data={data}
      title="What sells"
      big={top ? pctText(top.pct!) : "—"}
      bigNote={top ? `of spots filled on ${top.label.toLowerCase()}, the best surface here` : `Not enough sales yet at ${where(data.event)}`}
    >
      <Panel title="Spots filled" meta={sampleText(w.sample)} action={<Segmented label="Group by" value={by} onChange={setBy} options={[{ value: "surface", label: "Surface" }, { value: "product", label: "Product" }]} />}>
        {rows.length === 0 ? (
          <TooFew data={data} sample={w.sample} watch="The first listings here will show which surfaces sponsors pick." />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((r) => (
                <BarRow key={r.key} label={r.label} pct={r.filledPct} filled={r.filled} total={r.placements} sub={`${sellSub(r)} · ${plural(r.sample.creators, "creator")}`} />
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
          A listing counts in the band of its cheapest spot.
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

  return (
    <Screen
      back={back}
      data={data}
      title="Timing"
      big={t.medianDaysToFirstSale !== null ? daysText(t.medianDaysToFirstSale) : "—"}
      bigNote={t.medianDaysToFirstSale !== null ? "from going live to a first sale, median" : `Not enough sales yet at ${where(data.event)}`}
      aside="Days are counted in UTC."
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
                grid
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

  return (
    <Screen
      back={back}
      data={data}
      title="Brands buying"
      big={String(list.brands.length)}
      bigNote={`${list.brands.length === 1 ? "brand has" : "brands have"} paid for a spot ${scope === "event" ? `at ${where(data.event)}` : "on HOLD Spaces"}`}
      aside="Names as the listings show them publicly, from paid orders only. Spend is a band, never an amount."
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
            <p className="text-[14.5px] text-white">No brand has paid here yet.</p>
            <p className="text-[12px] leading-4 text-white/55">
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
    <li className="flex min-w-0 items-center gap-3 border-t border-white/[0.08] py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] text-white">
          {brand.name}
          {brand.handle ? <span className="ml-2 text-[12px] leading-4 text-white/55">@{brand.handle}</span> : null}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-4 text-white/55">{bits}</p>
      </div>
      <Link href={pitch} scroll={false} className={chipLink}>
        Pitch
      </Link>
    </li>
  );
}

/* ── Pitch a brand ────────────────────────────────────────────────── */

/** What this creator sells at the event, from their own listings. */
function useWhatISell(data: Insights) {
  const { listings } = useShell();
  const kindOf = useListingKind();
  return useMemo(() => {
    const here = listings.filter((l) => l.status !== "draft" && (!data.event || l.event?.slug === data.event.slug));
    const hooks = here.filter((l) => kindOf(l) === "placement").map((l) => l.title);
    const content = here.filter((l) => kindOf(l) === "service").map((l) => l.serviceName || l.title);
    const open = here.reduce((n, l) => n + Math.max(0, l.totals.positions - l.totals.sold), 0);
    return { hooks, content, open, placements: hooks.length > 0, services: content.length > 0 };
  }, [listings, data.event, kindOf]);
}

/**
 * The strongest honest line the market gives for what this creator sells;
 * null when it gives none. A creator selling videos is not pitched on how
 * suitcases fill.
 */
function marketLine(data: Insights, sells: { placements: boolean; services: boolean }): string | null {
  const s = data.whatSells.surfaces;
  const objects = s.find((r) => r.key === "object")?.filledPct ?? null;
  const clothing = s.find((r) => r.key === "clothing")?.filledPct ?? null;
  const services = s.find((r) => r.key === "service")?.filledPct ?? null;
  const at = data.event ? `at ${data.event.name}` : "on HOLD Spaces";
  if (sells.services && !sells.placements) {
    return services !== null ? `On HOLD Spaces ${at}, ${pctText(services)} of sponsored content slots have been bought by brands.` : null;
  }
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
  /** The creator's listings on a product here: the hook. */
  hooks: string[];
  /** Their content listings here: what they make for a brand. */
  content: string[];
  open: number;
  /** What the creator sells here: spots on a product, content slots, or both. */
  placements: boolean;
  services: boolean;
  link: string | null;
}): string {
  const { brand, handle, followers, data, hooks, content, open, link, placements, services } = input;
  const y = data.you;
  const me = handle ? `@${handle}` : "a creator on HOLD Spaces";
  const event = data.event;
  const lines: string[] = [];
  lines.push(`Hi ${brand} team,`, "");
  lines.push(
    event
      ? `I'm ${me}, and I'll be at ${event.name} in ${event.city} (${eventDates(event.startsOn, event.endsOn)}).`
      : `I'm ${me}.`,
  );
  lines.push("");

  // What the brand buys: the reach, then the content. The product comes after, as the hook.
  lines.push(`What ${brand} gets is my reach and the content I make${event ? ` there` : ""}:`);
  if (followers) lines.push(`- ${compact(followers)} followers on X see what I post${event ? ` from ${event.name}` : ""}.`);
  lines.push(`- Photos and posts tagging ${brand}, with the link you want.`);
  if (services) lines.push(`- Content made for ${brand}${event ? ` at ${event.name}` : ""}: ${content.slice(0, 3).join(", ")}.`);
  lines.push("");

  if (hooks.length) {
    const floor = y.floorCents !== null ? `, from ${dollars(y.floorCents)}` : "";
    lines.push(`The hook: your logo on ${hooks.slice(0, 2).map((h) => `"${h}"`).join(" and ")}${floor}. It's what makes people stop and look.`);
  }
  const proof: string[] = [];
  if (y.placements.filled > 0) proof.push(`${y.placements.filled} of my ${y.placements.total} spots here are already taken${open ? `, ${plural(open, "spot")} still open` : ""}.`);
  const market = marketLine(data, { placements, services });
  if (market) proof.push(market);
  for (const p of proof) lines.push(p);
  if (hooks.length || proof.length) lines.push("");

  lines.push("Paid in USDC straight to me; your spot is yours the moment it's paid.");
  lines.push(link ? `Everything is here: ${link}` : "I can send the link to the listing.");
  lines.push(`If you want content for your own channels too, I can shoot it${event ? ` at ${event.name}` : ""}.`, "", handle ? `@${handle}` : "");
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
        hooks: mine.hooks,
        content: mine.content,
        open: mine.open,
        placements: mine.placements,
        services: mine.services,
        link: handle ? `${SITE_URL}/s/${handle}` : null,
      })
    : "";

  return (
    <div className="flex flex-col gap-3.5">
      <DrillBar back={back} crumb={`Insights · ${where(data.event)}`} title="Pitch a brand" right={text ? <CopyButton value={text} label="Copy pitch" className={chipLink} /> : null} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
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
            <div>
              <p className="mb-2 text-[12px] leading-4 text-white/55">Brands that already paid on HOLD Spaces</p>
              <FilterPills label="Brands" value={known.includes(name) ? name : ""} onChange={setBrand} options={known.map((b) => ({ value: b, label: b }))} />
            </div>
          ) : (
            <p className="text-[12px] leading-4 text-white/55">No brand has paid here yet. Type the one you want to reach.</p>
          )}
          <p className="mt-1 border-t border-white/[0.08] pt-3 text-[12px] leading-[17px] text-white/55">
            It leads with your reach and your content, with the product as the hook. Built from your own numbers; nothing is sent: copy it and send it where you talk to brands.
          </p>
        </Panel>
        <Panel title={name ? `For ${name}` : "Your pitch"} meta={name ? `${text.split("\n").length} lines` : ""}>
          {name ? (
            <pre className="max-h-[calc(var(--app-vh,100dvh)-260px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[14.5px] leading-[22px] text-white">
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

