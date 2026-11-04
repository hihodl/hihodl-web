/**
 * Proof for the sign-in gate (no test runner here):
 *
 *   npx sucrase-node src/lib/app/app-wallet-gate.check.ts
 *
 * Exits 1 on the first failure.
 */

import { hasAppWallet, openWithoutApp, payerOf, SPACES_OPEN_WITHOUT_APP } from "./app-wallet-gate";

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures++;
}

check("Spaces is open without the app today", SPACES_OPEN_WITHOUT_APP === true);

for (const rel of ["/spaces", "/spaces/", "/spaces/listings", "/spaces/board", "/spaces/bought", "/spaces/team", "/spaces/team?seat=abc", "/spaces/x"]) {
  check(`open: ${rel}`, openWithoutApp(rel));
}
for (const rel of ["", "/", "/wallet", "/wallet/send", "/wallet/link", "/payments", "/travel", "/travel/stay/1/book", "/account", "/menu", "/spacesx", "/benefits"]) {
  check(`needs the app: ${rel || "(home)"}`, !openWithoutApp(rel));
}
check("closing Spaces closes /spaces/board too", !openWithoutApp("/spaces/board", false));

check("app_wallet lets in", hasAppWallet({ state: "app_wallet" }));
check("none does not", !hasAppWallet({ state: "none" }));
check("web_wallet does not", !hasAppWallet({ state: "web_wallet" }));
check("an unread status does not", !hasAppWallet(null) && !hasAppWallet(undefined) && !hasAppWallet({}));

// canPayFromWeb: the phone, or linking it, or the app. Never the passkey.
check("app is the phone", payerOf({ state: "app_wallet", canPayFromWeb: "app" }) === "app");
check("link_first is kept", payerOf({ state: "app_wallet", canPayFromWeb: "link_first" }) === "link_first");
check("none is kept", payerOf({ state: "none", canPayFromWeb: "none" }) === "none");
check("snake_case is read", payerOf({ state: "app_wallet", can_pay_from_web: "app" } as { state: string }) === "app");
check("an old web_passkey never pays: link first", payerOf({ state: "web_wallet", canPayFromWeb: "web_passkey" }) === "link_first");
check("no field, app wallet: link first", payerOf({ state: "app_wallet" }) === "link_first");
check("no field, no wallet: none", payerOf({ state: "none" }) === "none");
check("unread: none", payerOf(null) === "none" && payerOf(undefined) === "none");

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log("all good");
