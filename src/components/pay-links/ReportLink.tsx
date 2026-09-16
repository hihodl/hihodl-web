"use client";

import { useState, type FormEvent } from "react";

import { btnSmallSecondary, input } from "@/components/ad-space/ui";
import { describePayError, reportPayLink } from "@/lib/pay-links/client";

const NOTE_MAX = 280;

/**
 * "Report this link". A pay link on our domain is the obvious phishing tool,
 * so the way to flag one sits on every page, and it asks for nothing but an
 * optional line.
 */
export function ReportLink({ code }: { code: string }) {
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
    return <p className="text-small text-text-muted">Thanks. We look at every report, and we take down links that are used to deceive people.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-small text-text-muted underline-offset-4 transition-colors duration-180 hover:text-text hover:underline"
      >
        Report this link
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-2">
        <span className="text-small text-text-muted">What&rsquo;s wrong with this link? (optional)</span>
        <textarea
          className={`${input} min-h-[88px] resize-y`}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="It pretends to be a support team asking for a refund."
        />
      </label>
      {notice && <p className="text-small text-text-muted">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnSmallSecondary} disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" className={btnSmallSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
