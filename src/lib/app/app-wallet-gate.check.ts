/**
 * Proof for the sign-in gate (no test runner here):
 *
 *   npx sucrase-node src/lib/app/app-wallet-gate.check.ts
 *
 * Exits 1 on the first failure.
 */

import { createsASpace, hasAppWallet, mayCreateSpace, openWithoutApp, payerOf, SPACES_WITHOUT_APP } from "./app-wallet-gate";

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures++;
}

check("Spaces is view only without the app today", SPACES_WITHOUT_APP === "view");

for (const rel of ["/spaces", "/spaces/", "/spaces/listings", "/spaces/board", "/spaces/bought", "/spaces/team", "/spaces/team?seat=abc", "/spaces/x"]) {
  check(`open: ${rel}`, openWithoutApp(rel));
}
for (const rel of ["", "/", "/wallet", "/wallet/send", "/wallet/link", "/payments", "/travel", "/travel/stay/1/book", "/account", "/menu", "/spacesx", "/benefits"]) {
  check(`needs the app: ${rel || "(home)"}`, !openWithoutApp(rel));
}
check("closing Spaces closes /spaces/board too", !openWithoutApp("/spaces/board", "closed"));

// View only: making a space needs the app, even typed straight into the address bar.
for (const rel of ["/spaces/listings/new", "/spaces/listings/new/", "/spaces/listings/new?template=abc", "/spaces/listings/new?inspiredBy=x:someone#top"]) {
  check(`creates a space: ${rel}`, createsASpace(rel));
  check(`needs the app to create: ${rel}`, !openWithoutApp(rel));
}
for (const rel of ["/spaces/listings", "/spaces/listings/0f2a", "/spaces/listings/0f2a/edit", "/spaces/listings/newer", "/spaces/inspire", "/spaces/board"]) {
  check(`not a create: ${rel}`, !createsASpace(rel));
}
check("editing a draft stays open (view mode lets a person finish what exists)", openWithoutApp("/spaces/listings/0f2a/edit"));

// Who sees the "create a space" buttons.
check("app wallet may create", mayCreateSpace({ state: "app_wallet" }) === true);
check("no wallet may not", mayCreateSpace({ state: "none" }) === false);
check("a legacy web wallet may not", mayCreateSpace({ state: "web_wallet" }) === false);
check("an empty status may not", mayCreateSpace(null) === false && mayCreateSpace({}) === false);
check("still reading: undecided, so nothing flashes", mayCreateSpace(undefined) === undefined);
check("a failed first read may not", mayCreateSpace(undefined, true) === false);
// Publishing is creating: the wizard's Publish and the series' "publish the drafts" read the same answer.
check("publish is hidden without the app", mayCreateSpace({ state: "none" }) === false && mayCreateSpace({ state: "web_wallet" }) === false);
check("publish is shown with the app", mayCreateSpace({ state: "app_wallet" }) === true);
check("a failed refresh keeps what was read", mayCreateSpace({ state: "app_wallet" }, true) === true && mayCreateSpace({ state: "none" }, true) === false);

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
