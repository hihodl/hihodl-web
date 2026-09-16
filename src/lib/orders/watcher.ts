/**
 * Deposit detection for Founder Pass orders.
 *
 * Same shape as the backend's inbound pipeline (`confirmation-checker.ts`):
 * see the transfer, count confirmations, only call it settled once it clears a
 * threshold. The difference is the trigger. The backend runs a long-lived
 * indexer with Alchemy ADDRESS_ACTIVITY webhooks; a Next.js route handler has
 * no process to run one in, so this pulls on demand — the checkout page polls
 * its own order, and each poll asks the chain directly.
 *
 * That inversion is deliberate and it is bounded: an order is only watchable
 * for the 20 minutes its quote is alive, over an address that exists for that
 * one order, so the query is always a few hundred blocks of one contract's logs
 * filtered to one recipient.
 *
 * SERVER-SIDE ONLY. The browser is told the outcome; it is never the source of
 * it. A client that says "I paid" changes nothing — only logs do.
 */
import { CHAINS, rpcUrl, type SettlementChain } from "./config";

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface RpcLog {
  transactionHash: string;
  blockNumber: string;
  data: string;
  topics: string[];
}

let rpcId = 0;

async function rpc<T>(chain: SettlementChain, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(chain), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`RPC ${method} on ${chain} returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method} on ${chain}: ${json.error.message}`);
  if (json.result === undefined) throw new Error(`RPC ${method} on ${chain} returned no result`);
  return json.result;
}

export async function currentBlock(chain: SettlementChain): Promise<number> {
  const hex = await rpc<string>(chain, "eth_blockNumber", []);
  return Number(BigInt(hex));
}

/** An address as a 32-byte log topic. */
function addressTopic(address: string): string {
  return "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

export interface IncomingPayment {
  /** Total USDC received on this address since `fromBlock`, in base units. */
  receivedBaseUnits: bigint;
  /** Confirmations on the LAST transfer that made up the total. Zero if none. */
  confirmations: number;
  /** The transfer that completed the payment, for the receipt. */
  txHash: string | null;
  latestBlock: number;
}

/**
 * Sum every USDC transfer into `address` from `fromBlock` onward.
 *
 * Summed rather than matched exactly on purpose. A wallet that sends the amount
 * in two goes, or a user who tops up after a short send, still ends up paid;
 * requiring one transfer of exactly the quoted amount would strand real money
 * on an address the payer cannot recover it from.
 *
 * `fromBlock` is the height at which the order issued its address, so an older
 * transfer to a (never-reused) address cannot be miscredited to this order.
 */
export async function readIncomingUsdc(
  chain: SettlementChain,
  address: string,
  fromBlock: number,
): Promise<IncomingPayment> {
  const cfg = CHAINS[chain];
  const latestBlock = await currentBlock(chain);

  const logs = await rpc<RpcLog[]>(chain, "eth_getLogs", [
    {
      address: cfg.usdc,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + latestBlock.toString(16),
      // [event, from (any), to (our address)]
      topics: [TRANSFER_TOPIC, null, addressTopic(address)],
    },
  ]);

  if (logs.length === 0) {
    return { receivedBaseUnits: 0n, confirmations: 0, txHash: null, latestBlock };
  }

  let total = 0n;
  let lastBlock = 0;
  let lastTx: string | null = null;

  for (const log of logs) {
    // Transfer value is the only non-indexed argument, so it is the whole data
    // field. A malformed one is skipped rather than allowed to poison the sum.
    let value: bigint;
    try {
      value = BigInt(log.data);
    } catch {
      continue;
    }
    total += value;

    const block = Number(BigInt(log.blockNumber));
    if (block >= lastBlock) {
      lastBlock = block;
      lastTx = log.transactionHash;
    }
  }

  return {
    receivedBaseUnits: total,
    // +1 because the block containing the transfer is itself a confirmation.
    confirmations: lastBlock > 0 ? Math.max(0, latestBlock - lastBlock + 1) : 0,
    txHash: lastTx,
    latestBlock,
  };
}

/** USDC base units for a price in cents. Both are integers; no float involved. */
export function centsToBaseUnits(cents: number, decimals: number): bigint {
  return (BigInt(cents) * 10n ** BigInt(decimals)) / 100n;
}

export function formatBaseUnits(units: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const frac = (units % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
