/**
 * Paying for a stay, from a browser — the app's `payForBooking.ts` and
 * `bookingCompletion.ts`, joined.
 *
 * THE SEQUENCE, AND WHY IT IS IN THIS ORDER
 *
 *   1. hold     POST /travel/prebook          the room, at a locked rate
 *   2. open     POST /travel/bookings/:id/pay what is owed, and where it goes
 *   3. quote    POST /cross-chain/quote       priced BEFORE anything is signed
 *   4. sign     the passkey, then the deposit
 *   5. send     POST /cross-chain/gasless/submit
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
 */

"use client";

import { openWallet } from "@/lib/wallet/flows";
import { getWalletBackup } from "@/lib/wallet/api";
import { evaluatePrf } from "@/lib/wallet/passkey";
import { wipe } from "@/lib/wallet/core";
import { signSerializedTx } from "@/lib/wallet/sign-tx";

import { BridgeRefused, prepareGasless, quoteCovering, submitGasless } from "./bridge";
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

export type Phase = "idle" | "holding" | "opening" | "paying" | "settling" | "booking" | "booked" | "stopped";

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
}

const IDLE: PayState = { phase: "idle", bookingId: null, booking: null, paid: false, message: null, repriced: null };

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
  /** The wallet's Solana address, already unlocked or about to be. */
  from: string;
  /** Their USDC balance on Solana, so a leg that cannot be funded is refused early. */
  available: number;
  /** The signed-in person's id, for the passkey ceremony. */
  uid: string;
  /** Where the room is held, when it already is. */
  bookingId?: string | null;
  onState: (next: PayState) => void;
}

/**
 * Hold, pay, and buy the room.
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

  set({ phase: "paying" });
  let priced: Awaited<ReturnType<typeof quoteCovering>>;
  try {
    priced = await quoteCovering({
      sourceChain: "solana",
      destChain: intent.target.chain as "base",
      tokenSymbol: "USDC",
      sourceAddress: args.from,
      destAddress: intent.target.address,
      arrival: owed,
      available: args.available,
    });
  } catch (e) {
    return set({
      phase: "stopped",
      message: e instanceof BridgeRefused ? `${e.message} Nothing has been charged.` : "We couldn't price the transfer. Nothing has been charged.",
    });
  }

  /* 4 ── the passkey, then the deposit */
  let signed: string;
  let prf: Uint8Array | null = null;
  let seed: Uint8Array | null = null;
  try {
    const rebuilt = await prepareGasless(priced.quote);
    const backup = await getWalletBackup();
    if (backup.wrappings.length === 0) throw new Error("no_passkey");
    // `evaluatePrf` and not `assertWithPrf`: the latter carries a challenge the
    // SERVER issued, and there is no server-side approval for a bridge deposit
    // to carry. What authorises this money is the Solana signature over the
    // transaction, which needs the seed, which needs this passkey. The
    // ceremony is the gate.
    const bound = await evaluatePrf(backup.wrappings.map((w) => w.credential_id));
    prf = bound.prf;
    const key = await openWallet({ uid: args.uid, backup, credentialId: bound.credentialId, prf });
    seed = key.seed;
    signed = await signSerializedTx(rebuilt.serializedTx, seed, args.from);
  } catch {
    return set({ phase: "stopped", message: "We couldn't approve the payment. Nothing has been charged." });
  } finally {
    wipe(prf, seed);
  }

  /* 5 ── send it. PAST THIS LINE NOTHING THROWS AND NOTHING RE-SENDS. */
  let deposit: string | null = null;
  try {
    const out = await submitGasless({ quote: priced.quote, signedTx: signed, idempotencyKey: `stay:${bookingId}` });
    deposit = out.depositTxHash ?? null;
  } catch (e) {
    // A 409 here means the same key is already in flight — the money may well
    // be going. We do NOT say "nothing has been charged", and we do not resend.
    if (status(e) === 409) {
      sent.set(bookingId, "in_flight");
      set({ paid: true });
      return finish(bookingId, set);
    }
    return set({ phase: "stopped", message: "We couldn't send the payment. Nothing has been charged — try again." });
  }
  sent.set(bookingId, deposit ?? "in_flight");
  set({ paid: true });

  /* 6 ── name the leg, so the arrival scan knows what to look for */
  if (deposit) {
    await reportLeg(intent.id, { kind: "bridge", chain: "solana", txHash: deposit, amount: priced.deposit }).catch(
      // A leg we fail to report still lands; the scan finds it by amount
      // instead. This is a hint, not a record.
      () => undefined,
    );
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

function holdRefusal(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : null;
  if (status(e) === 409 || code === "CONFLICT") {
    return "That room has just been taken. Nothing has been charged — try another rate.";
  }
  return "We couldn't hold that room. Nothing has been charged — try again.";
}
