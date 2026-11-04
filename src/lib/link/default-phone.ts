"use client";

/**
 * Which phone approves the web: the default one, from `approver` on
 * GET /wallet-backup/status (documentation/the-default-phone-approves.md).
 * null while unread, with no phone linked, or from an older server.
 */

import { useWalletStatus } from "@/lib/app/spaces-data";

import { phonePlatformOf, type PhonePlatform } from "./payment-approval-core";

export function useDefaultPhone(): PhonePlatform | null {
  const status = useWalletStatus();
  return phonePlatformOf(status.data?.approver?.platform);
}
