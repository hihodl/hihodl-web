"use client";

/**
 * "Your sponsor report" on a paid order (round 2 item 3 of
 * organiser-sells-its-event-contract.md): the order and the offer manage
 * views carry `reportUrl` once paid, so a brand that paid from a wallet, with
 * no email on file, still keeps the page that fills in after the event.
 *
 * Absent (an older server, an order with no event): nothing is drawn.
 */

import { useT } from "@/lib/app/i18n/react";
import { reportPathOf } from "@/lib/app/organiser-rules";

import { btnSmallSecondary } from "./ui";

export function ReportLink({ url, className = "" }: { url: string | null | undefined; className?: string }) {
  const t = useT();
  const path = reportPathOf(url);
  if (!path) return null;
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <a href={path} target="_blank" rel="noopener" className={btnSmallSecondary}>
        {t("sponsor.checkout.paid.report")}
      </a>
      <p className="max-w-sm text-tiny text-sp-ink/85">{t("sponsor.checkout.paid.reportBody")}</p>
    </div>
  );
}
