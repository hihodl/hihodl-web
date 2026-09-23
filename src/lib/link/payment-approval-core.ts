/**
 * Payments built by the server, approved on the phone: the words and shapes
 * the web needs, with no network in them, so the check script runs them.
 *
 *   npx sucrase-node src/lib/link/payment-approval-core.check.ts
 *
 * Contract: documentation/one-wallet-every-device.md, "Payments built by the
 * server, approved on the phone".
 */

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
      return "You declined it on your phone. Nothing has been charged.";
    case "expired":
      return "It was not approved on your phone within ten minutes. Nothing has been charged.";
    case "cancelled":
      return "Cancelled. Nothing has been charged.";
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
  const thing = kind === "spot" ? "spot" : "stay";
  switch (code) {
    case "VALIDATION_ERROR":
      return `We couldn't ask your phone about this ${thing}. Nothing has been charged. Try again.`;
    case "NO_PHONE_LINKED":
      return "Your phone is no longer linked. Nothing has been charged.";
    case "NO_WALLET":
      return "This account has no wallet to pay from yet. Nothing has been charged.";
    case "NOT_FOUND":
    case "not_found":
      return kind === "spot"
        ? "We couldn't find that order any more. Nothing has been charged. Pick the spot again."
        : "We couldn't find that booking any more. Nothing has been charged. Pick the room again.";
    case "ALREADY_PAID":
      return kind === "spot" ? "This spot is already paid for." : "This stay is already paid for.";
    case "NOT_PAYABLE":
      return kind === "spot"
        ? "This spot can't be paid from your phone right now. Nothing has been charged."
        : "This stay can't be paid from your phone right now. Nothing has been charged.";
    case "NOT_YOUR_WALLET":
      return "This spot is held for another wallet. Nothing has been charged.";
    case "NO_PAYMENT_OPEN":
      return "The payment for this stay isn't open yet. Nothing has been charged. Try again.";
    case "NOT_PENDING":
      return "Your phone already answered this one.";
    case "NOT_BUILT":
    case "BUILD_EXPIRED":
      return "Your phone has to prepare the payment again. Nothing has been charged.";
    case "APPROVAL_EXPIRED":
      return "It was not approved on your phone within ten minutes. Nothing has been charged.";
    case "NOT_THE_ISSUED_TRANSACTION":
    case "NOT_SIGNED_BY_WALLET":
    case "DEVICE_SIGNATURE_INVALID":
      return "Your phone's approval didn't match this payment, so it was not sent. Nothing has been charged.";
    case "HOLD_EXPIRED":
      return "The hold on this spot ran out. Nothing has been charged. Pick the spot again.";
    case "SPACE_CLOSED":
      return "That listing has closed. Nothing has been charged.";
    case "CHAIN_UNAVAILABLE":
    case "RELAYER_NOT_CONFIGURED":
      return "Payments are briefly unavailable. Nothing has been charged. Try again in a moment.";
    case "NO_ROUTE":
    case "ROUTE_TOO_EXPENSIVE":
      return "We couldn't find a way to move this payment right now. Nothing has been charged. Try again in a moment.";
    case "rate_limited":
      return "Too many tries in a row. Nothing has been charged. Wait a minute and try again.";
    case "network":
      return "We couldn't reach HOLD. Nothing has been charged. Check your connection and try again.";
    default:
      return `We couldn't ask your phone to approve this ${thing}. Nothing has been charged. Try again.`;
  }
}
