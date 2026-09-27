"use client";

/**
 * The public pay page: hihodl.xyz/pay/@handle and hihodl.xyz/pay/<code>.
 *
 * A stranger with no HOLD account pays a HOLD user, the way revolut.me does
 * it, in HOLD's own look: the app's Quick Send screen (QuickSendScreen.tsx)
 * on the Main account's head (ScreenBg account="Main": rgba(0,194,255,0.45)
 * fading out over the app's navy #0D1820).
 *
 *   the face       photo or initials, the HOLD badge on its corner
 *   the amount     Quick Send's 54/900 number and its 30/900 unit, centred,
 *                  and the currency as a pill under it
 *   the note       Quick Send's method row: an uppercase label over the value
 *   how to pay     HOLD (the app, or the store), card, Apple Pay or Google
 *                  Pay (one, by device), stablecoins (the old checkout, in a
 *                  sheet)
 *
 * Card payments are charged in the chosen currency on Coinflow's hosted
 * checkout, framed in a sheet. Stablecoins are always USDC.
 *
 * Every word goes through the language on screen (I18nProvider: this
 * browser's saved choice, else its own languages), chosen at the top right.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Ion, type IonName } from "@/components/app/ion";
import { Modal } from "@/components/app/Modal";
import { Wordmark } from "@/components/site/Wordmark";
import { CheckoutError, checkoutKey, rotateCheckoutKey } from "@/lib/ad-space/checkout-client";
import { fmtFiat } from "@/lib/app/i18n/format";
import { I18nProvider, ensureRates, useFormat, useT } from "@/lib/app/i18n/react";
import { getPrefs } from "@/lib/app/i18n/store";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import {
  CARD_SPENT_KEY_CODES,
  describeCardError,
  getCardPayment,
  rememberCardPayment,
  rememberedCardPayment,
  startCardPayment,
} from "@/lib/pay-links/card";
import { ownerName, payKeyScope } from "@/lib/pay-links/client";
import {
  appSchemeUrl,
  cleanAmountInput,
  defaultCurrency,
  detectPlatform,
  isCoinflowCheckoutUrl,
  isCoinflowOrigin,
  isPhone,
  minorDigits,
  minorFromUsdCents,
  parseMinor,
  readCoinflowMessage,
  usdCentsFromMinor,
  walletMethodFor,
  type Platform,
} from "@/lib/pay-links/page-rules";
import type { CardMethod, CardPayment, ShownPayLink } from "@/lib/pay-links/types";

import { PayLinkPay } from "./PayLinkPay";
import { CurrencyPill, HoldSheet, LanguageButton, OwnerFace } from "./pay-parts";
import { ReportLink } from "./ReportLink";

export type PayPageState = { kind: "unreachable" } | { kind: "disabled" } | { kind: "shown"; link: ShownPayLink };

const NOTE_MAX = 140;
const POLL_MS = 3_000;
const POLL_FOR_MS = 5 * 60_000;
/** How long the page waits for the app to take over before sending the payer to the store. */
const APP_WAIT_MS = 1_500;
/** The stablecoin checkout's own limits (PayLinkPay). */
const STABLE_MIN_CENTS = 100;
const STABLE_MAX_CENTS = 1_000_000;

export function PayPage({ state }: { state: PayPageState }) {
  return (
    <I18nProvider>
      <Ground>
        <TopBar />
        {state.kind === "unreachable" ? (
          <Message titleKey="payPage.unavailableTitle" bodyKey="payPage.unavailableBody" />
        ) : state.kind === "disabled" ? (
          <Message titleKey="payPage.disabledTitle" bodyKey="payPage.disabledBody" />
        ) : (
          <Shown link={state.link} />
        )}
      </Ground>
    </I18nProvider>
  );
}

/* ── The ground and the top bar ─────────────────────────────────── */

