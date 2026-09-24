/**
 * The rules the app applies to `/transfers` on the client, ported.
 *
 * None of this lives on the server. A naive web list of `/transfers` shows
 * rows the app deliberately hides and signs rows the app deliberately leaves
 * unsigned, so the two surfaces would print different histories of the same
 * money. Everything here is read off the app's own files, named after them:
 *
 *   toPaymentItem        _lib/hooks/_useDashboardPayments.transformRawTransfer
 *   foldActivityRows     src/utils/foldActivityRows.ts
 *   hideUnspentWithdrawals src/utils/hideUnspentWithdrawals.ts
 *   moveSignForScope     src/utils/moveSignForScope.ts
 *   paymentUsdDelta      src/utils/paymentUsdDelta.ts
 *   resolveMoveTitle     src/utils/resolveAccountName.ts
 *   activityAction       activity/index.tsx
 *
 * ── THE MODE IS AN ARGUMENT, NOT A CONSTANT ──
 *
 * The app has three display modes and they change the shape of the page:
 * `fintech` collapses every stablecoin into one dollar figure and admits no
 * chains, `hybrid` shows the cards without chain badges, `native` shows
 * everything. Several of the rules below are fintech-only in the app — the
 * ticker mask, the Bought/Sold titles, and dropping a bridge leg.
 *
 * This file used to pick fintech for the whole web. It no longer picks: the
 * person picks once, in the Menu, and the mode arrives here as a parameter
 * (lib/app/display-mode). Nothing has a default, deliberately — a rule that
 * could quietly fall back to one mode is how half a screen comes to behave
 * like one and half like another.
 */

import type { Transfer, LedgerSubaccount } from "./hold-api";
import {
  hideBridgesInFintech,
  maskTokenSymbol,
  swapActivityTitle,
  type DisplayMode,
} from "./display-mode";
import { t } from "./i18n";
import { fmtDate, fmtNumber, fmtTime } from "./i18n/format";
import { isStable } from "./money";

export type { DisplayMode };

/** `t`, under a name `toPaymentItem`'s own `t` (the transfer) does not shadow. */
const tr = t;

/* ── What a row is, once it is a row ──────────────────────────────── */

export type PaymentKind = "in" | "out" | "refund" | "move" | "exchange" | "income";

/** One leg of a folded row, kept so the receipt can still show its parts. */
export interface FoldedLeg {
  id: string;
  chain?: string;
  txHash?: string | null;
  tokenAmount: number;
}

/** The app's `PaymentItem` — one activity row, ready to draw. */
export interface PaymentItem {
  id: string;
  /** Who or what the row is about. A move carries "Main → Savings" here. */
  title: string;
  date: string;
  /** The signed display string the row prints, or "Processing…". */
  amount: string;
  /** True when the amount is not known yet and `amount` says "Processing…". */
  processing?: boolean;
  type: PaymentKind;
  /** The server's own verb, when it sent one. Beats our vocabulary. */
  actionLabel?: string;
  txHash?: string | null;
  chain?: string;
  /** The subaccount this belongs to: `main`, `savings`, a pocket's slug. */
  accountScope?: string;
  status?: string;
  fromAddress?: string | null;
  toAddress?: string | null;
  toAlias?: string | null;
  tokenSymbol?: string;
  /** Signed for everything but a move, which is signed at render. */
  tokenAmount?: number;
  usdValueAtTx?: number;
  tokenSymbolTo?: string;
  tokenAmountTo?: number;
  /** A swap's spent side, under the received one. */
  amountSecondary?: string;
  counterpartyType?: string | null;
  counterpartyAvatarUrl?: string;
  /** The Solana mint, for a token whose price is only quoted by mint. */
  tokenMint?: string;
  profileEmoji?: string;
  parentIntentId?: string | null;
  moveKind?: "transfer" | "yield" | "bridge" | null;
  bridgeFrom?: string | null;
  bridgeTo?: string | null;
  /** Present only on a row that stands for more than one transfer. */
  foldedLegs?: FoldedLeg[];
}

/* ── Reading the wire ─────────────────────────────────────────────── */

/** `usdc.circle` → `USDC`; an unknown id keeps its own head. The app's `tokenTickerFromId`. */
export function tickerOf(tokenId?: string | null): string {
  const raw = (tokenId ?? "usdc").trim();
  const head = raw.split(".")[0]?.toUpperCase();
  return head && head.length <= 12 ? head : "USDC";
}

