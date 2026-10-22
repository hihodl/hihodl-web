"use client";

/**
 * HOLD Partners, read and written from the web.
 *
 * Contract: the backend's /partners routes (feat/hold-partners,
 * documentation/hold-partners-2026-10-13.md). A partner is an organisation
 * (travel agency, creator, event organiser) with a team: every person on it
 * signs in with their own HOLD account, made in the app, and is paid into its
 * own Savings. Every call is the person's Supabase bearer and nothing else,
 * like the rest of lib/app.
 *
 * Every number is the server's, read from the commission and payout ledgers,
 * never from a balance: what a partner earned stays what it was after they
 * spend it. Lists are cursor paginated and filtered on the server, and each
 * exports to CSV with the same filters.
 *
 * A trip deposit is an ordinary pay link (POST /pay-links) pinned to the trip
 * with a PATCH. The create carries an Idempotency-Key, which the Worker in
 * front of the API allows (see lib/app/groups SEND_IDEMPOTENCY_HEADER).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { API_BASE } from "@/lib/ad-space/config";
import { accessToken, useCreatorSession } from "@/lib/creator/session";

import { HoldApiError, read } from "./hold-api";

/* ── What the server says ─────────────────────────────────────────── */

export type PartnerKind = "agency" | "creator" | "events" | "other";
export type PartnerStatus = "pending" | "active" | "paused";
export type Role = "owner" | "admin" | "member";
export type PayoutMode = "owner" | "split";
export type Scope = "team" | "me";

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
  /** Part of that share given back to the travellers it brings, as a discount at their checkout. 5000 = half. */
  giveBackBps?: number;
  /** Public URL of the partner's logo, drawn small next to its name. null = the name alone. */
  logoUrl?: string | null;
  attributionMonths: number;
  payoutMode: PayoutMode;
  createdAt: string;
  approvedAt: string | null;
}

export interface Me {
  memberId: string;
  role: Role;
  splitBps: number;
  joinedAt: string;
}

export interface PartnerLink {
  /** null for the partner's own slug. */
  id: string | null;
  code: string;
  url: string;
  label: string | null;
  main: boolean;
  memberId: string;
  memberName: string | null;
  mine: boolean;
  visits: number;
  signups: number;
  bookings: number;
  commissionUsdc: number;
  /** What the link took off its travellers' bookings, in dollars. Never paid to the partner. */
  givenBackUsdc?: number;
  /** How many people the link may bring (a use is a signup). null = no limit. */
  maxUses?: number | null;
  /** When the link can be entered: from midnight UTC on validFrom to (not including) validUntil. */
  validFrom?: string | null;
  validUntil?: string | null;
  /** What it gives back now, basis points of the partner's share. */
  giveBackBps?: number;
  /** false = it follows the partner's own give back. */
  ownGiveBack?: boolean;
  state?: LinkState;
  archived: boolean;
  createdAt: string;
}

/** What a person entering the link today meets. */
export type LinkState = "open" | "not_started" | "ended" | "full";

/** What a link create or edit sets. Dates are "YYYY-MM-DD"; until is inclusive. giveBackBps null = same as the partner. */
export interface LinkLimits {
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  giveBackBps?: number | null;
}

