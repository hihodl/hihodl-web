"use client";

/**
 * The checkout — the app's `checkout.tsx` and `CheckoutBlocks.tsx`.
 *
 * THE RATE IS RE-READ HERE, NOT CARRIED
 *
 * The property page could hand this screen the price it was showing. It does
 * not: it hands over an `offerId` and this asks the server again. An `offerId`
 * has a supplier-side lifetime measured in minutes, and a checkout built on a
 * number from a page somebody left open over lunch is a checkout that quotes
 * one price and charges another. If the offer has gone, this says so — which
 * is the honest answer and the same one the hold would have given.
 *
 * THE TYPE SCALE, WHICH IS THE WHOLE LAYOUT
 *
 *   19    the Total, and nothing else
 *   14.5  names: the account, a strong label
 *   13.5  values in a list
 *   13    labels in a list
 *   12.5  the second line under a name
 *   11    section headings
 *
 * WHAT IS DELIBERATELY NOT ADDED UP
 *
 * The city tax sits in its own card under the total and is never folded into
 * it. The property sets it and the property collects it; we never touch that
 * money, and a grand total that includes it would be us quoting a price we do
 * not charge.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useProductHref } from "../base";
import { Ion } from "../ion";
import { linkHref, playHref, usePhone } from "../link/in-app";
import { PhoneApproval } from "../link/PhoneApproval";

import { Banner, Card, Cta, Empty, Photo, Screen, SectionLabel, Spinner } from "./kit";
import { P, boardLabel, count, guests as guestsWord, money, shortDate, stayRange } from "./look";
import { PhotoViewer } from "./PhotoViewer";
import { sane, stayFromParams, stayToParams } from "./SearchControls";
import { usePoints, useRates, useStay, useStaysConfig } from "@/lib/app/stays-data";
import { holdTripProvisionally, refreshTrips, releaseProvisionalTrip } from "@/lib/app/stays-data";
import { approveStay, payForStay, type PayState } from "@/lib/app/stay-payment";
import { getBalances, getWalletStatus, payerOf, WalletApiError, type WalletStatus } from "@/lib/wallet/api";
import { cancelPaymentApproval } from "@/lib/link/payment-approvals";
import { useCreatorSession } from "@/lib/creator/session";
import useSWR from "swr";
import type { Booking, Guest, Rate } from "@/lib/app/stays";
import { staysCurrency } from "@/lib/app/display-currency";

export function CheckoutScreen({ hotelId }: { hotelId: string }) {
  const href = useProductHref();
  const router = useRouter();
  const params = useSearchParams();
  const search = useMemo(() => sane(stayFromParams(new URLSearchParams(params.toString()))), [params]);
  const offerId = params.get("offer");

  const config = useStaysConfig();
  const stay = useStay(hotelId);
  const rates = useRates(hotelId, {
    checkin: search.checkin,
    checkout: search.checkout,
    adults: search.adults,
    ...(search.children.length ? { children: search.children } : {}),
    currency: staysCurrency(),
  }, true);
  const points = usePoints();
  const { session } = useCreatorSession();

  /*
   * The wallet, read rather than unlocked.
   *
   * Paying needs two things from it: the address the deposit leaves from, and
   * a passkey to sign with. `registered_address` gives the first without
   * opening anything, and the passkey ceremony at the moment of paying gives
   * the second. Asking somebody to unlock the vault FIRST and then produce a
   * passkey anyway is one ceremony too many for one payment — and the unlock
   * would buy nothing, because the vault deliberately never hands its seed to
   * anyone.
   */
  const wallet = useSWR<WalletStatus>(session?.user?.id ? [session.user.id, "wallet/status"] : null, () => getWalletStatus(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  /*
   * Who approves (documentation/one-wallet-every-device.md, rule 4): a linked
   * Android phone for every wallet, including one made in the app; otherwise
   * the passkey here for a web wallet; otherwise "Link your phone".
   */
  const payer = payerOf(wallet.data ?? null);
  const from = payer === "app" || payer === "web_passkey" ? (wallet.data?.registered_address ?? null) : null;

  const rate = rates.data?.rates.find((r) => r.offerId === offerId) ?? null;
  /** The property's photographs, over the checkout — never away from it. */
  const [viewing, setViewing] = useState(false);

  /* ── What the person fills in ── */
  const [guest, setGuest] = useState<Guest>({ firstName: "", lastName: "", email: "", phone: "" });
  const [request, setRequest] = useState("");
  const [spend, setSpend] = useState(0);

  // The email we already have beats an empty box. They can change it.
  useEffect(() => {
    const email = session?.user?.email;
    if (email) setGuest((g) => (g.email ? g : { ...g, email }));
  }, [session]);

  const balance = Number(points.data?.balance ?? 0);
  const ceiling = Math.min(balance, rate?.maxPointsRedeemable ?? 0);
  /*
   * What a point takes off, in the RATE's currency, as the server's quote
   * (travel/pricing.service.ts `quote`) computes it: USD 0.01 converted at the
   * backend's FX, served on the rate as `pointValue`, and the discount rounded
   * to cents the way the quote rounds it. So a EUR stay loses about EUR 0.92
   * per 100 points and a JPY stay about JPY 150, never "1 of any currency".
   * A rate from a backend that predates `pointValue` still took
   * `points × pointsUsdValue` off in its own currency, so that is the fallback,
   * and the preview matches whichever server priced the room.
   */
  const pointValue = rate?.pointValue ?? config.data?.pointsUsdValue ?? 0.01;
  const discount = Math.round(spend * pointValue * 100) / 100;
  const total = rate ? Math.max(0, rate.price - discount) : 0;

  /* ── Paying ── */
  const [pay, setPay] = useState<PayState | null>(null);
  const running = pay !== null && !["booked", "stopped", "idle", "approve"].includes(pay.phase);
  // Held and built, waiting for the passkey's tap: nothing on the form may change under it.
  const approving = pay?.phase === "approve";
  const locked = running || approving;
  const phone = usePhone();

  /*
   * Following the phone ends with this page. A pending approval is cancelled
   * as it goes, so the phone cannot approve a deposit nobody is here to send;
   * an approved one is being sent already and is left alone.
   */
  // Made in the effect, not the ref's initial value: strict mode mounts twice, and a controller aborted by the first unmount would stay aborted.
  const stop = useRef<AbortController>(new AbortController());
  const waiting = useRef<string | null>(null);
  waiting.current = pay?.phase === "phone" && pay.approval?.status === "pending" ? pay.approval.id : null;
  useEffect(() => {
    const ctl = new AbortController();
    stop.current = ctl;
    return () => {
      ctl.abort();
      if (waiting.current) void cancelPaymentApproval(waiting.current).catch(() => undefined);
    };
  }, []);
  const [cancel, setCancel] = useState<{ busy: boolean; notice: string | null }>({ busy: false, notice: null });

  /** The server's cancel: the wait then ends on "cancelled" at the next poll. */
  async function cancelOnPhone() {
    if (pay?.phase !== "phone" || !pay.approval) return;
    setCancel({ busy: true, notice: null });
    try {
      await cancelPaymentApproval(pay.approval.id);
    } catch (e) {
      const decided = e instanceof WalletApiError && e.code === "NOT_PENDING";
      setCancel({
        busy: false,
        notice: decided
          ? "Your phone already answered this one, so it can no longer be cancelled."
          : "We couldn't cancel it. Try again, or decline it on your phone.",
      });
    }
  }

  const filled =
    guest.firstName.trim().length > 0 &&
    guest.lastName.trim().length > 0 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email.trim());

  async function start() {
    if (!rate || !stay.data || !from || !session?.user?.id) return;
    setCancel({ busy: false, notice: null });
    let available = 0;
    try {
      // With a linked phone the server prices the deposit, and nothing here reads this.
      available = payer === "app" ? Number.POSITIVE_INFINITY : (await getBalances(from)).usdc;
    } catch {
      // A balance we cannot read is not a reason to refuse a payment that may
      // be perfectly fundable — an RPC hiccup would block it. So we let the
      // run continue: the transfer then fails at the point of sending, which
      // is still BEFORE anything is broadcast, and nothing moves either way.
      // The only cost is a vaguer message than the balance check would give.
      available = Number.POSITIVE_INFINITY;
    }

    const held = pay?.bookingId ?? null;
    const out = await payForStay({
      hold: {
        offerId: rate.offerId,
        hotelId,
        checkin: search.checkin,
        checkout: search.checkout,
        adults: search.adults,
        children: search.children.length,
        guest: { ...guest, phone: guest.phone?.trim() || undefined },
        pointsRequested: spend,
        ...(request.trim() ? { specialRequest: request.trim() } : {}),
      },
      quotedPrice: rate.price,
      from,
      available,
      uid: session.user.id,
      bookingId: held,
      payer: payer === "app" ? "app" : "web_passkey",
      signal: stop.current.signal,
      onState: (s) => {
        setPay(s);
        // The server will not list an unpaid hold, and rightly so. But between
        // paying and it appearing, the trips list would be empty to somebody
        // who just paid — so a placeholder stands in until the real row lands.
        if (s.paid && s.bookingId && stay.data) holdTripProvisionally(placeholder(s.bookingId, stay.data.name, stay.data.city, rate, search, guest));
      },
    });

    after(out);
  }

  /** What the tap on "Approve with passkey" does: straight into the prompt, nothing awaited first. */
  function approve() {
    if (!pay || pay.phase !== "approve" || !from || !session?.user?.id || !rate || !stay.data) return;
    const r = rate;
    const s = stay.data;
    void approveStay({
      uid: session.user.id,
      from,
      current: pay,
      signal: stop.current.signal,
      onState: (next) => {
        setPay(next);
        if (next.paid && next.bookingId) holdTripProvisionally(placeholder(next.bookingId, s.name, s.city, r, search, guest));
      },
    }).then(after);
  }

  function after(out: PayState) {
    if (out.phase === "booked" && out.booking) {
      void refreshTrips();
      router.push(href(`/travel/trips/${out.booking.id}`));
      return;
    }
    // Nothing left the wallet, so nothing should be pretending to be a trip.
    if (!out.paid && out.bookingId && out.phase !== "approve") releaseProvisionalTrip(out.bookingId);
    // Who approves may have changed under us (a phone linked or removed): ask again.
    if (out.phase === "stopped") void wallet.mutate();
  }

  /* ── What to draw ── */

  if (rates.isLoading || stay.isLoading) {
    return (
      <Screen className="py-8">
        <div className="flex justify-center py-20">
          <Spinner size={22} color={P.greenText} />
        </div>
      </Screen>
    );
  }

  if (!rate) {
    return (
      <Screen className="py-8">
        <Empty
          icon="bed-outline"
          title="That rate has gone"
          body="Prices here are held for a few minutes. Nothing has been charged — pick a room again."
          action="Back to the property"
          onAction={() => router.push(`${href(`/travel/stay/${hotelId}`)}?${stayToParams(search)}`)}
        />
      </Screen>
    );
  }

  const board = boardLabel(rate.boardName);

  return (
    <Screen className="gap-4">
      {config.data?.sandbox ? <Banner icon="flask-outline">Test mode — nothing you book here is a real reservation</Banner> : null}

      <button
        type="button"
        onClick={() => router.back()}
        disabled={running}
        className="flex items-center gap-1.5 self-start rounded-[8px] px-2 py-1 text-[12.5px] font-semibold transition-colors hover:bg-white/10 disabled:opacity-40"
        style={{ color: P.textMuted }}
      >
        <Ion name="chevron-back" size={14} />
        Back
      </button>

      <h1 className="text-[25px] font-extrabold leading-tight tracking-[-0.7px]" style={{ color: P.text }}>
        Confirm and pay
      </h1>

      {/* One column, in the app's order: what am I booking · can I still
          cancel · how am I paying · what it comes to. Every choice sits ABOVE
          the total and the total is the last thing before the button, which
          two columns cannot do — there the points band ends up BESIDE the
          total and somebody pays without ever having seen it. */}
      <div className="mx-auto flex w-full min-w-0 max-w-[560px] flex-col">
        {/* ── What am I booking ── */}
        <div className="mt-[22px] flex flex-col gap-3">
          <Card hero className="flex gap-3 p-[14px]">
            {/* The thumbnail is the ONE way back to the pictures from here.
                Leaving the checkout to look at the room again costs the
                offer — the property page mints new ids — so the pictures
                open OVER this screen rather than instead of it. */}
            <button
              type="button"
              aria-label="See the photographs"
              disabled={!stay.data || stay.data.gallery.length === 0}
              onClick={() => setViewing(true)}
              className="h-[62px] w-[62px] shrink-0 cursor-zoom-in overflow-hidden rounded-[12px] p-0 disabled:cursor-default"
              style={{ background: P.card }}
            >
              <Photo image={stay.data?.gallery[0] ?? null} alt={stay.data?.name ?? ""} iconSize={18} sizes="62px" />
            </button>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[14.5px] font-extrabold leading-[19px] tracking-[-0.3px]" style={{ color: P.text }}>
                {stay.data?.name}
              </span>
              {/* One line for the dates AND the party, which is what retires
                  the "Guests" and "Nights" rows the total used to carry. */}
              <span className="mt-0.5 block truncate text-[12.5px] font-medium" style={{ color: P.textMuted }}>
                {`${stayRange(search.checkin, search.checkout)} · ${guestsWord(search.adults, search.children.length)}`}
              </span>
              <span className="mt-px block truncate text-[12px]" style={{ color: P.textDim }}>
                {[rate.roomName, board].filter(Boolean).join(" · ")}
              </span>
            </span>
          </Card>

          {/* ── Can I still cancel ── said once, up here with the booking it
              describes. Never again above the button: that is the screen
              talking somebody out of a purchase they had already decided on. */}
          <Card hero className="flex items-start gap-2.5 px-[14px] py-3">
            <span className="mt-px shrink-0" style={{ color: rate.refundable ? P.greenText : P.textMuted }} aria-hidden>
              <Ion name={rate.refundable ? "shield-checkmark-outline" : "information-circle-outline"} size={17} />
            </span>
            <p className="text-[13px] font-medium leading-[19px]" style={{ color: P.text }}>
              {rate.refundable && rate.freeCancellationUntil
                ? `Cancel free until ${shortDate(rate.freeCancellationUntil.slice(0, 10))}. We refund you in full, back to the account you paid from.`
                : rate.refundable
                  ? "Free cancellation. We refund you in full, back to the account you paid from."
                  : "This rate can't be cancelled or changed once it's booked. It's the reason it's priced the way it is."}
            </p>
          </Card>
        </div>

        {/* ── Who is staying ── */}
        <SectionLabel className="mb-2.5 mt-[22px]">Lead guest</SectionLabel>
          <Card hero className="flex flex-col gap-3 p-[14px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name" value={guest.firstName} onChange={(v) => setGuest({ ...guest, firstName: v })} autoComplete="given-name" disabled={locked} />
              <Field label="Last name" value={guest.lastName} onChange={(v) => setGuest({ ...guest, lastName: v })} autoComplete="family-name" disabled={locked} />
            </div>
            <Field label="Email" value={guest.email} onChange={(v) => setGuest({ ...guest, email: v })} type="email" autoComplete="email" disabled={locked} />
            <Field label="Phone (optional)" value={guest.phone ?? ""} onChange={(v) => setGuest({ ...guest, phone: v })} type="tel" autoComplete="tel" disabled={locked} />
            <p className="text-[11.5px] leading-[17px]" style={{ color: P.textFaint }}>
              The property gets this name and it has to match the passport or ID at the desk.
            </p>
          </Card>

          {/* ── Anything to ask for ── */}
          <SectionLabel className="mb-2.5 mt-[22px]">Anything the property should know</SectionLabel>
          <Card hero className="p-[14px]">
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value.slice(0, 500))}
              disabled={locked}
              rows={3}
              placeholder="A late arrival, a cot, a quiet room. We pass it on — the property decides."
              className="w-full resize-none bg-transparent text-[13.5px] leading-[19px] outline-none placeholder:text-[13px]"
              style={{ color: P.text }}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums" style={{ color: P.textFaint }}>
              {`${request.length}/500`}
            </p>
          </Card>

          {/* ── Points ── */}
          {ceiling > 0 ? (
            <>
              <SectionLabel className="mb-2.5 mt-[22px]">Pay with points</SectionLabel>
              <PointsBand balance={balance} ceiling={ceiling} value={spend} onChange={setSpend} pointValue={pointValue} currency={rate.currency} disabled={locked} />
            </>
          ) : null}

          {/* ── What it comes to ── last, under every choice that changes it. */}
          <div className="mt-[22px] flex flex-col gap-3">
            <Card hero className="flex flex-col px-[14px] py-1.5">
              <Row label="Stay" value={money(rate.price, rate.currency)} />
              {spend > 0 ? <Row label="Points discount" value={`− ${money(discount, rate.currency)}`} tone={P.caution} /> : null}
              <div className="my-2 h-[0.5px]" style={{ background: P.divider }} />
              <Row label="You pay now" value={money(total, rate.currency)} strong />
              {rate.pointsEarned > 0 ? <Row label="Points earned" value={`+ ${count(rate.pointsEarned)}`} tone={P.caution} /> : null}
            </Card>

            {/* Under the total and never folded into it: the app's
                `CheckoutSummary` puts it here too. The property sets this and
                the property collects it, so a grand total that swallowed it
                would be us quoting a price we do not charge. */}
            {rate.payAtProperty !== null && rate.payAtProperty > 0 ? (
              <Card hero className="px-[14px] py-[13px]">
                <div className="flex items-center gap-2">
                  <span style={{ color: P.textMuted }} aria-hidden>
                    <Ion name="business-outline" size={15} />
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] font-bold tracking-[-0.2px]" style={{ color: P.text }}>
                    City tax, collected by the hotel
                  </p>
                  <p className="text-[14.5px] font-extrabold tracking-[-0.3px]" style={{ color: P.text }}>
                    {money(rate.payAtProperty, rate.currency)}
                  </p>
                </div>
                <p className="mt-[7px] text-[12.5px] leading-[18px]" style={{ color: P.textMuted }}>
                  Local tourist tax, charged at check-in by the property. It isn&apos;t part of your stay price and we never collect it.
                </p>
              </Card>
            ) : null}

            <Progress state={pay} />

            {/*
             * No address to pay from means the button cannot work, and the
             * screen has to say WHY rather than sit there disabled.
             *
             * The condition used to be `wallet.data && !from`, which covered
             * two of the three reasons and silently dropped the third: if the
             * wallet status could not be READ at all, `wallet.data` is
             * undefined, so this card never appeared and the Pay button
             * rendered permanently disabled with nothing explaining it. That
             * is not hypothetical — `/wallet-backup/status` answers 404 in
             * production today, because the route ships with the backend
             * integration branch. Somebody fills the whole form, and the only
             * button on the screen never lights up.
             */}
            {!from ? (
              <NoPayer
                wallet={wallet.data ?? null}
                phone={phone}
                onRetry={() => void wallet.mutate()}
                walletHref={href("/wallet")}
                linkHref={linkHref(href, typeof window === "undefined" ? undefined : `${window.location.pathname}${window.location.search}`)}
              />
            ) : pay?.phase === "phone" && pay.approval ? (
              <PhoneApproval approval={pay.approval} cancelling={cancel.busy} notice={cancel.notice} onCancel={() => void cancelOnPhone()} />
            ) : approving ? (
              <>
                {/* The second tap: Safari starts a passkey prompt only inside a click. */}
                <Cta label="Approve with passkey" icon="finger-print" variant="commit" onClick={approve} />
                <p className="text-[11.5px] leading-[17px]" style={{ color: P.textMuted }}>
                  Your room is held. Your passkey approves exactly this payment and signs it.
                </p>
              </>
            ) : (
              <Cta
                label={pay?.phase === "stopped" && pay.bookingId ? "Try again" : `Pay ${money(total, rate.currency)}`}
                variant="commit"
                working={running}
                disabled={!filled || running}
                onClick={() => void start()}
              />
            )}

            <p className="text-[11.5px] leading-[17px]" style={{ color: P.textFaint }}>
              {payer === "app" ? "Paid in USDC from your HOLD wallet, approved and signed on your linked phone. " : "Paid in USDC from your HOLD wallet. "}
              Rooms are supplied and reserved by our booking partner; the stay is provided by the property under its own terms.
            </p>
          </div>
      </div>

      <PhotoViewer
        images={stay.data?.gallery ?? []}
        initialIndex={0}
        open={viewing}
        onClose={() => setViewing(false)}
        title={stay.data?.name}
      />
    </Screen>
  );
}

