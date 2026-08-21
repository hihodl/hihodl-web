/**
 * Watch-only EVM address derivation for Founder Pass orders.
 *
 * This is a straight port of the backend's `evm-derivation.service.ts`
 * (hihodl-backend/server/services/evm-derivation.service.ts). Same BIP-32
 * account-level xpub, same non-hardened `/0/i` child path, same "decompress
 * the secp256k1 point, keccak the 64 raw bytes, take the last 20" rule. It is
 * duplicated rather than imported because the two repos do not share a package.
 * Verified 2026-07-30 against the canonical BIP-39 vector: the "abandon ×11 /
 * about" seed at m/44'/60'/0'/0/0 derives 0x9858EfFD232B4033E47d90003D41EC34EcaEda94
 * both directly and through the account xpub, so this file and the backend
 * agree on every index.
 *
 * WHY AN XPUB AND NOT A KEY: an account-level extended PUBLIC key derives
 * receiving addresses and nothing else. The web app can mint a fresh address
 * per order and can never move a cent of what lands on it. There is no private
 * key in this repo, in its env, or in its bundle. Sweeping the funds is a
 * treasury operation done from the signing device that holds the seed.
 *
 * ONE ADDRESS PER ORDER, NEVER REUSED. Two reasons, both load-bearing:
 *   1. Attribution. The only thing binding an on-chain transfer to a buyer is
 *      the address it landed on. Reuse an address across two orders and the two
 *      payments are indistinguishable — we cannot tell who paid, and settling
 *      that by hand does not scale past the first collision.
 *   2. Income privacy. A single reused address publishes the whole Founder Pass
 *      revenue line to anyone with a block explorer.
 * The index comes from a Postgres sequence (see the orders migration), so it is
 * monotonic and gap-tolerant: a crashed request burns an index rather than
 * handing the same one to the next order.
 */
import { HDKey } from "@scure/bip32";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

/** BIP-44 coin type 60 = Ethereum and every EVM chain we settle on. */
const EVM_COIN_TYPE = 60;

/** Highest index we will ever derive. A sanity bound, not a business limit. */
const MAX_ADDRESS_INDEX = 1_000_000;

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * EIP-55 checksum. Mixed-case is what every wallet renders and what MetaMask
 * validates against, so we store and display the checksummed form everywhere.
 */
export function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase().replace(/^0x/, "");
  const hash = toHex(keccak_256(new TextEncoder().encode(lower)));
  let out = "0x";
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

export function isValidXpub(xpub: string): boolean {
  try {
    const node = HDKey.fromExtendedKey(xpub);
    // An account-level node sits at depth 3 (m / 44' / 60' / account'). Anything
    // shallower would let us derive across accounts; anything deeper would make
    // the /0/i path mean something other than "external chain, index i".
    if (node.depth !== 3) return false;
    if (node.privateKey) return false; // never accept a key that can spend
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive the receiving address for one order.
 *
 * @param xpub  account-level extended public key, m/44'/60'/A'
 * @param index non-hardened address index on the external chain
 */
export function deriveEvmAddress(xpub: string, index: number): string {
  if (!isValidXpub(xpub)) {
    throw new Error(
      "Invalid treasury xpub. Expected an account-level BIP-32 extended PUBLIC key at m/44'/60'/A'.",
    );
  }
  if (!Number.isInteger(index) || index < 0 || index > MAX_ADDRESS_INDEX) {
    throw new Error(`Address index out of range: ${index}`);
  }

  const node = HDKey.fromExtendedKey(xpub);
  const child = node.deriveChild(0).deriveChild(index); // /0/i, external chain
  const compressed = child.publicKey;
  if (!compressed) throw new Error("Derived node carries no public key");

  // @scure/bip32 hands back a 33-byte compressed point. An Ethereum address is
  // keccak256 over the 64 raw coordinate bytes, so decompress and drop the 0x04
  // uncompressed marker before hashing.
  const point = secp256k1.ProjectivePoint.fromHex(toHex(compressed));
  const uncompressed = point.toRawBytes(false).slice(1); // 64 bytes, no prefix

  const hash = keccak_256(uncompressed);
  return toChecksumAddress("0x" + toHex(hash.slice(-20)));
}

/** Full BIP-44 path for the record, so a treasury sweep knows what to sign. */
export function buildDerivationPath(accountIndex: number, addressIndex: number): string {
  return `m/44'/${EVM_COIN_TYPE}'/${accountIndex}'/0/${addressIndex}`;
}
