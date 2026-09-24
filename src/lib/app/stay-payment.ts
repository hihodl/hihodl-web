/**
 * Paying for a stay, from a browser — the app's `payForBooking.ts` and
 * `bookingCompletion.ts`, joined.
 *
 * THE SEQUENCE, AND WHY IT IS IN THIS ORDER
 *
 *   1. hold     POST /travel/prebook          the room, at a locked rate
 *   2. open     POST /travel/bookings/:id/pay what is owed, and where it goes
 *   3. quote    POST /cross-chain/quote       priced BEFORE anything is signed
 *   4. sign     the passkey: one ceremony that approves these exact bytes
 *               (POST /withdrawals/tx-challenge + /tx-authorize) and opens the
 *               wallet that signs them. On its OWN tap: `payForStay` stops at
 *               `approve` with everything read and the challenge checked
 *               against our digest, and `approveStay` starts the prompt as
 *               its first step. Safari refuses a passkey prompt that comes
 *               after several network calls, because the tap no longer counts
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
 *
 * ── WITH A LINKED PHONE ──
 *
 * When `canPayFromWeb` is `app`, steps 3 and 4 are not the web's. After the
 * payment is open, `POST /payment-approvals { kind: "stay", ref: { bookingId } }`
 * asks the phone; the SERVER quotes and builds the deposit when the person
 * taps Approve, the phone signs it, and this page submits it (5) with the
 * server's own quote and key, reports the leg (6) and carries on (7, 8). The
 * build lives about 30 seconds, so the submit starts the moment the poll sees
 * `approved`. A 409 APPROVE_ON_YOUR_PHONE from the passkey doors (a phone
 * linked meanwhile) switches to this path too.
 * documentation/one-wallet-every-device.md, "Payments built by the server,
 * approved on the phone".
 */

"use client";

import { openWallet } from "@/lib/wallet/flows";
import { getWalletBackup } from "@/lib/wallet/api";
import { assertWithPrf } from "@/lib/wallet/passkey";
import { wipe } from "@/lib/wallet/core";
import { messageOf, signSerializedTx } from "@/lib/wallet/sign-tx";
import { authorizeTxPasskey, txApprovalChallenge, type AssertionOptionsJSON } from "@/lib/link/api";
import { type WalletBackup } from "@/lib/wallet/api";
import { fromBase64 } from "@/lib/wallet/core";
import { sameBytes, txChallenge } from "@/lib/wallet/withdraw-core";
import { sha256 } from "@noble/hashes/sha256";

import {
  describeApprovalRefusal,
  endedWithoutPaying,
  requestPaymentApproval,
  waitForPhone,
  type PaymentApproval,
} from "@/lib/link/payment-approvals";
import { getWalletStatus, payerOf } from "@/lib/wallet/api";

import { t } from "@/lib/app/i18n";

import { BridgeRefused, prepareGasless, quoteCovering, submitGasless, type BridgeQuote } from "./bridge";
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

/**
 * `approve`: held, priced and built; the passkey is asked on the next tap (`approveStay`).
 * `phone`: the linked phone is asked; `approval` is what it is deciding.
 */
export type Phase = "idle" | "holding" | "opening" | "approve" | "phone" | "paying" | "settling" | "booking" | "booked" | "stopped";

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
}

const IDLE: PayState = { phase: "idle", bookingId: null, booking: null, paid: false, message: null, repriced: null, approval: null };

/* ── State that must outlive the screen ───────────────────────────── */

/** One intent per booking. A retry must never open a second. */
const intents = new Map<string, SettlementIntent>();
/** One deposit per booking. A retry must never re-send a leg that landed. */
const sent = new Map<string, string>();

/** The deposit, built and ready for the passkey: what `approveStay` signs. */
interface PreparedDeposit {
  intentId: string;
  priced: Awaited<ReturnType<typeof quoteCovering>>;
  serializedTx: string;
  backup: WalletBackup;
  /** base64 of the compiled message: what the approval is bound to. */
  message: string;
  options: AssertionOptionsJSON;
  preparedAt: number;
}
const ready = new Map<string, PreparedDeposit>();

/** A built deposit's blockhash lasts about a minute: past this it is built again rather than prompted for. */
const FRESH_MS = 60_000;

export function forgetPayment(bookingId?: string) {
  if (bookingId) {
    intents.delete(bookingId);
    sent.delete(bookingId);
    ready.delete(bookingId);
    return;
  }
  intents.clear();
  sent.clear();
  ready.clear();
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
  /** Who approves (canPayFromWeb): the passkey here, or the linked phone. */
  payer?: "web_passkey" | "app";
  /** Stops following the phone (the page went away). Nothing is sent after it. */
  signal?: AbortSignal;
  onState: (next: PayState) => void;
}