export interface PartnerMe {
  partner: Partner | null;
  me: Me | null;
  link: string | null;
  links: PartnerLink[];
  /** Not on a team (any more): how many payouts were paid to them, which they can still read. */
  pastPayouts?: number;
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
export type BillingState = "missing" | "submitted" | "verified";

export interface PartnerMonth {
  /** "2026-10". */
  month: string;
  signups: number;
  bookings: number;
  commissionUsdc: number;
}

export interface PartnerDashboard {
  scope: Scope;
  partner: Partner;
  me: Me;
  link: string;
  totals: {
    visits: number;
    signups: number;
    travellers: number;
    bookings: number;
    conversion: number;
    earnedUsdc: number;
    /** Commission these travellers made for the whole team. Equals earnedUsdc in team scope. */
    generatedUsdc: number;
    pendingUsdc: number;
    payableUsdc: number;
    paidUsdc: number;
    receivedUsdc: number;
    /** Taken off these travellers' prices at checkout. Not paid to the partner. */
    givenBackUsdc?: number;
  };
  mine: { earnedUsdc: number; payableUsdc: number; receivedUsdc: number };
  byProduct: { kind: BookingKind; bookings: number; commissionUsdc: number }[];
  /** The last twelve, oldest first. */
  months: PartnerMonth[];
  nextPayoutOn: string;
  payoutMinUsdc: number;
  payoutsEnabled: boolean;
  billing: BillingState;
}

/** One booking (a clawback is its own row), however many cuts it was split into. */
export interface Commission {
  id: string;
  kind: BookingKind;
  bookedAt: string;
  /** A name when the traveller is in one of your trips, else initials. */
  traveller: string;
  memberName: string | null;
  linkCode: string | null;
  marginUsd: number;
  shareBps: number;
  /** What the booking earned the team, every cut. */
  commissionUsdc: number;
  /** The part paid to you. 0 when none of it is yours. */
  mineUsdc: number;
  /** The member's cut in split mode, else 0. */
  memberUsdc: number;
  /** Taken off the traveller's price at checkout, out of the partner's share. */
  givenBackUsdc?: number;
  status: CommissionStatus;
  payableAfter: string;
  clawback: boolean;
  voidReason: string | null;
}

export interface Traveller {
  id: string;
  name: string;
  named: boolean;
  joinedAt: string;
  attributedUntil: string;
  source: "link" | "group";
  linkCode: string | null;
  memberName: string | null;
  trips: string[];
  products: BookingKind[];
  bookings: number;
  commissionUsdc: number;
  lastBookedAt: string | null;
}

export interface Payout {
  id: string;
  period: string;
  amountUsdc: number;
  /** What was sent. Commissions are counted in dollars; a euro payout is converted on the payout day. */
  currency?: "USD" | "EUR";
  amountPaid?: number;
  fxRate?: number | null;
  /** The self-billed invoice number (HP-2026-000042), the payee's own sent payouts only. */
  statementNo?: string | null;
  payee: string;
  status: PayoutStatus;
  txHash: string | null;
  toAddress: string | null;
  failureReason: null | "no_savings_address" | "billing_not_verified" | "retrying_next_month";
  commissions: number;
  clawbacks: number;
  createdAt: string;
  sentAt: string | null;
  statement: boolean;
}

export interface Trip {
  id: string;
  groupId: string;
  name: string;
  place: string | null;
  startsOn: string | null;
  endsOn: string | null;
  memberId: string | null;
  runBy: string | null;
  members: number;
  /** Null in lists, and when the link cannot be made (the trip page says so). */
  joinUrl: string | null;
  payLinkCode: string | null;
  payLinkUrl: string | null;
  createdAt: string;
  /** ISO-2 country the trip goes to (where its welcome eSIM works). Missing until the server sends it. */
  countryCode?: string | null;
  /** Agencies: how many travellers get the welcome eSIM (the first N who join by the link). Missing until the server sends it. */
  maxTravellers?: number | null;
  /** Agencies: the 1 GB welcome eSIM travellers of this trip get. Missing until the server sends it. */
  welcome?: TripWelcome | null;
}

/**
 * A seat is given when a traveller JOINS by the trip link (the first
 * `maxTravellers`); the eSIM is claimed when they install it in the app.
 * Every count is optional: older servers send fewer of them.
 */
export interface TripWelcome {
  /** False: this trip gives no welcome eSIM, and the desk says nothing about it. */
  offered: boolean;
  /** Seats the trip holds (its maxTravellers). */
  seats?: number | null;
  /** Seats taken: travellers who joined by the link while seats were left. */
  taken?: number | null;
  /** Welcome eSIMs installed. */
  claimed?: number | null;
  /** Seats minus taken; null when not offered. */
  left?: number | null;
}

let regionNames: Intl.DisplayNames | null | undefined;

/** "Indonesia" from "ID"; null when there is no code or it is not a country. */
export function countryName(code: string | null | undefined): string | null {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return null;
  try {
    if (regionNames === undefined) regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const name = regionNames?.of(code.toUpperCase());
    return name && name.toUpperCase() !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
}

/** The most travellers a trip can hold seats for. */
export const TRIP_TRAVELLERS_MAX = 500;

/** Most people one link can be limited to (the backend's MAX_CODE_USES). */
export const MAX_LINK_USES = 100_000;

export interface TripRow extends Trip {
  bookings: number;
  commissionUsdc: number;
  depositsPaid: number;
  collectedUsdc: number;
}

export type DepositState = "paid" | "partial" | "unpaid" | "team";

export interface TripDetail {
  trip: Trip;
  deposit: { perTravellerUsd: number | null; title: string; payLinkUrl: string | null } | null;
  totals: {
    members: number;
    paid: number;
    partial: number;
    unpaid: number;
    collectedUsdc: number;
    expectedUsdc: number | null;
    unmatched: { payments: number; usdc: number };
    bookings: number;
    commissionUsdc: number;
  };
  people: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    joinedAt: string | null;
    team: boolean;
    broughtByYou: boolean;
    deposit: { state: DepositState; paidUsdc: number; paidAt: string | null };
    bookings: number;
    commissionUsdc: number;
  }[];
}

export interface TeamMember {
  memberId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  role: Role;
  splitBps: number;
  status: "active" | "removed";
  joinedAt: string;
  removedAt: string | null;
  isMe: boolean;
  signups: number;
  bookings: number;
  broughtUsdc: number;
  earnedUsdc: number;
  receivedUsdc: number;
  billing: BillingState;
}

export interface Invite {
  id: string;
  /** Null on an admin invite for anyone but the owner: only the owner hands out admin. */
  code: string | null;
  url: string | null;
  role: "admin" | "member";
  splitBps: number;
  email: string | null;
  status: "open" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface InviteInfo {
  partner: { name: string; slug: string; kind: PartnerKind; active: boolean };
  role: "admin" | "member";
  splitBps: number;
  invitedBy: string | null;
  /** Set when the invite is for one email only, masked ("m***@agency.com"). */
  forEmail?: string | null;
  status: Invite["status"];
  expiresAt: string;
}

export interface Billing {
  entity: "company" | "individual";
  legalName: string;
  taxId: string | null;
  vatId: string | null;
  address: string;
  country: string;
  email: string;
  /** What payouts are sent in: dollars as USDC, euros as EURC. Changing only this keeps the check. */
  payoutCurrency: "USD" | "EUR";
  verified: boolean;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface Page<T> {
  scope: Scope;
  items: T[];
  nextCursor: string | null;
  total?: { count?: number; commissionUsdc?: number; mineUsdc?: number; sentUsdc?: number };
}

/* ── Calls ────────────────────────────────────────────────────────── */

const enc = encodeURIComponent;

export const getPartnerMe = () => read<PartnerMe>("partners/me");

export const checkSlug = (slug: string, signal?: AbortSignal) =>
  read<SlugAnswer>(`partners/slug-available?${new URLSearchParams({ slug })}`, { signal });

export interface ApplyBody {
  name: string;
  slug: string;
  kind: PartnerKind;
  instagram?: string;
  website?: string;
  /** Ticked "I agree to the HOLD Partners terms". The server refuses without it. */
  acceptTerms: true;
}

/** The terms every person on a team accepts (PARTNER_TERMS_VERSION on the server). */
export const PARTNER_TERMS_URL = "https://hihodl.xyz/legal/partner-terms";

export const applyAsPartner = (body: ApplyBody) => read<PartnerMe>("partners/apply", { json: body });

export const updatePartner = (body: { name?: string; slug?: string; instagram?: string; website?: string; giveBackBps?: number }) =>
  read<PartnerMe>("partners/me", { method: "PATCH", json: body });

/** Image types the logo upload takes, and its size cap (the backend checks both again, by the bytes). */
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 3 * 1024 * 1024;

/** The owner's logo: the raw file as the body with its own Content-Type, never multipart. */
export const uploadPartnerLogo = (file: Blob) => read<PartnerMe>("partners/me/logo", { raw: file });
export const removePartnerLogo = () => read<PartnerMe>("partners/me/logo", { method: "DELETE" });

export const getPartnerDashboard = (scope: Scope) => read<PartnerDashboard>(`partners/me/dashboard?scope=${scope}`);

export const getTripDetail = (id: string) => read<TripDetail>(`partners/me/trips/${enc(id)}`);

export const createTrip = (body: { name: string; place?: string; startsOn?: string; endsOn?: string; maxTravellers?: number | null; countryCode?: string | null }) =>
  read<{ trip: Trip }>("partners/me/trips", { json: body });

export const updateTrip = (
  id: string,
  body: { name?: string; place?: string; startsOn?: string; endsOn?: string; payLinkCode?: string | null; maxTravellers?: number | null; countryCode?: string | null },
) => read<{ trip: Trip }>(`partners/me/trips/${enc(id)}`, { method: "PATCH", json: body });

export const listLinks = (scope: Scope) => read<{ links: PartnerLink[] }>(`partners/me/links?scope=${scope}`);
export const createLink = (body: { code: string; label?: string; memberId?: string } & LinkLimits) =>
  read<{ link: { id: string; code: string; url: string } }>("partners/me/links", { json: body });
export const updateLink = (id: string, body: { label?: string | null; archived?: boolean } & LinkLimits) =>
  read<{ link: unknown }>(`partners/me/links/${enc(id)}`, { method: "PATCH", json: body });

export const listTeam = () => read<{ members: TeamMember[] }>("partners/me/team");
export const updateMember = (memberId: string, body: { role?: "admin" | "member"; splitBps?: number }) =>
  read<{ member: TeamMember }>(`partners/me/team/${enc(memberId)}`, { method: "PATCH", json: body });
/** What happened to the trips of somebody leaving: moved to the owner; `needsAttention` are trips whose chat could not be handed over. */
export interface TripsHandOver {
  moved: number;
  needsAttention: string[];
}

export const removeMember = (memberId: string) =>
  read<{ removed: boolean; trips?: TripsHandOver }>(`partners/me/team/${enc(memberId)}`, { method: "DELETE" });
export const transferOwner = (memberId: string) => read<PartnerMe>(`partners/me/team/${enc(memberId)}/owner`, { json: {} });
export const leaveTeam = () => read<{ left: boolean; trips?: TripsHandOver }>("partners/me/leave", { json: {} });
export const setPayoutMode = (mode: PayoutMode) => read<{ payoutMode: PayoutMode }>("partners/me/payout-mode", { method: "PUT", json: { mode } });

export const listInvites = () => read<{ invites: Invite[] }>("partners/me/invites");
export const createInvite = (body: { role: "admin" | "member"; splitBps?: number; email?: string }) =>
  read<{ invite: Invite }>("partners/me/invites", { json: body });
export const revokeInvite = (id: string) => read<{ revoked: boolean }>(`partners/me/invites/${enc(id)}`, { method: "DELETE" });
export const describeInvite = (code: string) => read<InviteInfo>(`partners/invites/${enc(code)}`);
export const acceptInvite = (code: string, linkCode?: string) =>
  read<PartnerMe & { joined: boolean; link: string | null }>(`partners/invites/${enc(code)}/accept`, {
    json: linkCode ? { linkCode, acceptTerms: true } : { acceptTerms: true },
  });

export const getBilling = () => read<{ billing: Billing | null }>("partners/me/billing");
export const saveBilling = (body: Omit<Billing, "verified" | "verifiedAt" | "updatedAt">) =>
  read<{ billing: Billing }>("partners/me/billing", { method: "PUT", json: body });

/** A client key, 10 to 128 characters. */
function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
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

/** "hold-partners-commissions.csv" → "hold-partners-commissions-2026-10-13.csv". */
export function datedName(name: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}-${day}${name.slice(dot)}` : `${name}-${day}`;
}

/** A trip's name as a file name piece: "Morocco May!" → "morocco-may". */
export function fileSlug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 40) || "trip";
}

/**
 * A CSV or a PDF from the API, saved by the browser. Same bearer as every
 * read; the file never touches anything but this tab.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new HoldApiError("NETWORK", 0);
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    try {
      code = ((await res.json()) as { error?: { code?: string } })?.error?.code ?? code;
    } catch {
      /* not JSON */
    }
    throw new HoldApiError(code, res.status);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  // The edge does not pass content-disposition through, so the name is usually
  // built here: the fallback with today's date, so exports never overwrite.
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? datedName(fallbackName);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** "a=1&b=2" from the filters that are set. */
export function queryOf(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return q.toString();
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

export function usePartnerDashboard(enabled: boolean, scope: Scope) {
  const uid = useUid();
  return useSWR<PartnerDashboard>(uid && enabled ? ["partners", uid, "dashboard", scope] : null, () => getPartnerDashboard(scope), OPTIONS);
}

export function useTripDetail(id: string | null) {
  const uid = useUid();
  return useSWR<TripDetail>(uid && id ? ["partners", uid, "trip", id] : null, () => getTripDetail(id!), OPTIONS);
}

/** A trip's id and name, for filter menus. */
export interface TripName {
  id: string;
  name: string;
}

/** Every trip's name in the scope (up to 500), one cheap read: the filters' menu. */
export function useTripNames(enabled: boolean, scope: Scope) {
  const uid = useUid();
  return useSWR<TripName[]>(
    uid && enabled ? ["partners", uid, "trip-names", scope] : null,
    async () => (await read<{ items: TripName[] }>(`partners/me/trips/names?${new URLSearchParams({ scope })}`)).items,
    OPTIONS,
  );
}

export function useLinks(enabled: boolean, scope: Scope) {
  const uid = useUid();
  return useSWR<PartnerLink[]>(uid && enabled ? ["partners", uid, "links", scope] : null, async () => (await listLinks(scope)).links, OPTIONS);
}

export function useTeam(enabled: boolean) {
  const uid = useUid();
  return useSWR<TeamMember[]>(uid && enabled ? ["partners", uid, "team"] : null, async () => (await listTeam()).members, OPTIONS);
}

export function useInvites(enabled: boolean) {
  const uid = useUid();
  return useSWR<Invite[]>(uid && enabled ? ["partners", uid, "invites"] : null, async () => (await listInvites()).invites, OPTIONS);
}

export function useBilling(enabled: boolean) {
  const uid = useUid();
  return useSWR<Billing | null>(uid && enabled ? ["partners", uid, "billing"] : null, async () => (await getBilling()).billing, OPTIONS);
}

export interface Paged<T> {
  items: T[];
  total: Page<T>["total"] | null;
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/**
 * A server paginated list: the first page for these filters, then "Load
 * more" appends the next one by cursor. Changing a filter starts over.
 */
export function usePaged<T>(path: string, params: Record<string, string | null | undefined>, enabled = true): Paged<T> {
  const uid = useUid();
  const q = queryOf(params);
  const key = uid && enabled ? `${path}?${q}` : null;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string | null; items: T[]; next: string | null; total: Page<T>["total"] | null; loading: boolean; more: boolean; error: unknown }>({
    key: null,
    items: [],
    next: null,
    total: null,
    loading: true,
    more: false,
    error: null,
  });
  const live = useRef(key);
  live.current = key;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    setState((s) => ({ ...s, key, loading: true, error: null, ...(s.key !== key ? { items: [], next: null, total: null } : {}) }));
    read<Page<T>>(key).then(
      (p) => alive && setState({ key, items: p.items, next: p.nextCursor, total: p.total ?? null, loading: false, more: false, error: null }),
      (error) => alive && setState((s) => ({ ...s, key, loading: false, error })),
    );
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  const loadMore = useCallback(() => {
    if (!key || !state.next || state.more) return;
    const at = key;
    setState((s) => ({ ...s, more: true }));
    read<Page<T>>(`${key}${key.includes("?") ? "&" : "?"}cursor=${enc(state.next)}`).then(
      (p) => live.current === at && setState((s) => ({ ...s, items: [...s.items, ...p.items], next: p.nextCursor, more: false })),
      (error) => live.current === at && setState((s) => ({ ...s, more: false, error })),
    );
  }, [key, state.next, state.more]);

  return {
    items: state.key === key ? state.items : [],
    total: state.key === key ? state.total : null,
    loading: state.loading || state.key !== key,
    loadingMore: state.more,
    error: state.error,
    hasMore: !!state.next,
    loadMore,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
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

export function canSeeTeam(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
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
  slug_too_short: `A link name needs at least ${SLUG_MIN} letters or numbers.`,
  slug_too_long: `A link name can be at most ${SLUG_MAX} letters or numbers.`,
  slug_reserved: "That link name is kept for HOLD. Pick another one.",
  slug_taken: "Someone already has that link name. Pick another one.",
  name_required: "Add the name travellers know you by.",
  already_partner: "You already applied. Reload the page to see where it stands.",
  not_a_partner: "This account is not on a partner team.",
  not_allowed: "Only the owner or an admin of your team can do that.",
  partner_not_active: "This partner is not active right now. It opens again once HOLD re-activates it.",
  date_invalid: "That date does not look right. The end cannot be before the start.",
  website_invalid: "Add a website starting with https://",
  slug_rename_limit: "Your link name was changed the most times allowed. Old links keep working.",
  RATE_LIMIT_EXCEEDED: "Too many tries in a row. Wait a minute and try again.",
  HTTP_429: "Too many tries in a row. Wait a minute and try again.",
  pay_link_not_yours: "That pay link belongs to another account.",
  handle_required: "Pick a HOLD username in the app first, then come back here. Deposit links are paid to your username.",
  account_too_new: "Your HOLD account is too new to collect payments. Try again in a few days.",
  too_many_links: "You have the most links allowed. Archive one you no longer use.",
  amount_out_of_range: "That amount is outside what a pay link can take.",
  text_not_allowed: "The trip name cannot be used on a pay link. Rename the trip and try again.",
  receiver_not_ready: "Your HOLD account is not ready to receive on that network yet. Open the app once and try again.",
  chain_unavailable: "Payments are paused for a moment. Try again shortly.",
  role_invalid: "Pick admin or member.",
  split_invalid: "A split is between 0% and 100%.",
  email_invalid: "That email does not look right.",
  payout_currency_invalid: "Pick dollars or euros.",
  member_not_found: "That person is no longer on the team.",
  owner_cannot_be_removed: "The owner cannot be removed. Hand the partner to someone else first.",
  owner_must_transfer_first: "Hand the partner to someone else before you leave.",
  owner_is_moved_by_transfer: "Change the owner with Make owner.",
  terms_required: "Tick the box to accept the HOLD Partners terms.",
  invite_not_found: "This invite does not exist. Ask for a new link.",
  invite_expired: "This invite has expired. Ask for a new link.",
  invite_revoked: "This invite was cancelled. Ask for a new link.",
  invite_accepted: "This invite was already used. Ask for a new link.",
  invite_for_another_email: "This invite is for another email. Sign in with the HOLD account that uses it, or ask for a link without an email.",
  already_on_a_team: "Your HOLD account is already on a partner team. Leave it first to join another.",
  link_not_found: "That link is gone. Reload the page.",
  max_uses_invalid: `Max people is a whole number from 1 to ${MAX_LINK_USES.toLocaleString("en-US")}. Leave it empty for no limit.`,
  valid_from_invalid: "The open from date does not look right. Pick a day or leave it empty.",
  valid_until_invalid: "The open until date does not look right. Pick a day or leave it empty.",
  dates_out_of_order: "Open until cannot be before open from.",
  give_back_invalid: "Give back is a percentage from 0% to 100% of your share.",
  forbidden: "Only the owner of your team can change what is given back.",
  image_too_large: "That image is over 3 MB. Pick a smaller one.",
  image_type_not_supported: "Use a PNG, JPEG or WebP image.",
  storage_unavailable: "The logo could not be saved right now. Try again in a moment.",
  HTTP_413: "That image is over 3 MB. Pick a smaller one.",
  HTTP_415: "Use a PNG, JPEG or WebP image.",
  trip_not_found: "That trip is gone, or it is run by someone else.",
  max_travellers_invalid: `Travellers is a whole number from 1 to ${TRIP_TRAVELLERS_MAX}.`,
  payout_not_found: "That payout is not yours to open.",
  payout_not_sent: "A statement is ready once the payout is sent.",
  legal_name_required: "Add the legal name payouts go to.",
  address_required: "Add the full address.",
  country_invalid: "Pick a country.",
  tax_id_required: "A company needs its tax ID.",
  entity_invalid: "Pick company or individual.",
  payout_mode_invalid: "Pick how the team is paid.",
  NETWORK: "You look offline. Check your connection and try again.",
  UNAUTHORIZED: "Your session ended. Sign in again.",
};

/** "€1,234.56" from euros. */
export function eur(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** What a payout sent, in the currency it was sent in. */
export function paidText(p: Pick<Payout, "amountUsdc" | "currency" | "amountPaid">): string {
  return p.currency === "EUR" && p.amountPaid != null ? eur(p.amountPaid) : usd(p.amountUsdc);
}

/** "$1,234.56" from dollars. */
export function usd(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "40%" or "33.33%" from basis points. */
export function pct(bps: number): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)}%`;
}

/** "Oct 2026" from "2026-10". */
export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", short ? { month: "short", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The calendar day a link opens, "YYYY-MM-DD" (stored as that midnight UTC). */
export function linkFromDay(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/** The last calendar day a link is open, "YYYY-MM-DD": the server keeps the next midnight UTC. */
export function linkUntilDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Date(t - 1).toISOString().slice(0, 10);
}

/** "40" or "33.33" from basis points, for a percentage input. */
export function pctInput(bps: number | null | undefined): string {
  if (bps == null) return "";
  const v = bps / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
}

/** Basis points from a typed percentage 0 to 100 (two decimals at most), else null. */
export function bpsOfPct(raw: string): number | null {
  const s = raw.trim().replace(",", ".").replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return bps >= 0 && bps <= 10_000 ? bps : null;
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
