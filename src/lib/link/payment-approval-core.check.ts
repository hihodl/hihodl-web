/**
 * Proof for reading a payment approval and the words it ends in (no test runner here):
 *
 *   npx sucrase-node src/lib/link/payment-approval-core.check.ts
 *
 * Exits 1 on the first failure.
 */

import { describeApprovalRefusal, endedWithoutPaying, isDecided, toApproval } from "./payment-approval-core";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

// The contract's shape, approved, for a stay.
const approved = toApproval({
  id: "a1",
  kind: "stay",
  ref: { bookingId: "b1" },
  summary: { title: "Hotel Arts", subtitle: "Deluxe, 2026-10-01 to 2026-10-03", amount: "105.25", token: "USDC", chain: "solana", spend: "105.9" },
  from: "Sol1",
  status: "approved",
  messageHash: "ab",
  createdAt: "2026-09-23T10:00:00.000Z",
  expiresAt: "2026-09-23T10:10:00.000Z",
  decidedAt: "2026-09-23T10:01:00.000Z",
  signedTx: "AQID",
  continuation: { kind: "stay", bookingId: "b1", intentId: "i1", quote: { id: "q" }, deposit: "105.900000", idempotencyKey: "stay:b1", relayerPublicKey: "R", lastValidBlockHeight: 9 },
});
check("stay approval reads", approved.kind === "stay" && approved.status === "approved" && approved.signedTx === "AQID");
check("stay continuation kept", approved.continuation?.kind === "stay" && Number(approved.continuation.kind === "stay" ? approved.continuation.deposit : 0) === 105.9);
check("spend kept as text", approved.summary.spend === "105.9");

// Pending, nothing to submit yet, and fields the server may leave out.
const pending = toApproval({ id: "a2", kind: "spot", status: "pending", summary: { title: "A spot", amount: 50 }, signedTx: null, continuation: null });
check("pending is not decided", !isDecided(pending.status));
check("amount number becomes text", pending.summary.amount === "50");
check("missing spend is null", pending.summary.spend === null);
check("no continuation before approval", pending.continuation === null && pending.signedTx === null);
check("unknown status reads as pending, never as approved", toApproval({ id: "x", status: "weird" }).status === "pending");
check("junk continuation dropped", toApproval({ id: "x", status: "approved", continuation: { kind: "evil" } }).continuation === null);

for (const s of ["approved", "rejected", "expired", "cancelled", "submitted"] as const) check(`${s} is decided`, isDecided(s));

for (const s of ["rejected", "expired", "cancelled"] as const) {
  check(`${s} says nothing was charged`, endedWithoutPaying(s).includes("Nothing has been charged"));
}

// Every code the contract names reads as a sentence, and none leaks the code itself.
const codes = [
  "VALIDATION_ERROR",
  "NO_PHONE_LINKED",
  "NO_WALLET",
  "NOT_FOUND",
  "ALREADY_PAID",
  "NOT_PAYABLE",
  "NOT_YOUR_WALLET",
  "NO_PAYMENT_OPEN",
  "NOT_PENDING",
  "NOT_BUILT",
  "BUILD_EXPIRED",
  "APPROVAL_EXPIRED",
  "NOT_THE_ISSUED_TRANSACTION",
  "NOT_SIGNED_BY_WALLET",
  "DEVICE_SIGNATURE_INVALID",
  "HOLD_EXPIRED",
  "SPACE_CLOSED",
  "CHAIN_UNAVAILABLE",
  "RELAYER_NOT_CONFIGURED",
  "NO_ROUTE",
  "ROUTE_TOO_EXPENSIVE",
  "something_new",
];
for (const kind of ["spot", "stay"] as const) {
  for (const c of codes) {
    const said = describeApprovalRefusal(c, kind);
    check(`${kind} ${c}`, said.length > 10 && !said.includes(c) && !said.includes("_"), said);
  }
}

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log("all good");
