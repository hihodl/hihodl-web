"use client";

/**
 * Business › Sales and invoices: the document every paid sale issued (an
 * invoice with a complete business profile, a payment receipt otherwise),
 * its PDF, and the CSV an accountant asks for.
 *
 * The owner's only: the invoice routes act on the signed-in account and the
 * contract keeps team members out of the seller's documents. PDF links are
 * signed for an hour, so each click asks for a fresh one.
 */

import { useState } from "react";

import { downloadSalesCsv, invoicePdf, listInvoices, useInvoices, type InvoiceRow } from "@/lib/app/business";
import { csvRangeProblem, lastMonth } from "@/lib/app/business-rules";
import { t as tt } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Notice } from "../hold";
import { Ion } from "../ion";
import { btnGlassPill, btnWhite, Card, Empty, Field, inputCls, SectionLabel, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { businessErrorText, ErrorNote } from "./parts";

export function SalesTab() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      <CsvExport />
      <SectionLabel>{t("business.sales.documents")}</SectionLabel>
      <Documents />
    </div>
  );
}

function CsvExport() {
  const t = useT();
  const [range, setRange] = useState(lastMonth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = csvRangeProblem(range.from, range.to);

  async function download() {
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await downloadSalesCsv(range.from, range.to);
    } catch (e) {
      setError(businessErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-bold text-white">{t("business.sales.csvTitle")}</p>
        <p className="text-[13px] leading-5 text-white/[0.82]">{t("business.sales.csvBody")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("business.sales.from")} htmlFor="b-csv-from">
          <input id="b-csv-from" type="date" className={inputCls} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </Field>
        <Field label={t("business.sales.to")} htmlFor="b-csv-to">
          <input id="b-csv-to" type="date" className={inputCls} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </Field>
      </div>
      {problem ? <Notice>{tt(problem === "range_too_long" ? "business.error.rangeTooLong" : "business.error.rangeInvalid")}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <button type="button" className={`${btnWhite} self-start`} disabled={busy || !!problem} onClick={() => void download()}>
        <Ion name="download-outline" size={16} />
        {busy ? t("business.sales.preparing") : t("business.sales.download")}
      </button>
    </Card>
  );
}

function Documents() {
  const t = useT();
  const first = useInvoices();
  const [more, setMore] = useState<InvoiceRow[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (first.error) return <ErrorNote error={first.error} />;
  if (!first.data) return <Skeleton className="h-40" />;
  const rows = [...first.data.documents, ...more];
  if (rows.length === 0) {
    return (
      <Card>
        <Empty icon="receipt-outline" title={t("business.sales.emptyTitle")} body={t("business.sales.emptyBody")} />
      </Card>
    );
  }
  const canMore = !done && first.data.documents.length >= 50;

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setBusy(true);
    setError(null);
    try {
      const next = await listInvoices(last.issuedAt);
      setMore((m) => [...m, ...next.documents]);
      if (next.documents.length < 50) setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="gap-0 py-1.5">
        {rows.map((r) => (
          <DocumentRow key={r.orderId} row={r} />
        ))}
      </Card>
      <ErrorNote error={error} />
      {canMore ? (
        <button type="button" className={`${btnGlassPill} self-center`} disabled={busy} onClick={() => void loadMore()}>
          {busy ? t("business.loading") : t("business.loadMore")}
        </button>
      ) : null}
    </>
  );
}

function DocumentRow({ row: r }: { row: InvoiceRow }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function open() {
    // Opened before the await, so a popup blocker sees the click.
    const win = window.open("", "_blank");
    setBusy(true);
    setError(null);
    try {
      const { url } = await invoicePdf(r.orderId);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const buyer = r.buyer?.name || t("business.sales.noBuyer");
  return (
    <div className="flex flex-col gap-1 px-1 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14.5px] font-bold text-white">{r.number}</span>
            <Tag label={r.kind === "invoice" ? t("business.sales.invoice") : t("business.sales.receipt")} tone="dim" />
          </span>
          <span className="truncate text-[12.5px] text-white/55">
            {[buyer, r.description, fmtDate(r.issuedAt)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[14.5px] font-extrabold tabular-nums text-white">{r.totalUsdc} USDC</span>
          <span className="block text-[11.5px] text-white/55">
            {r.feePaidBy === "buyer" ? t("business.sales.feeBuyer", { fee: r.feeUsdc }) : t("business.sales.feeSeller", { fee: r.feeUsdc })}
          </span>
        </span>
        <button type="button" className={btnGlassPill} disabled={busy} onClick={() => void open()} aria-label={t("business.sales.pdfFor", { number: r.number })}>
          <Ion name="document-text-outline" size={15} />
          {t("business.sales.pdf")}
        </button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}
