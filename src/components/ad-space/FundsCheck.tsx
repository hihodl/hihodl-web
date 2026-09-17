"use client";

import { useEffect, useState } from "react";

import { CheckoutError, describeError } from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL } from "@/lib/ad-space/format";
import { describeOfferError, requestOfferChallenge } from "@/lib/ad-space/offers-client";
import type { Chain, OfferKind, OfferProof } from "@/lib/ad-space/types";
import {
  type SolanaWallet,
  canSignMessage,
  connectSolana,
  detectSolanaWallets,
  evmAccount,
  injected,
  signEvmMessage,
  signSolanaMessage,
} from "@/lib/ad-space/wallets";

import { Check, ChainPicker, Spinner } from "./checkout-parts";
import { btnSmall, btnSmallSecondary } from "./ui";

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
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [hasEvm, setHasEvm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setWallets(detectSolanaWallets().filter((w) => canSignMessage(w.provider)));
    setHasEvm(Boolean(injected().ethereum));
  }, []);

  const usable = usableProof(checked, amountCents, now);
  const stale = checked !== null && !usable;

  async function check(wallet: SolanaWallet | null) {
    setNotice(null);
    if (amountCents === null) return setNotice(`Type the amount of your ${kind} first: the check is for that amount.`);
    try {
      let address: string;
      let sign: (message: string) => Promise<string>;
      if (chain === "solana") {
        if (!wallet) return;
        setBusy(`Connecting ${wallet.name}…`);
        address = await connectSolana(wallet.provider);
        sign = (m) => signSolanaMessage(wallet.provider, m);
      } else {
        const provider = injected().ethereum;
        if (!provider) return setNotice("No browser wallet found. Open this page in MetaMask, Coinbase Wallet or Rabby.");
        setBusy("Connecting your wallet…");
        address = await evmAccount(provider);
        sign = (m) => signEvmMessage(provider, address, m);
      }
      setBusy("Preparing the check…");
      const challenge = await requestOfferChallenge({
        spaceId,
        ...(positionId ? { positionId } : {}),
        chain,
        address,
        amountCents,
      });
      setBusy("Sign the message in your wallet…");
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
      <div className="flex flex-col gap-2 rounded-card border border-success/30 bg-success/[0.06] px-4 py-3" role="status">
        <p className="flex items-center gap-2 text-small text-text">
          <span className="flex h-5 w-5 items-center justify-center rounded-[10px] bg-success/20 text-success" aria-hidden>
            <Check />
          </span>
          Signed by {shortAddress(checked.proof.address)} on {CHAIN_LABEL[checked.proof.chain]}
        </p>
        <p className="text-tiny text-text-muted">
          We read that wallet&rsquo;s USDC when your {kind} arrives. Send it within 5 minutes, or check again.
        </p>
        <div>
          <button type="button" className={btnSmallSecondary} disabled={disabled} onClick={() => onChecked(null)}>
            Use another wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stale && (
        <p className="text-small text-amber" role="status">
          {checked && amountCents !== null && checked.amountCents !== amountCents
            ? "You changed the amount after checking your funds. Check again for the new amount."
            : "Your funds check expired. Check again, then send."}
        </p>
      )}
      {chains.length > 1 && (
        <ChainPicker
          chains={chains}
          chain={chain}
          legend="Wallet on"
          onChange={(c) => {
            setChain(c);
            setNotice(null);
          }}
        />
      )}
      {busy ? (
        <p className="flex items-center gap-3 text-small text-text" role="status">
          <Spinner />
          {busy}
        </p>
      ) : chain === "solana" ? (
        wallets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {wallets.map((w, i) => (
              <button
                key={w.name}
                type="button"
                className={i === 0 ? btnSmall : btnSmallSecondary}
                disabled={disabled}
                onClick={() => void check(w)}
              >
                Check with {w.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">
            No Solana wallet that can sign in this browser. Open this page in Phantom, Solflare or Backpack
            {chains.some((c) => c !== "solana") ? ", or check a wallet on Base or Polygon" : ""}.
          </p>
        )
      ) : hasEvm ? (
        <div>
          <button type="button" className={btnSmall} disabled={disabled} onClick={() => void check(null)}>
            Connect wallet and sign
          </button>
        </div>
      ) : (
        <p className="text-small text-text-muted">
          No browser wallet found here. Open this page in MetaMask, Coinbase Wallet or Rabby
          {chains.includes("solana") ? ", or check a wallet on Solana" : ""}.
        </p>
      )}
      <p className="text-tiny text-text-faint">
        Signing a message costs nothing and moves no money. It only proves the wallet is yours, so we can read its USDC
        on {CHAIN_LABEL[chain]}.
      </p>
      {notice && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
