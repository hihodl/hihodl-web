"use client";

import type { VersionedTransaction } from "@solana/web3.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Ion, type IonName } from "@/components/app/ion";
import { QrCode } from "@/components/ad-space/qr";
import {
  CheckoutError,
  checkoutId,
  checkoutKey,
  existingCheckoutKey,
  rotateCheckoutKey,
} from "@/lib/ad-space/checkout-client";
import { CHAIN_LABEL, timeLeft } from "@/lib/ad-space/format";
import {
  type EvmWallet,
  type SolanaWallet,
  base64ToBytes,
  blockhashExpired,
  bytesToBase64,
  isMobile,
  signedTransactionBytes,
  switchEvmChain,
  typedData,
  watchEvmWallets,
  watchSolanaWallets,
} from "@/lib/ad-space/wallets";
import type { Chain } from "@/lib/ad-space/types";
import { t } from "@/lib/app/i18n";
import { fmtFiat } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { PUBLIC_CHAINS } from "@/lib/orders/chains.public";
import {
  MISMATCH_CODE,
  PAY_SPENT_KEY_CODES,
  confirmPayment,
  currentPayment,
  describePayError,
  evmCheckoutProblem,
  markSentHere,
  ownerName,
  payKeyScope,
  payLinkSolanaPay,
  paymentExplorerUrl,
  previousAttemptSentence,
  receiptPath,
  retryAfterSeconds,
  sentHere,
  solanaCheckoutProblem,
  startPayCheckout,
  startSolanaTransfer,
  submitPayAuthorization,
  submitPaySolana,
  type ExpectedPayment,
  type PayToken,
} from "@/lib/pay-links/client";
import { appSchemeUrl, holdPayUrl, offers, payStateUrl, walletBrowseUrl, type WalletLinkId } from "@/lib/pay-links/page-rules";
import type { PayLinkEvmPayload, PayLinkPayment, ShownPayLink, TimedPayLinkCheckout } from "@/lib/pay-links/types";
import {
  connectWalletConnect,
  connectWalletConnectSolana,
  isWalletConnectDismissed,
  ledgerLiveUrl,
  walletConnectProjectId,
} from "@/lib/pay-links/walletconnect";

/**
 * Paying a pay link in stablecoins, from any wallet, with no HOLD account:
 * the sheet behind the page's "Stablecoins" row.
 *
 *   the network    a segmented row with each network's mark (Solana, Base,
 *                  Polygon for USDC; Base alone for EURC)
 *   in a wallet    when this page is already inside one (injected), "Pay
 *                  with <wallet>" comes first: one tap
 *   on a phone     "Or open your wallet": HOLD, and each wallet's own browser
 *                  opened on this page with the same amount. A browser can't
 *                  see which apps are installed, and a bare `solana:` link
 *                  opens whichever app claimed it, so every wallet is named.
 *                  Phantom and MetaMask pay on both Solana and EVM, so both
 *                  are listed on every network.
 *   the QR         the last row, "Scan QR code": the sheet turns into HOLD's
 *                  code, the logo in its middle, with Back to the options.
 *                  The Solana Pay request on Solana, the WalletConnect
 *                  pairing on Base and Polygon, for a wallet on another device.
 *
 * The HiSpace checkout underneath, minus the fee: a Solana transfer, or ONE
 * ERC-3009 authorization on Base or Polygon that our relayer submits. The
 * server decides when a payment is paid; this sheet only asks. Nothing
 * reaches a wallet until the sheet has checked the server's answer is the
 * payment it shows: amount, token, network, payer and receiver.
 *
 * The amount is the page's: an open link hands it in (`amountCents`, in the
 * token's cents), a fixed link carries its own.
 */

const POLL_MS = 3_000;
const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;
const NETWORK_LOGO: Record<Chain, string> = { solana: "/pay/solana.svg", base: "/pay/base.svg", polygon: "/pay/polygon.svg" };
export const WALLET_LOGO: Record<WalletLinkId | "ledger", string> = {
  hold: "/favicon.png",
  // Each wallet's own app icon, from its website (27-Sep-2026): phantom.com,
  // solflare.com, metamask.io, wallet.coinbase.com, trustwallet.com.
  phantom: "/pay/wallets/phantom.png",
  solflare: "/pay/wallets/solflare.png",
  metamask: "/pay/wallets/metamask.png",
  coinbase: "/pay/wallets/coinbase.png",
  trust: "/pay/wallets/trust.svg",
  // ledger.com's own icon (27-Sep-2026).
  ledger: "/pay/wallets/ledger.png",
};
/** Marks drawn without a background sit on a white tile, like their app icon. */
export const WALLET_LOGO_INSET: Partial<Record<WalletLinkId, true>> = { metamask: true, coinbase: true, trust: true };
export const WALLET_NAME: Record<Exclude<WalletLinkId, "hold">, string> = {
  phantom: "Phantom",
  solflare: "Solflare",
  metamask: "MetaMask",
  coinbase: "Coinbase Wallet",
  trust: "Trust Wallet",
};

