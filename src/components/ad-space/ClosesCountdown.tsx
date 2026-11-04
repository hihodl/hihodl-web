"use client";

import { useEffect, useState } from "react";

import { instantUtc, timeLeft } from "@/lib/ad-space/format";
import { Rich, useT } from "@/lib/app/i18n/react";

/**
 * "Closes in 12d 5h". The server renders the absolute time (in UTC, stated),
 * and the browser swaps in the countdown after mount, so the two never
 * disagree during hydration.
 */
export function ClosesCountdown({ closesAt, closed }: { closesAt: string; closed: boolean }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);

  const end = Date.parse(closesAt);
  const left = now === null ? null : end - now;

  if (closed || (left !== null && left <= 0)) {
    return (
      <span>
        <span className="text-sp-ink">{t("board.closes.closed")}</span>
        <span className="text-sp-ink/80"> · {instantUtc(closesAt)}</span>
      </span>
    );
  }

  return (
    <span title={instantUtc(closesAt)}>
      {left === null ? (
        <span className="text-sp-ink">{t("board.countdown.closesAt", { when: instantUtc(closesAt) })}</span>
      ) : (
        <span className="text-sp-ink/80">
          <Rich
            k="board.countdown.closesIn"
            vars={{ left: timeLeft(left) }}
            tags={{ time: (c) => <span className="font-mono text-sp-ink">{c}</span> }}
          />
        </span>
      )}
    </span>
  );
}
