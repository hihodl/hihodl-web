"use client";

/**
 * Receive, as the HOLD app has it (app/(drawer)/(internal)/receive):
 *
 *   Select crypto   the tokens this wallet can be paid in, token first
 *                   (ReceiveSelectToken): the person thinks in tokens, not
 *                   networks
 *   the QR          one token's QR (ReceiveFintech): the @username chip, the
 *                   HQR, the token line, the address chip that copies, the
 *                   safety line naming the network, and Share
 *
 * The web wallet is Solana only, so there is no "Receiving on another
 * network?" link: each token here lives on one network.
 */

import { useState } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useMe } from "@/lib/app/spaces-data";

import { UserAvatar } from "../account/UserAvatar";
import { AppScreen, GREEN, HQR, PrimaryButton, shortAddr, SUB, TokenIcon } from "./app-kit";
import { Ion } from "../ion";

type Sym = "USDC" | "SOL";

const TOKENS: readonly { symbol: Sym; name: string }[] = [
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "SOL", name: "Solana" },
];

export function Receive({ address, onBack }: { address: string; onBack?: () => void }) {
  const [token, setToken] = useState<Sym | null>(null);
  if (!token) return <SelectCrypto onBack={onBack} onPick={setToken} />;
  return <ReceiveQr address={address} symbol={token} onBack={() => setToken(null)} />;
}

function SelectCrypto({ onBack, onPick }: { onBack?: () => void; onPick: (s: Sym) => void }) {
  return (
    <AppScreen title="Select crypto" onBack={onBack}>
      <div className="px-1 pt-2">
        <p className="mb-3.5 px-1 text-[13.5px] text-[#9FB7C2]">Choose which crypto you want to receive.</p>
        {TOKENS.map((t) => (
          <button
            key={t.symbol}
            type="button"
            onClick={() => onPick(t.symbol)}
            aria-label={`Receive ${t.symbol}`}
            className="mb-2.5 flex w-full items-center gap-3.5 rounded-[18px] border border-white/10 bg-white/[0.05] p-3.5 text-left transition-colors hover:bg-white/[0.09]"
          >
            <TokenIcon symbol={t.symbol} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-strong text-white">{t.symbol}</span>
              <span className="mt-0.5 block truncate text-[13px] text-[#9FB7C2]">{t.name}</span>
            </span>
          </button>
        ))}
      </div>
    </AppScreen>
  );
}

function useCopied(): [boolean, (v: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (v: string) => {
    // No clipboard outside a secure context: the value is on screen either way.
    const p = navigator.clipboard?.writeText(v);
    if (!p) return;
    void p.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false),
    );
  };
  return [copied, copy];
}

function ReceiveQr({ address, symbol, onBack }: { address: string; symbol: Sym; onBack: () => void }) {
  const me = useMe();
  const username = chosenUsername(me.data);
  const handle = username ? `@${username}` : null;
  const [copied, copy] = useCopied();
  const [handleCopied, copyHandle] = useCopied();
  const [shared, setShared] = useState(false);

  const share = async () => {
    // The app hands the address to the system share sheet; a browser without
    // one copies it instead, and says so on the button.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: address });
        return;
      } catch {
        /* dismissed */
        return;
      }
    }
    copy(address);
    setShared(true);
    setTimeout(() => setShared(false), 1800);
  };

  return (
    <AppScreen title="Receive" onBack={onBack}>
      <div className="flex flex-col items-center px-6 pb-6 pt-2">
        {handle ? (
          <button
            type="button"
            onClick={() => copyHandle(handle)}
            aria-label="Copy username"
            className="mb-3 flex items-center gap-2 rounded-[16px] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]"
          >
            <UserAvatar size={32} fallbackName={handle} />
            <span className="truncate text-[15px] font-strong text-white">{handle}</span>
            <Ion name={handleCopied ? "checkmark" : "copy-outline"} size={14} color={handleCopied ? GREEN : SUB} />
          </button>
        ) : (
          <div className="h-1.5" />
        )}

        <HQR value={address} title={`Your ${symbol} address on Solana`} />

        <div className="mt-[18px] flex items-center gap-[9px]">
          <TokenIcon symbol={symbol} size={34} />
          <span className="text-[18px] font-strong text-white">{symbol}</span>
        </div>

        <button
          type="button"
          onClick={() => copy(address)}
          aria-label="Copy address"
          title={address}
          className="mt-3.5 flex h-[38px] items-center gap-2 rounded-[19px] border border-white/[0.12] bg-white/[0.05] px-3.5 transition-colors hover:bg-white/[0.09]"
        >
          <span className="text-[14px] font-strong tracking-[0.2px] text-white">{shortAddr(address)}</span>
          <Ion name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? GREEN : SUB} />
        </button>

        <p className="mt-3 px-2 text-center text-[12.5px] leading-[18px] text-[#9FB7C2]">
          Only send {symbol} on Solana.
          <br />
          Sending on another network may lose your funds.
        </p>

        <div className="mt-6 w-full">
          <PrimaryButton icon="share-outline" onClick={() => void share()}>
            {shared ? "Copied" : "Share"}
          </PrimaryButton>
        </div>
      </div>
    </AppScreen>
  );
}
