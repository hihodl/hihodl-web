/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE PLACE A RATE CHANGES.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every number rendered on /rewards, /fees, /founders and /travel comes from
 * this file. No page hardcodes a percentage, a price or a cap. Change a value
 * here and every surface moves together — that is the whole point, because the
 * failure mode we are avoiding is a marketing page quoting a rate the product
 * stopped charging six weeks ago.
 *
 * RULES FOR EDITING THIS FILE
 *
 * 1. Every value carries a `// measured:` comment saying WHERE it came from and
 *    WHEN. "Where" means a live contract, a provider API, or a named constant in
 *    a named file — never a slide, never a memory, never an internal analysis
 *    quoted back at itself.
 * 2. Anything not signed off is `provisional: true`. Provisional values render
 *    with a marker so nobody mistakes a working assumption for a commitment.
 * 3. What HOLD KEEPS lives under `HOLD_KEEPS`. Each key there names the ONE
 *    product page allowed to render it — there is no /fees and there will not
 *    be one. Everywhere else renders what the USER RECEIVES, net of our share:
 *    use the `net*` helpers at the bottom.
 * 4. Headline rates are phrased "up to X%". Yields float; a flat claim is a
 *    promise we cannot keep and a regulator can read.
 *
 * RE-MEASURING (all sources in documentation/card-plans-cashback-referral-
 * economics-2026-07-30.md §6):
 *   Aave V3 Base reserves  hihodl-contracts/tools/baseEthReserves.cjs
 *   Kamino Main reserves   api.kamino.finance/kamino-market/7u3He…/reserves/metrics
 *   Lido stETH APR         eth-api.lido.fi/v1/protocol/steth/apr/sma
 *   Marinade mSOL 30d      api.marinade.finance/msol/apy/30d
 * Run anything that touches a chain with `node --require ./tools/ipv4-only.cjs`
 * — this Mac has no IPv6 route and plain fetch hangs on ETIMEDOUT.
 */

/** The day every APY and LTV below was last read off a live source. */
export const RATES_MEASURED_ON = "2026-07-30";

/** Goes under every rate table. Non-negotiable. */
export const RATE_DISCLAIMER = "Rates are variable and not guaranteed.";

/** Rendered next to anything still `provisional`. */
export const PROVISIONAL_LABEL = "Provisional — not final";

/* ══════════════════════════════════════════════════════════════════════════
 * 1. WHAT HOLD KEEPS
 *
 * ⚠️  NEVER RENDER TWO OF THESE KEYS ON THE SAME PAGE.
 *
 * Each key belongs to exactly one product surface, named in its comment below.
 * State it there, in full, next to the thing it applies to. Do not collect them
 * anywhere.
 *
 * WHY THIS IS NOT THE SAME AS HIDING IT
 *
 * Transparency is a duty to the customer, who is reading about ONE product and
 * needs to know what that product costs. It is not a duty to a competitor, who
 * is reading about none of them and wants the deck. Those two readers are
 * served by the same sentence and destroyed by the same index: put every take
 * on one page and the sentence a customer needed becomes a business model a
 * stranger can lift in a single screenshot.
 *
 * So the rule is per-product disclosure, in context, every time — and no page
 * that aggregates. A customer never loses a number. Somebody assembling our
 * P&L has to read every product page and work out how the parts fit, which is
 * most of the work and none of the answer.
 *
 * Superseded: /fees, the aggregate schedule, removed 2026-08-06 (Alex).
 * Archived at documentation/superseded/fees-page-2026-08-06.tsx.txt.
 * ══════════════════════════════════════════════════════════════════════════ */
