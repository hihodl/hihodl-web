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
  disabled = false,
  qr = true,
}: {
  wallets: SolanaWallet[];
  mobile: boolean;
  mobileLink: string | null;
  onWallet: (w: SolanaWallet) => void;
  onQr: () => void;
  onMobileLink: () => void;
  /** Every way to pay is shown but can't be pressed, e.g. while the server asks the payer to wait. */
  disabled?: boolean;
  /**
   * False where Solana Pay can't be used: an accepted offer is paid through a
   * checkout bound to its token, and a Solana Pay request only names a position.
   */
  qr?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {wallets.map((w, i) => (
        <button
          key={w.name}
          type="button"
          className={i === 0 ? btnPrimary : btnSecondary}
          disabled={disabled}
          onClick={() => onWallet(w)}
        >
          Pay with {w.name}
        </button>
      ))}

      {qr && mobile && mobileLink && (
        // The same Solana Pay link the QR carries, for a wallet on this phone.
        <a
          href={disabled ? undefined : mobileLink}
          aria-disabled={disabled || undefined}
          className={`${wallets.length ? btnSecondary : btnPrimary}${disabled ? " pointer-events-none opacity-50" : ""}`}
          onClick={onMobileLink}
        >
          Open in my wallet app
        </a>
      )}

      {qr && (
        <button
          type="button"
          className={wallets.length || mobile ? btnSecondary : btnPrimary}
          disabled={disabled}
          onClick={onQr}
        >
          Pay with QR
        </button>
      )}

      {qr && wallets.length === 0 && !mobile && (
        <p className="text-tiny text-text-faint">
          No Solana wallet in this browser. Scan the QR with the wallet on your phone.
        </p>
      )}
      {!qr && wallets.length === 0 && (
        <p className="text-small text-text-muted">
          No Solana wallet in this browser. Open this page in Phantom, Solflare or Backpack, or pay on Base or Polygon.
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
