"use client";

/**
 * Spaces › Account: the X account listings publish under and the wallet
 * sponsors pay, with a strip saying whether publishing is possible.
 *
 * The strip follows the order the publish gate checks (`publishRefusal` on the
 * backend), so it never says "ready" about a listing the server would refuse.
 * Whether a Solana address already holds a USDC account is not something any
 * call here can see; the server reads the chain at publish.
 */

import Link from "next/link";
import { useCallback } from "react";

import { PayoutAddress } from "@/components/creator/PayoutAddress";
import { XAccount } from "@/components/creator/XAccount";
import { MIN_X_ACCOUNT_AGE_DAYS, type PayoutAddressView } from "@/lib/creator/types";
import { usePayout, useRefresh } from "@/lib/app/spaces-data";

import { useHref } from "../base";
import { IconDirector } from "../icons";
import { useShell } from "../Shell";
import { glass } from "../ui";

export function AccountScreen() {
  const { x } = useShell();
  const payout = usePayout();
  const refresh = useRefresh();
  const onX = useCallback(() => void refresh("x"), [refresh]);
  const onPayout = useCallback(() => void refresh("payout"), [refresh]);

  return (
    <div className="flex flex-col gap-4">
      <RunATeam />
      <Ready canPublish={x?.canPublish === true} payout={payout.data ?? null} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
        <XAccount onChange={onX} />
        <PayoutAddress onChange={onPayout} />
      </div>
    </div>
  );
}

function Ready({ canPublish, payout }: { canPublish: boolean; payout: PayoutAddressView | null }) {
  const solana = !!payout?.solana.address;
  const evm = !!payout?.evm.address;
  const items = [
    { done: canPublish, label: `Verified X, ${MIN_X_ACCOUNT_AGE_DAYS}+ days old` },
    { done: solana || evm, label: solana && evm ? "Paid on Solana, Base, Polygon" : evm ? "Paid on Base, Polygon" : solana ? "Paid on Solana" : "Payout wallet" },
    { done: null, label: "Solana needs an existing USDC account" },
  ];
  return (
    <section className={`${glass} flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3`} aria-label="Ready to publish">
      <span className="text-small font-medium text-text">Ready to publish</span>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2 text-tiny text-[#CFE3EC]">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] text-[10px] ${
              i.done === true ? "bg-success/20 text-success" : i.done === false ? "bg-amber/20 text-amber" : "bg-white/10 text-[#9FB7C2]"
            }`}
            aria-hidden
          >
            {i.done === true ? "✓" : i.done === false ? "!" : "i"}
          </span>
          {i.label}
        </span>
      ))}
    </section>
  );
}

/**
 * Creator or Creative Director. Switching it on is an upgrade, not a setting:
 * the Team page appears, the title under the name changes, and every listing
 * gains "Who works it". While a team exists it stays on (lib/app/agency).
 */
function RunATeam() {
  const { agency } = useShell();
  const href = useHref();
  const on = agency.on;
  return (
    <section
      id="team"
      aria-label="Run a team"
      className={`${glass} flex flex-col gap-4 overflow-hidden px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
        on ? "" : "bg-[linear-gradient(120deg,rgba(255,183,3,0.16),rgba(9,27,40,0.72)_55%)]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
            on ? "bg-amber text-text-on-amber" : "bg-amber/15 text-amber"
          }`}
        >
          <IconDirector className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-body font-medium text-text">{on ? "Creative Director" : "Run a team"}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-tiny text-[#9FB7C2]">
            <span>Invite by email</span>
            <span>Assign listings</span>
            <span>Split per sale</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {on ? (
          <Link href={href("/team")} className="text-small text-amber hover:text-[#FFE2A1]">
            Open Team
          </Link>
        ) : null}
        <label className={`flex items-center gap-2.5 ${agency.forced ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <span className="text-small text-text">{on ? "On" : "Become a Creative Director"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Creative Director"
            title={agency.forced ? "On while you have a team" : undefined}
            disabled={agency.forced}
            onClick={() => agency.set(!on)}
            className={`relative h-7 w-12 shrink-0 rounded-[14px] transition-colors disabled:opacity-60 ${
              on ? "bg-amber" : "bg-white/15 hover:bg-white/25"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-[10px] bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`}
              aria-hidden
            />
          </button>
        </label>
      </div>
    </section>
  );
}
