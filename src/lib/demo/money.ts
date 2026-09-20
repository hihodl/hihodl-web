/**
 * The demo backend for the money screens: Home, Activity, Payments, Savings,
 * Invest and Add money.
 *
 * Everything `lib/app/hold-api` reads is answered here, from one fixture
 * person, so the review can walk every screen in a browser with nothing behind
 * it:
 *
 *   /balances?account=      one call per account, as the app asks
 *   /prices, /prices/history the dollar prices and the series behind the curve
 *   /transfers, /transfers/:id/details  what moved, and what the chain did
 *   /ledger/my-container, /ledger/containers/:id/balances  the accounts, and
 *                          which of their money sits liquid and which is working
 *   /yield/*               Kamino and Aave: positions, reserves, the standing
 *                          authorization
 *   /portfolio/cost-basis  what the volatile holdings cost
 *   /scheduled-payments, /offramp/orders, /rails/accounts, /alias
 *
 * THE PERSON IS INVENTED, AND SO IS EVERY COUNTERPARTY
 *
 * @demo_creator, and brands and handles that belong to nobody. A fixture once
 * carried a real creator's handle over invented figures; it must never happen
 * again, so nothing here is a name anyone could recognise.
 *
 * THE FIGURES ARE FIXED, AND THE CLOCK IS NOT
 *
 * Amounts, prices and the split between accounts are constants: two visits to
 * the same screen read the same money. The dates are relative to the moment
 * the page loaded, so Activity always has a "Today" and a "Yesterday" divider
 * to draw and the rewind has somewhere to walk back to. The price series is a
 * seeded walk ending on today's price, so the Invest curve is the same curve
 * on every visit and agrees with the total above it.
 */

import { demoState } from "@/lib/creator/demo";
import type {
  AliasRecord,
  Balance,
  BalancesAnswer,
  ContainerAnswer,
  CostBasisPosition,
  LedgerSubaccount,
  OfframpOrder,
  RailAccount,
  Schedule,
  SubaccountBalanceRow,
  Transfer,
  TransferDetails,
  YieldAuthorization,
  YieldPosition,
  YieldReserve,
} from "@/lib/app/hold-api";

import type { Answer } from "./account";

const ok = (data: unknown, status = 200): Answer => ({ status, body: { data } });
const refuse = (status: number, code: string): Answer => ({ status, body: { error: { code, message: code, details: { code } } } });

/* ── The clock ────────────────────────────────────────────────────── */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Fixed at module load, so every row on a page agrees about "now". */
const NOW = Date.now();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

/* ── Addresses ────────────────────────────────────────────────────── */

/**
 * The fixture's own addresses. The Solana one is only ever compared against,
 * never shown: Receive draws the web wallet's real demo address instead.
 */
const MINE = {
  solana: "7mQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusV3aB",
  evm: "0x2E9f4C1b7A5d83E6b0F14aD9c72B8e35D6a1C0f7",
};

/**
 * Wallets that are not ours. Invented, and none of them resolves to a person.
 *
 * One address per counterparty, deliberately: Payments treats an address the
 * server has ever labelled a merchant's as a merchant's for every row in the
 * window, so a brand and a person sharing one address would take the person's
 * whole conversation off the list.
 */
const THEIRS = {
  mesa: "3vK8qTfN2xRbW7mYpL4dHgS9cU6eA1jZnQ5tXvB0oM2r",
  kopi: "9dR4mCwT6yPkH1sQ8bN3fJ7vL2xZaE5gU0iY4oK6tD1n",
  orbit: "5tGm2wQxK8nB4vY7pR1sD6hL9cJ3zA0eU5iN8oT2rF4d",
  lumen: "8pL3nVzQ5dT7yK2mW9fR4bC6xJ1sH0gE3uA7iY5oN2tB",
  nodeline: "0x4Fa9C2718bD35e60a1C87fE4930bB5d2716Ac08E",
  nodeline2: "4jN7sQ2vB8mL5tR1wY6pK3dF9cH0zX4aU7gE2iT5oM8n",
  orbitEvm: "0x7Dc4E93a15B806f2C4d7139eA5b02F86D31c94Ab",
  /** A wallet with no name on it: what an external address looks like on these screens. */
  wallet: "6kR9tYbN3mQ7wX2pF5dL8sV1cH4jZ0aE6uG3iT9oB5nM",
  walletEvm: "0x8B31aF07e5C946d2130Ab7Fc09E6d84A15b3720C",
  walletEvm2: "0xC47d6520Ae18b93F0d7a5Ee1B82c4F369D0a5713",
  /** Where the two merchants collect. Never shared with anybody who is a person. */
  nimbus: "0xA61b3D9e07C4528Ff1b6D3a05C72E4198bD0f371",
  aurora: "0xE05c7B21fA946d0c3E78b1D45a9F602c8B37dA14",
  sable: "2yH6bXnR4kM9wT1pQ7sF3dL5cV8jZ0aG2uE6iY4oN7tK",
};

