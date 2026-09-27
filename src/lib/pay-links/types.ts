/**
 * Pay links, as the public API returns them. Mirrors the backend
 * implementation section of documentation/pay-links-v0.md.
 *
 * A pay link is free: no fee leg, no percentage. Amounts are integer US cents.
 */

import type { Chain, ConfirmOutcome } from "@/lib/ad-space/types";

export type PayLinkStatus = "active" | "paid" | "closed" | "expired" | "disabled";

export type PayLinkAmount = { mode: "fixed"; cents: number } | { mode: "open"; maxCents: number | null };

/**
 * Who is being paid, frozen on the link at creation and run through the same
 * text filter as the title.
 */
export interface PayLinkOwner {
  /** Null when it didn't pass the filter. */
  displayName: string | null;
  /** The HOLD handle without "@", null when there is none or it didn't pass. */
  handle: string | null;
  /**
   * What every page, signing label and receipt names the owner by: "@handle",
   * else the display name, else "the link owner". Optional only because a
   * server older than this field sends none.
   */
  label?: string;
  /**
   * The owner's face: a signed https photo URL (valid about an hour), sent
   * only when their profile is public. Null (or a null URL) when it is
   * private, invisible or has no photo: the page draws their initials.
   * Absent from a server older than this field.
   */
  face?: PayLinkFace | null;
  /**
   * True when the owner passed KYC; `displayName` is then their verified
   * short name ("Alex L."). Absent from an older server.
   */
  verified?: boolean;
}

export interface PayLinkFace {
  avatarUrl: string | null;
}

/** How a payer with no wallet pays: Coinflow's hosted checkout. */
export type CardMethod = "card" | "applePay" | "googlePay";

/**
 * A way to pay a link, as the server decides it per link (the backend's
 * methods.ts). `bank_transfer` names only its currency and whether the payer
 * must be a business, and the page does not offer it yet.
 */
export type PayLinkMethod =
  | { kind: "hold" }
  | { kind: "stablecoins" }
  | { kind: "card" }
  | { kind: "apple_pay" }
  | { kind: "google_pay" }
  | { kind: "bank_transfer"; currency: string; payerMustBeBusiness: boolean };

export type PayLinkMethodKind = PayLinkMethod["kind"];

/**
 * What the link takes by card, or null for no card rows. Amounts in US cents;
 * `currencies` are ISO 4217 codes the card may be charged in.
 */
export interface PayLinkCardOffer {
  methods: CardMethod[];
  currencies: string[];
  minUsdCents: number;
  maxUsdCents: number;
}

export type CardPaymentStatus = "pending" | "paid" | "declined" | "failed" | "refunded";

/** A card payment, as `POST /:code/card` and `GET /card/:paymentId` return it. */
export interface CardPayment {
  id: string;
  method: string;
  status: CardPaymentStatus;
  currency: string;
  /** In the currency's minor units. */
  amountMinor: number;
  usdCents: number | null;
  txHash: string | null;
  explorerUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * `GET /:code`. A `disabled` link answers with every field the owner wrote
 * nulled (`title`, `note`, `amount`, `owner`, `payTo`) and no chains.
 */
export interface PayLinkPublic {
  code: string;
  /**
   * The owner's personal link, `hihodl.xyz/pay/@handle`: an open amount,
   * reusable, never expiring. Its title is ours, not the owner's, so the page
   * names the person instead. Absent from a server older than this field.
   */
  personal?: boolean;
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
  /** Card, Apple Pay and Google Pay, when the server offers them. Absent from an older server. */
  card?: PayLinkCardOffer | null;
  /** What the link takes in stablecoins. Absent means USDC only (an older server). */
  tokens?: ("usdc" | "eurc")[];
  /** The ways the page may offer, and no others. Absent from an older server: every row as before. */
  methods?: PayLinkMethod[];
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
export type PayLinkCheckout = (
  | {
      payment: PayLinkPayment;
      /**
       * `transaction` is signed by our fee payer; `walletFirst` (a server
       * from 27-Sep-2026 on) is the same one unsigned, for a wallet that
       * signs first and hands it back (submitPaySolana).
       */
      solana: { transaction: string; walletFirst?: string; lastValidBlockHeight: number };
    }
  | { payment: PayLinkPayment; evm: PayLinkEvmPayload }
) & {
  /** The server's clock when it answered, ISO 8601. */
  serverTime?: string;
};

/**
 * A checkout as this page holds it: the answer plus how far the server's clock
 * is ahead of this browser's (ms, negative when behind), measured when the
 * answer arrived. 0 when the server sent no usable `serverTime`.
 */
export type TimedPayLinkCheckout = PayLinkCheckout & { skewMs: number };

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