function Ground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#0D1820] text-white">
      {/* The app's navy under everything, past the end of a short page too. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[#0D1820]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-[linear-gradient(180deg,rgba(0,194,255,0.45)_0%,rgba(54,224,255,0)_100%)]"
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between">
      <Link href="/" aria-label="HOLD" className="text-white">
        <Wordmark className="h-[18px] w-auto" />
      </Link>
      <LanguageButton />
    </header>
  );
}

function Message({ titleKey, bodyKey }: { titleKey: "payPage.unavailableTitle" | "payPage.disabledTitle"; bodyKey: "payPage.unavailableBody" | "payPage.disabledBody" }) {
  const t = useT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 pb-16 text-center">
      <Ion name="information-circle-outline" size={34} className="text-amber" />
      <h1 className="text-[22px] font-extrabold leading-[28px] tracking-[-0.3px]">{t(titleKey)}</h1>
      <p className="max-w-[340px] text-[15px] leading-[21px] text-[#CFE3EC]">{t(bodyKey)}</p>
    </main>
  );
}

/* ── The page for a link that says what it asks ─────────────────── */

type CardPhase =
  | { kind: "idle" }
  | { kind: "starting"; method: CardMethod }
  | { kind: "checkout"; method: CardMethod; payment: CardPayment; url: string }
  | { kind: "watching"; paymentId: string; since: number; payment: CardPayment | null; slow: boolean }
  | { kind: "paid"; payment: CardPayment }
  | { kind: "failed"; payment: CardPayment };

function useBrowserTags(): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    setTags(navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : []);
  }, []);
  return tags;
}

