/**
 * Proof for the HOLD Connect popup's handshake rules (no test runner here):
 *
 *   npx sucrase-node src/lib/connect/handshake.check.ts
 *
 * Exits 1 on any failure.
 */

import { cleanAppName, dappOrigin, decodeKept, encodeKept, errorFor, hostOf, isLocalOrigin, readHello, toConnectRequest } from "./handshake";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

// The origin: https, or http on the developer's own machine, as the browser says it, lowercased.
check("https origin", dappOrigin("https://sp3nd.shop") === "https://sp3nd.shop");
check("https with port", dappOrigin("https://a.b.c:8443") === "https://a.b.c:8443");
check("uppercase lowered", dappOrigin("https://SP3ND.shop") === "https://sp3nd.shop");
check("http refused", dappOrigin("http://sp3nd.shop") === null);
check("opaque null refused", dappOrigin("null") === null);
check("path refused", dappOrigin("https://sp3nd.shop/x") === null);
check("userinfo refused", dappOrigin("https://a@b.com") === null);
// Local development: accepted everywhere, production included (the backend's HOLD_CONNECT_DEV_ORIGINS decides).
check("http://localhost:<port> accepted", dappOrigin("http://localhost:3000") === "http://localhost:3000");
check("http://127.0.0.1:<port> accepted", dappOrigin("http://127.0.0.1:5173") === "http://127.0.0.1:5173");
check("http://localhost without port accepted", dappOrigin("http://localhost") === "http://localhost");
check("http://LOCALHOST lowered", dappOrigin("http://LOCALHOST:3000") === "http://localhost:3000");
check("localhost look-alike refused", dappOrigin("http://localhost.evil.com") === null);
check("localhost as a subdomain refused", dappOrigin("http://evil.localhost:3000") === null);
check("other loopback refused", dappOrigin("http://127.0.0.2:3000") === null);
check("private network http refused", dappOrigin("http://192.168.1.10:3000") === null);
check("http 0.0.0.0 refused", dappOrigin("http://0.0.0.0:3000") === null);
check("ipv6 loopback refused", dappOrigin("http://[::1]:3000") === null);
check("other http refused", dappOrigin("http://evil.com") === null);
check("not a string", dappOrigin(undefined) === null);
check("local origin gets the note", isLocalOrigin("http://localhost:3000") && isLocalOrigin("http://127.0.0.1:8080"));
check("https localhost is not the local-http note", !isLocalOrigin("https://localhost:3000"));
check("a public site gets no note", !isLocalOrigin("https://sp3nd.shop"));
check("punycode host drawn as punycode", hostOf("https://xn--80ak6aa92e.com") === "xn--80ak6aa92e.com");
check("host keeps port", hostOf("https://a.com:8443") === "a.com:8443");

// The name: display only, cleaned.
check("name", cleanAppName("SP3ND") === "SP3ND");
check("name trimmed", cleanAppName("  SP3ND  ") === "SP3ND");
check("bidi override removed", cleanAppName("abc‮dcb") === "abcdcb");
check("empty is null", cleanAppName(" ​ ") === null);
check("long cut", (cleanAppName("x".repeat(100)) ?? "").length === 48);
check("non string", cleanAppName(42) === null);

// The hello.
check("hello", JSON.stringify(readHello({ type: "hold-connect:hello", appName: "SP3ND" })) === '{"appName":"SP3ND"}');
check("hello without name", JSON.stringify(readHello({ type: "hold-connect:hello" })) === '{"appName":null}');
check("other type ignored", readHello({ type: "hold-connect:connected" }) === null);
check("string ignored", readHello("hold-connect:hello") === null);

// The connect read.
const pending = toConnectRequest({ status: "pending", expiresAt: "2026-09-25T10:05:00Z" }, "r1");
check("pending", pending.status === "pending" && pending.id === "r1" && pending.account === null && pending.token === null);
const approved = toConnectRequest({ id: "r1", status: "approved", expiresAt: "x", account: { address: "Abc", publicKey: "Abc" }, token: "tok" });
check("approved carries account and token", approved.account?.address === "Abc" && approved.token === "tok");
check("unknown status reads pending", toConnectRequest({ status: "weird" }).status === "pending");
check("snake_case expiry", toConnectRequest({ expires_at: "e" }).expiresAt === "e");

// The site's errors.
check("rejected is 4001", errorFor("rejected").code === 4001);
check("cancelled is 4001", errorFor("cancelled").code === 4001);
check("expired is not 4001", errorFor("expired").code !== 4001);

// Kept across a sign-in trip.
const now = 1_000_000_000;
const kept = encodeKept({ origin: "https://sp3nd.shop", appName: "SP3ND", at: now });
check("kept round trip", decodeKept(kept, now + 1000)?.origin === "https://sp3nd.shop");
check("kept expires", decodeKept(kept, now + 16 * 60_000) === null);
check("kept http refused", decodeKept(encodeKept({ origin: "http://evil.com", appName: null, at: now }), now) === null);
check("kept localhost kept", decodeKept(encodeKept({ origin: "http://localhost:3000", appName: null, at: now }), now)?.origin === "http://localhost:3000");
check("kept garbage", decodeKept("{", now) === null);

if (failures) {
  console.log(`\n${failures} failing`);
  process.exit(1);
}
console.log("\nall ok");
