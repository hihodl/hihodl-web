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

/** `icon` is the wallet's own image (a data: URI) when it announced one. */
export type SolanaWallet = { name: string; provider: SolanaProvider; icon?: string | null };

/** An EVM wallet the browser announced (EIP-6963), or the lone `window.ethereum`. */
export type EvmWallet = { id: string; name: string; icon: string | null; provider: Eip1193Provider };

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

/** Connect a Solana wallet and answer its address. */
export async function connectSolana(provider: SolanaProvider): Promise<string> {
  const connected = (await provider.connect()) as { publicKey?: { toString(): string } } | undefined;
  const address = (connected?.publicKey ?? provider.publicKey)?.toString();
  if (!address) throw new Error("no_account");
  return address;
}

/** Whether a Solana wallet can sign a plain message (the funds check needs it). */
export function canSignMessage(provider: SolanaProvider): boolean {
  return typeof provider.signMessage === "function";
}

/** Sign `message` as UTF-8 with a connected Solana wallet: the base58 signature. */
export async function signSolanaMessage(provider: SolanaProvider, message: string): Promise<string> {
  if (typeof provider.signMessage !== "function") throw new Error("sign_message_unsupported");
  const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
  const raw = signed instanceof Uint8Array ? signed : (signed as { signature?: unknown })?.signature;
  if (!(raw instanceof Uint8Array) || raw.length !== 64) throw new Error("no_signature");
  return base58(raw);
}

/** The first account of an EIP-1193 wallet, asking to connect. */
export async function evmAccount(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("no_account");
  return address;
}

/**
 * `personal_sign` of plain text. The server recovers the address from it, or,
 * for a smart-contract wallet on Base, asks the wallet itself (EIP-1271). So any
 * hex signature is passed on as it comes, whatever its length: nothing here
 * decides which wallets may check their funds.
 */
export async function signEvmMessage(provider: Eip1193Provider, address: string, message: string): Promise<string> {
  const signature = await provider.request({ method: "personal_sign", params: [utf8Hex(message), address] });
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) throw new Error("no_signature");
  return signature;
}

/* ── Finding every wallet this browser has ───────────────────────────────── */

/**
 * Wallet Standard (Solana) and EIP-6963 (EVM): the two ways a browser wallet
 * says "I am here", with its own name and icon, so the page lists the wallets
 * the sponsor actually has instead of guessing from `window` globals.
 *
 * A Solana wallet that is ALSO injected the old way (Phantom, Solflare,
 * Backpack) keeps its injected provider, the path the checkout has always
 * paid through, and only borrows the announced icon. A wallet that exists only
 * through the standard gets a thin adapter below.
 */

interface StandardAccount {
  address: string;
  chains?: readonly string[];
}

interface StandardWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
}

type StandardConnect = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly StandardAccount[] }> };
type StandardSignAndSend = {
  signAndSendTransaction(
    ...inputs: { account: StandardAccount; chain: string; transaction: Uint8Array }[]
  ): Promise<readonly { signature: Uint8Array }[]>;
};
type StandardSignMessage = {
  signMessage(...inputs: { account: StandardAccount; message: Uint8Array }[]): Promise<readonly { signature: Uint8Array }[]>;
};

const SOLANA_MAINNET = "solana:mainnet";

function standardCanPay(w: StandardWallet): boolean {
  return (
    Array.isArray(w.chains) &&
    w.chains.includes(SOLANA_MAINNET) &&
    Boolean(w.features?.["standard:connect"]) &&
    Boolean(w.features?.["solana:signAndSendTransaction"])
  );
}

/** A Wallet Standard wallet, shaped like the injected providers the checkout already speaks to. */
function standardProvider(w: StandardWallet): SolanaProvider {
  let account: StandardAccount | null = w.accounts[0] ?? null;
  const signMessage = w.features["solana:signMessage"] as StandardSignMessage | undefined;
  const provider: SolanaProvider = {
    publicKey: account ? { toString: () => account!.address } : null,
    async connect() {
      const res = await (w.features["standard:connect"] as StandardConnect).connect();
      account = res?.accounts?.[0] ?? w.accounts[0] ?? null;
      if (!account) throw new Error("no_account");
      const address = account.address;
      provider.publicKey = { toString: () => address };
      return { publicKey: provider.publicKey };
    },
    async signAndSendTransaction(tx: unknown) {
      if (!account) throw new Error("no_account");
      const bytes = (tx as { serialize(): Uint8Array }).serialize();
      const [out] = await (w.features["solana:signAndSendTransaction"] as StandardSignAndSend).signAndSendTransaction({
        account,
        chain: SOLANA_MAINNET,
        transaction: bytes,
      });
      if (!out?.signature) throw new Error("no_signature");
      return { signature: base58(out.signature) };
    },
  };
  if (signMessage) {
    provider.signMessage = async (message: Uint8Array) => {
      if (!account) throw new Error("no_account");
      const [out] = await signMessage.signMessage({ account, message });
      return { signature: out?.signature };
    };
  }
  return provider;
}

