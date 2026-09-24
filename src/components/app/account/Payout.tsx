"use client";

/**
 * Where you get paid.
 *
 * What this says is what the server does (`payoutOwner` in
 * server/services/ad-space/payout-address.service.ts): a HOLD address wins
 * whenever there is one; an address proved by signature is used only where
 * there is no HOLD one. `GET /ad-space/payout-address` answers exactly that.
 *
 * On the web a creator is paid on Solana, and that is all this screen sets up:
 * nothing here asks for MetaMask or an EVM address. Base and Polygon come with
 * the HOLD app's wallet; when the app already gave this account an address
 * there, it is shown read-only, and otherwise one line points to the app.
 *
 * Phantom and the rest sit behind "Use another wallet", on their own screen:
 * they are the exception, not the way.
 */

import { useCallback } from "react";

import { PayoutAddress } from "@/components/creator/PayoutAddress";
import { describeCreatorError } from "@/lib/creator/api";
import type { PayoutAddressView } from "@/lib/creator/types";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { usePayout, useRefresh } from "@/lib/app/spaces-data";

import { CopyButton, shortAddress } from "../front/kit";
import { BackHeader, Column, HoldCard, MenuRow, Notice } from "../hold";
import { StoreButtons } from "../main/products";
import { MoreChainsLine } from "../MoreChains";
import { Card, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";

const copyCls =
  "inline-flex h-8 shrink-0 items-center rounded-[16px] border border-white/[0.22] bg-white/10 px-3 text-[13px] font-strong text-white transition-colors hover:bg-white/[0.14]";

interface Line {
  title: string;
  address: string | null;
  text: string;
  tone: "done" | "neutral";
  chip: string;
}

/** The two families, in words, from the server's view and what we know of the HOLD wallet. */
function linesOf(view: PayoutAddressView, w: ReturnType<typeof useHoldWallet>): { solana: Line; evm: Line | null } {
  const sol = view.solana;
  const solana: Line =
    sol.source === "hold"
      ? { title: "Paid to your HOLD wallet", address: sol.address, text: "Solana. Sponsors pay this address directly.", tone: "done", chip: "HOLD wallet" }
      : sol.source === "declared"
        ? {
            title: "Paid to another wallet",
            address: sol.address,
            text: "Proved by your signature. A HOLD wallet, once you have one, takes over.",
            tone: "done",
            chip: "Another wallet",
          }
        : w.kind === "web" && w.unregistered
          ? {
              title: "Your HOLD wallet is almost ready",
              address: null,
              text: "Open your Wallet and unlock it once: that tells HOLD its address, and sponsors pay it from then on.",
              tone: "neutral",
              chip: "One step left",
            }
          : { title: "No wallet yet", address: null, text: "Get the HOLD app: it makes your wallet, and sponsors pay it from then on. Or use another wallet.", tone: "neutral", chip: "No wallet yet" };

  const e = view.evm;
  // Read-only here: Base and Polygon are set up in the HOLD app.
  const evm: Line | null = e.address
    ? {
        title: "Base and Polygon",
        address: e.address,
        text: e.source === "hold" ? "From the HOLD app's wallet. Listings made in the app can be paid here too." : "Another wallet, proved by your signature.",
        tone: "done",
        chip: e.source === "hold" ? "HOLD app" : "Another wallet",
      }
    : null;
  return { solana, evm };
}

/** The row on Account: where sponsors pay, in one line. */
export function usePayoutSummary(): { value: string | null; attention: boolean } {
  const payout = usePayout();
  const w = useHoldWallet();
  if (payout.error) return { value: null, attention: false };
  if (!payout.data) return { value: null, attention: false };
  const sol = linesOf(payout.data, w).solana;
  return { value: sol.address ? shortAddress(sol.address) : sol.chip, attention: !sol.address };
}

export function PayoutScreen({ onBack, onOther, walletHref }: { onBack: () => void; onOther: () => void; walletHref: string }) {
  const payout = usePayout();
  const w = useHoldWallet();
  const lines = payout.data ? linesOf(payout.data, w) : null;

  return (
    <Column>
      <BackHeader title="Where you get paid" onBack={onBack} />
      {payout.error ? (
        <Notice>{describeCreatorError(payout.error)}</Notice>
      ) : !lines ? (
        <Skeleton className="h-48 rounded-[18px]" />
      ) : (
        <div className="flex flex-col gap-3.5">
          <p className="px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
            Sponsors pay you directly, in USDC, to the address below. HOLD never holds it on the way.
          </p>
          {[lines.solana, ...(lines.evm ? [lines.evm] : [])].map((l) => (
            <Card key={l.title}>
              <div className="flex items-center justify-between gap-2.5">
                <p className="min-w-0 flex-1 text-[16px] font-strong tracking-[-0.2px] text-white">{l.title}</p>
                <Tag label={l.chip} tone={l.tone === "done" ? "good" : "calm"} />
              </div>
              {l.address ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 break-all font-mono text-[12.5px] text-white/[0.78]">{l.address}</code>
                  <CopyButton value={l.address} className={copyCls} />
                </div>
              ) : null}
              <p className="text-[12.5px] leading-[17px] text-white/55">{l.text}</p>
            </Card>
          ))}
          {w.kind === "none" && !lines.solana.address ? <StoreButtons /> : null}
          {lines.evm ? null : <MoreChainsLine />}
          <HoldCard className="mt-1">
            {w.walletPage ? (
              // The Wallet page carries a strict CSP that only a full page load can set.
              <MenuRow icon="wallet-outline" label="Open Wallet" href={walletHref} reload chevron />
            ) : null}
            <MenuRow icon="swap-horizontal" label="Use another wallet" sub="Phantom or another Solana wallet" onClick={onOther} chevron />
          </HoldCard>
        </div>
      )}
    </Column>
  );
}

/** Phantom and friends: prove a Solana address by signing, on its own screen. */
export function OtherWallet({ onBack }: { onBack: () => void }) {
  const refresh = useRefresh();
  // Stable: PayoutAddress reads again whenever this changes.
  const onChange = useCallback(() => void refresh("payout"), [refresh]);
  return (
    <Column wide>
      <BackHeader title="Use another wallet" onBack={onBack} />
      <p className="mb-4 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
        A Solana wallet other than HOLD, such as Phantom. Connect it and sign one message: no fee, no transaction. If you have a HOLD wallet, it is the one
        that gets paid.
      </p>
      <PayoutAddress onChange={onChange} />
    </Column>
  );
}