/**
 * The display ticker for the mode in hand: in fintech a dollar is called a
 * dollar, everywhere else the coin keeps its own name. The app's
 * `maskTokenSymbol`, re-exported under the name this file's callers use.
 */
export function maskSymbol(symbol: string, mode: DisplayMode): string {
  return maskTokenSymbol(symbol, mode);
}

/**
 * The app's `parseTransferAmount`, trimmed to the coercions that still fire.
 *
 * The backend formats amounts before sending them, so this is a `parseFloat`
 * except on legacy raw-integer paths: EVM wei and Solana lamports.
 */
export function parseTransferAmount(raw: unknown, chain?: string, tokenId?: string): number {
  const text = String(raw ?? 0);
  let amount = Number.parseFloat(text) || 0;
  const chainKey = (chain ?? "").toLowerCase();
  const tokenKey = (tokenId ?? "").toLowerCase();
  if (text.includes(".")) return amount;

  const stablecoin = ["usdc", "usdt", "usdg", "usd1", "pyusd", "dai"].some((s) => tokenKey.includes(s));
  if (["ethereum", "polygon", "base"].includes(chainKey)) {
    const decimals = stablecoin ? 6 : 18;
    const threshold = decimals === 18 ? 1e10 : 10 ** decimals;
    if (amount >= threshold) amount /= 10 ** decimals;
  } else if (chainKey === "solana" || chainKey === "sol") {
    const native = tokenKey === "sol" || tokenKey === "sol.native" || tokenKey === "solana" || tokenKey === "";
    if (native && amount >= 1e9) amount /= 1e9;
  }
  return amount;
}

/** The app's `fmtTokenAmount`: two decimals for a dollar, five for anything else. */
export function fmtTokenAmount(amount: number, symbol: string): string {
  if (!Number.isFinite(amount)) return "0";
  return fmtNumber(amount, { maximumFractionDigits: isStable(symbol) ? 2 : 5 });
}

