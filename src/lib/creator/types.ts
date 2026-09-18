/**
 * The creator console, as the backend returns it.
 *
 * Mirrors `server/services/ad-space/payout-address.service.ts` and
 * `server/services/x-account/x-account.service.ts` field for field. Nothing
 * here is invented on the web side, and nothing the console shows is computed
 * from something the server did not send.
 */

/** One address for ethereum, base and polygon alike, as a space already stores it. */
export type PayoutChain = "solana" | "evm";

/**
 * Where the money would go today.
 *
 * `hold` means a HOLD wallet, and HOLD wins whenever HOLD exists — a creator
 * with one is paid there whatever else they have proved. `null` means nowhere
 * yet, which is the only state the console can do anything about.
 */
export type PayoutSource = "hold" | "declared";

export interface PayoutAddressView {
  solana: { address: string | null; source: PayoutSource | null };
  evm: { address: string | null; source: PayoutSource | null };
  /** Every address this creator has proved, kept even when HOLD outranks it. */
  declared: { chain: PayoutChain; address: string }[];
}

export interface PayoutChallenge {
  nonce: string;
  /** The exact words the wallet signs. Not a template: one byte off is a refusal. */
  message: string;
  expiresInMinutes: number;
}

/**
 * `AD_SPACE.MIN_X_ACCOUNT_AGE_DAYS` on the backend.
 *
 * Mirrored rather than fetched: the gate that enforces it is the server's, and
 * this copy exists only so two screens say the same number out loud. If the
 * backend ever moves it, this line is what has to move with it.
 */
export const MIN_X_ACCOUNT_AGE_DAYS = 90;

/** Why this X account cannot front a space, as `xRefusal` names it. */
export type XRefusal = "x_not_linked" | "x_not_verified" | "x_account_too_new" | "x_relink_needed";

export type XAccountStatus =
  | { linked: false; canPublish: false; refusal: "x_not_linked"; configured: boolean }
  | {
      linked: true;
      handle: string;
      name: string | null;
      avatarUrl: string | null;
      verifiedType: "blue" | "business" | "government" | null;
      identityVerified: boolean;
      followers: number | null;
      accountCreatedAt: string | null;
      linkedAt: string | null;
      canPublish: boolean;
      refusal: XRefusal | null;
      configured: boolean;
    };

/**
 * How a trip to X ended.
 *
 * `signed_in` is the callback's only success and is not the end of it: the
 * ticket still has to come back with the session. Everything else is final.
 */
export type LinkResult = "signed_in" | "ok" | "denied" | "expired" | "taken" | "busy" | "failed" | "unavailable";

export const LINK_RESULTS: readonly LinkResult[] = [
  "signed_in",
  "ok",
  "denied",
  "expired",
  "taken",
  "busy",
  "failed",
  "unavailable",
];

export function isLinkResult(v: string | null): v is LinkResult {
  return !!v && (LINK_RESULTS as readonly string[]).includes(v);
}

/** A ticket as the backend issues them: base64url, nothing else. */
export function isTicket(v: string | null): v is string {
  return !!v && /^[A-Za-z0-9_-]{32,128}$/.test(v);
}