export const HOLD_KEEPS = {
  /**
   * Our cut of the INTEREST a savings position earns. Never a cut of principal.
   *
   * surface: /smart-account
   * measured: SAVINGS_FEE_BPS in hihodl-backend/server/services/savings-fee.service.ts
   *           on feat/card-rewards-and-credit-gaps, read 2026-07-30. Live at 1500.
   *           Decision dated 2026-07-14.
   */
  savingsInterestShareBps: 1500,

  /**
   * Our cut of the interest earned by money in MAIN, once Smart Account is live.
   *
   * A separate number from savingsInterestShareBps on purpose. Main is the lazy
   * default and the card spends from it; money the user deliberately moved into
   * Savings or a Pocket pays the lower rate above. Every bank on earth prices
   * this way -- a current account pays near nothing while a savings account
   * pays a real rate -- and at 40/15 we are gentler than that norm.
   *
   * Pockets are priced WITH Savings, not with Main. Alex, 2026-08-06: a travel
   * goal is psychologically money set aside, and it is the stickiest balance we
   * hold.
   *
   * surface: /smart-account
   * decided: Alex, 2026-08-06. NOT YET LIVE IN CODE -- savings-fee.service.ts
   *          still applies one flat SAVINGS_FEE_BPS = 1500 to every container,
   *          because savings_cost_basis has no container dimension to price
   *          against. yield_fee_accrual (migration, unapplied) adds it.
   *
   * ⚠️  DO NOT SHIP MAIN AT 40% UNTIL /smart-account SAYS 40%. Charging more
   *     than the published number is the single fastest way to earn the
   *     accusation that page exists to prevent. The page reads this constant,
   *     so the two cannot drift -- but only while the page stays deployed.
   */
  mainInterestShareBps: 4000,
  mainInterestShareProvisional: true,

  /**
   * Our share of the yield a CREDIT COLLATERAL position earns while it sits
   * locked against an open loan.
   *
   * surface: NONE YET. There is no credit product page. This must not be
   *          published anywhere until one exists — and when it does, the number
   *          goes on it, not on a schedule.
   * measured: RATES.yieldShareBps in hihodl-backend/server/services/revenue-model.ts
   *           on feat/card-rewards-and-credit-gaps, read 2026-07-30. Zero today.
   *           A per-tier split (50/30/50) is proposed and UNDECIDED — until it
   *           is decided this stays 0 and we keep nothing.
   */
  collateralYieldShareBps: 0,

  /**
   * Swap markup on the Free plan, all-in.
   * measured: SWAP_MARKUP_RATE = 0.005 in hihodl-backend/server/services/
   *           swap-fees.service.ts, read 2026-07-30. This is what the running
   *           code charges. (revenue-model.ts models 35 bps — that is a planning
   *           assumption, not the live fee. The live fee is what we publish.)
   */
  swapMarkupFreeBps: 50,

  /**
   * Swap markup on Pro: no base markup, plus a premium only on gasless routes.
   * measured: plans.service.ts `pro.config.swapMarkupBase: 0` and
   *           `swapPremiumGasless: 0.0010`, read 2026-07-30.
   */
  swapMarkupProBps: 0,
  swapGaslessPremiumProBps: 10,

  /**
   * FX margin on the corridors where we charge one. See FX_CORRIDORS for which.
   * measured: RATES.fxMarginBps = 100 in revenue-model.ts, read 2026-07-30.
   */
  fxMarginBps: 100,

  /**
   * ATM withdrawal fee. Punitive by design: an ATM turns a card into a cash-out
   * rail, which is the one use we cannot fund. The market leader charges the
   * same 2%.
   * provisional — no card program is signed, so no live constant exists yet.
   */
  atmFeeBps: 200,
  atmFeeProvisional: true,

  /**
   * Commission a travel partner pays US on qualifying spend, under a
   * click-out affiliate model.
   *
   * surface: NONE. /travel used to render this and no longer does. The affiliate
   *          click-out was scoped and dropped — a partner's own app intercepts
   *          the link and takes the commission with it — and the travel product
   *          we actually built books the stay ourselves. See `stays` below for
   *          the model that is live in code. This key stays because card-linked
   *          offers may bring the affiliate shape back, and if they do it needs
   *          a page of its own, not a line on someone else's.
   * measured: RATES.partnerCommissionBps = 500 in revenue-model.ts, read
   *           2026-07-30. Real programmes pay in a 3-8% band.
   */
  partnerCommissionBps: 500,

  /**
   * eSIM data plans. One key, one surface: /esim.
   *
   * ── The shape is resale, not commission ──
   * We buy a bundle wholesale on a signed rate card and sell it at our own
   * price. There is no booking fee, no delivery fee and no card fee to disclose
   * because there are none — the entire take is the spread, and the honest
   * disclosure is to say that plainly and say what share of it comes back.
   *
   * ── What is deliberately NOT published ──
   * The cost-side mechanics: the wholesale floor, the flat margin component, the
   * benchmark ceiling. A customer needs to know what they pay and what we keep
   * of it; neither question is answered by handing over the pricing function.
   * The two numbers below are the ones that change what a customer receives.
   *
   * measured: TRAVEL_PRICING.USER_SHARE {free: 0.5, pro: 0.6} in
   *           server/services/travel/pricing.service.ts, read 2026-08-13 on
   *           .worktrees/connectivity. We keep the remainder.
   * measured: CONNECTIVITY_PRICING.TARGET_UNDERCUT_VS_BENCHMARK = 0.3 and
   *           MIN_UNDERCUT_VS_PUBLIC = 0.02, same branch, same day.
   *
   * ⚠️  NOT LIVE. The connectivity layer sits on a branch, not in production.
   *     /esim carried an "in development" label until 13-aug-2026; Alex removed
   *     it — the page is not shared until the product is public, so the label
   *     was warning nobody. That makes the branch the only thing standing
   *     between these numbers and a customer reading them as an offer, so this
   *     block does not ship to a public URL before the code does.
   */
  esim: {
    /** Our share of the spread on the Free plan. The user gets the rest. */
    marginShareBps: 5000,
    /** Our share on Pro. Lower on purpose — the plan has to buy something. */
    marginShareProBps: 4000,
    /** Where we aim to land against a comparable public price, when one exists. */
    targetUndercutVsPublicBps: 3000,
    /** The guard rail: with a benchmark in hand we are never above it. */
    minUndercutVsPublicBps: 200,
    provisional: true,
  },

  /**
   * Stays. One key, one surface: /travel.
   *
   * Hotels give trade partners a net rate. We add a markup, and if that lands
   * at or above the price the same room shows publicly we come back down under
   * it. We keep that spread — all of it. The guest's reward for booking here is
   * HiPoints, on the same one-point-one-rate scale as everywhere else.
   *
   * ── THERE IS NO DOLLAR SHARE ON THIS PRODUCT, AND THAT IS A DECISION ──
   * This block used to carry `marginShareBps: 5000` and /travel used to render
   * it as "half of what is left, in dollars, after check-out". Alex corrected
   * that on 13-aug-2026: we do not hand back cash on a stay. The reward is
   * points, and the revenue model behind the product is the spread plus the
   * float on money we hold against a supplier invoice — neither of which is a
   * number a guest is owed.
   *
   * The keys are gone rather than zeroed on purpose. A `marginShareBps: 0` is
   * an invitation for somebody to render "0% back" or to raise it without
   * reading why it was lowered; an absent key makes the page fail to compile.
   *
   * ⚠️  THE BACKEND STILL DISAGREES WITH THIS BLOCK.
   *     TRAVEL_PRICING.USER_SHARE is still {free: 0.5, pro: 0.6} and
   *     cashback-payout.service.ts still sends real USDC with a MIN_CASHBACK of
   *     0.5, on .worktrees/connectivity (read 2026-08-13). Nothing has shipped
   *     — every travel table in production has zero rows — so no user has been
   *     paid under either model, but that code must move to points before the
   *     branch merges or the site and the product will say different things.
   *
   * measured: TRAVEL_PRICING.GROSS_MARKUP_ON_NET = 0.1 and
   *           MIN_UNDERCUT_VS_PUBLIC = 0.02, same file, same day. Those two
   *           describe the PRICE, which is unchanged and is still true.
   */
  stays: {
    /** What we add to the net rate before the public price is consulted. */
    markupOnNetBps: 1000,
    /** With a public price in hand we always land at least this far under it. */
    minUndercutVsPublicBps: 200,
    /** What the guest earns. Points, never cash. See the note above. */
    rewardCurrency: "points",
    provisional: true,
  },
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 2. PLANS
 *
 * PROVISIONAL. Names, prices and cashback bands are not signed off. The page
 * ships config-driven precisely so changing them is one edit here.
 * ══════════════════════════════════════════════════════════════════════════ */

export type TierId = "free" | "pro" | "prime";

export interface CashbackBand {
  /** Upper edge of the band, in month-to-date spend. */
  uptoUsd: number | null; // null = everything above the previous edge
  rateBps: number;
}

export interface Tier {
  id: TierId;
  name: string;
  tagline: string;
  provisional: boolean;
  /** Monthly price in USD. */
  priceUsdMonthly: number;
  /** Non-cash requirement to sit in this tier, if any. */
  gate: string | null;
  /** Step-down cashback bands on month-to-date card spend. */
  cashbackBands: CashbackBand[];
  /** Hard ceiling on cashback paid in one month. The bound that makes the
   *  worst case a number instead of a function of somebody's spend. */
  cashbackMonthlyCapUsd: number;
  /** What the user pays on USD and EUR purchases, in bps. */
  fxUsdEurBps: number;
  /** What the user pays on every other corridor, in bps. */
  fxOtherBps: number;
  /** ⚠️ OUR share of savings interest at this tier — /fees only. */
  savingsInterestShareBps: number;
  /** Swap markup the user pays, in bps. */
  swapMarkupBps: number;
  perkPack: boolean;
  /** Extras worth listing on the comparison table. */
  perks: string[];
}

/**
 * measured: bands and caps are CARD_CASHBACK_BANDS / CARD_CASHBACK_MONTHLY_CAP_USD
 *           in hihodl-backend/server/services/rewards-economics.ts on
 *           feat/card-rewards-and-credit-gaps, read 2026-07-30. Free and Pro are
 *           the live shape; Prime does not exist in that file yet.
 * measured: Pro list price 9.99 — plans.service.ts `pro.priceUSD`. NOTE the same
 *           file sets `priceMonthlyUSD: 0.20` behind a `TODO: revert to 9.99
 *           after testing`, so the RUNNING backend currently charges $0.20. That
 *           override must be reverted before these pages go live, or the site
 *           quotes a price the product does not charge.
 */
export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Everything you need to hold and spend dollars.",
    provisional: true,
    priceUsdMonthly: 0,
    gate: null,
    cashbackBands: [
      { uptoUsd: 200, rateBps: 300 },
      { uptoUsd: 1000, rateBps: 100 },
      { uptoUsd: null, rateBps: 50 },
    ],
    cashbackMonthlyCapUsd: 20,
    fxUsdEurBps: 0,
    fxOtherBps: 100, // the margin lives here and only here on Free
    savingsInterestShareBps: 2000,
    swapMarkupBps: 50,
    perkPack: false,
    perks: ["Dollar account", "3 pockets", "Self-custody"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "No FX anywhere, and the wide cashback band.",
    provisional: true,
    priceUsdMonthly: 9.99,
    gate: null,
    cashbackBands: [
      { uptoUsd: 500, rateBps: 300 },
      { uptoUsd: 2000, rateBps: 150 },
      { uptoUsd: null, rateBps: 75 },
    ],
    cashbackMonthlyCapUsd: 60,
    fxUsdEurBps: 0,
    fxOtherBps: 0,
    savingsInterestShareBps: 1000,
    swapMarkupBps: 0,
    perkPack: true,
    perks: ["Dollar account", "Unlimited pockets", "Partner perks", "Priority support"],
  },
  {
    id: "prime",
    name: "Prime",
    tagline: "No monthly fee. Earned with balance, not paid for.",
    provisional: true,
    priceUsdMonthly: 0,
    // A capital gate rather than a cash price: the balance that unlocks the tier
    // is the same balance that funds it.
    gate: "$10,000 held in savings or as credit collateral",
    cashbackBands: [
      { uptoUsd: 1000, rateBps: 300 },
      { uptoUsd: 3000, rateBps: 150 },
      { uptoUsd: null, rateBps: 75 },
    ],
    cashbackMonthlyCapUsd: 100,
    fxUsdEurBps: 0,
    fxOtherBps: 0,
    savingsInterestShareBps: 0,
    swapMarkupBps: 0,
    perkPack: true,
    perks: ["Dollar account", "Unlimited pockets", "Partner perks", "Priority support"],
  },
];

