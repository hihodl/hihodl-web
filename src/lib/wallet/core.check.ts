/**
 * Round-trip proof for the web wallet's cryptography (core.ts).
 *
 *   npx sucrase-node src/lib/wallet/core.check.ts
 *
 * This repo has no test runner, so this is the test: it exits 1 on the first
 * failure. It proves, outside any browser:
 *
 *   1. BIP-39: the official vector, and agreement with the app's `bip39`
 *      package on generation, validation and seed for random phrases.
 *   2. Solana: the same mnemonic gives the same address as the APP's own
 *      derivation (its `deriveEd25519Key`, lifted verbatim out of
 *      hihodl-wallet/src/services/api/solana-addresses.service.ts, then
 *      `Keypair.fromSeed` from the app's @solana/web3.js).
 *   3. K: the web's v2 blob decrypts with the APP's own crypto.ts primitives
 *      (scryptKey, hkdfAesKey(P, pepper ‖ userSecret, "hihodl/seed-backup/v2"),
 *      aesGcmDecrypt), so the app can open what the web writes.
 *   4. Wrappings: wrap/unwrap round trip; a wrong PRF output, a wrong
 *      userSecret, a tampered byte and a short PRF all fail loudly.
 *
 * The app parts need the hihodl-wallet repo beside this one (or
 * HIHODL_WALLET_DIR). Without it they are reported as SKIPPED, never passed.
 */


import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";

import {
  BACKUP_INFO_V2,
  concatBytes,
  decryptSeedV2,
  deriveSolanaKey,
  encryptSeedV2,
  entropyToMnemonic,
  fromBase64,
  generateMnemonic,
  mnemonicToSeed,
  prfSaltBytes,
  randomBytes,
  toBase64,
  unwrapUserSecret,
  validateMnemonic,
  WalletCryptoError,
  wrapUserSecret,
} from "./core";

let failures = 0;
let skipped = 0;
function ok(cond: unknown, what: string) {
  if (cond) console.log(`  ok    ${what}`);
  else {
    failures++;
    console.log(`  FAIL  ${what}`);
  }
}
async function rejects(p: Promise<unknown>, code: string, what: string) {
  try {
    await p;
    ok(false, `${what} (resolved, expected ${code})`);
  } catch (e) {
    ok(e instanceof WalletCryptoError && e.code === code, `${what} → ${(e as Error).message}`);
  }
}
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

function findWalletRepo(): string | null {
  if (process.env.HIHODL_WALLET_DIR && existsSync(process.env.HIHODL_WALLET_DIR)) return process.env.HIHODL_WALLET_DIR;
  let dir = resolve(__dirname);
  for (let i = 0; i < 8; i++) {
    const cand = join(dir, "hihodl-wallet");
    if (existsSync(join(cand, "src/services/api/solana-addresses.service.ts"))) return cand;
    dir = dirname(dir);
  }
  return null;
}