type Phase =
  | { kind: "loading" }
  | { kind: "choose" }
  | { kind: "busy"; label: string }
  /** `scanned`: a phone wallet has opened the payment and not sent it yet. */
  /** `transfer`: a transfer request, a payment from the moment it is shown; otherwise a transaction request, one once a wallet opens it. */
  | { kind: "qr"; link: string; scanned: boolean; transfer?: boolean }
  /** Waiting for a wallet to pair over WalletConnect; `uri` is the code to show. */
  /** A WalletConnect pairing: Base or Polygon, or Solana for Ledger Wallet. */
  | { kind: "wc"; uri: string | null; solana?: boolean }
  /** `skewMs`: the server's clock minus this browser's, from the checkout answer. */
  | { kind: "evm-sign"; label: string; validBefore: number; skewMs: number; sending: boolean }
  | { kind: "confirming"; payment: PayLinkPayment }
  | { kind: "paid"; payment: PayLinkPayment }
  | { kind: "duplicate"; payment: PayLinkPayment }
  | { kind: "lapsed" };

/** The networks a token can be paid on, among the link's. */
export function networksFor(link: Pick<ShownPayLink, "chains">, token: PayToken): Chain[] {
  return token === "eurc" ? link.chains.filter((c) => c === "base") : link.chains;
}

