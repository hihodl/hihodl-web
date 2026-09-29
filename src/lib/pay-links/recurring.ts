/**
 * A recurring pay link ("10 USDC / month"): paying it is subscribing, once,
 * to a plan the link's owner signed on the Solana Foundation's Subscriptions
 * program. The server builds the transaction; before the payer's wallet sees
 * it, this page checks it is exactly that and nothing more:
 *
 *   - the payer is the fee payer and the only signer
 *   - compute budget, then [InitSubscriptionAuthority] (a first subscription
 *     with this wallet), then [an SPL Approve of the payer's own Subscription
 *     Authority] (when another app's approval replaced it), then ONE Subscribe
 *     to the plan the page shows: this owner, this price, this period, USDC
 *   - nothing else: no transfer, no other program
 *
 * The first period is charged by HOLD's collector right after, and every
 * period after that, into the owner's account and nowhere else (the plan's
 * only destination), at most the plan's price per period (the program's rule).
 *
 * The calls are in client.ts (startSubscribe, subscribed). Pure: takes the web3.js module and a transaction, so the check file runs it
 * in Node (npx sucrase-node src/lib/pay-links/recurring.check.ts).
 */

import type * as SolanaWeb3 from "@solana/web3.js";

import type { PayLinkRecurring } from "./types";

export const SUBSCRIPTIONS_PROGRAM = "De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";

function u64(data: Uint8Array, at: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(data[at + i]);
  return v;
}

type Web3 = Pick<typeof SolanaWeb3, "PublicKey">;

/** Why this transaction is not a subscription to this plan by this payer, or null when it is exactly that. */
export function subscribeTxProblem(
  web3: Web3,
  tx: SolanaWeb3.VersionedTransaction,
  expect: { payerAddress: string; plan: NonNullable<PayLinkRecurring["plan"]> },
): string | null {
  const { PublicKey } = web3;
  const msg = tx.message;
  const keys = msg.staticAccountKeys.map((k) => k.toBase58());
  if ("addressTableLookups" in msg && (msg.addressTableLookups?.length ?? 0) > 0) return "lookup_tables";
  if (keys[0] !== expect.payerAddress) return "fee_payer";
  if (msg.header.numRequiredSignatures !== 1) return "signers";
  const plan = expect.plan;
  if (plan.programId !== SUBSCRIPTIONS_PROGRAM || plan.mint !== USDC_MINT) return "plan";

  const payer = new PublicKey(expect.payerAddress);
  const mint = new PublicKey(USDC_MINT);
  const program = new PublicKey(SUBSCRIPTIONS_PROGRAM);
  const authority = PublicKey.findProgramAddressSync([new TextEncoder().encode("SubscriptionAuthority"), payer.toBytes(), mint.toBytes()], program)[0].toBase58();
  const ata = PublicKey.findProgramAddressSync([payer.toBytes(), new PublicKey(TOKEN_PROGRAM).toBytes(), mint.toBytes()], new PublicKey(ATA_PROGRAM))[0].toBase58();

  let subscribes = 0;
  let order = 0; // budget 0, init 1, approve 2, subscribe 3: never backwards
  for (const ix of msg.compiledInstructions) {
    const programId = keys[ix.programIdIndex];
    const accounts = ix.accountKeyIndexes.map((i) => keys[i]);
    const data = ix.data;
    if (programId === COMPUTE_BUDGET) {
      if (order > 0 || (data[0] !== 2 && data[0] !== 3)) return "compute_budget";
      continue;
    }
    if (programId === TOKEN_PROGRAM) {
      // Approve(owner's USDC account → the owner's own Subscription Authority).
      if (order > 2 || data[0] !== 4 || accounts.length !== 3) return "token_instruction";
      if (accounts[0] !== ata || accounts[1] !== authority || accounts[2] !== expect.payerAddress) return "approve_accounts";
      order = 2;
      continue;
    }
    if (programId !== SUBSCRIPTIONS_PROGRAM) return "program";
    if (data[0] === 0) {
      if (order > 1 || accounts.length !== 6) return "init";
      if (accounts[0] !== expect.payerAddress || accounts[1] !== authority || accounts[2] !== USDC_MINT || accounts[3] !== ata) return "init_accounts";
      if (accounts[4] !== SYSTEM_PROGRAM || accounts[5] !== TOKEN_PROGRAM) return "init_accounts";
      order = 1;
      continue;
    }
    if (data[0] === 11) {
      if (subscribes++ > 0) return "subscribe_twice";
      // No trailing sponsor: the payer pays the rent on the web.
      if (accounts.length !== 8) return "subscribe_accounts";
      if (accounts[0] !== expect.payerAddress || accounts[1] !== plan.merchant || accounts[2] !== plan.planPda || accounts[4] !== authority) {
        return "subscribe_accounts";
      }
      if (data.length !== 1 + 73) return "subscribe_data";
      if (u64(data, 1).toString() !== plan.planId) return "plan_id";
      if (new PublicKey(data.slice(10, 42)).toBase58() !== USDC_MINT) return "mint";
      if (u64(data, 42).toString() !== plan.amountBase) return "amount";
      if (u64(data, 50) !== BigInt(plan.periodHours)) return "period";
      order = 3;
      continue;
    }
    return "subscriptions_instruction";
  }
  return subscribes === 1 ? null : "no_subscribe";
}

/** "10 USDC" from the plan's base units (6 decimals), without trailing zeros. */
export function usdcText(amountBase: string): string {
  const n = BigInt(amountBase);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac.length === 1 ? `${frac}0` : frac}` : ""} USDC`;
}
