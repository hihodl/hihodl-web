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
 * It is reads, and it moves no money. The two POSTs are POSTs because the
 * backend takes the owner address in a body; they are reads all the same.
 * `/ledger/my-container` is the one exception worth knowing: it creates the
 * person's Main and Savings rows the first time it is asked, so it is a write
 * wearing a GET.
 *
 * The chat (lib/app/chat.ts) is the one caller that genuinely writes, and it
 * writes WORDS: a message, a read receipt, an answer to a request. It needs no
 * key because there is no key in a sentence — which is exactly why it is the
 * half of Payments the web can carry in full.
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
    /**
     * The server's `error.message`, when it sent one. Groups answer with a
     * generic code (`VALIDATION_ERROR`, `NOT_FOUND`) and put the reason
     * (`transfer_not_to_them`, `user_not_found`) here, so a screen that has to
     * tell those apart reads this and not `code`.
     */
    readonly detail: string | null = null,
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
export async function read<T>(
  path: string,
  init: {
    json?: unknown;
    signal?: AbortSignal;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /** Extra request headers. Anything beyond Content-Type and Authorization must be allowed by the Worker's preflight (see lib/app/groups). */
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);

  const headers: Record<string, string> = { ...init.headers, accept: "application/json", authorization: `Bearer ${token}` };
  if (init.json !== undefined) headers["content-type"] = "application/json";

  // A body means POST unless the caller names another verb. `method` exists for
  // the chat, which is the one place on the web that genuinely writes: a note
  // is withdrawn with DELETE and the privacy setting is saved with PUT, and
  // neither can be spelled with the body rule alone.
  const method = init.method ?? (init.json !== undefined ? "POST" : "GET");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${path.replace(/^\/+/, "")}`, {
      method,
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
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = err?.code ?? `HTTP_${res.status}`;
    throw new HoldApiError(code, res.status, typeof err?.message === "string" ? err.message : null);
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

/**
 * Dollar prices by symbol and by mint. Open to anyone, but sent with the token like the rest.
 *
 * THE WIRE IS A LIST, THE SCREENS WANT A MAP. Production answers
 * `{ prices: [{ symbol, price, fiat, updatedAt }] }` — a mint comes back as
 * its own row with the mint in `symbol` — and every reader here indexes
 * `prices[symbol]`. Read raw, that index is `undefined` for every coin, so
 * every non-dollar holding drew "—" and Invest said none of them had a price.
 * Normalised once, here, and a map is still accepted if the server ever
 * answers with one.
 */
export async function getPrices(symbols: readonly string[], mints: readonly string[] = []): Promise<{ prices: Record<string, number> }> {
  const q = new URLSearchParams();
  if (symbols.length) q.set("symbols", symbols.join(","));
  if (mints.length) q.set("mints", mints.join(","));
  const raw = await read<{ prices: unknown }>(`prices?${q}`);
  return { prices: priceMap(raw?.prices) };
}

function priceMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(raw)) {
    for (const row of raw as { symbol?: string; price?: number }[]) {
      if (!row?.symbol || typeof row.price !== "number" || !Number.isFinite(row.price)) continue;
      // A mint is case-sensitive base58; a ticker is not.
      out[row.symbol] = row.price;
      out[row.symbol.toUpperCase()] = row.price;
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

/**
 * A price series for one symbol: `[[msSinceEpoch, price], …]`.
 *
 * Production sends `[{ timestamp, price }]`; the curve and the 24h move both
 * read tuples, and read the objects as `undefined`. Normalised here so that
 * neither can.
 */
export async function getPriceHistory(symbol: string, days: 7 | 30 | 90 | 365): Promise<{ symbol: string; prices: [number, number][] }> {
  const raw = await read<{ symbol?: string; prices?: unknown }>(`prices/history?symbol=${encodeURIComponent(symbol)}&days=${days}`);
  const prices: [number, number][] = [];
  for (const p of Array.isArray(raw?.prices) ? (raw.prices as unknown[]) : []) {
    const t = Array.isArray(p) ? p[0] : (p as { timestamp?: number })?.timestamp;
    const v = Array.isArray(p) ? p[1] : (p as { price?: number })?.price;
    if (typeof t === "number" && typeof v === "number" && Number.isFinite(t) && Number.isFinite(v)) prices.push([t, v]);
  }
  return { symbol: raw?.symbol ?? symbol, prices };
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

/** One disposal, exactly as `/portfolio/realized` returns it (the app's taxYear.ts). */
export interface RealizedDisposal {
  at: string;
  chain: string;
  tokenId: string;
  units: number | null;
  proceedsUsd: number | null;
  costUsd: number | null;
  gainUsd: number | null;
  txType: string;
  transactionId: string;
  referenceId: string | null;
}

export interface RealizedIncome {
  at: string;
  chain: string;
  tokenId: string;
  units: number | null;
  amountUsd: number | null;
  transactionId: string;
}

export interface RealizedReport {
  disposals: RealizedDisposal[];
  income: RealizedIncome[];
  gainUsd: number;
  proceedsUsd: number;
  costUsd: number;
  incomeUsd: number;
  unvalued: { count: number; reasons: Record<string, number> };
}

/**
 * Realised disposals: one tax year, or every one ever when `year` is null
 * (which is how the year picker learns which years exist). No fallback to an
 * empty report — an empty year says "you owe nothing", a failed read does not.
 */
export function getRealized(year: number | null): Promise<RealizedReport> {
  return read<RealizedReport>(year == null ? "portfolio/realized" : `portfolio/realized?year=${year}`);
}

/** One acquisition, as the person who made it would recognise it. */
export interface AcquisitionLot {
  entryId: string;
  chain: string;
  tokenId: string;
  units: number | null;
  /** When it landed in HOLD. Ours, never editable. */
  arrivedAt: string;
  /** When the owner says they actually bought it, if that differs. */
  acquiredAt: string | null;
  unitPriceUsd: number | null;
  arrivalPriceUsd: number | null;
  confirmed: boolean;
  external: boolean;
  fromAddress: string | null;
  note: string | null;
  transactionId: string;
}

/** The acquisitions behind a holding. Read only here: correcting a price is the app's. */
export async function getLots(params: { chain?: string; token?: string } = {}): Promise<AcquisitionLot[]> {
  const q = new URLSearchParams();
  if (params.chain) q.set("chain", params.chain);
  if (params.token) q.set("token", params.token);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await read<{ lots?: AcquisitionLot[] }>(`portfolio/lots${suffix}`);
  return res.lots ?? [];
}

export type ReportFormat = "pdf" | "csv";

/**
 * The tax year as a file, built by the server — the same file the app shares.
 *
 * A plain `<a href>` cannot carry the bearer token, so it is fetched with the
 * token and handed to the browser as a blob. The Worker in front of the API
 * allows `Authorization` from any origin, and it does not expose
 * `Content-Disposition`, so the file is named here, as the app names it.
 */
export async function downloadRealized(year: number, format: ReportFormat): Promise<void> {
  const token = await accessToken();
  if (!token) throw new HoldApiError("UNAUTHORIZED", 401);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/portfolio/realized/download?year=${year}&format=${format}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
    });
  } catch {
    throw new HoldApiError("NETWORK", 0);
  }
  if (!res.ok) throw new HoldApiError(`HTTP_${res.status}`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `HOLD-realised-gains-${year}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Late enough for the browser to have started the save.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
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
/**
 * A virtual account: a bank account in this person's name that pays into their
 * HOLD balance.
 *
 * `/rails/accounts` returns the whole row and then attaches `fieldLabels` from
 * the rail catalogue, so the deposit details ARE here — this type used to
 * declare four of them and the web showed none. The labels matter as much as
 * the values: the same column is "Account number" on an ACH rail and "CLABE"
 * in Mexico, and a screen that hardcodes the US words is wrong everywhere else.
 * They are looked up rather than stored, so correcting one is an UPDATE and not
 * an app release.
 */
export interface RailAccount {
  id?: string;
  currency?: string;
  provider?: string;
  railType?: string;
  status?: string;
  /** SEPA. */
  iban?: string | null;
  bic?: string | null;
  /** US ACH and wire. */
  accountNumber?: string | null;
  routingNumber?: string | null;
  sortCode?: string | null;
  /** Rails whose whole identifier is one string: Pix's BR Code, Bre-B's key. */
  paymentCode?: string | null;
  reference?: string | null;
  bankName?: string | null;
  bankCountry?: string | null;
  accountHolderName?: string | null;
  /** What this rail calls each field. Null when the catalogue read failed. */
  fieldLabels?: Record<string, string> | null;
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
 * There used to be a `NOT_ON_THE_SERVER` list here naming `pay-links`,
 * `payment-notes`, `portfolio/lots`, `portfolio/realized`, `groups` and
 * `stocks/availability` as routes this backend does not mount. It was wrong:
 * it came from reading the plain `hihodl-backend` checkout, which lags the
 * integration branch. All six are mounted, and production says so —
 *
 *   curl -s -o /dev/null -w '%{http_code}' https://api.hihodl.xyz/api/v1/portfolio/lots
 *   401   # mounted, wants a token. 404 would mean missing.
 *
 * (`stocks/availability` answers 200 with no token at all.) Three screens were
 * built around the claim and shipped smaller than they had to be. Before
 * writing "this route does not exist" anywhere, read
 * `.worktrees/backend-together` and settle it with the curl above.
 */
