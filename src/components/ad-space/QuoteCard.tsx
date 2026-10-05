"use client";

import { useEffect, useState } from "react";

import { existingCheckoutKey } from "@/lib/ad-space/checkout-client";
import { instantIn, instantUtc, timeLeft } from "@/lib/ad-space/format";
import { quoteStateAt } from "@/lib/ad-space/enquiry-rules";
import { type BuyerDocument, QUOTE_DECLINE_REASON_MAX, getBuyerDocument } from "@/lib/ad-space/quotes";
import type { QuoteState, QuoteView } from "@/lib/ad-space/types";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Spinner } from "./checkout-parts";
import { btnPrimary, btnSecondary, btnSmallSecondary, eyebrow, pill } from "./ui";
import { useServerNow } from "./useServerNow";

/**
 * A seller's quote inside the guest's conversation (seller-quotes-contract.md):
 * the spot, the price, the seller's note, how long it stands, and the one
 * action its state allows. Open: Accept and pay, or Decline with an optional
 * reason for the seller. Accepted: Pay, until the
 * 24 hour hold ends. Paid: what goes on the spot, and the invoice once the
 * seller's document exists.
 *
 * The server decides every state; the clock only turns an open quote or a
 * hold whose time ran out on screen into "ended" before the next read.
 *
 * Filled amber is only the action. No red: a quote that closed is quiet.
 */

const PILL: Record<QuoteState, string> = {
  open: pill.attention,
  accepted: pill.attention,
  paid: pill.done,
  expired: pill.neutral,
  withdrawn: pill.neutral,
  superseded: pill.neutral,
  declined: pill.neutral,
};

