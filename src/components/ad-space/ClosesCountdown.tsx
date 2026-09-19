"use client";

import { useEffect, useState } from "react";

import { instantUtc, timeLeft } from "@/lib/ad-space/format";

/**
 * "Closes in 12d 5h". The server renders the absolute time (in UTC, stated),
 * and the browser swaps in the countdown after mount, so the two never
 * disagree during hydration.
 */
export function ClosesCountdown({ closesAt, closed }: { closesAt: string; closed: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const end = Date.parse(closesAt);
  const left = now === null ? null : end - now;

  if (closed || (left !== null && left <= 0)) {
    return (
      <span>
        <span className="text-sp-ink">Closed</span>
        <span className="text-sp-ink/80"> · {instantUtc(closesAt)}</span>
      </span>
    );
  }

  return (
    <span title={instantUtc(closesAt)}>
      {left === null ? (
        <span className="text-sp-ink">Closes {instantUtc(closesAt)}</span>
      ) : (
        <>
          <span className="text-sp-ink/80">Closes in </span>
          <span className="font-mono text-sp-ink">{timeLeft(left)}</span>
        </>
      )}
    </span>
  );
}
