"use client";

/**
 * Where you get paid.
 *
 * What this says is what the server does (`payoutOwner` in
 * server/services/ad-space/payout-address.service.ts): a HOLD address wins
 * whenever there is one, on each chain family; an address proved by signature
 * is used only where there is no HOLD one; with neither, that chain is not
 * offered to sponsors. `GET /ad-space/payout-address` answers exactly that, so
 * the screen reads it and says it, per family:
 *
 *   Solana            the HOLD wallet (web or app), else a proved address
 *   Base and Polygon  the app wallet's EVM address, else a proved one, else
 *                     "paid on Solana" said plainly
 *
 * MetaMask, Phantom and the rest sit behind "Use another wallet", on their
 * own screen: they are the exception, not the way.
 */

import { useCallback } from "react";

import { PayoutAddress } from "@/components/creator/PayoutAddress";
import { describeCreatorError } from "@/lib/creator/api";
import type { PayoutAddressView } from "@/lib/creator/types";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { usePayout, useRefresh } from "@/lib/app/spaces-data";

import { btnGhost, btnLink, CopyButton, Note, ScreenHeader, shortAddress, Warn } from "../front/kit";
import { IconChevronRight } from "../icons";
import { glass, Skeleton } from "../ui";
import { Chip } from "./XScreen";

interface Line {
  title: string;
  address: string | null;
  text: string;
  tone: "done" | "neutral";
  chip: string;
}

/** The two families, in words, from the server's view and what we know of the HOLD wallet. */
function linesOf(view: PayoutAddressView, w: ReturnType<typeof useHoldWallet>): { solana: Line; evm: Line } {
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
          : w.canCreate
            ? { title: "Make your HOLD wallet", address: null, text: "Sponsors pay your HOLD wallet. Make it in Wallet: a passkey and a minute.", tone: "neutral", chip: "No wallet yet" }
            : { title: "No wallet yet", address: null, text: "Make your wallet in the HOLD app, or use another wallet.", tone: "neutral", chip: "No wallet yet" };

  const e = view.evm;
  const evm: Line =
    e.source === "hold"
      ? { title: "Base and Polygon", address: e.address, text: "Your HOLD wallet's address on Base and Polygon.", tone: "done", chip: "HOLD wallet" }
      : e.source === "declared"
        ? { title: "Base and Polygon", address: e.address, text: "Another wallet, proved by your signature.", tone: "done", chip: "Another wallet" }
        : {
            title: "Base and Polygon",
            address: null,
            text: sol.address
              ? "Sponsors pay you on Solana. Base and Polygon come with the HOLD app's wallet, or with another wallet you add."
              : "Base and Polygon come with the HOLD app's wallet, or with another wallet you add.",
            tone: "neutral",
            chip: "Solana only",
          };
  return { solana, evm };
}

export function PayoutCard({ onOpen, walletHref }: { onOpen: () => void; walletHref: string }) {
  const payout = usePayout();
  const w = useHoldWallet();
  const lines = payout.data ? linesOf(payout.data, w) : null;
  return (
    <section className={`${glass} flex min-h-[180px] w-full min-w-0 flex-col justify-between gap-4 p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-text">Where you get paid</span>
        {lines ? <Chip tone={lines.solana.tone}>{lines.solana.chip}</Chip> : null}
      </div>
      {payout.error ? (
        <Warn>{describeCreatorError(payout.error)}</Warn>
      ) : !lines ? (
        <Skeleton className="h-12" />
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-body text-text">{lines.solana.title}</p>
          {lines.solana.address ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-small text-[#CFE3EC]">{shortAddress(lines.solana.address)}</span>
              <CopyButton value={lines.solana.address} />
              {w.walletPage ? (
                <a href={walletHref} className="text-tiny text-[#9FB7C2] hover:text-text">
                  Open Wallet
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-tiny text-[#9FB7C2]">{lines.solana.text}</p>
          )}
        </div>
      )}
      <button type="button" onClick={onOpen} className="flex items-center gap-1 self-start text-small text-amber hover:text-[#FFE2A1]">
        Details <IconChevronRight />
      </button>
    </section>
  );
}

export function PayoutScreen({ onBack, onOther, walletHref }: { onBack: () => void; onOther: () => void; walletHref: string }) {
  const payout = usePayout();
  const w = useHoldWallet();
  const lines = payout.data ? linesOf(payout.data, w) : null;

  return (
    <section className={`${glass} flex w-full max-w-[600px] flex-col gap-5 p-5 sm:p-6`}>
      <ScreenHeader title="Where you get paid" onBack={onBack} />
      {payout.error ? (
        <Warn>{describeCreatorError(payout.error)}</Warn>
      ) : !lines ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Note>Sponsors pay you directly, in USDC, to the address below. HOLD never holds it on the way.</Note>
          {[lines.solana, lines.evm].map((l) => (
            <div key={l.title} className="flex flex-col gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-small font-medium text-text">{l.title}</p>
                <Chip tone={l.tone}>{l.chip}</Chip>
              </div>
              {l.address ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 break-all font-mono text-tiny text-[#CFE3EC]">{l.address}</code>
                  <CopyButton value={l.address} />
                </div>
              ) : null}
              <p className="text-tiny text-[#9FB7C2]">{l.text}</p>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {w.walletPage ? (
              // The Wallet page carries a strict CSP that only a full page load can set.
              <a href={walletHref} className={btnGhost}>
                Open Wallet
              </a>
            ) : null}
            <button type="button" className={btnLink} onClick={onOther}>
              Use another wallet
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** MetaMask, Phantom and friends: prove an address by signing, as before, on its own screen. */
export function OtherWallet({ onBack }: { onBack: () => void }) {
  const refresh = useRefresh();
  // Stable: PayoutAddress reads again whenever this changes.
  const onChange = useCallback(() => void refresh("payout"), [refresh]);
  return (
    <section className="flex w-full max-w-[640px] flex-col gap-4">
      <div className={`${glass} flex flex-col gap-3 p-5 sm:p-6`}>
        <ScreenHeader title="Use another wallet" onBack={onBack} />
        <Note>
          For a chain your HOLD wallet does not cover. Connect the wallet and sign one message: no fee, no transaction.
          Wherever you have a HOLD wallet, it is the one that gets paid.
        </Note>
      </div>
      <PayoutAddress onChange={onChange} />
    </section>
  );
}
