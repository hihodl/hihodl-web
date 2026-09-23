"use client";

/**
 * Realised gains — the year as a story, not a tax form.
 *
 * Ported from `app/(drawer)/(internal)/invest/report.tsx`: the year stepper
 * (a caption when there is only one year), what could not be valued ABOVE the
 * number, the sentence the year opens with, the gains/losses split, interest
 * kept apart as income, the sales, the dollars spent and the network fees
 * each on their own line, and the export.
 *
 * The files are the server's (`GET /portfolio/realized/download`), the same
 * PDF and CSV the app shares. The app puts the PDF behind the share disc in
 * its header and the CSV in a button at the foot; the web keeps both places
 * and, since a browser saves rather than shares, the disc is a download.
 *
 * A failed read is never drawn as an empty year: one of them says "you owe
 * nothing". Losses are white, never red.
 */

import { useMemo, useState } from "react";

import { downloadRealized, type RealizedDisposal, type ReportFormat } from "@/lib/app/hold-api";
import { useRealized } from "@/lib/app/money";
import { shortDate, summariseTaxYear, taxYearsAvailable, tokenUnits, unitPrice, usd } from "@/lib/app/portfolio";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { ReadFailed } from "./kit";
import { HeaderDisc, NoteCard, PortfolioHeader, SectionTitle, UP, glassCard } from "./portfolio-kit";

