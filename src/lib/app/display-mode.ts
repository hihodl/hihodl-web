/**
 * The display mode, and every rule that reads it — the web's copy of the app's
 * `useUserPrefs.walletMode` and `src/utils/walletModeDisplay.ts`.
 *
 * THE ONE SETTING
 *
 * Three layers of crypto-abstraction, exactly as the app defines them:
 *
 *   • fintech  Stablecoins read as the fiat they are pegged to (USDC/USDT →
 *              "USD"). No Stables card, no Earning card, no chain anywhere,
 *              and the BTC family collapses into one "Bitcoin".
 *   • hybrid   Real coin symbols, aggregated across every chain. The cards are
 *              drawn; the networks still are not.
 *   • native   Everything: a row per chain, network names, hashes, explorers.
 *
 * WHERE IT IS KEPT, AND WHY IT IS NOT ON THE SERVER
 *
 * The app persists `walletMode` to AsyncStorage and nowhere else: `GET
 * /settings` and `PATCH /settings` carry defaultTokenId, defaultAccount,
 * favoriteChainByToken, notifications and privacy, and no display mode. There
 * is nothing to read it from and nothing to write it to, so the web keeps its
 * own copy in `localStorage` behind the shell's preferences (Shell.tsx,
 * `useShellPrefs`), the same way the sidebar's width is kept. The moment the
 * backend grows the field, this is the one place that has to change: every
 * screen already asks the shell rather than the browser.
 *
 * WHAT THESE HELPERS ARE
 *
 * Display-only, every one of them. Masking a symbol never changes the symbol a
 * balance, a quote or a route is keyed by — those stay the raw "USDC" and
 * "solana". Pass the masked value to the UI and nowhere else.
 */

import { t } from "./i18n";

import { isStable } from "./money";

export type DisplayMode = "fintech" | "hybrid" | "native";

/** The app's default (userPrefs.ts): a new person starts in the simplest view. */
export const DEFAULT_DISPLAY_MODE: DisplayMode = "fintech";

const MODES: readonly DisplayMode[] = ["fintech", "hybrid", "native"];

/** A stored value that is not one of the three is not a mode. */
export function asDisplayMode(raw: string | null | undefined): DisplayMode | null {
  return MODES.includes(raw as DisplayMode) ? (raw as DisplayMode) : null;
}

/* ── The picker's own words (the app's DisplayModeSheet) ──────────── */

/** The sheet's title. A function: the language is known only at render. */
export const DISPLAY_MODE_TITLE = (): string => t("menu.displayMode.title");
/** The sheet's one line of intro. */
export const DISPLAY_MODE_INTRO = (): string => t("menu.displayMode.intro");

export interface DisplayModeOption {
  id: DisplayMode;
  /** The Ionicons name the app's sheet uses for this row. */
  icon: "cash-outline" | "layers-outline" | "cube-outline";
  title: string;
  body: string;
}

const OPTION_KEYS = [
  { id: "fintech", icon: "cash-outline", title: "menu.displayMode.fintechTitle", body: "menu.displayMode.fintechBody" },
  { id: "hybrid", icon: "layers-outline", title: "menu.displayMode.hybridTitle", body: "menu.displayMode.hybridBody" },
  { id: "native", icon: "cube-outline", title: "menu.displayMode.nativeTitle", body: "menu.displayMode.nativeBody" },
] as const;

/** Word for word from the app's `settings:displayMode.*`, in the person's language. Call at render. */
export function DISPLAY_MODE_OPTIONS(): readonly DisplayModeOption[] {
  return OPTION_KEYS.map((o) => ({ id: o.id, icon: o.icon, title: t(o.title), body: t(o.body) }));
}

/* ── Symbols ──────────────────────────────────────────────────────── */

/** The fiat a pegged token is a unit of. Fintech prints this instead of the ticker. */
const STABLE_FIAT: Record<string, string> = {
  USDC: "USD",
  USDT: "USD",
  HUSD: "USD",
  DAI: "USD",
  PYUSD: "USD",
  USDS: "USD",
  FDUSD: "USD",
  USDG: "USD",
  EURC: "EUR",
};

