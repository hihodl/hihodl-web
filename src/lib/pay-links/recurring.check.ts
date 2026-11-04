/**
 * npx sucrase-node src/lib/pay-links/recurring.check.ts
 *
 * The page lets a wallet sign a subscription only when the transaction is
 * exactly [budget] + [InitSubscriptionAuthority] + [Approve] + one Subscribe to
 * the plan it shows, paid and signed by the payer alone.
 */

import * as web3 from "@solana/web3.js";

import { SUBSCRIPTIONS_PROGRAM, USDC_MINT, reapproveTxProblem, subscribeTxProblem, usdcText } from "./recurring";

let fails = 0;
function eq(name: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log("FAIL", name, JSON.stringify(a), "!=", JSON.stringify(b));
  } else console.log("ok  ", name);
}

const { PublicKey, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, SystemProgram } = web3;
const program = new PublicKey(SUBSCRIPTIONS_PROGRAM);
const mint = new PublicKey(USDC_MINT);
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const payer = Keypair.generate().publicKey;
const merchant = Keypair.generate().publicKey;
const planId = 42n;
const u64 = (n: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
};
const [planPda, bump] = PublicKey.findProgramAddressSync([Buffer.from("plan"), merchant.toBuffer(), u64(planId)], program);
const authority = PublicKey.findProgramAddressSync([Buffer.from("SubscriptionAuthority"), payer.toBuffer(), mint.toBuffer()], program)[0];
const ata = PublicKey.findProgramAddressSync([payer.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA)[0];
const subPda = PublicKey.findProgramAddressSync([Buffer.from("subscription"), planPda.toBuffer(), payer.toBuffer()], program)[0];
const eventAuthority = PublicKey.findProgramAddressSync([Buffer.from("event_authority")], program)[0];

const plan = {
  programId: SUBSCRIPTIONS_PROGRAM,
  planPda: planPda.toBase58(),
  merchant: merchant.toBase58(),
  planId: "42",
  amountBase: "10000000",
  periodHours: 720,
  mint: USDC_MINT,
};

const init = new TransactionInstruction({
  programId: program,
  keys: [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN, isSigner: false, isWritable: false },
  ],
  data: Buffer.from([0]),
});

function subscribe(amount = 10_000_000n, hours = 720n, id = planId, sponsor: web3.PublicKey | null = null) {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: merchant, isSigner: false, isWritable: false },
    { pubkey: planPda, isSigner: false, isWritable: false },
    { pubkey: subPda, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: program, isSigner: false, isWritable: false },
  ];
  if (sponsor) keys.push({ pubkey: sponsor, isSigner: true, isWritable: true });
  const initId = Buffer.alloc(8);
  initId.writeBigInt64LE(-(2n ** 63n));
  return new TransactionInstruction({
    programId: program,
    keys,
    data: Buffer.concat([Buffer.from([11]), u64(id), Buffer.from([bump]), mint.toBuffer(), u64(amount), u64(hours), u64(1_790_000_000n), initId]),
  });
}

const budget = [ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 })];
const blockhash = Keypair.generate().publicKey.toBase58();
const tx = (ixs: web3.TransactionInstruction[], feePayer = payer) =>
  new VersionedTransaction(new TransactionMessage({ payerKey: feePayer, recentBlockhash: blockhash, instructions: ixs }).compileToLegacyMessage());
const check = (t: web3.VersionedTransaction) => subscribeTxProblem(web3, t, { payerAddress: payer.toBase58(), plan });

eq("init + subscribe", check(tx([...budget, init, subscribe()])), null);
eq("subscribe alone (authority already there)", check(tx([...budget, subscribe()])), null);
const approve = new TransactionInstruction({
  programId: TOKEN,
  keys: [
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: false },
  ],
  data: Buffer.concat([Buffer.from([4]), Buffer.alloc(8, 0xff)]),
});
eq("re-approve + subscribe", check(tx([...budget, approve, subscribe()])), null);

const thief = Keypair.generate().publicKey;
const approveThief = new TransactionInstruction({ ...approve, keys: [approve.keys[0], { ...approve.keys[1], pubkey: thief }, approve.keys[2]] });
eq("an approval to anybody else", check(tx([...budget, approveThief, subscribe()])), "approve_accounts");
eq("a higher price", check(tx([...budget, init, subscribe(20_000_000n)])), "amount");
eq("a shorter period", check(tx([...budget, init, subscribe(10_000_000n, 24n)])), "period");
eq("another plan id", check(tx([...budget, init, subscribe(10_000_000n, 720n, 43n)])), "plan_id");
eq("subscribing twice", check(tx([...budget, subscribe(), subscribe()])), "subscribe_twice");
eq("no subscribe at all", check(tx([...budget, init])), "no_subscribe");
eq(
  "a transfer slipped in",
  check(tx([...budget, subscribe(), SystemProgram.transfer({ fromPubkey: payer, toPubkey: thief, lamports: 1 })])),
  "program",
);
eq("somebody else pays the fee", check(tx([...budget, subscribe()], thief)), "fee_payer");
eq("a second signer", check(tx([...budget, subscribe(10_000_000n, 720n, planId, thief)])), "signers");
eq("budget after the rest", check(tx([subscribe(), ...budget])), "compute_budget");

// Renewing: the Approve alone, back to this wallet's own Subscription Authority.
const renew = (t: web3.VersionedTransaction) => reapproveTxProblem(web3, t, { payerAddress: payer.toBase58() });
eq("renew: budget + the Approve", renew(tx([...budget, approve])), null);
eq("renew: an approval to anybody else", renew(tx([...budget, approveThief])), "approve_accounts");
eq("renew: a subscribe slipped in", renew(tx([...budget, approve, subscribe()])), "program");
eq(
  "renew: a transfer slipped in",
  renew(tx([...budget, approve, SystemProgram.transfer({ fromPubkey: payer, toPubkey: thief, lamports: 1 })])),
  "program",
);
eq("renew: approving twice", renew(tx([...budget, approve, approve])), "approve_twice");
eq("renew: somebody else pays the fee", renew(tx([...budget, approve], thief)), "fee_payer");
eq("renew: nothing to approve", renew(tx([...budget])), "no_approve");

eq("10 USDC", usdcText("10000000"), "10 USDC");
eq("9.5 USDC", usdcText("9500000"), "9.50 USDC");
eq("0.01 USDC", usdcText("10000"), "0.01 USDC");

console.log(fails ? `\n${fails} failed` : "\nall ok");
if (fails) process.exit(1);
