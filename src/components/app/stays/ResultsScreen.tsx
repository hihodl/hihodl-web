"use client";

/**
 * The results — the app's `results.tsx`, on the web.
 *
 * THE SEARCH THAT WIDENED SAYS SO
 *
 * The server's resolver climbs a ladder: the place asked for, then its
 * country, then somewhere near. When it had to climb, `resolution.scope` is
 * not `"exact"` and `resolution.label` names where it actually looked. That
 * line is not optional chrome. A search may widen to avoid coming back empty
 * — it may never widen in SILENCE, or somebody books a hotel in a different
 * city believing it is the one they typed.
 *
 * PAGING NEVER RE-RESOLVES
 *
 * Page two carries page one's `resolutionToken`, so a rung that runs out at
 * offset 20 cannot quietly append the rest of the country to a list being read
 * as one island. That is handled in `useSearch`; this screen only has to ask.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";

import { Cta, Empty, Ground, SectionLabel, Spinner } from "./kit";
import { P, count, nights as nightsWord } from "./look";
import { SearchBar, sane, stayFromParams, stayToParams, type Stay } from "./SearchControls";
import { StayCard, StayCardSkeleton } from "./StayCard";
import { useSearch } from "@/lib/app/stays-data";
import type { SearchQuery } from "@/lib/app/stays";

export function ResultsScreen() {
  const href = useProductHref();
  const router = useRouter();
  const params = useSearchParams();

  // The URL is the state. Editing the bar changes a draft; pressing Search
  // writes it back to the address, which is what re-runs the search.
  const committed = useMemo(() => sane(stayFromParams(new URLSearchParams(params.toString()))), [params]);
  const [draft, setDraft] = useState<Stay>(committed);
  useEffect(() => setDraft(committed), [committed]);

  const query: SearchQuery | null = committed.where
    ? {
        ...(committed.where.placeId ? { placeId: committed.where.placeId } : {}),
        ...(committed.where.query ? { query: committed.where.query } : {}),
        ...(committed.where.countryCode ? { countryCode: committed.where.countryCode } : {}),
        checkin: committed.checkin,
        checkout: committed.checkout,
        adults: committed.adults,
        ...(committed.children.length ? { children: committed.children } : {}),
        currency: "EUR",
      }
    : null;

  const { stays, nights, loading, loadingMore, error, hasMore, loadMore, resolution } = useSearch(query);

  // Which results have already been opened this session. The app fades them,
  // and on the fourth pass down forty hotels that is the only question left.
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const foot = useRef<HTMLDivElement>(null);

  // The next page loads when the foot of the list comes into view. `hasMore`
  // and `loadingMore` are in the deps so the observer is rebuilt when either
  // changes, and a page in flight never triggers a second.
  useEffect(() => {
    const el = foot.current;
    if (!el || !hasMore || loadingMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  function open(hotelId: string) {
    setSeen((was) => new Set(was).add(hotelId));
    const q = stayToParams(committed);
    q.delete("where");
    q.delete("place");
    q.delete("q");
    q.delete("cc");
    router.push(`${href(`/travel/stay/${hotelId}`)}?${q}`);
  }

  return (
    <Ground className="gap-5 rounded-[20px] p-4 sm:p-6">
      <SearchBar
        value={draft}
        onChange={setDraft}
        searching={loading}
        onSearch={() => router.push(`${href("/travel/search")}?${stayToParams(sane(draft))}`)}
      />

      {resolution && resolution.scope !== "exact" && resolution.label ? (
        <div
          className="flex items-start gap-2.5 rounded-[14px] px-3.5 py-3"
          style={{ background: P.cautionSoft }}
        >
          <span className="mt-px shrink-0" style={{ color: P.caution }} aria-hidden>
            <Ion name="information-circle-outline" size={15} />
          </span>
          <p className="text-[12.5px] font-semibold leading-[18px] tracking-[-0.1px]" style={{ color: P.caution }}>
            {`Nothing matched exactly, so these are stays in ${resolution.label}.`}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div>
          <StayCardSkeleton hero />
          {Array.from({ length: 5 }, (_, i) => (
            <StayCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Empty
          icon="cloud-offline-outline"
          title="Couldn't load stays"
          body="Check your connection and try again."
          action="Try again"
          onAction={() => router.refresh()}
        />
      ) : stays.length === 0 ? (
        <Empty
          icon="bed-outline"
          title="Nothing available for those dates"
          body="Try shifting your dates by a night or two, or search a nearby city."
        />
      ) : (
        <section className="flex flex-col">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <SectionLabel>{`${count(stays.length)}${hasMore ? "+" : ""} ${stays.length === 1 ? "stay" : "stays"}`}</SectionLabel>
            <p className="text-[11.5px] font-semibold tracking-[-0.1px]" style={{ color: P.textDim }}>
              {`Total for ${nightsWord(nights)}, cheapest first`}
            </p>
          </div>

          {stays.map((stay, i) => (
            <StayCard
              key={stay.hotelId}
              stay={stay}
              nights={nights}
              hero={i === 0}
              seen={seen.has(stay.hotelId)}
              onOpen={() => open(stay.hotelId)}
            />
          ))}

          <div ref={foot} className="flex justify-center py-6">
            {loadingMore ? <Spinner size={20} color={P.greenText} /> : null}
            {!loadingMore && hasMore ? <Cta label="Show more" variant="secondary" onClick={loadMore} /> : null}
          </div>
        </section>
      )}
    </Ground>
  );
}
