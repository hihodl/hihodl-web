"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { FOUNDER_PASS } from "@/lib/rates.config";
import {
  PUBLIC_CHAINS,
  encodeErc20Transfer,
  toBaseUnits,
  type PublicChain,
} from "@/lib/orders/chains.public";

/**
 * Founder Pass checkout — three rails, one order.
 *
 * The rails differ only in how money arrives. The order underneath is the same
 * row in the same table with the same state machine, and in every case the
 * server decides when it is paid: an RPC node's logs for the on-chain rails, a
 * signed Stripe webhook for the card. Nothing this component does can settle an
 * order, which is why it is safe for it to be this chatty.
 *
 * "Pay with HOLD" is deliberately NOT a deep link into the app. No prefilled
 * send, no in-app purchase flow — a QR and an address, scanned with whatever
 * wallet the buyer already uses. An in-app purchase flow would put a price tag
 * inside a mobile app, and that is a conversation with two app stores that we
 * are not having over a $99 pass.
 *
 * No red anywhere, including on failures. Problems are amber and are phrased as
 * what to do next.
 */

type Rail = "stripe" | "external_wallet" | "onchain_transfer";
type ChainKey = "base" | "polygon";

interface PublicOrder {
  reference: string;
  state: "created" | "awaiting_payment" | "confirming" | "expired" | "paid" | "refunded";
  rail: Rail;
  priceUsd: number;
  earlyPrice: boolean;
  chain: string | null;
  chainLabel: string | null;
  token: string | null;
  amount: string | null;
  receivingAddress: string | null;
  expiresAt: string;
  secondsRemaining: number;
  confirmations: number;
  minConfirmations: number | null;
  txHash: string | null;
  explorerUrl: string | null;
  seatNumber: number | null;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
  }
}

