"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { CHAIN_LABEL, usdFromCents } from "@/lib/ad-space/format";
import { usdcToCents } from "@/lib/ad-space/offers-client";
import type { Chain, Space } from "@/lib/ad-space/types";
import {
  type EvmWallet,
  type SolanaWallet,
  isMobile,
  watchEvmWallets,
  watchSolanaWallets,
} from "@/lib/ad-space/wallets";

import { Spinner } from "./checkout-parts";

/**
 * The shell every public payment step lives in (checkout, offers and bids, the
 * funds check), drawn in the HOLD app's own language: Quick Send's big amount
 * and recipient chip, the sheet's teal fall, one amber button per screen.
 *
 * The values are the app's (`src/theme/colors.ts` in hihodl-wallet):
 *   sheet    #122C36 → #0A1921 (55%) → #08151C, lit top edge white 16%
 *   card     #15313D, a lift of the same ink, never a grey
 *   labels   white 45%, uppercase, tracked
 *   amber    #FFB703 fill for the one action that moves money or sends
 *
 * Selection is a change of COLOUR, never of border width, and a selectable
 * control never takes a 9999 radius (Fabric squares a pill that has one).
 * No red anywhere: attention is amber.
 */

export const SHEET_FALL = "linear-gradient(180deg, #122C36 0%, #0A1921 55%, #08151C 100%)";

/** A card lifted off the sheet, in the sheet's own ink. */
export const sheetCard = "rounded-[16px] bg-[#15313D]";

/** The one amber action. */
export const ctaPrimary =
  "inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[28px] bg-amber px-6 text-body font-medium text-text-on-amber transition-colors duration-180 hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber";

/** Everything else that is a button: white on glass, as the app's secondary actions. */
export const ctaGlass =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[22px] bg-white/[0.10] px-5 text-small font-medium text-text transition-colors duration-180 hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-40";

export const fieldLabel = "text-[11px] font-strong uppercase tracking-[0.08em] text-white/60";

export const sheetInput =
  "w-full rounded-[14px] bg-black/25 px-4 py-3 text-body text-text placeholder:text-white/30 outline-none ring-1 ring-inset ring-white/[0.08] transition-colors duration-180 focus:ring-amber/60 disabled:opacity-60";

/* ── Amounts ─────────────────────────────────────────────────────────── */

/** "131.250000" to "$131.25", "125.00" to "$125". Null for anything that is not an amount. */
export function dollars(usdc: string | null | undefined): string | null {
  const cents = usdcToCents(usdc);
  return cents === null ? null : usdFromCents(cents);
}

/** 500 bps to "5%", 250 to "2.5%". */
export function feePercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/**
 * The networks this page may offer for a space: where the creator can be paid
 * right now. The server says so in `payableChains`; an older server only sends
 * `payTo`, whose families narrow `chains` the same way.
 */
export function payChainsOf(space: Pick<Space, "chains" | "payTo" | "payableChains">): Chain[] {
  const payable = space.payableChains;
  const payTo = space.payTo;
  const narrowed = payable
    ? space.chains.filter((c) => payable.includes(c))
    : payTo
      ? space.chains.filter((c) => Boolean(c === "solana" ? payTo.solana : payTo.evm))
      : space.chains;
  // Never an empty picker: with nothing payable the checkout's own refusal
  // (`chain_unavailable`) says why, which is better than a sheet with no network.
  return narrowed.length > 0 ? narrowed : space.chains;
}

/* ── The shell ───────────────────────────────────────────────────────── */