export function PayLinkPay({
  link,
  amountCents = null,
  token = "usdc",
  amountText = null,
  network = null,
}: {
  link: ShownPayLink;
  /** An open link's amount, in the token's cents (validated by the page). Ignored on a fixed link. */
  amountCents?: number | null;
  token?: PayToken;
  /** The amount as the payer typed it, carried into a wallet's browser. */
  amountText?: string | null;
  /** The network to start on (a page reopened inside a wallet). */
  network?: Chain | null;
}) {
  const router = useRouter();
  // Re-render when the language changes; `t` reads whichever is on screen.
  useT();
  const scope = payKeyScope(link.code);
  const chains = networksFor(link, token);
  const [chain, setChain] = useState<Chain>(
    network && chains.includes(network) ? network : chains.includes("solana") ? "solana" : chains[0] ?? "base",
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  /** The options, or the QR code the payer asked for in their place. */
  const [view, setView] = useState<"options" | "qr">("options");
  const [notice, setNotice] = useState<string | null>(null);
  const [solWallets, setSolWallets] = useState<SolanaWallet[]>([]);
  const [evmWallets, setEvmWallets] = useState<EvmWallet[]>([]);
  // Inlined at build, so the server and the browser agree on it.
  const walletConnect = walletConnectProjectId() !== null;
  const [mobile, setMobile] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [now, setNow] = useState(() => Date.now());
  /** When the server said a previous attempt of this payer's may have settled (`previous_attempt_pending`). */
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const keyRef = useRef("");
  const signatureRef = useRef<string | null>(null);
  /** The WalletConnect pairing this sheet is waiting on; a newer one (or a closed sheet) retires it. */
  const wcRun = useRef(0);
  /** The payer tapped Ledger before the pairing link existed: open Ledger Wallet when it does. */
  const ledgerWanted = useRef(false);
  /** What the open QR code asks for, and whether it has already been replaced once. */
  const qrRef = useRef<{ cents: number; amountInUrl: number | null; replaced: boolean }>({
    cents: 0,
    amountInUrl: null,
    replaced: false,
  });

  const unit = token === "eurc" ? "EURC" : "USDC";
  const money = useCallback((cents: number) => fmtFiat(cents / 100, token === "eurc" ? "EUR" : "USD"), [token]);
  const fixed = link.amount.mode === "fixed" ? link.amount.cents : null;
  const expectedCents = fixed ?? amountCents ?? 0;
  const payee = ownerName(link.owner);
  const maxCents = link.amount.mode === "open" ? Math.min(link.amount.maxCents ?? MAX_CENTS, MAX_CENTS) : MAX_CENTS;
  const errorContext = { limits: { minCents: MIN_CENTS, maxCents }, accepts: chains, payee };
  const waiting = retryAt !== null && retryAt > now;

  useEffect(() => {
    setMobile(isMobile());
    setPageUrl(window.location.href);
    const stopSol = watchSolanaWallets(setSolWallets);
    const stopEvm = watchEvmWallets(setEvmWallets);
    // Closing the sheet retires a pairing still waiting.
    const pairing = wcRun;
    return () => {
      stopSol();
      stopEvm();
      pairing.current++;
    };
  }, []);

  /*
   * Resume a payment this browser already started for this link. "Confirming"
   * only for a payment this tab actually sent: a quote nobody signed, or a QR
   * a phone opened, is asked once whether it was paid and otherwise left alone
   * (the same key hands out the same payment again, so nothing is paid twice).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = existingCheckoutKey(scope);
      keyRef.current = existing ?? checkoutKey(scope);
      if (existing) {
        try {
          let payment = await currentPayment(existing);
          if (cancelled) return;
          if (payment?.status === "awaiting_payment") {
            if (payment.txHash || sentHere(payment.id)) {
              setChain(payment.chain);
              return setPhase({ kind: "confirming", payment });
            }
            try {
              payment = (await confirmPayment(payment.id, existing)).payment;
            } catch {
              // Asked once; the server's sweep settles it either way.
            }
            if (cancelled) return;
          }
          if (payment?.status === "paid") return setPhase({ kind: "paid", payment });
          if (payment?.status === "paid_duplicate") return setPhase({ kind: "duplicate", payment });
          if (payment?.status === "unpaid") keyRef.current = rotateCheckoutKey(scope);
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

  const ticking = phase.kind === "evm-sign" || waiting;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
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
        const r = await confirmPayment(confirmingId, keyRef.current, signatureRef.current);
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
          // This key no longer knows the payment: stop spinning and say so.
          keyRef.current = rotateCheckoutKey(scope);
          setNotice(describePayError(e, null));
          setPhase({ kind: "choose" });
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
  }, [confirmingId, router, scope]);

  /** A new QR code on a new key, for the same amount. */
  /**
   * The code for the key in `keyRef`: a transfer request, which every
   * wallet's scanner reads (Phantom's refused the transaction request as
   * "not a valid address"), or the transaction request where the server has
   * no transfer requests yet.
   */
  const qrPhase = useCallback(async (): Promise<Phase> => {
    const transfer = await startSolanaTransfer(link.code, keyRef.current, qrRef.current.amountInUrl);
    if (transfer) return { kind: "qr", link: transfer.transferRequest, scanned: false, transfer: true };
    const c = await checkoutId(keyRef.current);
    return { kind: "qr", link: payLinkSolanaPay(link.code, c, qrRef.current.amountInUrl), scanned: false };
  }, [link.code]);

  const replaceQr = useCallback(async () => {
    keyRef.current = rotateCheckoutKey(scope);
    try {
      setPhase(await qrPhase());
    } catch (e) {
      fail(e, "solana");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrPhase, scope]);

  /*
   * QR poll: once a phone wallet has opened the payment, check it is the
   * amount the page shows, then ask the server to settle it until it lands.
   * The page stays on the code meanwhile: nothing was sent from here.
   */
  const qrLink = phase.kind === "qr" ? phase.link : null;
  const qrTransfer = phase.kind === "qr" && Boolean(phase.transfer);
  useEffect(() => {
    if (!qrLink) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const key = keyRef.current;
        let payment = await currentPayment(key);
        if (stop) return;
        if (payment?.status === "awaiting_payment") {
          // Checked before settling: a phone wallet showing another amount must not be approved.
          if (payment.chain !== "solana" || payment.amountCents !== qrRef.current.cents) {
            if (qrRef.current.replaced) {
              setNotice(describePayError(new CheckoutError(MISMATCH_CODE, 0), "solana"));
              keyRef.current = rotateCheckoutKey(scope);
              setPhase({ kind: "choose" });
              return;
            }
            qrRef.current.replaced = true;
            setNotice(t("payPage.stable.qrMismatch"));
            await replaceQr();
            return;
          }
          payment = (await confirmPayment(payment.id, key)).payment;
          if (stop) return;
        }
        if (payment) {
          if (payment.status === "paid") {
            setPhase({ kind: "paid", payment });
            router.refresh();
            return;
          }
          if (payment.status === "paid_duplicate") return setPhase({ kind: "duplicate", payment });
          if (payment.status === "unpaid") {
            setNotice(t("payPage.stable.qrExpired"));
            await replaceQr();
            return;
          }
          // A transfer request is a payment from the moment it is shown: nothing was scanned yet.
          if (!qrTransfer) setPhase((p) => (p.kind === "qr" && !p.scanned ? { ...p, scanned: true } : p));
          // Settling one reads the chain by its reference; every other look is plenty.
          else wait = POLL_MS * 2;
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
  }, [qrLink, qrTransfer, replaceQr, router, scope]);

  /** The amount to send, or null after saying what is wrong with it. */
  function amountOrProblem(): { cents: number | undefined; expected: number } | null {
    if (fixed !== null) return { cents: undefined, expected: fixed };
    if (amountCents === null || amountCents < MIN_CENTS || amountCents > maxCents) {
      setNotice(t("payPage.stable.amountBetween", { min: money(MIN_CENTS), max: money(maxCents) }));
      return null;
    }
    return { cents: amountCents, expected: amountCents };
  }

  const withFreshKey = useCallback(
    async <T,>(run: (key: string) => Promise<T>): Promise<T> => {
      try {
        return await run(keyRef.current);
      } catch (e) {
        if (!(e instanceof CheckoutError) || !PAY_SPENT_KEY_CODES.has(e.code)) throw e;
        keyRef.current = rotateCheckoutKey(scope);
        return run(keyRef.current);
      }
    },
    [scope],
  );

  /**
   * A checkout the page has checked. When the answer is not the payment shown,
   * it starts over once on a new key, then gives up before any wallet sees it.
   */
  async function checkedCheckout<T>(
    body: { chain: Chain; payerAddress: string; amountCents?: number },
    check: (res: TimedPayLinkCheckout) => { ok: T } | { problem: string },
  ): Promise<T> {
    const full = token === "eurc" ? { ...body, token } : body;
    for (let attempt = 0; ; attempt++) {
      const res = await withFreshKey((key) => startPayCheckout(link.code, key, full));
      const verdict = check(res);
      if ("ok" in verdict) return verdict.ok;
      if (attempt >= 1) throw new CheckoutError(MISMATCH_CODE, 0, { problem: verdict.problem });
      keyRef.current = rotateCheckoutKey(scope);
    }
  }

  /**
   * A refusal, in words, back on the choice. A spent key is replaced; a link
   * that changed under the page is read again; a payer asked to wait sees the
   * seconds count down, and the buttons come back when they run out.
   */
  function fail(e: unknown, failedChain: Chain) {
    if (e instanceof CheckoutError && PAY_SPENT_KEY_CODES.has(e.code)) keyRef.current = rotateCheckoutKey(scope);
    setNotice(describePayError(e, failedChain, errorContext));
    if (e instanceof CheckoutError && e.code === "previous_attempt_pending") {
      const start = Date.now();
      setNow(start);
      setRetryAt(start + (retryAfterSeconds(e) ?? 30) * 1000);
    }
    setPhase({ kind: "choose" });
    if (e instanceof CheckoutError && e.code === "link_not_active") router.refresh();
  }

  function clearNotice() {
    setNotice(null);
    setRetryAt(null);
  }

  async function payWithSolanaWallet(wallet: SolanaWallet) {
    clearNotice();
    const amount = amountOrProblem();
    if (!amount) return;
    try {
      setPhase({ kind: "busy", label: t("payPage.stable.connecting", { wallet: wallet.name }) });
      const connected = (await wallet.provider.connect()) as { publicKey?: { toString(): string } } | undefined;
      const payerAddress = (connected?.publicKey ?? wallet.provider.publicKey)?.toString();
      if (!payerAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: t("payPage.stable.preparing") });
      const web3 = await import("@solana/web3.js");
      const expect: ExpectedPayment = { cents: amount.expected, chain: "solana", payerAddress, payTo: link.payTo };
      const checkout = () =>
        checkedCheckout<{ payment: PayLinkPayment; tx: VersionedTransaction; first: VersionedTransaction | null }>(
          { chain: "solana", payerAddress, ...(amount.cents ? { amountCents: amount.cents } : {}) },
          (res) => {
            if (!("solana" in res)) return { problem: "shape" };
            let tx: VersionedTransaction;
            try {
              tx = web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.transaction));
            } catch {
              return { problem: "unreadable" };
            }
            const problem = solanaCheckoutProblem(web3, tx, res, expect);
            if (problem) return { problem };
            // The unsigned copy is used only when it is the checked message, byte for byte.
            let first: VersionedTransaction | null = null;
            if (res.solana.walletFirst) {
              try {
                const copy = web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.walletFirst));
                if (sameBytes(copy.message.serialize(), tx.message.serialize())) first = copy;
              } catch {
                first = null;
              }
            }
            return { ok: { payment: res.payment, tx, first } };
          },
        );
      let { payment, tx, first } = await checkout();

      /**
       * The wallet signs first when it can and the server handed out the
       * unsigned copy: our fee payer's signature is added on the server.
       * Phantom blocks, as "could be malicious", a transaction someone else
       * signed before it. Otherwise the wallet signs and sends ours.
       */
      const pay = async (): Promise<unknown> => {
        const signTransaction = wallet.provider.signTransaction;
        if (first && typeof signTransaction === "function") {
          const bytes = signedTransactionBytes(await signTransaction.call(wallet.provider, first));
          if (!bytes) throw new Error("no_signature");
          setPhase({ kind: "busy", label: t("payPage.stable.sending") });
          return (await submitPaySolana(payment.id, keyRef.current, bytesToBase64(bytes))).signature;
        }
        return wallet.provider.signAndSendTransaction(tx);
      };

      setPhase({ kind: "busy", label: t("payPage.stable.approveIn", { wallet: wallet.name }) });
      let sent: unknown;
      try {
        sent = await pay();
      } catch (e) {
        if (!blockhashExpired(e)) throw e;
        setPhase({ kind: "busy", label: t("payPage.stable.freshOne", { wallet: wallet.name }) });
        // The same key would hand back the same, expired transaction.
        keyRef.current = rotateCheckoutKey(scope);
        ({ payment, tx, first } = await checkout());
        setPhase({ kind: "busy", label: t("payPage.stable.approveIn", { wallet: wallet.name }) });
        sent = await pay();
      }
      const signature = typeof sent === "string" ? sent : (sent as { signature?: unknown })?.signature;
      if (typeof signature !== "string" || !signature) throw new Error("no_signature");
      markSentHere(payment.id);
      signatureRef.current = signature;
      setPhase({ kind: "confirming", payment });
    } catch (e) {
      fail(e, "solana");
    }
  }

  const startQr = useCallback(async () => {
    const cents = fixed ?? amountCents;
    if (cents === null || cents < MIN_CENTS || cents > maxCents) return;
    setPhase({ kind: "busy", label: t("payPage.stable.makingCode") });
    // A key that already opened a payment would show the phone that payment
    // again, whatever the page now asks for: start this code on a new one.
    try {
      if (await currentPayment(keyRef.current)) keyRef.current = rotateCheckoutKey(scope);
    } catch {
      keyRef.current = rotateCheckoutKey(scope);
    }
    qrRef.current = { cents, amountInUrl: fixed === null ? cents : null, replaced: false };
    try {
      setPhase(await qrPhase());
    } catch (e) {
      fail(e, "solana");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed, amountCents, maxCents, scope, qrPhase]);

  /**
   * One authorization on Base or Polygon, from the wallet in this browser or
   * one paired over WalletConnect (`provider` already connected).
   */
  async function payWithEvm(evmChain: "base" | "polygon", provider: EvmWallet["provider"], walletName: string) {
    clearNotice();
    const amount = amountOrProblem();
    if (!amount) return;
    const meta = PUBLIC_CHAINS[evmChain];
    try {
      setPhase({ kind: "busy", label: t("payPage.stable.connecting", { wallet: walletName }) });
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const payerAddress = accounts?.[0];
      if (!payerAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: t("payPage.stable.switching", { net: meta.label }) });
      await switchEvmChain(provider, meta);

      setPhase({ kind: "busy", label: t("payPage.stable.preparing") });
      const expect: ExpectedPayment = { cents: amount.expected, chain: evmChain, payerAddress, payTo: link.payTo, token };
      const { payment, evm, skewMs } = await checkedCheckout<{
        payment: PayLinkPayment;
        evm: PayLinkEvmPayload;
        skewMs: number;
      }>({ chain: evmChain, payerAddress, ...(amount.cents ? { amountCents: amount.cents } : {}) }, (res) => {
        const problem = evmCheckoutProblem(res, expect);
        if (problem || !("evm" in res)) return { problem: problem ?? "shape" };
        return { ok: { payment: res.payment, evm: res.evm, skewMs: res.skewMs } };
      });
      const auth = evm.authorizations[0];

      setPhase({ kind: "evm-sign", label: auth.label, validBefore: evm.validBefore, skewMs, sending: false });
      const signature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [payerAddress, typedData(evm, auth.message)],
      })) as string;

      setPhase({ kind: "evm-sign", label: auth.label, validBefore: evm.validBefore, skewMs, sending: true });
      markSentHere(payment.id);
      const submitted = await submitPayAuthorization(payment.id, keyRef.current, signature);
      signatureRef.current = null;
      setPhase({ kind: "confirming", payment: submitted.payment });
    } catch (e) {
      // A key whose quote ran out would hand the same dead quote back: `fail` starts the next try on a new one.
      fail(e, evmChain);
    }
  }

  /** Show the WalletConnect pairing as our QR, and pay once a wallet pairs. */
  const startWc = useCallback(
    async (evmChain: "base" | "polygon") => {
      const run = ++wcRun.current;
      setPhase({ kind: "wc", uri: null });
      try {
        const provider = await connectWalletConnect((uri) => {
          if (wcRun.current !== run) return;
          setPhase((p) => (p.kind === "wc" ? { kind: "wc", uri } : p));
          openLedgerIfWanted(uri);
        });
        if (wcRun.current !== run) return;
        await payWithEvm(evmChain, provider, "WalletConnect");
      } catch (e) {
        if (wcRun.current !== run) return;
        if (isWalletConnectDismissed(e)) return setPhase({ kind: "choose" });
        fail(e, evmChain);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Ledger Wallet on Solana: a WalletConnect pairing of its own (the Solana
   * code is Solana Pay, which Ledger Wallet does not read), then the same
   * payment as a wallet in the page, signed first by the Ledger.
   */
  const startWcSolana = useCallback(
    async () => {
      const run = ++wcRun.current;
      setPhase({ kind: "wc", uri: null, solana: true });
      try {
        const provider = await connectWalletConnectSolana((uri) => {
          if (wcRun.current !== run) return;
          setPhase((p) => (p.kind === "wc" ? { kind: "wc", uri, solana: true } : p));
          openLedgerIfWanted(uri);
        });
        if (wcRun.current !== run) return;
        await payWithSolanaWallet({ name: "Ledger", provider });
      } catch (e) {
        if (wcRun.current !== run) return;
        if (isWalletConnectDismissed(e)) return setPhase({ kind: "choose" });
        fail(e, "solana");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function openLedgerIfWanted(uri: string) {
    if (!ledgerWanted.current) return;
    ledgerWanted.current = false;
    window.location.href = ledgerLiveUrl(uri);
  }

  /** Ledger: open Ledger Wallet on this payment's pairing, starting one for the network if needed. */
  function payWithLedger() {
    clearNotice();
    const onThisNetwork = phase.kind === "wc" && (chain === "solana") === Boolean(phase.solana);
    if (onThisNetwork && phase.uri) {
      window.location.href = ledgerLiveUrl(phase.uri);
      return;
    }
    ledgerWanted.current = true;
    if (onThisNetwork) return;
    if (chain === "solana") void startWcSolana();
    else void startWc(chain as "base" | "polygon");
  }

  const canPay = link.status === "active";
  const injectedHere = chain === "solana" ? solWallets.length > 0 : evmWallets.length > 0;

  /** Make the code for this network: the Solana Pay request, or the WalletConnect pairing. */
  function makeCode() {
    clearNotice();
    if (chain === "solana") {
      // A Ledger pairing still waiting gives way to the code.
      wcRun.current++;
      ledgerWanted.current = false;
      void startQr();
    } else void startWc(chain as "base" | "polygon");
  }

  /**
   * "Scan QR code": the sheet shows the code in place of the options. A
   * pairing already open for this network (Ledger started it) is shown as is.
   */
  function openQr() {
    clearNotice();
    if (!amountOrProblem()) return;
    setView("qr");
    if (phase.kind === "qr" || (phase.kind === "wc" && (chain === "solana") === Boolean(phase.solana))) return;
    makeCode();
  }

  /** Back to the options: the code is dropped, and a pairing still waiting with it. */
  function closeQr() {
    wcRun.current++;
    ledgerWanted.current = false;
    clearNotice();
    setView("options");
    if (phase.kind === "qr" || phase.kind === "wc") setPhase({ kind: "choose" });
  }

  function switchNetwork(c: Chain) {
    if (c === chain) return;
    wcRun.current++;
    ledgerWanted.current = false;
    // A wait is for the same wallet on the same network; another network can be tried now.
    clearNotice();
    setChain(c);
    setView("options");
    if (phase.kind === "qr" || phase.kind === "wc" || phase.kind === "busy") setPhase({ kind: "choose" });
  }

  function payAgain() {
    keyRef.current = rotateCheckoutKey(scope);
    signatureRef.current = null;
    clearNotice();
    setPhase({ kind: "choose" });
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  const noticeLine =
    notice || retryAt !== null ? (
      <p className="rounded-[14px] bg-amber/[0.12] px-3.5 py-2.5 text-[13px] font-strong leading-[18px] text-amber" role="status">
        {retryAt !== null ? previousAttemptSentence(Math.max(0, Math.ceil((retryAt - now) / 1000))) : notice}
      </p>
    ) : null;

  // A link that takes no more payments still shows this browser its own
  // payment (and its receipt), and nothing else.
  if (!canPay && (phase.kind === "loading" || phase.kind === "choose" || phase.kind === "lapsed")) return noticeLine;

  if (phase.kind === "paid") {
    return <Paid payment={phase.payment} payee={payee} unit={unit} money={money} onPayAgain={link.status === "active" ? payAgain : null} />;
  }

  if (phase.kind === "duplicate") {
    const tx = paymentExplorerUrl(phase.payment);
    return (
      <Result icon="information-circle-outline" tone="text-amber" title={t("payPage.stable.duplicateTitle")} body={t("payPage.stable.duplicateBody", { payee })}>
        {tx ? <GlassLink href={tx}>{t("payPage.stable.viewTx")}</GlassLink> : null}
      </Result>
    );
  }

  if (phase.kind === "lapsed") {
    return (
      <Result icon="time-outline" tone="text-amber" title={t("payPage.stable.lapsedTitle")} body={t("payPage.stable.lapsedBody")}>
        <button type="button" className={amberCta} onClick={payAgain}>
          {t("payPage.stable.startAgain")}
        </button>
      </Result>
    );
  }

  if (phase.kind === "confirming") {
    return (
      <Result spinning title={t("payPage.stable.confirming", { net: CHAIN_LABEL[phase.payment.chain] })} body={t("payPage.stable.updatesOwn")} />
    );
  }

  if (phase.kind === "evm-sign") {
    const left = phase.validBefore * 1000 - (now + phase.skewMs);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-[18px] bg-white/[0.06] px-4 py-3.5 text-[14px] text-white">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold ${
              phase.sending ? "bg-[#2FBE8A]/20 text-[#2FBE8A]" : "bg-amber text-[#0F0F1A]"
            }`}
            aria-hidden
          >
            {phase.sending ? <Ion name="checkmark" size={14} /> : 1}
          </span>
          <span className="min-w-0 flex-1 break-words">{phase.label}</span>
        </div>
        {phase.sending ? (
          <BusyLine label={t("payPage.stable.sending")} />
        ) : left > 0 ? (
          <p className="text-center text-[13px] text-[#9FB7C2]">
            {t("payPage.stable.signInWallet")} · {t("payPage.stable.signWithin", { time: timeLeft(left) })}
          </p>
        ) : (
          <p className="text-center text-[13px] text-amber">{t("payPage.stable.signExpired")}</p>
        )}
      </div>
    );
  }

  /* The choice: network, the wallet here, the code, the wallets on this phone. */
  const shownAmount = money(expectedCents);
  // Phantom and MetaMask each pay on Solana and on Base and Polygon (their docs, 28-Sep-2026).
  const walletLinks: WalletLinkId[] = chain === "solana" ? ["phantom", "solflare", "metamask"] : ["metamask", "phantom", "coinbase", "trust"];
  const scheme = appSchemeUrl(link);
  const stateUrl = pageUrl ? payStateUrl(pageUrl, { amount: amountText, currency: token === "eurc" ? "EUR" : "USD", network: chain }) : "";
  const qrText = phase.kind === "qr" ? phase.link : phase.kind === "wc" ? phase.uri : null;
  const showQrArea = chain === "solana" || walletConnect;
  const busyLabel = phase.kind === "busy" ? phase.label : null;
  const showLedger = walletConnect && canPay;
  const header = (
    <p className="text-center text-[14px] text-[#CFE3EC]">
      <span className="font-extrabold text-white">{shownAmount}</span> {t("payPage.sheetTo", { name: `\u2068${link.owner?.displayName?.trim() || payee}\u2069` })}
    </p>
  );

  if (view === "qr" && showQrArea) {
    return (
      <div className="flex flex-col gap-4">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={closeQr}
            disabled={!!busyLabel}
            className="absolute start-0 inline-flex h-9 items-center gap-1 rounded-[18px] pe-3 ps-1.5 text-[14px] font-bold text-white/80 transition-colors hover:text-white disabled:opacity-40"
          >
            <Ion name="chevron-back" size={18} className="rtl:rotate-180" />
            {t("payPage.back")}
          </button>
          <h3 className="text-[15px] font-extrabold text-white">{t("payPage.scanQr")}</h3>
        </div>

        {header}

        {busyLabel && !qrText ? <BusyLine label={busyLabel} /> : null}

        <div className="flex flex-col items-center gap-3">
          <div className="flex aspect-square w-full max-w-[236px] items-center justify-center rounded-[24px] bg-white p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {qrText ? (
              <QrCode text={qrText} title={t("payPage.stable.qrTitle")} logo="/favicon.png" className="h-auto w-full" />
            ) : phase.kind === "choose" ? (
              // A refusal, or a pairing the wallet closed: the payer reads why, then asks again.
              <button
                type="button"
                disabled={waiting}
                onClick={makeCode}
                className="flex flex-col items-center gap-2 text-[13px] font-bold text-[#0A1420] disabled:opacity-40"
              >
                <Ion name="qr-code-outline" size={34} />
                {t("payPage.showCode")}
              </button>
            ) : (
              <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#0A1420]/15 border-t-[#0A1420]" aria-hidden />
            )}
          </div>
          <p className="max-w-[300px] text-center text-[12.5px] leading-[17px] text-[#9FB7C2]">
            {phase.kind === "qr" && phase.scanned
              ? t("payPage.stable.qrScanned")
              : chain === "solana" && phase.kind !== "wc"
                ? t("payPage.stable.qrScan")
                : t("payPage.wcScan")}
          </p>
        </div>

        {noticeLine}
      </div>
    );
  }

  const openRows = !injectedHere && mobile && stateUrl;
  const holdRow = openRows && scheme && token === "usdc" && offers(link, "hold");
  const ledgerRow = !injectedHere && showLedger;
  const qrRow = showQrArea && canPay;

  return (
    <div className="flex flex-col gap-4">
      {header}

      {chains.length > 1 ? (
        <div role="radiogroup" aria-label={t("payPage.network")} className="flex h-11 gap-1 rounded-[22px] bg-white/[0.06] p-1">
          {chains.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={chain === c}
              onClick={() => switchNetwork(c)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[13.5px] font-bold transition-colors ${
                chain === c ? "bg-white text-[#0A1420]" : "text-white/75 hover:text-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={NETWORK_LOGO[c]} alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 rounded-[5px]" />
              <span className="truncate">{CHAIN_LABEL[c]}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-white/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NETWORK_LOGO[chain]} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-[5px]" />
          {t("payPage.onNetwork", { token: unit, net: CHAIN_LABEL[chain] })}
        </p>
      )}

      {/* Already inside a wallet: one tap. */}
      {chain === "solana"
        ? solWallets.map((w) => (
            <button key={w.name} type="button" className={amberCta} disabled={waiting || !!busyLabel} onClick={() => void payWithSolanaWallet(w)}>
              {w.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.icon} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-[6px]" />
              ) : null}
              {t("payPage.payWithWallet", { wallet: w.name })}
            </button>
          ))
        : evmWallets.map((w) => (
            <button
              key={w.id}
              type="button"
              className={amberCta}
              disabled={waiting || !!busyLabel}
              onClick={() => {
                wcRun.current++;
                void payWithEvm(chain as "base" | "polygon", w.provider, w.name);
              }}
            >
              {w.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.icon} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-[6px]" />
              ) : null}
              {t("payPage.payWithWallet", { wallet: w.name })}
            </button>
          ))}

      {busyLabel ? <BusyLine label={busyLabel} /> : null}

      {openRows || ledgerRow || qrRow ? (
        <div className="flex flex-col gap-2">
          {openRows || ledgerRow ? <p className="px-1 text-[13px] font-strong text-[#9FB7C2]">{t("payPage.orOpenWallet")}</p> : null}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.05]">
            {holdRow ? <WalletRow href={holdPayUrl(scheme, amountText, "USD")} logo={WALLET_LOGO.hold} name="HOLD" /> : null}
            {openRows
              ? walletLinks.map((id, i) => (
                  <WalletRow
                    key={id}
                    href={walletBrowseUrl(id as Exclude<WalletLinkId, "hold">, stateUrl)}
                    logo={WALLET_LOGO[id]}
                    inset={Boolean(WALLET_LOGO_INSET[id as WalletLinkId])}
                    name={WALLET_NAME[id as Exclude<WalletLinkId, "hold">]}
                    last={!ledgerRow && !qrRow && i === walletLinks.length - 1}
                  />
                ))
              : null}
            {/* A Ledger pays through Ledger Wallet (the app, on a phone or a computer) over WalletConnect. */}
            {ledgerRow ? (
              <WalletRow onClick={payWithLedger} logo={WALLET_LOGO.ledger} inset name="Ledger" disabled={waiting || !!busyLabel} last={!qrRow} />
            ) : null}
            {/* The code, for a wallet on another device: it takes the sheet, with Back to these options. */}
            {qrRow ? <WalletRow onClick={openQr} icon="qr-code-outline" name={t("payPage.scanQr")} disabled={waiting || !!busyLabel} last /> : null}
          </div>
        </div>
      ) : !injectedHere ? (
        <p className="text-center text-[13px] leading-[18px] text-[#9FB7C2]">{t("payPage.openInWalletBrowser")}</p>
      ) : null}

      {noticeLine}
    </div>
  );
}

/* ── Parts ─────────────────────────────────────────────────────────── */

const amberCta =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[26px] bg-amber px-5 text-[16px] font-extrabold text-[#0F0F1A] transition-opacity hover:opacity-90 disabled:opacity-50";
const glassCta =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[24px] border border-white/[0.22] bg-white/10 px-5 text-[15px] font-bold text-white";

function WalletRow({
  href,
  onClick,
  logo,
  icon,
  name,
  inset = false,
  last = false,
  disabled = false,
}: {
  name: string;
  inset?: boolean;
  last?: boolean;
  disabled?: boolean;
} & ({ logo: string; icon?: undefined } | { logo?: undefined; icon: IonName }) &
  ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void })) {
  const row = `flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-white/[0.04] disabled:opacity-50 ${last ? "" : "border-b border-white/[0.06]"}`;
  const body = (
    <>
      {icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.1] text-white">
          <Ion name={icon} size={18} />
        </span>
      ) : (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-white ${inset ? "p-[5px]" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={32} height={32} className="h-full w-full object-contain" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">{name}</span>
      {/* A row that opens another app says so; the code stays in this sheet. */}
      {onClick && icon ? (
        <Ion name="chevron-forward" size={15} className="shrink-0 text-white/40 rtl:rotate-180" />
      ) : (
        <Ion name="open-outline" size={15} className="shrink-0 text-white/40" />
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={row}>
        {body}
      </button>
    );
  }
  return (
    <a href={href} className={row}>
      {body}
    </a>
  );
}

function BusyLine({ label }: { label: string }) {
  return (
    <p className="flex items-center justify-center gap-2.5 text-center text-[14px] text-white" role="status">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden />
      {label}
    </p>
  );
}

function GlassLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={glassCta}>
      {children}
      <Ion name="open-outline" size={15} />
    </a>
  );
}

function Result({
  icon = "checkmark-circle",
  tone = "text-[#2FBE8A]",
  spinning = false,
  title,
  body,
  children,
}: {
  icon?: "checkmark-circle" | "information-circle-outline" | "time-outline";
  tone?: string;
  spinning?: boolean;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
      {spinning ? (
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-amber" aria-hidden />
      ) : (
        <Ion name={icon} size={40} className={tone} />
      )}
      <h3 className="text-[19px] font-extrabold tracking-[-0.3px] text-white">{title}</h3>
      {body ? <p className="max-w-[340px] text-[14px] leading-[20px] text-[#CFE3EC]">{body}</p> : null}
      {children ? <div className="mt-1 flex w-full flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

function Paid({
  payment,
  payee,
  unit,
  money,
  onPayAgain,
}: {
  payment: PayLinkPayment;
  payee: string;
  unit: string;
  money: (cents: number) => string;
  onPayAgain: (() => void) | null;
}) {
  useT();
  const receipt = receiptPath(payment.receiptUrl);
  const explorer = paymentExplorerUrl(payment);
  return (
    <Result
      title={t("payPage.stable.paidSent", { amount: money(payment.amountCents), payee })}
      body={t("payPage.stable.paidIn", { token: unit, net: CHAIN_LABEL[payment.chain] })}
    >
      {receipt ? (
        <Link href={receipt} className={glassCta}>
          {t("payPage.stable.receiptOpen")}
        </Link>
      ) : null}
      {explorer ? <GlassLink href={explorer}>{t("payPage.stable.viewTx")}</GlassLink> : null}
      {onPayAgain ? (
        <button type="button" className={glassCta} onClick={onPayAgain}>
          {t("payPage.stable.another")}
        </button>
      ) : null}
    </Result>
  );
}

/** Two byte strings are the same bytes. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
