/**
 * Payments built by the server, approved on the phone: the words and shapes
 * the web needs, with no network in them, so the check script runs them.
 *
 *   npx sucrase-node src/lib/link/payment-approval-core.check.ts
 *
 * Contract: documentation/one-wallet-every-device.md, "Payments built by the
 * server, approved on the phone".
 */

import { t } from "../app/i18n";

export type PaymentKind = "spot" | "stay";

export type PaymentApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled" | "submitted";

export interface PaymentSummary {
  title: string;
  subtitle: string | null;
  /** Human USDC: what the spot costs, or what must land for a stay. */
  amount: string;
  token: string;
  chain: string;
  /** A stay's deposit that leaves the wallet, once the phone built it. */
  spend: string | null;
}

export interface SpotContinuation {
  kind: "spot";
  orderId: string;
  submitIdempotencyKey: string;
  relayerPublicKey: string;
  lastValidBlockHeight: number;
}

export interface StayContinuation {
  kind: "stay";
  bookingId: string;
  intentId: string;
  /** The full quote `/cross-chain/gasless/submit` takes. */
  quote: unknown;
  /** Human USDC string: the leg the web reports. */
  deposit: string;
  idempotencyKey: string;
  relayerPublicKey: string;
  lastValidBlockHeight: number;
}

export interface PaymentApproval {
  id: string;
  kind: PaymentKind;
  summary: PaymentSummary;
  from: string;
  status: PaymentApprovalStatus;
  createdAt: string;
  expiresAt: string;
  signedTx: string | null;
  continuation: SpotContinuation | StayContinuation | null;
}

const STATUSES: PaymentApprovalStatus[] = ["pending", "approved", "rejected", "expired", "cancelled", "submitted"];

type Raw = Record<string, unknown>;
const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The server's approval, read defensively: a field it does not send is null, never a crash. */
export function toApproval(r: Raw): PaymentApproval {
  const s = (r.summary ?? {}) as Raw;
  const status = STATUSES.includes(r.status as PaymentApprovalStatus) ? (r.status as PaymentApprovalStatus) : "pending";
  const c = r.continuation as Raw | null | undefined;
  const continuation = c && (c.kind === "spot" || c.kind === "stay") ? (c as unknown as SpotContinuation | StayContinuation) : null;
  return {
    id: String(r.id ?? ""),
    kind: r.kind === "stay" ? "stay" : "spot",
    summary: {
      title: text(s.title) ?? "",
      subtitle: text(s.subtitle),
      amount: s.amount === undefined || s.amount === null ? "" : String(s.amount),
      token: text(s.token) ?? "USDC",
      chain: text(s.chain) ?? "solana",
      spend: s.spend === undefined || s.spend === null ? null : String(s.spend),
    },
    from: text(r.from) ?? "",
    status,
    createdAt: text(r.createdAt) ?? "",
    expiresAt: text(r.expiresAt) ?? "",
    signedTx: text(r.signedTx),
    continuation,
  };
}

/** Everything but `pending` is an answer: the web stops waiting on it. */
export function isDecided(s: PaymentApprovalStatus): boolean {
  return s !== "pending";
}

/** The ways a phone approval ends with nothing sent. Every one of them is true: nothing left the wallet. */
export function endedWithoutPaying(status: "rejected" | "expired" | "cancelled"): string {
  switch (status) {
    case "rejected":
      return t("link.refusal.declined");
    case "expired":
      return t("link.refusal.expired");
    case "cancelled":
      return t("link.refusal.cancelled");
  }
}

/**
 * Why asking the phone was refused, in words a person can act on.
 *
 * Every code the contract names has its sentence, including the ones only
 * the phone meets (`/transaction`, `/authorize-device`), so a code that turns
 * up here one day still reads as a fact and never as a code. Each one is
 * said before anything was signed, so "nothing has been charged" is true.
 */
export function describeApprovalRefusal(code: string, kind: PaymentKind): string {
  const spot = kind === "spot";
  switch (code) {
    case "VALIDATION_ERROR":
      return spot ? t("link.refusal.validationSpot") : t("link.refusal.validationStay");
    case "NO_PHONE_LINKED":
    case "LINK_YOUR_PHONE_FIRST":
      return t("link.refusal.linkFirst");
    case "APPROVE_ON_YOUR_PHONE":
      return t("link.refusal.approveOnPhone");
    case "NO_WALLET":
      return t("link.refusal.noWalletGetApp");
    case "NOT_FOUND":
    case "not_found":
      return spot ? t("link.refusal.notFoundSpot") : t("link.refusal.notFoundStay");
    case "ALREADY_PAID":
      return spot ? t("link.refusal.alreadyPaidSpot") : t("link.refusal.alreadyPaidStay");
    case "NOT_PAYABLE":
      return spot ? t("link.refusal.notPayableSpot") : t("link.refusal.notPayableStay");
    case "NOT_YOUR_WALLET":
      return t("link.refusal.notYourWallet");
    case "NO_PAYMENT_OPEN":
      return t("link.refusal.noPaymentOpen");
    case "NOT_PENDING":
      return t("link.refusal.notPending");
    case "NOT_BUILT":
    case "BUILD_EXPIRED":
      return t("link.refusal.notBuilt");
    case "APPROVAL_EXPIRED":
      return t("link.refusal.expired");
    case "NOT_THE_ISSUED_TRANSACTION":
    case "NOT_SIGNED_BY_WALLET":
    case "DEVICE_SIGNATURE_INVALID":
      return t("link.refusal.mismatch");
    case "HOLD_EXPIRED":
      return t("link.refusal.holdExpired");
    case "SPACE_CLOSED":
      return t("link.refusal.spaceClosed");
    case "CHAIN_UNAVAILABLE":
    case "RELAYER_NOT_CONFIGURED":
      return t("link.refusal.unavailable");
    case "NO_ROUTE":
    case "ROUTE_TOO_EXPENSIVE":
      return t("link.refusal.noRoute");
    case "rate_limited":
      return t("link.refusal.rateLimited");
    case "network":
      return t("link.refusal.network");
    default:
      return spot ? t("link.refusal.defaultSpot") : t("link.refusal.defaultStay");
  }
}
