/**
 * What the app's own screens read, read from the web.
 *
 * WHY THIS CAN BE CALLED FROM A BROWSER AT ALL
 *
 * Every read here sits behind `requireAuth`, which is a plain Supabase bearer
 * token and nothing else: no wallet signature, no device signature, no unlock.
 * (Signing lives on the *write* side, and always on the client: the server
 * hands back an unsigned transaction and never holds a key.) And CORS is not
 * in the way either — `api.hihodl.xyz` is fronted by a Worker that answers
 * every `/api/v1` path it does not hand to the backend with
 * `Access-Control-Allow-Origin: *` and `Authorization` allowed, verified
 * against production on 2026-09-20. We send `credentials: "omit"`, so `*` is
 * safe: the token is a header this page puts there on purpose and no ambient
 * cookie can ride along.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is reads. Nothing here moves money, and nothing here writes. The two
 * POSTs are POSTs because the backend takes the owner address in a body; they
 * are reads all the same. `/ledger/my-container` is the one exception worth
 * knowing: it creates the person's Main and Savings rows the first time it is
 * asked, so it is a write wearing a GET.
 *
 * Money on the web is otherwise view only. A withdrawal is approved on the
 * phone (Android) or signed with a passkey bound to that one transaction
 * (iPhone) — see lib/wallet and documentation/link-your-phone-and-approved-
 * withdrawals.md — and nothing on these screens bypasses that.
 */

"use client";

import { API_BASE } from "@/lib/ad-space/config";
import { accessToken } from "@/lib/creator/session";

export class HoldApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "HoldApiError";
  }
}

/**
 * One call, with the person's token on it.
 *
 * The backend answers `{ success: true, data: T }` on these routes and a bare
 * body on a few older ones, so the envelope is unwrapped when it is there and
 * the body used as it is when it is not — the same rule the app's apiClient
 * follows.
 */
