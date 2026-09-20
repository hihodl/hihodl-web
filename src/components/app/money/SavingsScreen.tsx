"use client";

/**
 * Savings, as the HOLD app draws it.
 *
 * Ported from `app/(drawer)/(internal)/savings/index.tsx` in its own order —
 * the balance hero, the renewal notice when there is one, the credit-card
 * hero, the "Earn more" row, the trust note — with the app's `earn-more.tsx`
 * folded in underneath as a section rather than a second screen, because a
 * wide page has the room the phone did not. The cards and the words are the
 * app's (`SavingsBalanceHero`, `SavingsCreditCardHero`, `SavingsEarnMoreRow`,
 * `SavingsHero`, `SavingsCard`); nothing here was designed for the web.
 *
 * TWO THINGS THE APP DOES THAT THIS MUST NOT LOSE
 *
 * The figure is what THIS CONTAINER holds — `suppliedBySlug.savings`, from
 * `/ledger/containers/:id/balances` — and not the pooled protocol read. A
 * venue reports one balance for the whole address, so the pooled number is
 * Savings plus every pocket, and printing it here is printing somebody else's
 * money as this person's Savings.
 *
 * And a failed read renders "—", never "$0.00". An empty position renders
 * "$0.00 · Earns X% automatically". A zero is a claim, and we only make it
 * when we have an answer.
 *
 * VIEW ONLY
 *
 * Nothing here supplies, withdraws or renews. Depositing into Savings is a
 * signature, and so is renewing a standing authorization, so both say where
 * they happen. The rates, the positions and the container split are reads.
 *
 * WHICH RATE IS SHOWN: always the NET one, what the person keeps after our cut
 * of the interest. The gross reserve rate over-promises by exactly our fee,
 * and a rate on a screen is a promise. The fee is not named here, for the same
 * reason the app does not name it: every number is already net of it. It is
 * published on hihodl.xyz/smart-account.
 */

import { useMemo } from "react";

import {
  formatApy,
  netApy,
  perfFeeForPosition,
  useSuppliedBySlug,
  useYieldAuthorization,
  useYieldPositions,
  useYieldReserves,
} from "@/lib/app/money";
import type { YieldReserve } from "@/lib/app/hold-api";

import { Notice } from "../hold";
import { Ion, type IonName } from "../ion";
import { Skeleton } from "../ui";
import { money } from "../wallet/app-kit";
import { InAppNote } from "./kit";

/* ── The app's palette (src/features/savings/palette.ts) ──────────── */

/** Masked-asset gradients: dollars deep blue, ETH indigo, SOL purple, BTC amber. */
const ASSET_GRADIENT: Record<string, [string, string]> = {
  usdc: ["#1E40AF", "#0A1B3D"],
  usdt: ["#0E7C66", "#08201C"],
  eth: ["#3F4468", "#161826"],
  sol: ["#7A3FF2", "#122E47"],
  btc: ["#F7931A", "#3A1F05"],
};
const ASSET_FALLBACK: [string, string] = ["#22303C", "#0C1620"];

const DOLLAR_TOKENS = new Set(["usdc", "usdt", "usdg", "usds", "pyusd"]);

function isDollarToken(token: string): boolean {
  return DOLLAR_TOKENS.has(token.toLowerCase());
}

/** Every USD stablecoin collapses into one "dollars" card with one blended rate. */
function maskedGroupId(token: string): string {
  return isDollarToken(token) ? "dollars" : token.toLowerCase();
}

function assetMaskLabel(token: string): string {
  const t = token.toLowerCase();
  if (isDollarToken(t)) return "Dollars";
  if (t === "eth") return "Ethereum";
  if (t === "sol") return "Solana";
  if (t === "btc") return "Bitcoin";
  return t.toUpperCase();
}

/** A monochrome glyph per asset — no coin logo, so a stablecoin stays masked. */
function assetGlyph(token: string): IonName {
  const t = token.toLowerCase();
  if (isDollarToken(t)) return "cash-outline";
  if (t === "eth") return "diamond-outline";
  if (t === "sol") return "flash-outline";
  if (t === "btc") return "logo-bitcoin";
  return "wallet-outline";
}

