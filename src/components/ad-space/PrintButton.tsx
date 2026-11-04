"use client";

import { btnSmallSecondary } from "./ui";

/**
 * "Download PDF": the browser's own print dialog, where Save as PDF lives on
 * every desktop and phone. The page's print styles turn the navy ground white
 * and hide everything that is not the report.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${btnSmallSecondary} print:hidden`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
