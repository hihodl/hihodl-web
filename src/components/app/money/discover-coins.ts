/**
 * What Invest offers to someone who owns none of it yet.
 *
 * `src/features/invest/discoverCoins.ts` in the app, read off it rather than
 * rewritten. Two rules it exists to keep, both of which survive the port:
 *
 * EVERY TILE IS ONE TAP FROM A FILLED ORDER. That is why the shelf is shorter
 * than a CoinMarketCap top 20. Most of the missing names are missing because
 * their only venue is a wrapper with no liquidity behind it, or because they
 * are their own chain with no address for us to receive at. A tile is a
 * promise.
 *
 * A WRAPPER KEEPS ITS OWN NAME. `wrappedBy` is set only where the tile is not
 * the asset itself: cbBTC is Coinbase's claim on Bitcoin and the BNB on Solana
 * is Wormhole's, and somebody buying one should not be told they bought the
 * other.
 *
 * Order is the app's: Bitcoin, Ethereum and Solana first because they are the
 * three names a first-time buyer arrives already knowing, then by market cap.
 *
 * The Bitcoin tile is the WRAPPER here. The app swaps in native Bitcoin when
 * `NATIVE_BTC_CONVERT` is on, which is a device-side flag the web cannot read —
 * and the wrapper is the honest default, because it is what the shelf offers
 * with the flag off.
 */

export interface DiscoverCoin {
  id: string;
  symbol: string;
  name: string;
  /** Set only when the tile is a claim on the asset rather than the asset. */
  wrappedBy?: string;
}

export const DISCOVER_COINS: readonly DiscoverCoin[] = [
  { id: "cbBTC.solana", symbol: "BTC", name: "Bitcoin", wrappedBy: "Coinbase" },
  { id: "ETH.native", symbol: "ETH", name: "Ethereum" },
  { id: "SOL.native", symbol: "SOL", name: "Solana" },
  { id: "BNB.solana", symbol: "BNB", name: "BNB", wrappedBy: "Wormhole" },
  { id: "LINK.native", symbol: "LINK", name: "Chainlink" },
  { id: "UNI.native", symbol: "UNI", name: "Uniswap" },
  { id: "NEAR.native", symbol: "NEAR", name: "NEAR Protocol" },
  { id: "AAVE.native", symbol: "AAVE", name: "Aave" },
  { id: "PUMP.token", symbol: "PUMP", name: "Pump" },
  { id: "ONDO.token", symbol: "ONDO", name: "Ondo" },
  { id: "MORPHO.token", symbol: "MORPHO", name: "Morpho" },
  { id: "POL.native", symbol: "POL", name: "Polygon" },
  { id: "JUP.token", symbol: "JUP", name: "Jupiter" },
  { id: "PENGU.token", symbol: "PENGU", name: "Pudgy Penguins" },
  { id: "ETHFI.token", symbol: "ETHFI", name: "Ether.fi" },
];

/**
 * The tile's second line: the asset's name, and only that. BNB is the exception
 * the rule needs — its name IS its ticker, so the issuer is the only fact left
 * worth printing.
 */
export function tileSubtitle(coin: DiscoverCoin): string {
  if (coin.name !== coin.symbol) return coin.name;
  return coin.wrappedBy ? `via ${coin.wrappedBy}` : coin.name;
}

/**
 * Coins already held are dropped: the Assets list above is already showing them
 * with a real balance. Matched on the display symbol, so holding cbBTC removes
 * the Bitcoin tile — they are the same investment to the person looking.
 */
export function discoverableFor(
  held: ReadonlyArray<{ symbol: string }>,
  coins: readonly DiscoverCoin[] = DISCOVER_COINS,
): DiscoverCoin[] {
  const owned = new Set<string>();
  for (const p of held) {
    const s = p.symbol?.toUpperCase();
    if (!s) continue;
    owned.add(s);
    if (s === "CBBTC" || s === "WBTC") owned.add("BTC");
    if (s === "WBNB") owned.add("BNB");
  }
  return coins.filter((c) => !owned.has(c.symbol.toUpperCase()));
}
