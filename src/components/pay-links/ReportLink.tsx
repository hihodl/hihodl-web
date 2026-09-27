"use client";

import { useState, type FormEvent } from "react";

import { btnSmallSecondary, input } from "@/components/ad-space/ui";
import { describePayError, reportPayLink } from "@/lib/pay-links/client";
import { useT } from "@/lib/app/i18n/react";

const NOTE_MAX = 280;

/**
 * "Report this link". A pay link on our domain is the obvious phishing tool,
 * so the way to flag one sits on every page, and it asks for nothing but an
 * optional line.
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

  if (done) {
    return <p className="text-small text-text-muted">{t("payPage.report.thanks")}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-small text-text-muted underline-offset-4 transition-colors duration-180 hover:text-text hover:underline"
      >
        {t("payPage.report.open")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-2">
        <span className="text-small text-text-muted">{t("payPage.report.label")}</span>
        <textarea
          className={`${input} min-h-[88px] resize-y`}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("payPage.report.placeholder")}
        />
      </label>
      {notice && <p className="text-small text-text-muted">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnSmallSecondary} disabled={busy}>
          {busy ? t("payPage.report.sending") : t("payPage.report.send")}
        </button>
        <button type="button" className={btnSmallSecondary} onClick={() => setOpen(false)}>
          {t("payPage.report.cancel")}
        </button>
      </div>
    </form>
  );
}
