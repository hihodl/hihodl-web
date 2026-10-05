/**
 * The business console's calls: profile, treasury and its 72 hour guard,
 * the enquiry inbox and quotes, invoices and the sales CSV, the activity log.
 *
 * Every route is the signed-in account's own unless it says otherwise:
 * `/business/activity-log` takes `?asBusiness=<owner>` for a manager, and
 * the enquiry inbox lists every owner the caller works for by itself. The
 * backend router answers the browser (`holdWebAuthedCors`), and the calls go
 * through `read` (./hold-api) like the rest of the product: bearer token,
 * envelope unwrapped, refusals as `HoldApiError` with the server's code.
 *
 * WHAT THE WEB CANNOT DO HERE
 *
 * Create, link and remove a treasury each need a fresh signature by the
 * person's HOLD Solana key (the step-up), and that key lives on the phone.
 * The web has no way to ask the phone to sign words (the phone approvals are
 * payments built by the server, documentation/one-wallet-every-device.md), so
 * those three are sent to the app. Cancelling a pending change needs no
 * step-up and works here, which is the half a desk needs most: the person who
 * is told can stop it from wherever they are.
 */

"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";

import { API_BASE } from "@/lib/ad-space/config";
import type { QuoteView } from "@/lib/ad-space/types";
import { accessToken, useCreatorSession } from "@/lib/creator/session";

import { HoldApiError, read } from "./hold-api";

/* ── Shapes (the contracts', field for field) ─────────────────────── */

export interface Billing {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  taxId: string | null;
  email: string | null;
}

