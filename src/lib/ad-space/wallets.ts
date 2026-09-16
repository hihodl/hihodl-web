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
  /** Phantom, Solflare and Backpack answer `{ signature }`; some wallets the bytes alone. */
  signMessage?(message: Uint8Array, display?: string): Promise<unknown>;
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

/* ── Signing a plain-text message (the offers funds check) ─────────────── */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Bytes to base58 (Bitcoin alphabet), as Solana writes signatures. */
export function base58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  // All-zero input: the leading "1"s already say it, and the lone 0 digit must not add another.
  return bytes.every((b) => b === 0) ? out.slice(0, bytes.length) : out;
}

/** UTF-8 text as a 0x hex string, which is what `personal_sign` takes. */
export function utf8Hex(text: string): string {
  return `0x${Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Connect a Solana wallet and sign `message` as UTF-8. Answers the address that
 * signed and the base58 signature, or throws when the wallet can't sign messages.
 */
export async function signSolanaMessage(
  provider: SolanaProvider,
  message: string,
): Promise<{ address: string; signature: string }> {
  if (typeof provider.signMessage !== "function") throw new Error("sign_message_unsupported");
  const connected = (await provider.connect()) as { publicKey?: { toString(): string } } | undefined;
  const address = (connected?.publicKey ?? provider.publicKey)?.toString();
  if (!address) throw new Error("no_account");
  const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
  const raw = signed instanceof Uint8Array ? signed : (signed as { signature?: unknown })?.signature;
  if (!(raw instanceof Uint8Array) || raw.length !== 64) throw new Error("no_signature");
  return { address, signature: base58(raw) };
}

/** The first account of an EIP-1193 wallet, asking to connect. */
export async function evmAccount(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("no_account");
  return address;
}

/** `personal_sign` of plain text. The server recovers the address from it. */
export async function signEvmMessage(provider: Eip1193Provider, address: string, message: string): Promise<string> {
  const signature = await provider.request({ method: "personal_sign", params: [utf8Hex(message), address] });
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) throw new Error("no_signature");
  return signature;
}