export function PaySheet({
  labelledBy,
  eyebrow,
  title,
  onClose,
  children,
  footer,
}: {
  labelledBy: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The one action and the line under it, pinned to the bottom like the app's CTA bloc. */
  footer?: ReactNode;
}) {
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#03080B]/75 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative flex h-[calc(100dvh-10px)] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.16] shadow-[0_-12px_48px_rgba(0,0,0,0.45)] sm:m-6 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:min-h-[min(640px,92dvh)] sm:w-[560px] sm:rounded-[28px] sm:border sm:border-white/[0.10] sm:shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={{ background: SHEET_FALL }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-[2px] bg-white/[0.22] sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-1 pt-3 sm:px-8 sm:pt-7">
          <div className="min-w-0">
            <p className={fieldLabel}>{eyebrow}</p>
            <h2 id={labelledBy} className="mt-1 truncate text-body font-medium text-text">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] bg-white/[0.06] text-white/60 transition-colors duration-180 hover:bg-white/[0.12] hover:text-text"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div
          className={`flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pt-3 sm:px-8 ${
            footer ? "pb-5" : "pb-[max(24px,env(safe-area-inset-bottom))] sm:pb-8"
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col gap-3 border-t border-white/[0.06] bg-[#08151C]/90 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:px-8 sm:pb-7">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── The top of the sheet: who is paid, how much, on what ─────────────── */

export function CreatorChip({ creator }: { creator: Pick<Space["creator"], "xHandle" | "xName" | "xAvatarUrl"> }) {
  const initial = (creator.xName || creator.xHandle || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
  return (
    <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-[18px] bg-white/[0.07] pl-1 pr-3.5">
      {creator.xAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- X avatar, served by X
        <img
          src={creator.xAvatarUrl}
          alt=""
          width={28}
          height={28}
          referrerPolicy="no-referrer"
          className="h-7 w-7 shrink-0 rounded-[14px] object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] bg-amber/15 text-tiny font-medium text-amber" aria-hidden>
          {initial}
        </span>
      )}
      <span className="truncate text-small font-medium text-text">@{creator.xHandle}</span>
    </span>
  );
}

/** The amount as the app shows it: big, with the currency small beside it. */
export function BigAmount({ value, unit = "USDC" }: { value: string; unit?: string }) {
  return (
    <p className="flex items-baseline justify-center gap-2 tabular-nums">
      <span className="text-[52px] font-strong leading-none tracking-[-0.035em] text-text sm:text-[60px]">
        {value}
      </span>
      <span className="text-[18px] font-medium text-white/60">{unit}</span>
    </p>
  );
}

export function ChainIcon({ chain, size = 18 }: { chain: Chain; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 1 KB mark from /public
    <img src={`/pay/${chain}.svg`} alt="" width={size} height={size} className="shrink-0 rounded-[6px]" aria-hidden />
  );
}

/**
 * The network, as one pill. With a single network there is nothing to pick,
 * so it is a quiet label ("USDC on Solana"); with more it opens a short list
 * of exactly the networks the creator can be paid on.
 */
export function NetworkPill({
  chains,
  chain,
  onChange,
  disabled = false,
}: {
  chains: Chain[];
  chain: Chain;
  onChange: (c: Chain) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const place = useMenuPlace(open, button, chains.length);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", off);
    // Capture, so the sheet's own Escape (which closes the whole sheet) does not also fire.
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", off);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  if (chains.length <= 1) {
    return (
      <span className="inline-flex h-8 items-center gap-2 text-small text-white/55">
        <ChainIcon chain={chain} size={16} />
        USDC on {CHAIN_LABEL[chain]}
      </span>
    );
  }

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Network: ${CHAIN_LABEL[chain]}. Change`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-[18px] bg-white/[0.08] pl-2 pr-3 text-small font-medium text-text transition-colors duration-180 hover:bg-white/[0.14] disabled:opacity-50"
      >
        <ChainIcon chain={chain} />
        {CHAIN_LABEL[chain]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="text-white/50">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && place && createPortal(
        <ul
          ref={menu}
          role="listbox"
          aria-label="Network"
          className="fixed z-[80] overflow-y-auto rounded-[18px] bg-[#1A3946] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          style={{ left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight }}
        >
          {chains.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={c === chain}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`flex h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-small transition-colors duration-180 ${
                  c === chain ? "bg-white/[0.10] text-text" : "text-white/70 hover:bg-white/[0.05] hover:text-text"
                }`}
              >
                <ChainIcon chain={c} size={22} />
                <span className="flex-1">USDC on {CHAIN_LABEL[c]}</span>
                {c === chain && <Tick className="text-amber" />}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

/**
 * Where the network menu goes: a fixed box under the pill (or above it when
 * the room below is short), clamped inside the viewport with a 12px margin.
 *
 * The menu used to be absolutely positioned inside the sheet, whose body
 * scrolls and clips: it was cut off at the sheet's edge and widened the page
 * into a horizontal scrollbar. Portalled to <body> and fixed, it can never do
 * either; it follows the pill when the sheet scrolls or the window resizes.
 */
function useMenuPlace(
  open: boolean,
  anchor: RefObject<HTMLElement>,
  rows: number,
): { left: number; top: number; width: number; maxHeight: number } | null {
  const [place, setPlace] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const measure = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const margin = 12;
      const width = Math.min(240, vw - margin * 2);
      const wanted = rows * 48 + 12;
      const left = Math.min(Math.max(margin, r.left + r.width / 2 - width / 2), vw - margin - width);
      const below = vh - r.bottom - margin - 8;
      const above = r.top - margin - 8;
      const down = below >= Math.min(wanted, 160) || below >= above;
      const maxHeight = Math.max(96, Math.min(wanted, down ? below : above));
      const top = down ? r.bottom + 8 : r.top - 8 - maxHeight;
      setPlace({ left, top, width, maxHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    // Any scroll (the sheet's body, the page) moves the pill: follow it.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, anchor, rows]);
  return place;
}

/** The one row that says what leaves the wallet. */
export function TotalRow({
  label = "Total",
  totalUsdc,
  note,
  info,
}: {
  label?: string;
  totalUsdc: string | null;
  /** "includes 5% HOLD fee" */
  note?: string | null;
  info?: ReactNode;
}) {
  return (
    <div className={`${sheetCard} flex items-center justify-between gap-3 px-4 py-3.5`}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-small text-text">{label}</span>
        {note && <span className="text-tiny text-white/60">({note})</span>}
        {info}
      </span>
      <span className="shrink-0 text-body font-medium tabular-nums text-text">{dollars(totalUsdc) ?? "—"}</span>
    </div>
  );
}

/* ── A small (i) with its explanation behind it ─────────────────────── */

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(288, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - 16 - width));
      // Low on the screen it opens upwards, so it is never cut off by the fold.
      setPlace(
        r.bottom > window.innerHeight * 0.62
          ? { left, width, bottom: window.innerHeight - r.top + 8 }
          : { left, width, top: r.bottom + 8 },
      );
    };
    measure();
    const off = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !tip.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    document.addEventListener("mousedown", off);
    document.addEventListener("touchstart", off);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("mousedown", off);
      document.removeEventListener("touchstart", off);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] align-middle font-serif text-[12px] italic leading-none transition-colors duration-180 ${
          open ? "bg-white/[0.20] text-text" : "bg-white/[0.08] text-white/60 hover:bg-white/[0.14] hover:text-text"
        }`}
      >
        i
      </button>
      {open && place && (
        <div
          ref={tip}
          role="tooltip"
          className="fixed z-[80] rounded-[14px] bg-[#1F404E] px-4 py-3 text-tiny leading-relaxed text-[#CFE3EC] shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
          style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
        >
          {children}
        </div>
      )}
    </>
  );
}

/* ── How to pay ─────────────────────────────────────────────────────── */

export type MethodOption<T extends string> = { id: T; label: string; badge?: string | null };

/** The ways to pay, as one segmented control. The chosen one is a lighter fill. */
export function MethodTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: MethodOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="How to pay"
      className="grid gap-1 rounded-[18px] bg-black/25 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`flex h-12 min-w-0 flex-col items-center justify-center rounded-[14px] px-2 text-small font-medium leading-tight transition-colors duration-180 disabled:opacity-50 ${
            o.id === value ? "bg-[#1C3D4B] text-text" : "text-white/55 hover:text-text"
          }`}
        >
          <span className="truncate">{o.label}</span>
          {o.badge && <span className="truncate text-[11px] font-medium text-amber">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Wallets ────────────────────────────────────────────────────────── */

/** The wallets this browser has, found by Wallet Standard and EIP-6963, kept current. */
export function useBrowserWallets(): { solana: SolanaWallet[]; evm: EvmWallet[]; mobile: boolean } {
  const [solana, setSolana] = useState<SolanaWallet[]>([]);
  const [evm, setEvm] = useState<EvmWallet[]>([]);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(isMobile());
    const stopSolana = watchSolanaWallets(setSolana);
    const stopEvm = watchEvmWallets(setEvm);
    return () => {
      stopSolana();
      stopEvm();
    };
  }, []);
  return { solana, evm, mobile };
}

export type WalletChoice = { id: string; name: string; icon?: string | null };

export function WalletIcon({ wallet, size = 32 }: { wallet: WalletChoice; size?: number }) {
  if (wallet.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- the wallet's own data: icon
      <img src={wallet.icon} alt="" width={size} height={size} className="shrink-0 rounded-[9px]" aria-hidden />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[9px] bg-white/[0.10] text-small font-medium text-text"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {wallet.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * The wallets found in this browser, as rows to choose from. The chosen row
 * is a lighter fill with an amber dot; the amber button below does the rest.
 */
export function WalletRows({
  wallets,
  selected,
  onSelect,
  disabled = false,
  extra,
}: {
  wallets: WalletChoice[];
  selected: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** The last row: another way in (a phone wallet, another browser). */
  extra?: ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label="Wallet" className="flex flex-col gap-2">
      {wallets.map((w) => {
        const on = w.id === selected;
        return (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onSelect(w.id)}
            className={`flex h-14 w-full items-center gap-3 rounded-[16px] px-4 text-left transition-colors duration-180 disabled:opacity-60 ${
              on ? "bg-[#21495A]" : "bg-[#15313D] hover:bg-[#1A3A48]"
            }`}
          >
            <WalletIcon wallet={w} size={30} />
            <span className="min-w-0 flex-1 truncate text-body font-medium text-text">{w.name}</span>
            <span className="shrink-0 text-tiny text-white/60">Detected</span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] border-2 transition-colors duration-180 ${
                on ? "border-amber" : "border-white/25"
              }`}
              aria-hidden
            >
              <span className={`h-2.5 w-2.5 rounded-[5px] transition-colors duration-180 ${on ? "bg-text" : "bg-transparent"}`} />
            </span>
          </button>
        );
      })}
      {extra}
    </div>
  );
}

