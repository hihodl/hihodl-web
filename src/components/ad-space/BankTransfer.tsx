"use client";

import { useEffect, useState } from "react";

import { BANK_MIN_USD_CENTS, bankStage, canCancel, usdExact } from "@/lib/ad-space/bank-rules";
import { instantIn, instantUtc } from "@/lib/ad-space/format";
import { getBuyerDocument, type BuyerDocument } from "@/lib/ad-space/quotes";
import type { BankInstructions, BankOption, BankRail, Order } from "@/lib/ad-space/types";
import { useT } from "@/lib/app/i18n/react";

import { CopyButton, StatusLine, ctaGlass, fieldLabel, sheetCard } from "./pay-sheet";

/**
 * Paying by bank transfer (a-brand-pays-by-bank-or-card-contract.md).
 *
 * `BankChoice` is the way in, next to the wallets: what a bank transfer is
 * here and which rail. `BankDetails` is the proforma the brand's finance team
 * pays: the exact amount, the reference that routes the money to this order,
 * Bridge's bank details, how long the spot is held and where the transfer is.
 * The server decides when the order is paid; this only reads it again.
 */

type Subject = "spot" | "session";

const NOT_FROM = ["NY", "TX"];

/** A date the reader's own clock shows, rendered after mount so server and browser agree. */
function useLocalInstant(iso: string | null | undefined): string | null {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(iso ? instantIn(iso) : null), [iso]);
  if (!iso) return null;
  return local ?? instantUtc(iso);
}

/* ── The way in ───────────────────────────────────────────────────── */

export function BankChoice({
  option,
  rail,
  onRail,
  seller,
  disabled,
}: {
  option: BankOption | null;
  rail: BankRail;
  onRail: (r: BankRail) => void;
  seller: string;
  disabled: boolean;
}) {
  const t = useT();
  const days = option?.bank?.holdDays ?? 7;
  const rails: BankRail[] = option?.bank?.rails?.length ? option.bank.rails : ["wire", "ach_push"];
  const states = (option?.bank?.notFromStates ?? NOT_FROM).join(", ");
  return (
    <div className={`${sheetCard} flex flex-col gap-4 p-5`}>
      <div className="flex flex-col gap-1.5">
        <p className="text-body font-medium text-sp-ink">{t("sponsor.checkout.bank.title")}</p>
        <p className="text-small text-[#CFE3EC]">{t("sponsor.checkout.bank.lead", { days })}</p>
      </div>
      {rails.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className={fieldLabel}>{t("sponsor.checkout.bank.railLabel")}</p>
          <div role="radiogroup" aria-label={t("sponsor.checkout.bank.railLabel")} className="grid grid-cols-2 gap-1 rounded-[16px] bg-black/25 p-1">
            {rails.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={r === rail}
                disabled={disabled}
                onClick={() => onRail(r)}
                className={`h-10 rounded-[12px] text-small font-medium transition-colors duration-180 disabled:opacity-50 ${
                  r === rail ? "bg-[#1C3D4B] text-sp-ink" : "text-white/85 hover:text-sp-ink"
                }`}
              >
                {r === "wire" ? t("sponsor.checkout.bank.rail.wire") : t("sponsor.checkout.bank.rail.ach")}
              </button>
            ))}
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-1.5 text-tiny text-white/85">
        <li>{t("sponsor.checkout.bank.business", { states })}</li>
        <li>{t("sponsor.checkout.bank.through", { seller })}</li>
      </ul>
    </div>
  );
}

/** The minimum, said in dollars, for the below-minimum line. */
export function bankMinimum(option: BankOption | null): string {
  return usdExact(String((option?.bank?.minUsdCents ?? BANK_MIN_USD_CENTS) / 100)) ?? "$250.00";
}

/* ── The instructions ─────────────────────────────────────────────── */