/* ── The bits ─────────────────────────────────────────────────────── */

/**
 * Why this page cannot pay, and the way forward. Never a dead end
 * (documentation/one-wallet-every-device.md, rule 4):
 *
 *   unread      try again
 *   link first  a wallet made in the app with no Android phone linked: its
 *               keys are on the phone, so link it once and it approves and
 *               signs every stay paid here (/wallet/link, a full load)
 *   no wallet   the Wallet page makes one (a full load: its CSP), or, with
 *               the rollout gate closed, the HOLD app does
 */
function NoPayer({
  wallet,
  phone,
  walletHref,
  linkHref,
  onRetry,
}: {
  wallet: WalletStatus | null;
  phone: ReturnType<typeof usePhone>;
  walletHref: string;
  /** The link screen, coming back here. */
  linkHref: string;
  onRetry: () => void;
}) {
  const payer = payerOf(wallet);
  const app = payer === "link_first" || (wallet?.state === "app_wallet" && payer === "none");
  const web = wallet?.state === "web_wallet";
  const gateOpen = wallet?.enabled !== false;

  const title = !wallet
    ? "We couldn't read your wallet"
    : app
      ? "Link your phone to pay from here"
      : web
        ? "Open your wallet once first"
        : gateOpen
          ? "You need a wallet here first"
          : "Get HOLD to pay";
  const body = !wallet
    ? "Nothing has been charged, and the room is not held. This page has to know which wallet pays before it can ask you to."
    : app
      ? "Your wallet was made in the HOLD app, and its keys stay on your phone. Link the phone once, and it approves and signs every payment you start here. Nothing has been charged."
      : web
        ? "Unlock your wallet on the Wallet page once, so HOLD knows its address. Then this page can pay."
        : gateOpen
          ? "A HOLD wallet in this browser, made once with a passkey. Then this page can pay on its own."
          : "Paying for a stay needs a HOLD wallet, and the HOLD app on Google Play makes one with every chain. Nothing has been charged.";

  let action: ReactNode;
  if (!wallet) action = <Cta label="Try again" variant="secondary" onClick={onRetry} />;
  else if (app) action = <LinkCta href={linkHref} label="Link your phone" />;
  else if (web || gateOpen) action = <LinkCta href={walletHref} label={web ? "Open Wallet" : "Set up the wallet"} />;
  else action = <LinkCta href={playHref(phone)} label="Get HOLD on Google Play" newTab />;

  return (
    <Card hero className="flex flex-col gap-2 p-[14px]">
      <p className="text-[13px] font-bold" style={{ color: P.text }}>
        {title}
      </p>
      <p className="text-[12.5px] leading-[18px]" style={{ color: P.textMuted }}>
        {body}
      </p>
      {action}
    </Card>
  );
}

