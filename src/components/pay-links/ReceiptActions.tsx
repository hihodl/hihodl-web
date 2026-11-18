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

/** "Save receipt": the browser's print dialog, which saves a PDF. */
export function SaveReceipt({ className }: { className: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Save receipt
    </button>
  );
}