/* ── Prices ───────────────────────────────────────────────────────── */

/** What a ticker is worth today. A ticker missing here has no price, which is not zero. */
const PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  EURC: 1.09,
  SOL: 214.32,
  ETH: 4180.55,
  BTC: 96_420,
};

/** The two Solana mints the fixture's balances carry, so the by-mint path is exercised too. */
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const MINT_PRICES: Record<string, number> = { [USDC_MINT]: 1, [SOL_MINT]: PRICES.SOL };

/* ── The accounts ─────────────────────────────────────────────────── */

const CONTAINER_ID = "demo-container-1";

const SUBACCOUNTS: LedgerSubaccount[] = [
  { id: "sub-main", slug: "main", displayName: "Main", color: "#7CC6E8", icon: "wallet-outline", position: 0, isSystem: true, earnEnabled: false },
  { id: "sub-savings", slug: "savings", displayName: "Savings", color: "#46D6A0", icon: "leaf-outline", position: 1, isSystem: true, earnEnabled: true },
  { id: "sub-travel", slug: "travel-fund", displayName: "Travel fund", color: "#FFB703", icon: "airplane-outline", position: 2, isSystem: false, earnEnabled: true },
  { id: "sub-camera", slug: "new-camera", displayName: "New camera", color: "#B58CF0", icon: "camera-outline", position: 3, isSystem: false, earnEnabled: false },
];

/** What each account holds liquid. Supplied money is not here — that is the venues'. */
const LIQUID: Record<string, Balance[]> = {
  main: [
    { chain: "solana", tokenId: "usdc", symbol: "USDC", decimals: 6, mint: USDC_MINT, balance: "2480.35", account: "main" },
    { chain: "base", tokenId: "usdc", symbol: "USDC", decimals: 6, balance: "310.20", account: "main" },
    { chain: "solana", tokenId: "sol", symbol: "SOL", decimals: 9, mint: SOL_MINT, balance: "6.4210", account: "main" },
    { chain: "base", tokenId: "eth", symbol: "ETH", decimals: 18, balance: "0.4180", account: "main" },
  ],
  savings: [{ chain: "solana", tokenId: "usdc", symbol: "USDC", decimals: 6, mint: USDC_MINT, balance: "40.00", account: "savings" }],
  "travel-fund": [{ chain: "solana", tokenId: "usdc", symbol: "USDC", decimals: 6, mint: USDC_MINT, balance: "12.50", account: "travel-fund" }],
  "new-camera": [{ chain: "base", tokenId: "usdc", symbol: "USDC", decimals: 6, balance: "640.00", account: "new-camera" }],
};

/**
 * The ledger's own split: one row per (account, chain, token, placement).
 *
 * The `yield` rows are what attributes one pooled Kamino position to Savings
 * and to the Travel fund — 3,200 and 850 of principal, so the pooled value and
 * the interest on it divide 79/21 between them.
 */
const SPLIT_ROWS: SubaccountBalanceRow[] = [
  row("sub-main", "main", "Main", "solana", "usdc", "2480350000", "liquid", ""),
  row("sub-main", "main", "Main", "base", "usdc", "310200000", "liquid", ""),
  row("sub-savings", "savings", "Savings", "solana", "usdc", "40000000", "liquid", ""),
  row("sub-savings", "savings", "Savings", "solana", "usdc", "3200000000", "yield", "kamino"),
  row("sub-travel", "travel-fund", "Travel fund", "solana", "usdc", "12500000", "liquid", ""),
  row("sub-travel", "travel-fund", "Travel fund", "solana", "usdc", "850000000", "yield", "kamino"),
  row("sub-camera", "new-camera", "New camera", "base", "usdc", "640000000", "liquid", ""),
];

