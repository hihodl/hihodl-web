"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { CheckoutError } from "@/lib/ad-space/checkout-client";
import {
  ENQUIRY_WEB_MESSAGE_MAX,
  describeEnquiryError,
  getGuestEnquiry,
  messageProblem,
  replyToGuestEnquiry,
} from "@/lib/ad-space/enquiries";
import { isExpiredLink, isNewerThread, nextPollDelay, quoteOfMessage } from "@/lib/ad-space/enquiry-rules";
import { isSessionSpace } from "@/lib/ad-space/format";
import { QUOTE_STALE_CODES, acceptGuestQuote, declineGuestQuote, describeQuoteError } from "@/lib/ad-space/quotes";
import type { GuestEnquiry, GuestEnquiryMessage, Position, QuoteView, Space } from "@/lib/ad-space/types";
import { fmtDateTime, fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Checkout } from "./Checkout";
import { Spinner } from "./checkout-parts";
import { QuoteCard } from "./QuoteCard";
import { btnPrimary } from "./ui";

/**
 * A guest's conversation with a seller, at /e/<token> (spot-enquiries-contract.md).
 *
 * The page arrives with the thread read on the server; replying posts from the
 * browser and the answer IS the thread again, so it simply replaces what is
 * on screen. While the tab is on screen the thread is read again every 20 s
 * (doubling after failures, up to 5 min), and once more the moment the tab
 * comes back, so a seller's reply lands without a reload and without
 * touching the reply being typed. A hidden tab reads nothing.
 *
 * A link left unused for 90 days expires (410): the page then says so, and
 * that the seller's next reply brings a fresh link by email.
 *
 * A message carrying a seller's quote draws the quote card instead of its
 * fallback line (seller-quotes-contract.md): Accept and pay holds the spot
 * 24 hours and opens the same checkout an accepted offer uses, bound to this
 * thread's token and the quote. Every read brings the quotes' current state,
 * so a quote accepted in the app, paid, withdrawn or ended shows here too.
 *
 * Bubbles: the guest's on the right in the light glass, the seller's on the
 * left on the page's own ink. Filled amber is only the action.
 */
