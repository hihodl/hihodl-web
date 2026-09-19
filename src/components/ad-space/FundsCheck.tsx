"use client";

import { useState } from "react";

import { CheckoutError, describeError } from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL } from "@/lib/ad-space/format";
import { describeOfferError, requestOfferChallenge } from "@/lib/ad-space/offers-client";
import type { Chain, OfferKind, OfferProof } from "@/lib/ad-space/types";
import { canSignMessage, connectSolana, evmAccount, signEvmMessage, signSolanaMessage } from "@/lib/ad-space/wallets";

import {
  ExtraRow,
  InfoTip,
  NetworkPill,
  SheetNotice,
  StatusLine,
  Tick,
  WalletRows,
  ctaGlass,
  useBrowserWallets,
} from "./pay-sheet";

/**
 * "Check my funds" (hispace-offers-v0.md, Proof of funds): the page asks for a
 * challenge bound to the chain, the wallet and the amount, the wallet signs its
 * text, and the signature goes with the offer. The server reads the balance
 * when the offer arrives; nothing here moves or locks money.
 *
 * A proof belongs to one amount. When the amount changes, the old proof no
 * longer matches and the sponsor is asked to check again.
 */

export interface CheckedFunds {
  proof: OfferProof;
  amountCents: number;
  /** The challenge's end: 5 minutes, single use. */
  expiresAt: string;
}

/** A proof still usable for this amount at this server-clock instant. */
export function usableProof(checked: CheckedFunds | null, amountCents: number | null, now: number | null): boolean {
  if (!checked || amountCents === null || checked.amountCents !== amountCents) return false;
  const end = Date.parse(checked.expiresAt);
  return !Number.isFinite(end) || now === null || end > now;
}

function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function FundsCheck({
  spaceId,
  positionId,
  chains,
  amountCents,
  kind,
  checked,
  onChecked,
  now,
  disabled = false,
}: {
  spaceId: string;
  positionId: string | null;
  /** The networks to offer: where the creator can be paid (`payChainsOf`). */
  chains: Chain[];
  /** The amount being offered, creator side, in cents; null while the input isn't an amount. */
  amountCents: number | null;
  kind: OfferKind;
  checked: CheckedFunds | null;
  onChecked: (c: CheckedFunds | null) => void;
  now: number | null;
  disabled?: boolean;
}) {
  const [chain, setChain] = useState<Chain>(chains.includes("solana") ? "solana" : chains[0]);
  const { solana, evm } = useBrowserWallets();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The check is a signed message, so only wallets that can sign one are listed.
  const signers = solana.filter((w) => canSignMessage(w.provider));
  const here =
    chain === "solana" ? signers.map((w) => ({ id: w.name, name: w.name, icon: w.icon ?? null })) : evm;
  const chosen = here.find((w) => w.id === picked) ?? here[0] ?? null;

  const usable = usableProof(checked, amountCents, now);
  const stale = checked !== null && !usable;

  async function check() {
    setNotice(null);
    if (amountCents === null) return setNotice(`Type the amount of your ${kind} first: the check is for that amount.`);
    if (!chosen) return;
    try {
      let address: string;
      let sign: (message: string) => Promise<string>;
      if (chain === "solana") {
        const wallet = signers.find((w) => w.name === chosen.id);
        if (!wallet) return;
        setBusy(`Connecting ${wallet.name}…`);
        address = await connectSolana(wallet.provider);
        sign = (m) => signSolanaMessage(wallet.provider, m);
      } else {
        const wallet = evm.find((w) => w.id === chosen.id);
        if (!wallet) return;
        setBusy(`Connecting ${wallet.name}…`);
        address = await evmAccount(wallet.provider);
        sign = (m) => signEvmMessage(wallet.provider, address, m);
      }
      setBusy("Preparing the check…");
      const challenge = await requestOfferChallenge({
        spaceId,
        ...(positionId ? { positionId } : {}),
        chain,
        address,
        amountCents,
      });
      setBusy(`Sign the message in ${chosen.name}`);
      const signature = await sign(challenge.message);
      onChecked({
        proof: { chain, address, nonce: challenge.nonce, signature },
        amountCents,
        expiresAt: challenge.expiresAt,
      });
    } catch (e) {
      if (e instanceof CheckoutError) {
        setNotice(describeOfferError(e, { kind, chain }) ?? describeError(e, chain));
      } else {
        const msg = String((e as { message?: unknown })?.message ?? "").toLowerCase();
        const code = (e as { code?: unknown })?.code;
        setNotice(
          code === 4001 || code === "ACTION_REJECTED" || /reject|denied|cancel/.test(msg)
            ? "You closed your wallet without signing, so your funds weren't checked."
            : msg.includes("sign_message_unsupported")
              ? "This wallet can't sign a message. Try Phantom, Solflare or Backpack."
              : "Your wallet couldn't sign the check. Try again, or use another wallet.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  if (usable && checked) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-success/[0.10] px-4 py-3" role="status">
        <span className="flex min-w-0 items-center gap-2.5 text-small text-sp-ink">
          <span className="text-sp-ok">
            <Tick />
          </span>
          <span className="truncate">
            Verified · <span className="font-mono">{shortAddress(checked.proof.address)}</span> on{" "}
            {CHAIN_LABEL[checked.proof.chain]}
          </span>
          <InfoTip label="About the check">
            We read that wallet&rsquo;s USDC when your {kind} arrives. Send it within 5 minutes, or verify again.
          </InfoTip>
        </span>
        <button
          type="button"
          className="shrink-0 text-small font-medium text-sp-amber hover:text-amber-glow disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChecked(null)}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stale && (
        <p className="text-small text-sp-amber" role="status">
          {checked && amountCents !== null && checked.amountCents !== amountCents
            ? "You changed the amount. Verify again for the new one."
            : "Your check expired. Verify again, then send."}
        </p>
      )}
      {chains.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-small text-white/85">Wallet on</span>
          <NetworkPill
            chains={chains}
            chain={chain}
            disabled={Boolean(busy) || disabled}
            onChange={(c) => {
              setChain(c);
              setPicked(null);
              setNotice(null);
            }}
          />
        </div>
      )}
      {here.length > 0 ? (
        <WalletRows wallets={here} selected={chosen?.id ?? null} onSelect={setPicked} disabled={Boolean(busy) || disabled} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-small text-white/85">
            No {chain === "solana" ? "Solana wallet that can sign" : `${CHAIN_LABEL[chain]} wallet`} in this browser.
          </p>
          <OpenInWalletRow />
        </div>
      )}
      {busy ? (
        <StatusLine>{busy}</StatusLine>
      ) : (
        here.length > 0 && (
          <button type="button" className={`${ctaGlass} h-12 w-full`} disabled={disabled || !chosen} onClick={() => void check()}>
            Verify with {chosen?.name ?? "wallet"}
          </button>
        )
      )}
      {notice && (
        <SheetNotice>
          <p>{notice}</p>
        </SheetNotice>
      )}
    </div>
  );
}

/** For a wallet this browser does not have: open the page inside that wallet. */
function OpenInWalletRow() {
  const [copied, setCopied] = useState(false);
  return (
    <ExtraRow
      title={copied ? "Link copied" : "Use another wallet"}
      sub="Copy this page's link and open it in your wallet's browser"
      onClick={() => {
        void navigator.clipboard
          .writeText(window.location.href)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => setCopied(false));
      }}
    />
  );
}
