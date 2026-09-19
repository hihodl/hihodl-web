/**
 * The transaction half of a web-passkey withdrawal: build the unsigned
 * transfer, and later attach the one signature it needs from us.
 *
 * WHAT IS BUILT (the app's own send, hihodl-wallet/src/send/buildSolanaTransferTx.ts)
 *
 *   fee payer        the relayer (from POST /relayer/solana/quote)
 *   compute budget   limit and price, from the quote
 *   SOL              SystemProgram.transfer(from → to)
 *   USDC             createAssociatedTokenAccountIdempotent(recipient's ATA),
 *                    paid by the relayer only when the quote says the account
 *                    has to be bought (else by the sender: a no-op), then
 *                    TransferChecked(from's ATA → recipient's ATA); plus, only
 *                    when the relayer buys that account, the quote's charge
 *                    to the treasury, which the relayer guard requires
 *
 * The bytes signed are `message.serialize()`; the server's approval stores
 * sha256 of exactly those, and the relayer checks the transaction it gets
 * carries the same. Nothing here signs anything but a message this module
 * built, and only after the server said the passkey approved its hash.
 */

"use client";

import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";

import type { RelayerQuote } from "@/lib/link/api";

import { USDC_MINT } from "./api";
import { toBase64 } from "./core";
import { toBaseUnits, type WithdrawToken } from "./withdraw-core";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const USDC_DECIMALS = 6;

export interface BuiltWithdrawal {
  /** The legacy message's bytes: what the passkey approves and the key signs. */
  message: Uint8Array;
  /** base64 of `message`, for POST /withdrawals/:id/passkey-challenge. */
  messageB64: string;
  idempotencyKey: string;
  /** When the quote's blockhash was read: it is good for about a minute. */
  builtAt: number;
}

function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, n, true);
  return out;
}

export async function buildWithdrawal(args: {
  from: string;
  to: string;
  token: WithdrawToken;
  amount: string;
  quote: RelayerQuote;
}): Promise<BuiltWithdrawal> {
  // web3.js's own Buffer polyfill: a browser has no global one.
  const [web3, { Buffer }] = await Promise.all([import("@solana/web3.js"), import("buffer")]);
  const { PublicKey, SystemProgram, ComputeBudgetProgram, TransactionInstruction, Transaction } = web3;

  const units = toBaseUnits(args.amount, args.token);
  if (units === null) throw new Error("bad_amount");
  if (!args.quote.blockhash || !args.quote.relayerPublicKey) throw new Error("bad_quote");

  const from = new PublicKey(args.from);
  const to = new PublicKey(args.to);
  const relayer = new PublicKey(args.quote.relayerPublicKey);

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: args.quote.computeUnits ?? 140000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(args.quote.priorityFeeLamports ?? 0) }),
  );

  if (args.token === "SOL") {
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: units }));
  } else {
    const tokenProgram = new PublicKey(TOKEN_PROGRAM);
    const ataProgram = new PublicKey(ATA_PROGRAM);
    const ata = (owner: InstanceType<typeof PublicKey>, mint: InstanceType<typeof PublicKey>) =>
      PublicKey.findProgramAddressSync([owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], ataProgram)[0];
    const transferChecked = (
      source: InstanceType<typeof PublicKey>,
      mint: InstanceType<typeof PublicKey>,
      dest: InstanceType<typeof PublicKey>,
      owner: InstanceType<typeof PublicKey>,
      amount: bigint,
      decimals: number,
    ) => {
      const data = new Uint8Array(10);
      data[0] = 12; // TransferChecked
      data.set(u64le(amount), 1);
      data[9] = decimals;
      return new TransactionInstruction({
        programId: tokenProgram,
        keys: [
          { pubkey: source, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: owner, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(data),
      });
    };

    const mint = new PublicKey(USDC_MINT);
    const source = ata(from, mint);
    const dest = ata(to, mint); // throws for nothing: findProgramAddress takes any owner
    const owed = args.quote.sponsorship;
    const relayerBuys = !!owed && owed.accountsToCreate > 0;
    const payer = relayerBuys ? relayer : from;

    tx.add(
      new TransactionInstruction({
        programId: ataProgram,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: dest, isSigner: false, isWritable: true },
          { pubkey: to, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: tokenProgram, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([1]), // CreateIdempotent
      }),
      transferChecked(source, mint, dest, from, units, USDC_DECIMALS),
    );

    if (relayerBuys && owed) {
      const charge = BigInt(owed.chargeBaseUnits);
      if (charge > 0n) {
        const chargeMint = new PublicKey(owed.chargeMint);
        tx.add(transferChecked(ata(from, chargeMint), chargeMint, new PublicKey(owed.treasuryTokenAccount), from, charge, USDC_DECIMALS));
      }
    }
  }

  tx.recentBlockhash = args.quote.blockhash;
  tx.feePayer = relayer;
  const message = new Uint8Array(tx.compileMessage().serialize());
  return { message, messageB64: toBase64(message), idempotencyKey: args.quote.idempotencyKey, builtAt: Date.now() };
}

/** sha256 of the message: what the server stores as `message_hash`. */
export function messageHash(message: Uint8Array): Uint8Array {
  return sha256(message);
}

/**
 * Sign the message with the wallet's key and return the transaction for the
 * relayer (base64): our signature in our slot, the relayer's left empty for
 * it to fill. Refuses when the key is not the message's `from`.
 */
export async function signWithdrawal(built: BuiltWithdrawal, seed: Uint8Array, from: string): Promise<string> {
  const { VersionedMessage, VersionedTransaction, PublicKey } = await import("@solana/web3.js");
  const msg = VersionedMessage.deserialize(built.message);
  const signer = new PublicKey(ed25519.getPublicKey(seed));
  if (signer.toBase58() !== from) throw new Error("wrong_key");
  const index = msg.staticAccountKeys.findIndex((k) => k.equals(signer));
  if (index < 0 || index >= msg.header.numRequiredSignatures) throw new Error("not_a_signer");
  const tx = new VersionedTransaction(msg);
  tx.signatures[index] = ed25519.sign(built.message, seed);
  return toBase64(tx.serialize());
}
