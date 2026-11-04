/**
 * Proof for the spending port (no test runner here):
 *
 *   npx sucrase-node src/lib/app/spending/spending.check.ts
 *
 * Two halves.
 *
 *   FIXTURES   what the analytics must say about a hand-built month, with the
 *              one spending fixture the app's own tests carry
 *              (__tests__/features/anAmountWithNoRateIsNotConverted: "a
 *              spending total does not count euros as dollars").
 *
 *   PARITY     the app's own modules, loaded from a hihodl-wallet checkout,
 *              asked the same questions as the port: every MCC from 0 to 9999,
 *              every fixture through the classifier, the payout / spend split,
 *              the counterparty key and label, the subscription detector and
 *              the ranges. Set HOLD_APP to the checkout; when it is not found
 *              the parity half says so and is skipped, never passed.
 *
 * Exits 1 on the first failure.
 */

import fs from "fs";
import Module from "module";
import path from "path";

import { NO_OVERRIDES, computeSpendingAnalytics } from "./analytics";
import { transferUsd } from "./amounts";
import { classifyCategory, counterpartyKey, counterpartyLabel, isPayoutTransfer, isSpendTransfer } from "./categorize";
import { categoryFromMcc } from "./mcc";
import { customRange, monthRange, priorRange, rollingRange, shiftMonth } from "./range";
import { inferSubscriptionCategory } from "./subscriptionCategories";
import { detectSubscriptions } from "./subscriptions";
import type { SpendTransfer } from "./types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/* ── Fixtures ─────────────────────────────────────────────────────── */

let n = 0;
function tx(p: Partial<SpendTransfer> & { createdAt: string }): SpendTransfer {
  n += 1;
  return {
    id: `t${n}`,
    direction: "out",
    chain: "solana",
    tokenId: "usdc",
    symbol: "USDC",
    amount: "10",
    status: "confirmed",
    ...p,
  } as SpendTransfer;
}

const JUNE = monthRange(2026, 5);
const MAY = monthRange(2026, 4);
const d = (day: number, month = 6) => new Date(2026, month - 1, day, 12).toISOString();

const FIXTURES: SpendTransfer[] = [
  // income
  tx({ direction: "in", amount: "1000", fromAlias: "@acme", createdAt: d(1) }),
  tx({ direction: "in", amount: "250", fromAddress: "0x1111111111111111111111111111111111111111", createdAt: d(15) }),
  // card spend with an MCC (groceries), and a card spend with no name (shape → shopping)
  tx({ method: "card", mcc: "5411", amount: "80", merchantName: "Some shop", createdAt: d(3) }),
  tx({ method: "card", amount: "40", createdAt: d(4) }),
  // keywords: "uber eats dinner" is eating out, not transport
  tx({ note: "uber eats dinner", amount: "25", toAddress: "", createdAt: d(5) }),
  // a peer by @alias
  tx({ toAlias: "@maria", amount: "60", createdAt: d(6) }),
  // Netflix by merchant name, and again last month (a subscription)
  tx({ merchantName: "Netflix", amount: "15.99", createdAt: d(10) }),
  tx({ merchantName: "Netflix", amount: "15.99", createdAt: d(10, 5) }),
  // a payout to a bank rail — not spend
  tx({ method: "pix", amount: "300", createdAt: d(12) }),
  // an internal move and the phantom deposit sharing its hash — neither in nor out
  tx({ direction: "move", amount: "500", txHash: "h1", createdAt: d(13) }),
  tx({ direction: "in", amount: "500", txHash: "h1", createdAt: d(13) }),
  // a V3 intent leg, dust, a pending row and a volatile coin with no captured value
  tx({ amount: "20", parentIntentId: "p1", createdAt: d(14) }),
  tx({ amount: "0.0001", createdAt: d(14) }),
  tx({ amount: "30", status: "pending", createdAt: d(14) }),
  tx({ amount: "2", symbol: "SOL", tokenId: "sol", createdAt: d(14) }),
  // a volatile coin WITH a frozen dollar value counts
  tx({ amount: "1", symbol: "SOL", tokenId: "sol", usdValueAtTx: -150, toAddress: "So11111111111111111111111111111111111111112", createdAt: d(16) }),
  // EVM raw 6dp integer
  tx({ chain: "base", tokenId: "usdc", amount: "12000000", toAddress: "0x2222222222222222222222222222222222222222", createdAt: d(17) }),
  // a euro token with no captured value and no euro rate: 0 (the app's own test)
  tx({ symbol: "EURC", tokenId: "eurc", amount: "10", createdAt: d(18) }),
  // last month: spend for the delta
  tx({ method: "card", mcc: "5812", amount: "100", createdAt: d(20, 5) }),
];

