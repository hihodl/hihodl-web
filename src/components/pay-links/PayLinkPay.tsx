"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Check, ChainPicker, SolanaOptions, Spinner } from "@/components/ad-space/checkout-parts";
import { QrCode } from "@/components/ad-space/qr";
import { btnPrimary, btnSecondary, btnSmallSecondary, input } from "@/components/ad-space/ui";
import {
  CheckoutError,
  SPENT_KEY_CODES,
  checkoutId,
  checkoutKey,
  existingCheckoutKey,
  rotateCheckoutKey,
} from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL, timeLeft, usdFromCents } from "@/lib/ad-space/format";
import {
  type SolanaWallet,
  base64ToBytes,
  blockhashExpired,
  detectSolanaWallets,
  injected,
  isMobile,
  switchEvmChain,
  typedData,
} from "@/lib/ad-space/wallets";
import type { Chain } from "@/lib/ad-space/types";
import { PUBLIC_CHAINS } from "@/lib/orders/chains.public";
import {
  confirmPayment,
  currentPayment,
  describePayError,
  explorerTxUrl,
  payKeyScope,
  payLinkSolanaPay,
  receiptPath,
  startPayCheckout,
  submitPayAuthorization,
} from "@/lib/pay-links/client";
import type { PayLinkEvmPayload, PayLinkPayment, PayLinkPublic } from "@/lib/pay-links/types";

/**
 * Paying a pay link, from any wallet, with no HOLD account.
 *
 * The HiSpace checkout underneath, minus the fee: a Solana transfer signed by a
 * connected wallet or a phone wallet through Solana Pay, or ONE ERC-3009
 * authorization on Base or Polygon that our relayer submits. The server decides
 * when a payment is paid; this page only asks.
 *
 * Nothing touches a wallet until the payer presses a button that says so.
 */

const POLL_MS = 3_000;
const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

type Phase =
  | { kind: "loading" }
  | { kind: "choose" }
  | { kind: "busy"; label: string }
  | { kind: "qr"; link: string }
  | { kind: "evm-sign"; label: string; validBefore: number; sending: boolean }
  | { kind: "confirming"; payment: PayLinkPayment }
  | { kind: "paid"; payment: PayLinkPayment }
  | { kind: "duplicate"; payment: PayLinkPayment }
  | { kind: "lapsed" };

