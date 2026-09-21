"use client";

/**
 * Asking somebody for money: `/payments/request` and `/payments/requests/*`.
 *
 * WHY THIS IS THE ONE MONEY WRITE THE WEB CAN MAKE
 *
 * Every other money action needs a key, and the key is in the browser only
 * behind a passkey ceremony bound to one transaction. A request moves nothing.
 * It is a row that says "@alex asked you for 25 USDC" and a button on the
 * other person's screen. The money still leaves the way it always does —
 * their signature, their approval — so this can be written from here with no
 * more authority than a sentence needs.
 *
 * Which is why it was the honest gap on this screen. The thread had Send and
 * nothing beside it, and the app has had both since the beginning.
 *
 * ── WHAT THE SERVER CALLS THINGS, AND WHY IT READS BACKWARDS ──
 *
 * `POST /payments/request` takes `from`: the person the money is being asked
 * FROM. The row it writes has `fromUserId` = the caller (who asked) and
 * `toUserId` = that person (who is being asked). So on a row, "from" is the
 * asker and on the body, "from" is the payer. We take the body's word once,
 * here, and everything else in this file speaks in `asker` and `payer`.
 *
 * ── SETTLING IS NOT PAYING ──
 *
 * `POST /requests/:id/settle` only flips a status. It is called AFTER money
 * has moved by the usual road, and it is idempotent on purpose: by then the
 * payment is irreversible, so a retry must never read as a failure. The
 * server deleted its old `/accept` — which tried to send from a wallet it does
 * not hold — for exactly this reason.
 */

import useSWR from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { read } from "./hold-api";

/** The four the column's own CHECK allows. */
export type RequestStatus = "requested" | "pending" | "paid" | "cancelled";

/** A row of `payment_requests`, as `GET /payments/requests` hands it over. */
export interface PaymentRequest {
  id: string;
  /** Who asked. */
  fromUserId: string;
  /** Who was asked. Null when the request names a bare address instead. */
  toUserId: string | null;
  toAddress: string | null;
  tokenId: string;
  chain: string;
  amount: string;
  status: RequestStatus;
  createdAt: string;
}

/* ── Calls ────────────────────────────────────────────────────────── */

export function listRequests(): Promise<{ requests: PaymentRequest[]; total: number }> {
  return read("payments/requests?limit=100");
}

/**
 * Ask `payerUserId` for `amount`.
 *
 * The body's `from` is the PAYER — see the note at the top. A bare user id is
 * passed through as it is; the server looks it up and falls back to treating
 * an unknown string as an external address, which is not something this screen
 * ever wants, so only real peer ids reach here.
 */
export function askFor(args: {
  payerUserId: string;
  amount: string;
  tokenId?: string;
  chain?: string;
}): Promise<{ requestId: string; status: "requested"; ts: number }> {
  return read("payments/request", {
    json: {
      from: args.payerUserId,
      tokenId: (args.tokenId ?? "usdc").toLowerCase(),
      chain: args.chain ?? "solana",
      amount: args.amount,
      account: "main",
    },
  });
}

/** "I have paid this." After the money moved, never instead of it. */
export function settleRequest(id: string, proof?: { transferId?: string; txHash?: string }): Promise<{ settled: boolean }> {
  return read(`payments/requests/${encodeURIComponent(id)}/settle`, { json: proof ?? {} });
}

/** "No." The person who asked finds out; the app used to keep this on one phone. */
export function rejectRequest(id: string): Promise<{ rejected: boolean }> {
  return read(`payments/requests/${encodeURIComponent(id)}/reject`, { json: {} });
}

/** Withdrawing one you raised yourself. */
export function cancelRequest(id: string): Promise<{ cancelled: boolean }> {
  return read(`payments/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ── Hooks ────────────────────────────────────────────────────────── */

/**
 * Every request this account raised or was sent.
 *
 * Keyed by the person, like every other money hook, so signing out cannot
 * leave one account's requests in another's cache. One read for the whole
 * account and the threads filter it — a call per thread would be a request per
 * conversation on a screen that lists twenty.
 */
export function usePaymentRequests() {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<PaymentRequest[]>(
    uid ? ["payment-requests", uid] : null,
    async () => (await listRequests()).requests,
    { revalidateOnFocus: true, focusThrottleInterval: 15_000, shouldRetryOnError: false },
  );
}

/**
 * A handle's Solana address, so Pay can open Send already filled in.
 *
 * `GET /alias/resolve/:alias` is the app's own lookup and answers for a public
 * alias only. A private one, or a person who never chose a handle, 404s — and
 * Pay then opens Send empty rather than guessing, because the one thing worse
 * than typing an address is being handed the wrong one.
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

/* ── Reading the rows ─────────────────────────────────────────────── */

/**
 * The still-open requests between you and one person, oldest first.
 *
 * `peerId` is the whole filter and it is enough: a row in this thread has the
 * peer on exactly one of its two sides, and whichever side that is tells you
 * who is waiting on whom. There is no need to know your own id.
 *
 * Settled and cancelled rows are dropped. They are history, and a thread that
 * re-reads them on every poll would resurrect a closed bubble for ever.
 */
export function openRequestsWith(rows: PaymentRequest[] | undefined, peerId: string | null): PaymentRequest[] {
  if (!peerId) return [];
  return (rows ?? [])
    .filter((r) => r.status === "requested" && (r.fromUserId === peerId || r.toUserId === peerId))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** True when THEY asked YOU: the only direction that gets Pay and Decline. */
export function theyAsked(r: PaymentRequest, peerId: string): boolean {
  return r.fromUserId === peerId;
}

/**
 * The figure, as the row spells it.
 *
 * A row whose amount does not read as a positive number is not one a Pay
 * button can be drawn for, so `openRequestsWith`'s callers use this to drop it
 * rather than render "NaN USDC".
 */
export function requestAmount(r: PaymentRequest): number | null {
  const n = Number(String(r.amount ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