function row(
  subaccountId: string,
  slug: string,
  displayName: string,
  chain: string,
  tokenId: string,
  balanceRaw: string,
  placement: "liquid" | "yield",
  venue: "aave" | "kamino" | "",
): SubaccountBalanceRow {
  return { subaccountId, slug, displayName, chain, tokenId, balanceRaw, placement, venue, updatedAt: at(4 * MINUTE) };
}

/* ── What the money earns ─────────────────────────────────────────── */

/**
 * One Kamino position, which is how the protocol reports it: one balance for
 * the whole address, with no idea that Savings and a pocket both own part of
 * it. 4,050 of principal is now worth 4,092.47, and the 42.47 of interest is
 * split by principal share like the balance is.
 */
const KAMINO_POSITIONS: YieldPosition[] = [
  {
    offerId: "kamino-main-usdc",
    token: "usdc",
    chain: "solana",
    suppliedBaseUnits: "4092470000",
    suppliedUsd: 4092.47,
    principalBaseUnits: "4050000000",
    openedAt: at(54 * DAY),
  },
];

/** Gross reserve rates. Every screen nets our share off them before printing one. */
const KAMINO_RESERVES: YieldReserve[] = [
  { symbol: "USDC", token: "usdc", supplyApy: 0.0641, chain: "solana" },
  { symbol: "SOL", token: "sol", supplyApy: 0.0312, chain: "solana" },
];

const AAVE_RESERVES: YieldReserve[] = [
  { symbol: "USDC", token: "usdc", supplyApy: 0.0518, chain: "base" },
  { symbol: "USDC", token: "usdc", supplyApy: 0.0473, chain: "polygon" },
  { symbol: "ETH", token: "eth", supplyApy: 0.0195, chain: "base" },
];

/**
 * The standing authorization, in the state it is in for almost everybody: on,
 * quiet, with months of runway. The screen draws a notice only for `expired`,
 * so this one renders nothing, which is the honest common case.
 */
const AUTHORIZATION: YieldAuthorization = { enabled: true, mode: "silent", copy: null, runwayDays: 196 };

/* ── What the volatile holdings cost ──────────────────────────────── */

const COST_BASIS: CostBasisPosition[] = [
  { chain: "solana", tokenId: "sol", wacUsd: 178.4, hasBasis: true, confirmedLots: 3, provisionalLots: 0 },
  { chain: "base", tokenId: "eth", wacUsd: 3910.0, hasBasis: true, confirmedLots: 1, provisionalLots: 0 },
];

/* ── What moved ───────────────────────────────────────────────────── */

type Seed = Partial<Transfer> & Pick<Transfer, "id" | "direction" | "chain" | "tokenId" | "symbol" | "amount" | "createdAt">;

/**
 * A hash that looks like the chain it came from: base58 on Solana, 0x-hex
 * everywhere else. Deterministic, so a receipt shows the same one on every
 * visit — and it explores nothing, because no such transaction exists.
 */
function hash(chain: string, n: number): string {
  // A 32-bit mixer, not a plain LCG: an LCG's low bits cycle, and a character
  // picked with `% 58` off them repeats itself a few rows down — two rows
  // shared one hash, and React said so.
  let a = ((n + 1) * 2_654_435_761) >>> 0;
  const take = (alphabet: string, length: number) =>
    Array.from({ length }, () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return alphabet[((t ^ (t >>> 14)) >>> 0) % alphabet.length];
    }).join("");
  return chain === "solana"
    ? take("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 88)
    : `0x${take("0123456789abcdef", 64)}`;
}

/**
 * Thirty-two rows over the last three months: money in from brands, money out
 * to collaborators, two merchants, two swaps, and the moves that funded
 * Savings and the two pockets. Newest first, which is the order the app's own
 * rules expect.
 */