/** "150", "150.5", "1,500.00" to cents, or null. No floating point. */
export function parseCents(text: string): number | null {
  const t = text.trim().replace(/^\$/, "").replace(/,/g, "");
  const m = t.match(/^(\d{1,5})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

export function PayLinkPay({ link }: { link: PayLinkPublic }) {
  const router = useRouter();
  const scope = payKeyScope(link.code);
  const [chain, setChain] = useState<Chain>(link.chains.includes("solana") ? "solana" : link.chains[0]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [hasEvm, setHasEvm] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const keyRef = useRef("");
  const signatureRef = useRef<string | null>(null);

  const open = link.amount.mode === "open";
  const maxCents = link.amount.mode === "open" ? Math.min(link.amount.maxCents ?? MAX_CENTS, MAX_CENTS) : MAX_CENTS;
  const limits = { minCents: MIN_CENTS, maxCents };

  useEffect(() => {
    setWallets(detectSolanaWallets());
    setHasEvm(Boolean(injected().ethereum));
    setMobile(isMobile());
  }, []);

  /* Resume a payment this browser already started for this link. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = existingCheckoutKey(scope);
      keyRef.current = existing ?? checkoutKey(scope);
      if (existing) {
        try {
          const payment = await currentPayment(existing);
          if (cancelled) return;
          if (payment?.status === "paid") return setPhase({ kind: "paid", payment });
          if (payment?.status === "paid_duplicate") return setPhase({ kind: "duplicate", payment });
          if (payment?.status === "awaiting_payment") {
            setChain(payment.chain);
            return setPhase({ kind: "confirming", payment });
          }
          if (payment) keyRef.current = rotateCheckoutKey(scope);
        } catch {
          // Could not ask; a spent key is replaced on refusal.
        }
      }
      if (!cancelled) setPhase({ kind: "choose" });
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const ticking = phase.kind === "evm-sign";
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [ticking]);

  /* Confirm poll while a payment is on its way. */
  const confirmingId = phase.kind === "confirming" ? phase.payment.id : null;
  useEffect(() => {
    if (!confirmingId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const r = await confirmPayment(confirmingId, keyRef.current, signatureRef.current ?? undefined);
        if (stop) return;
        if (r.outcome === "paid") {
          setPhase({ kind: "paid", payment: r.payment });
          router.refresh();
          return;
        }
        if (r.outcome === "duplicate") return setPhase({ kind: "duplicate", payment: r.payment });
        if (r.outcome === "unpaid") return setPhase({ kind: "lapsed" });
      } catch (e) {
        if (stop) return;
        if (e instanceof CheckoutError && e.code === "rate_limited") wait = POLL_MS * 4;
        else if (e instanceof CheckoutError && e.code === "not_found") {
          setNotice(describePayError(e, null));
          return;
        }
      }
      if (!stop) timer = setTimeout(tick, wait);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [confirmingId, router]);

  /* QR poll: until the phone wallet has created the payment. */
  const waitingQr = phase.kind === "qr";
  useEffect(() => {
    if (!waitingQr) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const payment = await currentPayment(keyRef.current);
        if (stop) return;
        if (payment && payment.chain === "solana" && (payment.status === "awaiting_payment" || payment.status === "paid")) {
          signatureRef.current = null;
          setPhase({ kind: "confirming", payment });
          return;
        }
      } catch (e) {
        if (e instanceof CheckoutError && e.code === "rate_limited") wait = POLL_MS * 4;
      }
      if (!stop) timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [waitingQr]);

  /** The amount to send, or null after saying what is wrong with it. */
  function amountOrProblem(): { cents: number | undefined } | null {
    if (!open) return { cents: undefined };
    const cents = parseCents(amountText);
    if (cents === null) {
      setNotice("Type the amount in dollars, like 150 or 150.50.");
      return null;
    }
    if (cents < MIN_CENTS || cents > maxCents) {
      setNotice(`The amount has to be between ${usdFromCents(MIN_CENTS)} and ${usdFromCents(maxCents)}.`);
      return null;
    }
    return { cents };
  }

  const withFreshKey = useCallback(
    async <T,>(run: (key: string) => Promise<T>): Promise<T> => {
      try {
        return await run(keyRef.current);
      } catch (e) {
        if (!(e instanceof CheckoutError) || !SPENT_KEY_CODES.has(e.code)) throw e;
        keyRef.current = rotateCheckoutKey(scope);
        return run(keyRef.current);
      }
    },
    [scope],
  );

  async function payWithSolanaWallet(wallet: SolanaWallet) {
    setNotice(null);
    const amount = amountOrProblem();
    if (!amount) return;
    try {
      setPhase({ kind: "busy", label: `Connecting ${wallet.name}…` });
      const connected = (await wallet.provider.connect()) as { publicKey?: { toString(): string } } | undefined;
      const payerAddress = (connected?.publicKey ?? wallet.provider.publicKey)?.toString();
      if (!payerAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: "Preparing the payment…" });
      const checkout = async () => {
        const res = await withFreshKey((key) =>
          startPayCheckout(link.code, key, { chain: "solana", payerAddress, ...(amount.cents ? { amountCents: amount.cents } : {}) }),
        );
        if (!("solana" in res)) throw new CheckoutError("server", 500);
        return res;
      };
      let [res, web3] = await Promise.all([checkout(), import("@solana/web3.js")]);

      setPhase({ kind: "busy", label: `Approve the payment in ${wallet.name}…` });
      let sent: unknown;
      try {
        sent = await wallet.provider.signAndSendTransaction(
          web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.transaction)),
        );
      } catch (e) {
        if (!blockhashExpired(e)) throw e;
        setPhase({ kind: "busy", label: `That took a while, so here is a fresh one. Approve it in ${wallet.name}…` });
        res = await checkout();
        sent = await wallet.provider.signAndSendTransaction(
          web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.transaction)),
        );
      }
      const signature = typeof sent === "string" ? sent : (sent as { signature?: string })?.signature;
      if (!signature) throw new Error("no_signature");
      signatureRef.current = signature;
      setPhase({ kind: "confirming", payment: res.payment });
    } catch (e) {
      setNotice(describePayError(e, "solana", limits));
      setPhase({ kind: "choose" });
    }
  }

  async function startQr() {
    setNotice(null);
    const amount = amountOrProblem();
    if (!amount) return;
    const c = await checkoutId(keyRef.current);
    setPhase({ kind: "qr", link: payLinkSolanaPay(link.code, c, amount.cents ?? null) });
  }

  async function payWithEvm(evmChain: "base" | "polygon") {
    setNotice(null);
    const amount = amountOrProblem();
    if (!amount) return;
    const provider = injected().ethereum;
    if (!provider) {
      setNotice("No browser wallet found. Open this page in MetaMask, Coinbase Wallet or Rabby, or pay another way.");
      return;
    }
    const meta = PUBLIC_CHAINS[evmChain];
    try {
      setPhase({ kind: "busy", label: "Connecting your wallet…" });
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const payerAddress = accounts?.[0];
      if (!payerAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: `Switching your wallet to ${meta.label}…` });
      await switchEvmChain(provider, meta);

      setPhase({ kind: "busy", label: "Preparing the payment…" });
      const res = await withFreshKey((key) =>
        startPayCheckout(link.code, key, { chain: evmChain, payerAddress, ...(amount.cents ? { amountCents: amount.cents } : {}) }),
      );
      if (!("evm" in res)) throw new CheckoutError("server", 500);
      const evm: PayLinkEvmPayload = res.evm;
      const auth = evm.authorizations[0];
      if (!auth || evm.authorizations.length !== 1) throw new CheckoutError("server", 500);

      setPhase({ kind: "evm-sign", label: auth.label, validBefore: evm.validBefore, sending: false });
      const signature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [payerAddress, typedData(evm, auth.message)],
      })) as string;

      setPhase({ kind: "evm-sign", label: auth.label, validBefore: evm.validBefore, sending: true });
      const submitted = await submitPayAuthorization(res.payment.id, keyRef.current, signature);
      signatureRef.current = null;
      setPhase({ kind: "confirming", payment: submitted.payment });
    } catch (e) {
      setNotice(describePayError(e, evmChain, limits));
      setPhase({ kind: "choose" });
    }
  }

  function payAgain() {
    keyRef.current = rotateCheckoutKey(scope);
    signatureRef.current = null;
    setNotice(null);
    setAmountText("");
    setPhase({ kind: "choose" });
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  // A link that takes no more payments still shows this browser its own
  // payment (and its receipt), and nothing else.
  const canPay = link.status === "active";
  if (!canPay && (phase.kind === "loading" || phase.kind === "choose" || phase.kind === "lapsed")) return null;

  if (phase.kind === "paid") {
    return <Paid payment={phase.payment} link={link} onPayAgain={link.status === "active" ? payAgain : null} />;
  }

  if (phase.kind === "duplicate") {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-h4 font-light text-text">Someone else paid this link first.</h2>
        <p className="text-small text-text-muted">
          This link takes one payment, and another one arrived a moment before yours. {link.owner.displayName} has been
          told. Contact them with your transaction to sort it out; HOLD can&rsquo;t reverse a payment.
        </p>
        {phase.payment.txHash && (
          <div>
            <a
              href={explorerTxUrl(phase.payment.chain, phase.payment.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSmallSecondary}
            >
              View the transaction
            </a>
          </div>
        )}
      </div>
    );
  }

  if (phase.kind === "lapsed") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-h4 font-light text-text">No payment arrived.</h2>
        <p className="text-small text-text-muted">Nothing left your wallet. Start again when you&rsquo;re ready.</p>
        <div>
          <button type="button" className={btnPrimary} onClick={payAgain}>
            Start again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {phase.kind === "loading" && <p className="text-small text-text-muted">One moment…</p>}

      {phase.kind === "busy" && (
        <p className="flex items-center gap-3 text-small text-text" role="status">
          <Spinner />
          {phase.label}
        </p>
      )}

      {phase.kind === "choose" && (
        <>
          {open && (
            <label className="flex flex-col gap-2">
              <span className="text-small text-text-muted">Amount in US dollars (USDC)</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-text-muted">$</span>
                <input
                  className={`${input} pl-8 font-mono`}
                  value={amountText}
                  onChange={(e) => {
                    setAmountText(e.target.value);
                    setNotice(null);
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  aria-describedby="amount-limits"
                />
              </span>
              <span id="amount-limits" className="text-tiny text-text-faint">
                From {usdFromCents(MIN_CENTS)} to {usdFromCents(maxCents)}.
              </span>
            </label>
          )}

          {link.chains.length > 1 && (
            <ChainPicker
              chains={link.chains}
              chain={chain}
              onChange={(c) => {
                setChain(c);
                setNotice(null);
              }}
            />
          )}

          {chain === "solana" ? (
            <SolanaOptions
              wallets={wallets}
              mobile={mobile}
              // The phone link needs the amount first, so on mobile it goes through the QR step.
              mobileLink={null}
              onWallet={(w) => void payWithSolanaWallet(w)}
              onQr={() => void startQr()}
              onMobileLink={() => void startQr()}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-small text-text-muted">
                One signature, no gas. The whole amount goes to {link.owner.displayName}; HOLD takes nothing.
              </p>
              {!hasEvm && (
                <p className="text-small text-amber">
                  No browser wallet found here. Open this page in MetaMask, Coinbase Wallet or Rabby
                  {link.chains.includes("solana") ? ", or pay on Solana by QR" : ""}.
                </p>
              )}
              <div>
                <button type="button" className={btnPrimary} disabled={!hasEvm} onClick={() => void payWithEvm(chain)}>
                  Connect wallet and pay
                </button>
              </div>
            </div>
          )}

          <p className="text-tiny leading-relaxed text-text-faint">
            You pay {link.owner.displayName} directly, in USDC on {CHAIN_LABEL[chain]}. HOLD never holds the money,
            charges no fee and can&rsquo;t reverse the payment.
          </p>
        </>
      )}

      {phase.kind === "qr" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-full max-w-[240px] rounded-card bg-white p-3">
            <QrCode text={phase.link} title="Solana Pay QR code" className="h-auto w-full" />
          </div>
          <p className="text-small text-text-muted">
            Scan with Phantom, Solflare or any Solana wallet. It shows the exact amount before you approve.
          </p>
          {mobile && (
            <a href={phase.link} className={btnSecondary}>
              Open in my wallet
            </a>
          )}
          <p className="flex items-center gap-3 text-small text-text-faint" role="status">
            <Spinner />
            Waiting for your wallet…
          </p>
          <button type="button" className={btnSmallSecondary} onClick={() => setPhase({ kind: "choose" })}>
            Back
          </button>
        </div>
      )}

      {phase.kind === "evm-sign" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-input border border-amber/50 px-4 py-3 text-small text-text">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] text-tiny ${
                phase.sending ? "bg-success/20 text-success" : "bg-amber text-text-on-amber"
              }`}
              aria-hidden
            >
              {phase.sending ? <Check /> : 1}
            </span>
            <span className="min-w-0 flex-1 break-words">{phase.label}</span>
            {!phase.sending && <span className="text-tiny text-amber">Sign in your wallet</span>}
          </div>
          {phase.sending ? (
            <p className="flex items-center gap-3 text-small text-text" role="status">
              <Spinner />
              Sending the payment…
            </p>
          ) : phase.validBefore * 1000 > now ? (
            <p className="text-tiny text-text-faint">
              Sign within <span className="font-mono text-text-muted">{timeLeft(phase.validBefore * 1000 - now)}</span>.
            </p>
          ) : (
            <p className="text-tiny text-amber">This signature request has expired. Close your wallet and start again.</p>
          )}
        </div>
      )}

      {phase.kind === "confirming" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-body text-text" role="status">
            <Spinner />
            Confirming your payment on {CHAIN_LABEL[phase.payment.chain]}…
          </p>
          <p className="text-small text-text-muted">This page updates on its own.</p>
        </div>
      )}

      {notice && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

function Paid({
  payment,
  link,
  onPayAgain,
}: {
  payment: PayLinkPayment;
  link: PayLinkPublic;
  onPayAgain: (() => void) | null;
}) {
  const receipt = receiptPath(payment.receiptUrl);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-tiny uppercase tracking-wider text-success">Paid</p>
        <h2 className="mt-2 font-display text-h3 font-light text-text">
          {usdFromCents(payment.amountCents)} sent to {link.owner.displayName}.
        </h2>
        <p className="mt-2 text-small text-text-muted">In USDC on {CHAIN_LABEL[payment.chain]}.</p>
      </div>
      {receipt && (
        <div className="flex flex-col gap-2 rounded-card border border-[color:var(--color-hairline-strong)] bg-white/[0.03] p-4">
          <p className="text-small text-text">Keep your receipt.</p>
          <p className="text-small text-text-muted">
            Its link shows the amount, the network, the transaction and the time. Save it: you have no account here to
            find it in later.
          </p>
          <div>
            <Link href={receipt} className={btnSmallSecondary}>
              Open the receipt
            </Link>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {payment.txHash && (
          <a
            href={explorerTxUrl(payment.chain, payment.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className={btnSmallSecondary}
          >
            View the transaction
          </a>
        )}
        {onPayAgain && (
          <button type="button" className={btnSmallSecondary} onClick={onPayAgain}>
            Make another payment
          </button>
        )}
      </div>
    </div>
  );
}
