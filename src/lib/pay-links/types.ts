/**
 * Pay links, as the public API returns them. Mirrors the backend
 * implementation section of documentation/pay-links-v0.md.
 *
 * A pay link is free: no fee leg, no percentage. Amounts are integer US cents.
 */

import type { Chain, ConfirmOutcome } from "@/lib/ad-space/types";

export type PayLinkStatus = "active" | "paid" | "closed" | "expired" | "disabled";

export type PayLinkAmount = { mode: "fixed"; cents: number } | { mode: "open"; maxCents: number | null };

export interface PayLinkOwner {
  /** Frozen and filtered by the server, but still possibly null. */
  displayName: string | null;
  handle: string | null;
}

/**
 * `GET /:code`. A `disabled` link answers with every field the owner wrote
 * nulled (`title`, `note`, `amount`, `owner`, `payTo`) and no chains.
 */
export interface PayLinkPublic {
  code: string;
  /** At most 80 characters, checked by the server for links, emails and impersonation. */
  title: string | null;
  /** At most 280 characters, or null. */
  note: string | null;
  amount: PayLinkAmount | null;
  chains: Chain[];
  status: PayLinkStatus;
  owner: PayLinkOwner | null;
  /** Null unless the link is active. */
  payTo: { solana: string | null; evm: string | null } | null;
}

/** A link that still says what it asks for: anything but a disabled one. */
export type ShownPayLink = PayLinkPublic & { title: string; amount: PayLinkAmount };

export type PaymentStatus = "awaiting_payment" | "paid" | "unpaid" | "paid_duplicate";

export interface PayLinkPayment {
  id: string;
  amountCents: number;
  chain: Chain;
  payerAddress: string;
  status: PaymentStatus;
  txHash: string | null;
  /** Set with `txHash`. */
  explorerUrl?: string | null;
  paidAt: string | null;
  createdAt?: string;
  /** `https://hihodl.xyz/pay/r/<receiptToken>`, null until paid and only for the paying browser. */
  receiptUrl: string | null;
}

/** The one ERC-3009 authorization a Base or Polygon payment signs: HiSpace's EvmPayload with one entry. */
export interface PayLinkEvmPayload {
  chainId: number;
  token: string;
  domain: Record<string, string | number>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  authorizations: { role: string; label: string; message: Record<string, string> }[];
  validBefore: number;
}

/** `POST /:code/checkout` answers `{ payment, solana }` or `{ payment, evm }`. */
export type PayLinkCheckout =
  | { payment: PayLinkPayment; solana: { transaction: string; lastValidBlockHeight: number } }
  | { payment: PayLinkPayment; evm: PayLinkEvmPayload };

export interface PayConfirm {
  outcome: ConfirmOutcome;
  payment: PayLinkPayment;
}

/** `GET /receipts/:token`. On a disabled link `title` is null; the facts stay. */
export interface PayReceipt {
  amountCents: number;
  amountUsdc?: string;
  chain: Chain;
  status?: PaymentStatus;
  txHash: string | null;
  explorerUrl: string | null;
  paidAt: string | null;
  payerAddress: string;
  receiverAddress?: string | null;
  link: { code: string | null; title: string | null; owner: PayLinkOwner | null };
}
