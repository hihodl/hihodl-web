"use client";

/**
 * HOLD Partners, read and written from the web.
 *
 * Contract: the backend's /partners routes (feat/hold-partners). A partner is
 * a travel agency, a creator or an event organiser who brings travellers to
 * HOLD and earns a share of HOLD's margin on what those travellers book
 * (stays, flights, eSIMs), paid monthly in USDC into the partner's own HOLD
 * Savings. Every call is the person's Supabase bearer and nothing else, like
 * the rest of lib/app.
 *
 * A trip deposit is an ordinary pay link (POST /pay-links) pinned to the trip
 * with a PATCH. The create carries an Idempotency-Key, which the Worker in
 * front of the API allows (see lib/app/groups SEND_IDEMPOTENCY_HEADER).
 */

import useSWR, { type SWRConfiguration } from "swr";

import { useCreatorSession } from "@/lib/creator/session";

import { read } from "./hold-api";

/* ── What the server says ─────────────────────────────────────────── */

export type PartnerKind = "agency" | "creator" | "events" | "other";
export type PartnerStatus = "pending" | "active" | "paused";

export interface Partner {
  id: string;
  name: string;
  slug: string;
  previousSlugs: string[];
  kind: PartnerKind;
  instagram: string | null;
  website: string | null;
  status: PartnerStatus;
  /** 4000 = 40% of HOLD's margin. */
  shareBps: number;
  attributionMonths: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface PartnerMe {
  partner: Partner | null;
  link: string | null;
}

export type SlugProblem = "slug_too_short" | "slug_too_long" | "slug_reserved" | "slug_taken";

export interface SlugAnswer {
  slug: string;
  available: boolean;
  problem: SlugProblem | null;
}

export type BookingKind = "stay" | "flight" | "esim";
export type CommissionStatus = "pending" | "payable" | "paid" | "void";
export type PayoutStatus = "claimed" | "submitted" | "sent" | "failed";

export interface Commission {
  id: string;
  kind: BookingKind;
  bookedAt: string;
  /** Initials, "M. L.". */
  traveller: string;
  marginUsd: number;
  commissionUsdc: number;
  status: CommissionStatus;
  payableAfter: string;
}

export interface Payout {
  id: string;
  period: string;
  amountUsdc: number;
  status: PayoutStatus;
  txHash: string | null;
  sentAt: string | null;
}

export interface PartnerMonth {
  /** "2026-10". */
  month: string;
  signups: number;
  bookings: number;
  commissionUsdc: number;
}

export interface PartnerDashboard {
  partner: Partner;
  link: string;
  totals: { signups: number; travellers: number; bookings: number; pendingUsdc: number; payableUsdc: number; paidUsdc: number };
  /** The last six, oldest first. */
  months: PartnerMonth[];
  /** The newest fifty. */
  commissions: Commission[];
  payouts: Payout[];
  nextPayoutOn: string;
  payoutMinUsdc: number;
  payoutsEnabled: boolean;
}

export interface Trip {
  id: string;
  groupId: string;
  name: string;
  place: string | null;
  startsOn: string | null;
  endsOn: string | null;
  members: number;
  joinUrl: string;
  payLinkCode: string | null;
  payLinkUrl: string | null;
  createdAt: string;
}

/* ── Calls ────────────────────────────────────────────────────────── */

export const getPartnerMe = () => read<PartnerMe>("partners/me");

export const checkSlug = (slug: string, signal?: AbortSignal) =>
  read<SlugAnswer>(`partners/slug-available?${new URLSearchParams({ slug })}`, { signal });

export interface ApplyBody {
  name: string;
  slug: string;
  kind: PartnerKind;
  instagram?: string;
  website?: string;
}

export const applyAsPartner = (body: ApplyBody) => read<PartnerMe>("partners/apply", { json: body });

export const updatePartner = (body: { name?: string; slug?: string; instagram?: string; website?: string }) =>
  read<PartnerMe>("partners/me", { method: "PATCH", json: body });

export const getPartnerDashboard = () => read<PartnerDashboard>("partners/me/dashboard");

export const listTrips = () => read<{ trips: Trip[] }>("partners/me/trips");

export const createTrip = (body: { name: string; place?: string; startsOn?: string; endsOn?: string }) =>
  read<{ trip: Trip }>("partners/me/trips", { json: body });

export const updateTrip = (
  id: string,
  body: { name?: string; place?: string; startsOn?: string; endsOn?: string; payLinkCode?: string | null },
) => read<{ trip: Trip }>(`partners/me/trips/${encodeURIComponent(id)}`, { method: "PATCH", json: body });

/** A client key, 10 to 128 characters. */
function idempotencyKey(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return rand;
}

/**
 * The trip's deposit: a reusable pay link at a fixed price, on every chain the
 * server takes today, pinned to the trip. Two calls; if the second fails the
 * link exists unpinned, and trying again makes a new one (a new key per tap),
 * which is why the trip is only patched with a link this tap just made.
 */
export async function createTripDeposit(trip: Pick<Trip, "id" | "name">, cents: number): Promise<Trip> {
  const { availableChains } = await read<{ availableChains: string[] }>("pay-links/chains");
  if (!availableChains?.length) throw Object.assign(new Error("chain_unavailable"), { code: "chain_unavailable" });
  const { link } = await read<{ link: { code: string } }>("pay-links", {
    json: {
      title: `${trip.name} deposit`.slice(0, 80),
      amount: { mode: "fixed", cents },
      use: "reusable",
      chains: availableChains,
    },
    headers: { "Idempotency-Key": idempotencyKey() },
  });
  const { trip: next } = await updateTrip(trip.id, { payLinkCode: link.code });
  return next;
}

/* ── Hooks ────────────────────────────────────────────────────────── */

const OPTIONS: SWRConfiguration = { revalidateOnFocus: true, focusThrottleInterval: 30_000, errorRetryCount: 2 };

function useUid(): string | null {
  const { session } = useCreatorSession();
  return session?.user?.id ?? null;
}

export function usePartnerMe() {
  const uid = useUid();
  return useSWR<PartnerMe>(uid ? ["partners", uid, "me"] : null, getPartnerMe, OPTIONS);
}

export function usePartnerDashboard(enabled: boolean) {
  const uid = useUid();
  return useSWR<PartnerDashboard>(uid && enabled ? ["partners", uid, "dashboard"] : null, getPartnerDashboard, OPTIONS);
}

export function usePartnerTrips(enabled: boolean) {
  const uid = useUid();
  return useSWR<Trip[]>(
    uid && enabled ? ["partners", uid, "trips"] : null,
    async () => (await listTrips()).trips ?? [],
    OPTIONS,
  );
}

/* ── Rules the screens share ──────────────────────────────────────── */

/** The backend's own normalisation: lowercase letters and digits only. */
export function normaliseSlug(raw: string): string {
  return raw.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

export const SLUG_MIN = 3;
export const SLUG_MAX = 20;

/** "hihodl.xyz/invite/dreamlife": the link as people read it. */
export function linkText(slug: string): string {
  return `hihodl.xyz/invite/${slug || "yourname"}`;
}

/** What a refusal means, in a line that says what to do. */
export function partnerErrorText(e: unknown): string {
  const code = (e as { code?: unknown; detail?: unknown })?.code;
  const detail = (e as { detail?: unknown })?.detail;
  const c = typeof code === "string" ? code : "";
  const d = typeof detail === "string" ? detail : "";
  const key = [c, d].find((k) => k in MESSAGES) ?? c;
  return MESSAGES[key] ?? "That did not go through. Try again in a moment.";
}

const MESSAGES: Record<string, string> = {
  slug_too_short: `Your link name needs at least ${SLUG_MIN} letters or numbers.`,
  slug_too_long: `Your link name can be at most ${SLUG_MAX} letters or numbers.`,
  slug_reserved: "That link name is kept for HOLD. Pick another one.",
  slug_taken: "Someone already has that link name. Pick another one.",
  name_required: "Add the name travellers know you by.",
  already_partner: "You already applied. Reload the page to see where it stands.",
  not_a_partner: "This account is not a partner yet.",
  partner_not_active: "Trips open once your partner account is active.",
  pay_link_not_yours: "That pay link belongs to another account.",
  handle_required: "Pick a HOLD username in the app first, then come back here. Deposit links are paid to your username.",
  account_too_new: "Your HOLD account is too new to collect payments. Try again in a few days.",
  too_many_links: "You made the most pay links allowed for today. Try again tomorrow.",
  amount_out_of_range: "That amount is outside what a pay link can take.",
  text_not_allowed: "The trip name cannot be used on a pay link. Rename the trip and try again.",
  receiver_not_ready: "Your HOLD account is not ready to receive on that network yet. Open the app once and try again.",
  chain_unavailable: "Payments are paused for a moment. Try again shortly.",
  NETWORK: "You look offline. Check your connection and try again.",
  UNAUTHORIZED: "Your session ended. Sign in again.",
};

/** "$1,234.56" from dollars. */
export function usd(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "Oct 2026" from "2026-10". */
export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", short ? { month: "short", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "13 Oct 2026" from an ISO date or "YYYY-MM-DD". */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = plain ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // A calendar day is the same day everywhere; a moment is read in the viewer's zone.
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(plain ? { timeZone: "UTC" } : {}) });
}
