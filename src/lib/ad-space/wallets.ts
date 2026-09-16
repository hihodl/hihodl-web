/**
 * Browser wallets, as the public checkouts reach them: injected Solana wallets
 * (Phantom, Solflare, Backpack) and any EIP-1193 wallet for Base and Polygon.
 * Shared by the HiSpace checkout and pay links. Client side only.
 */

import type { EvmPayload } from "./types";

export interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toString(): string } | null;
  connect(opts?: unknown): Promise<unknown>;
  signAndSendTransaction(tx: unknown, opts?: unknown): Promise<unknown>;
}

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export type InjectedWindow = {
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  backpack?: SolanaProvider;
  solana?: SolanaProvider;
  ethereum?: Eip1193Provider;
};

export type SolanaWallet = { name: string; provider: SolanaProvider };

export function injected(): InjectedWindow {
  return window as unknown as InjectedWindow;
}

export function detectSolanaWallets(): SolanaWallet[] {
  const w = injected();
  const found: SolanaWallet[] = [];
  const seen = new Set<SolanaProvider>();
  const add = (name: string, p: SolanaProvider | undefined) => {
    if (!p || seen.has(p) || typeof p.signAndSendTransaction !== "function") return;
    if (found.some((f) => f.name === name)) return;
    seen.add(p);
    found.push({ name, provider: p });
  };
  add("Phantom", w.phantom?.solana);
  add("Solflare", w.solflare);
  add("Backpack", w.backpack);
  const generic = w.solana;
  if (generic) {
    add(
      generic.isPhantom ? "Phantom" : generic.isSolflare ? "Solflare" : generic.isBackpack ? "Backpack" : "your wallet",
      generic,
    );
  }
  return found;
}

export function blockhashExpired(e: unknown): boolean {
  const msg = String((e as { message?: unknown })?.message ?? "");
  return /blockhash|block height exceeded|expired/i.test(msg);
}

export function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** EIP712Domain lists exactly the keys present in `domain`, in the standard order. */
const DOMAIN_FIELDS: [string, string][] = [
  ["name", "string"],
  ["version", "string"],
  ["chainId", "uint256"],
  ["verifyingContract", "address"],
  ["salt", "bytes32"],
];

export function typedData(evm: Pick<EvmPayload, "domain" | "types" | "primaryType">, message: Record<string, string>): string {
  const EIP712Domain = DOMAIN_FIELDS.filter(([k]) => k in evm.domain).map(([name, type]) => ({ name, type }));
  return JSON.stringify({
    domain: evm.domain,
    types: { EIP712Domain, ...evm.types },
    primaryType: evm.primaryType,
    message,
  });
}


/**
 * Point an EIP-1193 wallet at a chain, adding it first when the wallet does
 * not know it (4902).
 */
export async function switchEvmChain(
  provider: Eip1193Provider,
  meta: { chainIdHex: string; addChainParams: Record<string, unknown> },
): Promise<void> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: meta.chainIdHex }] });
  } catch (switchError) {
    if ((switchError as { code?: number })?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: meta.chainIdHex, ...meta.addChainParams }],
      });
    } else {
      throw switchError;
    }
  }
}