function Shown({ link }: { link: ShownPayLink }) {
  const t = useT();
  const f = useFormat();
  const active = link.status === "active";
  const card = link.card && link.card.methods.length && link.card.currencies.length ? link.card : null;
  const payee = ownerName(link.owner);
  const bigName = link.owner?.displayName?.trim() || payee;
  const handle = link.owner?.handle ? `@${link.owner.handle}` : null;
  const fixed = link.amount.mode === "fixed" ? link.amount.cents : null;

  /* The device, once in the browser: the server can't know it. */
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    setPageUrl(window.location.href.split("#")[0]);
  }, []);

  /* The currency: the browser's region when the card takes it. */
  const tags = useBrowserTags();
  const choices = useMemo(() => (card ? card.currencies.map((c) => c.toUpperCase()) : ["USD"]), [card]);
  const [picked, setPicked] = useState<string | null>(null);
  const currency = picked && choices.includes(picked) ? picked : defaultCurrency(tags, card ? choices : null);
  useEffect(() => {
    if (currency !== "USD") void ensureRates();
  }, [currency]);
  const rates = getPrefs().rates;

  /* The amount, as typed (open) or as asked (fixed). */
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const typedMinor = fixed === null ? parseMinor(amountText, currency) : null;

  const cardMin = card?.minUsdCents ?? STABLE_MIN_CENTS;
  const openMax = link.amount.mode === "open" ? link.amount.maxCents : null;
  const cardMax = Math.min(card?.maxUsdCents ?? STABLE_MAX_CENTS, openMax ?? Number.POSITIVE_INFINITY);
  /** US cents in the chosen currency; `round` makes a limit whole ("From 1 €", not "From 0,88 €"). */
  const money = (usdCents: number, round?: "up" | "down") => {
    const m = minorFromUsdCents(usdCents, currency, rates);
    if (m === null) return fmtFiat(usdCents / 100, "USD");
    const units = m / 10 ** minorDigits(currency);
    if (!round || currency === "USD") return fmtFiat(units, currency);
    return fmtFiat(round === "up" ? Math.ceil(units) : Math.floor(units), currency, { whole: true });
  };

  /* Sheets. */
  const [sheet, setSheet] = useState<"hold" | "stable" | null>(null);
  const [holdOpening, setHoldOpening] = useState(false);

  /* ── The card ── */
  const scope = payKeyScope(link.code);
  const keyRef = useRef("");
  const [cardPhase, setCardPhase] = useState<CardPhase>({ kind: "idle" });

  useEffect(() => {
    keyRef.current = checkoutKey(scope);
    const id = rememberedCardPayment(link.code);
    if (id) setCardPhase({ kind: "watching", paymentId: id, since: Date.now(), payment: null, slow: false });
  }, [scope, link.code]);

  /** The amount to charge, or null after saying what is wrong with it. */
  function cardAmount(): { amountMinor?: number } | null {
    if (fixed !== null) return {};
    if (typedMinor === null || typedMinor <= 0) {
      setNotice(t("payPage.amountInvalid"));
      return null;
    }
    const usd = usdCentsFromMinor(typedMinor, currency, rates);
    // Without a rate the server judges the amount; with one, say it here first.
    if (usd !== null && (usd < cardMin || usd > cardMax)) {
      setNotice(t("payPage.amountRange", { min: money(cardMin, "up"), max: money(cardMax, "down") }));
      return null;
    }
    return { amountMinor: typedMinor };
  }

  async function payByCard(method: CardMethod) {
    setNotice(null);
    const amount = cardAmount();
    if (!amount) return;
    setCardPhase({ kind: "starting", method });
    const body = { method, currency, ...amount, ...(note.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}) };
    try {
      let res;
      try {
        res = await startCardPayment(link.code, keyRef.current, body);
      } catch (e) {
        if (!(e instanceof CheckoutError) || !CARD_SPENT_KEY_CODES.has(e.code)) throw e;
        keyRef.current = rotateCheckoutKey(scope);
        res = await startCardPayment(link.code, keyRef.current, body);
      }
      if (!isCoinflowCheckoutUrl(res.checkoutUrl)) throw new CheckoutError("server", 0);
      setCardPhase({ kind: "checkout", method, payment: res.payment, url: res.checkoutUrl });
    } catch (e) {
      setNotice(describeCardError(e, { minUsdCents: card?.minUsdCents, maxUsdCents: card?.maxUsdCents, payee }));
      setCardPhase({ kind: "idle" });
    }
  }

  /* Coinflow says the card went through: watch our payment until the USDC lands. */
  const checkoutUrl = cardPhase.kind === "checkout" ? cardPhase.url : null;
  const checkoutPaymentId = cardPhase.kind === "checkout" ? cardPhase.payment.id : null;
  useEffect(() => {
    if (!checkoutUrl || !checkoutPaymentId) return;
    const onMessage = (e: MessageEvent) => {
      if (!isCoinflowOrigin(e.origin, checkoutUrl)) return;
      const m = readCoinflowMessage(e.data);
      if (m?.kind !== "success") return;
      rememberCardPayment(link.code, checkoutPaymentId);
      setCardPhase({ kind: "watching", paymentId: checkoutPaymentId, since: Date.now(), payment: null, slow: false });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [checkoutUrl, checkoutPaymentId, link.code]);

  const watchingId = cardPhase.kind === "watching" && !cardPhase.slow ? cardPhase.paymentId : null;
  const watchingSince = cardPhase.kind === "watching" ? cardPhase.since : 0;
  useEffect(() => {
    if (!watchingId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let wait = POLL_MS;
      try {
        const p = await getCardPayment(watchingId, keyRef.current);
        if (stop) return;
        if (p.status === "paid") {
          rememberCardPayment(link.code, null);
          return setCardPhase({ kind: "paid", payment: p });
        }
        if (p.status !== "pending") {
          rememberCardPayment(link.code, null);
          return setCardPhase({ kind: "failed", payment: p });
        }
        setCardPhase((c) => (c.kind === "watching" ? { ...c, payment: p } : c));
      } catch (e) {
        if (stop) return;
        if (e instanceof CheckoutError && e.code === "not_found") {
          // This key doesn't know the payment (another browser, a cleared key): stop asking.
          rememberCardPayment(link.code, null);
          return setCardPhase({ kind: "idle" });
        }
        if (e instanceof CheckoutError && e.code === "rate_limited") wait = POLL_MS * 4;
      }
      if (Date.now() - watchingSince > POLL_FOR_MS) {
        return setCardPhase((c) => (c.kind === "watching" ? { ...c, slow: true } : c));
      }
      timer = setTimeout(tick, wait);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [watchingId, watchingSince, link.code]);

  function cardAgain() {
    rememberCardPayment(link.code, null);
    setCardPhase({ kind: "idle" });
    setNotice(null);
  }

  /* ── HOLD: the app if it is there, the store if it isn't ── */
  const openHold = useCallback(() => {
    if (!platform) return;
    if (!isPhone(platform)) {
      setSheet("hold");
      return;
    }
    const store = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    const scheme = appSchemeUrl(link);
    if (!scheme) {
      window.location.href = store;
      return;
    }
    setHoldOpening(true);
    let left = false;
    const onHide = () => {
      if (document.visibilityState === "hidden") left = true;
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    window.location.href = scheme;
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      setHoldOpening(false);
      // Still here and still looking at the page: the app isn't installed.
      if (!left && document.visibilityState === "visible") window.location.href = store;
    }, APP_WAIT_MS);
  }, [platform, link]);

  /* ── The rows ── */
  const walletMethod = platform ? walletMethodFor(platform) : null;
  const showCard = !!card && card.methods.includes("card");
  const showWallet = !!card && !!walletMethod && card.methods.includes(walletMethod);
  const busy = cardPhase.kind === "starting";

  const stableAmountText =
    fixed === null && currency === "USD" && typedMinor !== null && typedMinor > 0 ? (typedMinor / 100).toFixed(2) : "";

  const done = cardPhase.kind === "paid" || cardPhase.kind === "failed" || cardPhase.kind === "watching";

  return (
    <main className="flex flex-1 flex-col">
      {/* Who */}
      <section className="flex flex-col items-center pt-4 text-center" aria-label={t("payPage.howMuch")}>
        <OwnerFace owner={link.owner} size={84} />
        <h1 className="mt-4 max-w-full break-words text-[24px] font-extrabold leading-[30px] tracking-[-0.4px] [overflow-wrap:anywhere]">
          {bigName}
        </h1>
        {handle && handle !== bigName ? <p className="mt-0.5 text-[14px] font-strong text-[#9FB7C2]">{handle}</p> : null}
        {!link.personal ? (
          <p className="mt-3 max-w-full break-words text-[15px] font-bold text-white [overflow-wrap:anywhere]">{link.title}</p>
        ) : null}
        {!link.personal && link.note ? (
          <p className="mt-1 max-w-full whitespace-pre-line break-words text-[13px] leading-[18px] text-[#9FB7C2] [overflow-wrap:anywhere]">{link.note}</p>
        ) : null}
      </section>

      {!active ? (
        <Gone link={link} payee={payee} />
      ) : done ? (
        <CardResult phase={cardPhase} payee={bigName} onAgain={cardAgain} />
      ) : (
        <>
          {/* How much */}
          <section className="mt-7 flex flex-col items-center">
            <p className="text-[15px] font-strong text-[#CFE3EC]">{fixed === null ? t("payPage.howMuch") : t("payPage.fixedAmount")}</p>
            <AmountLine
              fixedCents={fixed}
              text={amountText}
              currency={fixed === null ? currency : "USD"}
              onChange={(v) => {
                setAmountText(cleanAmountInput(v, currency));
                setNotice(null);
              }}
              label={t("payPage.amountLabel")}
            />
            <div className="mt-3">
              <CurrencyPill
                currency={currency}
                choices={choices}
                onChange={(c) => {
                  setPicked(c);
                  setAmountText((v) => cleanAmountInput(v, c));
                  setNotice(null);
                }}
              />
            </div>
            <p className={`mt-2.5 min-h-[18px] px-2 text-center text-[13px] leading-[18px] ${notice ? "text-amber" : "text-[#9FB7C2]"}`} role={notice ? "status" : undefined}>
              {notice
                ? notice
                : fixed !== null
                  ? currency !== "USD" && minorFromUsdCents(fixed, currency, rates) !== null
                    ? t("payPage.approx", { amount: money(fixed) })
                    : !card
                      ? t("payPage.usdOnly")
                      : ""
                  : card
                    ? t("payPage.limits", { min: money(cardMin, "up"), max: money(cardMax, "down") })
                    : openMax !== null
                      ? t("payPage.limits", { min: f.fmtFiat(STABLE_MIN_CENTS / 100, "USD"), max: f.fmtFiat(openMax / 100, "USD") })
                      : t("payPage.usdOnly")}
            </p>
          </section>

          {/* The note */}
          <label className="mt-5 flex flex-col rounded-[18px] border border-white/10 bg-white/[0.06] px-4 py-3">
            <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.5px] text-white/50">
              <span>{t("payPage.note")}</span>
              <span className="font-strong normal-case tracking-normal text-white/35">
                {note.length}/{NOTE_MAX}
              </span>
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              placeholder={t("payPage.notePlaceholder")}
              autoComplete="off"
              className="mt-1 w-full min-w-0 bg-transparent text-[15px] font-bold text-white outline-none placeholder:font-medium placeholder:text-white/35"
            />
          </label>

          {/* How to pay */}
          <h2 className="mb-2 mt-6 px-1 text-[13px] font-strong leading-[18px] text-[#9FB7C2]">{t("payPage.howToPay")}</h2>
          <div className="overflow-hidden rounded-[28px] border border-x-white/[0.07] border-b-white/[0.04] border-t-white/[0.16] bg-white/[0.06] backdrop-blur-xl">
            <MethodRow
              icon={<ImgIcon src="/favicon.png" rounded />}
              label={t("payPage.hold")}
              sub={holdOpening ? t("payPage.holdOpening") : t("payPage.holdSub")}
              onClick={openHold}
              disabled={busy || !platform}
            />
            {showCard ? (
              <MethodRow
                icon={<GlyphIcon name="card-outline" />}
                label={t("payPage.card")}
                sub={t("payPage.cardSub", { currency })}
                onClick={() => void payByCard("card")}
                disabled={busy}
                spinning={cardPhase.kind === "starting" && cardPhase.method === "card"}
              />
            ) : null}
            {showWallet && walletMethod ? (
              <MethodRow
                icon={<GlyphIcon name={walletMethod === "applePay" ? "logo-apple" : "logo-google"} tone={walletMethod === "applePay" ? "black" : "white"} />}
                label={walletMethod === "applePay" ? "Apple Pay" : "Google Pay"}
                sub={t("payPage.cardSub", { currency })}
                onClick={() => void payByCard(walletMethod)}
                disabled={busy}
                spinning={cardPhase.kind === "starting" && cardPhase.method === walletMethod}
              />
            ) : null}
            <MethodRow
              icon={<ImgIcon src="/pay/usdc.png" />}
              label={t("payPage.stablecoins")}
              sub={t("payPage.stablecoinsSub")}
              onClick={() => {
                setNotice(null);
                setSheet("stable");
              }}
              disabled={busy}
              last
            />
          </div>
          <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">{t("payPage.warning")}</p>
        </>
      )}

      <Foot link={link} payee={bigName} card={!!card} />

      {sheet === "hold" ? <HoldSheet pageUrl={pageUrl || `https://hihodl.xyz/pay/${link.personal && link.owner?.handle ? `@${link.owner.handle}` : link.code}`} onClose={() => setSheet(null)} /> : null}
      {sheet === "stable" ? (
        <Modal onClose={() => setSheet(null)} title={t("payPage.stableTitle")} size="full">
          <p className="rounded-[12px] bg-white/[0.04] px-3 py-2.5 text-[13px] leading-[18px] text-[#CFE3EC]">{t("payPage.stableUsd")}</p>
          <PayLinkPay link={link} initialAmountText={stableAmountText} />
        </Modal>
      ) : null}
      {cardPhase.kind === "checkout" ? (
        <CardCheckoutSheet
          url={cardPhase.url}
          title={cardPhase.method === "applePay" ? "Apple Pay" : cardPhase.method === "googlePay" ? "Google Pay" : t("payPage.cardTitle")}
          onClose={() => setCardPhase({ kind: "idle" })}
        />
      ) : null}
    </main>
  );
}

/* ── The amount ─────────────────────────────────────────────────── */

/** Quick Send's amount: the number at 54/900 and the unit at 30/900, shrinking as it grows. */
function AmountLine({
  fixedCents,
  text,
  currency,
  onChange,
  label,
}: {
  fixedCents: number | null;
  text: string;
  currency: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const f = useFormat();
  const shown = fixedCents !== null ? f.fmtNumber(fixedCents / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : text;
  const len = Math.max(1, shown.length);
  const size = len <= 6 ? 54 : len <= 8 ? 44 : 36;
  const unit = Math.round(size * 0.56);
  return (
    <div className="mt-2 flex max-w-full items-baseline justify-center gap-2">
      {fixedCents !== null ? (
        <span className="font-black leading-none tracking-[0.5px] text-white tabular-nums" style={{ fontSize: size }}>
          {shown}
        </span>
      ) : (
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          aria-label={label}
          className="min-w-0 bg-transparent text-center font-black leading-none tracking-[0.5px] text-white caret-amber outline-none tabular-nums placeholder:text-white/35"
          style={{ fontSize: size, width: `${len + 0.6}ch`, maxWidth: "calc(100vw - 32px - 5ch)" }}
        />
      )}
      <span className="font-black leading-none text-white" style={{ fontSize: unit }}>
        {currency}
      </span>
    </div>
  );
}

/* ── A row of "How to pay" ──────────────────────────────────────── */

function MethodRow({
  icon,
  label,
  sub,
  onClick,
  disabled,
  spinning,
  last,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full min-w-0 items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-60 ${
        last ? "" : "border-b border-white/[0.06]"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold leading-5 text-white">{label}</span>
        <span className="mt-0.5 block truncate text-[12.5px] leading-4 text-[#9FB7C2]">{sub}</span>
      </span>
      {spinning ? (
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden />
      ) : (
        <Ion name="chevron-forward" size={16} className="shrink-0 text-white/35" />
      )}
    </button>
  );
}

function ImgIcon({ src, rounded = false }: { src: string; rounded?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={36} height={36} className={`h-9 w-9 shrink-0 ${rounded ? "rounded-[10px]" : "rounded-full"}`} />
  );
}

function GlyphIcon({ name, tone = "glass" }: { name: IonName; tone?: "glass" | "black" | "white" }) {
  const bg = tone === "black" ? "bg-black text-white" : tone === "white" ? "bg-white text-[#0A1420]" : "bg-white/10 text-white";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`} aria-hidden>
      <Ion name={name} size={18} />
    </span>
  );
}

/* ── The card's checkout and what came of it ────────────────────── */

function CardCheckoutSheet({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <Modal onClose={onClose} title={title} size="full">
      <div className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[18px] bg-white">
        {!loaded ? (
          <p className="absolute inset-x-0 top-10 text-center text-[14px] text-[#0A1420]/60" role="status">
            {t("payPage.cardStarting")}
          </p>
        ) : null}
        <iframe
          src={url}
          title={title}
          allow="payment"
          onLoad={() => setLoaded(true)}
          className="relative h-full min-h-[520px] w-full flex-1 border-0"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[12px] leading-[17px] text-[#9FB7C2]">{t("payPage.cardSecure")}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-white underline-offset-4 hover:underline">
          {t("payPage.cardOpenTab")}
        </a>
      </div>
    </Modal>
  );
}

function CardResult({ phase, payee, onAgain }: { phase: CardPhase; payee: string; onAgain: () => void }) {
  const t = useT();
  const f = useFormat();
  const p = phase.kind === "paid" || phase.kind === "failed" ? phase.payment : phase.kind === "watching" ? phase.payment : null;
  const amount = p ? (() => {
    try {
      return f.fmtFiat(p.amountMinor / 10 ** minorDigits(p.currency), p.currency);
    } catch {
      return null;
    }
  })() : null;
  const tx = p?.explorerUrl && /^https:\/\//.test(p.explorerUrl) ? p.explorerUrl : null;

  let icon: IonName = "time-outline";
  let tone = "text-amber";
  let title = t("payPage.paidAccepted");
  let body = t("payPage.paidSending", { name: payee });
  if (phase.kind === "watching" && phase.slow) body = t("payPage.paidSlow");
  if (phase.kind === "paid") {
    icon = "checkmark-circle";
    tone = "text-[#2FBE8A]";
    body = amount ? t("payPage.paidDone", { amount, name: payee }) : t("payPage.paidDoneNoAmount", { name: payee });
  }
  if (phase.kind === "failed") {
    icon = "information-circle-outline";
    tone = "text-amber";
    title = "";
    body = p?.status === "declined" ? t("payPage.paidDeclined") : p?.status === "refunded" ? t("payPage.paidRefunded") : t("payPage.paidFailed");
  }

  return (
    <section className="mt-8 flex flex-col items-center gap-3 rounded-[28px] border border-x-white/[0.07] border-b-white/[0.04] border-t-white/[0.16] bg-white/[0.06] px-5 py-7 text-center" role="status">
      {phase.kind === "watching" && !phase.slow ? (
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-amber" aria-hidden />
      ) : (
        <Ion name={icon} size={36} className={tone} />
      )}
      {title ? <h2 className="text-[20px] font-extrabold tracking-[-0.3px]">{title}</h2> : null}
      <p className="max-w-[340px] text-[15px] leading-[21px] text-[#CFE3EC]">{body}</p>
      <div className="mt-2 flex w-full flex-col gap-2.5">
        {tx ? (
          <a href={tx} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[24px] border border-white/[0.22] bg-white/10 text-[15px] font-bold text-white">
            {t("payPage.viewTx")}
            <Ion name="open-outline" size={15} />
          </a>
        ) : null}
        {phase.kind === "failed" ? (
          <button type="button" onClick={onAgain} className="inline-flex h-12 w-full items-center justify-center rounded-[24px] bg-amber text-[15px] font-extrabold text-[#0F0F1A]">
            {t("payPage.tryAgain")}
          </button>
        ) : phase.kind === "paid" ? (
          <button type="button" onClick={onAgain} className="inline-flex h-12 w-full items-center justify-center rounded-[24px] border border-white/[0.22] bg-white/10 text-[15px] font-bold text-white">
            {t("payPage.payAgain")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ── A link that takes no more payments ─────────────────────────── */

function Gone({ link, payee }: { link: ShownPayLink; payee: string }) {
  const t = useT();
  const words = link.personal
    ? { title: t("payPage.gone.personalTitle"), body: t("payPage.gone.personalBody", { name: payee }) }
    : link.status === "paid"
      ? { title: t("payPage.gone.paidTitle"), body: t("payPage.gone.paidBody") }
      : link.status === "closed"
        ? { title: t("payPage.gone.closedTitle"), body: t("payPage.gone.closedBody") }
        : { title: t("payPage.gone.expiredTitle"), body: t("payPage.gone.expiredBody") };
  return (
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-[28px] border border-white/[0.08] bg-white/[0.06] px-5 py-6 text-center">
        <h2 className="text-[19px] font-extrabold tracking-[-0.3px]">{words.title}</h2>
        <p className="text-[14px] leading-[20px] text-[#CFE3EC]">{words.body}</p>
      </div>
      {/* Still mounted: on a paid link it shows this browser its own payment and receipt. */}
      <PayLinkPay link={link} />
    </section>
  );
}

/* ── The foot ───────────────────────────────────────────────────── */

function Foot({ link, payee, card }: { link: ShownPayLink; payee: string; card: boolean }) {
  const t = useT();
  return (
    <footer className="mt-auto flex flex-col items-center gap-2 pt-10 text-center text-[12px] leading-[17px] text-[#9FB7C2]">
      {card ? <p>{t("payPage.coinflow")}</p> : null}
      <p className="max-w-[360px]">{t("payPage.about", { name: payee })}</p>
      <div className="mt-1 flex flex-col items-center [&_button]:self-center">
        <ReportLink code={link.code} />
      </div>
      <nav className="mt-1 flex gap-5" aria-label="Legal">
        <Link href="/terms" className="hover:text-white">
          {t("payPage.terms")}
        </Link>
        <Link href="/privacy" className="hover:text-white">
          {t("payPage.privacy")}
        </Link>
      </nav>
    </footer>
  );
}
