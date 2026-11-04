"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { UTM_KEYS, safePath, storeOf, track, visitUtms, withStoreAttribution } from "@/lib/analytics/mixpanel";

/**
 * Mounted once from the root layout. Renders nothing.
 *
 * - web_page_viewed on the first load and on every App Router navigation.
 * - web_store_button_tapped on any tap of a store link, wherever it is on the
 *   page (one listener, so a new store badge is counted without wiring), and
 *   the link gets the visit's campaign on its way out (withStoreAttribution).
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Not on the onramp: its address briefly carries a Stripe client secret.
    if (!pathname || pathname.startsWith("/onramp")) return;
    const utms = visitUtms();
    const props: Record<string, string> = { path: safePath(pathname) };
    for (const k of UTM_KEYS) if (utms[k]) props[k] = utms[k] as string;
    track("web_page_viewed", props);
  }, [pathname]);

  useEffect(() => {
    // Capture phase: runs before a component's own onClick, and before the
    // browser follows the link, so the rewritten href is the one it opens.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const store = storeOf(a.href);
      if (!store) return;
      a.href = withStoreAttribution(a.href);
      track("web_store_button_tapped", { store, path: safePath(window.location.pathname) }, true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