/** The kit's secondary Cta, as a link: the Wallet page is a full load (its CSP), the app a new tab. */
function LinkCta({ href, label, newTab = false }: { href: string; label: string; newTab?: boolean }) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      className="flex h-[52px] items-center justify-center gap-[9px] rounded-[26px] px-5 text-[16px] font-bold tracking-[-0.2px] transition-opacity active:opacity-85"
      style={{ background: "rgba(255,255,255,0.10)", color: P.text }}
    >
      {label}
    </a>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.7px]" style={{ color: P.textDim }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-[44px] rounded-[14px] px-3.5 text-[14px] font-semibold tracking-[-0.2px] outline-none disabled:opacity-60"
        style={{ background: "rgba(255,255,255,0.06)", border: `0.5px solid ${P.cardBorder}`, color: P.text }}
      />
    </label>
  );
}

function Row({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[6.5px]">
      <span className={strong ? "text-[14.5px] font-extrabold" : "text-[13px] font-medium"} style={{ color: strong ? P.text : P.textMuted }}>
        {label}
      </span>
      <span
        className={strong ? "text-[19px] font-black tabular-nums tracking-[-0.6px]" : "text-[13.5px] font-bold tabular-nums tracking-[-0.2px]"}
        style={{ color: tone ?? P.text }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The five-cell band, not a slider — the app's `PayWithPoints`.
 *
 * A slider invites fiddling with a number that only matters at its ends. Five
 * cells say the same thing in one glance and land on round answers.
 */
function PointsBand({
  balance,
  ceiling,
  value,
  onChange,
  pointValue,
  currency,
  disabled,
}: {
  balance: number;
  ceiling: number;
  value: number;
  onChange: (n: number) => void;
  /** What one point takes off, in `currency` (see the checkout's `discount`). */
  pointValue: number;
  currency: string;
  disabled?: boolean;
}) {
  const steps = [0, 0.25, 0.5, 0.75, 1].map((share) => Math.round(ceiling * share));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((n, i) => {
          const on = value === n;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1.5 py-[11px] disabled:opacity-60"
              style={{
                background: on ? "rgba(255,183,3,0.10)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${on ? "rgba(255,183,3,0.55)" : "transparent"}`,
              }}
            >
              <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.4px]" style={{ color: on ? P.caution : n === 0 ? "rgba(255,255,255,0.28)" : P.text }}>
                {n === 0 ? "None" : count(n)}
              </span>
              <span className="text-[11.5px] font-semibold" style={{ color: on ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.55)" }}>
                {n === 0 ? "keep them" : `− ${money(Math.round(n * pointValue * 100) / 100, currency)}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px]" style={{ color: P.textDim }}>
        {`You have ${count(balance)} pts. This stay takes up to ${count(ceiling)}.`}
      </p>
    </div>
  );
}

/**
 * What the payment is doing, in words nobody has to decode.
 *
 * Note what is missing: a progress bar. The five minutes this can take are not
 * evenly divided and a bar that stalls at 80 % reads as broken. Naming the
 * step is honest and says more.
 */
function Progress({ state }: { state: PayState | null }) {
  // Waiting on the passkey's tap is said under its own button, and waiting on the phone by its own screen.
  if (!state || state.phase === "idle" || state.phase === "approve" || state.phase === "phone") return null;

  const said: Record<PayState["phase"], string | null> = {
    idle: null,
    holding: "Holding your room…",
    opening: "Opening the payment…",
    approve: null,
    phone: null,
    paying: "Sending your payment…",
    settling: "Waiting for the payment to land…",
    booking: "Buying the room…",
    booked: "Booked.",
    stopped: null,
  };

  if (state.phase === "stopped") {
    return state.message ? (
      <div className="flex items-start gap-2.5 rounded-[16px] px-3.5 py-3" style={{ background: P.cautionSoft }}>
        <span className="mt-px shrink-0" style={{ color: P.caution }} aria-hidden>
          <Ion name="information-circle-outline" size={15} />
        </span>
        <p className="text-[12.5px] font-semibold leading-[18px]" style={{ color: P.caution }}>
          {state.message}
        </p>
      </div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[16px] px-3.5 py-3" style={{ background: "rgba(255,255,255,0.06)" }}>
      <Spinner size={15} color={P.greenText} />
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold" style={{ color: P.textMuted }}>
        {said[state.phase]}
      </p>
      {state.paid ? (
        <span className="shrink-0 text-[11px] font-bold" style={{ color: P.greenText }}>
          Paid
        </span>
      ) : null}
    </div>
  );
}

/**
 * The row that stands in while the money lands.
 *
 * It claims as little as it can: no reference, no coordinates, no points, and
 * `cancellable: false`, because no cancel flow exists for a booking the server
 * has not confirmed.
 */
function placeholder(
  id: string,
  name: string,
  city: string | null,
  rate: Rate,
  search: { checkin: string; checkout: string; adults: number; children: number[] },
  guest: Guest,
): Booking {
  return {
    id,
    reference: null,
    referenceKind: null,
    status: "pending",
    hotel: { id: "", name, address: null, phone: null, city, countryCode: null, photo: null, photoLarge: null, latitude: null, longitude: null },
    room: rate.roomName,
    board: rate.boardName,
    checkin: search.checkin,
    checkout: search.checkout,
    adults: search.adults,
    children: search.children.length,
    guestName: `${guest.firstName} ${guest.lastName}`.trim(),
    guest: { firstName: guest.firstName, lastName: guest.lastName, email: guest.email, phone: guest.phone ?? null },
    specialRequest: null,
    currency: rate.currency,
    price: rate.price,
    pointsRedeemed: 0,
    points: { earned: 0, state: "none", creditedAt: null, dueAt: null },
    freeCancelUntil: rate.freeCancellationUntil,
    cancelledAt: null,
    cancellable: false,
    createdAt: new Date().toISOString(),
    isSandbox: false,
  };
}
