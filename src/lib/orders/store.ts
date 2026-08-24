/**
 * The Founder Pass order state machine.
 *
 *   created ──▶ awaiting_payment ──▶ confirming ──▶ paid
 *                      │                  │
 *                      └─────▶ expired ◀──┘            paid ──▶ refunded
 *
 * Every transition happens here, server-side, against the service-role client.
 * The browser can create an order and read its own order back; it can never
 * assert that one is paid. On the on-chain rails the only thing that moves an
 * order to `paid` is logs from an RPC node; on Stripe it is a signed webhook.
 *
 * The table is deny-all (RLS on, zero policies, no grants — see
 * supabase/migrations/20260730120000_founder_orders.sql), so this module is the
 * only door.
 */
import { createSupabaseClient } from "@/lib/supabase";
import { FOUNDER_PASS } from "@/lib/rates.config";
import {
  CHAINS,
  treasuryAccountIndex,
  treasuryXpub,
  type SettlementChain,
} from "./config";
import { buildDerivationPath, deriveEvmAddress } from "./derivation";
import { sendFounderReceipt } from "./email";
import { centsToBaseUnits, currentBlock, readIncomingUsdc } from "./watcher";

export type OrderState =
  | "created"
  | "awaiting_payment"
  | "confirming"
  | "expired"
  | "paid"
  | "refunded";

export type PaymentRail = "stripe" | "external_wallet" | "onchain_transfer";

export interface FounderOrder {
  id: string;
  reference: string;
  state: OrderState;
  rail: PaymentRail;
  email: string;
  price_cents: number;
  currency: string;
  early_price: boolean;
  chain: SettlementChain | null;
  token: string | null;
  amount_base_units: string | null; // bigint arrives as a string
  receiving_address: string | null;
  address_index: string | null;
  derivation_path: string | null;
  watch_from_block: number | null;
  paid_tx_hash: string | null;
  confirmations: number;
  stripe_session_id: string | null;
  quote_expires_at: string;
  paid_at: string | null;
  seat_number: number | null;
  referral_code: string | null;
  created_at: string;
}

/** States that still hold a seat and can still be paid. */
const OPEN_STATES: OrderState[] = ["created", "awaiting_payment", "confirming"];

function db() {
  return createSupabaseClient(true); // service role — bypasses RLS by design
}

/**
 * Public order handle. Unguessable, so knowing a reference is the only thing
 * needed to poll one order and nothing about any other. 26 chars of a
 * 32-symbol alphabet is ~130 bits — well past enumeration.
 */
