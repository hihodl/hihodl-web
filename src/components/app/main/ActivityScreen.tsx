"use client";

/**
 * Activity: the app's own screen, on the web, VIEW ONLY.
 *
 * Copied from `app/(drawer)/(internal)/activity/index.tsx`, in its order:
 *
 *   the balance block   the scope's name in the app's section label, the big
 *                       figure, and what the figure is — and it REWINDS to the
 *                       row you have scrolled to, so the number beside a row
 *                       is what you had right after it happened
 *   search + filter     the field, and the accounts filter beside it
 *   the list            day dividers, then rows: avatar, action, counterparty,
 *                       the signed amount and the time
 *   more                `/transfers?limit&offset`, a page at a time
 *   the foot            "No activity found." when empty, "End of activity"
 *                       when there is no more
 *
 * Tapping a row opens what the server knows about it (`/transfers/:id/details`)
 * as a panel. Nothing on this screen writes: the filters, the search, the
 * rewind and the fold rules are all client-side, and the only writes the app
 * makes here (dismissing an intent bubble, analytics) are not ported.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  activityRows,
  dayLabel,
  paymentUsdDelta,
  rowInScope,
  timeLabel,
  toPaymentItem,
  type PaymentItem,
} from "@/lib/app/activity-rules";
import { getTransferDetails, type LedgerSubaccount, type Transfer } from "@/lib/app/hold-api";
import {
  isStable,
  splitForContainer,
  useAllBalances,
  useContainer,
  usePrices,
  useSuppliedBySlug,
  useTransfers,
  usdOf,
} from "@/lib/app/money";

import { Ion } from "../ion";
import { Alert, glass, Skeleton } from "../ui";
import { money } from "../wallet/app-kit";
import { ActivityRow, DayDivider, readRow } from "./activity-parts";

const FIRST_PAGE = 40;
const PAGE_SIZE = 40;

/** "All accounts", the app's default: no filter applied. */
const ALL = "__all__";

