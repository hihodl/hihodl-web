"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { CheckoutError } from "@/lib/ad-space/checkout-client";
import { ENQUIRY_WEB_MESSAGE_MAX, describeEnquiryError, messageProblem, replyToGuestEnquiry } from "@/lib/ad-space/enquiries";
import type { GuestEnquiry, GuestEnquiryMessage } from "@/lib/ad-space/types";
import { fmtDateTime, fmtNumber } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Spinner } from "./checkout-parts";
import { btnPrimary } from "./ui";

/**
 * A guest's conversation with a seller, at /e/<token> (spot-enquiries-contract.md).
 *
 * The page arrives with the thread read on the server; replying posts from the
 * browser and the answer IS the thread again, so it simply replaces what is
 * on screen. No polling: a reply from the seller is announced by email, with
 * a fresh link back here.
 *
 * Bubbles: the guest's on the right in the light glass, the seller's on the
 * left on the page's own ink. Filled amber is only the Send button.
 */
export function EnquiryThread({ token, initial, seller }: { token: string; initial: GuestEnquiry; seller: string }) {
  const t = useT();
  const [enquiry, setEnquiry] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const sending = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const max = ENQUIRY_WEB_MESSAGE_MAX;

  const count = enquiry.messages.length;
  useEffect(() => {
    if (count > 1) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  const waiting = !enquiry.messages.some((m) => m.author === "business");

  async function send(e: FormEvent) {
    e.preventDefault();
    if (sending.current || gone) return;
    setNotice(null);
    const problem = messageProblem(message, max);
    if (problem) return setNotice(problem);
    sending.current = true;
    setBusy(true);
    try {
      setEnquiry(await replyToGuestEnquiry(token, message.trim()));
      setMessage("");
    } catch (err) {
      if (err instanceof CheckoutError && err.code === "not_found") {
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
      <ol className="flex flex-col gap-3" aria-label={t("enquiries.thread.eyebrow")}>
        {enquiry.messages.map((m) => (
          <Bubble key={m.id} message={m} seller={seller} />
        ))}
      </ol>
      <div ref={endRef} />

      {waiting && <p className="text-small text-sp-ink/85">{t("enquiries.thread.waiting", { seller })}</p>}

      {!gone && (
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
    </div>
  );
}

function Bubble({ message: m, seller }: { message: GuestEnquiryMessage; seller: string }) {
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
      <p
        className={`max-w-[min(34rem,88%)] whitespace-pre-wrap break-words rounded-[18px] px-4 py-3 text-body [overflow-wrap:anywhere] ${
          mine ? "bg-sp-ink/[0.12] text-sp-ink" : "border border-[color:var(--color-hairline)] bg-sp-ink/[0.03] text-sp-ink"
        }`}
      >
        {m.body}
      </p>
    </li>
  );
}
