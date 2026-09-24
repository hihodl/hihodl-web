import * as R from "./request-rules";
let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) { fails++; console.log("FAIL", name, ja, "!=", jb); } else console.log("ok  ", name);
}
const person = (id: string, username: string) => ({ id, username, displayName: null, avatarUrl: null, avatarEmoji: null });
const dto = (o: Record<string, unknown> = {}) => ({
  id: "r1", fromUserId: "asker", toUserId: "payer", amount: "12.50", tokenId: "USDC", chain: "Solana", note: "  pizza  ",
  status: "requested", createdAt: "2026-09-24T10:00:00.000Z", paidAt: null, transferId: null, withdrawalId: null, lastRemindedAt: null,
  requester: person("asker", "demo_asker"), payer: person("payer", "demo_payer"), ...o,
});

// reading the wire
const r = R.toRequest(dto())!;
eq("lowercases token and chain", [r.tokenId, r.chain], ["usdc", "solana"]);
eq("note trimmed", r.note, "pizza");
eq("empty note is null", R.toRequest(dto({ note: "   " }))!.note, null);
eq("pending reads as requested", R.toRequest(dto({ status: "pending" }))!.status, "requested");
eq("declined kept", R.toRequest(dto({ status: "declined" }))!.status, "declined");
eq("unknown status dropped", R.toRequest(dto({ status: "weird" })), null);
eq("no id dropped", R.toRequest(dto({ id: "" })), null);
eq("bare array", R.toRequests([dto(), dto({ id: "r2" })]).map((x) => x.id), ["r1", "r2"]);
eq("old envelope", R.toRequests({ requests: [dto()], total: 1 }).map((x) => x.id), ["r1"]);
eq("junk body", R.toRequests({ nope: true }), []);
eq("requester person", r.requester?.username, "demo_asker");

// threads
const rows = [
  R.toRequest(dto({ id: "b", createdAt: "2026-09-24T12:00:00.000Z", status: "paid" }))!,
  R.toRequest(dto({ id: "a", createdAt: "2026-09-24T09:00:00.000Z" }))!,
  R.toRequest(dto({ id: "c", fromUserId: "someone", toUserId: "payer" }))!,
];
eq("requestsWith keeps closed, oldest first", R.requestsWith(rows, "asker").map((x) => x.id), ["a", "b"]);
eq("requestsWith no peer", R.requestsWith(rows, null), []);
eq("theyAsked", [R.theyAsked(r, "asker"), R.theyAsked(r, "payer")], [true, false]);
eq("tags", (["requested", "paid", "declined", "cancelled"] as const).map(R.requestTag), ["Requested", "Paid", "Declined", "Cancelled"]);
eq("amount", [R.requestAmount({ amount: "12,5" }), R.requestAmount({ amount: "0" }), R.requestAmount({ amount: "x" })], [12.5, null, null]);

// what the web can pay
eq("usdc on solana", R.webCanPay({ tokenId: "usdc", chain: "solana" }), { token: "USDC" });
eq("usdc.circle", R.webCanPay({ tokenId: "usdc.circle", chain: "solana" }), { token: "USDC" });
eq("sol", R.webCanPay({ tokenId: "sol", chain: "solana" }), { token: "SOL" });
eq("usdc on base goes to the app", R.webCanPay({ tokenId: "usdc", chain: "base" }), { app: "Base" });
eq("usdt on solana goes to the app", R.webCanPay({ tokenId: "usdt", chain: "solana" }), { app: "Solana" });

// errors
eq("to self", R.describeRequestError({ status: 422, code: "VALIDATION_ERROR", detail: "request_to_self" }), "You can't ask yourself for money.");
eq("code as name", R.describeRequestError({ status: 429, code: "too_many_open_requests" }), "You already have 3 open requests with them. Wait for one to be paid, or cancel one.");
eq("404", R.describeRequestError({ status: 404, code: "NOT_FOUND" }), "No one on HOLD goes by that name.");
const now = new Date(2026, 8, 24, 10, 0);
const later = new Date(2026, 8, 24, 15, 30);
const tomorrow = new Date(2026, 8, 25, 9, 5);
const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
eq("retry today", R.remindAgainText(later.toISOString(), now), `You already reminded them. You can remind them again at ${t(later)}.`);
eq("retry tomorrow", R.remindAgainText(tomorrow.toISOString(), now), `You already reminded them. You can remind them again tomorrow at ${t(tomorrow)}.`);
eq("retry unknown", R.remindAgainText(null, now), "You already reminded them today. You can remind them again tomorrow.");
eq(
  "remind_too_soon uses retryAt",
  R.describeRequestError({ status: 429, code: "RATE_LIMITED", detail: "remind_too_soon", details: { retryAt: later.toISOString() } }).includes(t(later)),
  true,
);

// the inbox
const peers = R.requestPeers(rows, "payer");
eq("one row per peer", peers.map((p) => p.peerId).sort(), ["asker", "someone"]);
eq("newest line, reader's voice", peers.find((p) => p.peerId === "asker")!.lastBody, "Asked you for 12.50 USDC");
eq("the asker's side", R.requestPeers(rows, "asker").map((p) => [p.peerId, p.lastBody, p.aliasHandle]), [["payer", "Requested 12.50 USDC", "demo_payer"]]);
eq("no me, no rows", R.requestPeers(rows, null), []);

if (fails) { console.log(`${fails} failed`); process.exit(1); } else console.log("all passed");