export function RealisedGainsScreen() {
  const href = useProductHref();
  const thisYear = new Date().getUTCFullYear();
  const all = useRealized("all");
  // The picker falls back to this year when the all-time read fails; the
  // per-year read below is the one whose failure the person is told about.
  const years = useMemo(() => (all.data ? taxYearsAvailable(all.data.disposals ?? []) : [thisYear]), [all.data, thisYear]);
  const [year, setYear] = useState(thisYear);
  const report = useRealized(year);
  const summary = useMemo(() => (report.data ? summariseTaxYear(year, report.data) : null), [report.data, year]);

  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [downloadFailed, setDownloadFailed] = useState<ReportFormat | null>(null);
  const download = async (format: ReportFormat) => {
    if (!summary || busy) return;
    setBusy(format);
    setDownloadFailed(null);
    try {
      await downloadRealized(year, format);
    } catch {
      setDownloadFailed(format);
    } finally {
      setBusy(null);
    }
  };

  const idx = years.indexOf(year);
  const older = idx >= 0 && idx < years.length - 1 ? years[idx + 1] : null;
  const newer = idx > 0 ? years[idx - 1] : null;
  const h = summary?.headline;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col">
      <PortfolioHeader
        title="Realised gains"
        back={href("/invest/performance")}
        right={<HeaderDisc icon="download-outline" label="Download as PDF" onClick={() => void download("pdf")} disabled={!summary || !!busy} />}
      />

      <div className="flex items-center justify-center gap-[18px] pb-3.5 pt-0.5">
        {years.length > 1 ? (
          <>
            <button type="button" onClick={() => older && setYear(older)} disabled={!older} aria-label="Previous year" className="text-white disabled:opacity-25">
              <Ion name="chevron-back" size={18} />
            </button>
            <span className="min-w-[64px] text-center text-[17px] font-bold tabular-nums text-white">{year}</span>
            <button type="button" onClick={() => newer && setYear(newer)} disabled={!newer} aria-label="Next year" className="text-white disabled:opacity-25">
              <Ion name="chevron-forward" size={18} />
            </button>
          </>
        ) : (
          <span className="text-[13px] font-strong tracking-[0.2px] text-white/[0.7]">Tax year {year}</span>
        )}
      </div>

      {!report.data && !report.error ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[64px]" />
        </div>
      ) : report.error && !report.data ? (
        <div className={glassCard}>
          <ReadFailed
            title={`We couldn't load ${year}`}
            body="That's not the same as having sold nothing — we just couldn't reach the figures."
            onRetry={() => void report.mutate()}
          />
        </div>
      ) : !summary || !h ? null : (
        <div className="flex flex-col gap-3">
          {/* Above the number, deliberately: by the time you have read the
              figure it is too late to learn what it leaves out. */}
          {summary.exclusions.length > 0 ? (
            <NoteCard tone="notice" title={`${summary.excludedCount} not counted below`}>
              {summary.exclusions.map((line) => (
                <p key={line} className="mb-[3px]">
                  {line}
                </p>
              ))}
            </NoteCard>
          ) : null}

          <div className={`${glassCard} mb-1 p-[22px]`}>
            <p className="text-[14px] font-strong text-white/[0.8]">
              {h.kind === "nothing"
                ? `You sold nothing in ${year}`
                : h.kind === "dollarsOnly"
                  ? `Nothing to declare for ${year}`
                  : h.kind === "even"
                    ? `In ${year} you broke even`
                    : h.kind === "made"
                      ? `In ${year} you made`
                      : `In ${year} you lost`}
            </p>
            {h.kind === "nothing" ? (
              <p className="mt-2.5 text-[14px] leading-[21px] text-white/[0.8]">
                Anything you still hold is in your portfolio. A gain only becomes real when something leaves.
              </p>
            ) : h.kind === "dollarsOnly" ? (
              <p className="mt-2.5 text-[14px] leading-[21px] text-white/[0.8]">
                You moved {usd(summary.spending.amountUsd)} this year, all of it in dollars. A dollar is worth a dollar when you spend it, so there&apos;s no
                gain or loss to report. That starts the day you sell something whose price moves.
              </p>
            ) : h.kind === "even" ? (
              <>
                <p className="mt-1 text-[44px] font-bold leading-[1.1] tracking-[-1.4px] text-white">Broke even</p>
                <p className="mt-1.5 text-[13px] font-strong text-white/[0.7]">
                  across {h.sales} {h.sales === 1 ? "sale" : "sales"} — what you sold was worth what you paid for it
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 truncate text-[44px] font-bold leading-[1.1] tracking-[-1.4px] tabular-nums" style={{ color: h.kind === "made" ? UP : "#FFFFFF" }}>
                  {usd(h.amountUsd)}
                </p>
                <p className="mt-1.5 text-[13px] font-strong text-white/[0.7]">
                  across {h.sales} {h.sales === 1 ? "sale" : "sales"}
                  {summary.fees.count > 0 ? ` · ${usd(summary.fees.costUsd)} of network fees` : ""}
                </p>
                {/* The split, only with something on both sides. */}
                {summary.gainsUsd > 0 && summary.lossesUsd > 0 ? (
                  <>
                    <div className="mt-[18px] flex h-1.5 gap-0.5 overflow-hidden rounded-[3px] bg-white/[0.08]" role="img" aria-label={`${usd(summary.gainsUsd)} up, ${usd(summary.lossesUsd)} down`}>
                      <span style={{ flex: summary.gainsUsd, backgroundColor: UP }} />
                      <span style={{ flex: summary.lossesUsd, backgroundColor: "rgba(255,255,255,0.35)" }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[12px] font-strong tabular-nums">
                      <span style={{ color: UP }}>{usd(summary.gainsUsd)} up</span>
                      <span className="text-white/[0.7]">{usd(summary.lossesUsd)} down</span>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>

          {summary.incomeUsd > 0 ? (
            <NoteCard title={`Plus ${usd(summary.incomeUsd)} earned`}>
              Interest paid to you while you held. Most tax returns treat that as income rather than a gain, so it&apos;s kept separate.
            </NoteCard>
          ) : null}

          {summary.sales.length > 0 ? (
            <div>
              <SectionTitle>What you sold</SectionTitle>
              <div className={`${glassCard} px-4`}>
                {summary.sales.map((d, i) => (
                  <SaleRow key={`${d.transactionId}-${i}`} sale={d} first={i === 0} />
                ))}
              </div>
            </div>
          ) : null}

          {summary.spending.count > 0 ? (
            <div className={`${glassCard} flex items-center px-4 py-[13px]`}>
              <div className="min-w-0 flex-1 pr-2.5">
                <p className="text-[15px] font-bold text-white">{usd(summary.spending.amountUsd)} paid in dollars</p>
                <p className="mt-0.5 text-[12px] font-strong text-white/[0.7]">
                  {summary.spending.count} {summary.spending.count === 1 ? "payment" : "payments"} · a dollar is worth a dollar, so nothing to declare
                </p>
              </div>
              <span className="text-[15px] font-bold text-white/[0.45]">$0.00</span>
            </div>
          ) : null}

          {summary.fees.count > 0 ? (
            <div className={`${glassCard} flex items-center px-4 py-[13px]`}>
              <div className="min-w-0 flex-1 pr-2.5">
                <p className="text-[15px] font-bold text-white">Network fees</p>
                <p className="mt-0.5 text-[12px] font-strong text-white/[0.7]">{summary.fees.count} paid to the blockchain, not to us</p>
              </div>
              <span className="text-[15px] font-bold tabular-nums text-white">−{usd(summary.fees.costUsd)}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void download("csv")}
            disabled={!!busy}
            className="mt-2 flex h-12 items-center justify-center gap-[7px] rounded-[16px] bg-white/[0.06] text-[13px] font-strong text-white/[0.9] transition-colors hover:bg-white/[0.1] disabled:opacity-60"
          >
            <Ion name="grid-outline" size={17} />
            {busy === "csv" ? "Preparing…" : busy === "pdf" ? "Preparing the PDF…" : "Export as a spreadsheet"}
          </button>
          {downloadFailed ? (
            <p role="status" className="px-1 text-center text-[12.5px] leading-[17px] text-white/[0.8]">
              We couldn&apos;t build the {downloadFailed.toUpperCase()} just now. The figures above are the same ones — try again in a moment.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One sale: what left, both prices PER UNIT, and what it made. */
function SaleRow({ sale, first }: { sale: RealizedDisposal; first: boolean }) {
  const u = sale.units && sale.units > 0 ? sale.units : null;
  const soldAt = u && sale.proceedsUsd != null ? sale.proceedsUsd / u : null;
  const costAt = u && sale.costUsd != null ? sale.costUsd / u : null;
  const detail =
    soldAt != null && costAt != null
      ? `sold at ${unitPrice(soldAt)}, cost ${unitPrice(costAt)}`
      : soldAt != null
        ? `sold at ${unitPrice(soldAt)}`
        : sale.proceedsUsd != null
          ? usd(sale.proceedsUsd)
          : "";
  const g = sale.gainUsd;
  return (
    <div className={`flex items-center py-[13px] ${first ? "" : "border-t border-white/[0.08]"}`}>
      <div className="min-w-0 flex-1 pr-2.5">
        <p className="truncate text-[15px] font-bold text-white">
          {tokenUnits(sale.units)} {sale.tokenId}
        </p>
        <p className="mt-0.5 text-[12px] font-strong text-white/[0.7]">
          {shortDate(sale.at)}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
      {g == null ? (
        <span className="text-[15px] font-bold text-white/[0.45]">—</span>
      ) : (
        <span className="text-[15px] font-bold tabular-nums" style={{ color: g > 0 ? UP : "#FFFFFF" }}>
          {g > 0 ? "+" : g < 0 ? "−" : ""}
          {usd(g)}
        </span>
      )}
    </div>
  );
}
