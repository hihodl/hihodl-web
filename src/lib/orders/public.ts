/**
 * The order, as the browser is allowed to see it.
 *
 * Deliberately narrow. The derivation path, the address index and the treasury
 * account never leave the server: together they describe the shape of the
 * treasury's key tree, and there is no reason a checkout page needs any of it.
 * What the page needs is where to send, how much, and what state it is in.
 */
import { CHAINS } from "./config";
import { formatBaseUnits } from "./watcher";
import type { FounderOrder } from "./store";

export interface PublicOrder {
  reference: string;
  state: FounderOrder["state"];
  rail: FounderOrder["rail"];
  priceUsd: number;
  earlyPrice: boolean;
  chain: string | null;
  chainLabel: string | null;
  token: string | null;
  /** Human amount, e.g. "99" — the exact figure to send. */
  amount: string | null;
  receivingAddress: string | null;
  expiresAt: string;
  secondsRemaining: number;
  confirmations: number;
  minConfirmations: number | null;
  txHash: string | null;
  explorerUrl: string | null;
  seatNumber: number | null;
}

export function toPublicOrder(order: FounderOrder): PublicOrder {
  const cfg = order.chain ? CHAINS[order.chain] : null;
  const secondsRemaining = Math.max(
    0,
    Math.floor((new Date(order.quote_expires_at).getTime() - Date.now()) / 1000),
  );

  return {
    reference: order.reference,
    state: order.state,
    rail: order.rail,
    priceUsd: order.price_cents / 100,
    earlyPrice: order.early_price,
    chain: order.chain,
    chainLabel: cfg?.label ?? null,
    token: order.token,
    amount:
      order.amount_base_units && cfg
        ? formatBaseUnits(BigInt(order.amount_base_units), cfg.usdcDecimals)
        : null,
    receivingAddress: order.receiving_address,
    expiresAt: order.quote_expires_at,
    secondsRemaining,
    confirmations: order.confirmations,
    minConfirmations: cfg?.minConfirmations ?? null,
    txHash: order.paid_tx_hash,
    explorerUrl:
      order.paid_tx_hash && cfg ? cfg.explorerTxUrl(order.paid_tx_hash) : null,
    seatNumber: order.seat_number,
  };
}

/**
 * What the QR encodes: the receiving address, plain.
 *
 * EIP-681 (`ethereum:<token>@<chainId>/transfer?address=…&uint256=…`) would
 * prefill the token and the amount in wallets that parse it, which is nicer —
 * and is exactly why it is the wrong default here. Wallets that do not parse it
 * show the user an unreadable string, and this QR has to work in whatever
 * wallet the buyer already has. A plain address scans everywhere. The chain,
 * the token and the exact amount are stated next to it in text, each on its own
 * copy button.
 */
export function qrPayload(order: PublicOrder): string | null {
  return order.receivingAddress;
}