check("the app's fixture: 10 EURC with no rate is $0", transferUsd({ amount: "10", symbol: "EURC", chain: "solana" } as SpendTransfer) === 0);
check("the app's fixture: 10 USDC is $10", transferUsd({ amount: "10", symbol: "USDC", chain: "solana" } as SpendTransfer) === 10);
check("a raw 6dp EVM amount is read in dollars", transferUsd(FIXTURES[16]) === 12);

const a = computeSpendingAnalytics(FIXTURES, JUNE, false);
check("income = both deposits, not the phantom leg", near(a.income, 1250), String(a.income));
// 80 + 40 + 25 + 60 + 15.99 + 150 + 12 = 382.99 (EURC is 0 and skipped)
check("spend", near(a.spend, 382.99), String(a.spend));
check("payouts sit apart", near(a.payouts, 300), String(a.payouts));
check("net kept = income − spend", near(a.netKept, 1250 - 382.99));
check("internal moves are excluded, and counted", near(a.excludedInternal, 500));
check("the Transfers drill-down holds the move", (a.transfersByCategory.transfers ?? []).length === 1);
const cat = Object.fromEntries(a.categories.map((c) => [c.id, c.amount]));
check("MCC 5411 → groceries", near(cat.groceries ?? 0, 80));
check("a nameless card spend → shopping", near(cat.shopping ?? 0, 40));
check("'uber eats dinner' → eating out", near(cat.eating_out ?? 0, 25));
check("Netflix → subscriptions", near(cat.subscriptions ?? 0, 15.99));
// @maria 60 + the SOL send to a base58 address 150 + the EVM send 12
check("peers and raw addresses → people", near(cat.people ?? 0, 222), String(cat.people));
check("slices are sorted and ranked", a.categories.every((c, i) => c.rank === i && (i === 0 || a.categories[i - 1].amount >= c.amount)));
check("slice shares sum to 1", near(a.categories.reduce((s, c) => s + c.pct, 0), 1));
check("prior month spend drives the delta", a.spendDeltaPct !== null && near(a.spendDeltaPct, (382.99 - 115.99) / 115.99), String(a.spendDeltaPct));
check("no income last month → no income delta", a.incomeDeltaPct === null);
check("June is 30 daily buckets", a.series.length === 30 && a.priorSeries.length === 31, `${a.series.length}/${a.priorSeries.length}`);
check("the series sums to the spend", near(a.series.reduce((s, p) => s + p.spend, 0), a.spend));
check("income sources, largest first", a.incomeSources[0]?.key === "@acme" && a.incomeSources.length === 2);

const may = computeSpendingAnalytics(FIXTURES, MAY, false);
check("May: Netflix and a restaurant", near(may.spend, 115.99));

const subs = detectSubscriptions(FIXTURES, { maps: NO_OVERRIDES, nowMs: new Date(2026, 5, 20).getTime() });
const netflix = subs.find((s) => s.label === "Netflix");
check("Netflix is detected as recurring", !!netflix && netflix.cadenceDays === 30 && netflix.subCategory === "streaming", JSON.stringify(netflix && { c: netflix.cadenceDays, s: netflix.subCategory }));
check("its next charge is after now", !!netflix && netflix.nextChargeAt >= new Date(2026, 5, 20).getTime());

/* ── Parity with the app's own modules ────────────────────────────── */

const APP = process.env.HOLD_APP || path.resolve(__dirname, "../../../../../../../hihodl-wallet/.worktrees/one-wallet");
const APP_SPENDING = path.join(APP, "src/features/spending");

