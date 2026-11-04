"use client";

/**
 * Receive, as the HOLD app has it (app/(drawer)/(internal)/receive):
 *
 *   Select crypto   the tokens this wallet can be paid in, token first
 *                   (ReceiveSelectToken): the person thinks in tokens, not
 *                   networks
 *   the QR          one token's QR (ReceiveFintech): the @username chip, the
 *                   HQR, the token line, the address chip that copies,
 *                   "Receiving on another network?" when the token lives on
 *                   more than one, the safety line naming the network, and
 *                   Share
 *
 * TWO CALLERS, ONE SCREEN
 *
 * The Wallet page passes `address`: the web wallet is Solana only, so its list
 * is USDC and SOL and there is no other network to offer. Add money passes
 * `addresses` — every chain `GET /me/addresses` knows this person on — and
 * then the list is the app's own RECEIVE_TOKENS, filtered to what we can
 * actually be paid on. A chain we have no address for is never drawn: the
 * whole point of the token-first flow is that nothing on it can send money
 * somewhere we cannot credit.
 */

import { useState } from "react";

import { useT } from "@/lib/app/i18n/react";
import { chosenUsername } from "@/lib/app/me";
import { useMe } from "@/lib/app/spaces-data";

import { UserAvatar } from "../account/UserAvatar";
import { AppScreen, GREEN, HQR, PrimaryButton, shortAddr, SUB, TokenIcon } from "./app-kit";
import { Ion } from "../ion";

/** The networks the app can credit a deposit on (src/config/receiveTokens.ts). */
export type ReceiveNet = "solana" | "base" | "polygon" | "ethereum" | "bitcoin";

export type ReceiveAddresses = Partial<Record<ReceiveNet, string>>;

const NET_LABEL: Record<ReceiveNet, string> = {
  solana: "Solana",
  base: "Base",
  polygon: "Polygon",
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
};

interface Token {
  symbol: string;
  name: string;
  /** ORDER MATTERS — networks[0] is the one the QR opens on. */
  networks: readonly ReceiveNet[];
}

/** RECEIVE_TOKENS, in the app's order. */
const TOKENS: readonly Token[] = [
  { symbol: "USDC", name: "USD Coin", networks: ["solana", "base", "polygon", "ethereum"] },
  { symbol: "USDT", name: "Tether USD", networks: ["solana", "base", "polygon", "ethereum"] },
  { symbol: "BTC", name: "Bitcoin", networks: ["bitcoin"] },
  { symbol: "ETH", name: "Ethereum", networks: ["base", "ethereum"] },
  { symbol: "SOL", name: "Solana", networks: ["solana"] },
  { symbol: "POL", name: "Polygon", networks: ["polygon"] },
];

/** The web wallet's own two, on the one network it has. */
const WEB_TOKENS: readonly Token[] = [
  { symbol: "USDC", name: "USD Coin", networks: ["solana"] },
  { symbol: "SOL", name: "Solana", networks: ["solana"] },
];

export function Receive({
  address,
  addresses,
  onBack,
}: {
  /** The web wallet's Solana address. */
  address?: string;
  /** Every network this person can be paid on, when there is more than one. */
  addresses?: ReceiveAddresses;
  onBack?: () => void;
}) {
  const [token, setToken] = useState<Token | null>(null);
  const byNet: ReceiveAddresses = addresses ?? (address ? { solana: address } : {});
  const list = (addresses ? TOKENS : WEB_TOKENS).filter((t) => t.networks.some((n) => byNet[n]));

  if (!token) return <SelectCrypto tokens={list} onBack={onBack} onPick={setToken} />;
  return <ReceiveQr byNet={byNet} token={token} onBack={() => setToken(null)} />;
}

