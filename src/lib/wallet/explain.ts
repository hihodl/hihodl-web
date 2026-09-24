/**
 * What a failed call to the wallet's backend says to a person. Shared by the
 * Wallet page, Send, the link screen and Your phone, so the same failure
 * reads the same everywhere. Never red.
 *
 * The web makes and opens no wallet any more (Alex, 2026-09-24), so the
 * passkey, crypto and backup failures this used to explain are gone with the
 * code that threw them.
 */

import { t } from "@/lib/app/i18n";

import { WalletApiError } from "./api";

/** What to tell the person, for anything a call can throw. Never red. */
export function explain(e: unknown): string {
  if (e instanceof WalletApiError) {
    if (e.code === "rate_limited" || e.status === 429) return t("wallet.explain.api.rateLimited");
    if (e.status === 0) return t("wallet.explain.api.offline");
    return t("wallet.explain.api.server");
  }
  return t("wallet.explain.unknown");
}
