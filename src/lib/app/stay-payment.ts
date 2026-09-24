/**
 * Paying for a stay, from a browser — the app's `payForBooking.ts` and
 * `bookingCompletion.ts`, joined.
 *
 * THE SEQUENCE, AND WHY IT IS IN THIS ORDER
 *
 *   1. hold     POST /travel/prebook          the room, at a locked rate
 *   2. open     POST /travel/bookings/:id/pay what is owed, and where it goes
 *   3. ask      POST /payment-approvals { kind: "stay", ref: { bookingId } }:
 *               the linked phone. When the person taps Approve there, the
 *               SERVER quotes and builds the deposit (priced BEFORE anything
 *               is signed) and the phone signs it
 *   4. (the phone)
 *   5. send     POST /cross-chain/gasless/submit, with the server's own
 *               quote and key
 *   6. report   POST /settlement/intent/:id/leg
 *   7. settle   GET  /travel/bookings/:id/payment, until funded
 *   8. book     POST /travel/book
 *
 * Step 3 is where it is on purpose. Quoting only asks for prices, so its
 * refusal is free and reversible — and it used to happen after the money moved.
 * On booking ab14a4a3 (27-Aug-2026) that ordering turned a clean "we cannot
 * route this" into 7.87 USDC sitting at the collection address, a room that was
 * never bought, and a screen that said "Nothing has been charged."
 *
 * Step 6 is not optional and not proof of anything — the chain is the proof.
 * It is what tells the arrival scan which sender to expect, and what makes a
 * slow bridge readable as a named step instead of a total that never fills.
 * The bridge's own `parentIntentId` will not do it: that field is resolved
 * against `payment_intents`, and a settlement intent is a different table, so
 * a settlement id passed there is recorded unlinked (verified in
 * `cross-chain.router.ts`, `recordBridgeDeposit`).
 *
 * ── THE LINE ──
 *
 * `paid` on the state is the line. Before it, nothing has left and saying so
 * is honest. After it, this NEVER throws and never re-sends: a retry past that
 * point is how somebody pays twice. A failure after the deposit comes back as
 * a phase, and the caller's job is to wait, not to resend.
 *
 * Which is also why the intent and the sent leg are held at MODULE level and
 * not in a component: a screen that unmounts must not be able to open a second
 * intent or re-send a leg that already landed.
 *
 * ── THE PHONE APPROVES, ALWAYS ──
 *
 * The web does not pay by itself any more (Alex, 2026-09-24): no passkey and
 * no key is opened here. The build lives about 30 seconds, so the submit
 * starts the moment the poll sees `approved`. With no phone linked
 * (409 NO_PHONE_LINKED or LINK_YOUR_PHONE_FIRST) the run stops on
 * `linkFirst`, and the screen opens the link sheet.
 * documentation/one-wallet-every-device.md, "Payments built by the server,
 * approved on the phone".
 */

"use client";

import {
  describeApprovalRefusal,
  endedWithoutPaying,
  requestPaymentApproval,
  waitForPhone,
  type PaymentApproval,
} from "@/lib/link/payment-approvals";

import { submitGasless, type BridgeQuote } from "./bridge";
import { bookIt, openPayment, prebook, readPayment, reportLeg, type Booking, type PrebookQuery, type SettlementIntent } from "./stays";

/* ── How long we wait, and how often ──────────────────────────────── */

/** The app's `bookingCompletion.ts`, unchanged. */
const SETTLE_TIMEOUT_MS = 5 * 60_000;
const SETTLE_POLL_MS = 3_000;
const BOOK_TRIES = 4;
const BOOK_RETRY_MS = 2_500;

/**
 * How far the price may move between the rate shown and the rate held before
 * we stop and ask again. Half a cent — below that it is rounding.
 */
const PRICE_EPSILON = 0.005;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── What the screen watches ──────────────────────────────────────── */

/** `phone`: the linked phone is asked; `approval` is what it is deciding. */
export type Phase = "idle" | "holding" | "opening" | "phone" | "paying" | "settling" | "booking" | "booked" | "stopped";

