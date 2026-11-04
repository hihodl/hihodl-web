"use client";

/**
 * One category's spend for the active range: the app's
 * `spending-analytics/category/[id].tsx`, VIEW ONLY.
 *
 * The total, how many payments and the range, then every payment in it,
 * newest first: the category's icon in its donut colour, who it was with,
 * the day and the amount.
 *
 * WHAT STAYS ON THE PHONE
 * The app puts a Monthly budget stepper on top of this list and lets a row be
 * moved to another category. Both write to the phone's own storage, and a
 * category you moved a payment to there is not something the web can see, so
 * this list is the app's categoriser with nothing moved. It says so, once,
 * rather than offering a control that would change nothing.
 */

import { useMemo } from "react";

import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { computeSpendingAnalytics } from "@/lib/app/spending/analytics";
import { transferUsd } from "@/lib/app/spending/amounts";
import { getCategoryDef } from "@/lib/app/spending/catalog";
import { categoryName, rampColor } from "@/lib/app/spending/categories";
import { counterpartyLabel } from "@/lib/app/spending/categorize";
import { rangeLabel } from "@/lib/app/spending/range";

import { useProductHref } from "../base";
import { BackHeader } from "../hold";
import { Ion } from "../ion";
import { InAppNote, ReadFailed } from "../money/kit";
import { Skeleton } from "../ui";
import { Note, fmt, glassCard, rangeFromQuery, useSpendingRows } from "./parts";

export function CategoryScreen({ id, query }: { id: string; query: Record<string, string | string[] | undefined> }) {
  const t = useT();
  const productHref = useProductHref();
  const range = useMemo(() => rangeFromQuery(query), [query]);
  const def = getCategoryDef(id);

  const data = useSpendingRows();
  const a = useMemo(() => computeSpendingAnalytics(data.rows, range, data.hasMore), [data.rows, data.hasMore, range]);
  const transfers = a.transfersByCategory[id] ?? [];
  const total = transfers.reduce((sum, tx) => sum + transferUsd(tx), 0);
  // The icon wears this category's donut colour, so the list reads as the slice tapped.
  const accent = a.categories.find((c) => c.id === id)?.color ?? rampColor(0);
  const spendCategory = id !== "transfers";

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col pb-8">
      <BackHeader title={categoryName(def.id)} backHref={productHref("/analytics")} />

      {data.failed ? (
        <div className={`${glassCard} mt-2 rounded-[18px]`}>
          <ReadFailed title={t("analytics.readFailed.title")} body={t("analytics.readFailed.category")} onRetry={data.retry} />
        </div>
      ) : !data.loaded ? (
        <div className="mt-2 flex flex-col gap-2" aria-busy>
          <Skeleton className="mb-3 h-[60px] w-[200px]" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <>
          <div className="px-1 pb-5 pt-2">
            <p className="whitespace-nowrap text-[clamp(28px,9vw,34px)] font-bold leading-[1.15] tracking-[-1px] tabular-nums text-white">{fmt(total)}</p>
            <p className="mt-1 text-[13px] font-semibold text-white/55">
              {t("analytics.categoryScreen.summary", { count: transfers.length, range: rangeLabel(range) })}
            </p>
          </div>

          {spendCategory ? (
            <div className="mb-4">
              <InAppNote>{t("analytics.categoryScreen.inApp")}</InAppNote>
            </div>
          ) : null}

          {transfers.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-[60px]">
              <Ion name="receipt-outline" size={26} className="text-white/30" />
              <p className="text-[14px] font-semibold text-white/55">{t("analytics.categoryScreen.empty")}</p>
            </div>
          ) : (
            <ul>
              {transfers.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 border-b-[0.5px] border-white/[0.06] py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] bg-white/[0.06]" style={{ color: accent }}>
                    <Ion name={def.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-white">{counterpartyLabel(tx)}</span>
                    <span className="mt-0.5 block text-[12px] text-white/55">
                      {fmtDate(tx.createdAt, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-white">{fmt(transferUsd(tx))}</span>
                </li>
              ))}
            </ul>
          )}

          {a.capped ? <Note className="mt-3">{t("analytics.note.capped")}</Note> : null}
        </>
      )}
    </div>
  );
}
