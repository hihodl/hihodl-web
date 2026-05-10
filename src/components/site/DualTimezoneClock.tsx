"use client";

import { useEffect, useState } from "react";

/**
 * Dual timezone clock — the duality made literal.
 * Shows the user's IP timezone ("their local life") and NY ("their global money").
 * Quiet, tasteful. Lives in the top nav.
 */
export function DualTimezoneClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [localZone, setLocalZone] = useState<string>("");

  useEffect(() => {
    setNow(new Date());
    setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local");
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="hidden md:block h-7 w-44" aria-hidden />;
  }

  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);

  const localCity = localZone.split("/").pop()?.replace(/_/g, " ") || "You";
  const ny = fmt("America/New_York");
  const local = fmt(localZone);

  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-pill border border-[color:var(--color-hairline)] text-text-faint font-mono text-tiny"
      title="Your global money lives in NY. Your local life lives where you are."
    >
      <span className="uppercase tracking-wider">NY</span>
      <span className="text-text-muted">{ny}</span>
      <span className="opacity-40">◦</span>
      <span className="uppercase tracking-wider">{localCity}</span>
      <span className="text-text-muted">{local}</span>
    </div>
  );
}