export interface PayState {
  phase: Phase;
  /** The room is held. Present from the hold onwards, whatever happens next. */
  bookingId: string | null;
  booking: Booking | null;
  /** True once money is broadcast. From here, leaving the page is free. */
  paid: boolean;
  /**
   * What to tell the person. Written only on paths where it is TRUE that
   * nothing is owed, or where waiting is genuinely the right thing to do.
   */
  message: string | null;
  /** The rate moved under us. The hold is still good; ask again at the new price. */
  repriced: { was: number; now: number; currency: string } | null;
  /** While `phone`: the approval the linked phone is deciding. */
  approval: PaymentApproval | null;
  /** Stopped because no phone is linked: the screen opens the link sheet. */
  linkFirst?: boolean;
}

const IDLE: PayState = { phase: "idle", bookingId: null, booking: null, paid: false, message: null, repriced: null, approval: null, linkFirst: false };

/* ── State that must outlive the screen ───────────────────────────── */

/** One intent per booking. A retry must never open a second. */
const intents = new Map<string, SettlementIntent>();
/** One deposit per booking. A retry must never re-send a leg that landed. */
const sent = new Map<string, string>();

export function forgetPayment(bookingId?: string) {
  if (bookingId) {
    intents.delete(bookingId);
    sent.delete(bookingId);
    return;
  }
  intents.clear();
  sent.clear();
}

/* ── The run ──────────────────────────────────────────────────────── */

export interface PayArgs {
  /** Skipped entirely when the room is already held — a retry never re-holds. */
  hold: PrebookQuery;
  /** The price the person agreed to, in the booking's currency. */
  quotedPrice: number;
  /** Where the room is held, when it already is. */
  bookingId?: string | null;
  /** Stops following the phone (the page went away). Nothing is sent after it. */
  signal?: AbortSignal;
  onState: (next: PayState) => void;
}

/**
 * Hold, open the payment, ask the phone, send what it signed, buy the room.
 *
 * Resolves with the final state — it does not reject. Every refusal is a
 * `PayState` the screen can render, because a thrown error at any point past
 * step 4 would be an error about money that has already moved.
 */
export async function payForStay(args: PayArgs): Promise<PayState> {
  let state: PayState = { ...IDLE };
  const set = (next: Partial<PayState>) => {
    state = { ...state, ...next };
    args.onState(state);
    return state;
  };

  /* 1 ── hold the room */
  let bookingId = args.bookingId ?? null;
  if (!bookingId) {
    set({ phase: "holding" });
    try {
      const held = await prebook(args.hold);
      bookingId = held.bookingId;
      set({ bookingId });

      // The rate moved between the page and the hold. The hold is GOOD — it is
      // the new price — so we keep it and stop, rather than charging a number
      // the person never saw.
      if (Math.abs(held.price - args.quotedPrice) > PRICE_EPSILON) {
        return set({
          phase: "stopped",
          repriced: { was: args.quotedPrice, now: held.price, currency: held.currency },
          message: "The price changed while you were on this page. Nothing has been charged.",
        });
      }
    } catch (e) {
      return set({ phase: "stopped", message: holdRefusal(e) });
    }
  }

  /* 2 ── open the payment */
  set({ phase: "opening" });
  let intent = intents.get(bookingId) ?? null;
  if (!intent || intent.status === "expired" || intent.status === "failed") {
    // An intent that expired is reopened, and its leg forgotten with it: the
    // old deposit belongs to an intent nobody is funding any more.
    if (intent) sent.delete(bookingId);
    try {
      const answer = await openPayment(bookingId, []);
      if ("alreadyBooked" in answer && answer.alreadyBooked) {
        // The app polls this after a dropped response. A booking that is
        // already made needs a route back to itself, not a second charge.
        return set({ phase: "booked", booking: answer.booking, paid: true, message: null });
      }
      intent = (answer as { intent: SettlementIntent }).intent;
      intents.set(bookingId, intent);
    } catch (e) {
      return set({
        phase: "stopped",
        message:
          status(e) === 503
            ? "We can't take payment for this stay right now. Your room is still held — try again in a moment."
            : "We couldn't open the payment. Your room is still held — try again in a moment.",
      });
    }
  }

  /* 3 ── what is still owed, and can we route it */
  const owed = Math.max(0, Number(intent.amount) - Number(intent.received));
  if (intent.status === "funded" || owed <= 0) {
    // Already covered before we started — go straight to buying the room.
    return finish(bookingId, set);
  }

  const already = sent.get(bookingId);
  if (already) {
    // A leg is out. Never send a second; wait for the first.
    set({ paid: true });
    return finish(bookingId, set);
  }

  // The settlement chain is Base and the constant says so ("one stablecoin,
  // one chain, every product"). If it ever moves to Solana this whole path is
  // the wrong one — a bridge asked for a same-chain route is refused by the
  // backend with `same_pair` — so say that plainly rather than let the person
  // read a routing error about a transfer that never needed routing.
  if (intent.target.chain === "solana") {
    return set({
      phase: "stopped",
      message: "This payment needs the HOLD app. Nothing has been charged.",
    });
  }

  /* 3–6 ── the phone approves; the server prices and builds, the phone signs */
  const onPhone = await payOnPhone(bookingId, set, args.signal);
  return onPhone === "no_phone" ? set({ phase: "stopped", message: NO_PHONE_ANY_MORE, linkFirst: true }) : onPhone;
}