export function Checkout() {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rail, setRail] = useState<Rail>("stripe");
  const [chain, setChain] = useState<ChainKey>("base");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Resume an order from the URL — the Stripe return trip lands here, and so
  // does anyone who refreshed the page mid-payment.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const ref = new URLSearchParams(window.location.search).get("order");
    if (ref) void refresh(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (reference: string) => {
    try {
      const res = await fetch(`/api/founders/orders/${reference}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { order: PublicOrder; qrSvg: string | null };
      setOrder(data.order);
      setQrSvg(data.qrSvg);
    } catch {
      // A dropped poll is not an event. The next tick tries again.
    }
  }, []);

  // Poll while the order can still change, and tick the countdown every second.
  //
  // `expired` is in the polling set on purpose. A transfer that lands just after
  // the quote lapsed still settles server-side, so we keep watching — at a
  // slower cadence — rather than leaving somebody who paid staring at an expiry
  // notice. `paid` and `refunded` are terminal and stop everything.
  const pollEvery =
    order?.state === "awaiting_payment" || order?.state === "confirming"
      ? 5_000
      : order?.state === "expired"
        ? 15_000
        : null;

  useEffect(() => {
    if (!order || pollEvery === null) return;
    const poll = setInterval(() => void refresh(order.reference), pollEvery);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [order, pollEvery, refresh]);

  const secondsLeft = order
    ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
    : 0;

  async function startOrder() {
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/founders/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rail, chain }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(
          data?.message ??
            (data?.error === "sold_out"
              ? "All 500 seats are taken."
              : "We could not start your order. Try again."),
        );
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }

      setOrder(data.order as PublicOrder);
      // Ask once immediately so the QR is there before the first poll.
      void refresh((data.order as PublicOrder).reference);
    } catch {
      setNotice("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setOrder(null);
    setQrSvg(null);
    setNotice(null);
    window.history.replaceState({}, "", "/founders/checkout");
  }

  /* ── Settled ─────────────────────────────────────────────────── */
  if (order?.state === "paid") {
    return (
      <Panel>
        <p className="text-tiny uppercase tracking-wider text-amber">Confirmed</p>
        <h1 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
          You are founder
          <br />
          <span className="text-amber tabular-nums">
            number {order.seatNumber}.
          </span>
        </h1>
        <p className="mt-8 text-lead text-text-muted max-w-xl">
          Your terms are fixed from today. Your receipt is on its way to your email; the
          founders room invite follows separately.
        </p>
        <dl className="mt-10 flex flex-col gap-3 max-w-md">
          <Row label="Founder number" value={`#${order.seatNumber}`} />
          <Row label="Paid" value={`$${order.priceUsd}`} />
          <Row label="Order" value={order.reference} mono />
          {order.explorerUrl && (
            <div className="flex items-center justify-between gap-6 py-3 border-b border-[color:var(--color-hairline)]">
              <dt className="text-small text-text-faint">Transaction</dt>
              <dd>
                <a
                  href={order.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-small text-amber hover:underline"
                >
                  View receipt
                </a>
              </dd>
            </div>
          )}
        </dl>
        <Link
          href="/founders"
          className="mt-12 inline-flex items-center justify-center px-7 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-body hover:bg-white/5 transition-colors duration-180"
        >
          Back to the Founder Pass
        </Link>
      </Panel>
    );
  }

  /* ── Expired ─────────────────────────────────────────────────── */
  if (order?.state === "expired") {
    return (
      <Panel>
        <p className="text-tiny uppercase tracking-wider text-amber">Quote expired</p>
        <h1 className="mt-6 font-display text-h2 font-light text-text leading-tight">
          That address is closed.
        </h1>
        <p className="mt-8 text-lead text-text-muted max-w-xl">
          Quotes hold for {FOUNDER_PASS.quoteValidMinutes} minutes. Starting again issues a
          brand new address — we never reuse one, so the old address is retired for good.
        </p>
        <p className="mt-6 text-small text-text-faint max-w-xl">
          If you sent money to it anyway, email hello@hihodl.xyz with your order reference{" "}
          <span className="font-mono text-text-muted">{order.reference}</span> and we will
          sort it out by hand.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="mt-12 inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft"
        >
          Start again
        </button>
      </Panel>
    );
  }

  /* ── Waiting for an on-chain payment ─────────────────────────── */
  if (order && order.chain && order.receivingAddress && order.amount) {
    return (
      <PayOnChain
        order={order}
        qrSvg={qrSvg}
        secondsLeft={secondsLeft}
        notice={notice}
        setNotice={setNotice}
        onStartOver={startOver}
      />
    );
  }

  /* ── Step one ────────────────────────────────────────────────── */
  return (
    <Panel>
      <p className="text-tiny uppercase tracking-wider text-moonlight">Founder Pass</p>
      <h1 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
        One payment.
        <br />
        <span className="text-text-muted">Then it is yours.</span>
      </h1>

      <form
        className="mt-12 flex flex-col gap-10 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          void startOrder();
        }}
      >
        <div className="flex flex-col gap-3">
          <label htmlFor="founder-email" className="text-small text-text-muted">
            Where should the pass go?
          </label>
          <input
            id="founder-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-input bg-white/[0.04] border border-[color:var(--color-hairline-strong)] px-5 py-4 text-body text-text placeholder:text-text-faint outline-none focus:border-amber/60 transition-colors duration-180"
          />
          <p className="text-tiny text-text-faint">
            Your receipt, your founder number and the founders room invite go here.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-small text-text-muted mb-3">How do you want to pay?</legend>

          <RailOption
            id="stripe"
            selected={rail === "stripe"}
            onSelect={() => setRail("stripe")}
            title="Card"
            body="Visa, Mastercard or Amex. Handled by Stripe — we never see your card number."
          />
          <RailOption
            id="external_wallet"
            selected={rail === "external_wallet"}
            onSelect={() => setRail("external_wallet")}
            title="Connect a wallet"
            body="MetaMask or Phantom. Approve one transfer and the pass confirms itself."
          />
          <RailOption
            id="onchain_transfer"
            selected={rail === "onchain_transfer"}
            onSelect={() => setRail("onchain_transfer")}
            title="Send dollars yourself"
            body="We show a QR code and an address. Send from any wallet you already use."
          />
        </fieldset>

        {rail !== "stripe" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-small text-text-muted mb-3">Which network?</legend>
            <div className="flex gap-3">
              {(["base", "polygon"] as ChainKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChain(key)}
                  className={`px-5 py-3 rounded-pill text-small font-medium transition-all duration-180 ${
                    chain === key
                      ? "bg-amber text-text-on-amber"
                      : "border border-[color:var(--color-hairline-strong)] text-text-muted hover:text-text hover:bg-white/5"
                  }`}
                >
                  {PUBLIC_CHAINS[key].label}
                </button>
              ))}
            </div>
            <p className="text-tiny text-text-faint">
              Pick the one your dollars are already on. Both settle the same pass.
            </p>
          </fieldset>
        )}

        {notice && <Notice>{notice}</Notice>}

        <div>
          <button
            type="submit"
            disabled={busy || email.trim().length === 0}
            className="inline-flex items-center justify-center px-8 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {busy ? "One moment…" : "Continue"}
          </button>
          <p className="mt-6 text-small text-text-faint max-w-md">
            Full refund if the card has not shipped within {FOUNDER_PASS.refundWindowMonths}{" "}
            months. One-time price, nothing recurring.
          </p>
        </div>
      </form>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════ */

