"use client";

/**
 * Book a spot, without leaving the conversation.
 *
 * ── WHY THIS OPENS OVER THE CHAT AND NOT AS A PAGE ──
 *
 * A brand asks a creator a question, gets an answer, and decides. The deciding
 * is the same moment as the asking, and a link that navigated away would end
 * the conversation to start a purchase — then leave the brand on a listing
 * page with no way back to the thread they were reading. So the four steps sit
 * on top of the chat and the last one hands the brand back to it.
 *
 * ── THE FOUR STEPS ARE THE FOUR QUESTIONS ──
 *
 *   where   which event — a creator who sells at three events is three
 *           different decisions, and the price of one says nothing about
 *           another
 *   what    which listing at that event
 *   which   which spot on that listing
 *   pay     the price, what reaches the creator, HiPoints, and one button
 *
 * A creator with one event and one listing still sees them: skipping a step
 * because it happens to have one answer teaches the brand a shape that breaks
 * the next time. What is skipped is nothing.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──
 *
 * Offers and bids. A spot with no price sells by negotiation, which is a
 * conversation with its own rounds and its own version pin — the thing the
 * chat is next to, not a button in a checkout. `claimableSpots` drops them and
 * the screen says so rather than showing a Pay button that cannot work.
 *
 * Takeovers. A sold spot on a takeover board can be bought over somebody's
 * head at double the price, repaying them. That is a decision about another
 * sponsor and it does not belong in a list of things to buy.
 */

import { useEffect, useState } from "react";

import type { CreatorGroup, CreatorPage, Position, SpaceCard, Space } from "@/lib/ad-space/types";
import { payForSpot, type PayPhase, type PointsFeeShare } from "@/lib/app/sponsor";
import { claimableSpots, creatorStorefront, listingSpots, spotPrice } from "@/lib/app/storefront";

import { Ion } from "../ion";

