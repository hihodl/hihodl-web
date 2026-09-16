"use client";

import type { Chain } from "@/lib/ad-space/types";
import { CHAIN_LABEL } from "@/lib/ad-space/format";
import type { SolanaWallet } from "@/lib/ad-space/wallets";

import { btnPrimary, btnSecondary } from "./ui";

/**
 * Pieces of a public checkout that do not know what is being bought: the chain
 * picker, the Solana ways to pay, and the small marks. Shared by the HiSpace
 * checkout and pay links.
 */

export function ChainPicker({
  chains,
  chain,
  onChange,
  legend = "Pay with USDC on",
}: {
  chains: Chain[];
  chain: Chain;
  onChange: (c: Chain) => void;
  legend?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-small text-text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {chains.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={chain === c}
            onClick={() => onChange(c)}
            className={`inline-flex h-10 items-center whitespace-nowrap rounded-[20px] border px-4 text-small transition-colors duration-180 ${
              chain === c
                ? "border-amber bg-amber/10 text-text"
                : "border-[color:var(--color-hairline-strong)] text-text-muted hover:text-text"
            }`}
          >
            {CHAIN_LABEL[c]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SolanaOptions({
  wallets,
  mobile,
  mobileLink,
  onWallet,
  onQr,
  onMobileLink,
}: {
  wallets: SolanaWallet[];
  mobile: boolean;
  mobileLink: string | null;
  onWallet: (w: SolanaWallet) => void;
  onQr: () => void;
  onMobileLink: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {wallets.map((w, i) => (
        <button
          key={w.name}
          type="button"
          className={i === 0 ? btnPrimary : btnSecondary}
          onClick={() => onWallet(w)}
        >
          Pay with {w.name}
        </button>
      ))}

      {mobile && mobileLink && (
        // The same Solana Pay link the QR carries, for a wallet on this phone.
        <a href={mobileLink} className={wallets.length ? btnSecondary : btnPrimary} onClick={onMobileLink}>
          Open in my wallet app
        </a>
      )}

      <button type="button" className={wallets.length || mobile ? btnSecondary : btnPrimary} onClick={onQr}>
        Pay with QR
      </button>

      {wallets.length === 0 && !mobile && (
        <p className="text-tiny text-text-faint">
          No Solana wallet in this browser. Scan the QR with the wallet on your phone.
        </p>
      )}
    </div>
  );
}

export function Check() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2 5.2l2 2L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber/30 border-t-amber"
      aria-hidden
    />
  );
}
