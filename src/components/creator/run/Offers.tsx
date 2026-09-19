/**
 * Offers and bids on one listing: the app's Offers section on a space
 * (hihodl-wallet src/features/ad-space/components/CreatorOffers.tsx), on the
 * web.
 *
 * One card per spot (one "Any slot" card on a service, where an offer targets
 * the space), with the spot's own lines (bidding, reserve, hidden minimum),
 * then its open threads, bids ranked highest first, and the closed ones behind
 * "Earlier (n)". Each thread is the app's `OfferThread`: the amount, the
 * sponsor with "Funds checked", the message, the contact, the time left, and
 * Accept, Counter and Decline.
 *
 * ONE FIGURE, THE CREATOR'S
 *
 * Every thread also said "Sponsor pays 420.00 USDC" under the amount, and the
 * counter and the agreement repeated it in brackets. The creator agreed our
 * 5% when they made the listing; restating the sponsor's side of the same
 * money afterwards is the fee charged twice in words. The creator's screens
 * show what the creator gets, once.
 *
 * Accept, Counter and Decline act on the version the creator was shown
 * (`updatedAt`): a thread that moved is refused, and the list reads again. A
 * bid is never countered. The app asks for a counter and a reason in a bottom
 * sheet; the web opens the same form under the thread.
 */

"use client";

import { useState } from "react";

import { relativeTime } from "@/lib/ad-space/format";
import { offerFigures } from "@/lib/ad-space/offers-client";
import { centsFromDollars, centsFromUsdc, type OfferView, type OffersBlock, type SpaceView } from "@/lib/creator/listing";
import { acceptOffer, counterOffer, declineOffer, type DeclineReason } from "@/lib/creator/listings";
import { describeRunError } from "@/lib/creator/problems";

import { ctaCommit, ctaPrimary, ctaSecondary, Notice } from "../../app/hold";
import { Ion, type IonName } from "../../app/ion";
import { Card, Chip, ChipRow, Divider, Empty, Field, inputCls, P, SectionLabel, Tag } from "../../app/spaces/kit";

const OPEN: readonly string[] = ["pending", "countered", "accepted"];

/* ── The app's words (labels.ts, en/adSpace.json) ─────────────────── */

/** offerStatusLabel */
export function offerStatusText(status: string, kind: "offer" | "bid" = "offer"): string {
  switch (status) {
    case "pending":
      return kind === "bid" ? "Bid placed" : "Waiting for the creator";
    case "countered":
      return "Countered";
    case "accepted":
      return "Accepted, waiting for payment";
    case "paid":
      return "Paid";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    case "withdrawn":
      return "Withdrawn";
    case "lapsed":
      return "Not paid in time";
    case "superseded":
      return "Closed, the spot went to someone else";
    default:
      return status;
  }
}

const DECLINE_LABEL: Record<DeclineReason, string> = {
  too_low: "Too low",
  not_a_fit: "Not a fit",
  other: "Other",
};

const CONTACT_LABEL: Record<string, string> = { x: "X", telegram: "Telegram", email: "Email" };

/** formatUsdc: "300.00 USDC". */
export const usdc = (amount: string | null | undefined) => (amount ? `${amount} USDC` : "—");

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** countdownParts: "2d 4h", "5h 12m", "9m", the two largest units. */
export function countdownText(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 60_000);
  const d = Math.floor(total / 1_440);
  const h = Math.floor((total % 1_440) / 60);
  const m = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

/** DeadlineText: the sentence around the time left, or "Time's up" once it has passed. */
export function Deadline({ iso, label, ended = "Time's up. Refreshing…" }: { iso: string | null | undefined; label: (time: string) => string; ended?: string }) {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const left = at - Date.now();
  return <p className={meta}>{left <= 0 ? ended : label(countdownText(left))}</p>;
}

export function FundsChecked() {
  return <Tag label="Funds checked" tone="good" />;
}

const meta = `text-[12.5px] leading-[17px] ${P.dim}`;
const strong = "text-[13.5px] font-bold leading-[18px] text-white";