function PayOnChain({
  order,
  qrSvg,
  secondsLeft,
  notice,
  setNotice,
  onStartOver,
}: {
  order: PublicOrder;
  qrSvg: string | null;
  secondsLeft: number;
  notice: string | null;
  setNotice: (s: string | null) => void;
  onStartOver: () => void;
}) {
  const chain = PUBLIC_CHAINS[order.chain as ChainKey];
  const confirming = order.state === "confirming";

  return (
    <Panel>
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <p className="text-tiny uppercase tracking-wider text-moonlight">
          {confirming ? "Payment received" : "Waiting for your payment"}
        </p>
        {!confirming && <Countdown seconds={secondsLeft} />}
      </div>

      <h1 className="mt-6 font-display text-h2 font-light text-text leading-tight">
        {confirming ? (
          <>
            Confirming on {chain.label}.
            <br />
            <span className="text-text-muted">Nearly there.</span>
          </>
        ) : (
          <>
            Send{" "}
            <span className="text-amber font-mono tabular-nums">
              {order.amount} {order.token}
            </span>
            <br />
            <span className="text-text-muted">on {chain.label}.</span>
          </>
        )}
      </h1>

      {confirming ? (
        <div className="mt-10 max-w-xl">
          <p className="text-lead text-text-muted">
            Your transfer is on the network. We are waiting for{" "}
            <span className="tabular-nums">{order.minConfirmations}</span> confirmations
            before the seat is yours — currently{" "}
            <span className="text-text tabular-nums">{order.confirmations}</span>.
          </p>
          <div className="mt-8 h-1 rounded-pill bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-amber transition-all duration-900 ease-out-soft"
              style={{
                width: `${Math.min(100, ((order.confirmations || 0) / (order.minConfirmations || 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-6 text-small text-text-faint">
            You can close this page. The seat is held and the receipt goes to your email.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10 items-start">
            {qrSvg && (
              <div className="rounded-card bg-text p-4 w-[200px] shrink-0">
                <div
                  className="w-full [&>svg]:w-full [&>svg]:h-auto"
                  // The SVG is generated by our own server from this order's
                  // address and never contains anything a user supplied.
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              </div>
            )}

            <div className="flex flex-col gap-4 min-w-0">
              <CopyField label="Amount" value={`${order.amount}`} suffix={order.token ?? ""} />
              <CopyField label="Address" value={order.receivingAddress ?? ""} mono breakAll />
              <div className="flex items-center justify-between gap-6 py-3 border-b border-[color:var(--color-hairline)]">
                <span className="text-small text-text-faint">Network</span>
                <span className="text-small text-text">{chain.label}</span>
              </div>
              <div className="flex items-center justify-between gap-6 py-3 border-b border-[color:var(--color-hairline)]">
                <span className="text-small text-text-faint">Order</span>
                <span className="text-small font-mono text-text-muted">{order.reference}</span>
              </div>
            </div>
          </div>

          {order.rail === "external_wallet" && (
            <WalletPay order={order} chain={chain} setNotice={setNotice} />
          )}

          <div className="mt-10 rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-6 max-w-2xl">
            <p className="text-small text-text-muted leading-relaxed">
              This address was created for your order and will never be used again. Send{" "}
              {order.token} on {chain.label} only — a transfer on another network will not
              arrive here. We confirm it automatically; there is nothing to paste back.
            </p>
          </div>
        </>
      )}

      {notice && <Notice className="mt-8">{notice}</Notice>}

      <button
        type="button"
        onClick={onStartOver}
        className="mt-10 text-small text-text-faint hover:text-text-muted transition-colors duration-180 underline"
      >
        Start a different order
      </button>
    </Panel>
  );
}

/**
 * Connect-and-pay for MetaMask and Phantom.
 *
 * Straight EIP-1193 — no wallet SDK, no connector library, no ABI encoder. The
 * whole interaction is four calls: pick the provider, request accounts, make
 * sure it is on the right chain, send one ERC-20 transfer. Everything after
 * that is the same polling the QR rail uses, because the server confirms the
 * payment either way.
 */
function WalletPay({
  order,
  chain,
  setNotice,
}: {
  order: PublicOrder;
  chain: PublicChain;
  setNotice: (s: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function pickProvider(preferred: "metamask" | "phantom"): Eip1193Provider | null {
    if (typeof window === "undefined") return null;

    if (preferred === "phantom" && window.phantom?.ethereum) return window.phantom.ethereum;

    const injected = window.ethereum;
    if (!injected) return null;
    // Several extensions installed side by side expose themselves in an array.
    if (injected.providers?.length) {
      const match = injected.providers.find((p) =>
        preferred === "metamask" ? p.isMetaMask : !p.isMetaMask,
      );
      if (match) return match;
    }
    return injected;
  }

  async function pay(preferred: "metamask" | "phantom") {
    setNotice(null);
    const provider = pickProvider(preferred);

    if (!provider) {
      setNotice(
        `We could not find ${preferred === "metamask" ? "MetaMask" : "Phantom"} in this browser. Send the amount above from any wallet instead — the QR works everywhere.`,
      );
      return;
    }

    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const from = accounts?.[0];
      if (!from) throw new Error("no_account");

      // Wrong network is the most common failure, so handle it rather than
      // letting the transfer land on a chain we are not watching.
      const current = (await provider.request({ method: "eth_chainId" })) as string;
      if (current?.toLowerCase() !== chain.chainIdHex.toLowerCase()) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chain.chainIdHex }],
          });
        } catch (switchError) {
          // 4902 = the wallet does not know this chain yet.
          if ((switchError as { code?: number })?.code === 4902) {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [{ chainId: chain.chainIdHex, ...chain.addChainParams }],
            });
          } else {
            throw switchError;
          }
        }
      }

      const amount = toBaseUnits(order.amount ?? "0", chain.usdcDecimals);
      const data = encodeErc20Transfer(order.receivingAddress ?? "", amount);

      await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: chain.usdc, data, value: "0x0" }],
      });

      setSent(true);
      setNotice(
        "Sent. We are watching for it now — this page updates on its own, no need to refresh.",
      );
    } catch (e) {
      const code = (e as { code?: number })?.code;
      setNotice(
        code === 4001
          ? "You cancelled the transfer. The address above is still good for the rest of the quote."
          : "That did not go through. You can try again, or send the amount above from any wallet.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-4">
      <p className="text-small text-text-muted">Or approve it from your wallet:</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || sent}
          onClick={() => void pay("metamask")}
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-pill bg-amber text-text-on-amber font-medium text-small hover:bg-amber-glow transition-all duration-180 ease-out-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Check your wallet…" : "Pay with MetaMask"}
        </button>
        <button
          type="button"
          disabled={busy || sent}
          onClick={() => void pay("phantom")}
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-small hover:bg-white/5 transition-colors duration-180 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Pay with Phantom
        </button>
      </div>
    </div>
  );
}

/* ── Small pieces ────────────────────────────────────────────── */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-night min-h-[70vh]">
      <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
      <div className="container-page section relative">{children}</div>
    </section>
  );
}

function RailOption({
  id,
  selected,
  onSelect,
  title,
  body,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <label
      htmlFor={`rail-${id}`}
      className={`cursor-pointer rounded-card border p-5 flex items-start gap-4 transition-all duration-180 ${
        selected
          ? "border-amber/50 bg-amber/[0.05]"
          : "border-[color:var(--color-hairline)] bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <input
        id={`rail-${id}`}
        type="radio"
        name="rail"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={`mt-1.5 w-3 h-3 rounded-full shrink-0 border transition-colors duration-180 ${
          selected ? "bg-amber border-amber" : "border-[color:var(--color-hairline-strong)]"
        }`}
        aria-hidden
      />
      <span className="flex flex-col gap-1.5">
        <span className="text-body text-text">{title}</span>
        <span className="text-small text-text-muted">{body}</span>
      </span>
    </label>
  );
}

function CopyField({
  label,
  value,
  suffix,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  suffix?: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[color:var(--color-hairline)] min-w-0">
      <span className="text-small text-text-faint shrink-0 pt-0.5">{label}</span>
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={`text-small text-text text-right min-w-0 ${mono ? "font-mono" : ""} ${
            breakAll ? "break-all" : "tabular-nums"
          }`}
        >
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 text-tiny uppercase tracking-wider text-text-faint hover:text-amber transition-colors duration-180"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const mm = Math.floor(seconds / 60).toString();
  const ss = (seconds % 60).toString().padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-[color:var(--color-hairline-strong)] bg-white/[0.04]">
      <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden />
      <span className="text-small font-mono tabular-nums text-text-muted">
        {mm}:{ss} left
      </span>
    </span>
  );
}

function Notice({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Amber, never red. A payment that needs another go is not an emergency.
  return (
    <p
      className={`rounded-card border border-amber/30 bg-amber/[0.05] px-5 py-4 text-small text-text-muted ${className}`}
      role="status"
    >
      {children}
    </p>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-b border-[color:var(--color-hairline)]">
      <dt className="text-small text-text-faint">{label}</dt>
      <dd className={`text-small text-text ${mono ? "font-mono" : "tabular-nums"}`}>{value}</dd>
    </div>
  );
}
