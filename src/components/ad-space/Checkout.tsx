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
  fileBrief,
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
  PRODUCTION_FALLBACK_TEXT,
  SESSION_FALLBACK_TEXT,
  compactNumber,
  deliverableText,
  isProductionSpace,
  isSessionSpace,
  serviceName,
  timeLeft,
} from "@/lib/ad-space/format";
import { describeOfferError, offerSolanaPayLink, startOfferCheckout } from "@/lib/ad-space/offers-client";
import { pointsForOfferAmount, pointsForPosition, pointsWorth } from "@/lib/ad-space/points";
import { APP_STORE_URL, PLAY_STORE_URL, SMART_LINK_URL } from "@/lib/appLinks";
import { PUBLIC_CHAINS } from "@/lib/orders/chains.public";
import { fmtNumber } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";
import type { Booking, BriefBody, Chain, EvmPayload, OfferView, Order, Position, Space } from "@/lib/ad-space/types";

import {
  type EvmWallet,
  type SolanaWallet,
  base64ToBytes,
  blockhashExpired,
  switchEvmChain,
  typedData,
} from "@/lib/ad-space/wallets";

import {
  BigAmount,
  CopyButton,
  CreatorChip,
  ExtraRow,
  InfoTip,
  MethodTabs,
  NetworkPill,
  PaidMark,
  PaySheet,
  SheetNotice,
  StatusLine,

  WaitMark,
  WalletRows,
  ctaGlass,
  ctaPrimary,
  dollars,
  feePercent,
  fieldLabel,
  payChainsOf,
  sheetCard,
  useBrowserWallets,
} from "./pay-sheet";
import { BriefForm, BriefReady, EMPTY_BRIEF, PackageLines, PaidProduction, type BriefDraft } from "./Production";
import { QrCode } from "./qr";
import { ManageLinkBox, SessionContactForm } from "./SessionBooking";
import { SponsorContentForm } from "./SponsorContentForm";
import { SpotPreview } from "./ProductBoard";

