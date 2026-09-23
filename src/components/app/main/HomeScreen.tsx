"use client";

/**
 * Home: the HOLD app's own home screen, on the web, VIEW ONLY.
 *
 * Copied from `app/(drawer)/(tabs)/(home)/index.tsx` and its components, in
 * the app's order and with the app's sizes, weights and words:
 *
 *   the scope strip   HeroSection's 3-pill selector — Main, Savings, each
 *                     pocket. The app pages between them; here they are a row
 *                     of pills that switches the figures. `+ Add` is NOT
 *                     offered: a pocket is made in the app.
 *   the hero          HeroBalance 48/800, DeltaBadge under it, HeroEarningLine
 *                     under that, then the Overview bubble
 *   quick actions     MiniAction — Add, Send, Activity (see below)
 *   the body          ScopeHoldings: Stables, Earning, Assets, each a card of
 *                     up to three rows that hides itself when it has none
 *   Activity          the card with its "See all" pill, then the recent rows
 *   Savings           when THAT is the scope: the rate under the balance, and
 *                     the offers, renewal notice, card and trust note beneath
 *                     (components/app/money/SavingsScreen). It was a screen of
 *                     its own until the column listed it beside Home and showed
 *                     the same money twice -- the Savings pill already switches
 *                     this whole page to that container.
 *   the bento         MONEY OUT and GET PAID, last
 *
 * ── THE DISPLAY MODE DECIDES THE SHAPE OF THE BODY ──
 *
 * The person's one choice, made in the Menu and read from the shell
 * (lib/app/display-mode):
 *
 *   fintech  No Stables card and no Earning card. The hero IS the disclosure
 *            there — every dollar stablecoin is already inside it — and a card
 *            naming tickers would be the only place in the mode that admits
 *            they exist. Assets survives, because SOL and BTC are genuine
 *            separate holdings, and the BTC family collapses into one row.
 *   hybrid   All three cards, one row per ticker across every chain.
 *   native   All three cards, one row per ticker AND chain, each naming its
 *            network.
 *
 * Copied from the app's own branch (`(tabs)/(home)/index.tsx`: "Null in
 * Fintech: there the hero is the whole disclosure"), including the Overview's
 * row-count wording, which says "balances" in fintech and "tokens" elsewhere
 * because "token" is a crypto word.
 *
 * ── WHAT IS NOT HERE, AND WHY ──
 *
 * The app's four actions are Add · Pay/Move · Move/Info · Accounts. Paying,
 * moving between accounts and supplying to a venue all move money and all
 * happen in the app, so the row is three: Add money, Send (which the Wallet
 * page approves on the phone or with a passkey bound to the transaction), and
 * Activity. Nothing here is drawn dead.
 *
 * The third was Accounts, and it opened the Overview — the same panel as the
 * bubble sitting two controls above it, so one of the two was always spare.
 * The bubble keeps the job, because it is beside the balance it is about.
 * Activity took the slot: it is no longer in the column, and the card further
 * down shows four rows, so this is the one-click way to the rest.
 *
 * ── THE TOTAL IS LIQUID PLUS SUPPLIED ──
 *
 * `GET /balances` is liquid only. With money supplied to a venue the on-chain
 * read cannot see it, so a hero built on `/balances` alone prints "$3" over a
 * card listing $16. The supplied half comes from the venues, attributed per
 * container by the ledger (lib/app/money). Until that read lands the hero is a
 * skeleton, never a number that is about to change.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  activityRows,
  rowInScope,
  toPaymentItem,
  type PaymentItem,
} from "@/lib/app/activity-rules";
import {
  btcFamilyDisplayName,
  btcFamilySubtitle,
  isBtcFamilySymbol,
  maskTokenSymbol,
  mergeBtcFamilyRows,
  showChainContext,
  stableFiat,
  type DisplayMode,
} from "@/lib/app/display-mode";
import type { Balance, LedgerSubaccount } from "@/lib/app/hold-api";
import {
  isStable,
  splitForContainer,
  useAllBalances,
  useContainer,
  usePrices,
  usePrices24hAgo,
  useSuppliedBySlug,
  useTransfers,
  usdOf,
} from "@/lib/app/money";
import { chainLabel } from "@/lib/app/payments";

import { useProductHref } from "../base";
import { Ion, type IonName } from "../ion";
import { useShellPrefs } from "../Shell";
import { glass, Skeleton } from "../ui";
import { ActionsRow, HeroBalance, MiniAction, money, TokenIcon } from "../wallet/app-kit";
import { ReadFailed } from "../money/kit";
import { SavingsPanel, SavingsRateLine } from "../money/SavingsScreen";
import { ActivityRow, GREEN, readRow } from "./activity-parts";

/** The app's `RECENT_ACTIVITY_ROWS`. */
const RECENT_ACTIVITY_ROWS = 4;
/** Every card on this screen shows at most three rows, then "View all". */
const CARD_ROWS = 3;