function newReference(): string {
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz"; // no i/l/o/u — misread-proof
  const bytes = new Uint8Array(26);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/* ── Seats ─────────────────────────────────────────────────────────────── */

export interface SeatCount {
  total: number;
  taken: number;
  remaining: number;
  /** Seats left in the early tranche. Zero once it is gone. */
  earlyRemaining: number;
  soldOut: boolean;
}

/**
 * The live counter behind /founders. Read from the database on every request —
 * there is no cached, hardcoded or "roughly" version of this number anywhere.
 */
export async function readSeats(): Promise<SeatCount> {
  const supabase = db();

  // Sweep lapsed quotes first so the counter reflects genuinely held seats.
  await supabase.rpc("expire_stale_founder_orders");

  const { data: takenData, error: takenError } = await supabase.rpc("founder_seats_taken");
  if (takenError) throw new Error(`Could not read seat count: ${takenError.message}`);

  const { count: settled, error: settledError } = await supabase
    .from("founder_orders")
    .select("id", { count: "exact", head: true })
    .in("state", ["paid", "refunded"]);
  if (settledError) throw new Error(`Could not read settled count: ${settledError.message}`);

  const taken = Number(takenData ?? 0);
  const total = FOUNDER_PASS.totalSeats;

  return {
    total,
    taken,
    remaining: Math.max(0, total - taken),
    earlyRemaining: Math.max(0, FOUNDER_PASS.earlySeats - Number(settled ?? 0)),
    soldOut: taken >= total,
  };
}

/* ── created ───────────────────────────────────────────────────────────── */

export interface CreateOrderInput {
  email: string;
  rail: PaymentRail;
  /** On-chain rails only. Ignored for Stripe. */
  chain?: SettlementChain;
  referralCode?: string | null;
}

/**
 * Open an order and, for the on-chain rails, issue it a receiving address that
 * belongs to it alone.
 *
 * `open_founder_order` does the capacity check and the address-index allocation
 * under one advisory lock, so two buyers cannot both take the last seat and two
 * orders cannot share an index.
 */
export async function createOrder(input: CreateOrderInput): Promise<FounderOrder> {
  const supabase = db();
  const reference = newReference();

  const { data, error } = await supabase.rpc("open_founder_order", {
    p_reference: reference,
    p_rail: input.rail,
    p_email: input.email,
    p_total_seats: FOUNDER_PASS.totalSeats,
    p_early_seats: FOUNDER_PASS.earlySeats,
    p_price_cents: FOUNDER_PASS.priceUsd * 100,
    p_early_price_cents: FOUNDER_PASS.earlyPriceUsd * 100,
    p_quote_minutes: FOUNDER_PASS.quoteValidMinutes,
    p_referral_code: input.referralCode ?? null,
  });

  if (error) {
    if (error.message.includes("founder_sold_out")) {
      throw new SoldOutError();
    }
    throw new Error(`Could not open order: ${error.message}`);
  }

  // open_founder_order returns one JSON object — see the migration for why it is
  // not a RETURNS TABLE.
  const opened = data as {
    order_id: string;
    reference: string;
    address_index: number;
    price_cents: number;
    early_price: boolean;
    expires_at: string;
  } | null;
  if (!opened) throw new Error("Could not open order: no row returned");

  // Stripe orders need no address — Checkout owns the payment leg.
  if (input.rail === "stripe") {
    return updateOrder(reference, { state: "awaiting_payment" });
  }

  const chain = input.chain ?? "base";
  const cfg = CHAINS[chain];
  const index = Number(opened.address_index);

  const address = deriveEvmAddress(treasuryXpub(), index);
  const path = buildDerivationPath(treasuryAccountIndex(), index);

  // Pin the scan window to the height at which this address went live. Anything
  // older on that address cannot be payment for this order.
  const fromBlock = await currentBlock(chain);

  return updateOrder(reference, {
    state: "awaiting_payment",
    chain,
    token: "USDC",
    amount_base_units: centsToBaseUnits(opened.price_cents, cfg.usdcDecimals).toString(),
    receiving_address: address,
    derivation_path: path,
    watch_from_block: fromBlock,
  });
}

export class SoldOutError extends Error {
  constructor() {
    super("founder_sold_out");
    this.name = "SoldOutError";
  }
}

/* ── reads ─────────────────────────────────────────────────────────────── */

export async function getOrder(reference: string): Promise<FounderOrder | null> {
  const supabase = db();
  await supabase.rpc("expire_stale_founder_orders");

  const { data, error } = await supabase
    .from("founder_orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(`Could not read order: ${error.message}`);
  return (data as FounderOrder) ?? null;
}

async function updateOrder(
  reference: string,
  patch: Partial<Record<string, unknown>>,
): Promise<FounderOrder> {
  const supabase = db();
  const { data, error } = await supabase
    .from("founder_orders")
    .update(patch)
    .eq("reference", reference)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update order: ${error.message}`);
  return data as FounderOrder;
}

/* ── awaiting_payment ──▶ confirming ──▶ paid ──────────────────────────── */

/**
 * Ask the chain what happened to this order's address and advance the state
 * machine accordingly. Idempotent — safe to call on every poll.
 *
 * The two thresholds are separate on purpose:
 *   seen on chain, under the confirmation bar → `confirming`
 *   seen on chain, at or over the bar         → `paid` + founder number
 * `confirming` is what stops the 20-minute clock. Once money is on chain the
 * quote can no longer lapse underneath the payer, which is the failure that
 * would otherwise take somebody's $99 and hand them an expired order.
 *
 * EXPIRED ORDERS ARE STILL RECONCILED, and that is on purpose. A transfer that
 * lands a minute after the quote lapsed is real money on an address the payer
 * cannot get it back from, and refusing it to keep a state diagram tidy would
 * be indefensible. The 500-seat cap still holds because `claim_founder_seat`
 * enforces it independently — worst case a very late payer hits a sold-out
 * error and we settle it by hand, which is a far rarer event than a late
 * payment.
 */
export async function reconcileOnchainOrder(order: FounderOrder): Promise<FounderOrder> {
  if (!order.chain || !order.receiving_address || !order.amount_base_units) return order;
  if (order.state === "paid" || order.state === "refunded") return order;

  const cfg = CHAINS[order.chain];
  const required = BigInt(order.amount_base_units);

  const payment = await readIncomingUsdc(
    order.chain,
    order.receiving_address,
    order.watch_from_block ?? 0,
  );

  if (payment.receivedBaseUnits < required) {
    // Nothing usable yet. Expiry is left to the database sweep so there is one
    // definition of "lapsed" rather than two that can disagree.
    return order;
  }

  if (payment.confirmations < cfg.minConfirmations) {
    if (order.state === "confirming" && order.confirmations === payment.confirmations) {
      return order;
    }
    return updateOrder(order.reference, {
      state: "confirming",
      confirmations: payment.confirmations,
      paid_tx_hash: payment.txHash,
    });
  }

  return settleOrder(order.reference, {
    confirmations: payment.confirmations,
    paid_tx_hash: payment.txHash,
  });
}

/**
 * Move an order to `paid` and give it its founder number.
 *
 * `claim_founder_seat` is idempotent: a replayed Stripe webhook or a second
 * confirmation of the same transfer gets back the number already assigned
 * instead of burning another one.
 */
export async function settleOrder(
  reference: string,
  extra: Partial<Record<string, unknown>> = {},
): Promise<FounderOrder> {
  const supabase = db();

  // Read the state before claiming. `claim_founder_seat` is idempotent and
  // returns the same number on a replay, so the return value cannot tell a
  // first settlement from a retried Stripe webhook — but `paid_at` can, and
  // that is what decides whether a receipt goes out.
  const before = await getOrder(reference);
  const alreadySettled = before?.paid_at !== null && before?.paid_at !== undefined;

  const { error } = await supabase.rpc("claim_founder_seat", {
    p_reference: reference,
    p_total_seats: FOUNDER_PASS.totalSeats,
  });
  if (error) throw new Error(`Could not settle order: ${error.message}`);

  const settled =
    Object.keys(extra).length > 0
      ? await updateOrder(reference, extra)
      : await getOrder(reference);

  if (!settled) throw new Error("Order vanished during settlement");

  // The receipt is a promise the confirmation screen makes on our behalf, so it
  // has to actually go out. Fire-and-forget and never awaited: a mail outage
  // must not be able to unsettle an order the chain already confirmed.
  if (!alreadySettled && settled.seat_number !== null) {
    void sendFounderReceipt({
      email: settled.email,
      seatNumber: settled.seat_number,
      reference: settled.reference,
      priceUsd: settled.price_cents / 100,
      txUrl:
        settled.paid_tx_hash && settled.chain
          ? CHAINS[settled.chain].explorerTxUrl(settled.paid_tx_hash)
          : null,
    }).catch((e) => console.error("[founders] receipt failed", reference, e));
  }

  return settled;
}

export function isOpen(order: FounderOrder): boolean {
  return OPEN_STATES.includes(order.state);
}

/** Seconds left on the quote. Zero once it has lapsed. */
export function secondsRemaining(order: FounderOrder): number {
  const ms = new Date(order.quote_expires_at).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}
