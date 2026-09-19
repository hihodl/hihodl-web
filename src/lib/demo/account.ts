/**
 * The demo backend for everything that is not Spaces: the person (/me,
 * recovery codes, passkeys), the web wallet (/wallet-backup, the pepper,
 * balances through the RPC proxy), linking a phone (/device-link) and
 * withdrawals (/withdrawals, the relayer).
 *
 * Built from the demo state (lib/creator/demo): which wallet this account
 * has, which phone is linked, how far onboarding got. Every write changes
 * it, and it is kept in this tab's sessionStorage, so a full page load (the
 * end of onboarding, a link from the screen index) finds what was just done.
 *
 * The web wallet is real crypto on a fixed demo phrase: the backup is sealed
 * here with the demo passkey's PRF, so Unlock, Export, Add a passkey and a
 * passkey-approved withdrawal all run the product's own code on it.
 */

import { DEMO_PEOPLE, DEMO_WALLETS, demoState, type DemoRole, type DemoState } from "@/lib/creator/demo";
import type { Me } from "@/lib/app/me";
import type { WalletBackup } from "@/lib/wallet/api";
import {
  deriveSolanaKey,
  encryptSeedV2,
  entropyToMnemonic,
  fromBase64,
  toBase64,
  toBase64Url,
  wrapUserSecret,
} from "@/lib/wallet/core";
import { CHALLENGE_PREFIX } from "@/lib/wallet/vault";
import { withdrawalChallenge } from "@/lib/wallet/withdraw-core";

import { DEMO_PASSKEY_ID, demoPrf } from "./passkey";

/* ── The demo passkey ─────────────────────────────────────────────── */

/** The per-person pepper, fixed. */
const PEPPER_B64 = toBase64(new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 13 + 7) & 0xff)));
/** The demo wallet's twelve words: fixed, so its address is the same on every visit. */
const DEMO_MNEMONIC = entropyToMnemonic(new Uint8Array(Array.from({ length: 16 }, (_, i) => (i * 29 + 3) & 0xff)));

/** The app wallet's addresses (made in the HOLD app). */
const APP_SOLANA = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

/* ── Records ──────────────────────────────────────────────────────── */

interface LinkRec {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "created" | "joined" | "sealed" | "done" | "expired";
  platform: "android" | "ios" | null;
  appPub: string | null;
  sealedAt: number | null;
  carriesSecret: boolean;
}

interface WithdrawalRec {
  id: string;
  channel: "app" | "web_passkey";
  status: "pending" | "approved" | "rejected" | "expired" | "submitted" | "confirmed" | "failed";
  token: "USDC" | "SOL";
  amount: string;
  to: string;
  createdAt: number;
  expiresAt: string;
  signature: string | null;
  /** App channel: what the phone does, and when. */
  outcome: "approve" | "reject";
}

interface AccountStore {
  /** Which demo state this store was built for: another one rebuilds it. */
  key: string;
  me: Me;
  codes: boolean;
  passkeys: { id: string; name: string; deviceType: string | null; createdAt: string }[];
  wallet: {
    state: "none" | "app_wallet" | "web_wallet";
    backup: WalletBackup | null;
    registered: string | null;
  };
  addresses: Record<string, string>;
  devices: { id: string; platform: "android" | "ios"; linkedAt: string; lastUsedAt: string | null; revokedAt: string | null }[];
  links: LinkRec[];
  withdrawals: WithdrawalRec[];
  seq: number;
  balances: { sol: number; usdc: number };
}

const SAVED = "hold-web-demo-account";
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function keyOf(d: DemoState): string {
  return [d.role, d.wallet, d.phone, d.account].join("/");
}

const NAMES: Record<DemoRole, { handle: string; name: string }> = {
  owner: { handle: "@demo_creator", name: "Demo Creator" },
  manager: { handle: "@dana_sells", name: "Dana" },
  rep: { handle: "@kai_films", name: "Kai" },
  invitee: { handle: "@sam_new", name: "Sam" },
};

