"use client";

import { useEffect, useState } from "react";

/**
 * The live seats-remaining counter.
 *
 * Read from the database on every load. Nothing here is hardcoded, and there is
 * deliberately no optimistic default: if the count cannot be read we say we are
 * checking, because a scarcity number that might be wrong is worse than no
 * number at all.
 */

interface Seats {
  total: number;
  remaining: number;
  soldOut: boolean;
  earlyRemaining: number;
  priceUsd: number;
}

export function useSeats() {
  const [seats, setSeats] = useState<Seats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/founders/seats", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Seats;
        if (alive) {
          setSeats(data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };

    load();
    // Slow refresh. This is a counter, not a ticker — a number that twitches
    // reads as a pressure tactic, which is the opposite of the tone here.
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { seats, failed };
}

export function SeatsCounter({ className = "" }: { className?: string }) {
  const { seats, failed } = useSeats();

  return (
    <div
      className={`inline-flex items-center gap-3 px-4 py-2 rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.04] ${className}`}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          seats ? "bg-success animate-pulse" : "bg-text-faint"
        }`}
        aria-hidden
      />
      <span className="text-small font-mono text-text-muted">
        {seats ? (
          seats.soldOut ? (
            <>All {seats.total} seats taken</>
          ) : (
            <>
              <span className="text-text font-medium tabular-nums">{seats.remaining}</span>
              {" of "}
              <span className="tabular-nums">{seats.total}</span> seats left
            </>
          )
        ) : failed ? (
          <>Checking availability</>
        ) : (
          <>Loading availability</>
        )}
      </span>
    </div>
  );
}

/** The price as it stands right now — early tranche or list. */
export function LivePrice({
  earlyPriceUsd,
  listPriceUsd,
  earlySeats,
}: {
  earlyPriceUsd: number;
  listPriceUsd: number;
  earlySeats: number;
}) {
  const { seats } = useSeats();
  const inEarlyTranche = seats ? seats.earlyRemaining > 0 : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-display-sm md:text-display font-light text-text tabular-nums">
          ${inEarlyTranche === false ? listPriceUsd : earlyPriceUsd}
        </span>
        {inEarlyTranche !== false && (
          <span className="text-lead text-text-faint line-through tabular-nums">
            ${listPriceUsd}
          </span>
        )}
        <span className="text-small text-text-muted">one payment</span>
      </div>

      <p className="text-small text-text-muted">
        {inEarlyTranche === null ? (
          <>The first {earlySeats} seats are ${earlyPriceUsd}. After that, ${listPriceUsd}.</>
        ) : inEarlyTranche ? (
          <>
            <span className="text-amber tabular-nums">{seats?.earlyRemaining}</span> seats left at
            ${earlyPriceUsd}. After that, ${listPriceUsd}.
          </>
        ) : (
          <>The ${earlyPriceUsd} tranche has sold out.</>
        )}
      </p>
    </div>
  );
}