export async function read<T>(path: string, init: { json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);

  const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${token}` };
  if (init.json !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      method: init.json !== undefined ? "POST" : "GET",
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      credentials: "omit",
      signal: init.signal,
    });
  } catch {
    throw new HoldApiError("NETWORK", 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* an empty or unparseable body is handled by the status below */
  }

  if (!res.ok) {
    const code = (body as { error?: { code?: string } } | null)?.error?.code ?? `HTTP_${res.status}`;
    throw new HoldApiError(code, res.status);
  }

  const envelope = body as { success?: boolean; data?: unknown } | null;
  return (envelope && typeof envelope === "object" && "data" in envelope ? envelope.data : body) as T;
}

/* ── Balances and prices ──────────────────────────────────────────── */

/** One token at one chain, in one account. `balance` is a decimal string. */
export interface Balance {
  chain: string;
  chainLegacy?: string;
  tokenId: string;
  mint?: string | null;
  balance: string;
  account?: string;
  symbol?: string;
  decimals?: number;
}

export interface BalancesAnswer {
  balances: Balance[];
  updatedAt?: string;
}

/**
 * The balances of ONE account (`main`, `savings`, or a pocket's slug).
 *
 * The app asks once per account and adds them up; asking once with no account
 * answers for `main` alone, which is how the "$3 then $16" bug is written.
 */
export function getBalances(account = "main", chains?: readonly string[]): Promise<BalancesAnswer> {
  const q = new URLSearchParams({ account });
  if (chains?.length) q.set("chains", chains.join(","));
  return read<BalancesAnswer>(`balances?${q}`);
}

/** Dollar prices by symbol and by mint. Open to anyone, but sent with the token like the rest. */
export function getPrices(symbols: readonly string[], mints: readonly string[] = []): Promise<{ prices: Record<string, number> }> {
  const q = new URLSearchParams();
  if (symbols.length) q.set("symbols", symbols.join(","));
  if (mints.length) q.set("mints", mints.join(","));
  return read<{ prices: Record<string, number> }>(`prices?${q}`);
}

/** A price series for one symbol: `[[msSinceEpoch, price], …]`. */
export function getPriceHistory(symbol: string, days: 7 | 30 | 90 | 365): Promise<{ symbol: string; prices: [number, number][] }> {
  return read(`prices/history?symbol=${encodeURIComponent(symbol)}&days=${days}`);
}

/* ── What moved ───────────────────────────────────────────────────── */

export type TransferDirection = "in" | "out" | "exchange" | "move";

export interface Transfer {
  id: string;
  direction: TransferDirection;
  chain: string;
  tokenId: string;
  symbol: string;
  symbolTo?: string | null;
  amount: string;
  amountTo?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  fromAlias?: string | null;
  toAlias?: string | null;
  status: string;
  txHash?: string | null;
  note?: string | null;
  mint?: string | null;
  method?: string | null;
  counterpartyType?: string | null;
  merchantName?: string | null;
  parentIntentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  /* The rest of what the row carries. The app's own transform reads every one
     of these (see _useDashboardPayments.transformRawTransfer), and a web row
     built without them is a row that says less than the app's. */
  /** The subaccount slug this transfer belongs to: `main`, `savings`, a pocket. */
  account?: string | null;
  /** The server's own verb for the row — "Booked", "Withdrawn". It wins over our vocabulary. */
  actionLabel?: string | null;
  /** The dollars this was worth when it happened, frozen. Absent on older rows. */
  usdValueAtTx?: number | null;
  /**
   * What a `move` IS, next to what it says. A yield placement is labelled
   * "Main → Savings" like a real transfer, so the sign cannot be read off the
   * label — see moveSignForScope.
   */
  moveKind?: "transfer" | "yield" | "bridge" | null;
  bridgeFrom?: string | null;
  bridgeTo?: string | null;
  /** The counterparty's photo, when the ledger is allowed to show it. */
  counterpartyAvatar?: string | null;
  profileEmoji?: string | null;
}

export interface TransfersAnswer {
  transfers: Transfer[];
  total: number;
  hasMore?: boolean;
}

export function getTransfers(limit = 50, offset = 0): Promise<TransfersAnswer> {
  return read<TransfersAnswer>(`transfers?limit=${limit}&offset=${offset}`);
}

/**
 * One transfer, expanded: the wallet it left, the inbound record that credited
 * it, the hash and the error. The list row carries the counterparty and the
 * symbol; this carries what the chain did.
 */
export interface TransferDetails {
  id: string;
  chain: string;
  chainLegacy?: string;
  tokenId: string;
  amount: string;
  toAddress: string | null;
  status: string;
  txHash: string | null;
  error: string | null;
  fromWallet: { id: string; chain: string; address: string; label: string | null } | null;
  inbound: { confirmations: number; confirmedAt: string | null; fromAddress: string | null; tokenId: string | null; amount: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function getTransferDetails(id: string): Promise<TransferDetails> {
  return read<TransferDetails>(`transfers/${encodeURIComponent(id)}/details`);
}

/* ── The ledger: Main, Savings and the pockets ────────────────────── */

/** A subaccount of the person's container. Main and Savings are `isSystem`; every other one is a pocket. */
export interface LedgerSubaccount {
  id: string;
  slug: string;
  displayName: string;
  color?: string | null;
  icon?: string | null;
  position?: number;
  isSystem?: boolean;
  earnEnabled?: boolean;
}

export interface ContainerAnswer {
  container: { id: string; [k: string]: unknown };
  subaccounts: LedgerSubaccount[];
}

/**
 * The person's container and its subaccounts.
 *
 * Asking this the first time CREATES Main and Savings. It is the one call here
 * that is not purely a read; the app makes it on every home focus, so the rows
 * exist for anyone who has opened the app.
 */
export function getContainer(): Promise<ContainerAnswer> {
  return read<ContainerAnswer>("ledger/my-container");
}

/** How a container's money is split: which subaccount holds it, and whether it sits liquid or is supplied to a venue. */
export interface SubaccountBalanceRow {
  subaccountId: string;
  slug: string;
  displayName: string;
  chain: string;
  tokenId: string;
  balanceRaw: string;
  placement: "liquid" | "yield";
  venue: "aave" | "kamino" | "";
  updatedAt?: string;
}

export function getContainerBalances(containerId: string): Promise<{ balances: SubaccountBalanceRow[] }> {
  return read(`ledger/containers/${encodeURIComponent(containerId)}/balances`);
}

/** The pockets: every subaccount that is not Main or Savings (the app's SYSTEM_SLUGS). */
export function pocketsOf(subaccounts: readonly LedgerSubaccount[]): LedgerSubaccount[] {
  return subaccounts.filter((s) => s.slug !== "main" && s.slug !== "savings");
}

/* ── What the money earns ─────────────────────────────────────────── */

export interface YieldPosition {
  offerId: string;
  token: string;
  suppliedBaseUnits: string;
  suppliedUsd: number;
  /** From our own cost basis. `null` is "we do not know", which is not 0. */
  principalBaseUnits?: string | null;
  openedAt?: string | null;
  chain?: string;
}

export interface YieldReserve {
  symbol: string;
  token: string;
  supplyApy: number;
  chain?: string;
}

/** Kamino, on Solana. The owner address is the person's own, from /me/addresses. */
export function getKaminoPositions(owner: string): Promise<{ positions: YieldPosition[] }> {
  return read("yield/kamino/positions", { json: { owner } });
}

/** Aave, on Base and Polygon. */
export function getAavePositions(owner: string): Promise<{ positions: YieldPosition[] }> {
  return read("yield/aave/positions", { json: { owner } });
}

export function getKaminoReserves(): Promise<{ reserves: YieldReserve[] }> {
  return read("yield/kamino/reserves");
}

export function getAaveReserves(): Promise<{ reserves: YieldReserve[] }> {
  return read("yield/aave/reserves");
}

/**
 * The standing authorization for one (chain, token), and the one line to show
 * about it.
 *
 * The app draws this as RenewalNotice, which renders nothing in the common
 * case: the server returns copy only for `expired`, the state where new
 * deposits really have stopped being put to work. A 503 means the table is not
 * applied in this environment — the app treats that as "off", and so does the
 * web. Renewing is a signature, so it happens on the phone; this read is only
 * how the web knows to say so.
 */
export interface YieldAuthorization {
  enabled: boolean;
  mode: "none" | "silent" | "ambient" | "expired";
  copy: { line: string; cta: string } | null;
  runwayDays: number | null;
}

export function getYieldAuthorization(chain: string, token = "usdc"): Promise<YieldAuthorization> {
  const q = new URLSearchParams({ chain, token });
  return read<YieldAuthorization>(`yield/authorization?${q}`);
}

/* ── What the money cost ──────────────────────────────────────────── */

export interface CostBasisPosition {
  chain: string;
  tokenId: string;
  /** Weighted average cost in dollars, or null when we have no basis for it. */
  wacUsd: number | null;
  hasBasis: boolean;
  provisionalLots?: number;
  confirmedLots?: number;
}

export function getCostBasis(): Promise<{ positions: CostBasisPosition[] }> {
  return read("portfolio/cost-basis");
}

/* ── Payments the person is owed, owes, or has standing ───────────── */

/**
 * A standing payment. `amountMinor` is base units for an on-chain schedule
 * (six decimals) and cents for an off ramp — two divisors, never one, which is
 * the bug the app's `formatScheduleAmount` exists to make impossible.
 */
export interface Schedule {
  id: string;
  kind: "onchain" | "offramp";
  status: string;
  token: string;
  amountMinor: string;
  amountCurrency: string;
  recipientLabel: string | null;
  cadence: string;
  startsAt: string;
  expiresAt: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runsCompleted: number;
  runsTotal: number | null;
  consecutiveFailures: number;
  authorizations?: { chain: string; revokedAt: string | null }[];
}

export function getScheduledPayments(): Promise<{ schedules: Schedule[] }> {
  return read<{ schedules: Schedule[] }>("scheduled-payments");
}

export function getPaymentRequests(): Promise<unknown> {
  return read("payments/requests");
}

export function getPaymentIntents(): Promise<unknown> {
  return read("payment-intents");
}

/**
 * Where a bank payout got to. Four states and no more: the server maps an
 * open-ended status column onto them and calls anything it cannot place
 * `pending`, so nothing here may sound more certain than that.
 */
export type PayoutState = "pending" | "sent" | "settled" | "failed";

export interface OfframpOrder {
  id: string;
  state: PayoutState;
  /** The order exists and the wallet never sent the stablecoin. A job, not a status. */
  needsFunding?: boolean;
  /** What the recipient gets, in `currency`. */
  amount: string;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  beneficiary?: {
    alias?: string | null;
    holderName?: string | null;
    bankName?: string | null;
    accountLast4?: string | null;
    currency?: string;
  } | null;
}

/** Bank payouts on their way out, newest first. */
export function getOfframpOrders(limit = 20): Promise<{ orders: OfframpOrder[]; hasMore?: boolean; nextBefore?: string | null }> {
  return read<{ orders: OfframpOrder[]; hasMore?: boolean; nextBefore?: string | null }>(`offramp/orders?limit=${limit}`);
}

/**
 * The virtual accounts money can arrive into. The server returns only rows
 * that are alive, so a row existing IS "this person has a working account".
 */
export interface RailAccount {
  id?: string;
  currency?: string;
  provider?: string;
  railType?: string;
}

export function getRailAccounts(): Promise<{ accounts: RailAccount[] }> {
  return read<{ accounts: RailAccount[] }>("rails/accounts");
}

/* ── The person ───────────────────────────────────────────────────── */

/** A name money can be sent to: `@alex` and the address it resolves to. */
export interface AliasRecord {
  id: string;
  alias: string;
  targetChain: string;
  targetAddress: string;
  isPublic: boolean;
  createdAt: string;
}

/**
 * The person's own names (GET /alias). The app's request-link screen reads
 * this and shows `hi.me/<name>`; an empty answer means there is no link to
 * share, never a link made up from an email.
 */
export function getAliases(): Promise<AliasRecord[]> {
  return read<{ aliases?: AliasRecord[] } | AliasRecord[]>("alias").then((r) =>
    Array.isArray(r) ? r : (r.aliases ?? []),
  );
}

export function getHiPoints(): Promise<unknown> {
  return read("hipoints/me");
}

export function getHiPointsHistory(): Promise<unknown> {
  return read("hipoints/history");
}

export function getVerificationStatus(): Promise<unknown> {
  return read("verification/status");
}

/**
 * Routes the app calls that this backend does not mount (they 404): pay links,
 * payment notes and the whole chat shape, `/portfolio/lots`,
 * `/portfolio/realized`, `/groups`, `/stocks/availability`. Nothing on the web
 * may be built on them until they exist.
 */
export const NOT_ON_THE_SERVER = [
  "pay-links",
  "payment-notes",
  "portfolio/lots",
  "portfolio/realized",
  "groups",
  "stocks/availability",
] as const;
