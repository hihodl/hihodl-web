"use client";

import { base58Decode, base64ToBytes, bytesToBase64, type Eip1193Provider, type SolanaProvider } from "@/lib/ad-space/wallets";

/**
 * WalletConnect for a payer on Base or Polygon whose wallet is not in this
 * browser: MetaMask, Coinbase Wallet, Trust, Rainbow and the rest on a phone,
 * from Safari or Chrome, or any of them scanning a code from a computer.
 *
 * It hands back an EIP-1193 provider, so the pay page signs the same one
 * ERC-3009 authorization it asks an injected wallet for; nothing on the
 * server changes.
 *
 * Solana over WalletConnect is for a wallet Solana Pay does not reach: Ledger
 * Wallet (formerly Ledger Live), which pays from the Ledger device and speaks
 * `solana_signTransaction` (LedgerHQ/wallet-connect-live-app, read
 * 27-Sep-2026). Phantom and Solflare keep Solana Pay and their own browsers.
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
  removeListener?(event: string, cb: (...args: unknown[]) => void): void;
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
    // The page draws the pairing code itself (HOLD's QR), from `display_uri`.
    showQrModal: false,
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
 * The payer's wallet over WalletConnect, connected. `onUri` receives the
 * pairing link as soon as there is one: the page shows it as a QR for a
 * wallet on another device. Reuses a session from earlier on this page.
 */
export async function connectWalletConnect(onUri?: (uri: string) => void): Promise<Eip1193Provider> {
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
  if (!provider.session) {
    const listener = (uri: unknown) => {
      if (typeof uri === "string" && onUri) onUri(uri);
    };
    provider.on("display_uri", listener);
    try {
      await provider.connect();
    } finally {
      provider.removeListener?.("display_uri", listener);
    }
  }
  return provider;
}

/** The payer closed the wallet list, or the wallet refused: not an error to show. */
export function isWalletConnectDismissed(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /connection request reset|modal closed|user closed|proposal expired/i.test(msg);
}

/* ── Solana ─────────────────────────────────────────────────────── */

/** Solana mainnet, as CAIP-2 names it (the genesis hash, truncated). */
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

type SolanaSession = { namespaces?: Record<string, { accounts?: string[] }> };

type UniversalLike = {
  session?: SolanaSession;
  connect(opts: { optionalNamespaces: Record<string, { methods: string[]; chains: string[]; events: string[] }> }): Promise<unknown>;
  request<T>(args: { method: string; params: unknown }, chain?: string): Promise<T>;
  on(event: string, cb: (...args: unknown[]) => void): void;
  removeListener?(event: string, cb: (...args: unknown[]) => void): void;
};

let solanaCached: Promise<UniversalLike> | null = null;

async function initSolana(projectId: string): Promise<UniversalLike> {
  const { UniversalProvider } = await import("@walletconnect/universal-provider");
  const origin = window.location.origin;
  const provider = (await UniversalProvider.init({
    projectId,
    metadata: {
      name: "HOLD",
      description: "Pay in USDC from any wallet.",
      url: origin,
      icons: [`${origin}/icon.png`],
    },
  })) as unknown as UniversalLike;
  provider.on("session_delete", () => {
    solanaCached = null;
  });
  return provider;
}

function solanaAddressOf(session: SolanaSession | undefined): string | null {
  const account = session?.namespaces?.solana?.accounts?.find((a) => a.startsWith(`${SOLANA_MAINNET}:`));
  return account ? account.slice(SOLANA_MAINNET.length + 1) : null;
}

/**
 * A Solana wallet over WalletConnect, shaped like an injected one: connected,
 * `signTransaction` answering the signed bytes (the pay page's wallet-first
 * order) and `signAndSendTransaction` for a server that has not got it.
 * `onUri` receives the pairing link: a QR, or `ledgerLiveUrl` on a phone.
 */
export async function connectWalletConnectSolana(onUri?: (uri: string) => void): Promise<SolanaProvider> {
  const projectId = walletConnectProjectId();
  if (!projectId) throw new Error("walletconnect_off");
  if (!solanaCached) solanaCached = initSolana(projectId);
  let provider: UniversalLike;
  try {
    provider = await solanaCached;
  } catch (e) {
    solanaCached = null;
    throw e;
  }
  if (!solanaAddressOf(provider.session)) {
    const listener = (uri: unknown) => {
      if (typeof uri === "string" && onUri) onUri(uri);
    };
    provider.on("display_uri", listener);
    try {
      await provider.connect({
        optionalNamespaces: {
          solana: { methods: ["solana_signTransaction", "solana_signAndSendTransaction"], chains: [SOLANA_MAINNET], events: [] },
        },
      });
    } finally {
      provider.removeListener?.("display_uri", listener);
    }
  }
  const address = solanaAddressOf(provider.session);
  if (!address) throw new Error("no_account");
  const publicKey = { toString: () => address };
  const serialized = (tx: unknown) => bytesToBase64((tx as { serialize(): Uint8Array }).serialize());

  return {
    publicKey,
    async connect() {
      return { publicKey };
    },
    async signTransaction(tx: unknown) {
      const out = await provider.request<{ signature?: string; transaction?: string }>(
        { method: "solana_signTransaction", params: { transaction: serialized(tx), pubkey: address } },
        SOLANA_MAINNET,
      );
      // Ledger answers the whole signed transaction; its `signature` is the
      // first slot, which on a pay link is our fee payer's, still empty.
      if (out?.transaction) return base64ToBytes(out.transaction);
      if (!out?.signature) throw new Error("no_signature");
      // A wallet that answers only its signature: put it in its own slot.
      const signature = base58Decode(out.signature);
      if (!signature || signature.length !== 64) throw new Error("no_signature");
      const { VersionedTransaction } = await import("@solana/web3.js");
      const signed = VersionedTransaction.deserialize((tx as { serialize(): Uint8Array }).serialize());
      const keys = signed.message.staticAccountKeys.slice(0, signed.message.header.numRequiredSignatures);
      const at = keys.findIndex((k) => k.toBase58() === address);
      if (at < 0) throw new Error("no_signature");
      signed.signatures[at] = signature;
      return signed.serialize();
    },
    async signAndSendTransaction(tx: unknown) {
      const out = await provider.request<{ signature?: string }>(
        { method: "solana_signAndSendTransaction", params: { transaction: serialized(tx), pubkey: address } },
        SOLANA_MAINNET,
      );
      if (!out?.signature) throw new Error("no_signature");
      return { signature: out.signature };
    },
  };
}

/**
 * Ledger Wallet's own link for a WalletConnect pairing (`ledgerlive://wc?uri=`,
 * as its WalletConnect app reads it): the app opens on the connection.
 */
export function ledgerLiveUrl(wcUri: string): string {
  return `ledgerlive://wc?uri=${encodeURIComponent(wcUri)}`;
}
