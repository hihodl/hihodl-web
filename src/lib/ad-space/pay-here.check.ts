/**
 * npx sucrase-node src/lib/ad-space/pay-here.check.ts
 */

import { browseWalletsFor, checkoutPageUrl, holdSpotUrl, isPositionId } from "./pay-here";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const ID = "3f2b8c1e-9d4a-4e7b-a1c2-5d6e7f8a9b0c";
const here = { origin: "https://hihodl.xyz", pathname: "/s/demo_creator/token2049", search: "?utm=x&pay=old" };

eq("a spot id", isPositionId(ID), true);
eq("not a spot id", isPositionId("../../x"), false);
eq("space page", checkoutPageUrl(here, ID, null), `https://hihodl.xyz/s/demo_creator/token2049?pay=${ID}`);
eq("junk id", checkoutPageUrl(here, "<script>", null), null);
eq("offer page kept as it is", checkoutPageUrl({ ...here, pathname: "/o/tok", search: "" }, ID, "tok"), "https://hihodl.xyz/o/tok");
eq("hold link", holdSpotUrl("/s/demo_creator/token2049", ID), `hihodl://s/demo_creator/token2049?pay=${ID}`);
eq("hold link, trailing slash", holdSpotUrl("/s/demo_creator/token2049/", ID), `hihodl://s/demo_creator/token2049?pay=${ID}`);
eq("no hold link off a space", holdSpotUrl("/o/tok", ID), null);
eq("no hold link for a junk id", holdSpotUrl("/s/a/b", "x"), null);
eq("solana wallets", browseWalletsFor("solana"), ["phantom", "solflare"]);
eq("evm wallets", browseWalletsFor("base"), ["metamask", "coinbase", "trust"]);

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
