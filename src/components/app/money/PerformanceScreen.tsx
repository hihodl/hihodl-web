"use client";

/**
 * Performance — what your investments are doing, as the HOLD app draws it.
 *
 * Ported from `app/(drawer)/(internal)/invest/performance.tsx`, in its order:
 * the value first and the all-time gain under it, three sections (Overview,
 * Earn, Sold), the allocation ring with its legend, the Holdings / All-time
 * Profit pills over one list, and the coins that passed through and left.
 * The arithmetic is the app's own, ported to lib/app/portfolio.
 *
 *   UNREALISED  money still held, priced against what you paid. Overview.
 *   INTEREST    what the money earned while it sat there. Earn.
 *   REALISED    money that left. Reportable. Sold, and the tax year behind it.
 *
 * WHAT THE WEB LEAVES OUT, AND WHY
 *
 *   • The Fear & Greed card. It is alternative.me, called from the device;
 *     a page will not make that third-party call, and it is the one number on
 *     the app's screen that is not this person's money.
 *   • The asset sheet a row opens in the app, with its pencil. Editing a cost
 *     is a write the web does not make, so a row opens What you paid
 *     (cost/[symbol]) read only, which is the same lots the sheet lists.
 *   • The Earn sheet. Putting SOL to work is a signature; the row says so.
 *
 * WHERE THE FIGURES COME FROM
 *
 * Liquid holdings from `/balances` (every account) priced by `/prices`; the
 * supplied SOL from Kamino, folded into the SOL row as the app folds it (a
 * supply is not a sale, so the basis under `solana::SOL` covers both sides of
 * the wall); what it cost from `/portfolio/cost-basis`; what left from
 * `/portfolio/realized`; the coins no longer held from `/portfolio/lots`.
 * A holding we cannot price or cannot cost says so in its row and in a note;
 * none is averaged into a total that looks complete. Losses are white, never
 * red.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { maskTokenSymbol } from "@/lib/app/display-mode";
import {
  isStable,
  useAllBalances,
  useContainer,
  useCostBasis,
  useLots,
  usePrices,
  useRealized,
  usdOf,
} from "@/lib/app/money";
import {
  moodFor,
  pastHoldings,
  pct,
  ringColours,
  ringSlices,
  shortDate,
  summarisePerformance,
  summariseTaxYear,
  tokenUnits,
  unitPrice,
  usd,
  type HoldingLeg,
} from "@/lib/app/portfolio";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { useShellPrefs } from "../Shell";
import { Skeleton } from "../ui";
import { SolEarnRow, useWorkingSol } from "./InvestScreen";
import { AssetMark, InAppNote, ReadFailed } from "./kit";
import { AllocationCard, AMBER, PortfolioHeader, Pill, UP, glassCard, type DonutSlice } from "./portfolio-kit";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "earn", label: "Earn" },
  { id: "sold", label: "Sold" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Two columns, not three: the ring IS the allocation view. */
const COLUMNS = [
  { id: "value", label: "Holdings" },
  { id: "profit", label: "All-time Profit" },
] as const;
type ColumnId = (typeof COLUMNS)[number]["id"];

/** Tickers with a live earn product today. Derived, so the next one drops out of the sentence on its own. */
const EARNABLE: ReadonlySet<string> = new Set(["SOL"]);

/** The app's dust threshold, applied only where a feed produced a number. */
const DUST_USD = 0.01;

/** Below this, "SOL earned so far" is the "+0.0000" line the app deleted once. */
const MIN_SHOWABLE_EARNED_SOL = 0.0001;

function symbolOf(b: { symbol?: string; tokenId?: string }): string {
  return (b.symbol ?? b.tokenId ?? "").toUpperCase();
}

