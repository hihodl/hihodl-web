/**
 * @hihodl/connect: HOLD on a computer, as a Solana Wallet Standard wallet
 * (hihodl-web documentation: hold-connect-v0.md, "The fourth door").
 *
 *   import { registerHoldConnect } from "@hihodl/connect";
 *   registerHoldConnect({ appName: "SP3ND" });
 *
 * From then on @solana/wallet-adapter-react (or anything built on
 * @wallet-standard/app) lists "HOLD". Connect opens app.hihodl.xyz/connect in
 * a popup; the person approves on their phone; the site gets a connect token
 * bound to its origin. Every signature is asked through the HOLD API and
 * approved on the phone: no key is ever in this page, and signing needs no
 * popup.
 *
 * Zero runtime dependencies: the Wallet Standard handshake is done by hand
 * (@wallet-standard/wallet register.ts, @wallet-standard/app wallets.ts).
 */

/* ── Types: the Wallet Standard and Solana feature shapes, kept local ─── */

type IdentifierString = `${string}:${string}`;
type TransactionVersion = "legacy" | 0;

export interface HoldWalletAccount {
  readonly address: string;
  readonly publicKey: Uint8Array;
  readonly chains: readonly IdentifierString[];
  readonly features: readonly IdentifierString[];
  readonly label?: string;
  readonly icon?: `data:image/${"svg+xml" | "webp" | "png" | "gif"};base64,${string}`;
}

interface SignTransactionInput {
  readonly account: HoldWalletAccount;
  readonly transaction: Uint8Array;
  readonly chain?: IdentifierString;
  readonly options?: { readonly preflightCommitment?: string; readonly minContextSlot?: number };
}
interface SignAndSendTransactionInput extends SignTransactionInput {
  readonly chain: IdentifierString;
  readonly options?: SignTransactionInput["options"] & { readonly commitment?: string; readonly skipPreflight?: boolean; readonly maxRetries?: number };
}
interface SignMessageInput {
  readonly account: HoldWalletAccount;
  readonly message: Uint8Array;
}

type ChangeListener = (properties: { accounts?: readonly HoldWalletAccount[] }) => void;

export interface HoldWallet {
  readonly version: "1.0.0";
  readonly name: "HOLD";
  readonly icon: `data:image/svg+xml;base64,${string}`;
  readonly chains: readonly IdentifierString[];
  readonly accounts: readonly HoldWalletAccount[];
  readonly features: {
    readonly "standard:connect": {
      readonly version: "1.0.0";
      readonly connect: (input?: { readonly silent?: boolean }) => Promise<{ readonly accounts: readonly HoldWalletAccount[] }>;
    };
    readonly "standard:disconnect": { readonly version: "1.0.0"; readonly disconnect: () => Promise<void> };
    readonly "standard:events": { readonly version: "1.0.0"; readonly on: (event: "change", listener: ChangeListener) => () => void };
    readonly "solana:signTransaction": {
      readonly version: "1.0.0";
      readonly supportedTransactionVersions: readonly TransactionVersion[];
      readonly signTransaction: (...inputs: readonly SignTransactionInput[]) => Promise<readonly { readonly signedTransaction: Uint8Array }[]>;
    };
    readonly "solana:signAndSendTransaction": {
      readonly version: "1.0.0";
      readonly supportedTransactionVersions: readonly TransactionVersion[];
      readonly signAndSendTransaction: (...inputs: readonly SignAndSendTransactionInput[]) => Promise<readonly { readonly signature: Uint8Array }[]>;
    };
    readonly "solana:signMessage": {
      readonly version: "1.0.0";
      readonly signMessage: (
        ...inputs: readonly SignMessageInput[]
      ) => Promise<readonly { readonly signedMessage: Uint8Array; readonly signature: Uint8Array; readonly signatureType: "ed25519" }[]>;
    };
  };
}

