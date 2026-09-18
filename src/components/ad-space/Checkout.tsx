"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckoutError,
  SPENT_KEY_CODES,
  checkoutId,
  checkoutKey,
  confirmOrder,
  currentCheckout,
  describeAuthorizationRefusal,
  describeError,
  existingCheckoutKey,
  rememberManageToken,
  rotateCheckoutKey,
  solanaPayLink,
  startCheckout,
  submitAuthorizations,
} from "@/lib/ad-space/checkout-client";
import { TAKEOVER_CHAINS } from "@/lib/ad-space/config";
import {
  CHAIN_LABEL,
  CONTENT_KIND_LABEL,
  FALLBACK_LABEL,
  FALLBACK_TEXT,
  SESSION_FALLBACK_TEXT,
  isSessionSpace,
  timeLeft,
} from "@/lib/ad-space/format";
import { describeOfferError, offerSolanaPayLink, startOfferCheckout } from "@/lib/ad-space/offers-client";
import { earnPointsLine, pointsForOfferAmount, pointsForPosition, pointsWorth } from "@/lib/ad-space/points";
import { PUBLIC_CHAINS } from "@/lib/orders/chains.public";
import type { Booking, Chain, EvmPayload, OfferView, Order, Position, Space } from "@/lib/ad-space/types";

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

import { AppPrompt } from "./AppPrompt";
import { Check, ChainPicker, SolanaOptions, Spinner } from "./checkout-parts";
import { QrCode } from "./qr";
import { ManageLinkBox, SessionContactForm } from "./SessionBooking";
import { SponsorContentForm } from "./SponsorContentForm";
import { btnPrimary, btnSecondary, btnSmallSecondary, eyebrow } from "./ui";

/**
 * Paying for one spot from the public page, with no HOLD account.
 *
 * Three ways in, one order underneath:
 *   - Solana, connected wallet: we build the transaction, the wallet signs and
 *     sends it, we confirm by signature.
 *   - Solana, QR (Solana Pay): the sponsor's phone wallet asks our API for the
 *     transaction; the page watches for the order that creates and confirms it.
 *   - Base / Polygon: the wallet signs two USDC authorizations (no gas) and our
 *     relayer submits both in one transaction.
 * The server decides when an order is paid. Nothing here settles anything,
 * which is why the page is allowed to poll as often as it does.
 *
 * No red, including on failures: problems are amber and say what to do next.
 *
 * With `offer`, this pays an accepted offer or bid (hispace-offers-v0.md): the
 * checkout is asked for through the offer's token and priced at the agreed
 * amount, and everything after it (confirm, content) is the same flow. Its
 * Solana Pay QR comes from the offer too (`POST /public/offers/:token/checkout`
 * with `qr: true`), which binds this browser's checkout key to the offer; the
 * page then waits on `GET /public/checkout` with that key like any QR payment.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "choose" }
  | { kind: "busy"; label: string }
  | { kind: "qr"; link: string }
  | { kind: "evm-sign"; order: Order; evm: EvmPayload; step: 0 | 1 | 2 }
  | { kind: "confirming"; order: Order }
  | { kind: "paid"; order: Order }
  | { kind: "duplicate"; order: Order }
  | { kind: "lapsed" };

const POLL_MS = 3_000;

/** Refusals that mean "this spot is not there to buy": offer the way back to the board. */
const GONE_CODES = new Set([
  "position_sold",
  "position_held",
  "position_reserved",
  "space_closed",
  "nothing_to_take_over",
]);

/* ── The component ─────────────────────────────────────────────────── */