export function PerformanceScreen() {
  const href = useProductHref();
  const { displayMode } = useShellPrefs();
  const container = useContainer();
  const accounts = useMemo(() => (container.data?.subaccounts ?? []).map((s) => s.slug), [container.data]);
  const balances = useAllBalances(accounts);
  const rows = useMemo(() => Object.values(balances.data ?? {}).flatMap((a) => a.balances), [balances.data]);
  const symbols = useMemo(() => [...new Set(rows.map(symbolOf).filter(Boolean))], [rows]);
  const mints = useMemo(() => [...new Set(rows.map((b) => b.mint).filter((m): m is string => !!m))], [rows]);
  const prices = usePrices(symbols, mints);
  const basis = useCostBasis();
  const working = useWorkingSol();
  const realised = useRealized("all");
  const lots = useLots();

  const [section, setSection] = useState<SectionId>("overview");
  const [column, setColumn] = useState<ColumnId>("value");
  const [pastOpen, setPastOpen] = useState(false);

  const summary = useMemo(() => {
    const wac = new Map<string, { wacUsd: number | null; hasBasis: boolean }>();
    for (const p of basis.data?.positions ?? []) wac.set(`${p.chain.toLowerCase()}|${p.tokenId.toUpperCase()}`, p);
    const legs: HoldingLeg[] = [];
    for (const b of rows) {
      const symbol = symbolOf(b);
      if (!symbol || isStable(symbol)) continue;
      const balance = Number(b.balance);
      if (!Number.isFinite(balance) || balance <= 0) continue;
      const value = prices.data ? usdOf(b, prices.data.prices) : null;
      if (value !== null && value < DUST_USD) continue;
      const chain = (b.chain ?? "").toLowerCase();
      const cb = wac.get(`${chain}|${symbol}`) ?? wac.get(`${(b.chainLegacy ?? "").toLowerCase()}|${symbol}`);
      legs.push({ symbol, chain, balance, valueUsd: value ?? 0, priceKnown: value !== null, wacUsd: cb?.wacUsd ?? null, hasBasis: !!cb?.hasBasis });
    }
    // Supplied SOL is still yours; it only left the wallet for a kToken.
    if (working.sol > 0) {
      const cb = wac.get("solana|SOL");
      legs.push({ symbol: "SOL", chain: "solana", balance: working.sol, valueUsd: working.solUsd, priceKnown: working.solUsd > 0, wacUsd: cb?.wacUsd ?? null, hasBasis: !!cb?.hasBasis });
    }
    return summarisePerformance(legs);
  }, [rows, prices.data, basis.data, working.sol, working.solUsd]);

  const ring = useMemo(() => ringSlices(summary.rows), [summary.rows]);
  const slices: DonutSlice[] = useMemo(() => {
    const colours = ringColours(ring);
    return ring.map((sl) => ({
      id: sl.key,
      label: sl.others ? sl.label : maskTokenSymbol(sl.label, displayMode) || sl.label,
      pct: sl.share,
      color: colours.get(sl.key) ?? AMBER,
    }));
  }, [ring, displayMode]);

  const heldKey = summary.rows.map((r) => r.symbol).sort().join(",");
  const past = useMemo(() => pastHoldings(lots.data ?? [], heldKey ? heldKey.split(",") : [], isStable), [lots.data, heldKey]);

  const sold = useMemo(() => {
    if (!realised.data) return null;
    const s = summariseTaxYear(new Date().getUTCFullYear(), realised.data);
    return { gainUsd: s.netUsd, sales: s.sales.length };
  }, [realised.data]);

  const heldNames = useMemo(() => {
    const syms = summary.rows.map((r) => maskTokenSymbol(r.symbol, displayMode) || r.symbol).filter((sym, i) => !EARNABLE.has(summary.rows[i].symbol));
    if (!syms.length) return null;
    if (syms.length === 1) return { names: syms[0], count: 1 };
    const shown = syms.slice(0, 3);
    const rest = syms.length - shown.length;
    const names = rest > 0 ? `${shown.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}` : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
    return { names, count: syms.length };
  }, [summary.rows, displayMode]);
  const holdsSol = summary.rows.some((r) => r.symbol === "SOL") || working.sol > 0;

  const mood = moodFor(summary);

  /* Loading until every read that decides the total has answered, one way or
   * the other. The cost basis is an overlay: its failure costs the profit
   * column, never the screen. */
  const loading =
    (!container.data && !container.error) ||
    (accounts.length > 0 && !balances.data && !balances.error) ||
    (symbols.length > 0 && !prices.data && !prices.error) ||
    (!basis.data && !basis.error) ||
    working.loading;
  const failed =
    (!!container.error && !container.data) || (!!balances.error && !balances.data) || (symbols.length > 0 && !!prices.error && !prices.data);
  const retry = () => {
    void container.mutate();
    void balances.mutate();
    void prices.mutate();
    void basis.mutate();
  };

  const back = href("/invest");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
      <PortfolioHeader title="Portfolio" back={back} />

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[160px]" />
          <Skeleton className="h-[220px]" />
        </div>
      ) : failed ? (
        <div className={glassCard}>
          <ReadFailed title="We couldn't load your portfolio" onRetry={retry} />
        </div>
      ) : (
        <>
          {/* The value first, the gain under it: the one figure that is true
              whether or not we know what anything cost. */}
          <div className="px-5 pb-3.5">
            <p className="text-[13px] font-strong text-white/[0.7]">{mood === "empty" ? "Nothing invested yet" : "Your investments"}</p>
            <p className="mt-0.5 truncate text-[40px] font-bold leading-[1.15] tracking-[-1.3px] tabular-nums text-white">{usd(summary.totalValueUsd)}</p>
            {summary.gainUsd != null && mood !== "empty" ? (
              <p className="mt-1 text-[14px] font-bold tabular-nums">
                <span className="text-white/[0.6]">All-time </span>
                <span style={{ color: mood === "up" ? UP : "#FFFFFF" }}>
                  {mood === "up" ? "+" : mood === "down" ? "−" : ""}
                  {usd(summary.gainUsd)}
                  {summary.gainPct != null ? `  ${pct(summary.gainPct)}` : ""}
                </span>
              </p>
            ) : null}
            {summary.gainUsd == null && mood !== "empty" ? (
              <p className="mt-2 text-[12.5px] leading-[17px] text-white/[0.8]">
                {basis.error && !basis.data
                  ? "We couldn't read what these cost you just now, so there's no gain to show — only what they're worth today."
                  : "We don't know what these cost you, so there's no gain to show — only what they're worth today."}
              </p>
            ) : null}
            {working.failed ? (
              <p className="mt-2 text-[12.5px] leading-[17px] text-white/[0.8]">
                Kamino didn&apos;t answer, so any Solana you have at work is not in this total.
              </p>
            ) : null}
          </div>

          <div className="mb-4 flex gap-[22px] px-1" role="tablist">
            {SECTIONS.map((sec) => {
              const on = section === sec.id;
              return (
                <button key={sec.id} type="button" role="tab" aria-selected={on} onClick={() => setSection(sec.id)} className="flex flex-col items-center">
                  <span className={`text-[16px] ${on ? "font-bold text-white" : "font-strong text-white/[0.6] hover:text-white"}`}>{sec.label}</span>
                  <span className="mt-[7px] h-0.5 self-stretch rounded-[1px]" style={{ backgroundColor: on ? AMBER : "transparent" }} />
                </button>
              );
            })}
          </div>

          {section === "overview" ? (
            mood === "empty" ? (
              <div className={`${glassCard} p-4`}>
                <p className="text-[15px] font-bold text-white">Nothing here yet</p>
                <p className="mt-1 text-[13px] leading-[19px] text-white/[0.8]">
                  Your dollars are on Home. When you buy something whose price moves — Solana, Ethereum, a stock — it shows up here with what you paid and what it&apos;s worth today.
                </p>
              </div>
            ) : (
              <>
                {summary.uncostedRows > 0 && summary.gainUsd != null ? (
                  <p className="mb-2 px-1 text-[12.5px] leading-[17px] text-white/[0.8]">
                    {summary.uncostedRows === 1
                      ? "1 holding isn't in that figure — we don't have what it cost."
                      : `${summary.uncostedRows} holdings aren't in that figure — we don't have what they cost.`}
                  </p>
                ) : null}
                {summary.unpricedRows > 0 ? (
                  <p className="mb-2 px-1 text-[12.5px] leading-[17px] text-white/[0.8]">
                    {summary.unpricedRows === 1
                      ? "1 holding has no price right now, so it's not in the total."
                      : `${summary.unpricedRows} holdings have no price right now, so they're not in the total.`}
                  </p>
                ) : null}

                {/* Only with something to divide: one holding is 100% of itself. */}
                {slices.length > 1 ? <AllocationCard slices={slices} centerValue={usd(summary.totalValueUsd)} /> : null}

                <div className="mt-1 flex gap-2">
                  {COLUMNS.map((c) => (
                    <Pill key={c.id} on={column === c.id} onClick={() => setColumn(c.id)}>
                      {c.label}
                    </Pill>
                  ))}
                </div>

                <div className="mt-3.5 flex items-center px-4 pb-2 text-[11px] font-bold tracking-[0.4px] text-white/[0.6]">
                  <span className="flex-1">Asset</span>
                  <span className="w-[82px] text-right">Price</span>
                  <span className="w-[104px] text-right">{COLUMNS.find((c) => c.id === column)?.label}</span>
                </div>
                <div className={`${glassCard} px-4`}>
                  {summary.rows.map((r, i) => {
                    const label = maskTokenSymbol(r.symbol, displayMode) || r.symbol;
                    return (
                      <Link
                        key={r.key}
                        href={href(`/invest/cost/${encodeURIComponent(r.symbol)}`)}
                        aria-label={`What you paid for ${label}`}
                        className={`flex items-center py-[13px] transition-opacity hover:opacity-80 ${i > 0 ? "border-t border-white/[0.08]" : ""}`}
                      >
                        <span className="mr-3">
                          <AssetMark symbol={r.symbol} size={32} />
                        </span>
                        <span className="min-w-0 flex-1 truncate pr-2 text-[15px] font-bold text-white">{label}</span>
                        <span className="w-[82px] shrink-0 text-right text-[14px] font-strong tabular-nums text-white/[0.8]">
                          {r.priceNow != null ? unitPrice(r.priceNow) : "—"}
                        </span>
                        <span className="flex w-[104px] shrink-0 flex-col items-end">
                          {column === "value" ? (
                            <>
                              <span className="text-[15px] font-bold tabular-nums text-white">{r.priceNow != null ? usd(r.valueUsd) : "—"}</span>
                              <span className="mt-0.5 max-w-full truncate text-[12px] font-strong tabular-nums text-white/[0.7]">
                                {tokenUnits(r.balance)} {label}
                              </span>
                            </>
                          ) : r.gainUsd != null ? (
                            <>
                              <span className="text-[15px] font-bold tabular-nums" style={{ color: r.gainUsd > 0 ? UP : "#FFFFFF" }}>
                                {r.gainUsd > 0 ? "+" : r.gainUsd < 0 ? "−" : ""}
                                {usd(r.gainUsd)}
                              </span>
                              {r.gainPct != null ? (
                                <span className="mt-0.5 text-[12px] font-strong tabular-nums text-white/[0.7]">
                                  {pct(r.gainPct)}
                                  {r.partialBasis ? " (part of it)" : ""}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="text-[15px] font-bold text-white/[0.45]">—</span>
                              <span className="mt-0.5 text-[12px] font-strong text-white/[0.7]">cost unknown</span>
                            </>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>

                {/* Folded away, not deleted: the only route to a sold coin's cost. */}
                {past.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPastOpen((v) => !v)}
                      aria-expanded={pastOpen}
                      className="mt-[18px] flex items-center gap-1.5 py-2 pl-1 text-[12px] font-bold uppercase tracking-[0.4px] text-white/[0.7] hover:text-white"
                    >
                      Sold or sent elsewhere ({past.length})
                      <Ion name={pastOpen ? "chevron-up" : "chevron-down"} size={14} className="text-white/[0.6]" />
                    </button>
                    {pastOpen ? (
                      <div className={`${glassCard} px-4`}>
                        {past.map((h, i) => (
                          <Link
                            key={h.symbol}
                            href={href(`/invest/cost/${encodeURIComponent(h.symbol)}`)}
                            aria-label={`What you paid for ${h.symbol}`}
                            className={`flex items-center py-[13px] hover:opacity-80 ${i > 0 ? "border-t border-white/[0.08]" : ""}`}
                          >
                            <span className="min-w-0 flex-1 pr-2.5">
                              <span className="block text-[15px] font-bold text-white">{maskTokenSymbol(h.symbol, displayMode) || h.symbol}</span>
                              <span className="mt-0.5 block text-[12px] font-strong text-white/[0.7]">
                                {h.lots} {h.lots === 1 ? "purchase" : "purchases"} · last one {shortDate(h.lastAt)}
                              </span>
                            </span>
                            <Ion name="chevron-forward" size={16} className="text-white/[0.45]" />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )
          ) : null}

          {section === "earn" ? (
            <>
              {holdsSol ? (
                <>
                  <SolEarnRow workingSol={working.sol} apy={working.apy} failed={working.failed} />
                  {/* The app's "SOL earned so far": only when there IS interest.
                      Null means we did not track the principal, which is not zero. */}
                  {working.sol > 0 && working.earnedSol != null && working.earnedSol >= MIN_SHOWABLE_EARNED_SOL ? (
                    <p className="mt-2 px-1 text-[13px] font-bold tabular-nums" style={{ color: UP }}>
                      {working.earnedSol.toFixed(4)} SOL earned so far
                    </p>
                  ) : null}
                  <div className="mt-2.5">
                    <InAppNote>Putting Solana to work, and taking it back, happens in the HOLD app, where it is signed on your phone.</InAppNote>
                  </div>
                </>
              ) : null}
              {heldNames ? (
                <p className="mt-2 px-1 text-[12.5px] leading-[17px] text-white/[0.8]">
                  {heldNames.names} {heldNames.count === 1 ? "doesn't" : "don't"} earn anything yet — Solana is the one asset with a venue we can reach today.
                </p>
              ) : null}
              {!holdsSol && !heldNames ? (
                <p className="mt-2.5 text-[14px] leading-[21px] text-white/[0.8]">
                  Nothing you hold can earn yet. Solana is the one asset with a venue we can reach today.
                </p>
              ) : null}
            </>
          ) : null}

          {section === "sold" ? (
            <>
              <div className={`${glassCard} mb-4 p-[22px]`}>
                {realised.error && !realised.data ? (
                  <ReadFailed compact title="We couldn't load what you sold" body="That's not the same as having sold nothing." onRetry={() => void realised.mutate()} />
                ) : !sold ? (
                  <Skeleton className="h-[64px]" />
                ) : (
                  <>
                    <p className="text-[14px] font-strong text-white/[0.8]">{sold.sales === 0 ? "You haven't sold anything yet" : "What you made on what you sold"}</p>
                    {sold.sales > 0 ? (
                      <>
                        <p className="mt-1 text-[44px] font-bold leading-[1.1] tracking-[-1.4px] tabular-nums" style={{ color: sold.gainUsd > 0 ? UP : "#FFFFFF" }}>
                          {sold.gainUsd > 0 ? "+" : sold.gainUsd < 0 ? "−" : ""}
                          {usd(sold.gainUsd)}
                        </p>
                        <p className="mt-1.5 text-[13px] font-strong text-white/[0.7]">
                          across {sold.sales} {sold.sales === 1 ? "sale" : "sales"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2.5 text-[14px] leading-[21px] text-white/[0.8]">
                        A gain becomes real — and reportable — the day something leaves. Everything you still hold is under Overview.
                      </p>
                    )}
                  </>
                )}
              </div>
              <Link href={href("/invest/report")} className={`${glassCard} flex items-center p-4 transition-opacity hover:opacity-85`}>
                <span className="min-w-0 flex-1 pr-2.5">
                  <span className="block text-[15px] font-bold text-white">Your tax year</span>
                  <span className="mt-0.5 block text-[12.5px] font-strong text-white/[0.7]">The year in full, and the spreadsheet your accountant wants</span>
                </span>
                <Ion name="chevron-forward" size={18} className="text-white/[0.5]" />
              </Link>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