export interface HoldConnectOptions {
  /** Your site's name, shown small under its host on the connect screen. Who you are is your origin, as the browser says it. */
  appName?: string;
  /** Default https://app.hihodl.xyz/connect. */
  connectUrl?: string;
  /** Default https://api.hihodl.xyz/api/v1. */
  apiUrl?: string;
}

/** An error a wallet adapter understands: 4001 the user said no, 4100 not connected (any more). */
export class HoldConnectError extends Error {
  constructor(
    readonly code: number,
    message: string,
    /** The HTTP status behind it, when there was one. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "HoldConnectError";
  }
}

/* ── Constants ─────────────────────────────────────────────────────── */

export const HOLD_WALLET_NAME = "HOLD";
export const SOLANA_MAINNET = "solana:mainnet";
const CHAINS: readonly IdentifierString[] = [SOLANA_MAINNET];
const ACCOUNT_FEATURES: readonly IdentifierString[] = ["solana:signAndSendTransaction", "solana:signTransaction", "solana:signMessage"];

// Identical to the in-app browser's (hihodl-wallet src/features/dappBrowser/providerScript.ts):
// the HOLD wordmark in white on the brand navy, in a 96×96 tile.
const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
  '<rect width="96" height="96" rx="22" fill="#023047"/>' +
  '<g transform="translate(12 39.3) scale(0.2124)">' +
  '<path fill="#FFFFFF" fill-rule="evenodd" d="M0,1.0 H18.0 V33.5 H55.0 V1.0 H73.0 V81.0 H55.0 V48.5 H18.0 V81.0 H0 Z M88.0,41.0 a43.5,41.0 0 1,0 87.0,0 a43.5,41.0 0 1,0 -87.0,0 Z M106.0,41.0 a25.5,26.0 0 1,0 51.0,0 a25.5,26.0 0 1,0 -51.0,0 Z M189.0,1.0 H207.0 V66.0 H248.0 V81.0 H189.0 Z M259.0,1.0 H299.0 A39.5,40.0 0 0,1 299.0,81.0 H259.0 Z M277.0,16.0 H300.5 A21.0,25.0 0 0,1 300.5,66.0 H277.0 Z"/>' +
  "</g></svg>";

/** The SVG is ASCII, so btoa takes it as is. */
export const HOLD_WALLET_ICON = `data:image/svg+xml;base64,${btoa(ICON_SVG)}` as const as `data:image/svg+xml;base64,${string}`;

const DEFAULT_CONNECT_URL = "https://app.hihodl.xyz/connect";
const DEFAULT_API_URL = "https://api.hihodl.xyz/api/v1";
export const STORAGE_KEY = "hold-connect:v1";
const POLL_MS = 1_500;
/** Past expiresAt the server answers `expired` itself; this is how long we keep asking for it. */
const EXPIRY_GRACE_MS = 15_000;
const DEFAULT_REQUEST_TTL_MS = 5 * 60_000;

/* ── Bytes ─────────────────────────────────────────────────────────── */

function toBase64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function fromBase58(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) throw new Error("Invalid base58");
    for (let j = 0; j < out.length; j++) {
      carry += out[j] * 58;
      out[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      out.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== "1") break;
    out.push(0);
  }
  return Uint8Array.from(out.reverse());
}

/** A signature the server reports: base64 per the spec; base58 accepted too (how Solana usually writes one). */
function signatureBytes(s: string): Uint8Array {
  try {
    const b = fromBase64(s);
    if (b.length === 64) return b;
  } catch {
    /* not base64 */
  }
  const b = fromBase58(s);
  if (b.length !== 64) throw new HoldConnectError(-32603, "HOLD returned a signature of the wrong length.");
  return b;
}

function bytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  if (v && typeof (v as ArrayLike<number>).length === "number") return new Uint8Array(v as ArrayLike<number>);
  throw new HoldConnectError(-32602, "Expected bytes.");
}

/* ── What this site keeps: the token and the account ───────────────── */

