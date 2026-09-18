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

import { useCallback } from "react";

import { PayoutAddress } from "@/components/creator/PayoutAddress";
import { XAccount } from "@/components/creator/XAccount";
import { MIN_X_ACCOUNT_AGE_DAYS, type PayoutAddressView } from "@/lib/creator/types";
import { usePayout, useRefresh } from "@/lib/app/spaces-data";

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
            className={`inline-flex size-4 items-center justify-center rounded-[4px] text-[10px] ${
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
