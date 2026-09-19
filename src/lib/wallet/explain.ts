/**
 * What the wallet flows say to a person, for anything they can throw. Shared
 * by the Wallet page and onboarding's wallet and passkey steps, so the same
 * failure reads the same everywhere. Never red, and every line says whether
 * anything was saved.
 */

import { WalletCryptoError } from "./core";
import { WalletApiError } from "./api";
import { WalletFlowError } from "./flows";
import { PasskeyError } from "./passkey";

export const LOSS_WARNING =
  "If you lose every passkey on this wallet and never exported your 12 words, the funds in it cannot be recovered by anyone, including us. Your HOLD account can be; the money cannot.";

/** What to tell the person, for anything a flow can throw. Never red. */
export function explain(e: unknown): string {
  if (e instanceof PasskeyError) {
    switch (e.code) {
      case "cancelled":
        return "The passkey prompt was closed before it finished. Nothing was saved.";
      case "exists":
        return "This device already has a passkey for your account. Use that one instead.";
      case "no_prf":
        return "This passkey cannot protect a wallet: its password manager does not support the PRF extension. Nothing was saved, and a passkey just created for it was not added to your account (you can delete it from your password manager). Use Safari with iCloud Keychain (macOS 15 / iOS 18 or later) or Chrome with Google Password Manager.";
      case "unavailable":
        return "Passkeys for HOLD only work on app.hihodl.xyz, in a browser that supports them.";
      default:
        return "The passkey did not answer. Try again.";
    }
  }
  if (e instanceof WalletCryptoError) {
    return e.code === "decrypt_failed"
      ? "That passkey did not open this wallet. Nothing was changed."
      : "The wallet backup could not be read. Nothing was changed.";
  }
  if (e instanceof WalletFlowError) {
    if (e.code === "unknown_passkey") return "That passkey is not one that opens this wallet. Choose another.";
    if (e.code === "self_check_failed") return "A safety check failed before anything was saved. Nothing was written. Try again.";
    return "The wallet could not be saved. Try again.";
  }
  if (e instanceof WalletApiError) {
    if (e.code === "APP_WALLET_EXISTS") return "This account already has a wallet in the HOLD app. Nothing was saved.";
    if (e.code === "SEED_BACKUP_EXISTS") return "This account already has a web wallet. Nothing was overwritten.";
    if (e.code === "EMAIL_NOT_VERIFIED") return "Confirm your email address before creating a wallet.";
    if (e.code === "WEB_WALLET_NOT_ENABLED") return "The web wallet is not available on your account yet. Nothing was saved.";
    if (e.code === "LAST_WRAPPING") return "This is the only passkey that opens your wallet. Add another first.";
    if (e.code === "WRAPPING_EXISTS") return "That passkey already opens your wallet.";
    if (e.code === "rate_limited" || e.status === 429) return "Too many attempts. Wait a few minutes and try again.";
    if (e.status === 0) return "Could not reach HOLD. Check your connection and try again.";
    return "Something went wrong on our side. Nothing was changed.";
  }
  return "Something went wrong. Nothing was changed.";
}
