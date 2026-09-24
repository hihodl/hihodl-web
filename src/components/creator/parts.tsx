/**
 * The small pieces every card in the console is built from.
 *
 * The reader here is the CREATOR, not the brand: this is their own account
 * page, not a sales page, so nothing persuades and nothing celebrates. A card
 * says what is true, and where something is missing it says what to do.
 *
 * Colour follows the Ad Space rule: amber is attention, green is done, and
 * there is no red on this site at all — a creator who has not linked X yet has
 * not done anything wrong.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Card, SectionLabel, Tag } from "@/components/app/spaces/kit";
import { useT } from "@/lib/app/i18n/react";

/**
 * A group in the app's vocabulary: its SectionLabel (small capitals) over a
 * Card. `label` is kept for the callers that pass one; the group says only
 * what it is.
 */
export function Section({
  title,
  action,
  children,
}: {
  label?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <SectionLabel right={action}>{title}</SectionLabel>
      <Card>{children}</Card>
    </section>
  );
}

/** Done, waiting on the creator, or simply a fact. Never an alarm. */
export function Status({ state, children }: { state: "done" | "todo" | "neutral"; children: ReactNode }) {
  return <Tag label={children} tone={state === "done" ? "good" : state === "todo" ? "caution" : "calm"} />;
}

/**
 * A line of prose about something that did not work.
 *
 * Tinted amber and never red: everything that lands here is recoverable, and
 * half of it is the creator having changed their mind in a wallet.
 */
export function Notice({ children }: { children: ReactNode }) {
  return <HoldNotice>{children}</HoldNotice>;
}

/**
 * An address, shown whole.
 *
 * Never truncated. A creator checking that we hold the right address is
 * comparing it against their wallet character by character, and "7xKX…9fQ" is
 * exactly the thing they cannot check.
 */
export function Address({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="min-w-0 break-all font-mono text-[14px] text-white">{value}</code>
      <button
        type="button"
        className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[17px] border border-white/[0.14] bg-white/[0.06] px-[13px] text-[13.5px] font-bold text-white/[0.62] transition-colors hover:bg-white/10"
        onClick={() => {
          // `navigator.clipboard` is missing outside a secure context, and
          // optional-chaining the property still leaves `.then` called on
          // nothing. The address is on screen in full either way, so a browser
          // that will not copy is a button that does nothing, not a crash.
          const copy = navigator.clipboard?.writeText(value);
          if (!copy) return;
          void copy.then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        <Ion name={copied ? "checkmark" : "copy-outline"} size={14} />
        {copied ? t("common.copied") : t("common.copy")}
      </button>
    </div>
  );
}

/** The skeleton a card wears while its first read is in flight. */
export function Loading({ what }: { what: string }) {
  const t = useT();
  return (
    <p className="text-[14px] text-white/55" aria-label={t("listings.parts.loadingWhat", { what })}>
      {t("common.loading")}
    </p>
  );
}