const SEEDS: Seed[] = [
  {
    id: "tr-01", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "420.00", createdAt: at(2 * HOUR),
    fromAlias: "@mesa_labs", fromAddress: THEIRS.mesa, toAddress: MINE.solana, account: "main", usdValueAtTx: 420, profileEmoji: "🛰️",
    counterpartyType: "hihodl", note: "Spot on the suitcase",
  },
  {
    id: "tr-02", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "64.80", createdAt: at(5 * HOUR),
    toAlias: "@kopi_studio", toAddress: THEIRS.kopi, fromAddress: MINE.solana, account: "main", usdValueAtTx: 64.8, counterpartyType: "hihodl",
  },
  {
    id: "tr-03", direction: "out", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "18.40", createdAt: at(7 * HOUR),
    merchantName: "Nimbus eSIM", toAddress: THEIRS.nimbus, account: "main", usdValueAtTx: 18.4, actionLabel: "Booked", counterpartyType: "merchant",
  },
  {
    id: "tr-04", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "1250.00", createdAt: at(26 * HOUR),
    fromAlias: "@orbit_travels", fromAddress: THEIRS.orbit, account: "main", usdValueAtTx: 1250, profileEmoji: "🧭", counterpartyType: "hihodl",
  },
  {
    id: "tr-05", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "500.00", createdAt: at(30 * HOUR),
    fromAddress: "main", toAddress: "savings", moveKind: "transfer", actionLabel: "Moved", account: "savings", usdValueAtTx: 500,
  },
  {
    id: "tr-06", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "500.00", createdAt: at(30 * HOUR - 2 * MINUTE),
    fromAddress: "savings", toAddress: "earning", moveKind: "yield", actionLabel: "Earning", account: "savings", usdValueAtTx: 500,
  },
  {
    id: "tr-07", direction: "out", chain: "solana", tokenId: "sol", symbol: "SOL", amount: "1.2500", createdAt: at(2 * DAY),
    toAddress: THEIRS.wallet, account: "main", usdValueAtTx: 264.6, mint: SOL_MINT,
  },
  {
    id: "tr-08", direction: "exchange", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "300.00", createdAt: at(3 * DAY),
    symbolTo: "sol", amountTo: "1.4012", account: "main", usdValueAtTx: 300,
  },
  {
    id: "tr-09", direction: "in", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "95.00", createdAt: at(4 * DAY),
    fromAlias: "@nodeline_creator", fromAddress: THEIRS.nodeline, account: "main", usdValueAtTx: 95, profileEmoji: "🪢", counterpartyType: "hihodl",
  },
  {
    id: "tr-10", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "240.00", createdAt: at(5 * DAY),
    toAlias: "@lumen_works", toAddress: THEIRS.lumen, account: "main", usdValueAtTx: 240, counterpartyType: "hihodl",
  },
  /* One stay paid from two balances: two transfers, one act. The web folds
     them into a single row — see foldActivityRows. */
  {
    id: "tr-11", direction: "out", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "14.75", createdAt: at(6 * DAY),
    merchantName: "Hotel Aurora", toAddress: THEIRS.aurora, account: "main", usdValueAtTx: 14.75, actionLabel: "Booked", parentIntentId: "intent-aurora",
  },
  {
    id: "tr-12", direction: "out", chain: "polygon", tokenId: "usdc", symbol: "USDC", amount: "4.69", createdAt: at(6 * DAY + 23_000),
    merchantName: "Hotel Aurora", toAddress: THEIRS.aurora, account: "main", usdValueAtTx: 4.69, actionLabel: "Booked", parentIntentId: "intent-aurora",
  },
  {
    id: "tr-13", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "780.00", createdAt: at(8 * DAY),
    fromAlias: "@orbit_travels", fromAddress: THEIRS.orbit, account: "main", usdValueAtTx: 780, profileEmoji: "🧭", counterpartyType: "hihodl",
  },
  {
    id: "tr-14", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "250.00", createdAt: at(9 * DAY),
    toAlias: "@kopi_studio", toAddress: THEIRS.kopi, account: "main", usdValueAtTx: 250, counterpartyType: "hihodl",
  },
  {
    id: "tr-15", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "60.00", createdAt: at(11 * DAY),
    fromAddress: THEIRS.wallet, account: "main", usdValueAtTx: 60,
  },
  {
    id: "tr-16", direction: "out", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "320.00", createdAt: at(13 * DAY),
    toAddress: THEIRS.walletEvm, account: "main", usdValueAtTx: 320,
  },
  {
    id: "tr-17", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "900.00", createdAt: at(15 * DAY),
    fromAddress: "main", toAddress: "travel-fund", moveKind: "transfer", actionLabel: "Moved", account: "travel-fund", usdValueAtTx: 900,
  },
  {
    id: "tr-18", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "850.00", createdAt: at(16 * DAY),
    fromAddress: "travel-fund", toAddress: "earning", moveKind: "yield", actionLabel: "Earning", account: "travel-fund", usdValueAtTx: 850,
  },
  {
    id: "tr-19", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "2100.00", createdAt: at(18 * DAY),
    fromAlias: "@mesa_labs", fromAddress: THEIRS.mesa, account: "main", usdValueAtTx: 2100, profileEmoji: "🛰️", counterpartyType: "hihodl",
    note: "Takeover, three days",
  },
  {
    id: "tr-20", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "120.00", createdAt: at(21 * DAY),
    toAlias: "@lumen_works", toAddress: THEIRS.lumen, account: "main", usdValueAtTx: 120, counterpartyType: "hihodl",
  },
  {
    id: "tr-21", direction: "in", chain: "base", tokenId: "eth", symbol: "ETH", amount: "0.2000", createdAt: at(24 * DAY),
    fromAddress: THEIRS.walletEvm2, account: "main", usdValueAtTx: 812.4,
  },
  {
    id: "tr-22", direction: "move", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "640.00", createdAt: at(27 * DAY),
    fromAddress: "main", toAddress: "new-camera", moveKind: "transfer", actionLabel: "Moved", account: "new-camera", usdValueAtTx: 640,
  },
  {
    id: "tr-23", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "1400.00", createdAt: at(30 * DAY),
    fromAlias: "@nodeline_creator", fromAddress: THEIRS.nodeline2, account: "main", usdValueAtTx: 1400, profileEmoji: "🪢", counterpartyType: "hihodl",
  },
  {
    id: "tr-24", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "75.50", createdAt: at(34 * DAY),
    merchantName: "Sable Studio", toAddress: THEIRS.sable, account: "main", usdValueAtTx: 75.5, counterpartyType: "merchant",
  },
  {
    id: "tr-25", direction: "exchange", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "900.00", createdAt: at(38 * DAY),
    symbolTo: "eth", amountTo: "0.2180", account: "main", usdValueAtTx: 900,
  },
  {
    id: "tr-26", direction: "in", chain: "base", tokenId: "usdc", symbol: "USDC", amount: "300.00", createdAt: at(42 * DAY),
    fromAlias: "@orbit_travels", fromAddress: THEIRS.orbitEvm, account: "main", usdValueAtTx: 300, profileEmoji: "🧭", counterpartyType: "hihodl",
  },
  {
    id: "tr-27", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "410.00", createdAt: at(47 * DAY),
    toAlias: "@kopi_studio", toAddress: THEIRS.kopi, account: "main", usdValueAtTx: 410, counterpartyType: "hihodl",
  },
  {
    id: "tr-28", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "2700.00", createdAt: at(53 * DAY),
    fromAddress: "main", toAddress: "savings", moveKind: "transfer", actionLabel: "Moved", account: "savings", usdValueAtTx: 2700,
  },
  {
    id: "tr-29", direction: "move", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "2700.00", createdAt: at(54 * DAY),
    fromAddress: "savings", toAddress: "earning", moveKind: "yield", actionLabel: "Earning", account: "savings", usdValueAtTx: 2700,
  },
  {
    id: "tr-30", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "3200.00", createdAt: at(61 * DAY),
    fromAlias: "@mesa_labs", fromAddress: THEIRS.mesa, account: "main", usdValueAtTx: 3200, profileEmoji: "🛰️", counterpartyType: "hihodl",
  },
  {
    id: "tr-31", direction: "out", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "180.00", createdAt: at(72 * DAY),
    toAddress: THEIRS.wallet, account: "main", usdValueAtTx: 180,
  },
  {
    id: "tr-32", direction: "in", chain: "solana", tokenId: "usdc", symbol: "USDC", amount: "540.00", createdAt: at(88 * DAY),
    fromAlias: "@lumen_works", fromAddress: THEIRS.lumen, account: "main", usdValueAtTx: 540, counterpartyType: "hihodl",
  },
];

