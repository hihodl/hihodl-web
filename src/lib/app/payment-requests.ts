"use client";

/**
 * Asking somebody on HOLD for money: `/payments/request` and
 * `/payments/requests/*`, to the contract in
 * documentation/hold-users-request-money.md (§1).
 *
 * A REQUEST IS A MESSAGE, NOT A PAYMENT
 *
 * Creating, declining, cancelling and reminding never sign anything and never
 * ask for a passkey or the phone. They write a row and put a bubble on
 * somebody's screen, with the session and nothing more. Only PAYING a request
 * moves money, and that goes the way every web payment goes: /wallet/send,
 * approved with the passkey or on the linked phone.
 *
 * ── SETTLING IS NOT PAYING ──
 *
 * `POST /requests/:id/settle` is called AFTER the money moved, with the
 * withdrawal's id as proof, and the server checks that proof: the payment went
 * from the payer to the requester's wallet and covers the amount. So nothing
 * here can mark a request paid on somebody's word.
 *
 * The rules that need neither React nor a network live in `request-rules.ts`,
 * where `request-rules.check.ts` runs them.
 */

import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";
import { getWithdrawal } from "@/lib/link/api";

import { HoldApiError, read } from "./hold-api";
import { toRequest, toRequests, type PaymentRequest } from "./request-rules";

export {
  describeRequestError,
  isOpen,
  remindAgainText,
  requestAmount,
  requestTag,
  requestsWith,
  theyAsked,
  webCanPay,
  type PaymentRequest,
  type RequestPerson,
  type RequestStatus,
} from "./request-rules";

/* ── Calls ────────────────────────────────────────────────────────── */

export async function listRequests(): Promise<PaymentRequest[]> {
  return toRequests(await read<unknown>("payments/requests?type=all&limit=100"));
}

/**
 * Ask `payerUserId` for `amount` of `tokenId` on `chain`.
 *
 * The body's `from` is the PAYER (the contract keeps the old name), and
 * `toUserId` is sent beside it so the server resolves the person by id and
 * never by a handle that could have changed hands.
 */
export async function askFor(args: {
  payerUserId: string;
  amount: string;
  tokenId: string;
  chain: string;
  note?: string | null;
}): Promise<{ requestId: string; status: "requested"; ts: number; request: PaymentRequest | null }> {
  const note = (args.note ?? "").trim();
  const r = await read<{ requestId: string; status: "requested"; ts: number; request?: unknown }>("payments/request", {
    json: {
      from: args.payerUserId,
      toUserId: args.payerUserId,
      tokenId: args.tokenId.toLowerCase(),
      chain: args.chain.toLowerCase(),
      amount: args.amount,
      account: "main",
      ...(note ? { note } : {}),
    },
  });
  return { ...r, request: toRequest(r?.request) };
}

/** "No." Only the payer can. No push: the requester sees `Declined` in the thread. */
export function rejectRequest(id: string): Promise<unknown> {
  return read(`payments/requests/${encodeURIComponent(id)}/reject`, { json: {} });
}

/** Taking back one you asked for. Only the requester can. */
export function cancelRequest(id: string): Promise<unknown> {
  return read(`payments/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** A friendly push to the payer. Once a day per request, otherwise `429 remind_too_soon {retryAt}`. */
export function remindRequest(id: string): Promise<unknown> {
  return read(`payments/requests/${encodeURIComponent(id)}/remind`, { json: {} });
}

/** What became of paying a request, once the money moved. */
export type SettleOutcome =
  | { kind: "settled" }
  /** Already closed: settled by an earlier try, or cancelled meanwhile. */
  | { kind: "closed" }
  /** The payment proves less than was asked; the request stays open. */
  | { kind: "short"; provenMinor: string | null; currency: string | null }
  /** The token paid can't be valued; the request stays open. */
  | { kind: "unknown" }
  /** The server couldn't match the payment to the request, or never saw it confirmed. */
  | { kind: "unproven" };

/**
 * After a send from the web confirmed: close the request with the withdrawal
 * as proof. The same shape as `recordSentPayment` in groups.ts, for the same
 * reasons:
 *
 *   GET /withdrawals/:id first, every time: that read is what checks the chain
 *   and moves the withdrawal from `submitted` to confirmed on the server, and
 *   the passkey path of Send never makes it. Without it the proof could read
 *   "not confirmed" for the whole minute.
 *
 *   not confirmed yet            asked again every 3 s for about a minute
 *   409 request_not_open         nothing to do: it is closed already
 *   422 transfer_amount_short    the payment covered less; the request stays
 *                                open and the screen says what was proven
 *   422 transfer_amount_unknown  the token can't be valued; it stays open
 *   422 proof_required, 400, not found, not to them
 *                                it stays open, and the screen says so
 *
 * Unlike a group there is no "payer's word" to fall back on: a request is
 * closed by proof or not at all, so the honest answer is that it stays open.
 */
export async function settleWithWithdrawal(requestId: string, withdrawalId: string): Promise<SettleOutcome> {
  const url = `payments/requests/${encodeURIComponent(requestId)}/settle`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    await getWithdrawal(withdrawalId).catch(() => undefined);
    try {
      await read(url, { json: { withdrawalId } });
      return { kind: "settled" };
    } catch (e) {
      if (!(e instanceof HoldApiError)) throw e;
      const why = e.detail ?? e.code;
      if (why === "request_not_open") return { kind: "closed" };
      if (why === "transfer_amount_short") {
        const proven = e.details?.provenMinor;
        const currency = e.details?.currency;
        return { kind: "short", provenMinor: typeof proven === "string" ? proven : null, currency: typeof currency === "string" ? currency : null };
      }
      if (why === "transfer_amount_unknown") return { kind: "unknown" };
      if (why === "transfer_not_confirmed" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (e.status === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (e.status === 400 || e.status === 404 || e.status === 409 || e.status === 422) return { kind: "unproven" };
      throw e;
    }
  }
}

/* ── Hooks ────────────────────────────────────────────────────────── */

/**
 * Every request this account raised or was sent, open and closed.
 *
 * Keyed by the person, like every other money hook, so signing out cannot
 * leave one account's requests in another's cache. One read for the whole
 * account and the threads filter it — a call per thread would be a request per
 * conversation on a screen that lists twenty.
 */
export function usePaymentRequests() {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<PaymentRequest[]>(uid ? ["payment-requests", uid] : null, listRequests, {
    revalidateOnFocus: true,
    focusThrottleInterval: 15_000,
    refreshInterval: 20_000,
    shouldRetryOnError: false,
  });
}

/**
 * A handle's Solana address, so Send can open with the person locked in.
 *
 * `GET /alias/resolve/:alias` is the app's own lookup and answers for a public
 * alias only. A private one, or a person who never chose a handle, 404s — and
 * Send then opens on its own first step rather than guessing, because the one
 * thing worse than typing an address is being handed the wrong one.
 */
export async function resolveHandle(handle: string): Promise<{ address: string; chain: string } | null> {
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  try {
    const r = await read<{ targetAddress?: string; targetChain?: string }>(`alias/resolve/${encodeURIComponent(clean)}`);
    return r?.targetAddress ? { address: r.targetAddress, chain: r.targetChain ?? "solana" } : null;
  } catch {
    return null;
  }
}
