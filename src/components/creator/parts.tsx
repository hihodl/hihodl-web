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

import { btnSmallSecondary, card, eyebrow, pill } from "@/components/ad-space/ui";

export function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`${card} p-6 sm:p-8`}>
      <p className={`${eyebrow} text-text-faint`}>{label}</p>
      <h2 className="mt-2 text-h4 font-light text-text">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Done, waiting on the creator, or simply a fact. Never an alarm. */
export function Status({ state, children }: { state: "done" | "todo" | "neutral"; children: ReactNode }) {
  const cls = state === "done" ? pill.done : state === "todo" ? pill.attention : pill.neutral;
  return <span className={cls}>{children}</span>;
}

/**
 * A line of prose about something that did not work.
 *
 * Tinted amber and never red: everything that lands here is recoverable, and
 * half of it is the creator having changed their mind in a wallet.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-input border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">
      {children}
    </p>
  );
}

/**
 * An address, shown whole.
 *
 * Never truncated. A creator checking that we hold the right address is
 * comparing it against their wallet character by character, and "7xKX…9fQ" is
 * exactly the thing they cannot check.
 */
export function Address({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="min-w-0 break-all font-mono text-small text-text">{value}</code>
      <button
        type="button"
        className={btnSmallSecondary}
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
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** The skeleton a card wears while its first read is in flight. */
export function Loading({ what }: { what: string }) {
  return <p className="text-small text-text-muted">Reading {what}…</p>;
}