const TRANSFERS: Transfer[] = SEEDS.map((s, i): Transfer => ({
  ...s,
  status: s.status ?? "confirmed",
  // A ledger move has no hash of its own: nothing went on chain.
  txHash: s.direction === "move" ? null : (s.txHash ?? hash(s.chain, i)),
  updatedAt: s.updatedAt ?? s.createdAt,
}));

const BY_ID = new Map(TRANSFERS.map((t) => [t.id, t]));

/* ── Standing payments, payouts, rails and the person's name ──────── */

const SCHEDULES: Schedule[] = [
  {
    id: "sch-1",
    kind: "onchain",
    status: "active",
    token: "usdc",
    amountMinor: "250000000",
    amountCurrency: "USDC",
    recipientLabel: "@kopi_studio",
    cadence: "monthly",
    startsAt: at(70 * DAY),
    expiresAt: at(-300 * DAY),
    nextRunAt: at(-11 * DAY),
    lastRunAt: at(19 * DAY),
    runsCompleted: 2,
    runsTotal: 12,
    consecutiveFailures: 0,
    authorizations: [{ chain: "solana", revokedAt: null }],
  },
];

const PAYOUTS: OfframpOrder[] = [
  {
    id: "pay-1",
    state: "sent",
    amount: "1850.00",
    currency: "EUR",
    createdAt: at(3 * DAY),
    updatedAt: at(2 * DAY),
    beneficiary: { alias: null, holderName: "Demo Creator", bankName: "Banco Aurora", accountLast4: "4417", currency: "EUR" },
  },
];

