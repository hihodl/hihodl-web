/**
 * The slice of chain metadata the browser is allowed to have.
 *
 * Kept apart from `config.ts` on purpose. That module reads RPC endpoints and
 * the treasury xpub out of the environment, and the way to guarantee none of it
 * is ever pulled into a client bundle is for no client component to import it.
 * A wallet needs a chain id, a token address and a name — that is all this is.
 */

export interface PublicChain {
  key: "base" | "polygon";
  label: string;
  chainId: number;
  chainIdHex: string;
  usdc: string;
  usdcDecimals: number;
  /** Only used if the wallet does not already know the chain. */
  addChainParams: {
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  };
}

export const PUBLIC_CHAINS: Record<"base" | "polygon", PublicChain> = {
  base: {
    key: "base",
    label: "Base",
    chainId: 8453,
    chainIdHex: "0x2105",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
    addChainParams: {
      chainName: "Base",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://mainnet.base.org"],
      blockExplorerUrls: ["https://basescan.org"],
    },
  },
  polygon: {
    key: "polygon",
    label: "Polygon",
    chainId: 137,
    chainIdHex: "0x89",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcDecimals: 6,
    addChainParams: {
      chainName: "Polygon",
      nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
      rpcUrls: ["https://polygon-rpc.com"],
      blockExplorerUrls: ["https://polygonscan.com"],
    },
  },
};

/** ERC-20 `transfer(address,uint256)` calldata. Hand-encoded so the checkout
 *  page ships no ABI library at all. */
export function encodeErc20Transfer(to: string, amountBaseUnits: bigint): string {
  const selector = "a9059cbb";
  const paddedTo = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const paddedAmount = amountBaseUnits.toString(16).padStart(64, "0");
  return `0x${selector}${paddedTo}${paddedAmount}`;
}

/** A decimal amount string ("99", "79.5") into token base units. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}