type Step =
  | { at: "events" }
  | { at: "listings"; group: CreatorGroup }
  | { at: "spots"; group: CreatorGroup; card: SpaceCard }
  | { at: "pay"; group: CreatorGroup; card: SpaceCard; space: Space; spot: Position };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function SponsorFlow({
  uid,
  handle,
  creatorName,
  onClose,
  onBought,
}: {
  uid: string;
  handle: string;
  creatorName: string;
  onClose: () => void;
  /** The purchase landed: the chat reloads and draws it. */
  onBought: () => void;
}) {
  const [page, setPage] = useState<CreatorPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>({ at: "events" });

  useEffect(() => {
    let alive = true;
    creatorStorefront(handle).then(
      (p) => alive && setPage(p),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [handle]);

  const back = () => {
    setStep((s) =>
      s.at === "pay"
        ? { at: "spots", group: s.group, card: s.card }
        : s.at === "spots"
          ? { at: "listings", group: s.group }
          : { at: "events" },
    );
  };

  return (
    <Sheet
      title={title(step, creatorName)}
      crumb={crumb(step)}
      onBack={step.at === "events" ? null : back}
      onClose={onClose}
    >
      {failed ? <Note>We could not open {creatorName}&apos;s listings. Close this and try again.</Note> : null}
      {!page && !failed ? <Note>Opening…</Note> : null}

      {page && step.at === "events" ? <Events page={page} onPick={(group) => setStep({ at: "listings", group })} /> : null}

      {step.at === "listings" ? (
        <Listings group={step.group} onPick={(card) => setStep({ at: "spots", group: step.group, card })} />
      ) : null}

      {step.at === "spots" ? (
        <Spots
          spaceId={step.card.spaceId}
          onPick={(space, spot) => setStep({ at: "pay", group: step.group, card: step.card, space, spot })}
        />
      ) : null}

      {step.at === "pay" ? (
        <Pay uid={uid} space={step.space} spot={step.spot} creatorName={creatorName} onBought={onBought} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

/**
 * STRAIGHT TO ONE LISTING — what the board opens.
 *
 * The four steps above answer "where, what, which, pay" because a chat knows a
 * person and nothing else. The board knows the listing already: somebody
 * looking at a card has answered the first two questions by tapping it, and
 * asking them again would be a screen that exists only to be passed through.
 */
export function BuyFromListing({
  uid,
  spaceId,
  listingTitle,
  creatorName,
  onClose,
  onBought,
}: {
  uid: string;
  spaceId: string;
  listingTitle: string;
  creatorName: string;
  onClose: () => void;
  onBought: () => void;
}) {
  const [picked, setPicked] = useState<{ space: Space; spot: Position } | null>(null);
  return (
    <Sheet
      title={picked ? "Checkout" : listingTitle}
      crumb={picked ? picked.spot.title || picked.spot.label : "Pick a spot"}
      onBack={picked ? () => setPicked(null) : null}
      onClose={onClose}
    >
      {picked ? (
        <Pay uid={uid} space={picked.space} spot={picked.spot} creatorName={creatorName} onBought={onBought} onClose={onClose} />
      ) : (
        <Spots spaceId={spaceId} onPick={(space, spot) => setPicked({ space, spot })} />
      )}
    </Sheet>
  );
}

/**
 * The frame both entry points wear.
 *
 * A sheet and not a page, in both cases and for the same reason: buying is
 * something you do in the middle of something else — reading a thread,
 * scanning a board — and a navigation would end the thing you were doing to
 * start this one, then leave you nowhere to go back to.
 */
/**
 * Exported because the artwork hand-over is the step AFTER this flow ends and
 * has to open on the same ground, from a different screen. A second sheet that
 * merely looked like this one would drift the first time either was touched.
 */
export function Sheet({
  title,
  crumb,
  onBack,
  onClose,
  children,
}: {
  title: string;
  crumb: string;
  onBack: (() => void) | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[22px] border border-white/[0.12] bg-[#0E2430] shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:rounded-[22px]">
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-[18px] text-white transition-colors hover:bg-white/10"
            >
              <Ion name="chevron-back" size={21} />
            </button>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center text-white/60">
              <Ion name="storefront-outline" size={19} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold tracking-[-0.2px] text-white">{title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-white/55">{crumb}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-strong text-white/70 transition-colors hover:text-white"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
      </div>
    </div>
  );
}

function title(step: Step, creatorName: string): string {
  if (step.at === "events") return `Book with ${creatorName}`;
  if (step.at === "listings") return groupName(step.group);
  if (step.at === "spots") return step.card.title;
  return "Checkout";
}

function crumb(step: Step): string {
  if (step.at === "events") return "Where do you want to be?";
  if (step.at === "listings") return "What they sell here";
  if (step.at === "spots") return "Pick a spot";
  return step.spot.title || step.spot.label;
}

const groupName = (g: CreatorGroup) => g.event?.name ?? "All year round";

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[13px] leading-[19px] text-white/65">{children}</p>;
}

/* ── Where ────────────────────────────────────────────────────────── */

/**
 * One row per event, in the server's order — upcoming first, then past, then
 * what they sell all year. That order is decided once, on the server, and this
 * never re-sorts it: two screens sorting the same list by different rules is
 * how one creator comes to look like two.
 */
function Events({ page, onPick }: { page: CreatorPage; onPick: (g: CreatorGroup) => void }) {
  const groups = page.groups.filter((g) => g.cards.length > 0);
  if (groups.length === 0) return <Note>There is nothing on sale here right now.</Note>;

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g, i) => {
        const open = g.cards.reduce((n, c) => n + (c.totals?.open ?? 0), 0);
        return (
          <Row
            key={g.event?.slug ?? `all-${i}`}
            title={groupName(g)}
            sub={`${g.cards.length} ${g.cards.length === 1 ? "listing" : "listings"} · ${open} ${open === 1 ? "spot" : "spots"} open`}
            onClick={() => onPick(g)}
          />
        );
      })}
    </div>
  );
}

/* ── What ─────────────────────────────────────────────────────────── */

function Listings({ group, onPick }: { group: CreatorGroup; onPick: (c: SpaceCard) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {group.cards.map((c) => (
        <Row
          key={c.spaceId}
          title={c.serviceName?.trim() || c.title}
          sub={
            c.totals.open > 0
              ? `${c.totals.open} of ${c.totals.positions} open${
                  c.fromPriceCents === null ? "" : ` · from ${money(c.fromPriceCents / 100)}`
                }`
              : "Nothing open on this one"
          }
          disabled={c.totals.open === 0}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

/* ── Which ────────────────────────────────────────────────────────── */

function Spots({ spaceId, onPick }: { spaceId: string; onPick: (space: Space, spot: Position) => void }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    listingSpots(spaceId).then(
      (s) => alive && setSpace(s),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [spaceId]);

  if (failed) return <Note>We could not open that listing. Go back and try again.</Note>;
  if (!space) return <Note>Opening…</Note>;

  const spots = claimableSpots(space);
  if (spots.length === 0) {
    // Named, not hidden: "nothing here" and "this one is negotiated" are
    // different facts, and a brand that came to buy deserves to know which.
    const negotiated = space.positions.some((p) => p.status === "open" && p.priceCents === null);
    return (
      <Note>
        {negotiated
          ? "Every spot on this listing sells by offer, so there is no price to pay here. Make an offer from the listing page and pick it up in the chat."
          : "Every spot on this listing has gone."}
      </Note>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {spots.map((p) => {
        const price = spotPrice(p);
        return (
          <Row
            key={p.id}
            title={p.title?.trim() || p.label}
            sub={[price === null ? null : money(price), p.pitch?.trim() || null].filter(Boolean).join(" · ") || "Spot"}
            right={price === null ? undefined : money(price)}
            onClick={() => onPick(space, p)}
          />
        );
      })}
    </div>
  );
}

/* ── Pay ──────────────────────────────────────────────────────────── */

/** The band's five cells, as every HOLD checkout has them. */
const SHARES: PointsFeeShare[] = [0, 25, 50, 75, 100];

function Pay({
  uid,
  space,
  spot,
  creatorName,
  onBought,
  onClose,
}: {
  uid: string;
  space: Space;
  spot: Position;
  creatorName: string;
  onBought: () => void;
  onClose: () => void;
}) {
  const [share, setShare] = useState<PointsFeeShare>(0);
  const [phase, setPhase] = useState<PayPhase>({ kind: "idle" });
  const price = spotPrice(spot);
  const creatorGets = Number(spot.creatorReceivesUsdc ?? "");

  const buy = () =>
    void payForSpot({
      uid,
      positionId: spot.id,
      pointsFeeShare: share,
      onPhase: setPhase,
    }).then((end) => {
      if (end.kind === "bought" || end.kind === "in-flight") onBought();
    });

  if (phase.kind === "bought") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(255,183,3,0.14)]">
          <Ion name="checkmark" size={24} color="#FFB703" />
        </span>
        <p className="mt-3 text-[16px] font-extrabold tracking-[-0.2px] text-white">The spot is yours</p>
        <p className="mt-1.5 max-w-[320px] text-[13px] leading-[19px] text-white/70">
          {creatorName} has it now. Send them your artwork from Spaces when you are ready.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-[14px] bg-amber px-6 py-3 text-[15px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow"
        >
          Back to the chat
        </button>
      </div>
    );
  }

  if (phase.kind === "in-flight") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <p className="text-[16px] font-extrabold tracking-[-0.2px] text-white">On its way</p>
        <p className="mt-1.5 max-w-[320px] text-[13px] leading-[19px] text-white/70">{phase.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-[14px] bg-white/10 px-6 py-3 text-[15px] font-strong text-white transition-colors hover:bg-white/[0.16]"
        >
          Back to the chat
        </button>
      </div>
    );
  }

  const working = phase.kind !== "idle" && phase.kind !== "stopped";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.05] p-3.5">
        <p className="text-[13px] text-white/60">{space.title}</p>
        <p className="mt-0.5 text-[15px] font-strong text-white">{spot.title?.trim() || spot.label}</p>
        {spot.perks && spot.perks.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {spot.perks.map((perk, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-[17px] text-white/70">
                <Ion name="checkmark" size={13} className="mt-[3px] shrink-0 text-amber" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-2.5">
          <span className="text-[13px] text-white/70">You pay</span>
          <span className="text-[19px] font-extrabold tabular-nums text-white">{price === null ? "—" : money(price)}</span>
        </div>
        {Number.isFinite(creatorGets) && creatorGets > 0 ? (
          <p className="mt-1 text-right text-[11.5px] text-white/55">{money(creatorGets)} reaches {creatorName}</p>
        ) : null}
      </div>

      {/*
        The band, not a switch: five cells, 0 to 100, for the share of OUR fee
        paid with HiPoints. It is our fee and never the creator's money, which
        is why moving it changes what we take and never what they receive.
      */}
      {space.sponsorPointsShareBps ? (
        <div>
          <p className="px-1 text-[12px] font-strong text-white/60">Pay our fee with HiPoints</p>
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {SHARES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={working}
                aria-pressed={share === s}
                onClick={() => setShare(s)}
                className={`inline-flex h-9 shrink-0 items-center rounded-[10px] px-3.5 text-[12.5px] tabular-nums transition-colors disabled:opacity-50 ${
                  share === s
                    ? "border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.12)] font-extrabold text-white"
                    : "bg-white/10 text-white/80 hover:bg-white/[0.15]"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase.kind === "stopped" ? (
        <p className="rounded-[12px] bg-white/[0.06] px-3 py-2.5 text-[12.5px] leading-[18px] text-white/80">{phase.message}</p>
      ) : null}

      <button
        type="button"
        onClick={buy}
        disabled={working || price === null}
        className="mt-1 inline-flex h-12 items-center justify-center rounded-[14px] bg-amber text-[15px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:bg-white/[0.12] disabled:text-white/50"
      >
        {working ? working_label(phase) : price === null ? "Not for sale at a price" : `Pay ${money(price)}`}
      </button>

      <p className="px-1 text-[11.5px] leading-[16px] text-white/50">
        Paid in USDC from your HOLD wallet, approved with your passkey. It goes straight to {creatorName} — we never hold
        it.
      </p>
    </div>
  );
}

/** What the button says while it works. Each one is a real step, not a spinner. */
function working_label(p: PayPhase): string {
  switch (p.kind) {
    case "holding":
      return "Holding the spot…";
    case "approving":
      return "Approve with your passkey…";
    case "signing":
      return "Signing…";
    case "sending":
      return "Sending…";
    case "confirming":
      return "Almost there…";
    default:
      return "Working…";
  }
}

/* ── ─────────────────────────────────────────────────────────────── */

function Row({
  title,
  sub,
  right,
  disabled,
  onClick,
}: {
  title: string;
  sub: string;
  right?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/[0.05]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-strong text-white">{title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-white/[0.62]">{sub}</span>
      </span>
      {right ? <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-white">{right}</span> : null}
      {!disabled ? <Ion name="chevron-forward" size={17} className="shrink-0 text-white/40" /> : null}
    </button>
  );
}