async function main() {
  const APP = findWalletRepo();
  const appRequire = APP ? (m: string) => require(require.resolve(m, { paths: [APP] })) : null;

  console.log("1. BIP-39");
  const zero = entropyToMnemonic(new Uint8Array(16));
  ok(zero === "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", "vector 1 phrase");
  ok(
    hex(await mnemonicToSeed(zero, "TREZOR")) ===
      "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04",
    "vector 1 seed (passphrase TREZOR)",
  );
  const ff = entropyToMnemonic(new Uint8Array(16).fill(0xff));
  ok(ff === "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong", "all-ones phrase");
  ok(validateMnemonic(zero) && !validateMnemonic(zero.replace(/about$/, "abandon")), "checksum is checked");
  ok(!validateMnemonic("abandon abandon abandon"), "length is checked");
  const fresh = generateMnemonic();
  ok(fresh.split(" ").length === 12 && validateMnemonic(fresh), "generated phrase is 12 valid words");

  if (appRequire) {
    const bip39 = appRequire("bip39");
    let agree = true;
    for (let i = 0; i < 25; i++) {
      const ent = randomBytes(16);
      const ours = entropyToMnemonic(ent);
      const theirs = bip39.entropyToMnemonic(Buffer.from(ent).toString("hex"));
      if (ours !== theirs || !bip39.validateMnemonic(ours)) agree = false;
      if (i < 5 && hex(await mnemonicToSeed(ours)) !== bip39.mnemonicToSeedSync(ours).toString("hex")) agree = false;
    }
    ok(agree, "25 random phrases: same words as the app's bip39, 5 with the same seed");
    const ent24 = randomBytes(32);
    const w24 = entropyToMnemonic(ent24);
    ok(w24 === bip39.entropyToMnemonic(Buffer.from(ent24).toString("hex")) && validateMnemonic(w24), "24-word phrases agree and validate");
  } else {
    skipped++;
    console.log("  SKIP  app bip39 comparison (hihodl-wallet not found)");
  }

  console.log("2. Solana address = the app's");
  if (appRequire && APP) {
    const src = readFileSync(join(APP, "src/services/api/solana-addresses.service.ts"), "utf8");
    const start = src.indexOf("function deriveEd25519Key(");
    const end = src.indexOf("/**", start);
    if (start < 0 || end < 0) {
      ok(false, "found deriveEd25519Key in the app source");
    } else {
      const { transform } = require("sucrase");
      const js = transform(src.slice(start, end), { transforms: ["typescript"] }).code;
      const deriveEd25519Key = new Function("hmac", "sha512", "Buffer", `${js}\nreturn deriveEd25519Key;`)(
        appRequire("@noble/hashes/hmac").hmac,
        appRequire("@noble/hashes/sha512").sha512,
        Buffer,
      );
      const bip39 = appRequire("bip39");
      const { Keypair } = appRequire("@solana/web3.js");
      const appAddress = (m: string) =>
        Keypair.fromSeed(deriveEd25519Key(new Uint8Array(bip39.mnemonicToSeedSync(m)), "m/44'/501'/0'/0'/0'")).publicKey.toBase58();

      const fixed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const web = await deriveSolanaKey(fixed);
      const app = appAddress(fixed);
      console.log(`        fixed mnemonic → web ${web.address} · app ${app}`);
      ok(web.address === app, "fixed test mnemonic: same address");
      let all = true;
      for (let i = 0; i < 5; i++) {
        const m = generateMnemonic();
        if ((await deriveSolanaKey(m)).address !== appAddress(m)) all = false;
      }
      ok(all, "5 random mnemonics: same address");
      ok(web.seed.length === 32, "the private seed is 32 bytes");
    }
  } else {
    skipped++;
    console.log("  SKIP  app derivation (hihodl-wallet not found)");
  }

  console.log("3. v2 backup key and blob");
  const uid = "3f0e8a8e-6c7a-4d52-9c1e-0a5b9f8b2c11";
  const pepper = randomBytes(32);
  const userSecret = randomBytes(32);
  const mnemonic = generateMnemonic();
  const blob = await encryptSeedV2({ uid, pepper, userSecret, mnemonic });
  ok(blob.v === 2 && blob.params.N === 16384 && fromBase64(blob.saltPB64).length === 16 && fromBase64(blob.ivB64).length === 12, "blob shape");
  ok((await decryptSeedV2({ uid, pepper, userSecret, blob })) === mnemonic, "round trip");
  await rejects(decryptSeedV2({ uid, pepper, userSecret: randomBytes(32), blob }), "decrypt_failed", "wrong userSecret fails");
  await rejects(decryptSeedV2({ uid, pepper: randomBytes(32), userSecret, blob }), "decrypt_failed", "wrong pepper fails");
  await rejects(decryptSeedV2({ uid: "someone-else", pepper, userSecret, blob }), "decrypt_failed", "wrong uid fails");
  const ct = fromBase64(blob.ctB64);
  ct[0] ^= 1;
  await rejects(decryptSeedV2({ uid, pepper, userSecret, blob: { ...blob, ctB64: toBase64(ct) } }), "decrypt_failed", "tampered ciphertext fails");

  if (APP) {
    const appCrypto = require(join(APP, "src/lib/crypto.ts"));
    const P = await appCrypto.scryptKey(uid, fromBase64(blob.saltPB64), blob.params);
    const K = await appCrypto.hkdfAesKey(P, concatBytes(pepper, userSecret), BACKUP_INFO_V2);
    const plain = await appCrypto.aesGcmDecrypt(K, fromBase64(blob.ivB64), fromBase64(blob.ctB64));
    ok(JSON.parse(new TextDecoder().decode(plain)).seed === mnemonic, "the APP's crypto.ts opens the web's blob (K matches the doc)");
  } else {
    skipped++;
    console.log("  SKIP  app crypto.ts decrypt (hihodl-wallet not found)");
  }

  console.log("4. Passkey wrappings");
  const prfA = randomBytes(32);
  const prfB = randomBytes(32);
  const wA = await wrapUserSecret(prfA, userSecret);
  const wB = await wrapUserSecret(prfB, userSecret);
  ok(eq(await unwrapUserSecret(prfA, wA), userSecret), "passkey A unwraps");
  ok(eq(await unwrapUserSecret(prfB, wB), userSecret), "passkey B unwraps the same secret");
  ok(fromBase64(wA.ctB64).length === 48 && toBase64(fromBase64(wA.ctB64)) === wA.ctB64, "wrapping is 32 + 16 bytes");
  await rejects(unwrapUserSecret(prfB, wA), "decrypt_failed", "wrong PRF output fails loudly");
  await rejects(unwrapUserSecret(randomBytes(32), wA), "decrypt_failed", "random PRF output fails loudly");
  await rejects(unwrapUserSecret(prfA.slice(0, 16), wA), "bad_prf", "a short PRF output is refused");
  const unwrapped = await unwrapUserSecret(prfA, wA);
  ok((await decryptSeedV2({ uid, pepper, userSecret: unwrapped, blob })) === mnemonic, "full path: PRF → userSecret → K → mnemonic");
  ok(new TextDecoder().decode(prfSaltBytes()) === "hihodl/seed-backup/v2", "PRF salt is the app's PRF_SALT");

  console.log(failures ? `\n${failures} FAILED` : `\nall passed${skipped ? ` (${skipped} skipped)` : ""}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