/** The green the earning surface uses. */
const EARNING = "#46D6A0";

/* ── What the screen is made of ───────────────────────────────────── */

interface EarnProduct {
  id: string;
  token: string;
  title: string;
  subtitle: string;
  apy: number;
  gradient: [string, string];
}

/**
 * The app's `groupMasked`: one card per asset group, best rate first, dollars
 * always in front, because the savings story is stablecoins.
 *
 * The app reads its catalogue of offers and prices it with the live reserve
 * rate. The web has only the live reserves, which is the half that is a
 * promise: an offer with no reserve behind it is a rate nobody can earn.
 */
function productsFrom(reserves: readonly YieldReserve[]): EarnProduct[] {
  const byGroup = new Map<string, { token: string; apy: number }[]>();
  for (const r of reserves) {
    const token = (r.token || r.symbol || "").toLowerCase();
    if (!token || !(r.supplyApy > 0)) continue;
    const gid = maskedGroupId(token);
    const list = byGroup.get(gid) ?? [];
    list.push({ token, apy: netApy(r.supplyApy) });
    byGroup.set(gid, list);
  }
  const out: EarnProduct[] = [];
  for (const [gid, list] of byGroup) {
    const best = [...list].sort((a, b) => b.apy - a.apy)[0];
    const isDollars = gid === "dollars";
    const repToken = isDollars ? "usdc" : best.token;
    out.push({
      id: gid,
      token: repToken,
      title: assetMaskLabel(best.token),
      // "up to", because a collapsed group spans several rates — the honest ceiling.
      subtitle: `Earn up to ${formatApy(best.apy)}`,
      apy: best.apy,
      gradient: ASSET_GRADIENT[repToken] ?? ASSET_FALLBACK,
    });
  }
  return out.sort((a, b) => {
    const aDollar = a.id === "dollars" ? 1 : 0;
    const bDollar = b.id === "dollars" ? 1 : 0;
    if (aDollar !== bDollar) return bDollar - aDollar;
    return b.apy - a.apy;
  });
}

