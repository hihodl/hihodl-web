/**
 * Settlement configuration for Founder Pass orders.
 *
 * WHY ONLY EVM CHAINS SETTLE THIS.
 * The one-address-per-order rule needs addresses derived from a WATCH-ONLY key,
 * so that this web app can mint receiving addresses and can never spend what
 * lands on them. BIP-32 gives us that on every EVM chain: an account-level xpub
 * derives the whole external chain with no private material present.
 *
 * Solana cannot do it. ed25519 derivation (SLIP-0010) is hardened-only, so
 * there is no public-key-only path — deriving a fresh Solana address per order
 * would mean putting the seed on a Vercel function. We are not doing that for a
 * $99 checkout. Solana holders pay by bridging or by card; the pass is the same
 * pass either way.
 *
 * Everything here reads from the environment. Nothing in this file, and nothing
 * that imports it, may be pulled into a client component: the xpub is not a
 * secret that loses us money, but the RPC keys are, and the whole module is
 * server-only by construction (no "use client" file imports it).
 */

export type SettlementChain = "base" | "polygon";

export interface ChainConfig {
  key: SettlementChain;
  label: string;
  chainId: number;
  /** EIP-681 / wallet deep-link chain namespace, for the payment QR. */
  caip2: string;
  /** USDC contract. 6 decimals on both chains. */
  usdc: `0x${string}`;
  usdcDecimals: number;
  /** Confirmations before an order flips from `confirming` to `paid`. */
  minConfirmations: number;
  /** Roughly how long that takes, for the UI to set an expectation. */
  approxConfirmSeconds: number;
  explorerTxUrl: (hash: string) => string;
}

export const CHAINS: Record<SettlementChain, ChainConfig> = {
  base: {
    key: "base",
    label: "Base",
    chainId: 8453,
    caip2: "eip155:8453",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
    minConfirmations: Number(process.env.BASE_MIN_CONFIRMATIONS ?? 6),
    approxConfirmSeconds: 15,
    explorerTxUrl: (h) => `https://basescan.org/tx/${h}`,
  },
  polygon: {
    key: "polygon",
    label: "Polygon",
    chainId: 137,
    caip2: "eip155:137",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcDecimals: 6,
    minConfirmations: Number(process.env.POLYGON_MIN_CONFIRMATIONS ?? 20),
    approxConfirmSeconds: 45,
    explorerTxUrl: (h) => `https://polygonscan.com/tx/${h}`,
  },
};

export const DEFAULT_SETTLEMENT_CHAIN: SettlementChain = "base";

export function isSettlementChain(value: unknown): value is SettlementChain {
  return value === "base" || value === "polygon";
}

/** RPC endpoint for a chain. Server-side only — these carry provider keys. */
export function rpcUrl(chain: SettlementChain): string {
  const url =
    chain === "base" ? process.env.BASE_RPC_URL : process.env.POLYGON_RPC_URL;
  if (!url) {
    throw new Error(
      `Missing RPC endpoint for ${chain}. Set ${chain === "base" ? "BASE_RPC_URL" : "POLYGON_RPC_URL"}.`,
    );
  }
  return url;
}

/**
 * Account-level extended PUBLIC key for the Founder Pass treasury,
 * m/44'/60'/A'. Public by nature: it derives receiving addresses and cannot
 * sign. Sweeping is a treasury operation done from the device holding the seed.
 */
export function treasuryXpub(): string {
  const xpub = process.env.FOUNDER_TREASURY_XPUB;
  if (!xpub) {
    throw new Error(
      "Missing FOUNDER_TREASURY_XPUB. Expected an account-level BIP-32 extended PUBLIC key (m/44'/60'/A').",
    );
  }
  return xpub;
}

/** Which BIP-44 account the xpub above sits at. Recorded on every order so a
 *  sweep knows the full path to sign. */
export function treasuryAccountIndex(): number {
  return Number(process.env.FOUNDER_TREASURY_ACCOUNT_INDEX ?? 0);
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.hihodl.xyz";
