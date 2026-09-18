/**
 * Whether this person sees the web wallet at all (the backend's rollout
 * gate: WEB_WALLET_OPEN / WEB_WALLET_ALLOWLIST, and always for somebody who
 * already has one).
 *
 * undefined while asking; false when the backend says no, and also when it
 * cannot be asked: a closed gate and a failed read both mean no Wallet item,
 * never an error on screen.
 */

"use client";

import { useEffect, useState } from "react";

import { getWalletStatus } from "./api";

export function useWalletEnabled(userId: string): boolean | undefined {
  const [enabled, setEnabled] = useState<{ userId: string; value: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    getWalletStatus().then(
      (s) => live && setEnabled({ userId, value: s.enabled !== false }),
      () => live && setEnabled({ userId, value: false }),
    );
    return () => {
      live = false;
    };
  }, [userId]);
  return enabled && enabled.userId === userId ? enabled.value : undefined;
}
