"use client";

import { useState, type FormEvent } from "react";

import { Modal } from "@/components/app/Modal";
import { useT } from "@/lib/app/i18n/react";
import { describePayError, reportPayLink } from "@/lib/pay-links/client";

const NOTE_MAX = 280;

/**
 * "Report this link". A pay link on our domain is the obvious phishing tool,
 * so the way to flag one sits on every page, and it asks for nothing but an
 * optional line, in a sheet.
 */
export function ReportLink({ code }: { code: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await reportPayLink(code, note.trim().slice(0, NOTE_MAX));
      setDone(true);
    } catch (err) {
      setNotice(describePayError(err, null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-inherit underline-offset-4 transition-colors hover:text-white hover:underline">
        {t("payPage.report.open")}
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title={t("payPage.report.open")} size="sm" busy={busy}>
          {done ? (
            <p className="py-2 text-center text-[14px] leading-[20px] text-[#CFE3EC]">{t("payPage.report.thanks")}</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 pb-1" noValidate>
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-strong text-[#9FB7C2]">{t("payPage.report.label")}</span>
                <textarea
                  className="min-h-[96px] resize-y rounded-[16px] border border-white/10 bg-white/[0.06] px-3.5 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
                  value={note}
                  maxLength={NOTE_MAX}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("payPage.report.placeholder")}
                  dir="auto"
                />
              </label>
              {notice ? <p className="text-[13px] text-amber">{notice}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center rounded-[24px] border border-white/[0.22] bg-white/10 text-[15px] font-bold text-white disabled:opacity-50"
              >
                {busy ? t("payPage.report.sending") : t("payPage.report.send")}
              </button>
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