interface Stored {
  token: string;
  address: string;
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (typeof v.token !== "string" || !v.token || typeof v.address !== "string" || !v.address) return null;
    fromBase58(v.address);
    return { token: v.token, address: v.address };
  } catch {
    return null;
  }
}

function writeStored(v: Stored | null): void {
  try {
    if (v) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: connected for this page only */
  }
}

/* ── The wallet ────────────────────────────────────────────────────── */

type Kind = "signTransaction" | "signAndSendTransaction" | "signMessage";

class HoldConnectWallet {
  #accounts: HoldWalletAccount[] = [];
  #token: string | null = null;
  #listeners = new Set<ChangeListener>();
  #connecting: Promise<{ readonly accounts: readonly HoldWalletAccount[] }> | null = null;
  readonly #appName: string | null;
  readonly #connectUrl: string;
  readonly #connectOrigin: string;
  readonly #apiUrl: string;
  readonly wallet: HoldWallet;

  constructor(opts: HoldConnectOptions) {
    this.#appName = typeof opts.appName === "string" && opts.appName.trim() ? opts.appName.trim().slice(0, 64) : null;
    this.#connectUrl = opts.connectUrl ?? DEFAULT_CONNECT_URL;
    this.#connectOrigin = new URL(this.#connectUrl).origin;
    this.#apiUrl = (opts.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.wallet = Object.freeze({
      version: "1.0.0",
      name: HOLD_WALLET_NAME,
      icon: HOLD_WALLET_ICON,
      chains: CHAINS,
      get accounts() {
        return self.#accounts.slice();
      },
      features: Object.freeze({
        "standard:connect": { version: "1.0.0", connect: (input?: { readonly silent?: boolean }) => this.#connect(input) },
        "standard:disconnect": { version: "1.0.0", disconnect: () => this.#disconnect() },
        "standard:events": { version: "1.0.0", on: (event: "change", listener: ChangeListener) => this.#on(event, listener) },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: (...inputs: readonly SignTransactionInput[]) => this.#signTransaction(inputs),
        },
        "solana:signAndSendTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signAndSendTransaction: (...inputs: readonly SignAndSendTransactionInput[]) => this.#signAndSend(inputs),
        },
        "solana:signMessage": { version: "1.0.0", signMessage: (...inputs: readonly SignMessageInput[]) => this.#signMessage(inputs) },
      }),
    } as HoldWallet);

    // Another tab of this site connected or disconnected: follow it.
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      const s = readStored();
      if (!s && this.#token) this.#set(null);
      else if (s && (s.token !== this.#token || s.address !== this.#accounts[0]?.address)) this.#set(s);
    });
  }

  #account(address: string): HoldWalletAccount {
    return Object.freeze({
      address,
      publicKey: fromBase58(address),
      chains: CHAINS,
      features: ACCOUNT_FEATURES,
      label: HOLD_WALLET_NAME,
    });
  }