/**
 * Fintech collapses a pegged stablecoin to its fiat code (USDC/USDT → "USD",
 * EURC → "EUR") and reads cbBTC as plain "BTC" so the whole Bitcoin family is
 * one thing. Hybrid, native and every non-stable are returned unchanged.
 */
export function maskTokenSymbol(symbol: string | null | undefined, mode: DisplayMode): string {
  const sym = (symbol ?? "").toUpperCase();
  if (mode !== "fintech") return symbol ?? "";
  if (isStable(sym)) return STABLE_FIAT[sym] ?? symbol ?? "";
  if (sym === "CBBTC") return "BTC";
  return symbol ?? "";
}

/** The fiat a stablecoin is pegged to, or null. The app's `getStableFiatCurrency`. */
export function stableFiat(symbol: string | null | undefined): string | null {
  return STABLE_FIAT[(symbol ?? "").toUpperCase()] ?? null;
}

/* ── The BTC family ───────────────────────────────────────────────── */

const BTC_FAMILY = new Set(["BTC", "CBBTC"]);

/** Native L1 BTC, or the Coinbase wrapper on Solana. */
export function isBtcFamilySymbol(symbol: string | null | undefined): boolean {
  return BTC_FAMILY.has((symbol ?? "").toUpperCase());
}

/** The Solana-side wrapped Bitcoin — the fast, cheap leg. */
export function isFastBtc(symbol: string | null | undefined): boolean {
  return (symbol ?? "").toUpperCase() === "CBBTC";
}

/** Only fintech merges native BTC and cbBTC into one position. */
export function shouldAggregateBtcFamily(mode: DisplayMode): boolean {
  return mode === "fintech";
}

/**
 * What a BTC-family row is called: one "Bitcoin" in fintech, and the two of
 * them told apart everywhere else, because a crypto-aware reader should see
 * that cbBTC is a separate asset they can swap in a second.
 */
export function btcFamilyDisplayName(symbol: string | null | undefined, mode: DisplayMode): string {
  const sym = (symbol ?? "").toUpperCase();
  if (!BTC_FAMILY.has(sym)) return symbol ?? "";
  if (mode === "fintech") return "Bitcoin";
  return sym === "CBBTC" ? "Coinbase Wrapped BTC" : "Bitcoin";
}

/** The one-line subtitle that marks cbBTC as the on-Solana leg. Empty in fintech. */
export function btcFamilySubtitle(symbol: string | null | undefined, mode: DisplayMode): string {
  if (mode === "fintech") return "";
  return isFastBtc(symbol) ? t("menu.displayMode.fastBtc") : "";
}

/* ── Chains ───────────────────────────────────────────────────────── */

/**
 * Whether network names, chain badges, hashes-by-chain and explorer links may
 * be shown at all. Only native exposes the chain layer; fintech and hybrid are
 * both network-agnostic — the app has said so since walletModeDisplay was
 * written.
 */
export function showChainContext(mode: DisplayMode): boolean {
  return mode === "native";
}

/**
 * Whether a stablecoin's per-chain badge is hidden. True for fintech AND
 * hybrid; a non-stable is never hidden by this rule, because for SOL or ETH
 * the chain IS the asset.
 */
export function hideStableBadgeForMode(symbol: string | null | undefined, mode: DisplayMode): boolean {
  return mode !== "native" && isStable(symbol ?? "");
}

/** A row drawn as fiat (a currency code) rather than a coin. Fintech stables only. */
export function isFiatMasked(symbol: string | null | undefined, mode: DisplayMode): boolean {
  return mode === "fintech" && isStable(symbol ?? "");
}

/**
 * Whether a transaction's own receipt — its hash, and the explorer it opens —
 * belongs on screen. Hybrid keeps it: a hybrid reader knows what a hash is.
 * Fintech has no chain to open it on.
 */
export function showTxReceipt(mode: DisplayMode): boolean {
  return mode !== "fintech";
}