/* ── A scope, and what it is worth ────────────────────────────────── */

interface Scope {
  slug: string;
  label: string;
}

interface Row {
  key: string;
  /** The RAW ticker. Masking happens where the row is drawn. */
  symbol: string;
  /** Token units held. */
  amount: number;
  /** Dollars, or null when we hold no price for it. */
  usd: number | null;
  /** The chain, in native. Null when the row spans every chain it sits on. */
  chain: string | null;
}

const NAMES: Record<string, string> = {
  USDC: "US Dollar",
  USDT: "US Dollar",
  EURC: "Euro",
  SOL: "Solana",
  ETH: "Ethereum",
  BTC: "Bitcoin",
  POL: "Polygon",
};

/** What a row is called, after the BTC family has had its say. */
function displayName(symbol: string, mode: DisplayMode): string {
  if (isBtcFamilySymbol(symbol)) return btcFamilyDisplayName(symbol, mode);
  return NAMES[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

function tickerOf(b: Balance): string {
  return (b.symbol ?? b.tokenId ?? "").split(".")[0].toUpperCase();
}

/**
 * The rows one scope holds, in the shape the mode asks for.
 *
 * Native keeps one row per POSITION — a ticker on a chain — because there the
 * chain is a fact the reader wants. Fintech and hybrid aggregate by ticker
 * across every chain (the app's `buildAggregatedRows`), and fintech then folds
 * native BTC and cbBTC into one Bitcoin.
 *
 * A row is only priced when every leg of it is: one unpriced leg makes the
 * whole row unpriced rather than quietly smaller.
 */
function holdingRows(balances: readonly Balance[], prices: Record<string, number>, mode: DisplayMode): Row[] {
  const byKey = new Map<string, Row>();
  for (const b of balances) {
    const symbol = tickerOf(b);
    if (!symbol) continue;
    const amount = Number(b.balance);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const usd = usdOf(b, prices);
    const chain = showChainContext(mode) ? (b.chain ?? null) : null;
    const key = chain ? `${symbol}|${chain}` : symbol;
    const found = byKey.get(key);
    if (found) {
      found.amount += amount;
      found.usd = found.usd === null || usd === null ? null : found.usd + usd;
    } else {
      byKey.set(key, { key, symbol, amount, usd, chain });
    }
  }
  const rows = [...byKey.values()].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  return mergeBtcFamilyRows(rows, mode);
}

/**
 * How many things the Overview says a vault holds, and what it calls them.
 *
 * The app's `buildVaultOverviewRows` + `vaultRowCountLabel`: fintech groups
 * every pegged stablecoin under its fiat, so three dollar tokens on two chains
 * are one "USD", and the word is "balances" rather than "tokens" — "token" is
 * a crypto word and fintech does not use it.
 */
function overviewCount(rows: readonly Row[], mode: DisplayMode): number {
  if (mode !== "fintech") return rows.length;
  const groups = new Set<string>();
  for (const r of rows) groups.add(stableFiat(r.symbol) ? `fiat:${stableFiat(r.symbol)}` : `sym:${r.symbol}`);
  return groups.size;
}

function overviewCountLabel(n: number, mode: DisplayMode): string {
  if (mode === "fintech") return `${n} ${n === 1 ? "balance" : "balances"}`;
  return `${n} ${n === 1 ? "token" : "tokens"}`;
}

/* ── The screen ───────────────────────────────────────────────────── */

export function HomeScreen({ initialScope = "main" }: { initialScope?: string } = {}) {
  const href = useProductHref();
  const { displayMode } = useShellPrefs();
  const container = useContainer();
  const subaccounts = useMemo<LedgerSubaccount[]>(() => container.data?.subaccounts ?? [], [container.data]);

  const scopes = useMemo<Scope[]>(() => {
    const pockets = subaccounts.filter((s) => s.slug !== "main" && s.slug !== "savings");
    return [
      { slug: "main", label: "Main" },
      { slug: "savings", label: "Savings" },
      ...pockets.map((p) => ({ slug: p.slug, label: p.displayName || p.slug })),
    ];
  }, [subaccounts]);

  const [activeSlug, setActiveSlug] = useState(initialScope);
  const scope = scopes.find((s) => s.slug === activeSlug) ?? scopes[0];
  /** Savings is a scope of this screen, not a screen of its own. */
  const onSavings = scope.slug === "savings";

  // One call per account, as the app does: asking once with no account answers
  // for Main alone and the aggregate is wrong.
  const balances = useAllBalances(scopes.map((s) => s.slug));
  const here = useMemo(() => balances.data?.[scope.slug]?.balances ?? [], [balances.data, scope.slug]);

  const symbols = useMemo(
    () => [...new Set(here.map((b) => (b.symbol ?? b.tokenId ?? "").split(".")[0].toUpperCase()).filter(Boolean))],
    [here],
  );
  const mints = useMemo(() => [...new Set(here.map((b) => b.mint).filter((m): m is string => !!m))], [here]);
  const prices = usePrices(symbols, mints);
  const yesterday = usePrices24hAgo(symbols);
  const supplied = useSuppliedBySlug();
  const transfers = useTransfers(100);

  const priceMap = useMemo(() => prices.data?.prices ?? {}, [prices.data]);
  const rows = useMemo(() => holdingRows(here, priceMap, displayMode), [here, priceMap, displayMode]);

  const liquid = rows.reduce((sum, r) => sum + (r.usd ?? 0), 0);
  const unpriced = rows.filter((r) => r.usd === null);
  const split = splitForContainer({ slug: scope.slug, liquidUsd: liquid, suppliedBySlug: supplied.bySlug });

  // The hero waits on BOTH halves. A scope that can hold supplied money and
  // prints its liquid half first shows a number that is about to change, which
  // is the "$3 then $16" bug written down.
  //
  // A scope holding nothing asks for no prices, so the price read is never
  // made and never resolves. Nothing to price has to count as priced, or a
  // brand-new account's hero is a skeleton for ever — which is exactly the
  // account the empty state below was written for. Invest guards this the same
  // way (`symbols.length > 0 && !prices.data`).
  const priced = prices.data !== undefined || symbols.length + mints.length === 0;
  const settled = balances.data !== undefined && priced && supplied.loaded;
  const totalUsd = settled ? split.totalUsd : null;
  const readFailed = balances.error || prices.error;

  /* The 24h move, over the holdings we can price on both days. */
  const delta = useMemo(() => {
    const before = yesterday.data;
    if (!settled || !before) return null;
    let then = 0;
    let now = 0;
    let missing = 0;
    for (const row of rows) {
      if (isStable(row.symbol)) {
        // A dollar was a dollar yesterday. It contributes to both sides
        // equally and moves the percentage toward zero, which is the truth.
        then += row.usd ?? 0;
        now += row.usd ?? 0;
        continue;
      }
      const was = before[row.symbol];
      if (was === undefined || row.usd === null) {
        missing += 1;
        continue;
      }
      then += row.amount * was;
      now += row.usd;
    }
    if (missing > 0 || then <= 0) return null;
    return { usd: now - then, pct: ((now - then) / then) * 100 };
  }, [rows, yesterday.data, settled]);

  /* What this scope has working, and what it has earned doing it. */
  const earned = supplied.earnedBySlug[scope.slug] ?? 0;

  /* The rows of this scope's activity, after the app's own rules. */
  const payments = useMemo<PaymentItem[]>(() => {
    const all = (transfers.data?.transfers ?? []).map((t) => toPaymentItem(t, displayMode));
    return activityRows(all.filter((p) => rowInScope(p, scope.slug)), displayMode);
  }, [transfers.data, scope.slug, displayMode]);

  const inScope = useMemo(() => (slug: string) => slug === scope.slug, [scope.slug]);

  /* Dollars that left this month — the app's `moneyOutThisMonth`. Stablecoin
     sends only: FX is our margin and is never surfaced here, and a non-stable
     send belongs to the Invest story. */
  const moneyOut = useMemo(() => {
    const now = new Date();
    let total = 0;
    for (const p of (transfers.data?.transfers ?? []).map((t) => toPaymentItem(t, displayMode))) {
      if (p.type !== "out") continue;
      if (!isStable(p.tokenSymbol ?? "")) continue;
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
      total += Math.abs(p.tokenAmount ?? 0);
    }
    return total;
  }, [transfers.data, displayMode]);

  const stables = rows.filter((r) => isStable(r.symbol));
  const assets = rows.filter((r) => !isStable(r.symbol));

  /* The Earning card: one row per ticker this scope has working. There is no
     per-token breakdown on the web yet, so the scope's whole working balance
     is the dollars it is: the venues we use hold stablecoins. */
  const earning: Row[] =
    split.workingUsd > 0
      ? [{ key: "earning-usd", symbol: "USDC", amount: split.workingUsd, usd: split.workingUsd, chain: null }]
      : [];

  /* Fintech draws no Stables and no Earning card: the hero above already holds
     every dollar of both, and a card naming tickers would be the only place in
     the mode that admits they exist. Assets stays — SOL and BTC are genuinely
     separate holdings, not cash. (The app's own branch, `(home)/index.tsx`.) */
  const cash = displayMode !== "fintech";

  const [overview, setOverview] = useState(false);

  /* Somebody with no money at all, and no history: the app's EmptyState. */
  const nothingAtAll =
    settled &&
    transfers.data !== undefined &&
    rows.length === 0 &&
    Object.values(supplied.bySlug).every((v) => v <= 0) &&
    (transfers.data?.transfers.length ?? 0) === 0;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col pb-6">
      {/* ── The scope strip ── */}
      <div className="flex justify-center pt-1.5">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-[22px] bg-white/[0.07] p-1">
          {scopes.map((s) => {
            const on = s.slug === scope.slug;
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveSlug(s.slug)}
                className={`h-10 shrink-0 whitespace-nowrap rounded-[18px] px-[18px] text-[13px] transition-colors ${
                  on ? "bg-white/[0.22] font-extrabold text-white" : "font-bold text-white/70 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {nothingAtAll ? (
        <EmptyState addHref={href("/add")} />
      ) : (
        <>
          {/* ── The balance ── */}
          <div className="mt-4 flex flex-col items-center">
            {readFailed ? (
              <>
                <span className="block text-[48px] font-strong leading-[52px] text-white">—</span>
                <p className="mt-2 text-[13px] text-[#9FB7C2]">We could not read your balance just now.</p>
              </>
            ) : (
              <HeroBalance value={totalUsd === null ? null : money(totalUsd)} />
            )}

            {delta ? (
              <div className="mt-2 mb-0.5">
                <DeltaBadge usd={delta.usd} pct={delta.pct} />
              </div>
            ) : null}

            <EarningLine earnedUsd={earned} />

            {/* On Savings the rate and what it is a month, which the app put
                under its own balance hero. Elsewhere the earned line is enough. */}
            {onSavings ? <SavingsRateLine /> : null}

            {/* What the total leaves out, said rather than hidden. */}
            {settled && supplied.failed.length > 0 ? (
              <p className="mt-2 px-4 text-center text-[12px] leading-[17px] text-amber">
                {supplied.failed.join(" and ")} did not answer, so anything earning there is missing from this total.
              </p>
            ) : null}
            {settled && unpriced.length > 0 ? (
              <p className="mt-2 px-4 text-center text-[12px] leading-[17px] text-[#9FB7C2]">
                {unpriced.length === 1 ? `${unpriced[0].symbol} has no price today, so it is` : `${unpriced.length} holdings have no price today, so they are`} not in this total.
              </p>
            ) : null}

            {/* The Overview bubble. */}
            <div className="mt-2 flex items-center">
              <button
                type="button"
                onClick={() => setOverview(true)}
                className="flex items-center gap-[5px] rounded-[10px] border border-white/[0.14] bg-white/[0.08] px-3 py-[7px] text-[12px] font-bold text-white transition-colors hover:bg-white/[0.12]"
              >
                Overview
                <Ion name="chevron-forward" size={12} color="rgba(255,255,255,0.55)" />
              </button>
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div className="mt-7">
            <ActionsRow>
              <MiniAction icon="add-circle-outline" label="Add" href={href("/add")} />
              <MiniAction icon="send-outline" label="Send" href={`${href("/wallet")}?open=send`} />
              {/* Was "Accounts", which opened the Overview — the same panel the
                  bubble under the balance opens, two controls apart. Activity
                  takes the place: it left the column, and the card below shows
                  four rows of it, so this is the one-click way to the rest. */}
              <MiniAction icon="time-outline" label="Activity" href={href("/activity")} />
            </ActionsRow>
          </div>

          {/* ── What this scope holds ── */}
          {cash ? (
            <>
              <HoldingsCard
                label="Stables"
                rows={stables.slice(0, CARD_ROWS)}
                viewAll={stables.length > CARD_ROWS}
                loading={!settled}
                mode={displayMode}
              />
              <HoldingsCard label="Earning" rows={earning} loading={false} mode={displayMode} />
            </>
          ) : null}
          <HoldingsCard
            label="Assets"
            rows={assets.slice(0, CARD_ROWS)}
            viewAll={assets.length > CARD_ROWS}
            loading={cash ? false : !settled}
            mode={displayMode}
          />

          {/* ── Activity ── */}
          <section className={`${glass} mt-[18px]`} aria-label="Activity">
            <header className="flex items-center justify-between px-4 pb-1 pt-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/55">Activity</h2>
              {payments.length > RECENT_ACTIVITY_ROWS ? (
                <Link
                  href={href("/activity")}
                  className="inline-flex h-7 items-center rounded-[14px] border border-white/[0.14] bg-white/[0.08] px-3 text-[12.5px] font-strong tracking-[-0.1px] text-white/70 transition-colors hover:text-white"
                >
                  See all
                </Link>
              ) : null}
            </header>
            {transfers.data === undefined && transfers.error ? (
              <ReadFailed compact title="We couldn't load your activity" onRetry={() => void transfers.mutate()} />
            ) : transfers.data === undefined ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-9 text-center">
                <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05] text-[rgba(207,227,236,0.4)]">
                  <Ion name="time-outline" size={32} />
                </span>
                <p className="text-[15px] font-strong text-white">Your moves will appear here</p>
                <p className="text-[13px] text-[#9FB7C2]">Send or receive to see your history</p>
              </div>
            ) : (
              payments.slice(0, RECENT_ACTIVITY_ROWS).map((item, i) => (
                <div key={item.txHash || item.id}>
                  {i > 0 ? <div className="ml-[52px] h-px bg-white/[0.06]" /> : null}
                  <ActivityRow
                    item={item}
                    reading={readRow(item, inScope, subaccounts, priceMap, displayMode)}
                    surface="flush"
                    mode={displayMode}
                  />
                </div>
              ))
            )}
          </section>

          {/* ── Savings, when that is the scope ──
              The offers, the renewal notice, the card and the trust note. They
              were a screen of their own until the column listed Savings next to
              Home and showed the same money twice. */}
          {onSavings ? <SavingsPanel /> : null}

          {/* ── The bento ── */}
          <div className="mt-[18px] grid grid-cols-2 gap-2.5">
            <Link href={href("/activity")} className={`${glass} flex min-h-[104px] flex-col justify-between px-3.5 py-3.5 transition-colors hover:bg-white/[0.06]`}>
              <span className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold tracking-[0.3px] text-white/55">MONEY OUT</span>
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                  <Ion name="arrow-up" size={16} />
                </span>
              </span>
              <span className="block">
                <span className="mt-2.5 block text-[22px] font-strong tracking-[-0.4px] tabular-nums text-white">
                  {transfers.data === undefined ? "—" : money(moneyOut)}
                </span>
                <span className="mt-[3px] block text-[12px] text-white/55">This month</span>
              </span>
            </Link>
            <Link href={href("/add")} className={`${glass} flex min-h-[104px] flex-col justify-between px-3.5 py-3.5 transition-colors hover:bg-white/[0.06]`}>
              <span className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold tracking-[0.3px] text-white/55">GET PAID</span>
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/[0.08] text-white/80">
                  <Ion name="arrow-down" size={16} />
                </span>
              </span>
              <span className="block">
                <span className="mt-2.5 block text-[15px] font-strong text-white">Receive dollars</span>
                <span className="mt-[3px] block text-[12px] text-white/55">Account, handle or QR</span>
              </span>
            </Link>
          </div>
        </>
      )}

      {/*
        There was a Benefits row of three product doors here. It is gone: the
        navigation already lists Benefits, Stays, eSIM and Spaces, and three
        doors squeezed into a third of the width each said "Find a …", "Data
        a…", "Sell sp…" — a menu that cannot finish its own words is not a
        menu, it is decoration over the one screen that should be about money.
      */}

      {overview ? (
        <Overview
          scopes={scopes}
          balances={balances.data}
          prices={priceMap}
          supplied={supplied.bySlug}
          mode={displayMode}
          onClose={() => setOverview(false)}
        />
      ) : null}
    </div>
  );
}

/* ── The pieces ───────────────────────────────────────────────────── */

/**
 * DeltaBadge: green when it went up, MUTED WHITE when it went down. Never red.
 * Amber when it did not move.
 */
function DeltaBadge({ usd, pct }: { usd: number; pct: number }) {
  const up = usd > 0;
  const down = usd < 0;
  const skin = up
    ? "border-[rgba(32,214,144,0.22)] bg-[rgba(32,214,144,0.12)] text-[#20D690]"
    : down
      ? "border-white/[0.12] bg-white/[0.07] text-white/70"
      : "border-[rgba(255,183,3,0.22)] bg-[rgba(255,183,3,0.15)] text-amber";
  const glyph: IonName = up ? "trending-up-outline" : down ? "trending-down-outline" : "remove";
  return (
    <span className={`inline-flex items-center gap-1 rounded-[12px] border px-2.5 py-[5px] ${skin}`}>
      <Ion name={glyph} size={12} />
      <span className="text-[12px] font-bold tracking-[0.1px] tabular-nums">{`${up ? "+" : ""}${pct.toFixed(2)}%`}</span>
      <span className="text-[11px] font-strong opacity-60">24h</span>
    </span>
  );
}

/**
 * The line under the balance. It says one thing: "+$4.12 earned".
 *
 * All-time and global, net of our share, and silent below a cent: two dollars
 * supplied at 3.9% takes about seven weeks to earn its first cent, so that is
 * the state a new position sits in for a long time and "+$0.00 earned" reads
 * like a bug. It used to fall back to a rate; a rate is a forecast, and this
 * line sits under a real balance where the reader takes everything as fact.
 */
function EarningLine({ earnedUsd }: { earnedUsd: number }) {
  if (!(earnedUsd >= 0.01)) return null;
  return (
    <p className="mt-2 text-[14px] font-bold tracking-[-0.1px]" style={{ color: GREEN }}>
      {`+${money(earnedUsd)} earned`}
    </p>
  );
}

/**
 * One labelled card of holdings, which hides itself when it has no rows.
 *
 * The money decides which card, not the switch. A pocket set to earn has its
 * balance supplied, so only Earning has rows; switched off, only Stables does.
 * Reading the switch instead would lie in the two cases where the switch and
 * the money disagree: the auto-supply sweep has a floor, and turning a pocket
 * off governs ARRIVALS rather than redeeming what is already working.
 */
function HoldingsCard({
  label,
  rows,
  viewAll,
  loading,
  mode,
}: {
  label: string;
  rows: Row[];
  viewAll?: boolean;
  loading: boolean;
  mode: DisplayMode;
}) {
  if (loading) {
    return (
      <div className="mt-[18px]">
        <p className="mb-2 ml-1 text-[11px] font-bold uppercase tracking-[0.6px] text-white/55">{label}</p>
        <div className={`${glass} flex flex-col gap-2 p-4`}>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
    );
  }
  if (rows.length === 0) return null;
  return (
    <div className="mt-[18px]">
      <p className="mb-2 ml-1 text-[11px] font-bold uppercase tracking-[0.6px] text-white/55">{label}</p>
      <div className={glass}>
        {rows.map((r, i) => (
          <div key={r.key}>
            {i > 0 ? <div className="ml-[52px] h-px bg-white/[0.06]" /> : null}
            <HoldingRow row={r} mode={mode} />
          </div>
        ))}
        {viewAll ? (
          <p className="px-4 py-3.5 text-center text-[13px] font-strong text-white/55">
            More of these live in the app
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The ticker under the name is the masked one, and the chain is beside it only
 * in native — where the app puts it as a mini badge on the icon rather than
 * grey text, for the reason it wrote down: saying the network quietly is still
 * saying it, and a fintech reader has no use for the answer.
 */
function HoldingRow({ row, mode }: { row: Row; mode: DisplayMode }) {
  const ticker = maskTokenSymbol(row.symbol, mode) || row.symbol;
  const known = row.symbol === "USDC" || row.symbol === "SOL";
  const units = row.amount.toLocaleString("en-US", { maximumFractionDigits: isStable(row.symbol) ? 2 : 5 });
  const fastBtc = btcFamilySubtitle(row.symbol, mode);
  const under = [`${units} ${ticker}`, row.chain ? chainLabel(row.chain) : fastBtc].filter(Boolean).join(" · ");
  return (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {known ? (
          <TokenIcon symbol={row.symbol as "USDC" | "SOL"} />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] text-[11px] font-strong text-white">
            {ticker.slice(0, 3)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-strong text-white">{displayName(row.symbol, mode)}</span>
          <span className="mt-0.5 block truncate text-[12px] tabular-nums text-white/55">{under}</span>
        </span>
      </span>
      <span className="text-right text-[14px] font-bold tabular-nums text-white">
        {row.usd === null ? "—" : money(row.usd)}
      </span>
    </div>
  );
}

/**
 * The app's Vaults Overview, as a panel: every vault and what it is worth,
 * with the same liquid-plus-supplied figure the hero above uses, so the same
 * account never reads two different numbers on two screens.
 *
 * Renaming, recolouring and creating a vault are all in the app.
 */
function Overview({
  scopes,
  balances,
  prices,
  supplied,
  mode,
  onClose,
}: {
  scopes: readonly Scope[];
  balances: Record<string, { balances: Balance[] }> | undefined;
  prices: Record<string, number>;
  supplied: Record<string, number>;
  mode: DisplayMode;
  onClose: () => void;
}) {
  const vaults = scopes.map((s) => {
    const rows = holdingRows(balances?.[s.slug]?.balances ?? [], prices, mode);
    const liquid = rows.reduce((sum, r) => sum + (r.usd ?? 0), 0);
    return {
      scope: s,
      count: overviewCount(rows, mode),
      split: splitForContainer({ slug: s.slug, liquidUsd: liquid, suppliedBySlug: supplied }),
    };
  });
  const total = vaults.reduce((sum, v) => sum + v.split.totalUsd, 0);
  const assets = vaults.reduce((sum, v) => sum + v.count, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button aria-label="Close overview" className="absolute inset-0 bg-[#030b13]/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`${glass} relative m-3 flex max-h-[80dvh] w-full max-w-[460px] flex-col overflow-y-auto p-5`}>
        <div className="flex flex-col items-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-white/55">Overview</p>
          <p className="mt-1 text-[32px] font-strong leading-[38px] tabular-nums text-white">
            {balances === undefined ? "—" : money(total)}
          </p>
          <p className="mt-1 text-[12px] text-white/55">{`${vaults.length} vaults · ${overviewCountLabel(assets, mode)}`}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {vaults.map((v) => (
            <div key={v.scope.slug} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-strong text-white">{v.scope.label}</span>
                <span className="mt-0.5 block truncate text-[12px] text-white/55">
                  {`${overviewCountLabel(v.count, mode)}${v.split.isWorking ? " · Earning" : ""}`}
                </span>
              </span>
              <span className="text-right text-[14px] font-bold tabular-nums text-white">
                {balances === undefined ? "—" : money(v.split.totalUsd)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-[17px] text-white/55">
          Renaming a vault, changing its colour and creating a pocket all happen in the HOLD app.
        </p>
      </div>
    </div>
  );
}

/**
 * Nobody's money is here yet. The app's EmptyState: the wallet glyph in its
 * amber disc, the question, and the way to answer it — minus the app's "create
 * your first account", which is a write.
 */
function EmptyState({ addHref }: { addHref: string }) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 text-center">
      <span className="mb-6 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[rgba(255,183,3,0.12)] text-amber">
        <Ion name="wallet-outline" size={64} />
      </span>
      <h2 className="mb-3 text-[32px] font-strong leading-tight tracking-[-0.5px] text-white">Ready to get started?</h2>
      <p className="max-w-[340px] text-[16px] leading-[24px] text-[#CFE3EC]">
        Your Main and Savings accounts are here. Add money and it shows up on this screen.
      </p>
      <Link href={addHref} className="mt-7 inline-flex h-[52px] items-center justify-center gap-2 rounded-[26px] bg-amber px-6 text-[16px] font-extrabold tracking-[-0.2px] text-[#0F0F1A] transition-opacity hover:opacity-90">
        <Ion name="add-circle-outline" size={20} color="#0F0F1A" />
        Add money
      </Link>
    </div>
  );
}