/** PositionOffersLines, the creator's reading: bidding, open offers, the reserve or hidden minimum only they see. */
export function PositionOffersLines({ offers }: { offers: OffersBlock | null | undefined }) {
  if (!offers) return null;
  const lines: React.ReactNode[] = [];
  if (offers.mode === "bids") {
    if (offers.highestBidUsdc) {
      lines.push(
        <p key="high" className={strong}>
          {offers.leaderName ? `Highest bid ${usdc(offers.highestBidUsdc)} by ${offers.leaderName}` : `Highest bid ${usdc(offers.highestBidUsdc)}`}
        </p>,
      );
    } else if (offers.openingBidUsdc) {
      lines.push(
        <p key="open" className={strong}>
          Bidding opens at {usdc(offers.openingBidUsdc)}
        </p>,
      );
    }
    const facts: string[] = [];
    if (offers.bidCount != null) facts.push(`${offers.bidCount} ${plural(offers.bidCount, "bid", "bids")}`);
    if (offers.reserveMet === true) facts.push("Reserve met");
    if (offers.reserveMet === false) facts.push("Reserve not met");
    if (facts.length) lines.push(<p key="facts" className={meta}>{facts.join(" · ")}</p>);
    if (offers.biddingEndsAt) {
      lines.push(<Deadline key="ends" iso={offers.biddingEndsAt} label={(t) => `Bidding ends in ${t}`} ended="Bidding has ended" />);
    } else if (offers.biddingOpen === false) {
      lines.push(<p key="ended" className={meta}>Bidding has ended</p>);
    }
  } else {
    if (offers.mode === "fixed_with_offers") lines.push(<p key="accepts" className={meta}>Accepts offers</p>);
    if (offers.openCount) {
      lines.push(
        <p key="count" className={meta}>
          {offers.openCount} {plural(offers.openCount, "open offer", "open offers")}
        </p>,
      );
    }
  }
  if (offers.reservedUntil) {
    lines.push(<Deadline key="reserved" iso={offers.reservedUntil} label={(t) => `Reserved for an accepted offer, ${t} to pay`} />);
  }
  if (offers.minOfferUsdc) {
    lines.push(
      <p key="min" className={meta}>
        {offers.mode === "bids" ? `Reserve ${usdc(offers.minOfferUsdc)}, only you see it` : `Hidden minimum ${usdc(offers.minOfferUsdc)}, only you see it`}
      </p>,
    );
  }
  if (!lines.length) return null;
  return <div className="flex flex-col gap-[3px]">{lines}</div>;
}

/* ── The section ──────────────────────────────────────────────────── */

