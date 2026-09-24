/**
 * The person's HOLD wallet, as the Dashboard and Account describe it.
 *
 * Two places it can come from, and the server's own words for each:
 *   web   /wallet-backup/status says `web_wallet`; its Solana address is
 *         `registered_address` once an unlock has registered it
 *   app   `app_wallet` (or any address /me/addresses knows): the app made it,
 *         and /me/addresses has its Solana and EVM addresses
 * No wallet: it is made in the HOLD app (the web makes none since 2026-09-24).
 *
 * Balances are read-only, from the public address, through the backend's
 * authed Solana RPC proxy: no unlock, no key.
 */

"use client";

import useSWR from "swr";

import { getBalances, usdcAccountState, type Balances, type UsdcAccountState } from "@/lib/wallet/api";

import { useMyAddresses, useWalletStatus } from "./spaces-data";

export interface HoldWallet {
  loading: boolean;
  kind: "web" | "app" | "none";
  /** The Solana address sponsors and deposits reach, when known. */
  solana: string | null;
  /** The app wallet's EVM address (Base, Polygon, Ethereum), when it has one. */
  evm: string | null;
  /** A web wallet whose address the backend does not watch yet: one unlock on the Wallet page registers it. */
  unregistered: boolean;
  /** The Wallet page exists for this person. */
  walletPage: boolean;
}

export function useHoldWallet(): HoldWallet {
  const status = useWalletStatus();
  const addrs = useMyAddresses();
  const loading = (status.data === undefined && !status.error) || (addrs.data === undefined && !addrs.error);
  const s = status.data ?? null;
  const a = addrs.data ?? {};
  const appSolana = a.solana ?? null;
  const evm = a.base ?? a.polygon ?? a.ethereum ?? null;
  const walletPage = !!s && s.enabled !== false;

  if (s?.state === "web_wallet") {
    const solana = s.registered_address ?? appSolana;
    return { loading, kind: "web", solana, evm, unregistered: !s.registered_address, walletPage };
  }
  if (s?.state === "app_wallet" || appSolana || evm) {
    return { loading, kind: "app", solana: appSolana, evm, unregistered: false, walletPage };
  }
  return { loading, kind: "none", solana: null, evm: null, unregistered: false, walletPage };
}

export function useBalances(address: string | null) {
  return useSWR<Balances>(address ? ["balances", address] : null, () => getBalances(address!), {
    revalidateOnFocus: true,
    focusThrottleInterval: 30_000,
    shouldRetryOnError: false,
  });
}

/** Whether sponsors can pay this Solana address in USDC yet (the publish gate's check). */
export function useUsdcAccount(address: string | null) {
  return useSWR<UsdcAccountState>(address ? ["usdc-account", address] : null, () => usdcAccountState(address!), {
    revalidateOnFocus: true,
    focusThrottleInterval: 30_000,
    shouldRetryOnError: false,
  });
}