if (!fs.existsSync(path.join(APP_SPENDING, "categorize.ts"))) {
  console.log(`SKIP parity: no app checkout at ${APP} (set HOLD_APP)`);
} else {
  // The app's modules import through its `@/` alias. The spending ones only
  // need the stablecoin table and the FX helper; the FX helper is the app's
  // no-rate case, which is the only case the web has.
  const M = Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown };
  const load = M._load;
  M._load = function (req: string, parent: unknown, isMain: boolean) {
    if (req === "@/utils/dashboard/currencyHelpers") {
      return { getUsableFxRate: (c: string) => (c.toUpperCase() === "USD" ? 1 : null) };
    }
    if (req.startsWith("@/")) return load(path.join(APP, "src", req.slice(2)), parent, isMain);
    return load(req, parent, isMain);
  };

  const app = {
    mcc: require(path.join(APP_SPENDING, "mcc.ts")),
    cat: require(path.join(APP_SPENDING, "categorize.ts")),
    amounts: require(path.join(APP_SPENDING, "amounts.ts")),
    subs: require(path.join(APP_SPENDING, "subscriptions.ts")),
    subCats: require(path.join(APP_SPENDING, "subscriptionCategories.ts")),
    range: require(path.join(APP_SPENDING, "range.ts")),
  };

  let mccDiff = 0;
  for (let code = 0; code <= 9999; code++) {
    const s = String(code).padStart(4, "0");
    if (app.mcc.categoryFromMcc(s) !== categoryFromMcc(s)) mccDiff++;
  }
  check("parity: every MCC 0000–9999", mccDiff === 0, `${mccDiff} differ`);

  const extra: SpendTransfer[] = [
    tx({ note: "Spotify premium", createdAt: d(2) }),
    tx({ merchantName: "Shell", note: "fuel", createdAt: d(2) }),
    tx({ merchantName: "Airbnb Lisbon", createdAt: d(2) }),
    tx({ note: "rent june alquiler", createdAt: d(2) }),
    tx({ counterpartyType: "mobile_money", createdAt: d(2) }),
    tx({ counterpartyType: "bank", method: "crypto", createdAt: d(2) }),
    tx({ method: "IBAN", createdAt: d(2) }),
    tx({ toAddress: "bc1qxyz", createdAt: d(2) }),
    tx({ note: "random", createdAt: d(2) }),
    tx({ direction: "swap", txHash: "h2", createdAt: d(2) }),
    tx({ merchantName: "Farmacias del Ahorro", mcc: "abc", createdAt: d(2) }),
  ];
  const all = [...FIXTURES, ...extra];
  let classDiff = 0;
  for (const t of all) {
    const mine = JSON.stringify(classifyCategory(t));
    const theirs = JSON.stringify(app.cat.classifyCategory(t));
    const same =
      mine === theirs &&
      isPayoutTransfer(t) === app.cat.isPayoutTransfer(t) &&
      isSpendTransfer(t) === app.cat.isSpendTransfer(t) &&
      counterpartyKey(t) === app.cat.counterpartyKey(t) &&
      counterpartyLabel(t) === app.cat.counterpartyLabel(t) &&
      transferUsd(t) === app.amounts.transferUsd(t) &&
      inferSubscriptionCategory(t) === app.subCats.inferSubscriptionCategory(t);
    if (!same) {
      classDiff++;
      console.log(`     differs on ${t.id}: web ${mine}, app ${theirs}`);
    }
  }
  check(`parity: classifier, payout/spend, key, label, dollars, subscription kind (${all.length} rows)`, classDiff === 0);

  const now = new Date(2026, 5, 20).getTime();
  const strip = (xs: { lastTransfer: unknown }[]) => JSON.stringify(xs.map(({ lastTransfer, ...r }) => ({ ...r, last: (lastTransfer as SpendTransfer).id })));
  check(
    "parity: detected subscriptions",
    strip(detectSubscriptions(all, { maps: NO_OVERRIDES, nowMs: now })) === strip(app.subs.detectSubscriptions(all, { maps: NO_OVERRIDES, nowMs: now })),
  );

  const ranges = [JUNE, shiftMonth(JUNE, -1), rollingRange(30, now), rollingRange(365, now), customRange(now - 9 * 86_400_000, now)];
  const appRanges = [
    app.range.monthRange(2026, 5),
    app.range.shiftMonth(app.range.monthRange(2026, 5), -1),
    app.range.rollingRange(30, now),
    app.range.rollingRange(365, now),
    app.range.customRange(now - 9 * 86_400_000, now),
  ];
  check("parity: ranges and their prior windows", JSON.stringify(ranges.map((r) => [r, priorRange(r)])) === JSON.stringify(appRanges.map((r) => [r, app.range.priorRange(r)])));

  M._load = load;
}

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