  #set(s: Stored | null): void {
    this.#token = s?.token ?? null;
    this.#accounts = s ? [this.#account(s.address)] : [];
    const accounts = this.#accounts.slice();
    for (const l of this.#listeners) {
      try {
        l({ accounts });
      } catch {
        /* one listener's throw is not the others' problem */
      }
    }
  }

  #on(event: "change", listener: ChangeListener): () => void {
    if (event !== "change" || typeof listener !== "function") return () => undefined;
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #connect(input?: { readonly silent?: boolean }): Promise<{ readonly accounts: readonly HoldWalletAccount[] }> {
    if (this.#token && this.#accounts.length) return Promise.resolve({ accounts: this.#accounts.slice() });
    const stored = readStored();
    if (stored) {
      this.#set(stored);
      return Promise.resolve({ accounts: this.#accounts.slice() });
    }
    if (input?.silent) return Promise.resolve({ accounts: [] });
    if (this.#connecting) return this.#connecting;
    // Opened right here, in the click's own task: a popup opened after an await is blocked.
    const popup = window.open(this.#connectUrl, "hold-connect", "width=420,height=640");
    if (!popup) return Promise.reject(new HoldConnectError(-32603, "The browser blocked the HOLD window. Allow pop-ups for this site and try again."));
    this.#connecting = this.#handshake(popup).finally(() => {
      this.#connecting = null;
    });
    return this.#connecting;
  }

  #handshake(popup: Window): Promise<{ readonly accounts: readonly HoldWalletAccount[] }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        clearInterval(closedTimer);
        fn();
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== popup || e.origin !== this.#connectOrigin) return;
        const d = e.data as Record<string, unknown> | null;
        if (!d || typeof d !== "object") return;
        switch (d.type) {
          // Every ready gets a hello: the popup says it again after a sign-in or a phone link.
          case "hold-connect:ready":
            popup.postMessage({ type: "hold-connect:hello", appName: this.#appName ?? undefined }, this.#connectOrigin);
            return;
          case "hold-connect:connected": {
            const account = d.account as Record<string, unknown> | null;
            const address = account && typeof account.address === "string" ? account.address : null;
            const token = typeof d.token === "string" && d.token ? d.token : null;
            if (!address || !token) return done(() => reject(new HoldConnectError(-32603, "HOLD answered without an account.")));
            try {
              fromBase58(address);
            } catch {
              return done(() => reject(new HoldConnectError(-32603, "HOLD answered with an invalid address.")));
            }
            const s = { token, address };
            writeStored(s);
            return done(() => {
              this.#set(s);
              resolve({ accounts: this.#accounts.slice() });
            });
          }
          case "hold-connect:error": {
            const code = typeof d.code === "number" ? d.code : 4001;
            const message = typeof d.message === "string" ? d.message : "The connection was not approved.";
            return done(() => reject(new HoldConnectError(code, message)));
          }
        }
      };
      window.addEventListener("message", onMessage);
      const closedTimer = setInterval(() => {
        if (popup.closed) done(() => reject(new HoldConnectError(4001, "The HOLD window was closed.")));
      }, 500);
    });
  }

  async #disconnect(): Promise<void> {
    const token = this.#token ?? readStored()?.token ?? null;
    writeStored(null);
    this.#set(null);
    if (!token) return;
    try {
      await fetch(`${this.#apiUrl}/hold-connect/grant`, {
        method: "DELETE",
        headers: { authorization: `HoldConnect ${token}` },
        credentials: "omit",
        cache: "no-store",
      });
    } catch {
      /* forgotten here either way; the grant also expires on its own */
    }
  }

  /* ── Asking the phone ── */

  #forget(): HoldConnectError {
    writeStored(null);
    this.#set(null);
    return new HoldConnectError(4100, "HOLD is not connected to this site any more. Connect again.");
  }

  async #call(method: "GET" | "POST", path: string, json?: unknown): Promise<Record<string, unknown>> {
    const token = this.#token;
    if (!token) throw new HoldConnectError(4100, "Connect HOLD first.");
    const headers: Record<string, string> = { authorization: `HoldConnect ${token}`, accept: "application/json" };
    if (json !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await fetch(`${this.#apiUrl}/hold-connect/${path}`, {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
        credentials: "omit",
        cache: "no-store",
      });
    } catch {
      throw new HoldConnectError(-32603, "Could not reach HOLD.");
    }
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (res.status === 401) throw this.#forget();
    const err = body?.error as Record<string, unknown> | string | undefined;
    if (!res.ok || err) {
      const e = typeof err === "object" && err ? err : {};
      const details = (e.details as Record<string, unknown> | undefined) ?? {};
      const code = String(details.code ?? e.code ?? (typeof err === "string" ? err : "") ?? "");
      if (code === "CONNECT_TOKEN_INVALID") throw this.#forget();
      if (res.status === 409 || code === "REQUEST_PENDING") throw new HoldConnectError(-32002, "Another request is waiting on your phone. Answer it first.");
      if (res.status === 429) throw new HoldConnectError(-32005, "Too many requests. Try again in a while.");
      throw new HoldConnectError(-32603, typeof e.message === "string" ? e.message : `HOLD answered ${res.status}.`, res.status);
    }
    // The backend wraps answers in {data}; a bare body is read as well.
    return ((body?.data as Record<string, unknown> | undefined) ?? body ?? {}) as Record<string, unknown>;
  }

  /** Post the request, then poll it until the phone decides. Resolves with `result`. */
  async #ask(kind: Kind, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const created = await this.#call("POST", "requests", { kind, payload });
    const id = typeof created.id === "string" ? created.id : null;
    if (!id) throw new HoldConnectError(-32603, "HOLD did not accept the request.");
    const until = Date.parse(String(created.expiresAt ?? ""));
    const giveUpAt = (Number.isFinite(until) ? until : Date.now() + DEFAULT_REQUEST_TTL_MS) + EXPIRY_GRACE_MS;
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let r: Record<string, unknown>;
      try {
        r = await this.#call("GET", `requests/${encodeURIComponent(id)}`);
      } catch (e) {
        // A lost poll is asked again; losing the connection or the request is final.
        if (e instanceof HoldConnectError && (e.code === 4100 || e.status === 404)) throw e;
        if (Date.now() > giveUpAt) throw new HoldConnectError(-32603, "Your phone did not answer in time.");
        continue;
      }
      const status = r.status;
      if (status === "approved") return (r.result as Record<string, unknown> | undefined) ?? {};
      if (status === "rejected") {
        const e = (r.error as Record<string, unknown> | undefined) ?? {};
        const code = typeof e.code === "number" ? e.code : typeof r.errorCode === "number" ? r.errorCode : 4001;
        const message = typeof e.message === "string" ? e.message : "You said no on your phone.";
        throw new HoldConnectError(code, message);
      }
      if (status === "expired" || Date.now() > giveUpAt) throw new HoldConnectError(-32603, "Your phone did not answer in time.");
    }
  }

  #check(inputs: readonly { account: HoldWalletAccount }[], chains?: readonly (IdentifierString | undefined)[]): void {
    if (!this.#token || !this.#accounts.length) throw new HoldConnectError(4100, "Connect HOLD first.");
    if (!inputs.length) throw new HoldConnectError(-32602, "Nothing to sign.");
    if (inputs.length > 10) throw new HoldConnectError(-32602, "HOLD signs at most 10 at a time.");
    const mine = this.#accounts[0].address;
    for (const i of inputs) {
      if (!i || !i.account || i.account.address !== mine) throw new HoldConnectError(4100, "That account is not the one connected to HOLD.");
    }
    for (const c of chains ?? []) {
      if (c !== undefined && c !== SOLANA_MAINNET) throw new HoldConnectError(-32602, `HOLD signs on ${SOLANA_MAINNET} only.`);
    }
  }

  async #signTransaction(inputs: readonly SignTransactionInput[]) {
    this.#check(inputs, inputs.map((i) => i.chain));
    const txs = inputs.map((i) => bytes(i.transaction));
    const result = await this.#ask("signTransaction", { transactions: txs.map(toBase64) });
    const signed = Array.isArray(result.signed) ? (result.signed as unknown[]) : [];
    if (signed.length !== inputs.length) throw new HoldConnectError(-32603, "HOLD returned the wrong number of transactions.");
    return signed.map((s) => ({ signedTransaction: fromBase64(String(s)) }));
  }

  async #signAndSend(inputs: readonly SignAndSendTransactionInput[]) {
    this.#check(inputs, inputs.map((i) => i.chain));
    const txs = inputs.map((i) => bytes(i.transaction));
    // One set of options for the request (the payload's shape): the first input's.
    const o = inputs[0].options ?? {};
    const options: Record<string, unknown> = {};
    if (typeof o.skipPreflight === "boolean") options.skipPreflight = o.skipPreflight;
    if (typeof o.maxRetries === "number") options.maxRetries = o.maxRetries;
    if (typeof o.preflightCommitment === "string") options.preflightCommitment = o.preflightCommitment;
    if (typeof o.commitment === "string") options.commitment = o.commitment;
    if (typeof o.minContextSlot === "number") options.minContextSlot = o.minContextSlot;
    const result = await this.#ask("signAndSendTransaction", { transactions: txs.map(toBase64), options });
    const sigs = Array.isArray(result.signatures) ? (result.signatures as unknown[]) : [];
    if (sigs.length !== inputs.length) throw new HoldConnectError(-32603, "HOLD returned the wrong number of signatures.");
    return sigs.map((s) => ({ signature: signatureBytes(String(s)) }));
  }

  async #signMessage(inputs: readonly SignMessageInput[]) {
    this.#check(inputs);
    const messages = inputs.map((i) => bytes(i.message));
    const result = await this.#ask("signMessage", { messages: messages.map(toBase64) });
    // The spec's result for a message is the signatures; either name is read.
    const list = Array.isArray(result.signatures) ? result.signatures : Array.isArray(result.signed) ? result.signed : [];
    const sigs = list as unknown[];
    if (sigs.length !== inputs.length) throw new HoldConnectError(-32603, "HOLD returned the wrong number of signatures.");
    return sigs.map((s, n) => ({ signedMessage: messages[n], signature: signatureBytes(String(s)), signatureType: "ed25519" as const }));
  }
}