export function Checkout({
  space,
  position,
  onClose,
  onPaid,
  offer = null,
}: {
  space: Space;
  position: Position;
  onClose: () => void;
  onPaid: () => void;
  /** An accepted offer or bid to pay, by its manage-link token. */
  offer?: { token: string; view: OfferView } | null;
}) {
  // Taking a sold spot over is only possible on the chains takeovers work on.
  // The position view does not say which chain the holder paid on, so the
  // backend's `wrong_chain` still catches a spot bought elsewhere.
  const takingOver = position.status === "sold" && position.takeover !== null;
  const takeoverChains = space.chains.filter((c) => TAKEOVER_CHAINS.includes(c));
  const chains = takingOver && takeoverChains.length > 0 ? takeoverChains : space.chains;
  const [chain, setChain] = useState<Chain>(chains.includes("solana") ? "solana" : chains[0]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [hasEvm, setHasEvm] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mobileLink, setMobileLink] = useState<string | null>(null);
  /** After a refusal that means "this spot is gone", offer the way back to the board. */
  const [offerOtherSpot, setOfferOtherSpot] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const keyRef = useRef<string>("");
  const signatureRef = useRef<string | null>(null);
  const feePct = `${space.feeBps / 100}%`;
  /** A session in person: booked, not sponsored (hispace-in-the-room-v0.md). */
  const session = isSessionSpace(space);
  const subject = session ? "session" : "spot";
  /**
   * What paying this from the HOLD app would earn (spaces-sponsor-points-v0.md):
   * on an accepted offer, the fee on the agreed amount; otherwise the fee this
   * spot's payment carries. Null when the server doesn't say, and then the pay
   * step promises nothing.
   */
  const holdPoints = offer
    ? pointsForOfferAmount(offer.view.agreedUsdc, space, offer.view)
    : pointsForPosition(position, space);

  /** The checkout calls: the position's, or the accepted offer's at the agreed amount. */
  const offerToken = offer?.token ?? null;
  const beginSolana = useCallback(
    (key: string, sponsorAddress: string) =>
      offerToken
        ? startOfferCheckout(offerToken, key, { chain: "solana", sponsorAddress })
        : startCheckout(position.id, key, { chain: "solana", sponsorAddress }),
    [offerToken, position.id],
  );
  const beginEvm = useCallback(
    (key: string, chain: "base" | "polygon", sponsorAddress: string) =>
      offerToken
        ? startOfferCheckout(offerToken, key, { chain, sponsorAddress })
        : startCheckout(position.id, key, { chain, sponsorAddress }),
    [offerToken, position.id],
  );
  const explain = useCallback(
    (e: unknown, c: Chain | null) =>
      (offer ? describeOfferError(e, { kind: offer.view.kind, chain: c, subject }) : null) ?? describeError(e, c, subject),
    [offer, subject],
  );

  /* Wallets are only knowable in the browser, after mount. */
  useEffect(() => {
    setWallets(detectSolanaWallets());
    setHasEvm(Boolean(injected().ethereum));
    setMobile(isMobile());
  }, []);

  /* Resume: this browser may already hold a checkout for this spot. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = existingCheckoutKey(position.id);
      keyRef.current = existing ?? checkoutKey(position.id);
      if (!existing) {
        setPhase({ kind: "choose" });
        return;
      }
      try {
        const order = await currentCheckout(existing);
        if (cancelled) return;
        if (order && order.positionId === position.id) {
          setChain(order.chain);
          if (order.status === "paid") return setPhase({ kind: "paid", order });
          if (order.status === "paid_duplicate") return setPhase({ kind: "duplicate", order });
          if (order.status === "awaiting_payment") return setPhase({ kind: "confirming", order });
          // A quote holds nothing and is not worth resuming: the next
          // checkout issues a fresh one.
          if (order.status === "quoted") {
            if (!cancelled) setPhase({ kind: "choose" });
            return;
          }
        }
        if (order) keyRef.current = rotateCheckoutKey(position.id);
      } catch {
        // Could not ask. Keep the key: a checkout with it reaches the same
        // order if one is still live, and a spent key is replaced on refusal.
      }
      if (!cancelled) setPhase({ kind: "choose" });
    })();
    return () => {
      cancelled = true;
    };
  }, [position.id]);

  /* The Solana Pay link for the mobile button, computed once the key is known.
     An accepted offer's link has to be asked for (it binds the key), so it is
     only fetched when the sponsor chooses QR, whose screen has the same button. */
  useEffect(() => {
    if (offerToken || phase.kind !== "choose" || chain !== "solana") return;
    let live = true;
    void checkoutId(keyRef.current).then((c) => {
      if (live) setMobileLink(solanaPayLink(position.id, c));
    });
    return () => {
      live = false;
    };
  }, [phase.kind, chain, position.id, offerToken]);

  /* Countdown tick while something is held. */
  const ticking = phase.kind === "qr" || phase.kind === "confirming" || phase.kind === "evm-sign";
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [ticking]);

  /* Escape closes, and the page behind does not scroll. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* Confirm poll: every 3 s while an order is waiting. */
  const confirmingId = phase.kind === "confirming" ? phase.order.id : null;
  useEffect(() => {
    if (!confirmingId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const r = await confirmOrder(confirmingId, keyRef.current, signatureRef.current ?? undefined);
        if (stop) return;
        if (r.outcome === "paid") {
          setPhase({ kind: "paid", order: r.order });
          onPaid();
          return;
        }
        if (r.outcome === "duplicate") {
          setPhase({ kind: "duplicate", order: r.order });
          return;
        }
        if (r.outcome === "unpaid") {
          setPhase({ kind: "lapsed" });
          return;
        }
        setPhase((p) => (p.kind === "confirming" ? { kind: "confirming", order: r.order } : p));
      } catch (e) {
        if (stop) return;
        if (e instanceof CheckoutError && e.code === "rate_limited") wait = POLL_MS * 4;
        else if (e instanceof CheckoutError && e.code === "not_found") {
          setNotice(explain(e, null));
          return;
        }
        // Anything else: a dropped poll is not an event. Ask again.
      }
      if (!stop) timer = setTimeout(tick, wait);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [confirmingId, onPaid, explain]);

  /* QR poll: every 3 s until the phone wallet has created the order. */
  const waitingQr = phase.kind === "qr";
  useEffect(() => {
    if (!waitingQr) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const order = await currentCheckout(keyRef.current);
        if (stop) return;
        if (
          order &&
          order.positionId === position.id &&
          order.chain === "solana" &&
          (order.status === "awaiting_payment" || order.status === "paid")
        ) {
          signatureRef.current = null;
          setChain("solana");
          setPhase({ kind: "confirming", order });
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
  }, [waitingQr, position.id]);

  /* ── Actions ────────────────────────────────────────────────────── */

  /**
   * Run a checkout call, and if the server says this key is spent
   * (`hold_expired`, `checkout_key_reused`), drop it and try once more with a
   * fresh one.
   */
  const withFreshKey = useCallback(
    async <T,>(run: (key: string) => Promise<T>): Promise<T> => {
      try {
        return await run(keyRef.current);
      } catch (e) {
        if (!(e instanceof CheckoutError) || !SPENT_KEY_CODES.has(e.code)) throw e;
        keyRef.current = rotateCheckoutKey(position.id);
        return run(keyRef.current);
      }
    },
    [position.id],
  );

  const startAgain = useCallback(() => {
    keyRef.current = rotateCheckoutKey(position.id);
    signatureRef.current = null;
    setNotice(null);
    setPhase({ kind: "choose" });
  }, [position.id]);

  async function payWithSolanaWallet(wallet: SolanaWallet) {
    setNotice(null);
    setOfferOtherSpot(false);
    try {
      setPhase({ kind: "busy", label: `Connecting ${wallet.name}…` });
      const connected = (await wallet.provider.connect()) as { publicKey?: { toString(): string } } | undefined;
      const sponsorAddress = (connected?.publicKey ?? wallet.provider.publicKey)?.toString();
      if (!sponsorAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: "Preparing the payment…" });
      const checkout = () =>
        withFreshKey((key) => beginSolana(key, sponsorAddress));
      let [res, web3] = await Promise.all([checkout(), import("@solana/web3.js")]);

      setPhase({ kind: "busy", label: `Approve the payment in ${wallet.name}…` });
      let sent: unknown;
      try {
        sent = await wallet.provider.signAndSendTransaction(
          web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.transaction)),
        );
      } catch (e) {
        // Approving took long enough for the blockhash to expire. The same key
        // gets a fresh transaction for the same order: ask once more.
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
      setPhase({ kind: "confirming", order: res.order });
    } catch (e) {
      setNotice(explain(e, "solana"));
      setOfferOtherSpot(e instanceof CheckoutError && GONE_CODES.has(e.code));
      // A connected wallet that declined leaves the hold in place; the next
      // attempt with the same key gets the same transaction back.
      setPhase({ kind: "choose" });
    }
  }

  async function startQr() {
    setNotice(null);
    setOfferOtherSpot(false);
    if (!offerToken) {
      const c = await checkoutId(keyRef.current);
      setPhase({ kind: "qr", link: solanaPayLink(position.id, c) });
      return;
    }
    // An accepted offer: the server binds this key to the offer and answers the link.
    setPhase({ kind: "busy", label: "Preparing the QR…" });
    try {
      const link = await withFreshKey((key) => offerSolanaPayLink(offerToken, key));
      setPhase({ kind: "qr", link });
    } catch (e) {
      setNotice(explain(e, "solana"));
      setOfferOtherSpot(e instanceof CheckoutError && GONE_CODES.has(e.code));
      setPhase({ kind: "choose" });
    }
  }

  async function payWithEvm(evmChain: "base" | "polygon") {
    setNotice(null);
    setOfferOtherSpot(false);
    let submitting = false;
    const provider = injected().ethereum;
    if (!provider) {
      setNotice("No browser wallet found. Open this page in MetaMask, Coinbase Wallet or Rabby, or pay another way.");
      return;
    }
    const meta = PUBLIC_CHAINS[evmChain];
    try {
      setPhase({ kind: "busy", label: "Connecting your wallet…" });
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const sponsorAddress = accounts?.[0];
      if (!sponsorAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: `Switching your wallet to ${meta.label}…` });
      await switchEvmChain(provider, meta);

      setPhase({ kind: "busy", label: "Preparing the payment…" });
      const res = await withFreshKey((key) => beginEvm(key, evmChain, sponsorAddress));
      const creatorAuth = res.evm.authorizations.find((a) => a.role === "creator");
      const feeAuth = res.evm.authorizations.find((a) => a.role === "fee");
      if (!creatorAuth || !feeAuth) throw new CheckoutError("server", 500);

      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 0 });
      const creatorSignature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [sponsorAddress, typedData(res.evm, creatorAuth.message)],
      })) as string;

      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 1 });
      const feeSignature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [sponsorAddress, typedData(res.evm, feeAuth.message)],
      })) as string;

      // The hold starts here, not at checkout: until now this was a quote
      // and another sponsor could sign first.
      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 2 });
      submitting = true;
      const submitted = await submitAuthorizations(res.order.id, keyRef.current, { creatorSignature, feeSignature });
      signatureRef.current = null;
      setPhase({ kind: "confirming", order: submitted.order });
    } catch (e) {
      const refusal = submitting ? describeAuthorizationRefusal(e, evmChain, subject) : null;
      setNotice(refusal ?? explain(e, evmChain));
      setOfferOtherSpot(
        refusal !== null ||
          (e instanceof CheckoutError && GONE_CODES.has(e.code)),
      );
      setPhase({ kind: "choose" });
    }
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  const heldMs = (o: Order) => new Date(o.reservedUntil).getTime() - now;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-abyss/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-card border border-[color:var(--color-hairline-strong)] bg-night shadow-2xl sm:m-6 sm:max-w-lg sm:rounded-card">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--color-hairline)] bg-night/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className={`${eyebrow} text-amber`}>
              {offer
                ? offer.view.kind === "bid"
                  ? "Pay your winning bid"
                  : "Pay your accepted offer"
                : session
                  ? "Book a session"
                  : "Sponsor a spot"}
            </p>
            <h2 id="checkout-title" className="mt-1 truncate text-body text-text">
              {position.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] text-text-muted hover:bg-white/5 hover:text-text"
            aria-label="Close checkout"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-6">
          {phase.kind === "paid" ? (
            session ? (
              <PaidSession order={phase.order} space={space} />
            ) : (
              <Paid order={phase.order} space={space} position={position} checkoutKey={keyRef.current} />
            )
          ) : phase.kind === "duplicate" ? (
            <Duplicate order={phase.order} />
          ) : phase.kind === "lapsed" ? (
            <div className="flex flex-col gap-4">
              <h3 className="font-display text-h4 font-light text-text">The hold ran out.</h3>
              <p className="text-small text-text-muted">
                No payment arrived in time, so nothing left your wallet and the {subject} went back on
                the board. Start again if it&rsquo;s still available.
              </p>
              <div>
                <button type="button" className={btnPrimary} onClick={startAgain}>
                  Start again
                </button>
              </div>
            </div>
          ) : (
            <>
              <Summary space={space} position={position} session={session} offer={offer?.view ?? null} />

              {phase.kind === "loading" && <p className="text-small text-text-muted">One moment…</p>}

              {phase.kind === "busy" && (
                <p className="flex items-center gap-3 text-small text-text" role="status">
                  <Spinner />
                  {phase.label}
                </p>
              )}

              {phase.kind === "choose" && (
                <>
                  {chains.length > 1 && (
                    <ChainPicker
                      chains={chains}
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
                      mobileLink={mobileLink}
                      onWallet={payWithSolanaWallet}
                      onQr={() => void startQr()}
                      onMobileLink={() => void startQr()}
                    />
                  ) : (
                    <div className="flex flex-col gap-4">
                      <p className="text-small text-text-muted">
                        Two signatures, no gas: one pays the creator, one pays HOLD&rsquo;s {feePct}. Both
                        go through together or not at all.
                      </p>
                      {!hasEvm && (
                        <p className="text-small text-amber">
                          No browser wallet found here. Open this page in MetaMask, Coinbase Wallet or
                          Rabby{chains.includes("solana") ? ", or pay on Solana by QR" : ""}.
                        </p>
                      )}
                      <div>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={!hasEvm}
                          onClick={() => void payWithEvm(chain)}
                        >
                          Connect wallet and sign
                        </button>
                      </div>
                    </div>
                  )}

                  <Disclaimer session={session} />
                  {holdPoints !== null ? (
                    <AppPrompt
                      title={earnPointsLine(holdPoints)}
                      body={`Worth ${pointsWorth(holdPoints)} in HOLD. Only a payment from the HOLD app earns them; any other wallet pays the same and earns none.`}
                    />
                  ) : (
                    offer && <AppPrompt title="No wallet with USDC? Pay with HOLD" />
                  )}
                </>
              )}

              {phase.kind === "qr" && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-full max-w-[240px] rounded-card bg-white p-3">
                    <QrCode text={phase.link} title="Solana Pay QR code" className="h-auto w-full" />
                  </div>
                  <p className="text-small text-text-muted">
                    Scan with Phantom, Solflare or any Solana wallet. It shows the exact amount before
                    you approve.
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
                  <p className="text-small text-text-muted">
                    Two signatures, no gas: one pays the creator, one pays HOLD&rsquo;s {feePct}. Both go
                    through together or not at all.
                  </p>
                  <ol className="flex flex-col gap-2">
                    {(["creator", "fee"] as const).map((role, i) => {
                      const a = phase.evm.authorizations.find((x) => x.role === role);
                      const done = phase.step > i;
                      const current = phase.step === i;
                      return (
                        <li
                          key={role}
                          className={`flex items-center gap-3 rounded-input border px-4 py-3 text-small ${
                            current ? "border-amber/50 text-text" : "border-[color:var(--color-hairline)] text-text-muted"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] text-tiny ${
                              done ? "bg-success/20 text-success" : current ? "bg-amber text-text-on-amber" : "bg-white/5"
                            }`}
                            aria-hidden
                          >
                            {done ? <Check /> : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">{a?.label}</span>
                          {current && <span className="text-tiny text-amber">Sign in your wallet</span>}
                        </li>
                      );
                    })}
                  </ol>
                  {phase.step === 2 && (
                    <p className="flex items-center gap-3 text-small text-text" role="status">
                      <Spinner />
                      Sending both payments…
                    </p>
                  )}
                  <QuoteLine ms={phase.evm.validBefore * 1000 - now} />
                </div>
              )}

              {phase.kind === "confirming" && (
                <div className="flex flex-col gap-4">
                  <p className="flex items-center gap-3 text-body text-text" role="status">
                    <Spinner />
                    Confirming your payment on {CHAIN_LABEL[phase.order.chain]}…
                  </p>
                  <p className="text-small text-text-muted">
                    This page updates on its own. The {subject} is yours the moment the network confirms it.
                  </p>
                  <HoldLine ms={heldMs(phase.order)} subject={subject} />
                </div>
              )}
            </>
          )}

          {notice && (
            <div className="flex flex-col gap-3 rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3" role="status">
              <p className="text-small text-text-muted">{notice}</p>
              {offerOtherSpot && (
                <div>
                  <button type="button" className={btnSmallSecondary} onClick={onClose}>
                    Pick another {subject}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────── */

function Summary({
  space,
  position: p,
  session,
  offer,
}: {
  space: Space;
  position: Position;
  session: boolean;
  offer: OfferView | null;
}) {
  const zone = space.template.zones.find((z) => z.zoneKey === p.zoneKey);
  const agreed = offer?.agreedUsdc && offer.agreedSponsorPaysUsdc ? offer : null;
  /* A rung of a ladder (ad-space-tiers-v0.md): the sheet's heading already
     carries its name, because `label` falls back to the tier's title. What it
     cannot carry is the list the brand picked this rung FOR, and a sponsor
     about to sign for $1,300 should be reading the interview, not remembering
     it from the page behind the sheet. Plain text, as it arrives. */
  const perks = p.perks ?? [];
  // Taking a spot from whoever holds it, rather than buying an empty one. The
  // figures differ enough that showing the fixed-price pair would be wrong:
  // what this sponsor pays is the DOUBLED price plus the fee, and most of it
  // is not the creator's — it goes straight back to the sponsor displaced.
  const taking = p.status === "sold" && p.takeover?.nextSponsorPaysUsdc ? p.takeover : null;
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-4">
        <div>
          <dt className="text-tiny text-text-faint">You pay</dt>
          <dd className="mt-1 font-mono text-body text-text">
            {agreed ? agreed.agreedSponsorPaysUsdc : taking ? taking.nextSponsorPaysUsdc : p.sponsorPaysUsdc} USDC
          </dd>
        </div>
        <div>
          <dt className="text-tiny text-text-faint">
            {agreed ? "Agreed price" : taking ? "New price for the spot" : `@${space.creator.xHandle} receives`}
          </dt>
          <dd className="mt-1 font-mono text-body text-text">
            {agreed ? agreed.agreedUsdc : taking ? taking.nextPriceUsdc : p.creatorReceivesUsdc} USDC
          </dd>
        </div>
        {taking && (
          <div className="col-span-2 border-t border-[color:var(--color-hairline)] pt-3 text-small text-text-muted">
            Of that, <span className="font-mono text-text">{taking.refundsUsdc} USDC</span> goes straight back to the
            sponsor who holds this spot now — everything they paid, in the same transaction that takes it from them.
            HOLD never holds it in between.
          </div>
        )}
        {perks.length > 0 && (
          <div className="col-span-2 border-t border-[color:var(--color-hairline)] pt-3">
            <h3 className={`${eyebrow} text-text-faint`}>What you get</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {perks.map((line, i) => (
                <li key={i} className="break-words text-small text-text [overflow-wrap:anywhere]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
        {session ? (
          <div className="col-span-2 text-tiny text-text-faint">
            Nothing else to fill in before you pay. Afterwards you send the creator your contact and what the session
            is for.
          </div>
        ) : (
          <div className="col-span-2 text-tiny text-text-faint">
            {[zone?.sizeLabel, `Takes ${p.accepts.map((k) => CONTENT_KIND_LABEL[k]).join(", ")}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </dl>
      {/* The lead-in is the policy the creator picked, in the app's own words,
          so the sentence after it can open with "if the venue says no" without
          the line saying it twice. */}
      <p className="text-small text-text-muted">
        <span className="text-text">{FALLBACK_LABEL[space.fallback]}.</span>{" "}
        {(session ? SESSION_FALLBACK_TEXT : FALLBACK_TEXT)[space.fallback]}
        {space.fallbackNote ? ` ${space.fallbackNote}` : ""}
      </p>
    </div>
  );
}

function Disclaimer({ session }: { session: boolean }) {
  return (
    <p className="text-tiny leading-relaxed text-text-faint">
      {session ? (
        <>
          You pay the creator directly. HOLD never holds your money and can&rsquo;t refund a booking; the
          creator&rsquo;s policy is above.
        </>
      ) : (
        <>
          You pay the creator directly. HOLD never holds your money. Paid spots can&rsquo;t be refunded
          by HOLD; the creator&rsquo;s fallback policy is above.
        </>
      )}
    </p>
  );
}

/** A Base/Polygon quote: valid until `validBefore`, holding nothing meanwhile. */
function QuoteLine({ ms }: { ms: number }) {
  return ms > 0 ? (
    <p className="text-tiny text-text-faint">
      Sign within <span className="font-mono text-text-muted">{timeLeft(ms)}</span>. The spot is held for you once
      both signatures are in; until then another sponsor can still take it.
    </p>
  ) : (
    <p className="text-tiny text-amber">This quote has expired. Close your wallet and start again for a fresh one.</p>
  );
}

function HoldLine({ ms, subject }: { ms: number; subject: "spot" | "session" }) {
  return ms > 0 ? (
    <p className="text-tiny text-text-faint">
      This {subject} is held for you for <span className="font-mono text-text-muted">{timeLeft(ms)}</span>.
    </p>
  ) : (
    <p className="text-tiny text-amber">
      The hold has run out. If you already approved the payment it can still confirm, and this page keeps
      checking.
    </p>
  );
}

function Paid({
  order,
  space,
  position,
  checkoutKey,
}: {
  order: Order;
  space: Space;
  position: Position;
  checkoutKey: string;
}) {
  const handle = space.creator.xHandle;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`${eyebrow} text-success`}>Paid</p>
        <h3 className="mt-2 font-display text-h3 font-light text-text">You&rsquo;re sponsoring this spot.</h3>
        <p className="mt-3 text-small text-text-muted">
          {order.takeover ? (
            <>
              {order.sponsorPaysUsdc} USDC on {CHAIN_LABEL[order.chain]}: {order.takeover.refundsUsdc} back to the
              sponsor you took it from, {order.creatorReceivesUsdc} more to @{handle}, and {order.feeUsdc} to HOLD. The
              spot is listed at {order.priceUsdc} now.
            </>
          ) : (
            <>
              {order.sponsorPaysUsdc} USDC on {CHAIN_LABEL[order.chain]}: {order.creatorReceivesUsdc} to @{handle} and{" "}
              {order.feeUsdc} to HOLD.
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              View the transaction
            </a>
          )}
          {order.share && (
            <a
              href={`https://x.com/intent/post?text=${encodeURIComponent(order.share.text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSmallSecondary}
            >
              Share on X
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-[color:var(--color-hairline)] pt-6">
        <SponsorContentForm order={order} checkoutKey={checkoutKey} accepts={position.accepts} creatorHandle={handle} />
      </div>
    </div>
  );
}

/**
 * After a session is paid: the manage link first, because a buyer with no
 * account has no other way back, then the contact and brief in place of the
 * logo form. Nothing else is asked before paying.
 */
function PaidSession({ order, space }: { order: Order; space: Space }) {
  const handle = space.creator.xHandle;
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState(order.session ?? null);
  useEffect(() => setToken(rememberManageToken(order)), [order]);
  const onSaved = useCallback((b: Booking) => setSession(b.order.session), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className={`${eyebrow} text-success`}>Paid</p>
        <h3 className="mt-2 font-display text-h3 font-light text-text">Your session is booked.</h3>
        <p className="mt-3 text-small text-text-muted">
          {order.sponsorPaysUsdc} USDC on {CHAIN_LABEL[order.chain]}: {order.creatorReceivesUsdc} to @{handle} and{" "}
          {order.feeUsdc} to HOLD.
        </p>
        {order.explorerUrl && (
          <div className="mt-4">
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              View the transaction
            </a>
          </div>
        )}
      </div>
      {token ? (
        <>
          <ManageLinkBox token={token} />
          <div className="border-t border-[color:var(--color-hairline)] pt-6">
            <SessionContactForm token={token} session={session} creatorHandle={handle} onSaved={onSaved} />
          </div>
        </>
      ) : (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          Your booking link hasn&rsquo;t reached this page yet. Reload the page in this browser to get it: it is how you
          send @{handle} your contact and confirm the session.
        </p>
      )}
    </div>
  );
}

function Duplicate({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-h4 font-light text-text">Someone else&rsquo;s payment landed first.</h3>
      <p className="text-small text-text-muted">
        Your payment arrived after this spot was already sold, so it couldn&rsquo;t buy it. HOLD never
        held it, and our team has been alerted. Email{" "}
        <a className="text-amber hover:underline" href={`mailto:support@hihodl.xyz?subject=${encodeURIComponent(`HiSpace order ${order.id}`)}`}>
          support@hihodl.xyz
        </a>{" "}
        with order <span className="font-mono text-text">{order.id.slice(0, 8)}</span> and we&rsquo;ll help you sort
        it out with the creator.
      </p>
      {order.explorerUrl && (
        <div>
          <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
            View the transaction
          </a>
        </div>
      )}
    </div>
  );
}

