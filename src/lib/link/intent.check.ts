/**
 * Proof for the app intents and the tx-challenge digest (no test runner here):
 *
 *   npx sucrase-node src/lib/link/intent.check.ts
 *
 * Exits 1 on the first failure.
 */

import { createHash } from "crypto";

import { PLAY_STORE_URL } from "../appLinks";
import { txChallenge } from "../wallet/withdraw-core";
import { androidIntentFor, appIntent, openInAppUrl, paymentApprovalIntent, withdrawalIntent } from "./intent";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

const play = encodeURIComponent(PLAY_STORE_URL);

const link = androidIntentFor("https://app.hihodl.xyz/link/abc?k=xyz");
check("link intent", link === `intent://app.hihodl.xyz/link/abc?k=xyz#Intent;scheme=https;package=com.sayhihodl.hihodlai;S.browser_fallback_url=${play};end`, link);

const w = withdrawalIntent("11111111-2222-3333-4444-555555555555");
check(
  "withdrawal intent",
  w === `intent://withdrawals/11111111-2222-3333-4444-555555555555#Intent;scheme=hihodl;package=com.sayhihodl.hihodlai;S.browser_fallback_url=${play};end`,
  w,
);
const pa = paymentApprovalIntent("11111111-2222-3333-4444-555555555555");
check(
  "payment approval intent",
  pa === `intent://payments/approve/11111111-2222-3333-4444-555555555555#Intent;scheme=hihodl;package=com.sayhihodl.hihodlai;S.browser_fallback_url=${play};end`,
  pa,
);
check("app intent strips a leading slash", appIntent("/travel") === appIntent("travel"));
check("open url", openInAppUrl("ad-space/s1") === "https://hihodl.xyz/open?to=ad-space%2Fs1", openInAppUrl("ad-space/s1"));
check("open url round-trips through the opener's ?to", new URL(openInAppUrl("ad-space/s1")).searchParams.get("to") === "ad-space/s1");

// sha256(utf8("hihodl/tx/v1") ‖ sha256(message)), straight from the contract's words.
for (const msg of [new Uint8Array([]), new Uint8Array([1, 2, 3]), new Uint8Array(300).fill(7)]) {
  const inner = createHash("sha256").update(Buffer.from(msg)).digest();
  const ref = createHash("sha256").update(Buffer.from("hihodl/tx/v1", "utf8")).update(inner).digest();
  check(`tx challenge (${msg.length} bytes)`, Buffer.from(txChallenge(msg)).equals(ref));
}

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log("all good");
