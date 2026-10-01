/**
 * npx sucrase-node src/lib/developers/snippets.check.ts
 *
 * The Node code Settings › Developers hands out is run here, as written,
 * against HOLD-Signature headers made the way the backend makes them
 * (t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">), and the curl names the
 * fields the API reads.
 */

import crypto from "crypto";
import vm from "vm";

import { VERIFY_NODE, createCheckoutCurl } from "./snippets";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const ctx: Record<string, unknown> = { require: (m: string) => (m === "crypto" ? crypto : null), Buffer, Date, Math, Number, String, Object };
vm.runInNewContext(VERIFY_NODE, ctx);
const verify = ctx.verifyHoldSignature as (header: string, body: string | Buffer, secret: string, tolerance?: number) => boolean;

const secret = "whsec_test_123";
const body = JSON.stringify({ type: "checkout.paid", data: { id: "chk_x", orderId: "order_1042" } });
const now = Math.floor(Date.now() / 1000);
const sign = (t: number, b: string, s = secret) => `t=${t},v1=${crypto.createHmac("sha256", s).update(`${t}.${b}`, "utf8").digest("hex")}`;

eq("valid", verify(sign(now, body), body, secret), true);
eq("valid with a Buffer body", verify(sign(now, body), Buffer.from(body), secret), true);
eq("spaces in the header", verify(sign(now, body).replace(",", ", "), body, secret), true);
eq("other secret", verify(sign(now, body, "whsec_other"), body, secret), false);
eq("body changed", verify(sign(now, body), body.replace("1042", "1043"), secret), false);
eq("too old", verify(sign(now - 301, body), body, secret), false);
eq("from the future", verify(sign(now + 301, body), body, secret), false);
eq("no v1", verify(`t=${now}`, body, secret), false);
eq("no header", verify("", body, secret), false);
eq("short v1", verify(`t=${now},v1=abcd`, body, secret), false);

const curl = createCheckoutCurl();
for (const field of ['"amount": "40.00"', '"currency": "USD"', '"orderId"', '"successUrl"', '"cancelUrl"', "Authorization: Bearer", "/api/v1/checkouts"]) {
  eq(`curl has ${field}`, curl.includes(field), true);
}

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
