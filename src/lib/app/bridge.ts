/**
 * Crossing a chain to pay us — the web half of the app's `settlementBridge.ts`.
 *
 * WHY THE WEB NEEDS THIS AT ALL
 *
 * Settlement is one stablecoin on one chain: USDC on Base. The web wallet
 * holds USDC on Solana and nothing else — its seed derives `m/44'/501'/0'/0'/0'`
 * and there is no EVM signer anywhere in `lib/wallet`. So every payment made
 * from the browser crosses.
 *
 * That is not the handicap it sounds like. Solana is the CHEAPEST origin we
 * have: `settlementBridge.ts` skips the relayer gas drip there entirely,
 * because "the deposit costs a fraction of a cent and the account already pays
 * it", while every EVM origin has to be handed gas first. And the backend
 * already rebuilds a Solana bridge deposit with the relayer as fee payer
 * (`/cross-chain/gasless/prepare`), so the person does not need SOL either.
 *
 * ── THE ONE THING THAT MUST BE PORTED EXACTLY ──
 *
 * A bridge is exact-IN and variable-OUT. An invoice is exact-OUT: the server
 * funds a settlement intent on `received >= expected`, and that test is exact.
 * A leg that arrives three cents light does not part-pay a booking — it
 * strands the whole payment at our collection address with the room unbooked
 * and the money gone from the wallet.
 *
 * So `quoteCovering` grosses the deposit up until the provider's GUARANTEED
 * output — `minAmount`, the floor it refunds below rather than fill — covers
 * what is owed. Never `amount`, which is only the best case: sizing an invoice
 * against a best case is the same mistake as not sizing it at all.
 *
 * This is the logic behind booking ab14a4a3 on 27-Aug-2026, where the guest
 * was told "Nothing has been charged" while 7.87 USDC sat at the collection
 * address against a room nobody had bought. The constants below are the app's,
 * unchanged, and they are not tuning knobs.
 *
 * ── AND THE LINE THE MONEY CROSSES ──
 *
 * Once the deposit is broadcast, nothing here throws. A throw after a live
 * deposit is how somebody bridges twice and pays twice. Everything that can
 * refuse the leg refuses it BEFORE anything is signed.
 */

"use client";

import { t } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";

import { read } from "./hold-api";

/** Quotes are exact-in, so covering an exact-out target takes a couple of tries. */
const MAX_QUOTE_ATTEMPTS = 3;

/**
 * The most of a leg a route may consume before we call it a loss rather than a
 * fee. Well above anything measured — a tripwire for a broken or illiquid
 * route, not a price policy. (LI.FI took $0.0326 to move $100 on 2026-07-17.)
 */
const MAX_BRIDGE_COST_RATIO = 1.05;

/**
 * Asked for on top of what the quote said it needed.
 *
 * A quote is a snapshot: the one we sign is fetched a moment after the one we
 * sized against, and relayer fees move with gas. Two tenths of a percent is
 * cheaper than discovering we are a hundredth short only once the fill has
 * landed and cannot be topped up.
 */
const GROSS_UP_SAFETY = 1.002;

export type Chain = "solana" | "base" | "polygon" | "ethereum";

export interface BridgeQuote {
  id: string;
  provider: string;
  tool?: string;
  source: { chain: Chain; tokenSymbol: string; mint?: string; amount: string };
  destination: {
    chain: Chain;
    tokenSymbol: string;
    address: string;
    /** The best case. Never size an invoice against this. */
    amount: string;
    /** The floor the provider refunds below rather than fill. Size against THIS. */
    minAmount: string;
    slippageBps: number;
  };
  totalFeeUsd: number;
  etaSeconds: number;
  expiresAt: number;
  /** The unsigned source-chain transaction. Solana's is base64. */
  _tx: { kind: "solana"; serializedTx: string } | { kind: "evm"; chainId: number; to: string; data: string };
}

export function quoteBridge(args: {
  sourceChain: Chain;
  destChain: Chain;
  tokenSymbol: string;
  amount: string;
  destAddress: string;
  sourceAddress: string;
}): Promise<BridgeQuote> {
  return read<BridgeQuote>("cross-chain/quote", { json: args });
}

/**
 * Rebuild the deposit with the relayer as fee payer.
 *
 * Solana-only, and the reason the browser can pay at all: a web wallet holds
 * USDC and has never held SOL, so a deposit it has to pay the fee on is a
 * deposit it cannot make.
 */
export function prepareGasless(quote: BridgeQuote): Promise<{ serializedTx: string; relayerPublicKey: string }> {
  return read("cross-chain/gasless/prepare", { json: { quote } });
}

export function submitGasless(args: {
  quote: BridgeQuote;
  /** Base64, our signature in our slot, the relayer's left for it to fill. */
  signedTx: string;
  idempotencyKey: string;
}): Promise<{ transferId: string; status: string; depositTxHash?: string; idempotent?: boolean }> {
  return read("cross-chain/gasless/submit", { json: args });
}

/**
 * Find a quote whose guaranteed output covers what the leg owes.
 *
 * Throws, and every throw is pre-broadcast by construction: this only ever
 * asks for prices.
 */
export async function quoteCovering(
  args: {
    sourceChain: Chain;
    destChain: Chain;
    tokenSymbol: string;
    sourceAddress: string;
    destAddress: string;
    /** What must LAND. */
    arrival: number;
    /** What the source balance can actually fund. */
    available: number;
  },
  /**
   * Who to ask for a price. A parameter only so the gross-up can be tested
   * against routes that take 0.1 %, 4 % and 9 % without a network — this is
   * the arithmetic behind a real incident, and it earns a test.
   */
  ask: (q: Parameters<typeof quoteBridge>[0]) => Promise<BridgeQuote> = quoteBridge,
): Promise<{ quote: BridgeQuote; deposit: number }> {
  let deposit = args.arrival;

  for (let attempt = 1; attempt <= MAX_QUOTE_ATTEMPTS; attempt++) {
    if (deposit > args.available) {
      throw new BridgeRefused(
        t("stays.bridge.notEnough", { need: usdc2(deposit), balance: usdc2(args.available) }),
      );
    }

    const quote = await ask({
      sourceChain: args.sourceChain,
      destChain: args.destChain,
      tokenSymbol: args.tokenSymbol,
      amount: deposit.toFixed(6),
      destAddress: args.destAddress,
      sourceAddress: args.sourceAddress,
    });

    const guaranteed = Number(quote.destination.minAmount ?? quote.destination.amount);
    if (!Number.isFinite(guaranteed) || guaranteed <= 0) {
      throw new BridgeRefused(t("stays.bridge.cantPrice"));
    }
    if (guaranteed >= args.arrival) return { quote, deposit };

    const next = deposit * (args.arrival / guaranteed) * GROSS_UP_SAFETY;
    if (next > args.arrival * MAX_BRIDGE_COST_RATIO) {
      throw new BridgeRefused(t("stays.bridge.tooExpensive"));
    }
    deposit = next;
  }

  throw new BridgeRefused(t("stays.bridge.noRoute"));
}

/** A USDC amount as a refusal says it: two decimals, in the language's separators. */
function usdc2(n: number): string {
  return fmtNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A refusal, which by construction happened before anything was signed.
 *
 * Its own class so the caller can tell "nothing has been charged" (true, and
 * safe to say) from a failure after the deposit went out (where saying it
 * would be a lie).
 */
export class BridgeRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeRefused";
  }
}