/* ── The phone ────────────────────────────────────────────────────── */

export const NO_PHONE_ANY_MORE = "Link your phone to pay from here. Nothing has been charged. Your room is still held.";

/**
 * Ask the linked phone, wait, and send what it signed: steps 3 to 6 when the
 * phone approves. "no_phone" is the server saying no phone is linked
 * (409 NO_PHONE_LINKED or LINK_YOUR_PHONE_FIRST).
 *
 * The deposit the phone signed was built by the server from its own quote,
 * which lives about 30 seconds, so the submit starts the moment `approved` is
 * seen. Before that submit nothing has left the wallet, and every stop says so.
 */
async function payOnPhone(
  bookingId: string,
  set: (n: Partial<PayState>) => PayState,
  signal?: AbortSignal,
): Promise<PayState | "no_phone"> {
  let approval: PaymentApproval;
  try {
    approval = await requestPaymentApproval({ kind: "stay", bookingId });
  } catch (e) {
    const code = codeOf(e);
    if (code === "NO_PHONE_LINKED" || code === "LINK_YOUR_PHONE_FIRST") return "no_phone";
    // Booked, or nothing owed: the room is bought (or about to be), not paid twice.
    if (code === "ALREADY_PAID") return finish(bookingId, set);
    return set({ phase: "stopped", message: `${describeApprovalRefusal(code, "stay")} Your room is still held.` });
  }
  set({ phase: "phone", approval, message: null });

  const end = await waitForPhone(approval, {
    signal,
    onUpdate: (a) => {
      if (a.status === "pending") set({ approval: a });
    },
  });
  if (!end) {
    return set({ phase: "stopped", approval: null, message: "We stopped waiting for your phone. Nothing has been charged. Your room is still held." });
  }

  switch (end.status) {
    case "rejected":
    case "expired":
    case "cancelled":
      return set({ phase: "stopped", approval: null, message: `${endedWithoutPaying(end.status)} Your room is still held.` });
    case "submitted":
      // Sent already (another tab, most likely). Never a second time: wait for it.
      sent.set(bookingId, sent.get(bookingId) ?? "in_flight");
      return finish(bookingId, set);
    case "approved":
      break;
    default:
      return set({ phase: "stopped", approval: null, message: "We stopped waiting for your phone. Nothing has been charged. Your room is still held." });
  }

  const c = end.continuation;
  if (!end.signedTx || !c || c.kind !== "stay" || !c.quote) {
    return set({
      phase: "stopped",
      approval: null,
      message: "Your phone approved it, but we couldn't read what it signed. Nothing has been charged. Try again.",
    });
  }
  if (sent.get(bookingId)) {
    // A leg is out. Never send a second; wait for the first.
    return finish(bookingId, set);
  }

  /* 5 ── send it, NOW. PAST THIS LINE NOTHING THROWS AND NOTHING RE-SENDS. */
  set({ phase: "paying", approval: null, message: null });
  let deposit: string | null = null;
  try {
    const out = await submitGasless({ quote: c.quote as BridgeQuote, signedTx: end.signedTx, idempotencyKey: c.idempotencyKey });
    deposit = out.depositTxHash ?? null;
  } catch (e) {
    if (status(e) === 409) {
      sent.set(bookingId, "in_flight");
      set({ paid: true });
      return finish(bookingId, set);
    }
    return set({ phase: "stopped", message: "We couldn't send the payment. Nothing has been charged. Try again." });
  }
  sent.set(bookingId, deposit ?? "in_flight");
  set({ paid: true });

  /* 6 ── name the leg, with what the server built */
  if (deposit) {
    await reportLeg(c.intentId, { kind: "bridge", chain: "solana", txHash: deposit, amount: Number(c.deposit) }).catch(() => undefined);
  }
  return finish(bookingId, set);
}

