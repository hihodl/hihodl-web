/**
 * npx sucrase-node src/lib/pay-links/checkout.check.ts
 *
 * A creator's checkout (/pay/c/<id>): reading the public answer in the shapes
 * the server may send, the URLs the page will and won't follow, the way back
 * with checkout_id and status, and the wallet-browser path under /pay/c.
 */

import { CHECKOUT_ID_RE, checkoutStatusOf, linkStatusFor, readCheckout, safeReturnUrl, siteOf, successReturnUrl } from "./checkout";
import { payPagePath, readPayState } from "./page-rules";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const ID = "chk_abcdefghijklmnopqrstuvwx";
eq("id shape", CHECKOUT_ID_RE.test(ID), true);
eq("id junk", CHECKOUT_ID_RE.test("../etc"), false);

/* statuses */
eq("open", checkoutStatusOf("open"), "open");
eq("pending is open", checkoutStatusOf("pending"), "open");
eq("paid", checkoutStatusOf("paid"), "paid");
eq("succeeded", checkoutStatusOf("succeeded"), "paid");
eq("cancelled", checkoutStatusOf("cancelled"), "canceled");
eq("unknown is open", checkoutStatusOf(undefined), "open");
eq("paid link is dead", linkStatusFor("paid", "active"), "paid");
eq("expired link is dead", linkStatusFor("expired", undefined), "expired");
eq("canceled closes", linkStatusFor("canceled", "active"), "closed");
eq("failed can be paid again", linkStatusFor("failed", "active"), "active");
eq("frozen link stays frozen", linkStatusFor("open", "frozen"), "frozen");

/* URLs */
eq("https ok", safeReturnUrl("https://shop.example.com/thanks?x=1#done"), "https://shop.example.com/thanks?x=1#done");
eq("http refused", safeReturnUrl("http://shop.example.com/thanks"), null);
eq("http localhost ok", safeReturnUrl("http://localhost:3000/ok"), "http://localhost:3000/ok");
eq("javascript refused", safeReturnUrl("javascript:alert(1)"), null);
eq("credentials refused", safeReturnUrl("https://a:b@shop.example.com/"), null);
eq("not a url", safeReturnUrl("thanks"), null);
eq("return keeps query and hash", successReturnUrl("https://shop.example.com/thanks?ref=a#top", ID), `https://shop.example.com/thanks?ref=a&checkout_id=${ID}&status=paid#top`);
eq("return replaces status", successReturnUrl("https://shop.example.com/t?status=x", ID), `https://shop.example.com/t?status=paid&checkout_id=${ID}`);
eq("cancel spelled like the backend", successReturnUrl("https://shop.example.com/cart", ID, "cancelled"), `https://shop.example.com/cart?checkout_id=${ID}&status=cancelled`);
eq("site", siteOf("https://www.shop.example.com/x"), "shop.example.com");

/* the public answer */
const flat = readCheckout(ID, {
  code: "k7x2m9qa",
  title: "Pitch deck review",
  note: null,
  amount: { mode: "fixed", cents: 4000 },
  chains: ["solana", "base"],
  status: "open",
  owner: { displayName: "Dana", handle: "dana" },
  payTo: { solana: "S", evm: "0x1" },
  successUrl: "https://shop.example.com/thanks",
  cancelUrl: "http://evil.example.com/",
  orderId: "order_1042",
  mode: "live",
});
eq("flat link", flat && { code: flat.link.code, status: flat.link.status, amount: flat.link.amount, personal: flat.link.personal }, { code: "k7x2m9qa", status: "active", amount: { mode: "fixed", cents: 4000 }, personal: false });
eq("flat checkout", flat?.checkout, { id: ID, mode: "live", status: "open", successUrl: "https://shop.example.com/thanks", cancelUrl: null, orderId: "order_1042" });

const nested = readCheckout(ID, {
  checkout: { id: ID, status: "paid", mode: "live", amount: "25.50", currency: "EUR", description: "Two prints", successUrl: null },
  link: { code: "k7x2m9qa", title: null, note: null, amount: null, chains: ["base"], status: "active", owner: null, payTo: null },
});
eq("nested: paid is dead", nested?.link.status, "paid");
eq("nested: string amount", nested?.link.amount, { mode: "fixed", cents: 2550 });
eq("nested: euros", nested?.link.currency, "EUR");
eq("nested: description is the title when there is none", [nested?.link.title, nested?.link.note], ["Two prints", null]);

const desc = readCheckout(ID, { code: "k7x2m9qa", title: "Order #1042", amountCents: 900, chains: ["solana"], status: "open", description: "Blue mug, size L" });
eq("description is the note", desc?.link.note, "Blue mug, size L");
eq("amountCents read", desc?.link.amount, { mode: "fixed", cents: 900 });

const test = readCheckout(ID, { mode: "test", title: "Test order", amount: "10.00", status: "open", chains: [] });
eq("test without a link still shows", test && [test.link.code, test.checkout.mode, test.link.status], [ID, "test", "active"]);
eq("live without a link is unreachable", readCheckout(ID, { mode: "live", title: "x" }), undefined);
eq("junk", readCheckout(ID, null), undefined);

/* the wallet-browser path under /pay/c */
eq("state path under /pay/c", payPagePath(`/pay/c/${ID}/w/USD-25.00-solana`), `/pay/c/${ID}`);
eq("plain checkout path", payPagePath(`/pay/c/${ID}`), `/pay/c/${ID}`);
eq("link path unchanged", payPagePath("/pay/k7x2m9qa/w/USD-25.00-solana"), "/pay/k7x2m9qa");
eq("state read under /pay/c", readPayState("", `/pay/c/${ID}/w/EUR-25.00-base`), { amount: "25.00", currency: "EUR", stablecoins: true, network: "base", note: null });

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
