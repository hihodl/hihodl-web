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
import { currentIntl, listText, t as tr } from "@/lib/app/i18n";
import { fmtCompact, fmtNumber, fmtPercent } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

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

const pctText = (n: number) => fmtPercent(n / 100, Number.isInteger(n) ? 0 : 1);
const daysText = (n: number) => tr("spaces.days.count", { count: n });
/** Raised per follower: USDC, in dollars as the rest of Spaces shows it. */
const perFollower = (n: number) => {
  const digits = n >= 0.01 ? 2 : 4;
  return `$${fmtNumber(n, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const compact = (n: number) => fmtCompact(n);

/** 1st, 2nd, 3rd, 4th, 11th, 21st: the language's own ordinal. */
export function ordinal(n: number): string {
  let rule = "other";
  try {
    rule = new Intl.PluralRules(currentIntl(), { type: "ordinal" }).select(n);
  } catch {
    rule = new Intl.PluralRules("en", { type: "ordinal" }).select(n);
  }
  return tr("spaces.insights.ordinal", { rule, n: fmtNumber(n) });
}

function sampleText(s: { creators: number; listings: number }): string {
  return tr("spaces.insights.sample", { creators: s.creators, listings: s.listings });
}

function where(event: InsightsEvent | null): string {
  return event ? event.name : "HOLD Spaces";
}

/** The event's own line: city and dates. */
function eventLine(event: InsightsEvent | null): string {
  if (!event) return tr("spaces.insights.everyEvent");
  return [event.city, eventDates(event.startsOn, event.endsOn)].filter(Boolean).join(" · ");
}

/* ── The screen ───────────────────────────────────────────────────── */

export function InsightsScreen({ event, view, brand }: { event: string | null; view: string | null; brand: string | null }) {
  useT();
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
  const t = useT();
  const router = useRouter();
  const href = useHref();
  const value = data.event?.slug ?? "all";
  const options = [...data.events.map((e) => ({ value: e.slug, label: e.name })), { value: "all", label: t("spaces.insights.allOfSpaces") }];
  // An event the creator has not listed at (a link from somewhere) still shows as chosen.
  if (data.event && !data.events.some((e) => e.slug === data.event!.slug)) options.unshift({ value: data.event.slug, label: data.event.name });
  return (
    <FilterPills
      label={t("spaces.inspire.fact.event")}
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
  const t = useT();
  const { you, whatSells, pricing, timing, brands } = data;
  const topSurface = best(whatSells.surfaces.map((s) => ({ ...s, pct: s.filledPct })));
  const topBand = best(pricing.bands);
  const brandList = brands.event ?? brands.allTime;
  const needMore = t("spaces.insights.notEnoughAt", { where: where(data.event) });
  const hook = hookHeadline(data);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-extrabold tracking-[-0.3px] text-white">{where(data.event)}</h2>
          <p className="mt-0.5 truncate text-[12px] leading-4 text-white/55">
            {t("spaces.insights.hubLine", { line: eventLine(data.event), sample: sampleText(you.sample) })}
          </p>
        </div>
        <EventSwitch data={data} />
      </div>
      <CardGrid>
        <HubCard href={to("hook")} icon="bulb-outline" title={t("spaces.insights.hook.title")} line={hook.line} value={hook.value} note={hook.note} />
        <HubCard
          href={to("you")}
          icon="person-outline"
          title={t("spaces.insights.you.title")}
          line={you.listings ? t("spaces.insights.spotsFilled", { filled: you.placements.filled, total: you.placements.total }) : t("spaces.insights.noListingHere")}
          value={dollars(you.raisedCents)}
          note={t("spaces.insights.raised")}
        />
        <HubCard
          href={to("sells")}
          icon="stats-chart-outline"
          title={t("spaces.insights.sells.title")}
          line={topSurface ? t("spaces.insights.fillBest", { label: topSurface.label }) : needMore}
          value={topSurface ? pctText(topSurface.pct!) : "—"}
          note={topSurface ? t("spaces.insights.ofSpotsFilled") : sampleText(whatSells.sample)}
        />
        <HubCard
          href={to("pricing")}
          icon="pricetag-outline"
          title={t("spaces.insights.pricing.title")}
          line={topBand ? t("spaces.insights.floorsSellMost", { label: topBand.label }) : needMore}
          value={topBand ? pctText(topBand.pct!) : "—"}
          note={topBand ? t("spaces.insights.soldAtLeastOne") : sampleText(pricing.sample)}
        />
        <HubCard
          href={to("timing")}
          icon="calendar-outline"
          title={t("spaces.insights.timing.title")}
          line={timing.medianDaysToFirstSale !== null ? t("spaces.insights.toFirstSaleMedian") : needMore}
          value={timing.medianDaysToFirstSale !== null ? daysText(timing.medianDaysToFirstSale) : "—"}
          note={t("spaces.n.creators", { count: timing.medianDaysToFirstSaleSample.creators })}
        />
        <HubCard
          href={to("brands")}
          icon="business-outline"
          title={t("spaces.insights.brands.title")}
          line={brandList.brands.length ? brandList.brands.slice(0, 3).map((b) => b.name).join(", ") : t("spaces.insights.noNamedBrand")}
          value={String(brandList.brands.length)}
          note={brands.event ? t("spaces.insights.here") : t("spaces.insights.allTimeLower")}
        />
        <HubCard
          href={to("pitch")}
          icon="megaphone-outline"
          title={t("spaces.insights.pitch.title")}
          line={t("spaces.insights.pitch.hubLine")}
          value={t("spaces.insights.pitch.write")}
          note={t("spaces.insights.pitch.copyAndSend")}
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
  const t = useT();
  return (
    <div className="flex flex-col gap-3.5">
      <DrillBar back={back} crumb={t("spaces.insights.crumb", { where: where(data.event) })} title={title} />
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
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <p className="text-[14.5px] text-white">{t("spaces.insights.notEnoughAtDot", { where: where(data.event) })}</p>
      <p className="text-[12px] leading-4 text-white/55">
        {t("spaces.insights.tooFew", { sample: sampleText(sample), min: data.minSample })} {watch}
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
  const t = useT();
  return (
    <li className={`flex min-w-0 flex-col gap-1.5 border-t border-white/[0.08] py-2.5 ${grid ? "" : "first:border-t-0 first:pt-0"}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-[14.5px] text-white">{label}</p>
        <p className="shrink-0 text-[14px] font-strong tabular-nums text-white">{right ?? (pct !== null ? pctText(pct) : <span className="text-[12px] text-white/55">{t("spaces.insights.notEnoughYet")}</span>)}</p>
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
  if (days > 0) return tr("spaces.insights.early.before", { days: daysText(days) });
  if (days === 0) return tr("spaces.insights.early.firstDay");
  return tr("spaces.insights.early.after");
}

