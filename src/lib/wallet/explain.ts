/**
 * What the wallet flows say to a person, for anything they can throw. Shared
 * by the Wallet page and onboarding's wallet and passkey steps, so the same
 * failure reads the same everywhere. Never red, and every line says whether
 * anything was saved.
 */

import { t } from "@/lib/app/i18n";

import { WalletCryptoError } from "./core";
import { WalletApiError } from "./api";
import { WalletFlowError } from "./flows";
import { PasskeyError } from "./passkey";

/**
 * The English line, for importers that read it at module load. Prefer
 * lossWarning(): it is read in the person's language when it is called.
 */
export const LOSS_WARNING =
  "If you lose every passkey on this wallet and never exported your 12 words, the funds in it cannot be recovered by anyone, including us. Your HOLD account can be; the money cannot.";

/** The loss warning, in the person's language. */
export function lossWarning(): string {
  return t("wallet.explain.lossWarning");
}

/** What to tell the person, for anything a flow can throw. Never red. */
export function explain(e: unknown): string {
  if (e instanceof PasskeyError) {
    switch (e.code) {
      case "cancelled":
        return t("wallet.explain.passkey.cancelled");
      case "exists":
        return t("wallet.explain.passkey.exists");
      case "no_prf":
        return t("wallet.explain.passkey.noPrf");
      case "no_prf_here":
        return t("wallet.explain.passkey.noPrfHere");
      // Said BEFORE any prompt: nothing was created, so there is nothing to
      // delete and nothing to undo. The version is the fix, and it is theirs
      // to make, so it is named.
      case "os_too_old":
        return t("wallet.explain.passkey.osTooOld");
      case "unavailable":
        return t("wallet.explain.passkey.unavailable");
      default:
        return t("wallet.explain.passkey.failed");
    }
  }
  if (e instanceof WalletCryptoError) {
    return e.code === "decrypt_failed" ? t("wallet.explain.crypto.decryptFailed") : t("wallet.explain.crypto.unreadable");
  }
  if (e instanceof WalletFlowError) {
    if (e.code === "unknown_passkey") return t("wallet.explain.flow.unknownPasskey");
    if (e.code === "self_check_failed") return t("wallet.explain.flow.selfCheckFailed");
    return t("wallet.explain.flow.notSaved");
  }
  if (e instanceof WalletApiError) {
    if (e.code === "APP_WALLET_EXISTS") return t("wallet.explain.api.appWalletExists");
    if (e.code === "SEED_BACKUP_EXISTS") return t("wallet.explain.api.seedBackupExists");
    if (e.code === "EMAIL_NOT_VERIFIED") return t("wallet.explain.api.emailNotVerified");
    if (e.code === "WEB_WALLET_NOT_ENABLED") return t("wallet.explain.api.notEnabled");
    if (e.code === "LAST_WRAPPING") return t("wallet.explain.api.lastWrapping");
    if (e.code === "WRAPPING_EXISTS") return t("wallet.explain.api.wrappingExists");
    if (e.code === "rate_limited" || e.status === 429) return t("wallet.explain.api.rateLimited");
    if (e.status === 0) return t("wallet.explain.api.offline");
    return t("wallet.explain.api.server");
  }
  return t("wallet.explain.unknown");
}
