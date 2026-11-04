/**
 * Proof for the link's pure parts (this repo has no test runner):
 *
 *   npx sucrase-node src/lib/link/sas.check.ts
 *
 * Exits 1 on the first failure.
 *
 *   1. SAS: computed here with Node's own sha256 straight from the contract's
 *      words, and compared with computeSas on random keys; plus one fixed
 *      vector anyone can recompute (keys 0x01…, 0x02…, session "s-1").
 *   2. Amounts and addresses: exact base units, refusals.
 *   3. User agents: desktop platform, browser, phone.
 */

import { createHash, randomBytes } from "crypto";

import { computeSas } from "./sas";
import { browserOf, phoneOf, platformOf } from "./ua";
import { canonicalAmount, isSolanaAddress, toBaseUnits } from "../wallet/withdraw-core";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

function referenceSas(sessionId: string, webPub: Uint8Array, appPub: Uint8Array): string {
  const h = createHash("sha256")
    .update(Buffer.from("hihodl/link/v1", "utf8"))
    .update(Buffer.from(sessionId, "utf8"))
    .update(Buffer.from(webPub))
    .update(Buffer.from(appPub))
    .digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

// 1. SAS
const fixedWeb = new Uint8Array(32).fill(1);
const fixedApp = new Uint8Array(32).fill(2);
const fixed = computeSas("s-1", fixedWeb, fixedApp);
check("sas fixed vector matches the reference", fixed === referenceSas("s-1", fixedWeb, fixedApp), `s-1 01…/02… → ${fixed}`);
let agree = true;
for (let i = 0; i < 500; i++) {
  const id = `${randomBytes(8).toString("hex")}-${i}`;
  const a = new Uint8Array(randomBytes(32));
  const b = new Uint8Array(randomBytes(32));
  const s = computeSas(id, a, b);
  if (s !== referenceSas(id, a, b) || !/^\d{6}$/.test(s)) agree = false;
}
check("sas agrees with the reference on 500 random sessions, always 6 digits", agree);
// The backend's vector (feat/link-your-phone): the two sides must agree on it.
const bWeb = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const bApp = Uint8Array.from({ length: 32 }, (_, i) => i + 0x21);
const bId = "7f1c2a9e-3b4d-4e5f-8a6b-1c2d3e4f5a6b";
check("sas matches the backend's vector", computeSas(bId, bWeb, bApp) === "999410", computeSas(bId, bWeb, bApp));
check("sas matches the backend's swapped vector", computeSas(bId, bApp, bWeb) === "403977", computeSas(bId, bApp, bWeb));
check("sas changes when the app key is swapped", computeSas("s-1", fixedWeb, new Uint8Array(32).fill(3)) !== fixed);
check("sas changes with the session", computeSas("s-2", fixedWeb, fixedApp) !== fixed);
let threw = false;
try {
  computeSas("s-1", new Uint8Array(31), fixedApp);
} catch {
  threw = true;
}
check("sas refuses a key that is not 32 bytes", threw);

// 2. Amounts and addresses
check("12.5 USDC = 12500000", toBaseUnits("12.5", "USDC") === 12_500_000n);
check("0.000000001 SOL = 1 lamport", toBaseUnits("0.000000001", "SOL") === 1n);
check("7 decimals of USDC refused", toBaseUnits("1.0000001", "USDC") === null);
check("zero, negative, exponent refused", [toBaseUnits("0", "SOL"), toBaseUnits("-1", "SOL"), toBaseUnits("1e3", "SOL")].every((x) => x === null));
check("12.50 reads as 12.5", canonicalAmount("12.50", "USDC") === "12.5");
check("a real Solana address passes", isSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"));
check("an EVM address fails", !isSolanaAddress("0x52908400098527886E0F7030069857D2E4169EE7"));
check("a 0 or l in base58 fails", !isSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt10"));

// 3. User agents
const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
};
check("mac safari", platformOf(UA.mac) === "mac" && browserOf(UA.mac) === "safari" && phoneOf(UA.mac) === null);
check("windows edge", platformOf(UA.win) === "windows" && browserOf(UA.win) === "edge");
check("linux firefox", platformOf(UA.linux) === "linux" && browserOf(UA.linux) === "firefox");
check("iphone", phoneOf(UA.iphone) === "ios" && platformOf(UA.iphone) === "phone" && browserOf(UA.iphone) === "safari-ios");
check("android (not linux)", phoneOf(UA.android) === "android" && platformOf(UA.android) === "phone" && browserOf(UA.android) === "chrome-android");
check("chromebook", platformOf("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36") === "chromeos");
check("an iPad that says Macintosh, by its touch points", phoneOf(UA.mac, 5) === "ios");

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
