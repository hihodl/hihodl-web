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

import { Cta, Empty, Screen, SectionLabel, Spinner } from "./kit";
import { P, count } from "./look";
import { SearchBar, sane, stayFromParams, stayToParams, type Stay } from "./SearchControls";
import { StayCard, StayCardSkeleton } from "./StayCard";
import { useSearch } from "@/lib/app/stays-data";
import type { SearchQuery } from "@/lib/app/stays";
import { staysCurrency } from "@/lib/app/display-currency";
import { useT } from "@/lib/app/i18n/react";

/** Where the reader was in each search, so Back can put them back there. */
const scrollFor = new Map<string, number>();
/** Every hotel opened this session, so the fade survives the round trip. */
const opened = new Set<string>();

export function ResultsScreen() {
  const href = useProductHref();
  const router = useRouter();
  // Also what re-renders the search when the currency changes (`staysCurrency()` below).
  const t = useT();
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
        currency: staysCurrency(),
      }
    : null;

  const { stays, nights, loading, loadingMore, error, hasMore, loadMore, resolution, pageKey } = useSearch(query);

  // Which results have already been opened this session. The app fades them,
  // and on the fourth pass down forty hotels that is the only question left.
  // Module-level, like the pages themselves: the whole point of the mark is
  // that it survives opening a hotel, which is precisely when this unmounts.
  const [seen, setSeen] = useState<Set<string>>(() => new Set(opened));
  const foot = useRef<HTMLDivElement>(null);

  /*
   * Back should land where you left, not at the top of page one.
   *
   * The browser restores scroll by itself, but it does it before the appended
   * pages have rendered — the document is still one page tall at that moment,
   * so the restore is clamped to the bottom of page one and the position is
   * silently lost. So the offset is remembered on the way out and reapplied
   * once the list is at least as long as it was, and once only: after that the
   * reader owns the scrollbar again.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !pageKey) return;
    const mark = scrollFor.get(pageKey);
    if (mark === undefined) return;
    if (!stays.length) return;
    restored.current = true;
    scrollFor.delete(pageKey);
    // After paint, so the list has its real height.
    requestAnimationFrame(() => window.scrollTo({ top: mark, behavior: "instant" as ScrollBehavior }));
  }, [pageKey, stays.length]);

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
    opened.add(hotelId);
    setSeen((was) => new Set(was).add(hotelId));
    if (pageKey) scrollFor.set(pageKey, window.scrollY);
    const q = stayToParams(committed);
    q.delete("where");
    q.delete("place");
    q.delete("q");
    q.delete("cc");
    router.push(`${href(`/travel/stay/${hotelId}`)}?${q}`);
  }

  return (
    <Screen className="gap-5">
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
            {t("trips.results.widened", { place: resolution.label })}
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
          title={t("trips.results.errorTitle")}
          body={t("trips.results.errorBody")}
          action={t("common.tryAgain")}
          onAction={() => router.refresh()}
        />
      ) : stays.length === 0 ? (
        <Empty
          icon="bed-outline"
          title={t("trips.results.emptyTitle")}
          body={t("trips.results.emptyBody")}
        />
      ) : (
        <section className="flex flex-col">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <SectionLabel>{t("trips.results.count", { count: stays.length, shown: `${count(stays.length)}${hasMore ? "+" : ""}` })}</SectionLabel>
            <p className="text-[11.5px] font-semibold tracking-[-0.1px]" style={{ color: P.textDim }}>
              {t("trips.results.totalFor", { count: nights })}
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
            {!loadingMore && hasMore ? <Cta label={t("trips.results.showMore")} variant="secondary" onClick={loadMore} /> : null}
          </div>
        </section>
      )}
    </Screen>
  );
}
