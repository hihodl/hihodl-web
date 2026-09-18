/**
 * Where you get paid.
 *
 * THE RULE, WHICH IS THE WHOLE OF IT
 *
 * HOLD wins whenever HOLD exists. A creator with a HOLD wallet is paid there,
 * from the web as much as from the app, whatever else they once proved. So
 * when `source` is `"hold"` this card shows the address and offers nothing to
 * change: a button that looked like it could change it would be a lie, and the
 * creator would find that out at the worst possible moment — after a sponsor
 * paid.
 *
 * WHY A SIGNATURE AND NOT A TEXT BOX
 *
 * Two failures, one mechanism. A typo sends every sponsor's money to an
 * address nobody can open, for ever; and a text box would let somebody name a
 * stranger's address, or ours. Signing costs nothing, needs no balance, moves
 * nothing and cannot be done by anyone but the key's owner.
 *
 * Being asked to sign is where people get scared, so the card says that out
 * loud, twice, and shows the exact words the wallet is about to display — the
 * server writes them (`payoutMessage`) and one byte off is a refusal, so they
 * are quoted, never rebuilt here.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { btnPrimary, btnSmall, btnSmallSecondary, card } from "@/components/ad-space/ui";
import {
  CreatorApiError,
  declarePayoutAddress,
  describeCreatorError,
  getPayoutAddress,
  requestPayoutChallenge,
} from "@/lib/creator/api";
import type { PayoutAddressView, PayoutChain } from "@/lib/creator/types";
import {
  connectEvm,
  connectSolana,
  describeWalletError,
  signEvmMessage,
  signSolanaMessage,
} from "@/lib/creator/wallets";

import { Address, Loading, Notice, Section, Status } from "./parts";

interface ChainCopy {
  chain: PayoutChain;
  /** What a creator calls it, which is not what the column calls it. */
  title: string;
  networks: string;
  wallet: string;
}

const CHAINS: readonly ChainCopy[] = [
  { chain: "solana", title: "Solana", networks: "Solana", wallet: "Phantom" },
  { chain: "evm", title: "Base and Polygon", networks: "Base, Polygon and Ethereum", wallet: "MetaMask" },
];

export function PayoutAddress({ onChange }: { onChange?: (view: PayoutAddressView | null) => void }) {
  const [view, setView] = useState<PayoutAddressView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await getPayoutAddress();
      setView(next);
      setError(null);
      onChange?.(next);
    } catch (e) {
      setError(describeCreatorError(e));
      onChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Section label="Step two" title="Payout wallet">
      <p className="text-tiny text-text-muted">Sponsors pay this address directly.</p>

      {loading ? (
        <div className="mt-6">
          <Loading what="your addresses" />
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col gap-4">
          <Notice>{error}</Notice>
          <div>
            <button type="button" className={btnSmallSecondary} onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {CHAINS.map((copy) => (
            <ChainCard key={copy.chain} copy={copy} view={view} onDeclared={setView} onDone={load} />
          ))}
        </div>
      )}
    </Section>
  );
}

type Step = "idle" | "connected" | "challenged";

function ChainCard({
  copy,
  view,
  onDeclared,
  onDone,
}: {
  copy: ChainCopy;
  view: PayoutAddressView | null;
  onDeclared: (view: PayoutAddressView) => void;
  onDone: () => Promise<void> | void;
}) {
  const entry = view ? view[copy.chain] : { address: null, source: null };
  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ nonce: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setAddress(null);
    setChallenge(null);
    setNotice(null);
  }

  /** Whatever goes wrong, the creator is told which of the two sides said so. */
  function failed(e: unknown) {
    setNotice(e instanceof CreatorApiError ? describeCreatorError(e) : describeWalletError(e));
  }

  async function connect() {
    setBusy(true);
    setNotice(null);
    try {
      const next = copy.chain === "solana" ? await connectSolana() : await connectEvm();
      setAddress(next);
      setStep("connected");
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  /** Ask the server for the words. They carry the address and a one-trip nonce,
   *  so a signature collected anywhere else cannot be presented here. */
  async function ask() {
    if (!address) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await requestPayoutChallenge(copy.chain, address);
      setChallenge({ nonce: next.nonce, message: next.message });
      setStep("challenged");
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!address || !challenge) return;
    setBusy(true);
    setNotice(null);
    try {
      const signature =
        copy.chain === "solana"
          ? await signSolanaMessage(challenge.message)
          : await signEvmMessage(address, challenge.message);
      onDeclared(await declarePayoutAddress({ chain: copy.chain, address, nonce: challenge.nonce, signature }));
      reset();
      await onDone();
    } catch (e) {
      failed(e);
      // The nonce is spent by the attempt whether or not the signature held,
      // so there is nothing to retry: the next go starts from a new challenge.
      if (e instanceof CreatorApiError) {
        setChallenge(null);
        setStep("connected");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-body text-text">{copy.title}</p>
          <p className="text-tiny text-text-faint">{copy.networks}</p>
        </div>
        <Status state={entry.address ? "done" : "todo"}>
          {entry.source === "hold" ? "Your HOLD wallet" : entry.address ? "Proved" : "Nothing yet"}
        </Status>
      </div>

      {entry.address ? (
        <div className="mt-4 flex flex-col gap-3">
          <Address value={entry.address} />
          {entry.source === "hold" ? (
            <p className="text-small text-text-muted">Your HOLD wallet.</p>
          ) : (
            <p className="text-small text-text-muted">Proved by signature. A HOLD wallet, if you add one, takes over.</p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {step === "idle" ? (
            <>
              <p className="text-small text-text-muted">Connect, then sign one message. No fee, no transaction.</p>
              <div>
                <button type="button" className={btnSmall} disabled={busy} onClick={() => void connect()}>
                  {busy ? "Waiting for your wallet…" : `Connect ${copy.wallet}`}
                </button>
              </div>
            </>
          ) : null}

          {step === "connected" && address ? (
            <>
              <Address value={address} />
              <p className="text-small text-text-muted">Signing moves no money and costs no fee.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => void ask()}>
                  {busy ? "Preparing…" : "Show me what I sign"}
                </button>
                <button type="button" className={btnSmallSecondary} disabled={busy} onClick={reset}>
                  Use another wallet
                </button>
              </div>
            </>
          ) : null}

          {step === "challenged" && challenge ? (
            <>
              <p className="text-small text-text-muted">
                This is exactly what your wallet will show you. Read it, then approve it there.
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-input border border-[color:var(--color-hairline-strong)] bg-white/[0.04] px-4 py-3 font-mono text-tiny text-text-muted">
                {challenge.message}
              </pre>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => void sign()}>
                  {busy ? "Waiting for your wallet…" : `Sign in ${copy.wallet}`}
                </button>
                <button type="button" className={btnSmallSecondary} disabled={busy} onClick={reset}>
                  Not now
                </button>
              </div>
            </>
          ) : null}

          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </div>
  );
}