export function SavingsScreen() {
  const yieldRead = useYieldPositions();
  // The read names the venue that did not answer; the rows are what it did get.
  const positions = { ...yieldRead, data: yieldRead.data?.positions };
  const venuesDown = yieldRead.data?.failed ?? [];
  const reserves = useYieldReserves();
  const { bySlug, rows } = useSuppliedBySlug();

  const products = useMemo(() => productsFrom(reserves.data ?? []), [reserves.data]);
  const maxApy = products.reduce((m, p) => Math.max(m, p.apy), 0);

  /* The rate this money actually earns, weighted by what is at each venue and
   * priced by the container that owns it — Main and Savings are not priced the
   * same, and a flat rate here charges one at the other's price. */
  const priced = useMemo(
    () =>
      (positions.data ?? []).map((p) => {
        const reserve = (reserves.data ?? []).find(
          (r) =>
            (r.token || r.symbol || "").toLowerCase() === p.token.toLowerCase() &&
            (!r.chain || !p.chain || r.chain.toLowerCase() === p.chain.toLowerCase()),
        );
        const gross = reserve?.supplyApy ?? 0;
        return { usd: p.suppliedUsd, apy: gross * (1 - perfFeeForPosition({ rows, chain: p.chain ?? null, token: p.token })) };
      }),
    [positions.data, reserves.data, rows],
  );

  const hasPositions = (positions.data?.length ?? 0) > 0;
  /* Three states, never two. A read still in flight is a skeleton; a read that
   * FAILED is "—"; an answer of nothing is "$0.00". Collapsing the first two
   * into a dash makes every first paint look like a failure, and collapsing
   * either into a zero is a claim about somebody's money we cannot make. */
  const loading = !positions.data && !positions.error;
  const balanceUnknown = !!positions.error;
  const pooledUsd = priced.reduce((s, p) => s + p.usd, 0);
  const blendedApy = hasPositions && pooledUsd > 0 ? priced.reduce((s, p) => s + p.apy * p.usd, 0) / pooledUsd : null;

  const savingsSuppliedUsd = bySlug.savings ?? 0;
  /* The app projects from the POOLED balance, which is the whole address. Here
   * the figure above is this container's, so the projection is this
   * container's too: the same arithmetic on the number actually on screen,
   * rather than a month's interest on a pocket's money printed under a Savings
   * balance of zero. */
  const projectedMonthlyUsd = blendedApy != null ? (savingsSuppliedUsd * blendedApy) / 12 : 0;

  /* One notice per chain a Smart Account can exist on. Solana is not one of
   * them: the standing authorization there is a deployed program whose
   * rent-exempt deposit is a funding decision. Derived from the live Aave
   * reserves so it cannot drift from the venues that are wired. */
  const aaveChains = useMemo(() => {
    const seen = new Set<string>();
    for (const r of reserves.data ?? []) {
      if ((r.token || r.symbol || "").toLowerCase() !== "usdc") continue;
      seen.add((r.chain ?? "base").toLowerCase());
    }
    return [...seen].filter((c) => c !== "solana");
  }, [reserves.data]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
        <BalanceHero
          hasPositions={hasPositions}
          loading={loading}
          balanceUnknown={balanceUnknown}
          earningBalanceUsd={savingsSuppliedUsd}
          blendedApy={blendedApy}
          maxApy={maxApy}
          projectedMonthlyUsd={projectedMonthlyUsd}
        />

        {aaveChains.map((chain) => (
          <RenewalNotice key={chain} chain={chain} />
        ))}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
          <CreditCardHero />

          <div className="flex min-w-0 flex-col gap-4">
            <EarnMoreRow maxApy={maxApy} />

            <section className="flex min-w-0 flex-col">
              <h2 className="mb-3.5 px-0.5 text-[15px] font-bold tracking-[-0.2px] text-white">Ways to earn</h2>
              {reserves.isLoading && !reserves.data ? (
                <Skeleton className="h-[132px]" />
              ) : products.length ? (
                <div className="flex flex-col gap-3">
                  {products.map((p) => (
                    <EarnCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 py-10">
                  <Ion name="leaf-outline" size={26} className="text-white/30" />
                  <p className="text-[14px] font-bold text-white/[0.8]">Savings is coming soon.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        <TrustNote />
      </div>
    </div>
  );
}

/* ── SavingsBalanceHero ───────────────────────────────────────────── */

/** Split a formatted amount into its major part and its cents. */
function splitAmount(formatted: string): { major: string; minor: string } {
  const m = formatted.match(/^(.*)([.,]\d{2})$/);
  return m ? { major: m[1], minor: m[2] } : { major: formatted, minor: "" };
}

function BalanceHero({
  hasPositions,
  loading,
  balanceUnknown,
  earningBalanceUsd,
  blendedApy,
  maxApy,
  projectedMonthlyUsd,
}: {
  hasPositions: boolean;
  loading: boolean;
  balanceUnknown: boolean;
  earningBalanceUsd: number;
  blendedApy: number | null;
  maxApy: number;
  projectedMonthlyUsd: number;
}) {
  // The rate shown is what the money actually earns once it is funded, and the
  // best offer on the shelf as a promise when it is not.
  const apy = blendedApy ?? maxApy;
  const apyText = apy > 0 ? formatApy(apy) : null;
  const showUnknown = balanceUnknown && !hasPositions;
  const { major, minor } = splitAmount(money(hasPositions ? earningBalanceUsd : 0));

  return (
    <section className="flex flex-col items-center px-4 pt-6" aria-label="Savings balance">
      <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-white/[0.55]">Savings balance</p>

      {loading ? (
        <Skeleton className="mt-3 h-[58px] w-[240px]" />
      ) : showUnknown ? (
        <p className="mt-3 text-[54px] font-extrabold leading-[58px] tracking-[-2.2px] text-white">—</p>
      ) : (
        <p className="mt-3 truncate text-[54px] font-extrabold leading-[58px] tracking-[-2.2px] tabular-nums text-white">
          {major}
          {minor ? <span className="font-bold text-white/45">{minor}</span> : null}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {loading ? null : showUnknown ? (
          <p className="text-[13px] font-bold text-white/[0.8]">Couldn&apos;t refresh — reload to retry</p>
        ) : (
          <>
            <span className="h-[7px] w-[7px] rounded-[4px]" style={{ backgroundColor: EARNING, boxShadow: `0 0 6px ${EARNING}` }} aria-hidden />
            <p className="text-[14px] font-strong text-white/[0.8]">
              {hasPositions
                ? `Earning ${apyText ?? ""}`.trim()
                : apyText
                  ? `Earns ${apyText} automatically`
                  : "Earns automatically"}
            </p>
            {hasPositions && projectedMonthlyUsd > 0 ? (
              <>
                <span className="text-[14px] text-white/35" aria-hidden>
                  ·
                </span>
                <p className="text-[14px] font-bold tabular-nums" style={{ color: EARNING }}>
                  ≈ {money(projectedMonthlyUsd)}/mo
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/* ── RenewalNotice ────────────────────────────────────────────────── */

/**
 * Renders nothing in the common case, which is the case where the renewal
 * already rode along with a payment and there is nothing to do. It appears only
 * when the server says `expired` — the one state where "new deposits are
 * sitting still" is true yet. Not red: money already earning is untouched.
 *
 * Renewing is a signature, so the web says where it happens instead of offering
 * a button that cannot finish.
 */
function RenewalNotice({ chain }: { chain: string }) {
  const auth = useYieldAuthorization(chain);
  const copy = auth.data?.copy;
  if (!copy || auth.data?.mode !== "expired") return null;
  return <Notice icon="time-outline">{copy.line} Renew it in the HOLD app — it is a signature, so it happens on your phone.</Notice>;
}

/* ── SavingsCreditCardHero ────────────────────────────────────────── */

/**
 * The highlighted product: spending against savings without selling. The card
 * visual is a generic teaser — the person does not have a card yet, so it is
 * masked dots and brand marks only, never a number that could read as real.
 *
 * The app's tile opens `savings/unlock-card`, whose two paths are both a money
 * move. Here it is the explainer and the door to the app.
 */
function CreditCardHero() {
  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-[26px] border border-white/[0.12] p-[18px]"
      style={{ background: "linear-gradient(180deg,#16273A 0%,#0E1B29 55%,#0B1622 100%)" }}
      aria-label="Credit card"
    >
      <span className="pointer-events-none absolute inset-x-[18px] top-0 h-px bg-white/[0.22]" aria-hidden />

      <div className="mb-[18px] mt-0.5 flex justify-center">
        <div
          className="relative flex h-[150px] w-[248px] flex-col justify-between overflow-hidden rounded-[16px] border border-white/10 p-4 shadow-[0_18px_24px_rgba(0,0,0,0.5)]"
          style={{ background: "linear-gradient(135deg,#2A3646 0%,#131E2A 55%,#090F16 100%)" }}
          aria-hidden
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.28]" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold tracking-[1px] text-white/[0.92]">HOLD</span>
            <Ion name="flame" size={18} className="text-white/90" />
          </div>
          <span className="h-[26px] w-[34px] rounded-[6px] bg-[#C9B274] opacity-85" />
          <p className="text-[14px] font-bold tracking-[1.5px] text-white/[0.82]">••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••</p>
          <div className="flex items-end justify-end">
            <span className="text-[17px] font-extrabold italic tracking-[-0.5px] text-white">VISA</span>
          </div>
        </div>
      </div>

      <h2 className="text-center text-[21px] font-extrabold tracking-[-0.5px] text-white">Unlock your credit card</h2>
      <p className="mt-2 px-2 text-center text-[14px] leading-[21px] text-white/[0.8]">
        Spend against your savings without selling. Your balance keeps earning while you tap.
      </p>

      {/* The app's two paths, both of which move money. */}
      <ul className="mt-4 flex flex-col gap-2.5">
        <PathRow icon="cash-outline" title="Deposit dollars" sub="Move dollars into Savings. They earn interest and back your credit line." />
        <PathRow icon="link-outline" title="Connect assets from Invest" sub="Put the SOL or BTC you already hold to work as collateral — without selling." />
      </ul>

      <div className="mt-4">
        <InAppNote>Getting the card, and putting money behind it, happens in the HOLD app.</InAppNote>
      </div>

      {/* Amber, never red, and framed as the buffer it is. */}
      <p role="status" className="mt-3 flex gap-2.5 rounded-[14px] border border-[rgba(245,166,35,0.22)] bg-[rgba(245,166,35,0.08)] p-3">
        <Ion name="information-circle-outline" size={16} className="mt-px shrink-0 text-[#F5A623]" />
        <span className="flex-1 text-[12px] leading-[17px] text-white/[0.8]">
          If your collateral drops in value, HOLD eases your spending first to keep a safe buffer — so a market dip doesn&apos;t force a sale.
          Rates are variable and this isn&apos;t a bank product.
        </span>
      </p>
    </section>
  );
}

function PathRow({ icon, title, sub }: { icon: IonName; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-[15px]">
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-white/10">
        <Ion name={icon} size={20} className="text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-extrabold tracking-[-0.2px] text-white">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[17px] text-white/[0.8]">{sub}</span>
      </span>
    </li>
  );
}

/* ── SavingsEarnMoreRow ───────────────────────────────────────────── */

/**
 * The app's one quiet row into the advanced picker. On the phone it is a tap
 * into `earn-more`; here the picker is the section right under it, so the row
 * says what is on offer and the cards are already there.
 */
function EarnMoreRow({ maxApy }: { maxApy: number }) {
  const upTo = maxApy > 0 ? ` · up to ${formatApy(maxApy)}` : "";
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.07]">
        <Ion name="trending-up-outline" size={19} className="text-white/80" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-white">Earn more</span>
        <span className="mt-px block truncate text-[12.5px] text-white/[0.8]">Advanced yield &amp; staking{upTo}</span>
      </span>
    </div>
  );
}

/* ── SavingsCard ──────────────────────────────────────────────────── */

/**
 * One earn card: its own two-stop gradient, a soft glyph, the masked title and
 * rate, and the APY big. Not a button — the app's card stopped being one when
 * the detail screen behind it went, because money goes into Savings through
 * Move, and a second decorative route into a deposit is the thing worth losing.
 */
function EarnCard({ product }: { product: EarnProduct }) {
  return (
    <article
      className="relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.12] p-4"
      style={{ background: `linear-gradient(135deg, ${product.gradient[0]} 0%, ${product.gradient[1]} 100%)` }}
      aria-label={`${product.title}, earn ${formatApy(product.apy)}`}
    >
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/[0.22]" aria-hidden />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.16] bg-white/[0.12]">
          <Ion name={assetGlyph(product.token)} size={18} className="text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-extrabold tracking-[-0.3px] text-white">{product.title}</span>
          <span className="mt-0.5 block truncate text-[12.5px] font-strong text-white/[0.82]">{product.subtitle}</span>
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-[7px]">
        <span className="text-[30px] font-extrabold tracking-[-1px] tabular-nums text-white">{formatApy(product.apy)}</span>
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-white/[0.8]">APY · variable</span>
      </div>
    </article>
  );
}

/* ── The trust line ───────────────────────────────────────────────── */

function TrustNote() {
  return (
    <p className="mt-1 flex items-start gap-2.5 rounded-[14px] border border-white/[0.07] bg-white/[0.04] p-[13px]">
      <Ion name="shield-checkmark-outline" size={16} className="mt-px shrink-0 text-white/[0.55]" />
      <span className="flex-1 text-[12px] leading-[17px] text-white/[0.8]">
        Your money stays in your own wallet — HOLD never holds it. This isn&apos;t a bank deposit, and rates are variable.
      </span>
    </p>
  );
}
