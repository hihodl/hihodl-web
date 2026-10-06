/**
 * npx sucrase-node src/lib/ad-space/bank-rules.check.ts
 */

import { bankErrorKey, bankRequestErrorKey, bankShown, bankStage, canCancel, guestWeekUntil, usdExact } from "./bank-rules";
import type { BankOption } from "./types";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const open: BankOption = {
  bank: { currency: "USD", rails: ["wire", "ach_push"], holdDays: 7, minUsdCents: 25_000, amount: "1050.00" },
  reason: null,
};
const refused = (reason: string): BankOption => ({ bank: null, reason });

/* Where the transfer is */
eq("awaiting funds waits", bankStage("awaiting_funds"), "waiting");
eq("funds received is received", bankStage("funds_received"), "received");
eq("in review is received", bankStage("in_review"), "received");
eq("payment submitted is received", bankStage("payment_submitted"), "received");
eq("processed is paid", bankStage("payment_processed"), "paid");
eq("returned is gone", bankStage("returned"), "gone");
eq("canceled is gone", bankStage("canceled"), "gone");
eq("refunded is gone", bankStage("refunded"), "gone");
eq("undeliverable is stuck", bankStage("undeliverable"), "stuck");
eq("refund failed is stuck", bankStage("refund_failed"), "stuck");
eq("no state yet waits", bankStage(null), "waiting");
eq("short paid is short", bankStage("short_paid"), "short");
eq("stuck is stuck", bankStage("stuck"), "stuck");
eq("a Bridge error is stuck", bankStage("error"), "stuck");
eq("an unknown state is stuck, never waiting", bankStage("something_new"), "stuck");
eq("no cancel once short paid", canCancel("short_paid"), false);
eq("no cancel while stuck", canCancel("something_new"), false);

/* A guest's hold */
eq("a guest's day becomes a week from when it was written", guestWeekUntil("2026-10-07T12:00:00.000Z", "2026-11-30T00:00:00.000Z"), "2026-10-13T12:00:00.000Z");
eq("never past the close", guestWeekUntil("2026-10-07T12:00:00.000Z", "2026-10-10T00:00:00.000Z"), "2026-10-10T00:00:00.000Z");
eq("no close known, still a week", guestWeekUntil("2026-10-07T12:00:00.000Z", null), "2026-10-13T12:00:00.000Z");
eq("already a week, nothing to add", guestWeekUntil("2026-10-13T12:00:00.000Z", "2026-10-13T12:00:00.000Z"), null);
eq("no hold, no line", guestWeekUntil(null, "2026-11-30T00:00:00.000Z"), null);
eq("cancel while waiting", canCancel("awaiting_funds"), true);
eq("no cancel once money arrived", canCancel("funds_received"), false);
eq("no cancel once paid", canCancel("payment_processed"), false);

/* The door */
eq("no answer, no door", bankShown(null, null), false);
eq("listed spot, offered", bankShown(open, null), true);
eq("listed spot, below minimum", bankShown(refused("bank_below_minimum"), null), false);
eq("listed spot, too close to closing", bankShown(refused("bank_too_close_to_closing"), null), false);
eq("offer on a reserved spot, agreed above minimum", bankShown(refused("position_reserved"), { priceUsd: "1000.00", bid: false }), true);
eq("offer-only spot, agreed above minimum", bankShown(refused("offer_required"), { priceUsd: "250.00", bid: false }), true);
eq("offer agreed below minimum", bankShown(refused("position_reserved"), { priceUsd: "249.99", bid: false }), false);
eq("listed price below minimum, offer above", bankShown(refused("bank_below_minimum"), { priceUsd: "500", bid: false }), true);
eq("an accepted bid never pays by bank", bankShown(open, { priceUsd: "5000", bid: true }), false);
eq("seller not verified shuts an offer too", bankShown(refused("seller_not_verified"), { priceUsd: "5000", bid: false }), false);
eq("takeover shuts an offer too", bankShown(refused("bank_not_for_takeover"), { priceUsd: "5000", bid: false }), false);
eq("no agreed price, no door", bankShown(open, { priceUsd: null, bid: false }), false);

/* Words */
eq("amount to the cent", usdExact("1050"), "$1,050.00");
eq("not an amount", usdExact("x"), null);
eq("minimum code", bankErrorKey("bank_below_minimum"), "sponsor.checkout.bank.error.belowMinimum");
eq("caps code", bankErrorKey("bank_hold_limit"), "sponsor.checkout.bank.error.holdLimit");
eq("close window code", bankErrorKey("bank_too_close_to_closing"), "sponsor.checkout.bank.error.tooCloseToClosing");
eq("vault is not for this", bankErrorKey("seller_vault"), "sponsor.checkout.bank.error.notForThis");
eq("not a bank code", bankErrorKey("position_sold"), null);
eq("short paid cancel code", bankErrorKey("bank_short_paid"), "sponsor.checkout.bank.error.shortPaid");
eq("guest daily cap", bankRequestErrorKey("rate_limited", 429), "sponsor.checkout.bank.error.dailyCap");
eq("limiter down keeps the checkout's words", bankRequestErrorKey("rate_limited", 503), null);
eq("request codes fall through to bank codes", bankRequestErrorKey("bank_hold_limit", 429), "sponsor.checkout.bank.error.holdLimit");

if (fails) {
  console.log(`\n${fails} failing`);
  process.exit(1);
}
console.log("\nall ok");