export const TIER_BY_ID: Record<TierId, Tier> = Object.fromEntries(
  TIERS.map((t) => [t.id, t]),
) as Record<TierId, Tier>;

/* ══════════════════════════════════════════════════════════════════════════
 * 3. ASSETS — what a balance earns, and what it can borrow against
 *
 * `grossApyPct` is the raw supply rate the lending market pays. It is NOT what
 * the user nets — run it through `netApyPct()` with a tier before rendering.
 * `maxLtvPct` of 0 means the market does not accept the asset as collateral:
 * it can earn, it cannot back a loan.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface AssetRate {
  symbol: string;
  label: string;
  venue: string;
  chain: "solana" | "base";
  grossApyPct: number;
  maxLtvPct: number;
  /** Where this exact pair of numbers came from. */
  source: string;
  note?: string;
}

export const ASSETS: AssetRate[] = [
  {
    symbol: "PYUSD",
    label: "PayPal USD",
    venue: "Kamino Main",
    chain: "solana",
    grossApyPct: 4.18,
    maxLtvPct: 80,
    // measured: Kamino Main reserve metrics API, 2026-07-30.
    source: "Kamino Main reserve metrics, 2026-07-30",
    note: "Highest-paying dollar on any rail we route to, at full borrowing power.",
  },
  {
    symbol: "USDT",
    label: "Tether",
    venue: "Kamino Main",
    chain: "solana",
    grossApyPct: 3.84,
    maxLtvPct: 80,
    // measured: Kamino Main reserve metrics API, 2026-07-30.
    source: "Kamino Main reserve metrics, 2026-07-30",
  },
  {
    symbol: "USDC",
    label: "USD Coin",
    venue: "Kamino Main",
    chain: "solana",
    grossApyPct: 3.56,
    maxLtvPct: 80,
    // measured: Kamino Main reserve metrics API, 2026-07-30.
    source: "Kamino Main reserve metrics, 2026-07-30",
    note: "The default route.",
  },
  {
    symbol: "USDC",
    label: "USD Coin",
    venue: "Aave V3",
    chain: "base",
    grossApyPct: 3.5,
    maxLtvPct: 75,
    // measured: hihodl-contracts/tools/baseEthReserves.cjs, 2026-07-30.
    source: "Aave V3 Base reserve data, 2026-07-30",
  },
  {
    symbol: "SOL",
    label: "Solana",
    venue: "Kamino Main",
    chain: "solana",
    grossApyPct: 4.99,
    maxLtvPct: 74,
    // measured: Kamino Main reserve metrics API, 2026-07-30.
    source: "Kamino Main reserve metrics, 2026-07-30",
  },
  {
    symbol: "GHO",
    label: "GHO",
    venue: "Aave V3",
    chain: "base",
    grossApyPct: 4.57,
    maxLtvPct: 0,
    // measured: hihodl-contracts/tools/baseEthReserves.cjs, 2026-07-30.
    source: "Aave V3 Base reserve data, 2026-07-30",
    note: "Earns well, cannot be used as collateral.",
  },
  {
    symbol: "EURC",
    label: "Euro Coin",
    venue: "Aave V3",
    chain: "base",
    grossApyPct: 2.71,
    maxLtvPct: 0,
    // measured: hihodl-contracts/tools/baseEthReserves.cjs, 2026-07-30.
    source: "Aave V3 Base reserve data, 2026-07-30",
    note: "Earns well, cannot be used as collateral.",
  },
  {
    symbol: "ETH",
    label: "Ether",
    venue: "Aave V3",
    chain: "base",
    grossApyPct: 1.45,
    maxLtvPct: 80,
    // measured: hihodl-contracts/tools/baseEthReserves.cjs, 2026-07-30.
    source: "Aave V3 Base reserve data, 2026-07-30",
  },
  {
    symbol: "BTC",
    label: "Bitcoin (cbBTC)",
    venue: "Aave V3",
    chain: "base",
    grossApyPct: 0.012,
    maxLtvPct: 73,
    // measured: hihodl-contracts/tools/baseEthReserves.cjs, 2026-07-30.
    source: "Aave V3 Base reserve data, 2026-07-30",
    note: "Held to borrow against, not to earn on.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
 * 4. FX CORRIDORS — what the user pays to spend across currencies
 * ══════════════════════════════════════════════════════════════════════════ */

export interface FxCorridor {
  label: string;
  /** What the user pays, in bps, per tier. */
  userPaysBps: Record<TierId, number>;
  note?: string;
}

/**
 * measured: the 0% USD/EUR position is a decision, not a rate — nobody in the
 *           market makes money on that corridor (the leader was measured at
 *           −0.05% on EUR, 2026-07-30) so competing there costs us nothing.
 *           Every other corridor carries RATES.fxMarginBps = 100.
 */
export const FX_CORRIDORS: FxCorridor[] = [
  {
    label: "US dollar",
    userPaysBps: { free: 0, pro: 0, prime: 0 },
    note: "No markup. Visa wholesale rate.",
  },
  {
    label: "Euro",
    userPaysBps: { free: 0, pro: 0, prime: 0 },
    note: "No markup. Visa wholesale rate.",
  },
  {
    label: "Every other currency",
    userPaysBps: { free: 100, pro: 0, prime: 0 },
    note: "Free plan only. Paid plans are at the wholesale rate everywhere.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
 * 5. FOUNDER PASS
 * ══════════════════════════════════════════════════════════════════════════ */

export const FOUNDER_PASS = {
  /** Total seats that will ever exist. Hard cap, enforced in the database. */
  totalSeats: 500,
  /** Price after the early tranche sells out. */
  priceUsd: 99,
  /** First N seats, at the early price. */
  earlySeats: 100,
  earlyPriceUsd: 79,
  /** Balance covered by the 0% savings fee, for life. */
  savingsFeeWaiverUpToUsd: 25_000,
  /** Permanent creator referral tier: share of the revenue a referral generates
   *  for us. measured: the creator tier in the referral model,
   *  documentation/card-plans-cashback-referral-economics-2026-07-30.md §3.7. */
  creatorReferralShareBps: 2500,
  /** HiPoints credited on purchase. 1 HiPoint = $0.01
   *  (measured: POINT_USD in rewards-economics.ts, read 2026-07-30). */
  welcomeHiPoints: 5_000,
  /** Cashback multiplier applied for life, once the card ships. */
  cashbackMultiplier: 2,
  /** Full refund if the card has not shipped within this many months. */
  refundWindowMonths: 6,
  /** How long a quote and its receiving address stay valid. */
  quoteValidMinutes: 20,
} as const;

/** 1 HiPoint in USD. measured: POINT_USD, rewards-economics.ts, 2026-07-30. */
export const HIPOINT_USD = 0.01;

/* ══════════════════════════════════════════════════════════════════════════
 * 6. DERIVED VALUES
 *
 * Use these to render. They turn "what the market pays" plus "what we keep"
 * into "what you receive", which is the only form allowed off /fees.
 * ══════════════════════════════════════════════════════════════════════════ */

/** What the user actually keeps of a supply yield, at a given tier. */
export function netApyPct(grossApyPct: number, tier: TierId): number {
  const shareBps = TIER_BY_ID[tier].savingsInterestShareBps;
  return grossApyPct * (1 - shareBps / 10_000);
}

/** The best net APY any tier can reach on any asset. The "up to" headline. */
export function bestNetApyPct(): number {
  const bestTier = TIERS.reduce((a, b) =>
    a.savingsInterestShareBps <= b.savingsInterestShareBps ? a : b,
  );
  return Math.max(...ASSETS.map((a) => netApyPct(a.grossApyPct, bestTier.id)));
}

/** The highest LTV any asset reaches. The "borrow up to" headline. */
export function bestLtvPct(): number {
  return Math.max(...ASSETS.map((a) => a.maxLtvPct));
}

/** The headline cashback rate — the top band, always the "up to" number. */
export function headlineCashbackBps(tier: TierId): number {
  return TIER_BY_ID[tier].cashbackBands[0].rateBps;
}

/**
 * Blended cashback rate at a given month's spend. This is the honest number
 * behind the headline and the one that makes a banded programme defensible:
 * the headline is the first slice, this is the average.
 */
export function blendedCashbackBps(tier: TierId, monthlySpendUsd: number): number {
  if (monthlySpendUsd <= 0) return 0;
  const t = TIER_BY_ID[tier];
  let remaining = monthlySpendUsd;
  let previousEdge = 0;
  let earned = 0;

  for (const band of t.cashbackBands) {
    if (remaining <= 0) break;
    const edge = band.uptoUsd ?? Infinity;
    const slice = Math.min(remaining, edge - previousEdge);
    earned += (slice * band.rateBps) / 10_000;
    remaining -= slice;
    previousEdge = edge;
  }

  const capped = Math.min(earned, t.cashbackMonthlyCapUsd);
  return (capped / monthlySpendUsd) * 10_000;
}

/** bps → a display string. 100 → "1%", 12 → "0.12%", 0 → "0%". */
export function bps(value: number): string {
  const pct = value / 100;
  if (pct === 0) return "0%";
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(2).replace(/0$/, "")}%`;
}

/** A percentage number → display string, trimming pointless zeros. */
export function pct(value: number, decimals = 2): string {
  return `${Number(value.toFixed(decimals))}%`;
}

export function usd(value: number): string {
  return value % 1 === 0
    ? `$${value.toLocaleString("en-US")}`
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
