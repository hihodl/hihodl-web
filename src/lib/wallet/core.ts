/**
 * The web wallet's cryptography, and nothing else: no DOM, no network, no React.
 *
 * Pure so it can be proven outside a browser: `npx sucrase-node
 * scripts/wallet-crypto-check.ts` runs every function here against the app's
 * own code and the official BIP-39 vectors (this repo has no test runner).
 *
 * THE SCHEME (recovery v3, documentation/recovery-v3-passkey-secret-in-the-kdf.md)
 *
 *   userSecret  = 32 random bytes
 *   P           = scrypt(uid, saltP, N=16384 r=8 p=1, 32)            as v1
 *   K           = HKDF-SHA256(ikm=P, salt=pepper ‖ userSecret,
 *                             info="hihodl/seed-backup/v2", 32)
 *   blob        = AES-256-GCM(K, utf8(JSON {"seed": mnemonic}))       ct ‖ tag, 12-byte iv
 *
 *   W_i         = HKDF-SHA256(ikm=PRF_i("hihodl/seed-backup/v2"), salt=∅,
 *                             info="hihodl/seed-backup/v2/wrap", 32)
 *   wrapping_i  = AES-256-GCM(W_i, userSecret)
 *
 * `pepper ‖ userSecret` sits exactly where v1 put the pepper (HKDF's salt), so
 * the app's existing `hkdfAesKey(P, concat(pepper, userSecret), info)` derives
 * the same K. PRF output never touches AES directly; it goes through HKDF.
 *
 * THE SOLANA ADDRESS
 *
 * BIP-39 seed (PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic"), then
 * SLIP-0010 ed25519 along m/44'/501'/0'/0'/0' — the app's
 * `deriveSolanaKeypair(mnemonic, 0, 0)` in solana-addresses.service.ts, the
 * one address the app registers and signs with. The check script derives it
 * both ways and compares.
 */

