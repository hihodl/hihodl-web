/**
 * The quickstart a creator copies from Settings › Developers.
 *
 *   create   a curl that makes a checkout with a secret key
 *   verify   Node code that checks HOLD-Signature: t=<unix>,v1=<hex HMAC-SHA256
 *            of "<t>.<raw body>"> with the endpoint's signing secret, in
 *            constant time, inside a five-minute window
 *
 * The verify snippet is run for real by snippets.check.ts against a signature
 * made the way the backend makes it, so the code on the page is code that works.
 *
 * Pure: no React, no `@/` imports.
 */

export const API_ORIGIN = "https://api.hihodl.xyz/api/v1";

export function createCheckoutCurl(): string {
  return [
    `curl ${API_ORIGIN}/checkouts \\`,
    `  -H "Authorization: Bearer $HOLD_SECRET_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "amount": "40.00",`,
    `    "currency": "USD",`,
    `    "orderId": "order_1042",`,
    `    "description": "Pitch deck review",`,
    `    "successUrl": "https://example.com/thanks",`,
    `    "cancelUrl": "https://example.com/cart"`,
    `  }'`,
    ``,
    `# → { "id": "…", "url": "https://hihodl.xyz/pay/c/…", "status": "open" }`,
  ].join("\n");
}

/** Node 18+, no dependencies. `rawBody` must be the bytes as received, not re-serialised JSON. */
export const VERIFY_NODE = `const crypto = require("crypto");

// header: req.headers["hold-signature"], rawBody: the request body as a string or Buffer
function verifyHoldSignature(header, rawBody, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    String(header || "").split(",").map((p) => p.trim().split("=", 2))
  );
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isInteger(t)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(t + "." + rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: app.post("/hold/webhook", express.raw({ type: "application/json" }), (req, res) => {
//   if (!verifyHoldSignature(req.get("HOLD-Signature"), req.body, process.env.HOLD_WEBHOOK_SECRET)) {
//     return res.sendStatus(400);
//   }
//   const event = JSON.parse(req.body);
//   if (event.type === "checkout.paid") { /* fulfil the order */ }
//   res.sendStatus(200);
// });`;