/**
 * Hold, open the payment, price it and build the deposit, ending on
 * `approve` (then `approveStay`, on its own tap) or on why not.
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
          message: t("stays.pay.repriced"),
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
            ? t("stays.pay.cantTakePayment")
            : t("stays.pay.cantOpen"),
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
      message: t("stays.pay.needsApp"),
    });
  }

  /* 3–4 with a linked phone: the server prices and builds, the phone signs */
  if (args.payer === "app") {
    const onPhone = await payOnPhone(bookingId, set, args.signal);
    if (onPhone !== "no_phone") return onPhone;
    // The phone was removed meanwhile: read who approves now, and fall back.
    const now = payerOf(await getWalletStatus().catch(() => null));
    if (now !== "web_passkey") return set({ phase: "stopped", message: noPhoneAnyMore() });
  }

  // Still "opening": pricing and building move nothing. "paying" starts with the passkey (approveStay).
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
      message: e instanceof BridgeRefused ? t("stays.pay.bridgeRefused", { reason: e.message }) : t("stays.pay.cantPrice"),
    });
  }

  /* 4a ── build the deposit and read what the passkey needs, BEFORE the tap that asks */
  try {
    const rebuilt = await prepareGasless(priced.quote);
    const backup = await getWalletBackup();
    if (backup.wrappings.length === 0) throw new Error("no_passkey");
    const message = await messageOf(rebuilt.serializedTx);
    const challenge = await txApprovalChallenge(message);
    // The passkey approves only what this page built: the server's challenge must be our own digest.
    const bytes = fromBase64(message);
    if (!sameBytes(fromBase64(challenge.options.challenge), txChallenge(bytes))) throw new Error("challenge_mismatch");
    if (challenge.messageHash && !sameDigest(challenge.messageHash, sha256(bytes))) throw new Error("challenge_mismatch");
    ready.set(bookingId, {
      intentId: intent.id,
      priced,
      serializedTx: rebuilt.serializedTx,
      backup,
      message,
      options: challenge.options,
      preparedAt: Date.now(),
    });
  } catch (e) {
    // A phone was linked meanwhile: it is the approver now, never the passkey.
    if (codeOf(e) === "APPROVE_ON_YOUR_PHONE") return phoneOrStop(bookingId, set, args.signal);
    return set({ phase: "stopped", message: t("stays.pay.cantPrepare") });
  }
  return set({ phase: "approve" });
}

/**
 * The passkey, then the deposit, then the room: `payForStay`'s second half.
 * Call it straight from the "Approve with passkey" click, with the state the
 * first half ended on. The prompt is the first thing it starts.
 */
export async function approveStay(args: {
  uid: string;
  from: string;
  current: PayState;
  onState: (next: PayState) => void;
  signal?: AbortSignal;
}): Promise<PayState> {
  let state: PayState = args.current;
  const set = (next: Partial<PayState>) => {
    state = { ...state, ...next };
    args.onState(state);
    return state;
  };
  const bookingId = state.bookingId;
  const p = bookingId ? ready.get(bookingId) : undefined;
  if (!bookingId || !p) return set({ phase: "stopped", message: t("stays.pay.notPrepared") });
  if (sent.get(bookingId)) {
    // A leg is out. Never send a second; wait for the first.
    ready.delete(bookingId);
    set({ paid: true });
    return finish(bookingId, set);
  }
  if (Date.now() - p.preparedAt > FRESH_MS) {
    ready.delete(bookingId);
    return set({ phase: "stopped", message: t("stays.pay.tooLate") });
  }

  /* 4b ── ONE CEREMONY, TWO THINGS
   *
   * `/withdrawals/tx-challenge` issued a challenge that IS this transaction's
   * digest, so the same Face ID that opens the wallet also signs the
   * assertion that lets these exact bytes through `/cross-chain/gasless/submit`.
   *
   * The approval is taken BEFORE the wallet is opened, so a refusal costs a
   * prompt and nothing else, and it is written down before anything is
   * signed.
   */
  let signed: string;
  let prf: Uint8Array | null = null;
  let seed: Uint8Array | null = null;
  try {
    const pending = assertWithPrf(
      p.options,
      p.backup.wrappings.map((w) => w.credential_id),
    );
    set({ phase: "paying", message: null });
    const bound = await pending;
    prf = bound.prf;
    await authorizeTxPasskey(p.message, bound.assertion);
    const key = await openWallet({ uid: args.uid, backup: p.backup, credentialId: bound.credentialId, prf });
    seed = key.seed;
    signed = await signSerializedTx(p.serializedTx, seed, args.from);
  } catch (e) {
    // A phone was linked between the two taps: it approves now, not the passkey.
    if (codeOf(e) === "APPROVE_ON_YOUR_PHONE") {
      ready.delete(bookingId);
      return phoneOrStop(bookingId, set, args.signal);
    }
    return set({ phase: "stopped", message: t("stays.pay.cantApprove") });
  } finally {
    wipe(prf, seed);
  }
  ready.delete(bookingId);

  /* 5 ── send it. PAST THIS LINE NOTHING THROWS AND NOTHING RE-SENDS. */
  let deposit: string | null = null;
  try {
    const out = await submitGasless({ quote: p.priced.quote, signedTx: signed, idempotencyKey: `stay:${bookingId}` });
    deposit = out.depositTxHash ?? null;
  } catch (e) {
    // A 409 here means the same key is already in flight — the money may well
    // be going. We do NOT say "nothing has been charged", and we do not resend.
    if (status(e) === 409) {
      sent.set(bookingId, "in_flight");
      set({ paid: true });
      return finish(bookingId, set);
    }
    return set({ phase: "stopped", message: t("stays.pay.cantSend") });
  }
  sent.set(bookingId, deposit ?? "in_flight");
  set({ paid: true });

  /* 6 ── name the leg, so the arrival scan knows what to look for */
  if (deposit) {
    await reportLeg(p.intentId, { kind: "bridge", chain: "solana", txHash: deposit, amount: p.priced.deposit }).catch(
      // A leg we fail to report still lands; the scan finds it by amount
      // instead. This is a hint, not a record.
      () => undefined,
    );
  }

  return finish(bookingId, set);
}