/**
 * Paying for one spot from the public page, with no HOLD account.
 *
 * Three ways in, one order underneath:
 *   - A wallet in this browser. Solana: we build the transaction, the wallet
 *     signs and sends it, we confirm by signature. Base / Polygon: the wallet
 *     signs two USDC authorizations (no gas) and our relayer submits both in
 *     one transaction.
 *   - Scan to pay (Solana Pay): the sponsor's phone wallet asks our API for
 *     the transaction; the page watches for the order that creates and
 *     confirms it.
 *   - The HOLD app, which earns HiPoints on our fee: the page hands the phone
 *     over to the app.
 * The server decides when an order is paid. Nothing here settles anything,
 * which is why the page is allowed to poll as often as it does.
 *
 * There is deliberately no "send USDC to this address yourself". The server
 * settles only a transaction it issued for the order (its blockhash and
 * reference, both legs, our fee included); a hand-made transfer to the
 * creator is not a sale and would be recorded as a duplicate at best.
 *
 * The networks offered are exactly where the creator can be paid
 * (`payChainsOf`): one network, no picker.
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
  | { kind: "evm-sign"; order: Order; evm: EvmPayload; step: 0 | 1 | 2; wallet: string }
  | { kind: "confirming"; order: Order }
  | { kind: "paid"; order: Order }
  | { kind: "duplicate"; order: Order }
  | { kind: "lapsed" };

type Method = "wallet" | "scan" | "hold";

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
  // Only where the creator can be paid. Taking a sold spot over is only
  // possible on the chains takeovers work on; the position view does not say
  // which chain the holder paid on, so the backend's `wrong_chain` still
  // catches a spot bought elsewhere.
  const t = useT();
  const takingOver = position.status === "sold" && position.takeover !== null;
  const offered = payChainsOf(space);
  const takeoverChains = offered.filter((c) => TAKEOVER_CHAINS.includes(c));
  const chains = takingOver && takeoverChains.length > 0 ? takeoverChains : offered;
  const [chain, setChain] = useState<Chain>(chains.includes("solana") ? "solana" : chains[0]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [method, setMethod] = useState<Method>("wallet");
  const [notice, setNotice] = useState<string | null>(null);
  const { solana: solanaWallets, evm: evmWallets, mobile } = useBrowserWallets();
  const [picked, setPicked] = useState<string | null>(null);
  const [mobileLink, setMobileLink] = useState<string | null>(null);
  /** After a refusal that means "this spot is gone", offer the way back to the board. */
  const [offerOtherSpot, setOfferOtherSpot] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const keyRef = useRef<string>("");
  const signatureRef = useRef<string | null>(null);
  /** A session in person: booked, not sponsored (hispace-in-the-room-v0.md). */
  const session = isSessionSpace(space);
  const subject = session ? "session" : "spot";
  /**
   * Content production (spaces-content-production-v0.md): the brand brings a
   * brief, and brings it before paying. It rides on every checkout call, and
   * is filed under the key first for the QR, whose wallet opens the order.
   */
  const production = isProductionSpace(space);
  const [briefDraft, setBriefDraft] = useState<BriefDraft>(EMPTY_BRIEF);
  const [brief, setBrief] = useState<BriefBody | null>(null);
  const [savingBrief, setSavingBrief] = useState(false);
  const briefRef = useRef<BriefBody | null>(null);
  briefRef.current = production ? brief : null;
  const withBrief = <T extends object>(body: T): T & { brief?: BriefBody } =>
    briefRef.current ? { ...body, brief: briefRef.current } : body;
  /**
   * What paying this from the HOLD app would earn (spaces-sponsor-points-v0.md):
   * on an accepted offer, the fee on the agreed amount; otherwise the fee this
   * spot's payment carries. Null when the server doesn't say, and then the HOLD
   * option promises nothing.
   */
  const holdPoints = offer
    ? pointsForOfferAmount(offer.view.agreedUsdc, space, offer.view)
    : pointsForPosition(position, space);

  /** The checkout calls: the position's, or the accepted offer's at the agreed amount. */
  const offerToken = offer?.token ?? null;
  const beginSolana = useCallback(
    (key: string, sponsorAddress: string) =>
      offerToken
        ? startOfferCheckout(offerToken, key, withBrief({ chain: "solana" as const, sponsorAddress }))
        : startCheckout(position.id, key, withBrief({ chain: "solana" as const, sponsorAddress })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the brief is read from its ref at call time
    [offerToken, position.id],
  );
  const beginEvm = useCallback(
    (key: string, chain: "base" | "polygon", sponsorAddress: string) =>
      offerToken
        ? startOfferCheckout(offerToken, key, withBrief({ chain, sponsorAddress }))
        : startCheckout(position.id, key, withBrief({ chain, sponsorAddress })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the brief is read from its ref at call time
    [offerToken, position.id],
  );
  const explain = useCallback(
    (e: unknown, c: Chain | null) =>
      (offer ? describeOfferError(e, { kind: offer.view.kind, chain: c, subject }) : null) ?? describeError(e, c, subject),
    [offer, subject],
  );

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
     only fetched when the sponsor chooses Scan, whose panel has the same button. */
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
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [ticking]);

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
      setPhase({ kind: "busy", label: t("sponsor.funds.connecting", { name: wallet.name }) });
      const connected = (await wallet.provider.connect()) as { publicKey?: { toString(): string } } | undefined;
      const sponsorAddress = (connected?.publicKey ?? wallet.provider.publicKey)?.toString();
      if (!sponsorAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: t("sponsor.checkout.preparingPayment") });
      const checkout = () =>
        withFreshKey((key) => beginSolana(key, sponsorAddress));
      let [res, web3] = await Promise.all([checkout(), import("@solana/web3.js")]);

      setPhase({ kind: "busy", label: t("sponsor.checkout.approveIn", { name: wallet.name }) });
      let sent: unknown;
      try {
        sent = await wallet.provider.signAndSendTransaction(
          web3.VersionedTransaction.deserialize(base64ToBytes(res.solana.transaction)),
        );
      } catch (e) {
        // Approving took long enough for the blockhash to expire. The same key
        // gets a fresh transaction for the same order: ask once more.
        if (!blockhashExpired(e)) throw e;
        setPhase({ kind: "busy", label: t("sponsor.checkout.approveFresh", { name: wallet.name }) });
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
      if (briefRef.current) {
        // The wallet that scans the code opens the order: the brief waits for it under this key.
        try {
          await fileBrief(position.id, keyRef.current, briefRef.current);
        } catch (e) {
          setNotice(explain(e, "solana"));
          return;
        }
      }
      const c = await checkoutId(keyRef.current);
      setPhase({ kind: "qr", link: solanaPayLink(position.id, c) });
      return;
    }
    // An accepted offer: the server binds this key to the offer and answers the link.
    setPhase({ kind: "busy", label: t("sponsor.checkout.preparingQr") });
    try {
      const link = await withFreshKey(async (key) => {
        if (briefRef.current) await fileBrief(position.id, key, briefRef.current);
        return offerSolanaPayLink(offerToken, key);
      });
      setPhase({ kind: "qr", link });
    } catch (e) {
      setNotice(explain(e, "solana"));
      setOfferOtherSpot(e instanceof CheckoutError && GONE_CODES.has(e.code));
      setPhase({ kind: "choose" });
    }
  }

  async function payWithEvm(evmChain: "base" | "polygon", wallet: EvmWallet) {
    setNotice(null);
    setOfferOtherSpot(false);
    let submitting = false;
    const provider = wallet.provider;
    const meta = PUBLIC_CHAINS[evmChain];
    try {
      setPhase({ kind: "busy", label: t("sponsor.funds.connecting", { name: wallet.name }) });
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const sponsorAddress = accounts?.[0];
      if (!sponsorAddress) throw new Error("no_account");

      setPhase({ kind: "busy", label: t("sponsor.checkout.switching", { name: wallet.name, chain: meta.label }) });
      await switchEvmChain(provider, meta);

      setPhase({ kind: "busy", label: t("sponsor.checkout.preparingPayment") });
      const res = await withFreshKey((key) => beginEvm(key, evmChain, sponsorAddress));
      const creatorAuth = res.evm.authorizations.find((a) => a.role === "creator");
      const feeAuth = res.evm.authorizations.find((a) => a.role === "fee");
      if (!creatorAuth || !feeAuth) throw new CheckoutError("server", 500);

      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 0, wallet: wallet.name });
      const creatorSignature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [sponsorAddress, typedData(res.evm, creatorAuth.message)],
      })) as string;

      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 1, wallet: wallet.name });
      const feeSignature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [sponsorAddress, typedData(res.evm, feeAuth.message)],
      })) as string;

      // The hold starts here, not at checkout: until now this was a quote
      // and another sponsor could sign first.
      setPhase({ kind: "evm-sign", order: res.order, evm: res.evm, step: 2, wallet: wallet.name });
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

  /* ── What the sheet shows ───────────────────────────────────────── */

  const needsBrief = production && !brief;
  const scanWorks = chains.includes("solana");

  /* Choosing Scan draws the QR straight away: no second button to press. */
  const choosing = phase.kind === "choose";
  useEffect(() => {
    if (method !== "scan" || chain !== "solana" || !choosing || needsBrief || notice) return;
    void startQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startQr reads refs; re-running on its identity would loop
  }, [method, chain, choosing, needsBrief, notice]);

  /* A chosen way to pay comes into view whole, the QR most of all. */
  const panelRef = useRef<HTMLDivElement>(null);
  const qrShown = phase.kind === "qr";
  useEffect(() => {
    if (method === "wallet" && !qrShown) return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [method, qrShown]);

  const onMethod = (m: Method) => {
    setMethod(m);
    setNotice(null);
    setOfferOtherSpot(false);
    // Leaving the QR stops watching for it; the key and any order stay as they are.
    if (phase.kind === "qr") setPhase({ kind: "choose" });
  };

  const walletsHere = chain === "solana" ? solanaWallets.map((w) => ({ id: w.name, name: w.name, icon: w.icon ?? null })) : evmWallets;
  const chosen = walletsHere.find((w) => w.id === picked) ?? walletsHere[0] ?? null;

  const figures = amountsOf(position, offer?.view ?? null);
  const total = dollars(figures.totalUsdc);
  const feeNote = space.feeBps > 0 ? t("sponsor.checkout.feeIncluded", { pct: feePercent(space.feeBps) }) : null;
  const busy = phase.kind === "busy" || phase.kind === "evm-sign";
  const heldMs = (o: Order) => new Date(o.reservedUntil).getTime() - now;

  const eyebrow = offer
    ? offer.view.kind === "bid"
      ? t("sponsor.checkout.eyebrow.bid")
      : t("sponsor.checkout.eyebrow.offer")
    : session
      ? t("sponsor.checkout.eyebrow.session")
      : production
        ? t("sponsor.checkout.eyebrow.production")
        : takingOver
          ? t("sponsor.checkout.eyebrow.takeover")
          : t("sponsor.checkout.eyebrow.spot");

  const methods = [
    { id: "wallet" as const, label: t("sponsor.checkout.method.wallet") },
    ...(scanWorks ? [{ id: "scan" as const, label: t("sponsor.checkout.method.scan") }] : []),
    {
      id: "hold" as const,
      label: t("sponsor.checkout.method.hold"),
      badge: holdPoints !== null ? t("sponsor.checkout.method.earn", { amount: pointsWorth(holdPoints) }) : null,
    },
  ];

  const payNow = () => {
    if (!chosen) return;
    if (chain === "solana") {
      const w = solanaWallets.find((s) => s.name === chosen.id);
      if (w) void payWithSolanaWallet(w);
    } else {
      const w = evmWallets.find((e) => e.id === chosen.id);
      if (w) void payWithEvm(chain, w);
    }
  };

  /* The bottom bloc, as in the app: the one action, then one line of trust. */
  const paying = phase.kind === "choose" || phase.kind === "busy" || phase.kind === "evm-sign" || phase.kind === "qr";
  const footer =
    paying && !needsBrief ? (
      <>
        {method === "wallet" && (
          <WalletAction
            phase={phase}
            chosen={chosen}
            hasWallets={walletsHere.length > 0}
            evm={chain !== "solana"}
            total={total}
            now={now}
            onPay={payNow}
            phoneLink={mobile && chain === "solana" ? mobileLink : null}
            onPhoneLink={() => void startQr()}
          />
        )}
        {method === "scan" && phase.kind === "qr" && <StatusLine>{t("sponsor.checkout.waitingForPayment")}</StatusLine>}
        <p className="flex items-center justify-center gap-2 text-center text-tiny text-white/85">
          {t("sponsor.checkout.paidStraight", { handle: space.creator.xHandle })}
          <InfoTip label={t("sponsor.checkout.aboutRefunds")}>
            <Rich
              k={session ? "sponsor.checkout.refund.session" : "sponsor.checkout.refund.spot"}
              vars={{
                policy: FALLBACK_LABEL[space.fallback],
                hint: (production ? PRODUCTION_FALLBACK_TEXT : session ? SESSION_FALLBACK_TEXT : FALLBACK_TEXT)[space.fallback],
                note: space.fallbackNote ? ` ${space.fallbackNote}` : "",
              }}
              tags={{ b: (c) => <span className="text-sp-ink">{c}</span> }}
            />
          </InfoTip>
        </p>
      </>
    ) : null;

  return (
    <PaySheet labelledBy="checkout-title" eyebrow={eyebrow} title={position.label} onClose={onClose} footer={footer}>
      {phase.kind === "paid" ? (
        session ? (
          <PaidSession order={phase.order} space={space} />
        ) : production ? (
          <PaidProduction order={phase.order} space={space} />
        ) : (
          <Paid order={phase.order} space={space} position={position} checkoutKey={keyRef.current} />
        )
      ) : phase.kind === "duplicate" ? (
        <Duplicate order={phase.order} />
      ) : phase.kind === "lapsed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
          <h3 className="font-display text-h4 font-light text-sp-ink">{t("sponsor.checkout.lapsed.title")}</h3>
          <p className="max-w-sm text-small text-white/85">{t("sponsor.checkout.lapsed.body", { subject })}</p>
          <button type="button" className={`${ctaPrimary} max-w-xs`} onClick={startAgain}>
            {t("sponsor.checkout.startAgain")}
          </button>
        </div>
      ) : (
        <>
          {/* Who is paid, how much, on what: Quick Send's head. */}
          <div className="flex flex-col items-center gap-4 pt-1 text-center">
            {/* The spot itself, on the creator's own product: their photo or their colours. */}
            {space.kind === "placement" && space.template ? (
              <SpotPreview
                template={space.template}
                look={space.productLook ?? null}
                viewPhotos={space.viewPhotos ?? null}
                photo={space.photo ?? null}
                positions={space.positions}
                position={position}
              />
            ) : null}
            <CreatorChip creator={space.creator} />
            {/* One figure: what leaves the wallet. The fee is inside it, said once. */}
            <div className="flex flex-col items-center gap-1.5">
              <BigAmount value={dollars(figures.totalUsdc) ?? "—"} />
              {feeNote && (
                <span className="flex items-center gap-1.5 text-tiny text-white/85">
                  {feeNote}
                  {figures.refundsUsdc ? (
                    <InfoTip label={t("sponsor.checkout.takeoverMoney")}>
                      {t("sponsor.checkout.takeoverMoneyBody", { amount: dollars(figures.refundsUsdc) })}
                    </InfoTip>
                  ) : null}
                </span>
              )}
            </div>
            <NetworkPill
              chains={chains}
              chain={chain}
              disabled={busy || phase.kind === "confirming"}
              onChange={(c) => {
                setChain(c);
                setNotice(null);
                setPicked(null);
                if (phase.kind === "qr") setPhase({ kind: "choose" });
              }}
            />
          </div>


          {phase.kind === "loading" && <StatusLine>{t("sponsor.checkout.oneMoment")}</StatusLine>}

          {phase.kind === "confirming" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
              <WaitMark />
              <p className="text-body font-medium text-sp-ink" role="status">
                {t("sponsor.checkout.confirmingOn", { chain: CHAIN_LABEL[phase.order.chain] })}
              </p>
              <HoldLine ms={heldMs(phase.order)} subject={subject} />
            </div>
          ) : needsBrief && phase.kind === "choose" ? (
            <>
              {space.production ? (
                <div className={`${sheetCard} flex flex-col gap-2 p-4`}>
                  <p className={fieldLabel}>{t("sponsor.checkout.whatYouGet")}</p>
                  <PackageLines pkg={space.production} />
                </div>
              ) : null}
              <div className="flex flex-col gap-4">
                <p className={fieldLabel}>{t("sponsor.checkout.briefStep")}</p>
                <BriefForm
                  draft={briefDraft}
                  onChange={setBriefDraft}
                  busy={savingBrief}
                  creatorHandle={space.creator.xHandle}
                  onContinue={(body) => {
                    setSavingBrief(true);
                    setNotice(null);
                    // Checked by the server now, so a problem is said here and not at the wallet.
                    void fileBrief(position.id, keyRef.current, body)
                      .then(() => setBrief(body))
                      .catch((e) => setNotice(explain(e, null)))
                      .finally(() => setSavingBrief(false));
                  }}
                />
              </div>
            </>
          ) : phase.kind !== "loading" ? (
            <>
              {production && brief && phase.kind === "choose" ? (
                <BriefReady brief={brief} onEdit={() => setBrief(null)} />
              ) : !production ? (
                <Included space={space} position={position} session={session} />
              ) : null}

              <MethodTabs options={methods} value={method} onChange={onMethod} disabled={busy} />

              <div ref={panelRef} className="flex scroll-mb-4 flex-col gap-5">
                {method === "wallet" && (
                  <WalletList
                    chain={chain}
                    chains={chains}
                    wallets={walletsHere}
                    chosenId={chosen?.id ?? null}
                    onPick={setPicked}
                    mobile={mobile}
                    mobileLink={mobileLink}
                    busy={busy}
                    onScan={() => onMethod("scan")}
                    onSolana={() => {
                      setChain("solana");
                      onMethod("scan");
                    }}
                    onPhoneLink={() => void startQr()}
                  />
                )}

                {method === "scan" && (
                  <ScanPanel
                    chain={chain}
                    phase={phase}
                    mobile={mobile}
                    canSwitch={scanWorks}
                    onSolana={() => setChain("solana")}
                  />
                )}

                {method === "hold" && (
                  <HoldPanel points={holdPoints} mobile={mobile} takeover={space.pricingMode === "takeover"} />
                )}
              </div>
            </>
          ) : null}

          {notice && (
            <SheetNotice>
              <p>{notice}</p>
              {offerOtherSpot && (
                <div>
                  <button type="button" className={ctaGlass} onClick={onClose}>
                    {t("sponsor.checkout.pickAnother", { subject })}
                  </button>
                </div>
              )}
            </SheetNotice>
          )}

        </>
      )}
    </PaySheet>
  );
}

