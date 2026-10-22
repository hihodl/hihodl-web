"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * The search box and tiles on /esim. Every destination arrives from the
 * server with its name, link and price, so typing is a filter over a list
 * already on the page: no request per key. Empty box: the popular tiles.
 * Enter with one match opens it.
 */

export interface Destination {
  code: string;
  name: string;
  href: string;
  flag: string;
  /** USD, or null when prices could not be read. */
  fromPrice: number | null;
}

/** Lowercase, no accents, so "cote" finds Côte d'Ivoire. */
function plain(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function price(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

const MAX_RESULTS = 24;

export function DestinationSearch({ destinations, popular }: { destinations: Destination[]; popular: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = plain(query.trim());
    if (!q) {
      const byCode = new Map(destinations.map((d) => [d.code, d]));
      return popular.map((c) => byCode.get(c)).filter((d): d is Destination => !!d);
    }
    const starts: Destination[] = [];
    const contains: Destination[] = [];
    for (const d of destinations) {
      const name = plain(d.name);
      if (name.startsWith(q) || d.code.toLowerCase() === q) starts.push(d);
      else if (name.includes(q)) contains.push(d);
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [query, destinations, popular]);

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim() && shown.length === 1) router.push(shown[0].href);
        }}
      >
        <label htmlFor="esim-search" className="sr-only">
          Where are you going?
        </label>
        <input
          id="esim-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Where are you going?"
          autoComplete="off"
          enterKeyHint="go"
          className="w-full px-6 py-4 rounded-pill bg-white/[0.04] border border-[color:var(--color-hairline)] text-text text-body placeholder:text-text-faint focus:outline-none focus:border-moonlight transition-colors"
        />
      </form>

      <p className="mt-8 text-tiny uppercase tracking-wider text-text-faint" aria-live="polite">
        {query.trim() ? (shown.length ? "Destinations" : "No match. Try the country name in English.") : "Popular"}
      </p>

      {shown.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((d) => (
            <li key={d.code}>
              <Link
                href={d.href}
                className="flex items-center gap-4 rounded-card px-5 py-4 border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.06] transition-colors duration-180"
              >
                <span className="text-h4 leading-none" aria-hidden>
                  {d.flag}
                </span>
                <span className="min-w-0 flex-1 truncate text-body text-text">{d.name}</span>
                {d.fromPrice !== null && (
                  <span className="whitespace-nowrap text-small text-text-muted">
                    from <span className="text-amber">{price(d.fromPrice)}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