function build(d: DemoState): AccountStore {
  const who = DEMO_PEOPLE[d.role];
  const names = NAMES[d.role];
  const fresh = d.account === "new";
  const passkey = { id: DEMO_PASSKEY_ID, name: "iCloud Keychain", deviceType: "multiDevice", createdAt: iso(Date.now() - 40 * DAY) };
  const linkedAt = iso(Date.now() - 12 * DAY);
  return {
    key: keyOf(d),
    me: {
      id: `me-${d.role}`,
      supabaseUid: who.userId,
      aliasHandle: fresh ? null : names.handle,
      aliasChangeableAt: null,
      email: who.email,
      profile: {
        displayName: d.account === "done" ? names.name : null,
        avatarUrl: null,
        country: "ES",
        railsRegion: "eu",
        plan: "free",
        cardWaitlistJoinedAt: null,
      },
    },
    codes: d.account === "done",
    passkeys: fresh ? [] : [passkey],
    wallet: {
      state: d.wallet === "web" || d.wallet === "other" ? "web_wallet" : d.wallet === "app" ? "app_wallet" : "none",
      backup: null,
      registered: null,
    },
    addresses: d.wallet === "app" ? { solana: APP_SOLANA, base: DEMO_WALLETS.evm, polygon: DEMO_WALLETS.evm } : {},
    devices: d.phone === "none" ? [] : [{ id: "demo-phone-1", platform: d.phone, linkedAt, lastUsedAt: iso(Date.now() - 2 * DAY), revokedAt: null }],
    links: [],
    withdrawals: [],
    seq: 0,
    balances: { sol: 0.4182, usdc: 1240.5 },
  };
}

let current: AccountStore | null = null;

function load(): AccountStore {
  const d = demoState();
  const key = keyOf(d);
  if (current && current.key === key) return current;
  try {
    const raw = window.sessionStorage.getItem(SAVED);
    if (raw) {
      const s = JSON.parse(raw) as AccountStore;
      if (s.key === key) return (current = s);
    }
  } catch {
    /* built again below */
  }
  current = build(d);
  return current;
}

function save(): void {
  try {
    if (current) window.sessionStorage.setItem(SAVED, JSON.stringify(current));
  } catch {
    /* the next page load starts from the demo state again */
  }
}

/** Forget what was done in this tab: the next read starts from the demo state. */
export function resetAccount(): void {
  current = null;
  try {
    window.sessionStorage.removeItem(SAVED);
  } catch {
    /* nothing kept */
  }
}

/* ── The seeded web wallet ────────────────────────────────────────── */

async function ensureBackup(s: AccountStore): Promise<void> {
  const d = demoState();
  if (d.wallet !== "web" || s.wallet.backup || s.wallet.state !== "web_wallet") return;
  const uid = DEMO_PEOPLE[d.role].userId;
  const userSecret = new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 53 + 5) & 0xff));
  const blob = await encryptSeedV2({ uid, pepper: fromBase64(PEPPER_B64), userSecret, mnemonic: DEMO_MNEMONIC });
  const wrapped = await wrapUserSecret(demoPrf(), userSecret);
  const key = await deriveSolanaKey(DEMO_MNEMONIC);
  s.wallet.backup = {
    cipher_blob: blob,
    current_blob_hash: "demo-blob-1",
    wrappings: [{ credential_id: DEMO_PASSKEY_ID, label: "iCloud Keychain", created_at: iso(Date.now() - 40 * DAY), wrapped }],
  };
  s.wallet.registered = key.address;
  save();
}

/* ── Answers ──────────────────────────────────────────────────────── */

export interface Answer {
  status: number;
  body: unknown;
}

const ok = (data: unknown, status = 200): Answer => ({ status, body: { data } });
const raw = (body: unknown, status = 200): Answer => ({ status, body });
const refuse = (status: number, code: string, details: Record<string, unknown> = {}): Answer => ({
  status,
  body: { error: { code, message: code, details: { code, ...details } } },
});

