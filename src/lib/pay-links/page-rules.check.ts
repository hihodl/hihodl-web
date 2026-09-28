/**
 * npx sucrase-node src/lib/pay-links/page-rules.check.ts
 *
 * The pay page's pure decisions: device, currency, amounts, Coinflow's
 * messages, the app's address and the face's initials.
 */

import {
  appSchemeUrl,
  cleanAmountInput,
  defaultCurrency,
  detectPlatform,
  initialsFor,
  isCoinflowCheckoutUrl,
  isCoinflowOrigin,
  minorFromUsdCents,
  parseMinor,
  readCoinflowMessage,
  safeAvatarUrl,
  usdCentsFromMinor,
  walletMethodFor,
  walletBrowseUrl,
  payStateUrl,
  readPayState,
  holdPayUrl,
  offers,
  walletMethodKind,
  bankTransfersOf,
  groupIban,
  fallbackHref,
  payHandleOf,
  cleanPrefillNote,
} from "./page-rules";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    fails++;
    console.log("FAIL", name, ja, "!=", jb);
  } else console.log("ok  ", name);
}

const CARD = ["USD", "EUR", "GBP", "MXN", "BRL"];

eq("iphone", detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
eq("ipad as mac", detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
eq("mac", detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "mac");
eq("android", detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "android");
eq("windows", detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
eq("apple pay on mac", walletMethodFor("mac"), "applePay");
eq("google pay on windows", walletMethodFor("desktop"), "googlePay");

eq("es-ES EUR", defaultCurrency(["es-ES"], CARD), "EUR");
eq("es-MX MXN", defaultCurrency(["es-MX", "es"], CARD), "MXN");
eq("pt-BR BRL", defaultCurrency(["pt-BR"], CARD), "BRL");
eq("en-GB GBP", defaultCurrency(["en-GB"], CARD), "GBP");
eq("bare en USD", defaultCurrency(["en"], CARD), "USD");
eq("ja-JP not offered USD", defaultCurrency(["ja-JP"], CARD), "USD");
eq("no card USD", defaultCurrency(["es-ES"], null), "USD");
eq("no USD in list: first", defaultCurrency(["ja-JP"], ["EUR", "GBP"]), "EUR");

eq("clean dot", cleanAmountInput("25.505", "EUR"), "25.50");
eq("clean comma", cleanAmountInput("25,5", "EUR"), "25,5");
eq("clean letters", cleanAmountInput("€1a2", "EUR"), "12");
eq("clean lone point", cleanAmountInput(".5", "USD"), "0.5");
eq("clean zeros", cleanAmountInput("007", "USD"), "7");
eq("clean two points", cleanAmountInput("1.2.3", "USD"), "1.23");
eq("parse 25", parseMinor("25", "EUR"), 2500);
eq("parse 25,5", parseMinor("25,5", "EUR"), 2550);
eq("parse 0.05", parseMinor("0.05", "USD"), 5);
eq("parse too many decimals", parseMinor("1.234", "USD"), null);
eq("parse empty", parseMinor("", "USD"), null);
eq("parse jpy", parseMinor("500", "JPY"), 500);

const rates = { EUR: 0.9, MXN: 20 };
eq("usd from eur", usdCentsFromMinor(900, "EUR", rates), 1000);
eq("usd from usd", usdCentsFromMinor(1234, "USD", null), 1234);
eq("no rate", usdCentsFromMinor(900, "GBP", rates), null);
eq("mxn from usd", minorFromUsdCents(1000, "MXN", rates), 20000);

eq("success string", readCoinflowMessage(JSON.stringify({ data: "success", info: { paymentId: "p1" } })), { kind: "success", paymentId: "p1" });
eq("success object", readCoinflowMessage({ data: "success", info: {} }), { kind: "success", paymentId: null });
eq("height", readCoinflowMessage(JSON.stringify({ method: "heightChange", data: "612.4" })), { kind: "height", px: 613 });
eq("junk", readCoinflowMessage("not json"), null);
eq("other", readCoinflowMessage(JSON.stringify({ data: "failure" })), null);
eq("origin sandbox", isCoinflowOrigin("https://sandbox.coinflow.cash"), true);
eq("origin evil", isCoinflowOrigin("https://coinflow.cash.evil.com"), false);
eq("origin from checkout url", isCoinflowOrigin("https://merchant.coinflow.cash", "https://merchant.coinflow.cash/solana/purchase/x"), true);
eq("origin not coinflow url", isCoinflowOrigin("https://evil.com", "https://evil.com/x"), false);
eq("checkout url ok", isCoinflowCheckoutUrl("https://sandbox.coinflow.cash/solana/purchase/abc"), true);
eq("checkout url http", isCoinflowCheckoutUrl("http://coinflow.cash/x"), false);
eq("checkout url other", isCoinflowCheckoutUrl("https://evilcoinflow.cash/x"), false);

eq("scheme personal", appSchemeUrl({ personal: true, owner: { handle: "Demo_Creator" } }), "hihodl://pay/@demo_creator");
eq("scheme code link", appSchemeUrl({ personal: false, owner: { handle: "dana" } }), null);
eq("scheme no handle", appSchemeUrl({ personal: true, owner: { handle: null } }), null);

eq("initials two words", initialsFor("Demo Creator", "demo"), "DC");
eq("initials one word", initialsFor("Dana", null), "DA");
eq("initials from handle", initialsFor(null, "dana.k"), "DA");
eq("initials nothing", initialsFor("  ", null), "?");
eq("avatar https", safeAvatarUrl("https://x.supabase.co/a.jpg?token=1"), "https://x.supabase.co/a.jpg?token=1");
eq("avatar javascript", safeAvatarUrl("javascript:alert(1)"), null);
eq("avatar http", safeAvatarUrl("http://x/a.jpg"), null);

const page = "https://hihodl.xyz/pay/@demo?amount=25.00&currency=EUR&pay=stablecoins&network=base";
eq("phantom", walletBrowseUrl("phantom", "https://hihodl.xyz/pay/@demo?amount=5"), "https://phantom.app/ul/browse/https%3A%2F%2Fhihodl.xyz%2Fpay%2F%40demo%3Famount%3D5?ref=https%3A%2F%2Fhihodl.xyz");
eq("solflare", walletBrowseUrl("solflare", "https://hihodl.xyz/pay/x"), "https://solflare.com/ul/v1/browse/https%3A%2F%2Fhihodl.xyz%2Fpay%2Fx?ref=https%3A%2F%2Fhihodl.xyz");
eq("metamask", walletBrowseUrl("metamask", "https://hihodl.xyz/pay/x?a=1"), "https://metamask.app.link/dapp/hihodl.xyz/pay/x?a=1");
eq("coinbase", walletBrowseUrl("coinbase", "https://hihodl.xyz/pay/x"), "https://go.cb-w.com/dapp?cb_url=https%3A%2F%2Fhihodl.xyz%2Fpay%2Fx");
eq("trust", walletBrowseUrl("trust", "https://hihodl.xyz/pay/x"), "https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Fhihodl.xyz%2Fpay%2Fx");
eq("state url", payStateUrl("https://hihodl.xyz/pay/@demo?amount=1#x", { amount: "25.00", currency: "EUR", network: "base" }), page);
eq("state read", readPayState(new URL(page).search), { amount: "25.00", currency: "EUR", stablecoins: true, network: "base", note: null });
eq("state read arc", readPayState("?amount=5&currency=USD&network=arc").network, "arc");
eq("state read junk", readPayState("?amount=1e9&currency=GBP&network=eth"), { amount: null, currency: null, stablecoins: false, network: null, note: null });
eq("state read note", readPayState("?amount=150.00&currency=USD&note=Pitch%20deck%20review").note, "Pitch deck review");
eq("note: controls and overrides go", cleanPrefillNote("a\u202Eb\nc\u0000d"), "a b c d");
eq("note: blank is none", cleanPrefillNote("  \u200B "), null);
eq("note: capped at 140", cleanPrefillNote("x".repeat(300))?.length, 140);

const dead = { title: "Pitch deck review", amount: { mode: "fixed" as const, cents: 15000 }, fallback: { handle: "dana", path: "/pay/@dana" } };
eq("fallback closed carries amount and title", fallbackHref({ ...dead, status: "closed" }), "/pay/@dana?amount=150.00&currency=USD&note=Pitch+deck+review");
eq("fallback expired", fallbackHref({ ...dead, status: "expired" }), "/pay/@dana?amount=150.00&currency=USD&note=Pitch+deck+review");
eq("fallback frozen", fallbackHref({ ...dead, status: "frozen" }), "/pay/@dana?amount=150.00&currency=USD&note=Pitch+deck+review");
eq("fallback paid carries nothing", fallbackHref({ ...dead, status: "paid" }), "/pay/@dana");
eq("fallback open amount: the title only", fallbackHref({ ...dead, amount: { mode: "open", maxCents: null }, status: "closed" }), "/pay/@dana?note=Pitch+deck+review");
eq("fallback never on disabled", fallbackHref({ ...dead, status: "disabled" }), null);
eq("fallback never on active", fallbackHref({ ...dead, status: "active" }), null);
eq("fallback none", fallbackHref({ ...dead, fallback: null, status: "closed" }), null);
eq("fallback: a personal link is never sent on", fallbackHref({ ...dead, personal: true, status: "closed" }), null);
eq("fallback: path must match the handle", fallbackHref({ ...dead, fallback: { handle: "dana", path: "https://evil.example/pay/@dana" }, status: "closed" }), null);
eq("fallback: bad handle", fallbackHref({ ...dead, fallback: { handle: "../x", path: "/pay/@../x" }, status: "closed" }), null);
eq("fallback: case folds", fallbackHref({ ...dead, fallback: { handle: "Dana", path: "/pay/@Dana" }, status: "paid" }), "/pay/@dana");
eq("handle input", payHandleOf(" @Dana_1 "), "dana_1");
eq("handle input junk", payHandleOf("dana smith"), null);
eq("handle input empty", payHandleOf("@"), null);
eq("hold url", holdPayUrl("hihodl://pay/@demo", "25.00", "USD"), "hihodl://pay/@demo?amount=25.00&currency=USD");
eq("hold url bare", holdPayUrl("hihodl://pay/@demo", null, "USD"), "hihodl://pay/@demo");
eq("initials verified name", initialsFor("Alex L.", "hialex"), "AL");
eq("currency EUR region", defaultCurrency(["de-DE"], ["USD", "EUR"]), "EUR");
eq("currency ng", defaultCurrency(["en-NG"], ["USD", "EUR"]), "USD");
eq("offers: an older server names none, every row shows", offers({}, "card"), true);
eq("offers: named", offers({ methods: [{ kind: "hold" }, { kind: "stablecoins" }, { kind: "card" }] }, "card"), true);
eq("offers: not named", offers({ methods: [{ kind: "hold" }, { kind: "stablecoins" }] }, "card"), false);
eq("offers: an empty list offers nothing", offers({ methods: [] }, "hold"), false);
eq("offers: a bank transfer is not a card", offers({ methods: [{ kind: "bank_transfer", currency: "EUR", payerMustBeBusiness: true }] }, "card"), false);
eq("wallet kind apple", walletMethodKind("applePay"), "apple_pay");
eq("wallet kind google", walletMethodKind("googlePay"), "google_pay");

const EUR_BT = {
  currency: "EUR",
  reference: "HOLD-7K2MXQ9P",
  payerMustBeBusiness: true,
  account: { iban: "DE89370400440532013000", bic: "COBADEFFXXX", holderName: "Dana Lee" },
};
const USD_BT = {
  currency: "USD",
  reference: "HOLD-7K2MXQ9P",
  payerMustBeBusiness: true,
  account: { accountNumber: "900123456789", routingNumber: "101019644", holderName: "Dana Lee", rails: ["ach", "wire"] as ("ach" | "wire")[] },
};
const bankMethod = (currency: string) => ({ kind: "bank_transfer" as const, currency, payerMustBeBusiness: true });
eq("bank: an older server shows none", bankTransfersOf({ bankTransfers: [EUR_BT] }).length, 0);
eq("bank: only what methods list", bankTransfersOf({ methods: [bankMethod("USD")], bankTransfers: [EUR_BT, USD_BT] }).map((b) => b.currency), ["USD"]);
eq("bank: both", bankTransfersOf({ methods: [bankMethod("EUR"), bankMethod("USD")], bankTransfers: [EUR_BT, USD_BT] }).length, 2);
eq("bank: listed but no account sent", bankTransfersOf({ methods: [bankMethod("EUR")], bankTransfers: [] }).length, 0);
eq("bank: no holder, no row", bankTransfersOf({ methods: [bankMethod("EUR")], bankTransfers: [{ ...EUR_BT, account: { ...EUR_BT.account, holderName: " " } }] }).length, 0);
eq("bank: no reference, no row", bankTransfersOf({ methods: [bankMethod("EUR")], bankTransfers: [{ ...EUR_BT, reference: "" }] }).length, 0);
eq("iban grouped", groupIban("DE89370400440532013000"), "DE89 3704 0044 0532 0130 00");

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