function hookHeadline(data: Insights): { line: string; value: string; note: string } {
  const hook = data.hook;
  const mine = firstOfMine(hook);
  if (mine && mine.rank !== null) {
    const d = mine.daysBeforeEvent;
    return {
      line:
        d === null
          ? mine.product
          : d > 0
            ? tr("spaces.insights.hook.lineEarly", { product: mine.product, days: daysText(d) })
            : d === 0
              ? tr("spaces.insights.hook.lineDayOne", { product: mine.product })
              : tr("spaces.insights.hook.lineAfter", { product: mine.product }),
      value: ordinal(mine.rank),
      note: tr("spaces.insights.hook.ofListings", { count: mine.sameProduct }),
    };
  }
  const open = hook?.leastCrowded ?? [];
  return {
    line: open.length ? tr("spaces.insights.hook.fewestHere", { labels: open.slice(0, 2).map((p) => p.label).join(", ") }) : tr("spaces.insights.hook.whyLook"),
    value: mine ? "—" : tr("spaces.insights.hook.pick"),
    note: mine ? tr("spaces.insights.hook.pickEvent") : tr("spaces.insights.hook.standsOut"),
  };
}

function HookScreen({ data, back }: { data: Insights; back: string }) {
  const t = useT();
  const href = useHref();
  const hook = data.hook;
  const mine = firstOfMine(hook);
  const production = useProductionAt(data.event?.slug ?? null);
  const event = data.event;

  const early = hook?.early ?? null;
  const earlyData = !early
    ? null
    : early.sold.medianDays !== null
      ? early.unsold.medianDays !== null
        ? t("spaces.insights.hook.earlyDataBoth", {
            sold: earlyText(early.sold.medianDays),
            sample: sampleText(early.sold.sample),
            unsold: earlyText(early.unsold.medianDays),
          })
        : t("spaces.insights.hook.earlyData", { sold: earlyText(early.sold.medianDays), sample: sampleText(early.sold.sample) })
      : t("spaces.insights.hook.earlyTooFew", { sample: sampleText(early.sold.sample), min: data.minSample });

  const deals = hook?.contentDeals ?? null;
  const dealData = !deals
    ? null
    : deals.pct !== null
      ? t("spaces.insights.hook.dealData", { pct: pctText(deals.pct), brands: deals.sample.sponsors, creators: deals.sample.creators })
      : t("spaces.insights.hook.dealTooFew", { creators: deals.sample.creators, min: data.minSample });

  const rows: { key: string; title: string; body: string; data: string | null; action?: ReactNode }[] = [
    {
      key: "early",
      title: t("spaces.insights.hook.beEarly"),
      body: mine
        ? mine.rank !== null
          ? t("spaces.insights.hook.beEarlyMine", {
              product: mine.product.toLowerCase(),
              when: mine.daysBeforeEvent !== null ? earlyText(mine.daysBeforeEvent) : "",
              rank: ordinal(mine.rank),
              of: mine.sameProduct,
              where: where(event),
            })
          : t("spaces.insights.hook.beEarlyPick")
        : t("spaces.insights.hook.beEarlyBody"),
      data: earlyData,
    },
    {
      key: "unusual",
      title: t("spaces.insights.hook.unusual"),
      body: hook?.leastCrowded.length
        ? t("spaces.insights.hook.fewestListings", {
            at: event ? "event" : "spaces",
            event: event?.name,
            list: hook.leastCrowded.map((p) => `${p.label} (${p.listings})`).join(", "),
          })
        : t("spaces.insights.hook.stopFor"),
      data: hook ? sampleText(hook.sample) : null,
      action: hook?.leastCrowded[0] ? (
        <Link href={href(`/listings/new?template=${encodeURIComponent(hook.leastCrowded[0].key)}`)} className={chipLink}>
          {t("spaces.insights.hook.listA", { product: hook.leastCrowded[0].label.toLowerCase() })}
        </Link>
      ) : null,
    },
    {
      key: "content",
      title: t("spaces.insights.hook.contentDeal"),
      body: t("spaces.insights.hook.contentDealBody"),
      data: dealData,
      action: production ? (
        <Link href={href("/sales")} className={chipLink}>
          {t("spaces.insights.hook.yourSales")}
        </Link>
      ) : (
        <Link href={href(`/listings/new?template=${PRODUCTION_TEMPLATE}`)} className={chipLink}>
          {t("spaces.insights.hook.createProduction")}
        </Link>
      ),
    },
  ];

  const head = hookHeadline(data);
  return (
    <Screen
      back={back}
      data={data}
      title={t("spaces.insights.hook.title")}
      big={mine && mine.rank !== null ? ordinal(mine.rank) : head.value}
      bigNote={
        mine && mine.rank !== null
          ? mine.daysBeforeEvent !== null
            ? t("spaces.insights.hook.bigNoteWhen", { product: mine.product, of: mine.sameProduct, where: where(event), when: earlyText(mine.daysBeforeEvent) })
            : t("spaces.insights.hook.bigNote", { product: mine.product, of: mine.sameProduct, where: where(event) })
          : head.line
      }
      aside={hook ? t("spaces.insights.hook.aside") : t("spaces.insights.hook.asideNoHook")}
    >
      <Panel title={t("spaces.insights.hook.whatWorked")} meta={where(event)}>
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
  return m.value !== null ? fmt(m.value) : <span className="text-[12px] text-white/55">{tr("spaces.insights.you.notEnough", { count: m.creators })}</span>;
}

function YouScreen({ data, back }: { data: Insights; back: string }) {
  const t = useT();
  const href = useHref();
  const y = data.you;
  const m = y.median;
  if (y.listings === 0) {
    return (
      <Screen
        back={back}
        data={data}
        title={t("spaces.insights.you.title")}
        big="$0"
        bigNote={t("spaces.insights.you.noListing", { where: where(data.event) })}
        aside={t("spaces.insights.you.noListingAside")}
      >
        <Panel>
          <EmptyState
            title={t("spaces.insights.you.publishToCompare")}
            action={
              <Link href={href("/listings/new")} className={`${ctaPrimary} !w-auto`}>
                {t("spaces.overview.createSpace")}
              </Link>
            }
          />
        </Panel>
      </Screen>
    );
  }
  const rows: { label: string; you: ReactNode; median: ReactNode }[] = [
    { label: t("spaces.insights.you.raisedPaid"), you: dollars(y.raisedCents), median: medianText(m.raisedCents, dollars) },
    {
      label: t("spaces.insights.you.spotsFilled"),
      you: `${t("spaces.insights.xOfY", { x: y.placements.filled, y: y.placements.total })}${y.placements.pct !== null ? ` · ${pctText(y.placements.pct)}` : ""}`,
      median: medianText(m.filledPct, pctText),
    },
    { label: t("spaces.insights.you.daysLive"), you: y.daysLive !== null ? daysText(y.daysLive) : "—", median: medianText(m.daysLive, daysText) },
    {
      label: t("spaces.insights.you.daysToFirstSale"),
      you: y.daysToFirstSale !== null ? daysText(y.daysToFirstSale) : t("spaces.insights.you.noSaleYet"),
      median: medianText(m.daysToFirstSale, daysText),
    },
    {
      label: t("spaces.insights.you.perFollower"),
      you: y.usdPerFollower !== null ? perFollower(y.usdPerFollower) : y.followers === null ? t("spaces.insights.you.noFollowerCount") : "—",
      median: medianText(m.usdPerFollower, perFollower),
    },
    { label: t("spaces.insights.you.floor"), you: y.floorCents !== null ? dollars(y.floorCents) : "—", median: medianText(m.floorCents, dollars) },
  ];
  return (
    <Screen
      back={back}
      data={data}
      title={t("spaces.insights.you.title")}
      big={dollars(y.raisedCents)}
      bigNote={t("spaces.insights.you.raisedAt", { where: where(data.event) })}
      aside={
        m.raisedCents.value === null
          ? t("spaces.insights.you.medianFrom", { min: data.minSample })
          : t("spaces.insights.you.mediansAre", { sample: sampleText(y.sample) })
      }
    >
      <Panel title={t("spaces.insights.you.panel")} meta={where(data.event)}>
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-[12px] leading-4 text-white/55">
          <span />
          <span>{t("common.you")}</span>
          <span>{t("spaces.insights.you.median")}</span>
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
  const parts = [tr("spaces.n.listings", { count: r.listings }), tr("spaces.insights.sells.spotsOf", { filled: r.filled, total: r.placements })];
  if (r.moneyShare !== null) parts.push(tr("spaces.insights.sells.ofMoney", { pct: pctText(r.moneyShare) }));
  return parts.join(" · ");
}

function SellsScreen({ data, back }: { data: Insights; back: string }) {
  const t = useT();
  const [by, setBy] = useState<"surface" | "product">("surface");
  const w = data.whatSells;
  const rows = by === "surface" ? w.surfaces : w.products;
  const paged = usePaged(rows, by, 6);
  const top = best(w.surfaces.map((s) => ({ ...s, pct: s.filledPct })));

  return (
    <Screen
      back={back}
      data={data}
      title={t("spaces.insights.sells.title")}
      big={top ? pctText(top.pct!) : "—"}
      bigNote={top ? t("spaces.insights.sells.bigNote", { surface: top.label.toLowerCase() }) : t("spaces.insights.notEnoughAt", { where: where(data.event) })}
    >
      <Panel
        title={t("spaces.insights.you.spotsFilled")}
        meta={sampleText(w.sample)}
        action={
          <Segmented
            label={t("spaces.overview.sells.groupBy")}
            value={by}
            onChange={setBy}
            options={[
              { value: "surface", label: t("spaces.insights.sells.surface") },
              { value: "product", label: t("spaces.overview.sells.product") },
            ]}
          />
        }
      >
        {rows.length === 0 ? (
          <TooFew data={data} sample={w.sample} watch={t("spaces.insights.sells.watch")} />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((r) => (
                <BarRow key={r.key} label={r.label} pct={r.filledPct} filled={r.filled} total={r.placements} sub={`${sellSub(r)} · ${t("spaces.n.creators", { count: r.sample.creators })}`} />
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
  const t = useT();
  const [by, setBy] = useState<"floor" | "way">("floor");
  const p = data.pricing;
  const top = best(p.bands);
  const ways = p.ways.filter((w) => w.placements > 0);

  return (
    <Screen
      back={back}
      data={data}
      title={t("spaces.insights.pricing.title")}
      big={top ? pctText(top.pct!) : "—"}
      bigNote={top ? t("spaces.insights.pricing.bigNote", { label: top.label }) : t("spaces.insights.notEnoughAt", { where: where(data.event) })}
      aside={
        p.sample.unpriced
          ? t("spaces.insights.pricing.asideUnpriced", { count: p.sample.unpriced })
          : t("spaces.insights.pricing.aside")
      }
    >
      <Panel
        title={by === "floor" ? t("spaces.insights.pricing.floor") : t("spaces.inspire.fact.howItSells")}
        meta={sampleText(p.sample)}
        action={
          <Segmented
            label={t("spaces.deliveries.show")}
            value={by}
            onChange={setBy}
            options={[
              { value: "floor", label: t("spaces.insights.pricing.floor") },
              { value: "way", label: t("spaces.insights.pricing.fixedOrOffers") },
            ]}
          />
        }
      >
        {p.sample.listings === 0 ? (
          <TooFew data={data} sample={p.sample} watch={t("spaces.insights.pricing.watch")} />
        ) : by === "floor" ? (
          <ul className="flex flex-col">
            {p.bands.map((b) => (
              <BarRow key={b.key} label={b.label} pct={b.pct} filled={b.withSale} total={b.listings} sub={`${t("spaces.insights.pricing.bandSold", { sold: b.withSale, count: b.listings })} · ${sampleText(b.sample)}`} />
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col">
            {ways.map((w) => (
              <BarRow key={w.key} label={w.label} pct={w.filledPct} filled={w.filled} total={w.placements} sub={`${t("spaces.insights.pricing.wayFilled", { filled: w.filled, count: w.placements })} · ${sampleText(w.sample)}`} />
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
  const tt = useT();
  const t = data.timing;

  return (
    <Screen
      back={back}
      data={data}
      title={tt("spaces.insights.timing.title")}
      big={t.medianDaysToFirstSale !== null ? daysText(t.medianDaysToFirstSale) : "—"}
      bigNote={t.medianDaysToFirstSale !== null ? tt("spaces.insights.timing.bigNote") : tt("spaces.insights.notEnoughAt", { where: where(data.event) })}
      aside={tt("spaces.insights.timing.utc")}
    >
      <Panel
        title={by === "age" ? tt("spaces.insights.timing.byAge") : tt("spaces.insights.timing.launchDay")}
        meta={sampleText(t.sample)}
        action={
          <Segmented
            label={tt("spaces.deliveries.show")}
            value={by}
            onChange={setBy}
            options={[
              { value: "age", label: tt("spaces.insights.timing.listingAge") },
              { value: "day", label: tt("spaces.insights.timing.launchDay") },
            ]}
          />
        }
      >
        {t.sample.listings === 0 ? (
          <TooFew data={data} sample={t.sample} watch={tt("spaces.insights.timing.watch")} />
        ) : by === "age" ? (
          <ul className="flex flex-col">
            {t.ages.map((a) => (
              <BarRow key={a.key} label={a.label} pct={a.filledPct} filled={a.filled} total={a.placements} sub={`${tt("spaces.insights.timing.ageFilled", { filled: a.filled, count: a.placements })} · ${sampleText(a.sample)}`} />
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
                sub={
                  d.firstWeekSalesPerListing !== null
                    ? `${tt("spaces.n.listings", { count: d.listings })} · ${tt("spaces.insights.timing.weekOne", { n: fmtNumber(d.firstWeekSalesPerListing) })}`
                    : tt("spaces.n.listings", { count: d.listings })
                }
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
  const t = useT();

  return (
    <Screen
      back={back}
      data={data}
      title={t("spaces.insights.brands.title")}
      big={String(list.brands.length)}
      bigNote={
        scope === "event"
          ? t("spaces.insights.brands.bigNoteAt", { count: list.brands.length, where: where(data.event) })
          : t("spaces.insights.brands.bigNoteAll", { count: list.brands.length })
      }
      aside={t("spaces.insights.brands.aside")}
    >
      <Panel
        title={t("spaces.insights.brands.whoPaid")}
        meta={t("spaces.insights.brands.meta", { count: list.sample.paidOrders, named: list.sample.named })}
        action={
          data.brands.event ? (
            <Segmented
              label={t("spaces.insights.brands.where")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "event", label: where(data.event) },
                { value: "all", label: t("spaces.insights.brands.allTime") },
              ]}
            />
          ) : null
        }
      >
        {list.brands.length === 0 ? (
          <div className="flex flex-col gap-1.5 py-2">
            <p className="text-[14.5px] text-white">{t("spaces.insights.brands.noneHere")}</p>
            <p className="text-[12px] leading-4 text-white/55">
              {t("spaces.insights.brands.noneHereBody")}
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
  const t = useT();
  const bits = [t("spaces.n.spots", { count: brand.placements }), brand.spendBandLabel, brand.country].filter(Boolean).join(" · ");
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
        {t("spaces.insights.brands.pitch")}
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
  const at = data.event ? tr("spaces.insights.pitch.atEvent", { event: data.event.name }) : tr("spaces.insights.pitch.onSpaces");
  if (sells.services && !sells.placements) {
    return services !== null ? tr("spaces.insights.pitch.marketServices", { at, pct: pctText(services) }) : null;
  }
  if (objects !== null && clothing !== null && clothing > 0 && objects / clothing >= 1.5) {
    const ratio = objects / clothing;
    const digits = ratio >= 10 ? 0 : 1;
    return tr("spaces.insights.pitch.marketObjects", { at, ratio: fmtNumber(ratio, { minimumFractionDigits: digits, maximumFractionDigits: digits }) });
  }
  const top = best(s.map((r) => ({ ...r, pct: r.filledPct })));
  if (top) return tr("spaces.insights.pitch.marketTop", { at, pct: pctText(top.pct!), surface: top.label.toLowerCase() });
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
  const me = handle ? `@${handle}` : tr("spaces.insights.pitch.aCreator");
  const event = data.event;
  const ev = event ? "yes" : "no";
  const lines: string[] = [];
  lines.push(tr("spaces.insights.pitch.hi", { brand }), "");
  lines.push(
    event
      ? tr("spaces.insights.pitch.imAt", { me, event: event.name, city: event.city, dates: eventDates(event.startsOn, event.endsOn) })
      : tr("spaces.insights.pitch.im", { me }),
  );
  lines.push("");

  // What the brand buys: the reach, then the content. The product comes after, as the hook.
  lines.push(tr("spaces.insights.pitch.whatGets", { brand, ev }));
  if (followers) lines.push(tr("spaces.insights.pitch.followers", { followers: compact(followers), ev, event: event?.name }));
  lines.push(tr("spaces.insights.pitch.photos", { brand }));
  if (services) lines.push(tr("spaces.insights.pitch.contentMade", { brand, ev, event: event?.name, content: content.slice(0, 3).join(", ") }));
  lines.push("");

  if (hooks.length) {
    const on = listText(hooks.slice(0, 2).map((h) => `"${h}"`));
    lines.push(
      y.floorCents !== null
        ? tr("spaces.insights.pitch.hookFrom", { on, floor: dollars(y.floorCents) })
        : tr("spaces.insights.pitch.hook", { on }),
    );
  }
  const proof: string[] = [];
  if (y.placements.filled > 0) {
    proof.push(
      open
        ? tr("spaces.insights.pitch.takenOpen", { filled: y.placements.filled, total: y.placements.total, open })
        : tr("spaces.insights.pitch.taken", { filled: y.placements.filled, total: y.placements.total }),
    );
  }
  const market = marketLine(data, { placements, services });
  if (market) proof.push(market);
  for (const p of proof) lines.push(p);
  if (hooks.length || proof.length) lines.push("");

  lines.push(tr("spaces.insights.pitch.paid"));
  lines.push(link ? tr("spaces.insights.pitch.everything", { link }) : tr("spaces.insights.pitch.sendLink"));
  lines.push(tr("spaces.insights.pitch.shoot", { ev, event: event?.name }), "", handle ? `@${handle}` : "");
  return lines.join("\n").trimEnd();
}

function PitchScreen({ data, back, initialBrand }: { data: Insights; back: string; initialBrand: string | null }) {
  const t = useT();
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
      <DrillBar
        back={back}
        crumb={t("spaces.insights.crumb", { where: where(data.event) })}
        title={t("spaces.insights.pitch.title")}
        right={text ? <CopyButton value={text} label={t("spaces.insights.pitch.copy")} className={chipLink} /> : null}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Panel title={t("spaces.insights.pitch.whichBrand")}>
          <input
            className={inputCls}
            value={brand}
            maxLength={60}
            placeholder={t("spaces.insights.pitch.typeBrand")}
            onChange={(e) => setBrand(e.target.value)}
            aria-label={t("spaces.insights.pitch.brand")}
          />
          {known.length ? (
            <div>
              <p className="mb-2 text-[12px] leading-4 text-white/55">{t("spaces.insights.pitch.alreadyPaid")}</p>
              <FilterPills label={t("spaces.overview.brands.filter")} value={known.includes(name) ? name : ""} onChange={setBrand} options={known.map((b) => ({ value: b, label: b }))} />
            </div>
          ) : (
            <p className="text-[12px] leading-4 text-white/55">{t("spaces.insights.pitch.noneYet")}</p>
          )}
          <p className="mt-1 border-t border-white/[0.08] pt-3 text-[12px] leading-[17px] text-white/55">
            {t("spaces.insights.pitch.howItWorks")}
          </p>
        </Panel>
        <Panel
          title={name ? t("spaces.insights.pitch.for", { name }) : t("spaces.insights.pitch.yours")}
          meta={name ? t("spaces.insights.pitch.lines", { count: text.split("\n").length }) : ""}
        >
          {name ? (
            <pre className="max-h-[calc(var(--app-vh,100dvh)-260px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[14.5px] leading-[22px] text-white">
              {text}
            </pre>
          ) : (
            <EmptyState title={t("spaces.insights.pitch.pickBrand")} />
          )}
        </Panel>
      </div>
    </div>
  );
}