export interface BusinessProfile {
  displayName: string;
  legalName: string | null;
  logoUrl: string | null;
  website: string | null;
  billing: Billing;
  verification: { status: "verified" | "unverified"; via: "x_business" | "ops" | null };
  invoicing?: { prefix: string | null; taxNote: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryMember {
  address: string;
  kind?: "hold_user" | "external";
  userId: string | null;
  isYou?: boolean;
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  label?: string | null;
}

export interface TreasuryPayment {
  orderId: string;
  spaceId: string;
  priceBase: string;
  txSignature: string | null;
  paidAt: string | null;
  status: string;
}

export interface Treasury {
  id: string;
  status: "active" | "scheduled" | string;
  source: "created" | "linked";
  multisigAddress: string;
  vaultIndex: number;
  vaultAddress: string;
  createdAt: string;
  confirmedAt: string | null;
  live?: boolean;
  threshold: number;
  autonomous?: boolean | null;
  members: TreasuryMember[];
  usdcBalanceBase?: string | null;
  payments?: TreasuryPayment[];
}

export interface TreasuryChange {
  id: string;
  action: "replace" | "remove";
  status: "pending" | "cancelled" | "applied" | "void";
  fromTreasuryId: string | null;
  toTreasuryId: string | null;
  requestedBy: string;
  requestedAt: string;
  effectiveAt: string;
  cancelledAt: string | null;
  appliedAt: string | null;
  canCancel: boolean;
  to?: Treasury | null;
}

export interface TreasuryAnswer {
  treasury: Treasury | null;
  pendingChange?: TreasuryChange | null;
}

export interface MemberChallenge {
  address: string;
  nonce: string;
  message: string;
  expiresInMinutes: number;
}

/** One quote shape for the seller console and the buyer thread. */
export type { QuoteView } from "@/lib/ad-space/types";

export interface EnquiryRow {
  enquiryId: string;
  channel: "app" | "web";
  space: { id: string; title: string };
  position: { id: string; label: string } | null;
  asker: { userId: string | null; name: string; company: string | null; handle: string | null };
  lastBody: string;
  lastFromAsker: boolean;
  lastAt: string;
  unread: number;
  myRole: "owner" | "manager" | "rep";
  canReply: boolean;
  canQuote?: boolean;
  archivedAt?: string | null;
}

export interface ThreadMessage {
  id: string;
  author: "asker" | "business";
  body: string;
  sentBy: { userId: string; name: string } | null;
  opening?: { positionId: string | null } | null;
  hasMedia?: boolean;
  createdAt: string;
  quote?: QuoteView | null;
}

export interface EnquiryThread {
  enquiryId: string;
  channel: "app" | "web";
  space: { id: string; title: string };
  position: { id: string; label: string } | null;
  asker: { userId: string | null; name: string; company: string | null; email: string | null; handle: string | null };
  business: { ownerUserId: string; name: string };
  myRole: "owner" | "manager" | "rep" | "asker";
  canReply: boolean;
  canQuote?: boolean;
  archivedAt?: string | null;
  guestSeenAt: string | null;
  messages: ThreadMessage[];
  quotes?: QuoteView[];
}

export interface InvoiceRow {
  orderId: string;
  kind: "invoice" | "receipt";
  number: string;
  issuedAt: string;
  paidAt: string | null;
  buyer: { name: string | null; taxId: string | null; country: string | null } | null;
  description: string;
  totalUsdc: string;
  feeUsdc: string;
  feePaidBy: "buyer" | "seller";
  chain: string;
  txSignature: string | null;
  emailed: { buyer: boolean; seller: boolean };
}

export interface ActivityEvent {
  id: string;
  at: string;
  actor: { userId: string; role: "owner" | "manager" | "rep" | string; name: string | null };
  action: string;
  target: { kind: string; id: string | null } | null;
  spaceId: string | null;
  summary: unknown;
}

/* ── Profile ─────────────────────────────────────────────────────── */

export const getBusiness = () => read<{ profile: BusinessProfile | null }>("business");

export interface ProfileInput {
  displayName: string;
  legalName: string | null;
  website: string | null;
  billing: Billing;
  invoiceTaxNote: string | null;
}

export const saveBusiness = (body: ProfileInput) => read<{ profile: BusinessProfile }>("business", { method: "PUT", json: body });

/** PNG or JPEG, up to 3 MB, as raw bytes (WebP is refused: logos are drawn on X cards). */
export const uploadLogo = (file: Blob) => read<{ profile: BusinessProfile }>("business/logo", { raw: file });

/* ── Treasury ────────────────────────────────────────────────────── */

export const getTreasury = () => read<TreasuryAnswer>("business/treasury");

export const getChange = (id: string) => read<{ change: TreasuryChange }>(`business/treasury/changes/${encodeURIComponent(id)}`);

export const cancelChange = (id: string) =>
  read<{ change: TreasuryChange }>(`business/treasury/changes/${encodeURIComponent(id)}/cancel`, { json: {} });

/** The words an outside address (a CFO's Ledger) signs to be named a member. Valid 30 minutes. */
export const memberChallenge = (address: string) => read<MemberChallenge>("business/treasury/members/challenge", { json: { address } });

/* ── Enquiries and quotes ────────────────────────────────────────── */

export type ArchivedFilter = "exclude" | "include" | "only";

export function listEnquiries(o: { spaceId?: string | null; archived?: ArchivedFilter } = {}) {
  const q = new URLSearchParams({ box: "business", limit: "200" });
  if (o.spaceId) q.set("spaceId", o.spaceId);
  if (o.archived && o.archived !== "exclude") q.set("archived", o.archived);
  return read<{ enquiries: EnquiryRow[]; unread: number }>(`ad-space/enquiries?${q}`);
}

export const getEnquiry = (id: string) => read<{ enquiry: EnquiryThread }>(`ad-space/enquiries/${encodeURIComponent(id)}`);

export const markEnquiryRead = (id: string) => read<{ ok: boolean }>(`ad-space/enquiries/${encodeURIComponent(id)}/read`, { json: {} });

export const replyToEnquiry = (id: string, message: string) =>
  read<{ message: ThreadMessage | null }>(`ad-space/enquiries/${encodeURIComponent(id)}/reply`, { json: { message } });

export const sendQuote = (id: string, body: { positionId: string; priceCents: number; note?: string; expiresInDays: number }) =>
  read<{ quote: QuoteView | null; message: ThreadMessage | null }>(`ad-space/enquiries/${encodeURIComponent(id)}/quotes`, { json: body });

export const withdrawQuote = (quoteId: string) =>
  read<{ quote: QuoteView }>(`ad-space/quotes/${encodeURIComponent(quoteId)}/withdraw`, { json: {} });

export const setArchived = (id: string, archived: boolean) =>
  read<{ archivedAt: string | null }>(`ad-space/enquiries/${encodeURIComponent(id)}/${archived ? "archive" : "unarchive"}`, { json: {} });

/* ── Invoices and the CSV ────────────────────────────────────────── */

export function listInvoices(before?: string | null) {
  const q = new URLSearchParams({ limit: "50" });
  if (before) q.set("before", before);
  return read<{ documents: InvoiceRow[] }>(`business/invoices?${q}`);
}

export const invoicePdf = (orderId: string) =>
  read<{ number: string; kind: string; url: string; expiresInSeconds: number }>(`business/invoices/${encodeURIComponent(orderId)}/pdf`);

/**
 * The sales CSV, as a file the browser saves. Not through `read`: the answer
 * is text/csv, and only a refusal is JSON.
 */
export async function downloadSalesCsv(from: string, to: string): Promise<void> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/business/sales.csv?${new URLSearchParams({ from, to })}`, {
      headers: { authorization: `Bearer ${token}`, accept: "text/csv, application/json" },
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new HoldApiError("NETWORK", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new HoldApiError(body?.error?.code ?? `HTTP_${res.status}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hold-sales-${from}-to-${to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ── Activity log ────────────────────────────────────────────────── */

export function listActivity(o: { asBusiness?: string | null; cursor?: string | null; spaceId?: string | null; actor?: string | null; action?: string | null }) {
  const q = new URLSearchParams({ limit: "50" });
  if (o.asBusiness) q.set("asBusiness", o.asBusiness);
  if (o.cursor) q.set("cursor", o.cursor);
  if (o.spaceId) q.set("spaceId", o.spaceId);
  if (o.actor) q.set("actor", o.actor);
  if (o.action) q.set("action", o.action);
  return read<{ events: ActivityEvent[]; nextCursor: string | null }>(`business/activity-log?${q}`);
}

/* ── Reads, cached per person ────────────────────────────────────── */

const OPTIONS = { revalidateOnFocus: true, focusThrottleInterval: 30_000, shouldRetryOnError: false, dedupingInterval: 10_000 };

function useBusinessRead<T>(name: string | null, fetcher: () => Promise<T>, extra = "") {
  const { session } = useCreatorSession();
  const uid = session?.user?.id ?? null;
  return useSWR<T>(uid && name ? ["business", uid, name, extra] : null, fetcher, OPTIONS);
}

export const useBusinessProfile = () => useBusinessRead("profile", getBusiness);
export const useTreasury = (on = true) => useBusinessRead(on ? "treasury" : null, getTreasury);
export const useChange = (id: string | null) => useBusinessRead(id ? "change" : null, () => getChange(id!), id ?? "");
export const useEnquiries = (spaceId: string | null, archived: ArchivedFilter) =>
  useBusinessRead("enquiries", () => listEnquiries({ spaceId, archived }), `${spaceId ?? ""}:${archived}`);
export const useEnquiry = (id: string | null) => useBusinessRead(id ? "enquiry" : null, () => getEnquiry(id!), id ?? "");
export const useInvoices = (on = true) => useBusinessRead(on ? "invoices" : null, () => listInvoices());

/** Re-read the named business reads (after a save, a reply, a cancel). */
export function useBusinessRefresh(): (...names: string[]) => Promise<unknown> {
  const { mutate } = useSWRConfig();
  return useCallback(
    (...names: string[]) =>
      mutate((key) => Array.isArray(key) && key[0] === "business" && (names.length === 0 || names.includes(key[2] as string))),
    [mutate],
  );
}