/* ── Activity ─────────────────────────────────────────────────────── */

/**
 * What a swap is called.
 *
 * A dollar-native reader does not think in swaps, they think in BUY and SELL,
 * exactly like a stock: paying dollars for an asset is a Buy, turning an asset
 * back into dollars is a Sell. A genuine asset↔asset trade, or dollar↔dollar,
 * stays "Swapped" — and native keeps "Swapped" everywhere, because that reader
 * knows the word and trades asset to asset, which is neither a buy nor a sell.
 */
export function swapActivityTitle(opts: {
  fromSym: string;
  toSym?: string;
  displayFrom: string;
  displayTo?: string;
  mode: DisplayMode;
}): string {
  const { fromSym, toSym, displayFrom, displayTo, mode } = opts;
  if (mode === "native" || !toSym) return t("menu.displayMode.swapped");
  const fromStable = isStable(fromSym);
  const toStable = isStable(toSym);
  if (fromStable && !toStable) return t("menu.displayMode.bought", { symbol: displayTo ?? toSym });
  if (!fromStable && toStable) return t("menu.displayMode.sold", { symbol: displayFrom });
  return t("menu.displayMode.swapped");
}

/**
 * Where there are no chains, a bridge is not an event.
 *
 * A bridge fills on the destination chain as an ordinary transfer into the
 * person's own address. In native that is the whole content of the row — the
 * chains exist and the money is on a different one than it was. In fintech
 * there is no Base and no Polygon, only a balance, so every true sentence
 * about the row is a sentence about chains the reader has been told do not
 * exist, and "Bridged" over nothing reads as money leaving.
 *
 * The test is `moveKind`, which the server sets only from a cross-chain row of
 * this person's own. A deposit from a stranger has no such row and cannot be
 * mistaken for one.
 */
export function hideBridgesInFintech<T extends { moveKind?: string | null }>(
  items: readonly T[],
  mode: DisplayMode,
): T[] {
  if (mode !== "fintech") return items as T[];
  return items.filter((i) => i.moveKind !== "bridge");
}

/* ── Rows of holdings ─────────────────────────────────────────────── */

/** The shape every holdings list on the web shares, whichever screen draws it. */
export interface HoldingRow {
  /** Stable identity for React, and for the merge below. */
  key: string;
  /** The RAW ticker. Never the masked one — masking happens at the last moment. */
  symbol: string;
  /** Token units held. */
  amount: number;
  /** Dollars, or null when no feed answered. Not zero: that is a different claim. */
  usd: number | null;
  /** The chain this row is about, in native. Null when the row spans several. */
  chain?: string | null;
}

/**
 * Collapse native BTC and cbBTC into one "Bitcoin" row, in fintech only.
 *
 * Both are pegged 1:1 to Bitcoin, so their amounts add directly. Correct with
 * or without a native leg: with only cbBTC present this is a no-op, and the
 * day the bc1q indexer surfaces native BTC the two rows fuse with no further
 * wiring. The merged row keeps cbBTC's identity where there is one — it is the
 * leg with catalogue metadata and the one a swap can reach.
 */
export function mergeBtcFamilyRows<T extends HoldingRow>(rows: readonly T[], mode: DisplayMode): T[] {
  if (!shouldAggregateBtcFamily(mode)) return rows as T[];
  const family = rows.filter((r) => isBtcFamilySymbol(r.symbol));
  if (family.length <= 1) return rows as T[];

  const identity = family.find((r) => isFastBtc(r.symbol)) ?? family[0];
  const amount = family.reduce((sum, r) => sum + r.amount, 0);
  // One unpriced leg makes the whole row unpriced rather than quietly smaller.
  const usd = family.some((r) => r.usd === null) ? null : family.reduce((sum, r) => sum + (r.usd ?? 0), 0);

  const merged = { ...identity, key: "btc-family", symbol: "BTC", amount, usd, chain: null } as T;
  return [...rows.filter((r) => !isBtcFamilySymbol(r.symbol)), merged].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
}