function shortAddress(address?: string | null): string | null {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * One transfer, as a row.
 *
 * A move is deliberately left UNSIGNED here: the same 6 dollars is a credit in
 * the account it reached and a debit in the one it left, and this function
 * cannot know which one the reader is standing in. `moveSignForScope` decides
 * it at render, where the scope is known.
 */
export function toPaymentItem(t: Transfer, mode: DisplayMode): PaymentItem {
  const direction = t.direction ?? "out";
  const symbol = tickerOf(t.tokenId ?? t.symbol);
  const symbolTo = t.symbolTo ? tickerOf(t.symbolTo) : undefined;
  const displaySym = maskSymbol(symbol, mode);
  const displaySymTo = symbolTo ? maskSymbol(symbolTo, mode) : undefined;
  const amount = parseTransferAmount(t.amount, t.chain, t.tokenId ?? t.symbol);
  const valid = Number.isFinite(amount) && amount > 0;
  const amountText = valid ? fmtTokenAmount(amount, symbol) : "";

  const common = {
    id: t.id,
    date: t.createdAt || new Date().toISOString(),
    txHash: t.txHash,
    chain: t.chain,
    status: t.status,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    toAlias: t.toAlias,
    tokenSymbol: symbol,
    tokenSymbolTo: symbolTo,
    accountScope: t.account ?? undefined,
    counterpartyType: t.counterpartyType,
    tokenMint: t.mint ?? undefined,
    counterpartyAvatarUrl: t.counterpartyAvatar || undefined,
    profileEmoji: t.profileEmoji || undefined,
    parentIntentId: t.parentIntentId ?? null,
  };

  if (direction === "exchange") {
    const amountTo = t.amountTo ? Number.parseFloat(t.amountTo) : 0;
    const toValid = Number.isFinite(amountTo) && amountTo > 0;
    const received = toValid && !!symbolTo && symbolTo !== "UNKNOWN";
    return {
      ...common,
      title: swapActivityTitle({ fromSym: symbol, toSym: symbolTo, displayFrom: displaySym, displayTo: displaySymTo, mode }),
      type: "exchange",
      amount: received
        ? `+ ${fmtNumber(amountTo, { minimumFractionDigits: amountTo < 1 ? 5 : 2, maximumFractionDigits: amountTo < 1 ? 5 : 2, useGrouping: false })} ${displaySymTo}`
        : valid
          ? `- ${amountText} ${displaySym}`
          : tr("activity.processing"),
      processing: !received && !valid,
      // Only when there is a received side: a legacy swap must never print the
      // one amount it knows twice.
      amountSecondary: received && valid ? `- ${amountText} ${displaySym}` : undefined,
      tokenAmount: valid ? -amount : 0,
      tokenAmountTo: toValid ? amountTo : undefined,
    };
  }

  let title: string;
  let sign: string;
  let type: PaymentKind;
  let signed: number;

  if (direction === "move") {
    const from = t.fromAddress || "main";
    const to = t.toAddress || "savings";
    title = `${systemName(from) ?? from} → ${systemName(to) ?? to}`;
    sign = "";
    signed = valid ? amount : 0;
    type = "move";
  } else if (direction === "in") {
    // `merchantName` first: money can arrive from an address of OURS (a
    // refund), and the fallback would print our treasury into the row.
    title = t.merchantName?.trim() || t.fromAlias || shortAddress(t.fromAddress) || tr("activity.row.deposit");
    sign = "+";
    signed = valid ? amount : 0;
    type = "in";
  } else {
    title = t.merchantName?.trim() || t.toAlias || shortAddress(t.toAddress) || tr("activity.row.unknown");
    sign = "-";
    signed = valid ? -amount : 0;
    type = "out";
  }

  return {
    ...common,
    title,
    type,
    amount: valid ? `${sign} ${displaySym} ${amountText}`.trim() : tr("activity.processing"),
    processing: !valid,
    actionLabel: t.actionLabel || undefined,
    tokenAmount: signed,
    usdValueAtTx: t.usdValueAtTx ?? undefined,
    moveKind: t.moveKind ?? undefined,
    bridgeFrom: t.bridgeFrom ?? undefined,
    bridgeTo: t.bridgeTo ?? undefined,
  };
}

/* ── Names ────────────────────────────────────────────────────────── */

/** The three names the system gives, in the language on screen; null for anything else. */
function systemName(slug: string): string | null {
  switch (slug) {
    case "main":
      return t("activity.account.main");
    case "savings":
      return t("activity.account.savings");
    case "earning":
      return t("activity.account.earning");
    default:
      return null;
  }
}

/**
 * A slug as the person named it. Resolved at render, not baked into the row,
 * so renaming a pocket in the app renames it here without a cache to clear.
 *
 * `earning` is not an account: it is where a container's money goes when it is
 * supplied to a venue, and it is here because a movement into yield has to
 * name the other end of itself.
 */
export function resolveAccountName(slug: string | null | undefined, subaccounts: readonly LedgerSubaccount[]): string {
  if (!slug) return t("activity.account.fallback");
  const key = String(slug).toLowerCase();
  const found = subaccounts.find((s) => s.slug.toLowerCase() === key);
  if (found?.displayName) return found.displayName;
  const system = systemName(key);
  if (system) return system;
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveMoveTitle(
  from: string | null | undefined,
  to: string | null | undefined,
  subaccounts: readonly LedgerSubaccount[],
): string {
  return `${resolveAccountName(from, subaccounts)} → ${resolveAccountName(to, subaccounts)}`;
}

/** The verb that headlines a row when the server sent none. */
export function activityAction(type: PaymentKind): string {
  switch (type) {
    case "in":
    case "income":
      return t("activity.action.received");
    case "out":
      return t("activity.action.sent");
    case "move":
      return t("activity.action.moved");
    case "exchange":
      return t("activity.action.swapped");
    case "refund":
      return t("activity.action.refunded");
    default:
      return t("activity.action.activity");
  }
}

/* ── Which way a move points ──────────────────────────────────────── */

/**
 * The sign of a movement between the person's own accounts.
 *
 * The rule (Alex, 2026-08-17): the account that RECEIVES money is green.
 * Ledger move, pocket, joint account, yield, all the same. White with a minus
 * is what left. So there is one thing to ask — is the account you are looking
 * at the one the money left? Everything else reads as money arriving
 * somewhere, and that is green. Unfiltered, a row that names a receiving
 * account names money arriving in it, so it is green too.
 *
 * The exception is a movement that received nothing anywhere. Starting to earn
 * on money already in Savings never leaves Savings, and the backend still
 * labels it "Main → Savings" because that is how a person describes tapping
 * the button. So the label answers what the row SAYS and `kind` answers what
 * the row IS, and only the second gets a vote. A bridge is the same case by a
 * stranger route: it fills on the destination chain as an ordinary inbound
 * transfer into the person's own address, and a green plus over it would say
 * they were paid at the moment they were charged.
 *
 * Green means money arrived. A debit is white. No red.
 */
export function moveSignForScope(
  from: string | null | undefined,
  to: string | null | undefined,
  inScope: (slug: string) => boolean,
  kind?: "transfer" | "yield" | "bridge" | null,
): "+" | "-" | "" {
  if (kind === "yield" || kind === "bridge") return "";
  const fromIn = inScope(String(from || "main").toLowerCase());
  const toIn = inScope(String(to || "savings").toLowerCase());
  if (fromIn && !toIn) return "-";
  return "+";
}

/**
 * Signed dollar effect of one row on the selected accounts' stablecoin
 * balance — the second half of the question `moveSignForScope` asks the first
 * half of. That one decides which way the row points; this decides how far.
 *
 * Only stablecoin legs move the dollar balance; a volatile leg contributes 0.
 */
export function paymentUsdDelta(p: PaymentItem, inScope: (slug: string) => boolean): number {
  // Asked first because a bridge arrives as an inbound row: `case "in"` would
  // rewind the balance by the whole arrival, and the dollar balance did not
  // gain it — it lost the relayer's fee. Zero, and not the fee, because the
  // departure has no row here to take it from.
  if (p.moveKind === "bridge") return 0;
  const inSym = (p.tokenSymbol ?? "").toUpperCase();
  const outSym = (p.tokenSymbolTo ?? "").toUpperCase();
  const inUsd = isStable(inSym) ? Math.abs(p.tokenAmount ?? 0) : 0;
  const outUsd = isStable(outSym) ? Math.abs(p.tokenAmountTo ?? 0) : 0;
  switch (p.type) {
    case "in":
    case "income":
    case "refund":
      return +inUsd;
    case "out":
      return -inUsd;
    case "exchange":
      return outUsd - inUsd;
    case "move": {
      // A placement changes where money EARNS, not which account holds it, so
      // it moves no balance. Asked of `moveKind`, never of the slugs: the
      // slugs are copy and the kind is the event.
      if (p.moveKind === "yield") return 0;
      const fromIn = inScope(String(p.fromAddress ?? "").toLowerCase());
      const toIn = inScope(String(p.toAddress ?? "").toLowerCase());
      if (fromIn === toIn) return 0;
      return toIn ? +inUsd : -inUsd;
    }
    default:
      return 0;
  }
}

/* ── One event, one row ───────────────────────────────────────────── */

const timeOf = (d: string | Date): number => {
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * How far apart two legs of one act may land.
 *
 * Measured on booking e45d71b4: the Base leg broadcast at 21:34:41 and the
 * Polygon leg at 21:35:04 — twenty-three seconds, on the slow path. Two
 * minutes is generous against that and far tighter than any interval in which
 * a person makes two deliberate purchases from one merchant.
 */
const FOLD_WINDOW_MS = 2 * 60 * 1000;

/** What kind of act a row is, for folding. `null` means never fold. */
function actOf(item: PaymentItem): string | null {
  if (item.type === "out") return "out";
  if (item.type === "move" && item.moveKind === "yield") return `yield:${item.actionLabel ?? "move"}`;
  return null;
}

function groupKey(item: PaymentItem): string | null {
  const act = actOf(item);
  if (!act) return null;
  return [act, (item.tokenSymbol ?? "").toUpperCase(), (item.title ?? "").trim().toLowerCase()].join("|");
}

function amountDisplay(sample: PaymentItem, total: number, mode: DisplayMode): string {
  const symbol = maskSymbol(sample.tokenSymbol ?? "", mode);
  const magnitude = fmtNumber(Math.abs(total), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  // A move is deliberately unsigned — see moveSignForScope.
  if (sample.type === "move") return symbol ? `${symbol} ${magnitude}` : magnitude;
  return `${total < 0 ? "-" : "+"} ${symbol} ${magnitude}`;
}

/**
 * Collapse the legs of one act into one row.
 *
 * A stay paid from two balances is two transfers, and it has to be: two
 * signatures, two hashes, two debits. But the web has no chains in it, so
 * "14.75 to Cityzen Renon" above "4.69 to Cityzen Renon" is not extra detail,
 * it is a false statement — it says the guest paid that hotel twice.
 *
 * Rows fold when they are the same kind, the same token, the same
 * counterparty, land inside one settlement window, and are ON DIFFERENT
 * CHAINS. That last clause is the whole safety argument: two legs of one
 * payment are different chains by construction, while two genuinely separate
 * purchases at one merchant are not so constrained. The rule errs toward
 * showing two rows, which is the recoverable mistake. A server-supplied
 * grouping key wins outright — an exact answer is not improved by a heuristic.
 *
 * Order is preserved and the surviving row takes the place of its FIRST leg.
 */
export function foldActivityRows(items: readonly PaymentItem[], mode: DisplayMode): PaymentItem[] {
  if (items.length < 2) return items as PaymentItem[];

  const out: PaymentItem[] = [];
  const openAt = new Map<string, number>();
  const chainsOf = new Map<string, Set<string>>();
  const legsOf = new Map<string, FoldedLeg[]>();
  const legOf = (i: PaymentItem): FoldedLeg => ({
    id: i.id,
    chain: i.chain,
    txHash: i.txHash,
    tokenAmount: i.tokenAmount ?? 0,
  });

  for (const item of items) {
    const key = groupKey(item);
    if (key === null) {
      out.push(item);
      continue;
    }
    const chain = (item.chain ?? "").toLowerCase();
    const exact = item.parentIntentId ? `intent:${item.parentIntentId}` : null;
    const lookup = exact ?? key;
    const at = openAt.get(lookup);
    const host = at === undefined ? null : out[at];

    const joins =
      host != null &&
      (exact !== null ||
        (chain !== "" &&
          !chainsOf.get(lookup)!.has(chain) &&
          Math.abs(timeOf(item.date) - timeOf(host.date)) <= FOLD_WINDOW_MS));

    if (!joins) {
      openAt.set(lookup, out.push(item) - 1);
      chainsOf.set(lookup, new Set(chain ? [chain] : []));
      legsOf.set(lookup, [legOf(item)]);
      continue;
    }

    const legs = legsOf.get(lookup)!;
    legs.push(legOf(item));
    if (chain) chainsOf.get(lookup)!.add(chain);

    const total = legs.reduce((sum, l) => sum + l.tokenAmount, 0);
    const bothPriced = typeof host!.usdValueAtTx === "number" && typeof item.usdValueAtTx === "number";

    out[at!] = {
      ...host!,
      // The largest leg keeps the receipt: it is the one a reader recognises,
      // and `foldedLegs` carries the rest.
      ...(Math.abs(item.tokenAmount ?? 0) > Math.abs(host!.tokenAmount ?? 0)
        ? { txHash: item.txHash, chain: item.chain }
        : {}),
      tokenAmount: total,
      amount: amountDisplay(host!, total, mode),
      usdValueAtTx: bothPriced ? (host!.usdValueAtTx ?? 0) + (item.usdValueAtTx ?? 0) : undefined,
      foldedLegs: legs.slice(),
    };
  }

  return out;
}

/* ── A withdrawal nobody spent is not an event ────────────────────── */

/**
 * Two sweeper ticks. `AUTO_SUPPLY_INTERVAL_MS` in the backend is fifteen
 * minutes, so a redemption that lands just after one waits a full interval for
 * the next: thirty minutes is the longest an unspent redemption can survive
 * before the sweeper takes it back.
 */
export const SPEND_WINDOW_MS = 30 * 60 * 1000;

/** How much larger than the withdrawal a sweep may be and still be its reversal. */
const REVERSAL_TOLERANCE = 1.01;

const symOf = (r: PaymentItem) => (r.tokenSymbol ?? "").toUpperCase();
const labelOf = (r: PaymentItem) => (r.actionLabel ?? "").trim().toLowerCase();
const slugOf = (s: unknown) => String(s ?? "").trim().toLowerCase();
const isYieldMove = (r: PaymentItem) => r.type === "move" && r.moveKind === "yield";

/** Money leaving a yield venue for the liquid balance. The server's verb is the authority. */
export function isYieldWithdrawal(r: PaymentItem): boolean {
  if (!isYieldMove(r)) return false;
  const l = labelOf(r);
  return l === "withdrawn" || (l === "" && slugOf(r.fromAddress) === "earning");
}

/** The other direction: liquid balance into a yield venue. */
export function isYieldSupply(r: PaymentItem): boolean {
  if (!isYieldMove(r)) return false;
  const l = labelOf(r);
  return l === "earning" || (l === "" && slugOf(r.toAddress) === "earning");
}

/** Money actually going somewhere. A deposit is not one; another yield move is not either. */
function isMovement(r: PaymentItem): boolean {
  if (r.type === "out" || r.type === "exchange") return true;
  return r.type === "move" && !isYieldMove(r);
}

/**
 * Drop redemptions that funded nothing, and the sweeps that undid them.
 *
 * Every spend in this product redeems FIRST — a checkout moves money out of
 * Aave before the person has agreed to anything, because the alternative is
 * twenty seconds of waiting on a screen with no back button. Then they change
 * their mind, and Activity, which recorded the redemption honestly, prints
 * "Withdrawn USDC 19.02" for an act they never asked for, over money that did
 * not go anywhere.
 *
 * Both defaults are guesses, so pick the one whose mistake is recoverable:
 * hiding a withdrawal that turns out to fund a payment costs nothing (the
 * payment appears, and the withdrawal with it), while showing one that funds
 * nothing costs a fright about their own money.
 *
 * The reversal goes too — but only when it puts back no more than was taken. A
 * sweep larger than the withdrawal has swept fresh money in with it, and fresh
 * money starting to earn is a real thing that happened.
 *
 * Input is expected newest-first. Order is preserved; nothing is rewritten.
 */
export function hideUnspentWithdrawals(rows: readonly PaymentItem[]): PaymentItem[] {
  if (rows.length === 0) return rows as PaymentItem[];

  const movements: { t: number; sym: string }[] = [];
  const supplies: { id: string; t: number; sym: string; amount: number }[] = [];
  for (const r of rows) {
    if (isMovement(r)) movements.push({ t: timeOf(r.date), sym: symOf(r) });
    else if (isYieldSupply(r)) {
      supplies.push({ id: r.id, t: timeOf(r.date), sym: symOf(r), amount: Math.abs(r.tokenAmount ?? 0) });
    }
  }

  const drop = new Set<string>();
  /** A sweep reverses one withdrawal, never two. */
  const claimed = new Set<string>();

  for (const r of rows) {
    if (!isYieldWithdrawal(r)) continue;
    const t = timeOf(r.date);
    const sym = symOf(r);
    const taken = Math.abs(r.tokenAmount ?? 0);
    if (movements.some((m) => m.sym === sym && m.t >= t && m.t - t <= SPEND_WINDOW_MS)) continue;

    drop.add(r.id);

    let reversal: string | null = null;
    let nearest = Infinity;
    for (const s of supplies) {
      if (claimed.has(s.id) || s.sym !== sym) continue;
      const dt = s.t - t;
      if (dt < 0 || dt > SPEND_WINDOW_MS) continue;
      if (taken <= 0 || s.amount > taken * REVERSAL_TOLERANCE) continue;
      if (dt < nearest) {
        nearest = dt;
        reversal = s.id;
      }
    }
    if (reversal) {
      claimed.add(reversal);
      drop.add(reversal);
    }
  }

  return drop.size === 0 ? (rows as PaymentItem[]) : rows.filter((r) => !drop.has(r.id));
}

/**
 * The three rules, in the order the app runs them, over rows already
 * newest-first. The bridge rule is fintech's alone — see
 * `hideBridgesInFintech`: in native the chains exist, the money is on a
 * different one than it was, and the person asked for that.
 */
export function activityRows(items: readonly PaymentItem[], mode: DisplayMode): PaymentItem[] {
  return hideBridgesInFintech(hideUnspentWithdrawals(foldActivityRows(items, mode)), mode);
}

/* ── Which scope a row belongs to ─────────────────────────────────── */

/**
 * Whether a row belongs to one account.
 *
 * A move is a row about two accounts and belongs to both ends. Everything else
 * carries the subaccount it was booked against, and a row booked against
 * nothing — or against the stealth path — is Main's, which is what the app
 * does (see `_useDashboardPayments`).
 */
export function rowInScope(item: PaymentItem, slug: string): boolean {
  if (item.type === "move") {
    return slugOf(item.fromAddress) === slug || slugOf(item.toAddress) === slug;
  }
  const raw = slugOf(item.accountScope);
  if (slug === "main") return raw === "" || raw === "main" || raw === "stealth";
  return raw === slug;
}

/* ── Days and times ───────────────────────────────────────────────── */

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today", "Yesterday", else "Sep 14". The activity screen's day divider. */
export function dayLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return t("common.today");
  if (isSameDay(d, yesterday)) return t("common.yesterday");
  return fmtDate(d, { month: "short", day: "numeric" });
}

/** The row's time, with the day already said by the divider above it. */
export function timeLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return fmtTime(d, { hour: "numeric", minute: "2-digit" });
}