export function ActivityScreen() {
  const container = useContainer();
  const subaccounts = useMemo<LedgerSubaccount[]>(() => container.data?.subaccounts ?? [], [container.data]);

  const scopes = useMemo(() => {
    const pockets = subaccounts.filter((s) => s.slug !== "main" && s.slug !== "savings");
    return [
      { slug: "main", label: "Main" },
      { slug: "savings", label: "Savings" },
      ...pockets.map((p) => ({ slug: p.slug, label: p.displayName || p.slug })),
    ];
  }, [subaccounts]);

  const [selected, setSelected] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  /**
   * Membership of the current filter. Always false when nothing is filtered,
   * which is the "all accounts" reading and lands on green like any other view
   * that is not the sending account — see moveSignForScope.
   */
  const inScope = useCallback((slug: string) => selected !== ALL && slug === selected, [selected]);

  /* ── The pages ── */
  const first = useTransfers(FIRST_PAGE, 0);
  const [more, setMore] = useState<Transfer[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [pageError, setPageError] = useState(false);

  // A new first page means the list was refetched under us; the pages we had
  // are about the old one.
  useEffect(() => {
    setMore([]);
    setExhausted(false);
    setPageError(false);
  }, [first.data]);

  const raw = useMemo(() => [...(first.data?.transfers ?? []), ...more], [first.data, more]);
  const hasMore = !exhausted && (first.data?.hasMore ?? false);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setPageError(false);
    try {
      const { getTransfers } = await import("@/lib/app/hold-api");
      const answer = await getTransfers(PAGE_SIZE, raw.length);
      setMore((m) => [...m, ...answer.transfers]);
      if (!answer.hasMore || answer.transfers.length === 0) setExhausted(true);
    } catch {
      // A page that would not load is said, never guessed at.
      setPageError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, raw.length]);

  /* Infinite scroll: the app fetches at 0.6 of a viewport from the end. */
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  /* ── The rows ── */
  const all = useMemo(() => raw.map(toPaymentItem), [raw]);

  const filtered = useMemo(() => {
    const scoped = selected === ALL ? all : all.filter((p) => rowInScope(p, selected));
    const folded = activityRows(scoped);
    const needle = q.trim().toLowerCase();
    if (!needle) return folded;
    return folded.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        (p.actionLabel ?? "").toLowerCase().includes(needle) ||
        (p.tokenSymbol ?? "").toLowerCase().includes(needle) ||
        p.amount.toLowerCase().includes(needle),
    );
  }, [all, selected, q]);

  /* ── The balance above them ── */
  const balances = useAllBalances(scopes.map((s) => s.slug));
  const inScopeRows = useMemo(() => {
    const answers = balances.data;
    if (!answers) return [];
    return scopes.filter((s) => selected === ALL || s.slug === selected).flatMap((s) => answers[s.slug]?.balances ?? []);
  }, [balances.data, scopes, selected]);

  const symbols = useMemo(
    () => [...new Set(inScopeRows.map((b) => (b.symbol ?? b.tokenId ?? "").split(".")[0].toUpperCase()).filter(Boolean))],
    [inScopeRows],
  );
  const mints = useMemo(() => [...new Set(inScopeRows.map((b) => b.mint).filter((m): m is string => !!m))], [inScopeRows]);
  const prices = usePrices(symbols, mints);
  const priceMap = useMemo(() => prices.data?.prices ?? {}, [prices.data]);
  const supplied = useSuppliedBySlug();

  /**
   * The anchor: what the selected accounts hold right now.
   *
   * Dollars only, which is what the app does in fintech — Activity's balance
   * is the spendable dollar balance, distinct from the Home total, and
   * excluding volatile assets is also what makes the rewind exact ($1 legs, no
   * live price). Supplied money is added in: supplied dollars are still cash,
   * and leaving them out is why this header used to read $0 in Savings right
   * after a move.
   */
  const anchorUsd = useMemo(() => {
    let liquid = 0;
    for (const b of inScopeRows) {
      const sym = (b.symbol ?? b.tokenId ?? "").split(".")[0].toUpperCase();
      if (!isStable(sym)) continue;
      liquid += usdOf(b, priceMap) ?? 0;
    }
    const working = scopes
      .filter((s) => selected === ALL || s.slug === selected)
      .reduce((sum, s) => sum + splitForContainer({ slug: s.slug, liquidUsd: 0, suppliedBySlug: supplied.bySlug }).workingUsd, 0);
    return liquid + working;
  }, [inScopeRows, priceMap, scopes, selected, supplied.bySlug]);

  const settled = balances.data !== undefined && prices.data !== undefined && supplied.loaded;

  /**
   * The balance right after each row. Only when the list is the complete
   * ledger for one currency: a search that filters the list cannot
   * reconstruct a running total, so the rewind is off while one is typed.
   */
  const balanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!settled || q.trim()) return map;
    let running = anchorUsd;
    for (const p of filtered) {
      map.set(p.id, running);
      running -= paymentUsdDelta(p, inScope);
    }
    return map;
  }, [settled, q, anchorUsd, filtered, inScope]);

  /** The topmost row on screen, which is the point in time the header stands at. */
  const [topId, setTopId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // At the top the header is the live total, whatever row happens to sit under
  // it. Only a scroll moves the figure back in time, which is what the app's
  // own `scrolled` means.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const rewound = scrolled && topId ? balanceById.get(topId) : undefined;
  const topRow = scrolled && topId ? filtered.find((p) => p.id === topId) : undefined;
  // Floored at zero: the walk-back accumulates drift the ledger cannot see
  // (network fees, sub-cent rounding), so the oldest rows can land a few cents
  // under. A dollar balance was never negative, and "-$0.01" reads as a bug.
  const shownUsd = Math.max(0, rewound ?? anchorUsd);

  const scopeLabel =
    selected === ALL ? "All accounts" : (() => {
      const s = scopes.find((x) => x.slug === selected);
      if (!s) return "All accounts";
      return s.slug === "main" || s.slug === "savings" ? `${s.label} account` : s.label;
    })();

  const headerLabel =
    topRow && rewound !== undefined ? `${dayLabel(topRow.date)}, ${timeLabel(topRow.date)}` : "Current balance";

  /* ── Details ── */
  const [open, setOpen] = useState<PaymentItem | null>(null);

  /* ── Day dividers ── */
  const sections = useMemo(() => {
    const out: ({ kind: "day"; key: string; label: string } | { kind: "row"; key: string; item: PaymentItem })[] = [];
    let day = "";
    for (const item of filtered) {
      const label = dayLabel(item.date);
      if (label !== day) {
        out.push({ kind: "day", key: `day-${label}-${item.id}`, label });
        day = label;
      }
      out.push({ kind: "row", key: item.txHash || item.id, item });
    }
    return out;
  }, [filtered]);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col pb-6" onScroll={() => undefined}>
      {/* ── The balance ── */}
      <div className="px-1 pt-0.5">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-white/55">{scopeLabel}</p>
        {balances.error || prices.error ? (
          <>
            <p className="text-[40px] font-strong leading-[46px] tracking-[-0.5px] text-white">—</p>
            <p className="mt-0.5 text-[14px] font-strong text-[#9FB7C2]">We could not read your balance just now.</p>
          </>
        ) : !settled ? (
          <Skeleton className="h-[46px] w-[220px]" />
        ) : (
          <>
            <p className="text-[40px] font-strong leading-[46px] tracking-[-0.5px] tabular-nums text-white">{money(shownUsd)}</p>
            <p className="mt-0.5 text-[14px] font-strong text-[#9FB7C2]">{headerLabel}</p>
          </>
        )}
        {settled && supplied.failed.length > 0 ? (
          <p className="mt-1.5 text-[12px] leading-[17px] text-amber">
            {supplied.failed.join(" and ")} did not answer, so anything earning there is missing from this balance.
          </p>
        ) : null}
      </div>

      {/* ── Search and the accounts filter ── */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <label className="flex h-[42px] min-w-0 flex-1 items-center rounded-input border border-white/[0.14] bg-white/[0.08]">
          <span className="ml-3 text-white/55">
            <Ion name="search-outline" size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activity..."
            aria-label="Search activity"
            className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-white/55"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="mr-3 text-white/55 hover:text-white">
              <Ion name="close-circle" size={18} />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          aria-label={`Filter accounts. Showing ${scopeLabel}`}
          className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.12]"
        >
          <Ion name="options-outline" size={19} />
          {selected !== ALL ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber ring-[1.5px] ring-[#070C12]" /> : null}
        </button>
      </div>

      {filterOpen ? (
        <div className={`${glass} mt-2 flex flex-wrap gap-1.5 p-3`} role="group" aria-label="Accounts">
          {[{ slug: ALL, label: "All accounts" }, ...scopes].map((s) => {
            const on = s.slug === selected;
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(s.slug)}
                className={`inline-flex h-8 shrink-0 items-center rounded-[16px] border px-3 text-tiny transition-colors ${
                  on ? "border-amber/45 bg-amber/20 text-[#FFE2A1]" : "border-white/10 bg-white/[0.04] text-[#CFE3EC] hover:bg-white/[0.08]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── The list ── */}
      {first.error ? (
        <div className="mt-4">
          <Alert>We could not read your activity just now. Reload the page to try again.</Alert>
        </div>
      ) : first.data === undefined ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="mt-10 text-center text-[14px] text-white/55">No activity found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sections.map((s) =>
            s.kind === "day" ? (
              <DayDivider key={s.key} label={s.label} />
            ) : (
              <TrackedRow
                key={s.key}
                item={s.item}
                subaccounts={subaccounts}
                prices={priceMap}
                inScope={inScope}
                onTop={setTopId}
                onOpen={() => setOpen(s.item)}
              />
            ),
          )}
        </div>
      )}

      {/* ── The foot ── */}
      <div ref={sentinel} />
      {pageError ? (
        <div className="py-5">
          <Alert>
            The next page would not load.{" "}
            <button type="button" onClick={() => void loadMore()} className="underline underline-offset-2">
              Try again
            </button>
          </Alert>
        </div>
      ) : loadingMore ? (
        <div className="flex flex-col gap-2 py-5">
          <Skeleton className="h-16" />
        </div>
      ) : !hasMore && filtered.length > 0 ? (
        <p className="py-5 text-center text-[12px] font-strong tracking-[0.3px] text-white/55">End of activity</p>
      ) : null}

      {open ? <Details item={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

/**
 * One row that reports when it becomes the topmost one on screen, which is
 * what rewinds the balance above the list.
 */
function TrackedRow({
  item,
  subaccounts,
  prices,
  inScope,
  onTop,
  onOpen,
}: {
  item: PaymentItem;
  subaccounts: readonly LedgerSubaccount[];
  prices: Record<string, number>;
  inScope: (slug: string) => boolean;
  onTop: (id: string) => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        // The row crossing the top of the viewport is the point in time the
        // header stands at.
        if (entries[0]?.isIntersecting) onTop(item.id);
      },
      { rootMargin: "0px 0px -92% 0px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [item.id, onTop]);

  return (
    <div ref={ref}>
      <ActivityRow item={item} reading={readRow(item, inScope, subaccounts, prices)} surface="card" onOpen={onOpen} />
    </div>
  );
}

/* ── What the server knows about one row ──────────────────────────── */

/**
 * The transaction, as a panel. Read only: the app lets you set a category from
 * here, which is a write, so it is not ported.
 *
 * Whatever comes back is drawn as the server named it rather than renamed
 * here: a receipt that quietly relabels a field is a receipt that can be
 * wrong about one.
 */
function Details({ item, onClose }: { item: PaymentItem; onClose: () => void }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getTransferDetails(item.id).then(
      (d) => live && setDetail((d as Record<string, unknown>) ?? {}),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [item.id]);

  const rows: [string, string][] = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value === "object") return;
    rows.push([label, String(value)]);
  };
  const source = (detail?.transfer as Record<string, unknown>) ?? detail ?? {};
  push("Status", item.status);
  push("When", `${dayLabel(item.date)}, ${timeLabel(item.date)}`);
  push("Amount", item.amount);
  push("Network", source.chain ?? item.chain);
  push("Transaction", source.txHash ?? item.txHash);
  push("Note", source.note);
  push("Method", source.method);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-[#030b13]/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`${glass} relative m-3 flex max-h-[80dvh] w-full max-w-[460px] flex-col overflow-y-auto p-5`} role="dialog" aria-label="Transaction">
        <p className="text-[17px] font-bold text-white">{item.actionLabel || item.title}</p>
        <p className="mt-0.5 text-[13px] text-white/55">{item.title}</p>

        {failed ? (
          <p className="mt-4 text-[13px] text-[#9FB7C2]">We could not read the rest of this transaction just now.</p>
        ) : detail === null ? (
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : null}

        <dl className="mt-4 flex flex-col gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-[13px] text-white/55">{label}</dt>
              <dd className="min-w-0 break-all text-right text-[13px] text-white">{value}</dd>
            </div>
          ))}
        </dl>

        {item.foldedLegs && item.foldedLegs.length > 1 ? (
          <div className="mt-4 rounded-[18px] bg-white/[0.04] p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.3px] text-white/55">Paid in {item.foldedLegs.length} parts</p>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {item.foldedLegs.map((leg) => (
                <div key={leg.id} className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-strong text-white/65">{leg.chain ?? "—"}</span>
                  <span className="text-[14px] font-bold tabular-nums text-white">{money(Math.abs(leg.tokenAmount))}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-[12px] leading-[17px] text-white/55">Categories and notes are set in the HOLD app.</p>
      </div>
    </div>
  );
}