function uid(s: AccountStore, prefix: string): string {
  s.seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${s.seq}`;
}

function base58(n: number): string {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => A[x % 58]).join("");
}

function linkView(l: LinkRec) {
  const now = Date.now();
  if (l.status !== "done" && now > l.expiresAt) l.status = "expired";
  // The phone joins a few seconds after the code shows (an Android phone, as the demo's default).
  if (l.status === "created" && now - l.createdAt > 5000) {
    const pair = new Uint8Array(32);
    globalThis.crypto.getRandomValues(pair);
    l.status = "joined";
    l.platform = new URLSearchParams(window.location.search).get("link-phone") === "ios" ? "ios" : "android";
    l.appPub = toBase64(pair);
    if (l.platform === "ios") l.status = "done";
  }
  if (l.status === "sealed" && l.sealedAt && now - l.sealedAt > 3000) l.status = "done";
  return {
    session: {
      sessionId: l.id,
      status: l.status,
      platform: l.platform,
      appPub: l.platform === "android" ? l.appPub : null,
      expiresAt: iso(l.expiresAt),
      carriesSecret: l.carriesSecret,
    },
  };
}

function withdrawalView(w: WithdrawalRec) {
  const age = Date.now() - w.createdAt;
  if (w.channel === "app" && w.status === "pending" && age > 6000) w.status = w.outcome === "reject" ? "rejected" : "approved";
  if (w.channel === "app" && w.status === "approved" && age > 9000) {
    w.status = "confirmed";
    w.signature = base58(88);
  }
  return { withdrawal: { id: w.id, channel: w.channel, status: w.status, token: w.token, amount: w.amount, to: w.to, expiresAt: w.expiresAt, signature: w.signature } };
}

/**
 * One call to the HOLD API that is not Spaces, or null when it is not one of
 * these (the Spaces store answers it then).
 */
export async function accountAnswer(method: string, path: string, query: URLSearchParams, body: Record<string, unknown> | null, origin: string): Promise<Answer | null> {
  const s = load();
  const seg = path.split("/").filter(Boolean);
  const is = (m: string, pattern: string): string[] | null => {
    if (m !== method) return null;
    const parts = pattern.split("/");
    if (parts.length !== seg.length) return null;
    const params: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i] === ":") params.push(seg[i]);
      else if (parts[i] !== seg[i]) return null;
    }
    return params;
  };
  let p: string[] | null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const done = (a: Answer): Answer => {
    if (method !== "GET") save();
    return a;
  };

  /* The person */
  if (is("GET", "me")) return ok(s.me);
  if (is("PATCH", "me")) {
    const b = body ?? {};
    if (typeof b.aliasHandle === "string") {
      if (b.aliasHandle.toLowerCase() === "taken") return refuse(409, "CONFLICT");
      s.me.aliasHandle = `@${b.aliasHandle.replace(/^@/, "")}`;
    }
    if (typeof b.displayName === "string") s.me.profile.displayName = b.displayName;
    if (typeof b.avatarUrl === "string") s.me.profile.avatarUrl = b.avatarUrl || null;
    return done(ok({ updated: true }));
  }
  if (is("GET", "me/check-handle")) {
    const h = (query.get("handle") ?? "").toLowerCase();
    if (`@${h}` === (s.me.aliasHandle ?? "").toLowerCase()) return ok({ available: true, reason: "own_handle" });
    if (["taken", "alex", "hold", "demo"].includes(h)) return ok({ available: false, reason: "taken" });
    return ok({ available: true, reason: null });
  }
  if (is("GET", "me/addresses")) return ok({ addresses: s.addresses });
  if (is("GET", "recovery-codes/status")) {
    return ok({ hasActiveCodes: s.codes, unusedCount: s.codes ? 8 : 0, generatedAt: s.codes ? iso(Date.now() - 30 * DAY) : null });
  }
  if (is("POST", "recovery-codes/generate-and-email")) {
    s.codes = true;
    return done(ok({ sent: true, email: str(body?.email) ?? s.me.email }));
  }

  /* Passkeys */
  if (is("POST", "passkeys/register/begin")) {
    return raw({
      publicKey: {
        challenge: toBase64Url(new Uint8Array(32).map((_, i) => (i * 7 + Date.now()) & 0xff)),
        rp: { name: "HOLD", id: "hihodl.xyz" },
        user: { id: toBase64Url(new TextEncoder().encode(s.me.supabaseUid ?? "demo")), name: s.me.email ?? "demo", displayName: s.me.profile.displayName ?? "Demo" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
      },
    });
  }
  if (is("POST", "passkeys/register/complete")) {
    const cred = (body?.credential ?? {}) as { id?: string };
    const id = cred.id ?? uid(s, "passkey");
    if (!s.passkeys.some((x) => x.id === id)) s.passkeys.push({ id, name: "This browser", deviceType: "singleDevice", createdAt: iso(Date.now()) });
    return done(ok({ success: true, credentialId: id }));
  }
  if (is("GET", "passkeys/list")) return ok({ passkeys: s.passkeys });

  /* The web wallet */
  if (is("GET", "wallet-backup/status")) {
    await ensureBackup(s);
    const d = demoState();
    return ok({
      state: s.wallet.state,
      enabled: true,
      registered_address: s.wallet.registered,
      // A web wallet made under an earlier account with this email: this account holds no blob.
      current_blob_hash: d.wallet === "other" ? null : s.wallet.backup?.current_blob_hash ?? null,
      wrappings: (s.wallet.backup?.wrappings ?? []).map(({ credential_id, label, created_at }) => ({ credential_id, label, created_at })),
      email_verified: true,
    });
  }
  if (is("GET", "wallet-backup")) {
    await ensureBackup(s);
    if (!s.wallet.backup) return refuse(404, "NOT_FOUND");
    return ok(s.wallet.backup);
  }
  if (is("PUT", "wallet-backup")) {
    if (s.wallet.backup) return refuse(409, "BACKUP_EXISTS");
    const b = body as { cipher_blob: WalletBackup["cipher_blob"]; wrapping: { credential_id: string; wrapped: WalletBackup["wrappings"][number]["wrapped"]; label: string | null } };
    s.wallet.backup = {
      cipher_blob: b.cipher_blob,
      current_blob_hash: "demo-blob-new",
      wrappings: [{ credential_id: b.wrapping.credential_id, label: b.wrapping.label, created_at: iso(Date.now()), wrapped: b.wrapping.wrapped }],
    };
    s.wallet.state = "web_wallet";
    return done(ok({ saved: true, idempotent: false, current_blob_hash: "demo-blob-new" }));
  }
  if (is("POST", "wallet-backup/wrappings")) {
    const b = body as { credential_id: string; wrapped: WalletBackup["wrappings"][number]["wrapped"]; label: string | null };
    s.wallet.backup?.wrappings.push({ credential_id: b.credential_id, label: b.label, created_at: iso(Date.now()), wrapped: b.wrapped });
    return done(ok({ added: true }));
  }
  if ((p = is("DELETE", "wallet-backup/wrappings/:"))) {
    const id = decodeURIComponent(p[0]);
    if (s.wallet.backup) {
      if (s.wallet.backup.wrappings.length <= 1) return refuse(409, "LAST_WRAPPING");
      s.wallet.backup.wrappings = s.wallet.backup.wrappings.filter((w) => w.credential_id !== id);
    }
    return done(ok({ removed: true }));
  }
  if (is("POST", "wallet-backup/address/challenge")) {
    const address = str(body?.address) ?? "";
    return ok({ nonce: uid(s, "nonce"), message: `${CHALLENGE_PREFIX}Address: ${address}\nNonce: demo`, expires_in_minutes: 10 });
  }
  if (is("POST", "wallet-backup/address")) {
    s.wallet.registered = str(body?.address);
    return done(ok({ address: s.wallet.registered, registered: true, idempotent: false }));
  }
  if (is("GET", "security/pepper")) return ok({ pepper: PEPPER_B64 });

  /* Where sponsors pay: a HOLD wallet wins over any other address (as the backend decides). */
  if (is("GET", "ad-space/payout-address") && demoState().role === "owner" && (s.wallet.state === "web_wallet" || s.wallet.state === "app_wallet")) {
    await ensureBackup(s);
    const app = s.wallet.state === "app_wallet";
    const solana = app ? APP_SOLANA : s.wallet.registered;
    if (solana) {
      return ok({
        solana: { address: solana, source: "hold" },
        evm: app ? { address: DEMO_WALLETS.evm, source: "hold" } : { address: null, source: null },
        declared: [{ chain: "solana", address: DEMO_WALLETS.solana }],
      });
    }
  }

  /* Balances: the authed Solana RPC proxy */
  if (is("POST", "rpc/solana")) {
    const m = str(body?.method);
    if (m === "getBalance") return raw({ jsonrpc: "2.0", id: 1, result: { value: Math.round(s.balances.sol * 1e9) } });
    if (m === "getTokenAccountsByOwner") {
      return raw({ jsonrpc: "2.0", id: 1, result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: s.balances.usdc } } } } } }] } });
    }
    return raw({ jsonrpc: "2.0", id: 1, result: null });
  }

  /* Linking a phone */
  if (is("POST", "device-link/sessions")) {
    const id = uid(s, "link");
    const l: LinkRec = {
      id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60_000,
      status: "created",
      platform: null,
      appPub: null,
      sealedAt: null,
      carriesSecret: s.wallet.state === "web_wallet" && !!s.wallet.backup,
    };
    s.links.push(l);
    const base = window.location.host.startsWith("app.") ? "" : "/app";
    return done(ok({ session: { sessionId: id, expiresAt: iso(l.expiresAt), url: `${origin}${base}/link/${id}?k=${str(body?.webPub) ?? ""}` } }));
  }
  if ((p = is("GET", "device-link/sessions/:"))) {
    const id = decodeURIComponent(p[0]);
    // The phone page's own states, by address.
    if (id === "demo-expired") return ok({ session: { sessionId: id, status: "expired", platform: null, expiresAt: iso(Date.now() - 60_000) } });
    if (id === "demo-done") return ok({ session: { sessionId: id, status: "done", platform: "ios", expiresAt: iso(Date.now() + 60_000) } });
    if (id === "demo-other") return refuse(403, "FORBIDDEN");
    const l = s.links.find((x) => x.id === id);
    if (!l) return ok({ session: { sessionId: id, status: "created", platform: null, expiresAt: iso(Date.now() + 4 * 60_000) } });
    const v = linkView(l);
    if (l.status === "done" && !s.devices.some((d) => d.id === `dev-${l.id}`)) {
      s.devices.push({ id: `dev-${l.id}`, platform: l.platform ?? "ios", linkedAt: iso(Date.now()), lastUsedAt: null, revokedAt: null });
    }
    save();
    return ok(v);
  }
  if ((p = is("POST", "device-link/sessions/:/join"))) {
    const id = decodeURIComponent(p[0]);
    if (id === "demo-expired") return refuse(410, "SESSION_EXPIRED");
    if (id === "demo-other") return refuse(403, "FORBIDDEN");
    const l = s.links.find((x) => x.id === id);
    if (l) {
      l.platform = body?.platform === "android" ? "android" : "ios";
      l.status = l.platform === "ios" ? "done" : "joined";
    }
    return done(ok({ joined: true }));
  }
  if ((p = is("POST", "device-link/sessions/:/seal"))) {
    const l = s.links.find((x) => x.id === decodeURIComponent(p![0]));
    if (!l) return refuse(404, "NOT_FOUND");
    if (l.carriesSecret && !body?.box) return refuse(409, "SECRET_REQUIRED");
    l.status = "sealed";
    l.sealedAt = Date.now();
    return done(ok({ sealed: true }));
  }
  if (is("GET", "device-link/devices")) return ok({ devices: s.devices });
  if ((p = is("DELETE", "device-link/devices/:"))) {
    const d = s.devices.find((x) => x.id === decodeURIComponent(p![0]));
    if (d) d.revokedAt = iso(Date.now());
    return done(ok({ revoked: true }));
  }

  /* Withdrawals */
  if (is("POST", "withdrawals")) {
    const phone = s.devices.find((d) => !d.revokedAt);
    if (!phone) return refuse(409, "LINK_YOUR_PHONE_FIRST");
    const w: WithdrawalRec = {
      id: uid(s, "wd"),
      channel: phone.platform === "android" ? "app" : "web_passkey",
      status: "pending",
      token: body?.token === "SOL" ? "SOL" : "USDC",
      amount: str(body?.amount) ?? "0",
      to: str(body?.to) ?? "",
      createdAt: Date.now(),
      expiresAt: iso(Date.now() + 10 * 60_000),
      signature: null,
      outcome: new URLSearchParams(window.location.search).get("phone-answer") === "reject" ? "reject" : "approve",
    };
    s.withdrawals.push(w);
    return done(ok(withdrawalView(w), 201));
  }
  if ((p = is("GET", "withdrawals/:"))) {
    const w = s.withdrawals.find((x) => x.id === decodeURIComponent(p![0]));
    if (!w) return refuse(404, "NOT_FOUND");
    const v = withdrawalView(w);
    save();
    return ok(v);
  }
  if ((p = is("POST", "withdrawals/:/passkey-challenge"))) {
    const id = decodeURIComponent(p[0]);
    const message = fromBase64(str(body?.message) ?? "");
    const ids = (s.wallet.backup?.wrappings ?? []).map((w) => ({ id: w.credential_id, type: "public-key" as const }));
    return ok({ publicKey: { challenge: toBase64Url(withdrawalChallenge(id, message)), rpId: "hihodl.xyz", timeout: 60000, userVerification: "required", allowCredentials: ids } });
  }
  if ((p = is("POST", "withdrawals/:/authorize-passkey"))) {
    const w = s.withdrawals.find((x) => x.id === decodeURIComponent(p![0]));
    if (!w) return refuse(404, "NOT_FOUND");
    w.status = "approved";
    return done(ok(withdrawalView(w)));
  }
  if (is("POST", "relayer/solana/quote")) {
    return ok({
      blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k",
      relayerPublicKey: DEMO_WALLETS.solana,
      idempotencyKey: uid(s, "idem"),
      computeUnits: 140000,
      priorityFeeLamports: "5000",
      sponsorship: null,
    });
  }
  if (is("POST", "relayer/solana/submit")) {
    const w = s.withdrawals.find((x) => x.id === str(body?.withdrawalId));
    const signature = base58(88);
    if (w) {
      w.status = "confirmed";
      w.signature = signature;
    }
    await new Promise((r) => setTimeout(r, 900));
    return done(ok({ signature, status: "confirmed" }));
  }

  return null;
}

/** For the demo badge: which role this account is, as the store built it. */
export function accountRole(): DemoRole {
  return demoState().role;
}
