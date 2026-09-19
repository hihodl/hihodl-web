"use client";

/**
 * Whether a listing can be published, in the order the publish gate checks
 * (`publishRefusal` on the backend), so it never says "ready" about a listing
 * the server would refuse. Each line that is not done links to the Account
 * screen that fixes it. Whether a Solana address already holds a USDC account
 * is not something any call here can see; the server reads the chain at
 * publish, so that line is information, not a tick.
 *
 * `compact` is the one-line strip the Overview shows while something is
 * missing (and never once everything is done).
 */

import Link from "next/link";

import { MIN_X_ACCOUNT_AGE_DAYS } from "@/lib/creator/types";
import { usePayout } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { useShell } from "../Shell";
import { glass } from "../ui";

interface Item {
  done: boolean | null;
  label: string;
  href?: string;
}

function useItems(): Item[] | null {
  const { x } = useShell();
  const payout = usePayout();
  const href = useProductHref();
  if (!payout.data && !payout.error) return null;
  const p = payout.data;
  const solana = !!p?.solana.address;
  const evm = !!p?.evm.address;
  return [
    { done: x?.canPublish === true, label: `Verified X, ${MIN_X_ACCOUNT_AGE_DAYS}+ days old`, href: href("/account?view=x") },
    {
      done: solana || evm,
      label: solana && evm ? "Paid on Solana, Base, Polygon" : evm ? "Paid on Base, Polygon" : solana ? "Paid on Solana" : "Where you get paid",
      href: href("/account?view=payout"),
    },
    { done: null, label: "Solana needs an existing USDC account" },
  ];
}

function Mark({ done }: { done: boolean | null }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[10px] ${
        done === true ? "bg-success/20 text-success" : done === false ? "bg-amber/20 text-amber" : "bg-white/10 text-[#9FB7C2]"
      }`}
      aria-hidden
    >
      {done === true ? "✓" : done === false ? "!" : "i"}
    </span>
  );
}

export function ReadyToPublish({ compact = false }: { compact?: boolean }) {
  const { role } = useShell();
  const items = useItems();
  if (role !== "creator" || !items) return null;
  const missing = items.filter((i) => i.done === false);

  if (compact) {
    if (missing.length === 0) return null;
    return (
      <section aria-label="Before you publish" className={`${glass} flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5`}>
        <span className="text-tiny font-medium text-text">Before you publish</span>
        {missing.map((i) => (
          <Link key={i.label} href={i.href ?? "#"} className="inline-flex items-center gap-2 text-tiny text-[#CFE3EC] hover:text-text">
            <Mark done={false} />
            {i.label}
          </Link>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="Ready to publish" className={`${glass} flex flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium text-text">Ready to publish</p>
        <span className={`text-tiny ${missing.length ? "text-amber" : "text-success"}`}>{missing.length ? `${missing.length} to do` : "Ready"}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.label}>
            {i.href ? (
              <Link href={i.href} className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-small text-[#CFE3EC] transition-colors hover:bg-white/[0.05] hover:text-text">
                <Mark done={i.done} />
                {i.label}
              </Link>
            ) : (
              <span className="flex items-center gap-2.5 px-2 py-1.5 text-small text-[#9FB7C2]">
                <Mark done={i.done} />
                {i.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