export function BankDetails({
  order,
  bank,
  subject,
  seller,
  cancelling,
  onCancel,
  onStartAgain,
}: {
  order: Order;
  bank: BankInstructions | null;
  subject: Subject;
  seller: string;
  cancelling: boolean;
  onCancel: () => void;
  onStartAgain: () => void;
}) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const heldUntil = useLocalInstant(order.reservedUntil);
  const expires = useLocalInstant(bank?.expiresAt ?? null);
  const over = order.status === "expired" || order.status === "cancelled";
  const stage = over ? "gone" : bankStage(bank?.status);

  if (stage === "gone") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="max-w-sm text-body text-sp-ink">{t("sponsor.checkout.bank.status.gone", { subject })}</p>
        <button type="button" className={ctaGlass} onClick={onStartAgain}>
          {t("sponsor.checkout.startAgain")}
        </button>
      </div>
    );
  }

  if (!bank) {
    return <StatusLine>{t("sponsor.checkout.bank.noDetails")}</StatusLine>;
  }

  const amount = usdExact(bank.amount) ?? `${bank.amount} USD`;
  const rows: { label: string; value: string | null }[] = [
    { label: t("sponsor.checkout.bank.beneficiary"), value: bank.beneficiaryName },
    { label: t("sponsor.checkout.bank.beneficiaryAddress"), value: bank.beneficiaryAddress },
    { label: t("sponsor.checkout.bank.bankName"), value: bank.bankName },
    { label: t("sponsor.checkout.bank.bankAddress"), value: bank.bankAddress },
    { label: t("sponsor.checkout.bank.accountNumber"), value: bank.accountNumber },
    { label: t("sponsor.checkout.bank.routingNumber"), value: bank.routingNumber },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Where the transfer is, first: the reason to come back to this page. */}
      {stage === "waiting" ? (
        <StatusLine>{t("sponsor.checkout.bank.status.waiting")}</StatusLine>
      ) : stage === "received" ? (
        <StatusLine>{t("sponsor.checkout.bank.status.received", { seller })}</StatusLine>
      ) : stage === "paid" ? (
        <StatusLine tone="done">{t("sponsor.checkout.bank.status.paid")}</StatusLine>
      ) : (
        <StatusLine tone="attention">
          {t("sponsor.checkout.bank.status.stuck", { email: "support@hihodl.xyz", reference: bank.reference })}
        </StatusLine>
      )}

      <div className={`${sheetCard} flex flex-col gap-1 p-5 text-center`}>
        <p className={fieldLabel}>{t("sponsor.checkout.bank.sendExactly")}</p>
        <p className="text-[34px] font-medium leading-tight tracking-[-0.02em] text-sp-ink tabular-nums">{amount}</p>
        <p className="text-tiny text-white/85">{t("sponsor.checkout.bank.exactNote")}</p>
      </div>

      {/* The reference routes the money to this order: it must travel with it. */}
      <div className="flex flex-col gap-3 rounded-[16px] bg-amber/[0.09] p-5">
        <p className={fieldLabel}>{t("sponsor.checkout.bank.reference")}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="break-all font-mono text-[22px] font-medium text-sp-ink">{bank.reference}</p>
          <CopyButton value={bank.reference} />
        </div>
        <p className="text-small text-[#FFE3A3]">{t("sponsor.checkout.bank.referenceNote")}</p>
      </div>

      <div className={`${sheetCard} flex flex-col divide-y divide-sp-ink/[0.08] px-5`}>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-tiny text-white/85">{t("sponsor.checkout.bank.railLabel")}</span>
          <span className="text-small text-sp-ink">
            {bank.rail === "wire" ? t("sponsor.checkout.bank.rail.wire") : t("sponsor.checkout.bank.rail.ach")}
          </span>
        </div>
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-tiny text-white/85">{r.label}</p>
                <p className="text-small text-sp-ink [overflow-wrap:anywhere]">{r.value}</p>
              </div>
              <CopyButton
                value={r.value as string}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-[18px] bg-sp-ink/[0.10] px-4 text-tiny font-medium text-sp-ink transition-colors duration-180 hover:bg-sp-ink/[0.16]"
              />
            </div>
          ))}
      </div>

      <ul className="flex flex-col gap-1.5 px-1 text-small text-[#CFE3EC]">
        {heldUntil && <li>{t("sponsor.checkout.bank.heldUntil", { subject, date: heldUntil })}</li>}
        {expires && <li>{t("sponsor.checkout.bank.expires", { date: expires })}</li>}
        <li>{t("sponsor.checkout.bank.through", { seller: bank.receivesFor || seller })}</li>
        <li>{t("sponsor.checkout.bank.business", { states: (bank.notFromStates?.length ? bank.notFromStates : NOT_FROM).join(", ") })}</li>
      </ul>

      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <button type="button" className={ctaGlass} onClick={() => window.print()}>
          {t("sponsor.checkout.bank.print")}
        </button>
        {canCancel(bank.status) && !asking && (
          <button type="button" className={ctaGlass} disabled={cancelling} onClick={() => setAsking(true)}>
            {t("sponsor.checkout.bank.cancel")}
          </button>
        )}
      </div>

      {asking && canCancel(bank.status) && (
        <div className={`${sheetCard} flex flex-col items-center gap-3 p-4 text-center print:hidden`}>
          <p className="text-small text-sp-ink">{t("sponsor.checkout.bank.cancelConfirm", { subject })}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={ctaGlass} disabled={cancelling} onClick={() => setAsking(false)}>
              {t("sponsor.checkout.bank.cancelKeep")}
            </button>
            <button
              type="button"
              className={ctaGlass}
              disabled={cancelling}
              onClick={() => {
                setAsking(false);
                onCancel();
              }}
            >
              {cancelling ? t("sponsor.checkout.bank.cancelling") : t("sponsor.checkout.bank.cancelYes")}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-tiny text-white/85 print:hidden">{t("sponsor.checkout.bank.checking")}</p>
    </div>
  );
}

/* ── After paying: the seller's invoice ───────────────────────────── */

/**
 * The seller's invoice or receipt for an order this browser paid
 * (sale-invoices-contract.md), read with the checkout key that paid it. Says
 * nothing when the API has no document or nothing to show yet.
 */
export function OrderInvoice({ orderId, checkoutKey }: { orderId: string; checkoutKey: string }) {
  const t = useT();
  const [doc, setDoc] = useState<BuyerDocument | null>(null);
  useEffect(() => {
    if (!checkoutKey) return;
    let live = true;
    void getBuyerDocument(orderId, checkoutKey).then((d) => {
      if (live) setDoc(d);
    });
    return () => {
      live = false;
    };
  }, [orderId, checkoutKey]);
  const pendingAt = useLocalInstant(doc?.status === "pending" ? doc.issuesAt : null);

  if (!doc || doc.status === "not_available") return null;
  if (doc.status === "pending") {
    return pendingAt ? <p className="text-center text-small text-white/85">{t("enquiries.quote.invoicePending", { time: pendingAt })}</p> : null;
  }
  if (!doc.pdfUrl) {
    return (
      <p className="text-center text-small text-white/85">
        {t(doc.kind === "invoice" ? "enquiries.quote.invoiceIssued" : "enquiries.quote.receiptIssued", { number: doc.number })}
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={ctaGlass}>
        {t(doc.kind === "invoice" ? "enquiries.quote.downloadInvoice" : "enquiries.quote.downloadReceipt", { number: doc.number })}
      </a>
    </div>
  );
}