/** A row that is a way out of the list rather than a wallet in it. */
export function ExtraRow({
  title,
  sub,
  onClick,
  href,
  icon,
}: {
  title: string;
  sub?: string;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.06] text-white/60" aria-hidden>
        {icon ?? <Dots />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium text-text">{title}</span>
        {sub && <span className="block truncate text-tiny text-white/60">{sub}</span>}
      </span>
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden className="shrink-0 text-white/35">
        <path d="M2 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
  const cls =
    "flex h-14 w-full items-center gap-3 rounded-[16px] px-4 text-left ring-1 ring-inset ring-white/[0.08] transition-colors duration-180 hover:bg-white/[0.04]";
  return href ? (
    <a href={href} className={cls} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

/* ── Small parts ─────────────────────────────────────────────────────── */

/** One line of state under the button: waiting, done, or something to act on. */
export function StatusLine({ tone = "wait", children }: { tone?: "wait" | "done" | "attention"; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`flex items-center justify-center gap-2.5 text-center text-small ${
        tone === "done" ? "text-success" : tone === "attention" ? "text-amber" : "text-white/75"
      }`}
    >
      {tone === "wait" && <Spinner />}
      {tone === "done" && <Tick />}
      <span>{children}</span>
    </p>
  );
}

/** A problem, in amber, with what to do next. */
export function SheetNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-amber/[0.09] px-4 py-3 text-small text-[#FFE3A3]" role="status">
      {children}
    </div>
  );
}

/** Copy a value, saying "Copied" for two seconds. */
export function CopyButton({ value, label = "Copy", className = ctaGlass }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => setCopied(false));
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function Tick({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M3 7.4l2.6 2.6L11 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dots() {
  return (
    <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden>
      <circle cx="2" cy="2" r="1.6" />
      <circle cx="8" cy="2" r="1.6" />
      <circle cx="14" cy="2" r="1.6" />
    </svg>
  );
}

/** The big round mark of a paid payment. */
export function PaidMark() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-[32px] bg-success/20 text-success" aria-hidden>
      <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
        <path d="M3 7.4l2.6 2.6L11 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** A ring that turns while the network confirms. */
export function WaitMark() {
  return (
    <span
      className="inline-block h-16 w-16 animate-spin rounded-full border-[3px] border-amber/20 border-t-amber"
      aria-hidden
    />
  );
}