export function Offers({ space, offers, onChanged }: { space: SpaceView; offers: readonly OfferView[]; onChanged: () => void }) {
  const [showClosed, setShowClosed] = useState<Record<string, boolean>>({});
  const isService = space.kind === "service";
  const bidsMode = space.pricingMode === "bids";
  const positions = new Map(space.positions.map((p) => [p.id, p]));

  // groupOffers: by spot, open and closed apart.
  const byPosition = new Map<string, { open: OfferView[]; closed: OfferView[] }>();
  for (const o of offers) {
    const key = isService ? "" : (o.positionId ?? "");
    const g = byPosition.get(key) ?? { open: [], closed: [] };
    (OPEN.includes(o.status) ? g.open : g.closed).push(o);
    byPosition.set(key, g);
  }
  const groups: { positionId: string | null; open: OfferView[]; closed: OfferView[] }[] = isService
    ? [{ positionId: null, ...(byPosition.get("") ?? { open: [], closed: [] }) }]
    : [
        ...space.positions
          .filter((p) => p.offers || byPosition.has(p.id))
          .filter((p) => p.status !== "sold" || byPosition.has(p.id))
          .map((p) => ({ positionId: p.id, ...(byPosition.get(p.id) ?? { open: [], closed: [] }) })),
        ...[...byPosition.entries()]
          .filter(([k]) => !positions.has(k))
          .map(([k, g]) => ({ positionId: k || null, ...g })),
      ];
  const openCount = offers.filter((o) => OPEN.includes(o.status)).length;

  if (offers.length === 0 && groups.every((g) => !g.open.length && !g.closed.length) && !groups.some((g) => g.positionId && positions.get(g.positionId)?.offers)) {
    return <Empty icon="pricetags-outline" title="No offers yet" body="When a brand makes an offer or a bid on one of your spaces, it lands here to accept, counter or decline." />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>{bidsMode ? "Bids" : `Offers (${openCount})`}</SectionLabel>
      {groups.map((g) => {
        const position = g.positionId ? positions.get(g.positionId) : null;
        const summary = position ? position.offers : null;
        const key = g.positionId ?? "space";
        const bids = (summary?.mode ?? (bidsMode ? "bids" : null)) === "bids";
        const open = bids ? [...g.open].sort((a, b) => (centsFromUsdc(b.amountUsdc) ?? 0) - (centsFromUsdc(a.amountUsdc) ?? 0)) : g.open;
        return (
          <Card key={key}>
            <div className="flex items-center justify-between gap-2.5">
              <p className="flex-1 truncate text-[15px] font-strong text-white">{position ? (position.title ?? position.label) : "Any slot"}</p>
              {position ? (
                <Tag
                  label={position.status === "sold" ? "Sold" : position.status === "held" ? "Being paid" : "Open"}
                  tone={position.status === "sold" ? "good" : "calm"}
                />
              ) : null}
            </div>
            <PositionOffersLines offers={summary} />
            {open.length === 0 ? (
              <p className={meta}>{bids ? "No bids yet." : "No open offers."}</p>
            ) : (
              open.map((o, i) => (
                <div key={o.id} className="flex flex-col gap-2.5">
                  <Divider />
                  <OfferThread offer={o} space={space} rank={bids ? i + 1 : null} onChanged={onChanged} />
                </div>
              ))
            )}
            {g.closed.length ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowClosed((c) => ({ ...c, [key]: !c[key] }))}
                  className="flex items-center gap-1 self-start py-1 text-[13px] font-strong text-white/[0.62] hover:text-white"
                >
                  {showClosed[key] ? `Hide earlier (${g.closed.length})` : `Earlier (${g.closed.length})`}
                  <Ion name={showClosed[key] ? "chevron-up" : "chevron-down"} size={14} />
                </button>
                {showClosed[key]
                  ? g.closed.map((o) => (
                      <div key={o.id} className="flex flex-col gap-2.5">
                        <Divider />
                        <OfferThread offer={o} space={space} rank={null} onChanged={onChanged} />
                      </div>
                    ))
                  : null}
              </>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/* ── One thread: the app's OfferThread ────────────────────────────── */

export function OfferCard({ offer, space, onChanged }: { offer: OfferView; space: SpaceView; onChanged: () => void; compact?: boolean }) {
  return <OfferThread offer={offer} space={space} rank={null} onChanged={onChanged} />;
}

function OfferThread({ offer: o, space, rank, onChanged }: { offer: OfferView; space: SpaceView; rank: number | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "counter" | "decline">("none");

  const canAnswer = o.status === "pending" || (o.kind === "offer" && o.status === "countered");
  const canCounter = o.kind === "offer" && o.status === "pending" && o.countersLeft > 0;
  const contact = o.sponsor.contactKind && o.sponsor.contactValue ? { kind: o.sponsor.contactKind, value: o.sponsor.contactValue } : null;
  const contactHref = contact ? contactUrl(contact.kind, contact.value) : null;
  const contactIcon: IonName = contact?.kind === "email" ? "mail-outline" : contact?.kind === "telegram" ? "paper-plane-outline" : "logo-x";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setMode("none");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[5px] rounded-[12px] border border-transparent p-0.5">
      <div className="flex items-center justify-between gap-2.5">
        <p className="flex-1 text-[15px] font-strong tabular-nums text-white">
          {rank ? `${rank}. ` : ""}
          {o.kind === "bid" ? `Bid ${usdc(o.amountUsdc)}` : `Offer ${usdc(o.amountUsdc)}`}
        </p>
        <Tag
          label={o.leading ? "Leading" : offerStatusText(o.status, o.kind)}
          tone={o.status === "accepted" || o.status === "paid" || o.leading ? "good" : o.status === "countered" ? "caution" : "calm"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-[14px] font-strong text-white">{o.sponsor.name}</p>
        {o.sponsor.backed ? <FundsChecked /> : null}
      </div>
      {o.status === "countered" && o.counterUsdc ? (
        <p className={meta}>Your counter: {usdc(o.counterUsdc)}, waiting for their answer</p>
      ) : null}
      {o.status === "accepted" && o.agreedUsdc ? (
        <p className={meta}>Agreed {usdc(o.agreedUsdc)}</p>
      ) : null}
      {o.sponsor.message ? <p className="text-[13.5px] italic leading-[19px] text-white/[0.62]">“{o.sponsor.message}”</p> : null}
      {contact ? (
        contactHref ? (
          <a href={contactHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13px] font-strong text-white/[0.62] hover:text-white">
            <Ion name={contactIcon} size={14} />
            <span className="truncate">
              {CONTACT_LABEL[contact.kind] ?? contact.kind} · {contact.value}
            </span>
          </a>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] font-strong text-white/[0.62]">
            <Ion name={contactIcon} size={14} />
            <span className="truncate">
              {CONTACT_LABEL[contact.kind] ?? contact.kind} · {contact.value}
            </span>
          </p>
        )
      ) : null}
      {o.status === "declined" && o.declineReason ? (
        <p className={meta}>Declined: {DECLINE_LABEL[o.declineReason as DeclineReason] ?? "Other"}</p>
      ) : null}
      {OPEN.includes(o.status) ? (
        <Deadline
          iso={o.expiresAt}
          label={(time) =>
            o.status === "pending"
              ? `${time} left to answer`
              : o.status === "countered"
                ? `${time} left for the sponsor to answer`
                : `${time} left for the sponsor to pay`
          }
        />
      ) : (
        <p className={meta}>{relativeTime(o.updatedAt)}</p>
      )}
      {o.status === "accepted" ? <p className={meta}>If it isn&apos;t paid in time, the acceptance lapses and the spot opens again.</p> : null}
      {canCounter ? (
        <p className={meta}>
          {o.countersLeft} {plural(o.countersLeft, "counter", "counters")} left
        </p>
      ) : null}

      {canAnswer && mode === "none" ? (
        <div className="mt-1 flex gap-2">
          <button type="button" className={`${ctaCommit} flex-1`} disabled={busy} onClick={() => void run(() => acceptOffer(o.id, o.updatedAt)).catch((e) => setNotice(describeRunError(e)))}>
            {busy ? "Working…" : o.status === "countered" ? `Accept ${usdc(o.amountUsdc)}` : "Accept"}
          </button>
          {canCounter ? (
            <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setMode("counter")}>
              Counter
            </button>
          ) : null}
          <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={() => setMode("decline")}>
            Decline
          </button>
        </div>
      ) : null}
      {mode === "none" && notice ? <Notice>{notice}</Notice> : null}

      {mode === "counter" ? (
        <CounterForm
          offer={o}
          space={space}
          onCancel={() => setMode("none")}
          onSubmit={(cents) => run(() => counterOffer(o.id, cents, o.updatedAt))}
        />
      ) : null}
      {mode === "decline" ? (
        <DeclineForm onCancel={() => setMode("none")} onSubmit={(r) => run(() => declineOffer(o.id, r, o.updatedAt))} />
      ) : null}
    </div>
  );
}

function contactUrl(kind: string, value: string): string | null {
  const v = value.trim();
  if (kind === "email") return /^\S+@\S+\.\S+$/.test(v) ? `mailto:${v}` : null;
  const handle = v.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,32}$/.test(handle)) return null;
  if (kind === "telegram") return `https://t.me/${handle}`;
  if (kind === "x") return `https://x.com/${handle}`;
  return null;
}

/* ── The sheets, as forms under the thread ────────────────────────── */

const formCls = "mt-1 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5";
const formTitle = "text-[18px] font-extrabold tracking-[-0.3px] text-white";
const formBody = "text-[13.5px] leading-[19px] text-white/[0.62]";

/** AmountSheet, for a counter: the amount, what the sponsor would pay and what reaches you, worked out as it is typed. */
function CounterForm({ offer, space, onCancel, onSubmit }: { offer: OfferView; space: SpaceView; onCancel: () => void; onSubmit: (cents: number) => Promise<unknown> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cents = centsFromDollars(value);
  const preview = cents !== null ? offerFigures(cents, space.feeBps, space.feePayer) : null;
  const left = Math.max(0, offer.countersLeft - 1);

  const submit = async () => {
    if (cents === null) {
      setError("Type an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(cents);
    } catch (e) {
      setError(describeRunError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={formCls}>
      <p className={formTitle}>Counter</p>
      <p className={formBody}>
        {offer.sponsor.name} offered {usdc(offer.amountUsdc)}. Name your price: they can accept it, raise, or walk away.
      </p>
      <Field label="Your counter (USD)" htmlFor={`counter-${offer.id}`}>
        <input
          id={`counter-${offer.id}`}
          type="text"
          inputMode="decimal"
          autoFocus
          className={inputCls}
          placeholder="300"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      {preview ? (
        <p className="text-[13.5px] font-bold leading-[19px] text-white">You receive {usdc(preview.creatorReceivesUsdc)}</p>
      ) : null}
      <p className={meta}>
        {left} {plural(left, "counter", "counters")} left on this offer after this one
      </p>
      {error ? <Notice>{error}</Notice> : null}
      <button type="button" className={ctaPrimary} disabled={!value.trim() || busy} onClick={() => void submit()}>
        {busy ? "Sending…" : "Send counter"}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** DeclineSheet: a reason, told to the sponsor in these words and nothing more. */
function DeclineForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (reason: DeclineReason) => Promise<unknown> }) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason);
    } catch (e) {
      setError(describeRunError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={formCls}>
      <p className={formTitle}>Decline this offer</p>
      <p className={formBody}>The sponsor is told it was declined and why, in these words and nothing more.</p>
      <ChipRow label="Reason">
        {(["too_low", "not_a_fit", "other"] as DeclineReason[]).map((r) => (
          <Chip key={r} label={DECLINE_LABEL[r]} selected={reason === r} onClick={() => setReason(r)} />
        ))}
      </ChipRow>
      {error ? <Notice>{error}</Notice> : null}
      <button type="button" className={ctaPrimary} disabled={!reason || busy} onClick={() => void submit()}>
        {busy ? "Working…" : "Decline"}
      </button>
      <button type="button" className={ctaSecondary} disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
