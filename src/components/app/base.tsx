"use client";

/**
 * The product's base path, decided once on the server from the host and
 * handed down, so every link rendered on the server and in the browser is the
 * same string (see lib/app/paths).
 */

import { createContext, useCallback, useContext, type ReactNode } from "react";

const BaseContext = createContext<string>("/app/spaces");

export function SpacesBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <BaseContext.Provider value={base}>{children}</BaseContext.Provider>;
}

/** `/spaces` on app.hihodl.xyz, `/app/spaces` elsewhere. */
export function useSpacesBase(): string {
  return useContext(BaseContext);
}

/** `href("/listings")` → the listings page on this host. */
export function useHref(): (path?: string) => string {
  const base = useSpacesBase();
  return useCallback((path = "") => `${base}${path}`, [base]);
}

/**
 * `productHref("/account")` → the account page on this host; `productHref()`
 * is the Dashboard. For links outside Spaces (Dashboard, Wallet, Benefits,
 * Account, Settings).
 */
export function useProductHref(): (path?: string) => string {
  const base = useSpacesBase();
  return useCallback((path = "") => `${base.replace(/\/spaces$/, "")}${path}` || "/", [base]);
}
