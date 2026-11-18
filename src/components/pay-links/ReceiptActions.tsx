"use client";

import { useState } from "react";

import { Ion } from "@/components/app/ion";

/** A short id with a button that copies the whole of it. */
export function CopyId({ value, shown, label }: { value: string; shown: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const p = navigator.clipboard?.writeText(value);
    if (!p) return;
    void p.then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false),
    );
  };
  return (
    <span className="flex items-center gap-2">
      <span dir="ltr" className="font-mono text-[13px] text-[#DCE7EE]">
        {shown}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/[0.16] print:hidden"
      >
        <Ion name={copied ? "checkmark" : "copy-outline"} size={13} className={copied ? "text-[#7DD3A8]" : ""} />
      </button>
    </span>
  );
}

/**
 * "Save receipt": the receipt as a picture (./image next to the page). It
 * used to open the print dialog, which a wallet's in-app browser (Phantom,
 * 18-Nov-2026) does not have, so the tap did nothing. Now: the phone's share
 * sheet with the PNG (Save Image, Files, Messages), else a download, else the
 * picture opened on its own, where a long press saves it.
 */
export function SaveReceipt({ className }: { className: string }) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    const url = `${window.location.pathname.replace(/\/$/, "")}/image`;
    setBusy(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "HOLD-receipt.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (e) {
          // Closing the share sheet is a choice, not a failure.
          if ((e as Error)?.name !== "AbortError") window.location.href = url;
        }
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "HOLD-receipt.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void save()} disabled={busy} aria-busy={busy} className={`${className} disabled:opacity-60`}>
      Save receipt
    </button>
  );
}