export function QuoteCard({
  quote,
  seller,
  busy,
  declining,
  canPay,
  session,
  notice,
  onAccept,
  onDecline,
  onPay,
}: {
  quote: QuoteView;
  seller: string;
  /** Accepting this quote right now. */
  busy: boolean;
  /** Declining this quote right now. */
  declining: boolean;
  /** The checkout can be opened here (the space and its spot were read). */
  canPay: boolean;
  /** A session in person is booked, not sponsored. */
  session: boolean;
  /** A refusal about this quote, in words. */
  notice: string | null;
  onAccept: () => void;
  onDecline: (reason: string) => void;
  onPay: () => void;
}) {
  const t = useT();
  // The server's clock, ticking here only, so the countdown never re-renders the thread.
  const now = useServerNow();
  const state = quoteStateAt(quote, now);
  const spot = quote.position?.label || t("enquiries.quote.thisSpot");
  const feeOnTop = quote.buyerPaysUsdc !== quote.priceUsdc;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const paidHere = usePaidHere(state === "paid" ? (quote.position?.id ?? null) : null);

  return (
    <div
      className={`flex w-full max-w-[min(34rem,100%)] flex-col gap-4 rounded-[18px] border p-4 sm:p-5 ${
        state === "open" || state === "accepted"
          ? "border-amber/40 bg-amber/[0.05]"
          : "border-[color:var(--color-hairline)] bg-sp-ink/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`${eyebrow} text-sp-ink/80`}>{t("enquiries.quote.eyebrow")}</p>
          <p className="mt-1 break-words text-body text-sp-ink [overflow-wrap:anywhere]">{spot}</p>
        </div>
        <span className={PILL[state]}>{t(`enquiries.quote.state.${state}`)}</span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-mono text-h4 font-light text-sp-ink">{quote.priceUsdc} USDC</p>
        {feeOnTop && (
          <p className="text-small text-sp-ink/85">{t("enquiries.quote.youPay", { amount: quote.buyerPaysUsdc })}</p>
        )}
      </div>

      {quote.note && (
        <p className="whitespace-pre-wrap break-words border-l-2 border-[color:var(--color-hairline-strong)] pl-3 text-small text-sp-ink/85 [overflow-wrap:anywhere]">
          {quote.note}
        </p>
      )}

      <Standing quote={quote} state={state} seller={seller} now={now} session={session} />

      {state === "open" && !asking && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy || declining} onClick={onAccept}>
            {busy ? (
              <>
                <Spinner />
                {t("enquiries.quote.accepting")}
              </>
            ) : (
              t("enquiries.quote.accept")
            )}
          </button>
          <button type="button" className={btnSecondary} disabled={busy || declining} onClick={() => setAsking(true)}>
            {t("enquiries.quote.decline")}
          </button>
        </div>
      )}

      {state === "open" && asking && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!declining) onDecline(reason);
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-small text-sp-ink">{t("enquiries.quote.declineReason", { seller })}</span>
              <span className={`text-tiny ${reason.length >= QUOTE_DECLINE_REASON_MAX ? "text-sp-amber" : "text-sp-ink/85"}`}>
                {fmtNumber(reason.length)}/{fmtNumber(QUOTE_DECLINE_REASON_MAX)}
              </span>
            </span>
            <textarea
              className="min-h-[84px] w-full resize-y rounded-[14px] border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 py-2 text-small text-sp-ink outline-none transition-colors duration-180 placeholder:text-sp-ink/50 focus:border-amber/60 disabled:opacity-60"
              value={reason}
              maxLength={QUOTE_DECLINE_REASON_MAX}
              placeholder={t("enquiries.quote.declinePlaceholder")}
              disabled={declining}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnSmallSecondary} disabled={declining}>
              {declining ? (
                <>
                  <Spinner />
                  {t("enquiries.quote.declining")}
                </>
              ) : (
                t("enquiries.quote.declineSend")
              )}
            </button>
            <button type="button" className="px-3 text-small font-medium text-sp-ink/85 hover:text-sp-ink disabled:opacity-40" disabled={declining} onClick={() => setAsking(false)}>
              {t("common.back")}
            </button>
          </div>
        </form>
      )}

      {state === "accepted" &&
        (canPay ? (
          <div>
            <button type="button" className={btnPrimary} onClick={onPay}>
              {t("enquiries.quote.pay", { amount: quote.buyerPaysUsdc })}
            </button>
          </div>
        ) : (
          <p className="text-small text-sp-amber">{t("enquiries.quote.refreshToPay")}</p>
        ))}

      {state === "paid" && paidHere && canPay && (
        <div>
          <button type="button" className={btnSmallSecondary} onClick={onPay}>
            {session ? t("enquiries.quote.seeBooking") : t("enquiries.quote.addContent")}
          </button>
        </div>
      )}

      {state === "paid" && quote.orderId && paidHere && <Invoice orderId={quote.orderId} positionId={quote.position?.id ?? null} />}

      {notice && (
        <p className="rounded-[14px] bg-amber/[0.09] px-3 py-2 text-small text-sp-amber" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

/** Where the quote stands, in one or two sentences. */
function Standing({
  quote,
  state,
  seller,
  now,
  session,
}: {
  quote: QuoteView;
  state: QuoteState;
  seller: string;
  now: number | null;
  session: boolean;
}) {
  const t = useT();
  const subject = session ? "session" : "spot";
  const line = (text: string) => <p className="text-small text-sp-ink/85">{text}</p>;
  switch (state) {
    case "open":
      return (
        <div className="flex flex-col gap-1">
          {quote.expiresAt && <Ends label={t("enquiries.quote.endsAt")} iso={quote.expiresAt} now={now} />}
          {line(t("enquiries.quote.openBody", { subject }))}
        </div>
      );
    case "accepted":
      return (
        <div className="flex flex-col gap-1">
          {quote.expiresAt && <Ends label={t("enquiries.quote.payBy")} iso={quote.expiresAt} now={now} />}
          {line(t("enquiries.quote.acceptedBody", { subject }))}
        </div>
      );
    case "paid":
      return line(t("enquiries.quote.paidBody", { subject }));
    case "expired":
      return line(t("enquiries.quote.expiredBody", { seller }));
    case "withdrawn":
      return line(t("enquiries.quote.withdrawnBody", { seller }));
    case "superseded":
      return line(t("enquiries.quote.supersededBody", { subject }));
    case "declined":
      return line(t("enquiries.quote.declinedBody", { seller }));
    default:
      return null;
  }
}

/** "Ends Wed 7 Oct, 10:00 (2d 4h left)", the reader's own clock once in the browser. */
function Ends({ label, iso, now }: { label: string; iso: string; now: number | null }) {
  const t = useT();
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(instantIn(iso)), [iso]);
  const left = now === null ? null : Date.parse(iso) - now;
  return (
    <p className="text-small text-sp-ink">
      {label}{" "}
      <time dateTime={iso} suppressHydrationWarning>
        {local ?? instantUtc(iso)}
      </time>
      {left !== null && left > 0 && (
        <span className="text-sp-ink/80">
          {" "}
          ({t("enquiries.quote.left", { time: timeLeft(left) })})
        </span>
      )}
    </p>
  );
}

/** Whether this browser holds the checkout key for the spot: only the browser that paid can add content or fetch the invoice. */
function usePaidHere(positionId: string | null): boolean {
  const [here, setHere] = useState(false);
  useEffect(() => {
    if (!positionId) return setHere(false);
    try {
      setHere(existingCheckoutKey(positionId) !== null);
    } catch {
      setHere(false);
    }
  }, [positionId]);
  return here;
}

/**
 * The seller's invoice or receipt for this sale (sale-invoices-contract.md),
 * read with the checkout key that paid. Says nothing when the API has no
 * document route or nothing to show.
 */
function Invoice({ orderId, positionId }: { orderId: string; positionId: string | null }) {
  const t = useT();
  const [doc, setDoc] = useState<BuyerDocument | null>(null);
  useEffect(() => {
    let live = true;
    let key: string | null = null;
    try {
      key = positionId ? existingCheckoutKey(positionId) : null;
    } catch {
      key = null;
    }
    if (!key) return;
    void getBuyerDocument(orderId, key).then((d) => {
      if (live) setDoc(d);
    });
    return () => {
      live = false;
    };
  }, [orderId, positionId]);

  if (!doc || doc.status === "not_available") return null;
  if (doc.status === "pending") {
    return <PendingInvoice iso={doc.issuesAt} />;
  }
  if (!doc.pdfUrl) {
    return (
      <p className="text-small text-sp-ink/85">
        {t(doc.kind === "invoice" ? "enquiries.quote.invoiceIssued" : "enquiries.quote.receiptIssued", { number: doc.number })}
      </p>
    );
  }
  return (
    <div>
      <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={btnSmallSecondary}>
        {t(doc.kind === "invoice" ? "enquiries.quote.downloadInvoice" : "enquiries.quote.downloadReceipt", { number: doc.number })}
      </a>
    </div>
  );
}

function PendingInvoice({ iso }: { iso: string }) {
  const t = useT();
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(instantIn(iso)), [iso]);
  return <p className="text-small text-sp-ink/85">{t("enquiries.quote.invoicePending", { time: local ?? instantUtc(iso) })}</p>;
}