/**
 * Wait for the chain, then buy the room.
 *
 * Split out because three paths reach it: a fresh deposit, a retry that finds
 * a leg already sent, and an intent that was funded before we started.
 */
async function finish(bookingId: string, set: (n: Partial<PayState>) => PayState): Promise<PayState> {
  set({ phase: "settling", paid: true, message: null });

  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let funded = false;
  while (Date.now() < deadline) {
    // Sleep first: the money cannot possibly have landed in the same tick it
    // was broadcast, and the first poll is what costs the most.
    await sleep(SETTLE_POLL_MS);
    try {
      const { intent } = await readPayment(bookingId);
      intents.set(bookingId, intent);
      if (intent.status === "funded") {
        funded = true;
        break;
      }
      if (intent.status === "expired" || intent.status === "failed") {
        return set({
          phase: "stopped",
          message: "Your payment didn't complete. We're on it — your money is safe and support can see this booking.",
        });
      }
    } catch {
      // A failed poll is a failed poll. The chain has not changed its mind.
    }
  }

  if (!funded) {
    return set({
      phase: "stopped",
      message: "Your payment is taking longer than usual. Leave this page — we'll finish the booking and email you.",
    });
  }

  /* 8 ── buy the room */
  set({ phase: "booking" });
  for (let i = 0; i < BOOK_TRIES; i++) {
    try {
      const booking = await bookIt(bookingId);
      // The room is bought. Nothing about this booking can be retried, so the
      // guards that existed to stop a second payment have nothing left to guard.
      forgetPayment(bookingId);
      return set({ phase: "booked", booking, message: null });
    } catch {
      // A 402 means the server has not finished seeing the money. That is not
      // a failure, it is a wait, and it is retried like any other.
      if (i < BOOK_TRIES - 1) await sleep(BOOK_RETRY_MS);
    }
  }

  return set({
    phase: "stopped",
    message: "We have your payment but couldn't confirm the room just yet. We'll finish it and email you the confirmation.",
  });
}

/* ── Reading a failure ────────────────────────────────────────────── */

function status(e: unknown): number | null {
  return typeof e === "object" && e !== null && "status" in e ? ((e as { status?: number }).status ?? null) : null;
}

function codeOf(e: unknown): string {
  const c = typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : null;
  return typeof c === "string" ? c : "";
}

function holdRefusal(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : null;
  if (status(e) === 409 || code === "CONFLICT") {
    return "That room has just been taken. Nothing has been charged — try another rate.";
  }
  return "We couldn't hold that room. Nothing has been charged — try again.";
}