const RAILS: RailAccount[] = [{ id: "va-eur-1", currency: "eur", provider: "bridge", railType: "sepa" }];

const ALIASES: AliasRecord[] = [
  { id: "alias-1", alias: "@demo_creator", targetChain: "solana", targetAddress: MINE.solana, isPublic: true, createdAt: at(120 * DAY) },
];

/* ── The price series ─────────────────────────────────────────────── */

/**
 * A seeded walk ending on today's price.
 *
 * Built backwards from `PRICES` so the last point of every series is the price
 * the rest of the screen uses: a curve that ended anywhere else would argue
 * with the total printed above it. The seed is the symbol and the range, so
 * the same link twice draws the same line.
 */
function series(symbol: string, days: number): [number, number][] {
  const price = PRICES[symbol.toUpperCase()];
  if (!price) return [];
  const step = days <= 7 ? HOUR : days <= 30 ? 4 * HOUR : DAY;
  const count = Math.max(12, Math.round((days * DAY) / step));

  let seed = days * 7919;
  for (const c of symbol.toUpperCase()) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const next = () => {
    // A small LCG: enough wobble to look like a market, and the same wobble every time.
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };

  // A gentle drift so a longer range shows more of a story than a shorter one.
  const drift = symbol.toUpperCase() === "SOL" ? 0.22 : 0.14;
  const out: [number, number][] = [];
  let value = price;
  for (let i = 0; i < count; i += 1) {
    out.push([NOW - i * step, Number(value.toFixed(value > 100 ? 2 : 4))]);
    const wobble = (next() - 0.5) * 0.02;
    value = value / (1 + drift / count) / (1 + wobble);
  }
  return out.reverse();
}

/* ── Answers ──────────────────────────────────────────────────────── */

function balancesFor(account: string): BalancesAnswer {
  return { balances: LIQUID[account] ?? [], updatedAt: at(2 * MINUTE) };
}

function detailsFor(t: Transfer): TransferDetails {
  return {
    id: t.id,
    chain: t.chain,
    chainLegacy: t.chain,
    tokenId: t.tokenId,
    amount: t.amount,
    toAddress: t.toAddress ?? null,
    status: t.status,
    txHash: t.txHash ?? null,
    error: null,
    fromWallet:
      t.direction === "out" || t.direction === "exchange"
        ? { id: `w-${t.chain}`, chain: t.chain, address: t.chain === "solana" ? MINE.solana : MINE.evm, label: "HOLD wallet" }
        : null,
    inbound:
      t.direction === "in"
        ? { confirmations: 32, confirmedAt: t.createdAt, fromAddress: t.fromAddress ?? null, tokenId: t.tokenId, amount: t.amount }
        : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt ?? t.createdAt,
  };
}