/**
 * Every Solana wallet that can pay from this browser, kept current as wallets
 * register late (extensions inject after the page). Answers a stop function.
 */
export function watchSolanaWallets(onChange: (wallets: SolanaWallet[]) => void): () => void {
  const standard = new Set<StandardWallet>();
  const emit = () => {
    const legacy = detectSolanaWallets();
    const out = [...legacy];
    let added = false;
    for (const w of standard) {
      if (!standardCanPay(w)) continue;
      const same = out.find((l) => l.name.toLowerCase() === w.name.toLowerCase());
      if (same) {
        same.icon = same.icon ?? w.icon ?? null;
        continue;
      }
      added = true;
      out.push({ name: w.name, icon: w.icon ?? null, provider: standardProvider(w) });
    }
    // An unnamed injected `window.solana` is one of the wallets that announced
    // itself by name; listing both would show the same wallet twice.
    onChange(added ? out.filter((w) => w.name !== "your wallet") : out);
  };
  const api = {
    register(...wallets: StandardWallet[]) {
      wallets.forEach((w) => standard.add(w));
      emit();
      return () => {
        wallets.forEach((w) => standard.delete(w));
        emit();
      };
    },
  };
  const onRegister = (e: Event) => {
    const cb = (e as CustomEvent<(a: typeof api) => void>).detail;
    if (typeof cb === "function") cb(api);
  };
  window.addEventListener("wallet-standard:register-wallet", onRegister);
  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  } catch {
    // An old browser without CustomEvent: the injected wallets are still listed.
  }
  emit();
  // Some extensions inject their globals a beat after the page.
  const late = window.setTimeout(emit, 600);
  return () => {
    window.removeEventListener("wallet-standard:register-wallet", onRegister);
    window.clearTimeout(late);
  };
}

type Eip6963Detail = { info?: { uuid?: string; name?: string; icon?: string; rdns?: string }; provider?: Eip1193Provider };

function injectedEvmName(p: Eip1193Provider): string {
  const f = p as { isRabby?: boolean; isCoinbaseWallet?: boolean; isMetaMask?: boolean };
  if (f.isRabby) return "Rabby";
  if (f.isCoinbaseWallet) return "Coinbase Wallet";
  if (f.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

/**
 * Every EVM wallet in this browser, by EIP-6963. A browser whose wallet does
 * not speak it (older in-app browsers) still shows its `window.ethereum`.
 */
export function watchEvmWallets(onChange: (wallets: EvmWallet[]) => void): () => void {
  const announced = new Map<string, EvmWallet>();
  const emit = () => {
    const list = [...announced.values()];
    const eth = injected().ethereum;
    if (list.length === 0 && eth) list.push({ id: "injected", name: injectedEvmName(eth), icon: null, provider: eth });
    onChange(list);
  };
  const onAnnounce = (e: Event) => {
    const d = (e as CustomEvent<Eip6963Detail>).detail;
    if (!d?.provider || typeof d.provider.request !== "function") return;
    const id = d.info?.uuid ?? d.info?.rdns ?? d.info?.name ?? String(announced.size);
    // One wallet announcing twice (reloads, several frames) is still one wallet.
    const name = d.info?.name ?? "Browser wallet";
    for (const [k, w] of announced) if (w.name === name) announced.delete(k);
    announced.set(id, { id, name, icon: d.info?.icon ?? null, provider: d.provider });
    emit();
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {
    // Nothing to ask: the injected fallback below still applies.
  }
  emit();
  const late = window.setTimeout(emit, 600);
  return () => {
    window.removeEventListener("eip6963:announceProvider", onAnnounce);
    window.clearTimeout(late);
  };
}