function SelectCrypto({ tokens, onBack, onPick }: { tokens: readonly Token[]; onBack?: () => void; onPick: (t: Token) => void }) {
  const t = useT();
  return (
    <AppScreen title={t("wallet.receive.selectTitle")} onBack={onBack}>
      <div className="px-1 pt-2">
        <p className="mb-3.5 px-1 text-[13.5px] text-[#9FB7C2]">{t("wallet.receive.selectHint")}</p>
        {tokens.length === 0 ? (
          <p className="px-1 text-[13px] leading-[18px] text-white/55">{t("wallet.receive.noAddress")}</p>
        ) : null}
        {tokens.map((tok) => (
          <button
            key={tok.symbol}
            type="button"
            onClick={() => onPick(tok)}
            aria-label={t("wallet.receive.tokenAria", { symbol: tok.symbol })}
            className="mb-2.5 flex w-full items-center gap-3.5 rounded-[18px] border border-white/10 bg-white/[0.05] p-3.5 text-left transition-colors hover:bg-white/[0.09]"
          >
            <TokenIcon symbol={tok.symbol} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-strong text-white">{tok.symbol}</span>
              <span className="mt-0.5 block truncate text-[13px] text-[#9FB7C2]">{tok.name}</span>
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

function ReceiveQr({ byNet, token, onBack }: { byNet: ReceiveAddresses; token: Token; onBack: () => void }) {
  const t = useT();
  const nets = token.networks.filter((n) => byNet[n]);
  const [net, setNet] = useState<ReceiveNet>(nets[0] ?? token.networks[0]);
  const [picking, setPicking] = useState(false);
  const address = byNet[net] ?? "";
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
    <AppScreen title={t("common.receive")} onBack={onBack}>
      <div className="flex flex-col items-center px-6 pb-6 pt-2">
        {handle ? (
          <button
            type="button"
            onClick={() => copyHandle(handle)}
            aria-label={t("wallet.receive.copyUsername")}
            className="mb-3 flex items-center gap-2 rounded-[16px] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]"
          >
            <UserAvatar size={32} fallbackName={handle} />
            <span className="truncate text-[15px] font-strong text-white">{handle}</span>
            <Ion name={handleCopied ? "checkmark" : "copy-outline"} size={14} color={handleCopied ? GREEN : SUB} />
          </button>
        ) : (
          <div className="h-1.5" />
        )}

        {address ? (
          <HQR value={address} title={t("wallet.receive.qrTitle", { symbol: token.symbol, network: NET_LABEL[net] })} />
        ) : (
          // Addresses loaded and this rail has none yet: a calm "not ready"
          // beats a spinner that never ends.
          <div className="flex h-[248px] w-[248px] flex-col items-center justify-center gap-2.5 rounded-[28px] bg-white px-6 text-center">
            <Ion name="time-outline" size={30} color="#0A0F14" />
            <p className="text-[14px] font-bold text-[#0A0F14]">{t("wallet.receive.notAvailable", { network: NET_LABEL[net] })}</p>
          </div>
        )}

        <div className="mt-[18px] flex items-center gap-[9px]">
          <TokenIcon symbol={token.symbol} size={34} />
          <span className="text-[18px] font-strong text-white">{token.symbol}</span>
        </div>

        <button
          type="button"
          onClick={() => copy(address)}
          disabled={!address}
          aria-label={t("wallet.receive.copyAddress")}
          title={address}
          className="mt-3.5 flex h-[38px] items-center gap-2 rounded-[19px] border border-white/[0.12] bg-white/[0.05] px-3.5 transition-colors hover:bg-white/[0.09] disabled:opacity-50"
        >
          <span className="text-[14px] font-strong tracking-[0.2px] text-white">{shortAddr(address)}</span>
          <Ion name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? GREEN : SUB} />
        </button>

        {/* Question framing, as the app has it: it prompts the exact
            self-check, which network is my sender using? */}
        {nets.length > 1 && !picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-4 flex items-center gap-1 px-2 py-1.5 text-[14px] font-strong text-white transition-opacity hover:opacity-70"
          >
            {t("wallet.receive.anotherNetwork")}
            <Ion name="chevron-forward" size={15} color={SUB} />
          </button>
        ) : null}

        {picking ? (
          <div className="mt-4 w-full">
            <p className="text-center text-[18px] font-extrabold text-white">{t("wallet.receive.on", { symbol: token.symbol })}</p>
            <p className="mb-4 mt-1.5 text-center text-[13px] text-[#9FB7C2]">{t("wallet.receive.pickNetwork")}</p>
            {nets.map((k) => {
              const active = k === net;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setNet(k);
                    setPicking(false);
                  }}
                  className={`mb-2.5 flex w-full items-center gap-3.5 rounded-[16px] border px-3.5 py-3.5 text-left transition-colors ${
                    active ? "border-[rgba(255,183,3,0.45)] bg-[rgba(255,183,3,0.10)]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-white">{NET_LABEL[k]}</span>
                  {active ? <Ion name="checkmark-circle" size={20} color="#FFB703" /> : <span className="w-5" />}
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="mt-3 px-2 text-center text-[12.5px] leading-[18px] text-[#9FB7C2]">
          {t("wallet.receive.onlySend", { symbol: token.symbol, network: NET_LABEL[net] })}
          <br />
          {t("wallet.receive.mayLose")}
        </p>

        <div className="mt-6 w-full">
          <PrimaryButton icon="share-outline" onClick={() => void share()} disabled={!address}>
            {shared ? t("common.copied") : t("common.share")}
          </PrimaryButton>
        </div>
      </div>
    </AppScreen>
  );
}