import { ed25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { hmac } from "@noble/hashes/hmac";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { scryptAsync } from "@noble/hashes/scrypt";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { base58 } from "@scure/base";

import { BIP39_ENGLISH } from "./bip39-english";

/* ── Constants that can never change ──────────────────────────────── */

/**
 * The PRF evaluation salt, as UTF-8 bytes. Fixed forever: a different salt
 * derives a different secret and every wrapping stops opening. Same string as
 * the app's `PRF_SALT` (src/lib/recovery/passkeyPrf.ts), which the app sends
 * base64url-encoded; the bytes the authenticator sees are identical.
 */
export const PRF_SALT = "hihodl/seed-backup/v2";
export const BACKUP_INFO_V2 = "hihodl/seed-backup/v2";
export const WRAP_INFO_V2 = "hihodl/seed-backup/v2/wrap";
export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
export const SOLANA_PATH = "m/44'/501'/0'/0'/0'";

export type ScryptParams = { N: number; r: number; p: number };

export interface CipherBlobV2 {
  v: 2;
  params: ScryptParams;
  saltPB64: string;
  ivB64: string;
  ctB64: string;
}

export interface WrappedSecret {
  v: 2;
  alg: "A256GCM";
  ivB64: string;
  ctB64: string;
}

/* ── Bytes ────────────────────────────────────────────────────────── */

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder("utf-8", { fatal: true });

export function prfSaltBytes(): Uint8Array {
  return utf8.encode(PRF_SALT);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Best effort: JavaScript gives no guarantee a buffer is not copied elsewhere. */
export function wipe(...bufs: (Uint8Array | null | undefined)[]): void {
  for (const b of bufs) b?.fill(0);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(u8: Uint8Array): string {
  let out = "";
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i];
    const b = i + 1 < u8.length ? u8[i + 1] : 0;
    const c = i + 2 < u8.length ? u8[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < u8.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < u8.length ? B64[n & 63] : "=";
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) throw new Error("bad base64");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function toBase64Url(u8: Uint8Array): string {
  return toBase64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The only randomness this wallet uses: WebCrypto's CSPRNG. */
export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/* ── BIP-39 ───────────────────────────────────────────────────────── */

function bitsOf(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, "0")).join("");
}

export function entropyToMnemonic(entropy: Uint8Array): string {
  if (entropy.length < 16 || entropy.length > 32 || entropy.length % 4 !== 0) throw new Error("bad entropy length");
  const cs = (entropy.length * 8) / 32;
  const bits = bitsOf(entropy) + bitsOf(sha256(entropy)).slice(0, cs);
  const words: string[] = [];
  for (let i = 0; i < bits.length; i += 11) words.push(BIP39_ENGLISH[parseInt(bits.slice(i, i + 11), 2)]);
  return words.join(" ");
}

/** A fresh 12-word phrase from 128 bits of WebCrypto randomness. */
export function generateMnemonic(): string {
  const entropy = randomBytes(16);
  try {
    return entropyToMnemonic(entropy);
  } finally {
    wipe(entropy);
  }
}

export function normalizeMnemonic(m: string): string {
  return m.normalize("NFKD").trim().toLowerCase().split(/\s+/).join(" ");
}

/** Word list, length and checksum. */
export function validateMnemonic(m: string): boolean {
  const words = normalizeMnemonic(m).split(" ");
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  const idx = words.map((w) => BIP39_ENGLISH.indexOf(w));
  if (idx.some((i) => i < 0)) return false;
  const bits = idx.map((i) => i.toString(2).padStart(11, "0")).join("");
  const entBits = (bits.length * 32) / 33;
  const entropy = new Uint8Array(entBits / 8);
  for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const ok = bitsOf(sha256(entropy)).slice(0, bits.length - entBits) === bits.slice(entBits);
  wipe(entropy);
  return ok;
}

/** BIP-39 seed: PBKDF2-HMAC-SHA512(NFKD(mnemonic), "mnemonic" + NFKD(passphrase), 2048, 64). */
export async function mnemonicToSeed(mnemonic: string, passphrase = ""): Promise<Uint8Array> {
  const m = utf8.encode(mnemonic.normalize("NFKD"));
  const s = utf8.encode(`mnemonic${passphrase}`.normalize("NFKD"));
  return pbkdf2Async(sha512, m, s, { c: 2048, dkLen: 64 });
}

/* ── Solana ───────────────────────────────────────────────────────── */

/** SLIP-0010 ed25519 derivation. Every segment must be hardened; ed25519 has no other kind. */
export function slip10Ed25519(seed: Uint8Array, path: string): Uint8Array {
  if (!/^m(\/\d+')+$/.test(path)) throw new Error("ed25519 paths are hardened-only");
  let I = hmac(sha512, utf8.encode("ed25519 seed"), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const seg of path.split("/").slice(1)) {
    const index = (parseInt(seg.slice(0, -1), 10) + 0x80000000) >>> 0;
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, index, false);
    const next = hmac(sha512, chain, data);
    wipe(I, key, chain, data);
    I = next;
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  wipe(I, chain);
  return key;
}

export interface SolanaKey {
  /** The 32-byte ed25519 private seed. Memory only; wipe when locking. */
  seed: Uint8Array;
  address: string;
}

export async function deriveSolanaKey(mnemonic: string): Promise<SolanaKey> {
  const bip39Seed = await mnemonicToSeed(normalizeMnemonic(mnemonic));
  try {
    const seed = slip10Ed25519(bip39Seed, SOLANA_PATH);
    return { seed, address: base58.encode(ed25519.getPublicKey(seed)) };
  } finally {
    wipe(bip39Seed);
  }
}

/**
 * An ed25519 signature over a MESSAGE, never a transaction: the proof the
 * backend asks for before it registers this address (POST
 * /wallet-backup/address). The words are the server's, built from a
 * single-use nonce; this only signs their UTF-8 bytes.
 */
export function signMessage(seed: Uint8Array, message: string): Uint8Array {
  return ed25519.sign(new TextEncoder().encode(message), seed);
}

/** Whether `signature` over `message` is `address`'s (the check script uses it). */
export function verifyMessage(address: string, message: string, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, new TextEncoder().encode(message), base58.decode(address));
  } catch {
    return false;
  }
}

/* ── AES-256-GCM (WebCrypto; output ct ‖ 16-byte tag, as the app's @noble/ciphers gcm) ── */

async function aesKey(raw: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usage);
}

export async function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = randomBytes(12);
  const k = await aesKey(key, ["encrypt"]);
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, plaintext));
  return { iv, ct };
}

/** Throws on a wrong key or any altered byte: GCM's tag is the integrity check. */
export async function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  const k = await aesKey(key, ["decrypt"]);
  try {
    return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, ct));
  } catch {
    throw new WalletCryptoError("decrypt_failed");
  }
}

export class WalletCryptoError extends Error {
  constructor(readonly code: "decrypt_failed" | "bad_prf" | "bad_blob" | "bad_seed") {
    super(code);
    this.name = "WalletCryptoError";
  }
}