/* ── The figures ───────────────────────────────────────────────────── */

/**
 * The big number, the total and, on a takeover, the refund inside it. The big
 * number is the price (what the spot costs); the total is what leaves the
 * wallet, fee included, whichever side the creator put it on.
 */
function amountsOf(
  p: Position,
  offer: OfferView | null,
): { headlineUsdc: string | null; totalUsdc: string | null; refundsUsdc: string | null } {
  if (offer?.agreedUsdc && offer.agreedSponsorPaysUsdc) {
    return { headlineUsdc: offer.agreedUsdc, totalUsdc: offer.agreedSponsorPaysUsdc, refundsUsdc: null };
  }
  const t = p.status === "sold" && p.takeover?.nextSponsorPaysUsdc ? p.takeover : null;
  if (t) return { headlineUsdc: t.nextPriceUsdc, totalUsdc: t.nextSponsorPaysUsdc, refundsUsdc: t.refundsUsdc };
  const price = p.priceCents !== null ? (p.priceCents / 100).toFixed(2) : p.creatorReceivesUsdc;
  return { headlineUsdc: price, totalUsdc: p.sponsorPaysUsdc, refundsUsdc: null };
}

/* ── What you get, in three short lines ────────────────────────────── */

function Included({ space, position: p, session }: { space: Space; position: Position; session: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const zone = space.template.zones.find((z) => z.zoneKey === p.zoneKey);
  const perks = p.perks ?? [];
  const c = space.creator;
  const followers = c?.xHandle && c.xFollowers > 0 ? compactNumber(c.xFollowers) : null;
  const reach = followers ? t("sponsor.checkout.included.reach", { count: followers }) : null;
  const event = space.event?.name ?? null;
  // Short first: what the brand is, who sees it, what is promised. The rung's
  // own list, when it has one, is the creator's words and leads.
  const short: string[] = perks.length
    ? perks.slice(0, 2).concat(reach ? [reach] : [])
    : session
      ? [
          event
            ? t("sponsor.checkout.included.sessionAt", { service: serviceName(space), handle: c.xHandle, event })
            : t("sponsor.checkout.included.session", { service: serviceName(space), handle: c.xHandle }),
          ...(reach ? [reach] : []),
        ]
      : space.kind === "placement"
        ? [
            t("sponsor.checkout.included.yourBrand", {
              part: `${p.label.charAt(0).toLowerCase()}${p.label.slice(1)}`,
              product: serviceName(space).toLowerCase(),
            }),
            ...(followers && reach ? [event ? t("sponsor.checkout.included.reachAt", { count: followers, event }) : reach] : []),
            ...(space.deliverables.length
              ? [t("sponsor.checkout.included.posts", { count: space.deliverables.length })]
              : []),
          ]
        : reach
          ? [reach]
          : [];
  const more: string[] = [
    ...perks.slice(2),
    ...space.deliverables.map((d) => deliverableText(d)),
    ...(!session && zone ? [[zone.sizeLabel, t("sponsor.checkout.included.takes", { kinds: p.accepts.map((k) => CONTENT_KIND_LABEL[k]).join(", ") })].filter(Boolean).join(" · ")] : []),
  ];
  if (short.length === 0 && more.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-1">
      <ul className="flex flex-col gap-1.5">
        {short.slice(0, 3).map((line, i) => (
          <li key={i} className="flex items-start gap-2.5 text-small text-[#CFE3EC] [overflow-wrap:anywhere]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[3px] bg-sp-ink/40" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      {more.length > 0 && (
        <>
          {open && (
            <ul className="flex flex-col gap-1.5 pl-4">
              {more.map((line, i) => (
                <li key={i} className="text-tiny text-white/85 [overflow-wrap:anywhere]">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="self-start pl-4 text-tiny font-medium text-sp-amber hover:text-amber-glow"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? t("common.showLess") : t("sponsor.checkout.included.seeMore")}
          </button>
        </>
      )}
    </div>
  );
}

/* ── Pay with a wallet in this browser ─────────────────────────────── */

function WalletList({
  chain,
  chains,
  wallets,
  chosenId,
  onPick,
  mobile,
  mobileLink,
  busy,
  onScan,
  onSolana,
  onPhoneLink,
}: {
  chain: Chain;
  chains: Chain[];
  wallets: { id: string; name: string; icon?: string | null }[];
  chosenId: string | null;
  onPick: (id: string) => void;
  mobile: boolean;
  mobileLink: string | null;
  busy: boolean;
  onScan: () => void;
  onSolana: () => void;
  onPhoneLink: () => void;
}) {
  const t = useT();
  const solana = chain === "solana";
  const extra = busy ? null : solana ? (
    mobile && mobileLink ? (
      <ExtraRow
        title={t("sponsor.parts.openWalletApp")}
        sub={t("sponsor.checkout.wallets.anySolana")}
        href={mobileLink}
        onClick={onPhoneLink}
      />
    ) : (
      <ExtraRow title={t("sponsor.checkout.wallets.another")} sub={t("sponsor.checkout.wallets.scanAny")} onClick={onScan} />
    )
  ) : (
    <>
      <CopyLinkRow />
      {chains.includes("solana") && (
        <ExtraRow title={t("sponsor.checkout.wallets.solanaInstead")} sub={t("sponsor.checkout.wallets.scanAny")} onClick={onSolana} />
      )}
    </>
  );

  if (wallets.length > 0) {
    return <WalletRows wallets={wallets} selected={chosenId} onSelect={onPick} disabled={busy} extra={extra} />;
  }
  // A phone: the button below opens the wallet app itself, so the list has nothing to add.
  if (solana && mobile && mobileLink) {
    return (
      <p className="px-1 text-center text-small text-white/85">
        {t("sponsor.checkout.wallets.opensOnPhone")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-small text-white/85">{t("sponsor.funds.noWallet", { chain: solana ? "Solana" : CHAIN_LABEL[chain] })}</p>
      {extra}
    </div>
  );
}

/** The amber button, or what is happening instead of it. */
function WalletAction({
  phase,
  chosen,
  hasWallets,
  evm,
  total,
  now,
  onPay,
  phoneLink,
  onPhoneLink,
}: {
  phase: Phase;
  chosen: { name: string } | null;
  hasWallets: boolean;
  evm: boolean;
  total: string | null;
  now: number;
  onPay: () => void;
  /** On a phone with no wallet in the browser: the Solana Pay link that opens the wallet app. */
  phoneLink: string | null;
  /** The page starts watching for the order the wallet app will open. */
  onPhoneLink: () => void;
}) {
  const t = useT();
  // The wallet app was opened from here: watch for its payment, as the QR does.
  if (phase.kind === "qr") return <StatusLine>{t("sponsor.checkout.waitingForPayment")}</StatusLine>;
  if (phase.kind === "busy") return <StatusLine>{phase.label}</StatusLine>;
  if (phase.kind === "evm-sign") {
    return (
      <div className="flex flex-col gap-2">
        <StatusLine>
          {phase.step === 2
            ? t("sponsor.checkout.evm.sendingBoth")
            : t("sponsor.checkout.evm.sign", { step: phase.step + 1, wallet: phase.wallet })}
        </StatusLine>
        <QuoteLine ms={phase.evm.validBefore * 1000 - now} />
      </div>
    );
  }
  if (!hasWallets) {
    return phoneLink && phase.kind === "choose" ? (
      <a href={phoneLink} className={ctaPrimary} onClick={onPhoneLink}>
        {t("sponsor.checkout.payInWalletApp", { total: total ?? "" })}
      </a>
    ) : null;
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={ctaPrimary} disabled={!chosen || phase.kind !== "choose"} onClick={onPay}>
        {chosen
          ? t("sponsor.checkout.payWith", { total: total ?? "", name: chosen.name })
          : t("sponsor.checkout.payWithWallet", { total: total ?? "" })}
      </button>
      {evm && (
        <p className="flex items-center justify-center gap-2 text-tiny text-white/85">
          {t("sponsor.checkout.evm.twoSignatures")}
          <InfoTip label={t("sponsor.checkout.evm.whyTwo")}>{t("sponsor.checkout.evm.whyTwoBody")}</InfoTip>
        </p>
      )}
    </div>
  );
}

/** For an EVM wallet this browser does not have: open the page inside that wallet. */
function CopyLinkRow() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <ExtraRow
      title={copied ? t("sponsor.funds.linkCopied") : t("sponsor.funds.useAnother")}
      sub={t("sponsor.funds.useAnotherSub")}
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

/* ── Scan to pay (Solana Pay) ──────────────────────────────────────── */

function ScanPanel({
  chain,
  phase,
  mobile,
  canSwitch,
  onSolana,
}: {
  chain: Chain;
  phase: Phase;
  mobile: boolean;
  canSwitch: boolean;
  onSolana: () => void;
}) {
  const t = useT();
  if (chain !== "solana") {
    return (
      <div className={`${sheetCard} flex flex-col items-center gap-3 px-5 py-6 text-center`}>
        <p className="text-small text-sp-ink">{t("sponsor.checkout.scan.onlySolana")}</p>
        {canSwitch && (
          <button type="button" className={ctaGlass} onClick={onSolana}>
            {t("sponsor.checkout.scan.switch")}
          </button>
        )}
      </div>
    );
  }
  if (phase.kind !== "qr") {
    return phase.kind === "busy" ? <StatusLine>{phase.label}</StatusLine> : <StatusLine>{t("sponsor.checkout.scan.drawing")}</StatusLine>;
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-full max-w-[232px] rounded-[20px] bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        <QrCode text={phase.link} title={t("sponsor.checkout.scan.qrTitle")} className="h-auto w-full" />
      </div>
      <p className="flex items-center gap-2 text-small text-[#CFE3EC]">
        {t("sponsor.checkout.scan.with")}
        <InfoTip label={t("sponsor.checkout.scan.how")}>{t("sponsor.checkout.scan.howBody")}</InfoTip>
      </p>
      {mobile && (
        <a href={phase.link} className={ctaGlass}>
          {t("sponsor.parts.openWalletApp")}
        </a>
      )}
    </div>
  );
}

/* ── Pay from the HOLD app ─────────────────────────────────────────── */

/**
 * What paying from HOLD gets the brand, in money, as the server computes it:
 * points = floor(fee × share), one point = $0.01, credited once the payment
 * confirms (sponsor-points.ts). They are HiPoints, not cash back, and the
 * page says so where it matters: behind the (i).
 */
function HoldPanel({ points, mobile, takeover }: { points: number | null; mobile: boolean; takeover: boolean }) {
  const t = useT();
  const worth = points !== null ? pointsWorth(points) : null;
  return (
    <div
      className="flex flex-col gap-5 overflow-hidden rounded-[20px] p-5 sm:flex-row sm:items-center"
      style={{ background: "linear-gradient(135deg, rgba(255,183,3,0.16) 0%, rgba(255,183,3,0.04) 45%, #15313D 100%)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[26px] font-medium leading-tight tracking-[-0.01em] text-sp-ink">
          {worth ? (
            <Rich k="sponsor.checkout.hold.earn" vars={{ worth }} tags={{ amber: (c) => <span className="text-sp-amber">{c}</span> }} />
          ) : (
            t("sponsor.checkout.hold.title")
          )}
        </p>
        <p className="mt-2 flex items-center gap-2 text-small text-[#CFE3EC]">
          {worth
            ? mobile
              ? t("sponsor.checkout.hold.inPoints")
              : t("sponsor.checkout.hold.inPointsScan")
            : mobile
              ? t("sponsor.checkout.hold.getHold")
              : t("sponsor.checkout.hold.scanGetHold")}
          {worth && (
            <InfoTip label={t("sponsor.checkout.hold.about")}>
              {t(takeover ? "sponsor.checkout.hold.aboutBodyTakeover" : "sponsor.checkout.hold.aboutBody", {
                points: fmtNumber(points ?? 0),
                worth,
              })}
            </InfoTip>
          )}
        </p>
        {mobile && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={ctaGlass}>
              App Store
            </a>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={ctaGlass}>
              Google Play
            </a>
          </div>
        )}
      </div>
      {!mobile && (
        <div className="w-[132px] shrink-0 self-center rounded-[16px] bg-white p-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          <QrCode text={SMART_LINK_URL} title={t("sponsor.appPrompt.qrTitle")} className="h-auto w-full" />
        </div>
      )}
    </div>
  );
}

/* ── Countdowns ────────────────────────────────────────────────────── */

/** A Base/Polygon quote: valid until `validBefore`, holding nothing meanwhile. */
function QuoteLine({ ms }: { ms: number }) {
  const t = useT();
  return ms > 0 ? (
    <p className="flex items-center justify-center gap-2 text-tiny text-white/85">
      <span>
        <Rich
          k="sponsor.checkout.quote.signWithin"
          vars={{ time: timeLeft(ms) }}
          tags={{ n: (c) => <span className="tabular-nums text-white/85">{c}</span> }}
        />
      </span>
      <InfoTip label={t("sponsor.checkout.quote.about")}>{t("sponsor.checkout.quote.aboutBody")}</InfoTip>
    </p>
  ) : (
    <p className="text-center text-tiny text-sp-amber">{t("sponsor.checkout.quote.expired")}</p>
  );
}

function HoldLine({ ms, subject }: { ms: number; subject: "spot" | "session" }) {
  const t = useT();
  return ms > 0 ? (
    <p className="text-small text-white/85">
      <Rich
        k="sponsor.checkout.holdLine"
        vars={{ subject, time: timeLeft(ms) }}
        tags={{ n: (c) => <span className="tabular-nums text-sp-ink">{c}</span> }}
      />
    </p>
  ) : (
    <p className="max-w-sm text-small text-sp-amber">{t("sponsor.checkout.holdRanOut")}</p>
  );
}

/* ── After paying ──────────────────────────────────────────────────── */

function PaidHead({ order, handle, title }: { order: Order; handle: string; title: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      <PaidMark />
      <p className="text-[40px] font-medium leading-none tracking-[-0.02em] text-sp-ink">
        {dollars(order.sponsorPaysUsdc) ?? `${order.sponsorPaysUsdc} USDC`}
      </p>
      <p className="text-body text-sp-ink">{title}</p>
      <p className="text-tiny text-white/85">
        {order.takeover
          ? t("sponsor.checkout.paid.splitTakeover", {
              refunds: dollars(order.takeover.refundsUsdc),
              creator: dollars(order.creatorReceivesUsdc),
              handle,
              fee: dollars(order.feeUsdc),
              chain: CHAIN_LABEL[order.chain],
            })
          : t("sponsor.checkout.paid.split", {
              creator: dollars(order.creatorReceivesUsdc),
              handle,
              fee: dollars(order.feeUsdc),
              chain: CHAIN_LABEL[order.chain],
            })}
      </p>
    </div>
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
  const t = useT();
  const handle = space.creator.xHandle;
  return (
    <div className="flex flex-col gap-6">
      <PaidHead order={order} handle={handle} title={t("sponsor.checkout.paid.sponsoring", { label: position.label.toLowerCase() })} />
      <div className="flex flex-wrap justify-center gap-2">
        {order.explorerUrl && (
          <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={ctaGlass}>
            {t("sponsor.checkout.paid.viewTx")}
          </a>
        )}
        {order.share && (
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(order.share.text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ctaGlass}
          >
            {t("sponsor.checkout.paid.shareOnX")}
          </a>
        )}
      </div>
      {order.takeover && <p className="text-center text-tiny text-white/85">
          {t("sponsor.checkout.paid.listedAt", { amount: dollars(order.priceUsdc) })}
        </p>}
      <div className="border-t border-sp-ink/[0.08] pt-6">
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
  const t = useT();
  const handle = space.creator.xHandle;
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState(order.session ?? null);
  useEffect(() => setToken(rememberManageToken(order)), [order]);
  const onSaved = useCallback((b: Booking) => setSession(b.order.session), []);

  return (
    <div className="flex flex-col gap-6">
      <PaidHead order={order} handle={handle} title={t("sponsor.checkout.paid.sessionBooked")} />
      {order.explorerUrl && (
        <div className="flex justify-center">
          <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={ctaGlass}>
            {t("sponsor.checkout.paid.viewTx")}
          </a>
        </div>
      )}
      {token ? (
        <>
          <ManageLinkBox token={token} />
          <div className="border-t border-sp-ink/[0.08] pt-6">
            <SessionContactForm token={token} session={session} creatorHandle={handle} onSaved={onSaved} />
          </div>
        </>
      ) : (
        <SheetNotice>
          <p>{t("sponsor.checkout.paid.noBookingLink", { handle })}</p>
        </SheetNotice>
      )}
    </div>
  );
}

function Duplicate({ order }: { order: Order }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
      <h3 className="font-display text-h4 font-light text-sp-ink">{t("sponsor.checkout.duplicate.title")}</h3>
      <p className="max-w-sm text-small text-white/85">
        <Rich
          k="sponsor.checkout.duplicate.body"
          vars={{ email: "support@hihodl.xyz", order: order.id.slice(0, 8) }}
          tags={{
            link: (c) => (
              <a
                className="text-sp-amber hover:underline"
                href={`mailto:support@hihodl.xyz?subject=${encodeURIComponent(t("sponsor.checkout.duplicate.subject", { id: order.id }))}`}
              >
                {c}
              </a>
            ),
            mono: (c) => <span className="font-mono text-sp-ink">{c}</span>,
          }}
        />
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {order.explorerUrl && (
          <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={ctaGlass}>
            {t("sponsor.checkout.paid.viewTx")}
          </a>
        )}
        <CopyButton value={order.id} label={t("sponsor.checkout.duplicate.copyId")} />
      </div>
    </div>
  );
}
