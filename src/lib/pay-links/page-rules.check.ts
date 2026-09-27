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

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
