"use client";

import type { Eip1193Provider } from "@/lib/ad-space/wallets";

/**
 * WalletConnect for a payer on Base or Polygon whose wallet is not in this
 * browser: MetaMask, Coinbase Wallet, Trust, Rainbow and the rest on a phone,
 * from Safari or Chrome, or any of them scanning a code from a computer.
 *
 * It hands back an EIP-1193 provider, so the pay page signs the same one
 * ERC-3009 authorization it asks an injected wallet for; nothing on the
 * server changes. Solana is not offered here: Solana Pay already reaches every
 * Solana wallet on a phone, and Phantom does not speak WalletConnect.
 *
 * Off until `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set (cloud.reown.com).
 * The library is loaded only when a payer asks for it.
 */

export function walletConnectProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  return id ? id : null;
}

type WcProvider = Eip1193Provider & {
  session?: unknown;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, cb: (...args: unknown[]) => void): void;
};

let cached: Promise<WcProvider> | null = null;

/** Base and Polygon, the two chains a pay link signs on. */
const CHAIN_IDS = [8453, 137] as const;

async function init(projectId: string): Promise<WcProvider> {
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const origin = window.location.origin;
  const provider = (await EthereumProvider.init({
    projectId,
    // Optional, not required: a wallet that lacks Polygon can still pay on Base.
    optionalChains: [...CHAIN_IDS],
    showQrModal: true,
    metadata: {
      name: "HOLD",
      description: "Pay in USDC from any wallet.",
      url: origin,
      icons: [`${origin}/icon.png`],
    },
  })) as unknown as WcProvider;
  // A session the wallet ended leaves nothing to reuse.
  provider.on("disconnect", () => {
    cached = null;
  });
  return provider;
}

/**
 * The payer's wallet over WalletConnect, connected. Opens the wallet list (a QR
 * on a computer, the installed wallets on a phone) unless a session from
 * earlier on this page is still alive. Rejects when the payer closes the list.
 */
export async function connectWalletConnect(): Promise<Eip1193Provider> {
  const projectId = walletConnectProjectId();
  if (!projectId) throw new Error("walletconnect_off");
  if (!cached) cached = init(projectId);
  let provider: WcProvider;
  try {
    provider = await cached;
  } catch (e) {
    cached = null;
    throw e;
  }
  if (!provider.session) await provider.connect();
  return provider;
}

/** The payer closed the wallet list, or the wallet refused: not an error to show. */
export function isWalletConnectDismissed(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /connection request reset|modal closed|user closed|proposal expired/i.test(msg);
}
