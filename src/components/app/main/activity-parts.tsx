"use client";

/**
 * One row of Activity, as the app draws it, shared by the two screens that
 * draw it: the Activity card on Home and the Activity screen itself.
 *
 * Ported from the app, component for component:
 *
 *   Avatar      (home)/components/Avatar.tsx   44px, PERSON FIRST — the big
 *                                              circle is the counterparty and
 *                                              the money is demoted
 *   MoveRing    (home)/components/MoveRing.tsx one disc, two arcs, an arrow
 *   the row     PaymentList.tsx / activity/index.tsx — action headline 14/600,
 *                                              counterparty under it at 12,
 *                                              the signed amount 14/700 on the
 *                                              right with the time under it
 *
 * Green means money arrived. A debit is white. No red, anywhere.
 */

import type { CSSProperties, ReactNode } from "react";

import { t } from "@/lib/app/i18n";
import { fmtUsd } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";

import { Ion, type IonName } from "../ion";
import {
  activityAction,
  isYieldSupply,
  isYieldWithdrawal,
  maskSymbol,
  fmtTokenAmount,
  moveSignForScope,
  resolveMoveTitle,
  timeLabel,
  type PaymentItem,
} from "@/lib/app/activity-rules";
import type { DisplayMode } from "@/lib/app/display-mode";
import { isStable } from "@/lib/app/money";
import type { LedgerSubaccount } from "@/lib/app/hold-api";

export const GREEN = "#20D690";

/* ── MoveRing ─────────────────────────────────────────────────────── */

const SIZE = 44;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CENTRE = SIZE / 2;

/** The left half is always the source and the right half the destination. */
const SOURCE_ARC: readonly [number, number] = [200, 350];
const DEST_ARC: readonly [number, number] = [45, 195];

function polar(deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CENTRE + R * Math.cos(rad), CENTRE + R * Math.sin(rad)];
}

