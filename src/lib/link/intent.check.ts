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
import { androidIntentFor, appIntent, linkUniversalUrl, openLinkFromBrowser, openInAppUrl, openOnPhone, paymentApprovalIntent, withdrawalIntent } from "./intent";

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

// iPhone: the universal links the iOS app claims.
check("link universal url keeps the app host", linkUniversalUrl("https://app.hihodl.xyz/link/abc?k=xyz") === "https://app.hihodl.xyz/link/abc?k=xyz");
check("link universal url moves /app/link onto the app host", linkUniversalUrl("https://hihodl.xyz/app/link/abc?k=xyz") === "https://app.hihodl.xyz/link/abc?k=xyz");
check("link universal url from localhost", linkUniversalUrl("http://localhost:3000/app/link/abc?k=xyz") === "https://app.hihodl.xyz/link/abc?k=xyz");
const id = "11111111-2222-3333-4444-555555555555";
check("open on iPhone: payment approval", openOnPhone(`payments/approve/${id}`, "ios") === `https://hihodl.xyz/open?to=payments%2Fapprove%2F${id}`);
check("open on iPhone: withdrawal", openOnPhone(`withdrawals/${id}`, "ios") === `https://hihodl.xyz/open?to=withdrawals%2F${id}`);
check("open on iPhone round-trips", new URL(openOnPhone(`withdrawals/${id}`, "ios")!).searchParams.get("to") === `withdrawals/${id}`);
check("open on Android is the intent", openOnPhone(`payments/approve/${id}`, "android") === paymentApprovalIntent(id));
check("open on a computer is nothing", openOnPhone("withdrawals/x", null) === null);
const fromSafari = openLinkFromBrowser("https://app.hihodl.xyz/link/abc?k=xyz", "ios");
check("link page on iPhone goes through the opener", new URL(fromSafari).host === "hihodl.xyz" && new URL(fromSafari).searchParams.get("to") === "link/abc?k=xyz", fromSafari);
check("link page under /app on iPhone", new URL(openLinkFromBrowser("https://hihodl.xyz/app/link/abc?k=xyz", "ios")).searchParams.get("to") === "link/abc?k=xyz");
check("link page on Android is the intent", openLinkFromBrowser("https://app.hihodl.xyz/link/abc?k=xyz", "android") === link);

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