/* ── The v2 backup key ────────────────────────────────────────────── */

export async function scryptUid(uid: string, saltP: Uint8Array, params: ScryptParams): Promise<Uint8Array> {
  return scryptAsync(utf8.encode(uid), saltP, { N: params.N, r: params.r, p: params.p, dkLen: 32 });
}

/** K = HKDF(P, pepper ‖ userSecret, "hihodl/seed-backup/v2"). */
export function backupKeyV2(P: Uint8Array, pepper: Uint8Array, userSecret: Uint8Array): Uint8Array {
  if (userSecret.length !== 32) throw new WalletCryptoError("bad_seed");
  const salt = concatBytes(pepper, userSecret);
  try {
    return hkdf(sha256, P, salt, utf8.encode(BACKUP_INFO_V2), 32);
  } finally {
    wipe(salt);
  }
}

export async function encryptSeedV2(args: {
  uid: string;
  pepper: Uint8Array;
  userSecret: Uint8Array;
  mnemonic: string;
}): Promise<CipherBlobV2> {
  const saltP = randomBytes(16);
  const P = await scryptUid(args.uid, saltP, SCRYPT_PARAMS);
  const K = backupKeyV2(P, args.pepper, args.userSecret);
  const plaintext = utf8.encode(JSON.stringify({ seed: normalizeMnemonic(args.mnemonic) }));
  try {
    const { iv, ct } = await aesGcmEncrypt(K, plaintext);
    return { v: 2, params: { ...SCRYPT_PARAMS }, saltPB64: toBase64(saltP), ivB64: toBase64(iv), ctB64: toBase64(ct) };
  } finally {
    wipe(P, K, plaintext);
  }
}

/** The mnemonic, or a WalletCryptoError. Validates BIP-39 before returning anything. */
export async function decryptSeedV2(args: {
  uid: string;
  pepper: Uint8Array;
  userSecret: Uint8Array;
  blob: CipherBlobV2;
}): Promise<string> {
  const b = args.blob;
  if (b?.v !== 2 || !b.params || !b.saltPB64 || !b.ivB64 || !b.ctB64) throw new WalletCryptoError("bad_blob");
  const P = await scryptUid(args.uid, fromBase64(b.saltPB64), b.params);
  const K = backupKeyV2(P, args.pepper, args.userSecret);
  let plain: Uint8Array | null = null;
  try {
    plain = await aesGcmDecrypt(K, fromBase64(b.ivB64), fromBase64(b.ctB64));
    const parsed = JSON.parse(fromUtf8.decode(plain)) as { seed?: unknown };
    if (typeof parsed.seed !== "string" || !validateMnemonic(parsed.seed)) throw new WalletCryptoError("bad_seed");
    return normalizeMnemonic(parsed.seed);
  } finally {
    wipe(P, K, plain);
  }
}

/* ── Passkey wrappings ────────────────────────────────────────────── */

/** W = HKDF(PRF output). Refuses anything that is not a 32-byte PRF result. */
export function wrapKeyFromPrf(prf: Uint8Array): Uint8Array {
  if (!(prf instanceof Uint8Array) || prf.length !== 32) throw new WalletCryptoError("bad_prf");
  return hkdf(sha256, prf, new Uint8Array(0), utf8.encode(WRAP_INFO_V2), 32);
}

export function newUserSecret(): Uint8Array {
  return randomBytes(32);
}

export async function wrapUserSecret(prf: Uint8Array, userSecret: Uint8Array): Promise<WrappedSecret> {
  if (userSecret.length !== 32) throw new WalletCryptoError("bad_seed");
  const W = wrapKeyFromPrf(prf);
  try {
    const { iv, ct } = await aesGcmEncrypt(W, userSecret);
    return { v: 2, alg: "A256GCM", ivB64: toBase64(iv), ctB64: toBase64(ct) };
  } finally {
    wipe(W);
  }
}

export async function unwrapUserSecret(prf: Uint8Array, wrapped: WrappedSecret): Promise<Uint8Array> {
  if (wrapped?.v !== 2 || wrapped.alg !== "A256GCM") throw new WalletCryptoError("bad_blob");
  const W = wrapKeyFromPrf(prf);
  try {
    const secret = await aesGcmDecrypt(W, fromBase64(wrapped.ivB64), fromBase64(wrapped.ctB64));
    if (secret.length !== 32) throw new WalletCryptoError("bad_seed");
    return secret;
  } finally {
    wipe(W);
  }
}