/* ── Registration ──────────────────────────────────────────────────── */

let registered: HoldWallet | null = null;

/**
 * Is a wallet named HOLD already registered? The HOLD in-app browser injects
 * one before the page's code runs. A wallet registered through the Standard
 * listens for `wallet-standard:app-ready` and registers itself with whatever
 * `register` the event carries, synchronously (@wallet-standard/wallet
 * registerWallet), so dispatching one with our own `register` lists them
 * without touching the app's list.
 */
function holdAlreadyRegistered(): boolean {
  if ((window as unknown as { __holdWallet?: unknown }).__holdWallet) return true;
  let found = false;
  try {
    const api = Object.freeze({
      register: (...wallets: { name?: unknown }[]) => {
        if (wallets.some((w) => w && w.name === HOLD_WALLET_NAME && w !== registered)) found = true;
        return () => undefined;
      },
    });
    const ev = new Event("wallet-standard:app-ready", { bubbles: false, cancelable: false, composed: false });
    Object.defineProperty(ev, "detail", { value: api });
    window.dispatchEvent(ev);
  } catch {
    /* no events here: nothing is registered either */
  }
  return found;
}

/**
 * Register HOLD as a Wallet Standard wallet. Returns the wallet, or null when
 * there is nothing to do: no browser (SSR), already registered by this SDK,
 * or HOLD's in-app browser already provides it.
 */
export function registerHoldConnect(options: HoldConnectOptions = {}): HoldWallet | null {
  if (typeof window === "undefined") return null;
  if (registered) return null;
  if (holdAlreadyRegistered()) return null;
  const wallet = new HoldConnectWallet(options).wallet;
  registered = wallet;
  const callback = (api: { register: (...wallets: HoldWallet[]) => unknown }) => {
    try {
      api.register(wallet);
    } catch {
      /* an app that refuses it does not list it */
    }
  };
  try {
    const ev = new Event("wallet-standard:register-wallet", { bubbles: false, cancelable: false, composed: false });
    Object.defineProperty(ev, "detail", { value: callback });
    window.dispatchEvent(ev);
  } catch {
    /* the app-ready listener below still registers it */
  }
  try {
    window.addEventListener("wallet-standard:app-ready", (e) => {
      const api = (e as CustomEvent).detail as { register?: unknown } | undefined;
      if (api && typeof api.register === "function") callback(api as { register: (...wallets: HoldWallet[]) => unknown });
    });
  } catch {
    /* nothing to listen on */
  }
  return wallet;
}