export function EnquiryThread({
  token,
  initial,
  seller,
  space,
}: {
  token: string;
  initial: GuestEnquiry;
  seller: string;
  /** The full public space, for paying a quote through its checkout. Null when it couldn't be read. */
  space: Space | null;
}) {
  const t = useT();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [quoteNotice, setQuoteNotice] = useState<{ quoteId: string; text: string } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [enquiry, setEnquiry] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [expired, setExpired] = useState(false);
  const sending = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const max = ENQUIRY_WEB_MESSAGE_MAX;

  /* Reading the thread again while the tab is on screen. */
  const stopped = gone || expired;
  useEffect(() => {
    if (stopped) return;
    let timer: number | null = null;
    let failures = 0;
    let inFlight = false;
    let live = true;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      clear();
      if (live && document.visibilityState === "visible") timer = window.setTimeout(() => void poll(), nextPollDelay(failures));
    };
    const poll = async () => {
      // A reply going out answers with the thread itself; this read waits for the next turn.
      if (inFlight || sending.current || document.visibilityState !== "visible") return schedule();
      inFlight = true;
      try {
        const next = await getGuestEnquiry(token);
        if (!live) return;
        failures = 0;
        setEnquiry((cur) => (isNewerThread(cur, next) ? next : cur));
      } catch (err) {
        if (!live) return;
        if (err instanceof CheckoutError && isExpiredLink(err.status, err.code)) {
          setExpired(true);
          return;
        }
        // A link the API stopped knowing is said when the guest replies; reading just stops.
        if (err instanceof CheckoutError && err.code === "not_found") return;
        failures++;
      } finally {
        inFlight = false;
      }
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
      else clear();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, stopped]);

  const count = enquiry.messages.length;
  useEffect(() => {
    if (count > 1) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  const waiting = !enquiry.messages.some((m) => m.author === "business");
  const session = space ? isSessionSpace(space) : false;
  const positionOf = (q: QuoteView | null | undefined): Position | null =>
    (q?.position && space?.positions.find((p) => p.id === q.position?.id)) || null;

  /** Read the thread now, after a refusal or a payment; only a newer thread replaces the one on screen. */
  const reload = useCallback(async () => {
    try {
      const next = await getGuestEnquiry(token);
      setEnquiry((cur) => (isNewerThread(cur, next) ? next : cur));
    } catch (err) {
      if (err instanceof CheckoutError && isExpiredLink(err.status, err.code)) setExpired(true);
      // Anything else: the next poll reads it again.
    }
  }, [token]);

  async function accept(q: QuoteView) {
    if (sending.current || stopped) return;
    // The reply box and the polls wait while the acceptance goes out.
    sending.current = true;
    setAccepting(q.quoteId);
    setQuoteNotice(null);
    try {
      const next = await acceptGuestQuote(token, q.quoteId, q.updatedAt);
      setEnquiry(next);
      const fresh = next.quotes?.find((x) => x.quoteId === q.quoteId) ?? next.messages.find((m) => m.quote?.quoteId === q.quoteId)?.quote;
      // Accepted: straight on to paying, the second half of the one tap.
      if (fresh?.state === "accepted" && positionOf(fresh)) setPaying(fresh.quoteId);
    } catch (err) {
      if (err instanceof CheckoutError && isExpiredLink(err.status, err.code)) {
        setExpired(true);
      } else {
        setQuoteNotice({ quoteId: q.quoteId, text: describeQuoteError(err, session ? "session" : "spot") ?? describeEnquiryError(err, max) });
        if (err instanceof CheckoutError && QUOTE_STALE_CODES.has(err.code)) {
          sending.current = false;
          await reload();
        }
      }
    } finally {
      sending.current = false;
      setAccepting(null);
    }
  }

  /** Decline an open quote; the seller reads the reason in the thread. */
  async function decline(q: QuoteView, reason: string) {
    if (sending.current || stopped) return;
    sending.current = true;
    setDeclining(q.quoteId);
    setQuoteNotice(null);
    try {
      const next = await declineGuestQuote(token, q.quoteId, reason);
      sending.current = false;
      if (next) setEnquiry(next);
      else await reload();
    } catch (err) {
      if (err instanceof CheckoutError && isExpiredLink(err.status, err.code)) {
        setExpired(true);
      } else {
        setQuoteNotice({ quoteId: q.quoteId, text: describeQuoteError(err, session ? "session" : "spot") ?? describeEnquiryError(err, max) });
        if (err instanceof CheckoutError && QUOTE_STALE_CODES.has(err.code)) {
          sending.current = false;
          await reload();
        }
      }
    } finally {
      sending.current = false;
      setDeclining(null);
    }
  }

  const payingQuote = paying
    ? (enquiry.quotes?.find((q) => q.quoteId === paying) ?? enquiry.messages.find((m) => m.quote?.quoteId === paying)?.quote ?? null)
    : null;
  const payingPosition = positionOf(payingQuote);
  const closeCheckout = useCallback(() => setPaying(null), []);
  const onPaid = useCallback(() => {
    void reload();
  }, [reload]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending.current || stopped) return;
    setNotice(null);
    const problem = messageProblem(message, max);
    if (problem) return setNotice(problem);
    sending.current = true;
    setBusy(true);
    try {
      setEnquiry(await replyToGuestEnquiry(token, message.trim()));
      setMessage("");
    } catch (err) {
      if (err instanceof CheckoutError && isExpiredLink(err.status, err.code)) {
        setExpired(true);
      } else if (err instanceof CheckoutError && err.code === "not_found") {
        setGone(true);
        setNotice(t("enquiries.thread.gone"));
      } else {
        setNotice(describeEnquiryError(err, max));
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-3" aria-label={t("enquiries.thread.eyebrow")} aria-live="polite" aria-relevant="additions">
        {enquiry.messages.map((m) => {
          const quote = quoteOfMessage(m, enquiry.quotes);
          return (
            <Bubble key={m.id} message={m} seller={seller}>
              {quote && (
                <QuoteCard
                  quote={quote}
                  seller={seller}
                  busy={accepting === quote.quoteId}
                  declining={declining === quote.quoteId}
                  canPay={!!space && !!positionOf(quote)}
                  session={session}
                  notice={quoteNotice?.quoteId === quote.quoteId ? quoteNotice.text : null}
                  onAccept={() => void accept(quote)}
                  onDecline={(reason) => void decline(quote, reason)}
                  onPay={() => {
                    setQuoteNotice(null);
                    setPaying(quote.quoteId);
                  }}
                />
              )}
            </Bubble>
          );
        })}
      </ol>
      <div ref={endRef} />

      {waiting && !stopped && <p className="text-small text-sp-ink/85">{t("enquiries.thread.waiting", { seller })}</p>}

      {expired && <ExpiredNotice seller={seller} />}

      {!stopped && (
        <form onSubmit={send} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-tiny uppercase tracking-wider text-sp-ink/85">{t("enquiries.thread.reply")}</span>
              <span className={`text-tiny ${message.length > max ? "text-sp-amber" : "text-sp-ink/85"}`}>
                {fmtNumber(message.length)}/{fmtNumber(max)}
              </span>
            </span>
            <textarea
              className="min-h-[112px] w-full resize-y rounded-[16px] border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-4 py-3 text-body text-sp-ink outline-none transition-colors duration-180 placeholder:text-sp-ink/50 focus:border-amber/60 disabled:opacity-60"
              value={message}
              maxLength={max}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("enquiries.thread.replyPlaceholder", { seller })}
              disabled={busy}
            />
          </label>
          <div>
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy ? (
                <>
                  <Spinner />
                  {t("enquiries.sheet.sending")}
                </>
              ) : (
                t("enquiries.thread.send")
              )}
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p className="rounded-[16px] bg-amber/[0.09] px-4 py-3 text-small text-sp-amber" role="status">
          {notice}
        </p>
      )}

      {payingQuote && space && payingPosition && (
        <Checkout
          space={space}
          position={payingPosition}
          onClose={closeCheckout}
          onPaid={onPaid}
          quote={{ token, view: payingQuote }}
        />
      )}
    </div>
  );
}

/** The link stopped working after 90 quiet days. The thread on screen stays readable. */
export function ExpiredNotice({ seller }: { seller: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-[color:var(--color-hairline)] bg-sp-ink/[0.04] px-4 py-4" role="status">
      <p className="text-body text-sp-ink">{t("enquiries.thread.expiredTitle")}</p>
      <p className="text-small text-sp-ink/85">{t("enquiries.thread.expiredBody", { seller })}</p>
    </div>
  );
}

function Bubble({ message: m, seller, children }: { message: GuestEnquiryMessage; seller: string; children?: ReactNode }) {
  const t = useT();
  const mine = m.author === "you";
  return (
    <li className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      <span className="px-1 text-tiny text-sp-ink/80">
        {mine ? t("enquiries.thread.you") : seller}
        {!mine && m.sentBy ? ` · ${t("enquiries.thread.sentBy", { name: m.sentBy })}` : ""}
        {" · "}
        <time dateTime={m.createdAt} suppressHydrationWarning>
          {fmtDateTime(m.createdAt)}
        </time>
      </span>
      {/* A quote draws its card; its body is only the fallback line for readers without one. */}
      {children ?? (
        <p
          className={`max-w-[min(34rem,88%)] whitespace-pre-wrap break-words rounded-[18px] px-4 py-3 text-body [overflow-wrap:anywhere] ${
            mine ? "bg-sp-ink/[0.12] text-sp-ink" : "border border-[color:var(--color-hairline)] bg-sp-ink/[0.03] text-sp-ink"
          }`}
        >
          {m.body}
        </p>
      )}
    </li>
  );
}
