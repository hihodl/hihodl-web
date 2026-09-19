"use client";

/**
 * Spaces › Overview's own screens: the creator's business, each opened from
 * its card on the Overview hub, each with Back. One big number on the left,
 * the detail on the right, nothing that scrolls for long.
 *
 *   ?view=brands     Brands you work with: who paid, at which events, who came back
 *   ?view=events     By event: what each event made
 *   ?view=sells      What sells for you: % sold and days to sell, per product, kind, listing
 *   ?view=pay        How brands pay: network, HOLD account or wallet, and the deal
 *   ?view=inspired   Listings other creators credit you for
 *
 * Built from GET /ad-space/me/analytics (lib/creator/analytics.ts): this
 * creator's own paid orders, nothing about anybody else.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { eventDates } from "@/lib/ad-space/format";
import type { BrandRelation, CreatorAnalytics, GroupRow, ListingRow, MixRow } from "@/lib/creator/analytics";

import { useHref } from "../base";
import { dollars, FilterPills, Panel, ProgressBar } from "../ui";
import { DrillBar, Pager, usePaged } from "./cards";

export type OverviewView = "brands" | "events" | "sells" | "pay" | "inspired" | "needs";

const VIEWS: readonly OverviewView[] = ["brands", "events", "sells", "pay", "inspired", "needs"];

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
const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "";

/** "Brands paid our 5% on top" when they did on every sale, else what came out of your price. */
export function feeLine(t: CreatorAnalytics["totals"]): string {
  if (t.orders === 0) return "Brands pay our 5% on top of your price";
  if (t.fee.paidByYouCents === 0) return `Brands paid our 5% on top: you kept 100%`;
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
  aside,
  children,
}: {
  back: string;
  title: string;
  big: ReactNode;
  bigNote: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <DrillBar back={back} crumb={CROSS} title={title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Panel>
          <p className="text-[40px] font-medium leading-none tracking-tight tabular-nums text-text">{big}</p>
          <p className="mt-3 text-small text-[#CFE3EC]">{bigNote}</p>
          {aside ? <div className="mt-5 border-t border-white/[0.06] pt-4 text-tiny leading-relaxed text-[#9FB7C2]">{aside}</div> : null}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

/** A tinted tag. 20px high, 10px radius: half its height, never a 999. */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-[10px] bg-amber/15 px-2 text-[11px] font-medium text-[#FFE2A1]">{children}</span>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <p className="text-small text-text">{title}</p>
      <p className="text-tiny text-[#9FB7C2]">{body}</p>
    </div>
  );
}

/** A brand's logo as the page shows it, or its initial. */
function Logo({ brand }: { brand: Pick<BrandRelation, "name" | "logoUrl"> }) {
  const initial = brand.name.replace(/^@/, "").trim().charAt(0).toUpperCase() || "?";
  return brand.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-[10px] border border-white/10 bg-white object-contain p-1" loading="lazy" />
  ) : (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-small font-medium text-[#CFE3EC]">
      {initial}
    </span>
  );
}

/** One row of a bar list: a label, its money or share, a bar, a small line under it. */
function BarLine({ label, right, value, max, sub }: { label: ReactNode; right: ReactNode; value: number; max: number; sub?: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-small text-text">{label}</p>
        <p className="shrink-0 text-small tabular-nums text-text">{right}</p>
      </div>
      <ProgressBar value={value} max={max} />
      {sub ? <p className="truncate text-tiny text-[#9FB7C2]">{sub}</p> : null}
    </li>
  );
}

/* ── Brands you work with ─────────────────────────────────────────── */

function howPaid(b: BrandRelation): string {
  const chains = b.chains.map((c) => c.label).join(" and ");
  const from = b.payFrom.map((p) => p.label).join(" and ");
  return [chains, from].filter(Boolean).join(" · ");
}

export function BrandsScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const [filter, setFilter] = useState<"all" | "repeat">("all");
  const list = filter === "repeat" ? data.brands.filter((b) => b.repeat) : data.brands;
  const paged = usePaged(list, filter, 6);
  const t = data.totals;
  const top = data.topBrands;
  const maxTop = Math.max(1, ...top.map((b) => b.receivedCents));

  return (
    <Screen
      back={back}
      title="Brands you work with"
      big={String(t.brands)}
      bigNote={`${t.brands === 1 ? "brand has" : "brands have"} paid you`}
      aside={
        <>
          {t.repeatBrands > 0
            ? `${plural(t.repeatBrands, "brand")} came back for a second event or listing: ${t.repeatReceivedPct !== null ? pctText(t.repeatReceivedPct) : "—"} of what you earned.`
            : "No brand has come back yet. A brand that paid once is the easiest one to sell the next event to."}{" "}
          Named as your pages show them, else as your Sales do.
        </>
      }
    >
      {top.length ? (
        <Panel title="Top payers" meta="what reached you">
          <ul className="flex flex-col">
            {top.map((b) => (
              <BarLine
                key={b.key}
                label={b.name}
                right={dollars(b.receivedCents)}
                value={b.receivedCents}
                max={maxTop}
                sub={`${plural(b.orders, "order")} · ${plural(b.events.length || 1, "event")}`}
              />
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel
        title="Every brand"
        meta={plural(list.length, "brand")}
        action={
          <FilterPills
            label="Brands"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: data.brands.length },
              { value: "repeat", label: "Came back", count: t.repeatBrands },
            ]}
          />
        }
      >
        {list.length === 0 ? (
          <Empty
            title={filter === "repeat" ? "Nobody has come back yet." : "No brand has paid you yet."}
            body="A brand shows here the moment its payment lands, with the events it sponsored and how it paid."
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {paged.shown.map((b) => (
                <li key={b.key} className="flex min-w-0 items-start gap-3 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
                  <Logo brand={b} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-small font-medium text-text">{b.name}</p>
                      {b.repeat ? <Tag>Repeat</Tag> : null}
                    </div>
                    <p className="mt-0.5 truncate text-tiny text-[#CFE3EC]">
                      {b.events.length ? b.events.map((e) => e.name).join(", ") : "Not tied to an event"}
                    </p>
                    <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">
                      {[b.handle ? `@${b.handle}` : null, b.firstPaidAt ? `since ${monthYear(b.firstPaidAt)}` : null, howPaid(b)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-small tabular-nums text-text">{dollars(b.receivedCents)}</p>
                    <p className="mt-0.5 text-tiny tabular-nums text-[#9FB7C2]">{plural(b.orders, "order")}</p>
                  </div>
                </li>
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

/* ── By event ─────────────────────────────────────────────────────── */

export function EventsScreen({ data, back }: { data: CreatorAnalytics; back: string }) {
  const rows = data.byEvent;
  const max = Math.max(1, ...rows.map((e) => e.receivedCents));
  const top = rows[0] ?? null;
  const paged = usePaged(rows, rows.length, 6);
  return (
    <Screen
      back={back}
      title="By event"
      big={dollars(data.totals.receivedCents)}
      bigNote={`earned across ${plural(data.totals.events, "event")}`}
      aside={top && top.receivedCents > 0 ? `${top.name} made you the most: ${dollars(top.receivedCents)} from ${plural(top.brands, "brand")}.` : "Every event you list at shows here with what it made."}
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
                    <>
                      {e.name}
                      {e.startsOn ? <span className="ml-2 text-tiny text-[#9FB7C2]">{[e.city, eventDates(e.startsOn, e.endsOn ?? e.startsOn)].filter(Boolean).join(" · ")}</span> : null}
                    </>
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
  const best = [...data.byProduct].filter((p) => p.soldPct !== null && p.spotsTotal > 0).sort((a, b) => b.soldPct! - a.soldPct! || b.receivedCents - a.receivedCents)[0];

  return (
    <Screen
      back={back}
      title="What sells for you"
      big={t.sellThroughPct !== null ? pctText(t.sellThroughPct) : "—"}
      bigNote={`of your spots sold · ${t.spotsSold} of ${t.spotsTotal}`}
      aside={
        <>
          {best ? `${best.label} sells best: ${pctText(best.soldPct!)} of its spots. ` : ""}
          {t.medianDaysToFirstSale !== null ? `A listing of yours takes ${daysText(t.medianDaysToFirstSale)} to a first sale, median.` : "Days to a first sale show once something sells."}
        </>
      }
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
                      <span className="ml-2 text-tiny text-[#9FB7C2]">{dollars(r.cents)}</span>
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
  const hold = data.payMix.byPayFrom.find((m) => m.key === "hold") ?? null;
  return (
    <Screen
      back={back}
      title="How brands pay"
      big={top?.receivedPct != null ? pctText(top.receivedPct) : "—"}
      bigNote={top ? `of your money came on ${top.label}` : "No payment yet"}
      aside={
        <>
          {feeLine(data.totals)}. Every payment goes straight to your wallet in USDC.{" "}
          {hold ? `${pctText(hold.ordersPct ?? 0)} of orders came from a HOLD account. ` : ""}A QR scan and a wallet connected in the browser are the same payment to
          us, so both show as External wallet.
        </>
      }
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
      aside={
        <>
          {block.creators > 0 ? `${plural(block.creators, "creator")} named you on their page. ` : ""}Credit others the same way: “Inspired by” in the listing editor.{" "}
          <Link href={href("/listings/new")} className="text-[#CFE3EC] underline decoration-white/30 underline-offset-2 hover:text-text">
            New listing
          </Link>
        </>
      }
    >
      <Panel title="Who credited you" meta={plural(block.recent.length, "listing")}>
        {block.recent.length === 0 ? (
          <Empty title="Nobody has credited you yet." body="When a creator names you as the inspiration for a listing, it shows here and you get a notification." />
        ) : (
          <ul className="flex flex-col">
            {block.recent.map((l) => (
              <li key={l.spaceId} className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-small text-text">{l.title}</p>
                  <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">
                    {l.creatorHandle ? `@${l.creatorHandle}` : "A creator"}
                    {l.creditedAt ? ` · ${monthYear(l.creditedAt)}` : ""}
                  </p>
                </div>
                {l.path ? (
                  <a href={`${SITE_URL}${l.path}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-tiny text-[#CFE3EC] hover:text-text">
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
