/**
 * The two browser wallets, through the providers they inject.
 *
 * WHAT THIS IS NOT
 *
 * It is not a wallet. Nothing here makes a key, reads a key, stores a key or
 * asks for a phrase, and nothing ever will. The creator's wallet holds the
 * key; we ask it for an address and for a signature over words we wrote, and
 * that is the whole of the contact. HiSpace is non-custodial by construction —
 * the sponsor's wallet pays the creator's address in one transaction the
 * SPONSOR signs — so a creator signs nothing on chain, ever. The signature
 * here moves no money, needs no balance and touches no chain: it is how they
 * prove an address is theirs, instead of typing it into a box where a typo
 * pays a stranger for ever.
 *
 * WHY NO LIBRARY
 *
 * A wallet adapter would be three dependencies and a bundle for one call to
 * each of two providers. Phantom is `window.solana` and MetaMask is
 * `window.ethereum`, both injected, both EIP-1193 shaped enough for this.
 * `bs58` is not in this repo's tree, so the 40 lines that encode 64 bytes are
 * written out below rather than installed.
 */

"use client";

import { creatorDemoEnabled, DEMO_WALLETS } from "./demo";

/*
 * Local demo mode (./demo) answers the four calls below at once, with a demo
 * address and a signature the mock accepts, so the real screens can be
 * clicked through with no Phantom or MetaMask installed. A short wait keeps
 * the "Waiting for your wallet…" states visible for a moment.
 */
function demoWallet<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 400));
}

/* ── Provider shapes ──────────────────────────────────────────────── */

interface SolanaProvider {
  isPhantom?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
}

interface EvmProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  providers?: EvmProvider[];
}

/**
 * The injected objects, reached by a cast rather than by `declare global`.
 *
 * The Founder Pass checkout already declares `window.phantom` with only its
 * `ethereum` half on it, and TypeScript's declaration merging insists every
 * spelling of a global agrees exactly — so widening it here would break that
 * file instead of describing this one. A local type says what we look for and
 * owns nothing.
 */
type InjectedWindow = Window & {
  solana?: SolanaProvider;
  phantom?: { solana?: SolanaProvider };
  ethereum?: EvmProvider;
};

function injected(): InjectedWindow | null {
  return typeof window === "undefined" ? null : (window as InjectedWindow);
}

/**
 * What a wallet did instead of what we asked.
 *
 * `missing` and `rejected` are the two a creator meets constantly and neither
 * is an error in any useful sense: one means install something, the other
 * means they changed their mind. They get their own sentences upstream rather
 * than a shared "failed".
 */
export type WalletFailure = "missing" | "rejected" | "failed";

export class WalletError extends Error {
  constructor(
    readonly reason: WalletFailure,
    readonly wallet: "phantom" | "metamask",
  ) {
    super(reason);
    this.name = "WalletError";
  }
}

/** EIP-1193's "the person said no", which Phantom uses too. */
function isRejection(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === 4001 || code === "ACTION_REJECTED";
}

/* ── base58, because 64 bytes have to reach the server as a string ── */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Bytes to base58, the way `bs58.encode` does it.
 *
 * The leading zero bytes are the part that is easy to get wrong: they carry no
 * value, so the arithmetic drops them, and each one has to be written back as
 * a literal "1". A signature that lost one decodes to 63 bytes and the
 * server's `nacl.sign.detached.verify` refuses it.
 */
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += B58[digits[i]];
  return out;
}

/** UTF-8 to `0x…`, which is the form `personal_sign` documents for its message. */
function hexMessage(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/* ── Solana (Phantom, and anything that injects the same object) ──── */

function solanaProvider(): SolanaProvider {
  const provider = findSolana();
  if (!provider) throw new WalletError("missing", "phantom");
  return provider;
}

/** Phantom's own namespace first: `window.solana` is what every other Solana
 *  extension also claims, and the last one loaded wins it. */
function findSolana(): SolanaProvider | undefined {
  const w = injected();
  return w?.phantom?.solana ?? w?.solana;
}

export function hasSolanaWallet(): boolean {
  if (creatorDemoEnabled()) return true;
  return !!findSolana();
}

export async function connectSolana(): Promise<string> {
  if (creatorDemoEnabled()) return demoWallet(DEMO_WALLETS.solana);
  const provider = solanaProvider();
  try {
    const { publicKey } = await provider.connect();
    return publicKey.toString();
  } catch (e) {
    throw new WalletError(isRejection(e) ? "rejected" : "failed", "phantom");
  }
}

/**
 * Sign the server's words, exactly as the server wrote them.
 *
 * `"utf8"` tells Phantom to show the message as text rather than as bytes,
 * which matters more than it sounds: the message says in plain words that
 * signing costs nothing and moves nothing, and being asked to approve a wall
 * of hex is where people close the tab.
 */
export async function signSolanaMessage(message: string): Promise<string> {
  if (creatorDemoEnabled()) return demoWallet(`demo-signature-${message.length}`);
  const provider = solanaProvider();
  try {
    const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
    return base58Encode(signature);
  } catch (e) {
    throw new WalletError(isRejection(e) ? "rejected" : "failed", "phantom");
  }
}

/* ── EVM (MetaMask, and any other EIP-1193 provider) ──────────────── */

function evmProvider(): EvmProvider {
  const found = injected()?.ethereum;
  if (!found) throw new WalletError("missing", "metamask");
  // Several wallets installed at once fight over `window.ethereum` and the
  // loser lists itself in `providers`. Prefer MetaMask when it is in there;
  // otherwise whatever won is what the creator meant to use.
  return found.providers?.find((p) => p.isMetaMask) ?? found;
}

export function hasEvmWallet(): boolean {
  if (creatorDemoEnabled()) return true;
  return !!injected()?.ethereum;
}

export async function connectEvm(): Promise<string> {
  if (creatorDemoEnabled()) return demoWallet(DEMO_WALLETS.evm);
  const provider = evmProvider();
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) throw new WalletError("rejected", "metamask");
    return address;
  } catch (e) {
    if (e instanceof WalletError) throw e;
    throw new WalletError(isRejection(e) ? "rejected" : "failed", "metamask");
  }
}

/**
 * `personal_sign`, whose parameters are the message first and the address
 * second — the opposite way round from `eth_signTypedData_v4`, and the usual
 * cause of a wallet answering "invalid params" to a request that looks right.
 */
export async function signEvmMessage(address: string, message: string): Promise<string> {
  if (creatorDemoEnabled()) return demoWallet(`0xdemo${message.length.toString(16)}`);
  const provider = evmProvider();
  try {
    return (await provider.request({ method: "personal_sign", params: [hexMessage(message), address] })) as string;
  } catch (e) {
    throw new WalletError(isRejection(e) ? "rejected" : "failed", "metamask");
  }
}

/** What the wallet did, said to the creator. */
export function describeWalletError(e: unknown): string {
  if (!(e instanceof WalletError)) return "Your wallet could not be reached. Try again.";
  const name = e.wallet === "phantom" ? "Phantom" : "MetaMask";
  switch (e.reason) {
    case "missing":
      return e.wallet === "phantom"
        ? "No Solana wallet found in this browser. Install Phantom, or open this page in Phantom's own browser."
        : "No Ethereum wallet found in this browser. Install MetaMask, or open this page in your wallet's own browser.";
    case "rejected":
      return `You turned that down in ${name}. Nothing was sent, and nothing moved either way.`;
    default:
      return `${name} could not complete that. Try again.`;
  }
}
