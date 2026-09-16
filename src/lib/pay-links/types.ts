/**
 * Pay links, as the public API returns them. Mirrors
 * documentation/pay-links-v0.md; where the contract names a route but not its
 * answer, the shape here is marked ASSUMPTION and is this page's proposal.
 *
 * A pay link is free: no fee leg, no percentage. Amounts are integer US cents.
 */

import type { Chain, ConfirmOutcome } from "@/lib/ad-space/types";

export type PayLinkStatus = "active" | "paid" | "closed" | "expired" | "disabled";

export type PayLinkAmount = { mode: "fixed"; cents: number } | { mode: "open"; maxCents: number | null };

export interface PayLinkPublic {
  code: string;
  /** At most 80 characters, checked by the server for links, emails and impersonation. */
  title: string;
  /** At most 280 characters, or null. */
  note: string | null;
  amount: PayLinkAmount;
  chains: Chain[];
  status: PayLinkStatus;
  owner: { displayName: string; handle: string };
  payTo: { solana: string | null; evm: string | null };
}

export type PaymentStatus = "awaiting_payment" | "paid" | "unpaid" | "paid_duplicate";

export interface PayLinkPayment {
  id: string;
  amountCents: number;
  chain: Chain;
  payerAddress: string;
  status: PaymentStatus;
  txHash: string | null;
  paidAt: string | null;
  /** `https://hihodl.xyz/pay/r/<receiptToken>`. ASSUMPTION: null until paid. */
  receiptUrl: string | null;
}

/**
 * The one ERC-3009 authorization a Base or Polygon payment signs.
 *
 * ASSUMPTION: the contract says "an EVM typed-data payload"; this is the
 * HiSpace EvmPayload with a single entry in `authorizations`.
 */
export interface PayLinkEvmPayload {
  chainId: number;
  token: string;
  domain: Record<string, string | number>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  authorizations: { role: string; label: string; message: Record<string, string> }[];
  validBefore: number;
}

/** ASSUMPTION: `POST /:code/checkout` answers `{ payment, solana }` or `{ payment, evm }`. */
export type PayLinkCheckout =
  | { payment: PayLinkPayment; solana: { transaction: string; lastValidBlockHeight: number } }
  | { payment: PayLinkPayment; evm: PayLinkEvmPayload };

export interface PayConfirm {
  outcome: ConfirmOutcome;
  payment: PayLinkPayment;
}

/**
 * `GET /receipts/:token`. ASSUMPTION: the contract lists amount, chain, tx
 * link and time; the link's title and owner are added so the receipt says
 * what was paid and to whom.
 */
export interface PayReceipt {
  amountCents: number;
  chain: Chain;
  txHash: string;
  explorerUrl: string | null;
  paidAt: string;
  payerAddress: string;
  link: { code: string; title: string; owner: { displayName: string; handle: string } };
}