/**
 * Somebody who has not made a wallet yet has no money anywhere, and the money
 * screens should say so rather than print a stranger's figures.
 *
 * `/ledger/my-container` still answers, with Main and Savings and no pocket:
 * asking it is what CREATES those two rows, so they exist for anybody who has
 * opened the product at all. It is the state the app's own empty Home was
 * written for, and `?demo-wallet=none` is the link that reaches it.
 */
const nobody = () => demoState().wallet === "none";

/**
 * One call the money screens make, or null when it is not one of theirs (the
 * Spaces store answers it then).
 */
export function moneyAnswer(method: string, path: string, query: URLSearchParams): Answer | null {
  const seg = path.split("/").filter(Boolean);
  const is = (m: string, ...parts: string[]): boolean =>
    m === method && parts.length === seg.length && parts.every((p, i) => p === ":" || p === seg[i]);
  const empty = nobody();

  /* What each account holds */
  if (is("GET", "balances")) return ok(empty ? { balances: [], updatedAt: at(0) } : balancesFor(query.get("account") || "main"));

  /* What things are worth */
  if (is("GET", "prices")) {
    const prices: Record<string, number> = {};
    for (const s of (query.get("symbols") ?? "").split(",")) {
      const key = s.trim().toUpperCase();
      if (key && PRICES[key] !== undefined) prices[key] = PRICES[key];
    }
    for (const m of (query.get("mints") ?? "").split(",")) {
      const key = m.trim();
      if (key && MINT_PRICES[key] !== undefined) prices[key] = MINT_PRICES[key];
    }
    return ok({ prices });
  }
  if (is("GET", "prices", "history")) {
    const symbol = (query.get("symbol") ?? "").toUpperCase();
    const days = Number(query.get("days") ?? 7);
    return ok({ symbol, prices: series(symbol, days) });
  }

  /* What moved */
  if (is("GET", "transfers")) {
    const limit = Math.max(1, Math.min(200, Number(query.get("limit") ?? 50)));
    const offset = Math.max(0, Number(query.get("offset") ?? 0));
    const all = empty ? [] : TRANSFERS;
    const page = all.slice(offset, offset + limit);
    return ok({ transfers: page, total: all.length, hasMore: offset + page.length < all.length });
  }
  if (is("GET", "transfers", ":", "details")) {
    const t = BY_ID.get(decodeURIComponent(seg[1]));
    return t ? ok(detailsFor(t)) : refuse(404, "NOT_FOUND");
  }

  /* The accounts, and how their money is split */
  if (is("GET", "ledger", "my-container")) {
    const subaccounts = empty ? SUBACCOUNTS.filter((a) => a.isSystem) : SUBACCOUNTS;
    return ok({ container: { id: CONTAINER_ID }, subaccounts } satisfies ContainerAnswer);
  }
  if (is("GET", "ledger", "containers", ":", "balances")) {
    const rows = empty || decodeURIComponent(seg[2]) !== CONTAINER_ID ? [] : SPLIT_ROWS;
    return ok({ balances: rows });
  }

  /* What it earns */
  if (is("POST", "yield", "kamino", "positions")) return ok({ positions: empty ? [] : KAMINO_POSITIONS });
  // Nothing is supplied on Base or Polygon: the fixture's whole working balance is Kamino's.
  if (is("POST", "yield", "aave", "positions")) return ok({ positions: [] as YieldPosition[] });
  if (is("GET", "yield", "kamino", "reserves")) return ok({ reserves: KAMINO_RESERVES });
  if (is("GET", "yield", "aave", "reserves")) return ok({ reserves: AAVE_RESERVES });
  if (is("GET", "yield", "authorization")) return ok(AUTHORIZATION);

  /* What it cost */
  if (is("GET", "portfolio", "cost-basis")) return ok({ positions: empty ? [] : COST_BASIS });

  /* Standing payments, payouts, rails, the person's name */
  if (is("GET", "scheduled-payments")) return ok({ schedules: empty ? [] : SCHEDULES });
  if (is("GET", "offramp", "orders")) return ok({ orders: empty ? [] : PAYOUTS, hasMore: false, nextBefore: null });
  if (is("GET", "rails", "accounts")) return ok({ accounts: empty ? [] : RAILS });
  if (is("GET", "alias")) return ok({ aliases: ALIASES });

  return null;
}