/* ── The phone ────────────────────────────────────────────────────── */

/** The stop that means the linked phone has gone: the checkout asks to link again when it sees it. */
export function noPhoneAnyMore(): string {
  return t("stays.pay.noPhoneAnyMore");
}

/**
 * Ask the linked phone, wait, and send what it signed: steps 3 to 6 when the
 * phone approves. "no_phone" is the server saying no Android phone is linked
 * any more (409 NO_PHONE_LINKED); the caller reads the status again.
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
    if (code === "NO_PHONE_LINKED") return "no_phone";
    // Booked, or nothing owed: the room is bought (or about to be), not paid twice.
    if (code === "ALREADY_PAID") return finish(bookingId, set);
    return set({ phase: "stopped", message: t("stays.pay.stillHeld", { reason: describeApprovalRefusal(code, "stay") }) });
  }
  set({ phase: "phone", approval, message: null });

  const end = await waitForPhone(approval, {
    signal,
    onUpdate: (a) => {
      if (a.status === "pending") set({ approval: a });
    },
  });
  if (!end) {
    return set({ phase: "stopped", approval: null, message: t("stays.pay.stoppedWaiting") });
  }

  switch (end.status) {
    case "rejected":
    case "expired":
    case "cancelled":
      return set({ phase: "stopped", approval: null, message: t("stays.pay.stillHeld", { reason: endedWithoutPaying(end.status) }) });
    case "submitted":
      // Sent already (another tab, most likely). Never a second time: wait for it.
      sent.set(bookingId, sent.get(bookingId) ?? "in_flight");
      return finish(bookingId, set);
    case "approved":
      break;
    default:
      return set({ phase: "stopped", approval: null, message: t("stays.pay.stoppedWaiting") });
  }

  const c = end.continuation;
  if (!end.signedTx || !c || c.kind !== "stay" || !c.quote) {
    return set({
      phase: "stopped",
      approval: null,
      message: t("stays.pay.unreadableSignature"),
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
    return set({ phase: "stopped", message: t("stays.pay.cantSend") });
  }
  sent.set(bookingId, deposit ?? "in_flight");
  set({ paid: true });

  /* 6 ── name the leg, with what the server built */
  if (deposit) {
    await reportLeg(c.intentId, { kind: "bridge", chain: "solana", txHash: deposit, amount: Number(c.deposit) }).catch(() => undefined);
  }
  return finish(bookingId, set);
}

/** The passkey was refused for a linked phone: ask the phone, or stop when it has gone since. */
async function phoneOrStop(bookingId: string, set: (n: Partial<PayState>) => PayState, signal?: AbortSignal): Promise<PayState> {
  const out = await payOnPhone(bookingId, set, signal);
  return out === "no_phone" ? set({ phase: "stopped", message: noPhoneAnyMore() }) : out;
}

/** The server's `messageHash` (hex or base64) against our own sha256 of the bytes. */
function sameDigest(given: string, mine: Uint8Array): boolean {
  const hex = Array.from(mine, (b) => b.toString(16).padStart(2, "0")).join("");
  if (/^[0-9a-f]{64}$/i.test(given)) return given.toLowerCase() === hex;
  try {
    return sameBytes(fromBase64(given), mine);
  } catch {
    return false;
  }
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
          message: t("stays.pay.didntComplete"),
        });
      }
    } catch {
      // A failed poll is a failed poll. The chain has not changed its mind.
    }
  }

  if (!funded) {
    return set({
      phase: "stopped",
      message: t("stays.pay.slow"),
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
    message: t("stays.pay.notConfirmed"),
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
    return t("stays.pay.roomTaken");
  }
  return t("stays.pay.cantHold");
}