function arc([from, to]: readonly [number, number]): string {
  const [x0, y0] = polar(from);
  const [x1, y1] = polar(to);
  const sweep = (to - from + 360) % 360;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * Money that moved between the person's OWN accounts: one disc, two arcs, and
 * an arrow that points from the source to the destination.
 *
 * The source arc is always the left half and the destination the right half,
 * and the arrow always points from one to the other. Reading the arc order
 * clockwise would ask the reader to know where the ring "starts", which nobody
 * does — and take the colour away and the arrow still says which way the money
 * went. Which is also why there is no "unknown" direction here: placing one
 * account on the left IS a claim about order, and a row whose ends we cannot
 * name gets the flat bubble instead.
 */
export function MoveRing({ fromColor, toColor }: { fromColor: string; toColor: string }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      <svg width={SIZE} height={SIZE} aria-hidden focusable="false">
        {/* The full track, visible only in the parting at the top. */}
        <circle cx={CENTRE} cy={CENTRE} r={R} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={STROKE} fill="none" />
        <circle cx={CENTRE} cy={CENTRE} r={R - STROKE} fill="rgba(255,255,255,0.06)" />
        <path d={arc(SOURCE_ARC)} stroke={fromColor} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        <path d={arc(DEST_ARC)} stroke={toColor} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/[0.92]">
        <Ion name="arrow-forward" size={18} />
      </span>
    </span>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────── */

/** The design system's account colours. Savings is silver, never green. */
const ACCOUNT_COLOR: Record<string, string> = { main: "#00C2FF", daily: "#00C2FF", savings: "#C7CED8" };
/** Violet for a pocket we have no colour for. */
const POCKET_FALLBACK = "#A78BFA";
/** The slug the ledger writes for a venue, and the placeholder for an end it could not find. */
const VENUE_SLUG = "earning";
const UNNAMED_SLUG = "unknown";

function accountColor(slug: string | null | undefined): string {
  return ACCOUNT_COLOR[String(slug ?? "").toLowerCase()] ?? POCKET_FALLBACK;
}

/** True when a move endpoint names one of the person's own accounts. */
function isAccountSlug(slug?: string | null): boolean {
  const s = String(slug ?? "").trim().toLowerCase();
  return s.length > 0 && s !== VENUE_SLUG && s !== UNNAMED_SLUG;
}

/** "Ryanair DAC" → "RD", "@ritik" → "RI". */
function initialsFromName(name?: string): string {
  const cleaned = (name ?? "").replace(/^@/, "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

/** True when the title is a raw on-chain address, with no human name in it. */
function isRawAddress(name?: string): boolean {
  if (!name) return true;
  return name.includes("…") || /^0x[0-9a-fA-F]/.test(name) || /^[1-9A-HJ-NP-Za-km-z]{20,}$/.test(name);
}

const RECEIVED_GRADIENT = "linear-gradient(135deg,#A8F55E,#22C97E)";
const SENT_GRADIENT = "linear-gradient(135deg,#FFD25A,#FFB703)";
const EARN_GRADIENT = "linear-gradient(135deg,#A8F55E,#20D690)";

function Disc({ className = "", style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${className}`} style={style}>
      {children}
    </span>
  );
}

/** A token's disc: the two we ship art for, then its own letters, named for the mode. */
function TokenDisc({ symbol, size = 44, mode }: { symbol: string; size?: number; mode: DisplayMode }) {
  const sym = (symbol || "").toUpperCase();
  const art = sym === "USDC" ? "/pay/usdc.png" : sym === "SOL" ? "/pay/solana.svg" : null;
  if (art) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={art} alt="" width={size} height={size} className="shrink-0 rounded-full" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] font-strong text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {maskSymbol(sym, mode).slice(0, 3) || "?"}
    </span>
  );
}

/**
 * The row's face. Person first: the big circle is who, and the money is
 * demoted — on the web there is no mini badge yet, so the circle is all of it.
 */
export function ActivityAvatar({ item, displayTitle, mode }: { item: PaymentItem; displayTitle: string; mode: DisplayMode }) {
  if (item.type === "move") {
    // Asked of the kind, not of the slugs: only the server sees every leg of
    // the event, and a manual supply is labelled "Main → Savings" while
    // nothing changed hands.
    if (item.moveKind === "yield") {
      const glyph: IonName = isYieldWithdrawal(item)
        ? "arrow-down-outline"
        : isYieldSupply(item)
          ? "arrow-up-outline"
          : // "We cannot tell" must never resolve into an answer.
            "swap-vertical-outline";
      return (
        <Disc style={{ backgroundImage: EARN_GRADIENT }}>
          <Ion name={glyph} size={19} color="#06180C" />
        </Disc>
      );
    }
    if (isAccountSlug(item.fromAddress) && isAccountSlug(item.toAddress)) {
      return <MoveRing fromColor={accountColor(item.fromAddress)} toColor={accountColor(item.toAddress)} />;
    }
    // Both ends unknown: the ring would assert an order we do not have.
    return (
      <Disc className="border border-white/[0.14] bg-white/[0.08] text-white/[0.72]">
        <Ion name="swap-horizontal" size={18} />
      </Disc>
    );
  }

  if (item.type === "exchange") {
    return item.tokenSymbol && item.tokenSymbolTo ? (
      <span className="relative block h-11 w-11 shrink-0">
        <span className="absolute left-0 top-[7px]">
          <TokenDisc symbol={item.tokenSymbol} size={30} mode={mode} />
        </span>
        <span className="absolute right-0 top-[7px]">
          <TokenDisc symbol={item.tokenSymbolTo} size={30} mode={mode} />
        </span>
      </span>
    ) : (
      <TokenDisc symbol={item.tokenSymbol ?? "?"} mode={mode} />
    );
  }

  if (item.type === "income") {
    return (
      <Disc style={{ backgroundColor: GREEN }}>
        <Ion name="trending-up-outline" size={18} color="#070C12" />
      </Disc>
    );
  }

  if (item.type === "refund") {
    return (
      <Disc className="border border-white/[0.14] bg-white/[0.08] text-white/[0.72]">
        <Ion name="return-down-back-outline" size={17} />
      </Disc>
    );
  }

  if (item.counterpartyAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.counterpartyAvatarUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" />
    );
  }

  const isHold = item.counterpartyType === "hihodl" || displayTitle.startsWith("@") || !!item.toAlias?.startsWith("@");
  if (isRawAddress(displayTitle) && !isHold) {
    // No human name — an external wallet. Deliberately not tinted: green and
    // amber say who, and we do not know who.
    return (
      <Disc className="border border-[rgba(124,198,232,0.22)] bg-[rgba(124,198,232,0.14)] text-[#7CC6E8]">
        <Ion name="wallet-outline" size={18} />
      </Disc>
    );
  }

  const received = item.type === "in";
  return (
    <Disc style={{ backgroundImage: received ? RECEIVED_GRADIENT : SENT_GRADIENT }}>
      {item.profileEmoji ? (
        <span className="text-[18px] leading-[22px]">{item.profileEmoji}</span>
      ) : (
        <span className="text-[15px] font-bold tracking-[-0.3px]" style={{ color: received ? "#06180C" : "#241A02" }}>
          {initialsFromName(displayTitle)}
        </span>
      )}
    </Disc>
  );
}

/* ── What the row says ────────────────────────────────────────────── */

export interface RowReading {
  /** "Sent", "Moved", "Booked" — the server's verb when it sent one. */
  action: string;
  /** Who or what, under the action. */
  counterparty: string;
  /** The signed amount, already formatted. */
  amount: string;
  /** A swap's spent side, under the received one. */
  amountSecondary?: string;
  sign: "+" | "-" | "";
  processing: boolean;
}

/**
 * The row's words and its sign, in one place, because both screens have to
 * reach the same answer about the same row.
 *
 * `prices` is used only for a volatile row with no frozen dollar value. A
 * price we do not have is not zero: the row falls back to the coin amount
 * rather than print a confident $0.00.
 *
 * `mode` decides what a coin is CALLED when it comes to that — "USD" in
 * fintech, "USDC" in hybrid and native.
 */
export function readRow(
  item: PaymentItem,
  inScope: (slug: string) => boolean,
  subaccounts: readonly LedgerSubaccount[],
  prices: Record<string, number>,
  mode: DisplayMode,
): RowReading {
  const counterparty = item.type === "move" ? resolveMoveTitle(item.fromAddress, item.toAddress, subaccounts) : item.title;
  const processing = item.processing === true;
  const swap = item.type === "exchange";

  // A move carries no sign of its own. A bridge joins it despite arriving as
  // an inbound row: it is the person's own money changing chains, and the "+"
  // the transform put on it would say a relayer paid them.
  const sign: "+" | "-" | "" =
    item.type === "move" || item.moveKind === "bridge"
      ? moveSignForScope(item.fromAddress, item.toAddress, inScope, item.moveKind)
      : item.amount.startsWith("+")
        ? "+"
        : item.amount.startsWith("-")
          ? "-"
          : "";

  let amount = item.amount;
  if (!swap && !processing && Number.isFinite(item.tokenAmount)) {
    const sym = (item.tokenSymbol ?? "").toUpperCase();
    if (isStable(sym)) {
      amount = fmtUsd(Math.abs(item.tokenAmount ?? 0));
    } else {
      const price = prices[sym] ?? (item.tokenMint ? prices[item.tokenMint] : undefined);
      const frozen = Number.isFinite(item.usdValueAtTx)
        ? Math.abs(item.usdValueAtTx as number)
        : Math.abs(item.tokenAmount ?? 0) * (Number.isFinite(price) ? (price as number) : 0);
      amount = frozen > 0 ? fmtUsd(frozen) : `${fmtTokenAmount(Math.abs(item.tokenAmount ?? 0), sym)} ${maskSymbol(sym, mode)}`;
    }
    if (sign) amount = `${sign} ${amount}`;
  }

  return {
    action: item.actionLabel || activityAction(item.type),
    counterparty,
    // Made when the row was read, perhaps in another language: said again in this one.
    amount: processing ? t("activity.processing") : amount,
    amountSecondary: swap ? item.amountSecondary : undefined,
    sign,
    processing,
  };
}

/* ── The row ──────────────────────────────────────────────────────── */

export function ActivityRow({
  item,
  reading,
  onOpen,
  surface,
  mode,
}: {
  item: PaymentItem;
  reading: RowReading;
  onOpen?: () => void;
  /** "card" is the Activity screen's own plate; "flush" is a row inside the Home card. */
  surface: "card" | "flush";
  mode: DisplayMode;
}) {
  const tt = useT();
  const plate =
    surface === "card"
      ? "min-h-16 rounded-[18px] border border-b-white/[0.04] border-l-white/[0.07] border-r-white/[0.07] border-t-white/[0.16] bg-[#15313D] px-3 py-3"
      : "px-4 py-3.5";

  const amountInk = reading.processing
    ? "text-white/[0.40] italic"
    : item.status === "pending"
      ? "text-white/[0.40]"
      : reading.sign === "+"
        ? ""
        : "text-white";

  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <ActivityAvatar item={item} displayTitle={reading.counterparty} mode={mode} />
        <span className="min-w-0 flex-1">
          {/* The action headlines the row; the counterparty drops below it. */}
          <span className="block truncate text-[14px] font-strong text-white">{reading.action}</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/55">{reading.counterparty}</span>
        </span>
      </span>
      <span className="ml-3 flex shrink-0 flex-col items-end">
        <span
          className={`text-right text-[14px] font-bold tabular-nums ${amountInk}`}
          style={reading.sign === "+" && !reading.processing && item.status !== "pending" ? { color: GREEN } : undefined}
        >
          {reading.amount}
        </span>
        {reading.amountSecondary ? (
          <span className="text-right text-[12px] font-medium tabular-nums text-white">{reading.amountSecondary}</span>
        ) : null}
        {/* The day is the divider above; the row shows only the time. */}
        <span className="mt-0.5 text-right text-[12px] font-strong tabular-nums text-white/55">{timeLabel(item.date)}</span>
      </span>
    </>
  );

  const cls = `flex w-full items-center justify-between gap-2 text-left ${plate} ${item.status === "pending" ? "opacity-65" : ""}`;
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} transition-colors hover:bg-white/[0.04]`} aria-label={tt("activity.row.open", { name: reading.counterparty })}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The day divider between two groups of rows. */
export function DayDivider({ label }: { label: string }) {
  return <p className="px-1 pb-2 pt-5 text-[13px] font-bold tracking-[0.2px] text-white/55">{label}</p>;
}
