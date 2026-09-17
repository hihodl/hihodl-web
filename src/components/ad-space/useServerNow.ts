"use client";

import { useEffect, useState } from "react";

/**
 * "Now" on the server's clock, ticking. Null until the page is in the browser,
 * so the server render and the first client render agree (callers show the
 * absolute time until then).
 *
 * The difference from this browser's clock is read once per page load from
 * `/api/now`, timed at the midpoint of the request. Under 1.5 s it is ignored:
 * that is round-trip noise, not a wrong clock. Any failure means no correction.
 */

let skewOnce: Promise<number> | null = null;

function loadSkew(): Promise<number> {
  if (!skewOnce) {
    skewOnce = (async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/now", { cache: "no-store" });
        const t1 = Date.now();
        const body = (await res.json()) as { now?: unknown };
        const server = typeof body.now === "string" ? Date.parse(body.now) : NaN;
        if (!Number.isFinite(server)) return 0;
        const skew = server - (t0 + t1) / 2;
        return Math.abs(skew) < 1_500 ? 0 : skew;
      } catch {
        return 0;
      }
    })();
  }
  return skewOnce;
}

export function useServerNow(tickMs = 1_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let skew = 0;
    let live = true;
    setNow(Date.now());
    void loadSkew().then((s) => {
      skew = s;
      if (live) setNow(Date.now() + s);
    });
    const t = setInterval(() => setNow(Date.now() + skew), tickMs);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [tickMs]);
  return now;
}
