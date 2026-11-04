"use client";

/**
 * The HOLD app's own building blocks, for the wallet screens the web shares
 * with it. Every value here is read from the app, not chosen for the web:
 *
 *   type        the app's sizes; its 700/800/900 weights are drawn at 600,
 *               the web's type rule (Inter is loaded to 600), as hold.tsx does
 *   colours     src/theme/colors.ts: TEXT #FFFFFF, SUB #9FB7C2, amber
 *               #FFB703 with #0A0F14 on it, the card #15313D with a lit top edge
 *   header      GlassHeader: chevron-back 22 on the left, a 17/700 title centred
 *   actions     MiniAction: a 46pt glass squircle (radius 14), a 20pt white
 *               icon, a 12/600 label under it
 *   QR          HQR: dark modules on a white tile (padding 18, radius 28),
 *               amber inner eyes, the HOLD chip in the middle
 *
 * Small text that the app sets at white/45 or /50 is lifted to /55 here: on
 * the web's ground those fall under 4.5:1, which the app's darker ground hides.
 */

import { useEffect, useState, type ReactNode } from "react";

import { useT } from "@/lib/app/i18n/react";
import { fmtUsd } from "@/lib/app/i18n/format";

import { qrMatrix } from "./qr-matrix";
import { Ion, type IonName } from "../ion";

/** QuickAmountPad's delete key: Ionicons backspace-outline, the one glyph the shared set (../ion) lacks. */
export function BackspaceIcon({ size = 18, color = "#CFE3EC" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill={color} aria-hidden focusable="false">
      <path d={BACKSPACE} />
    </svg>
  );
}

export const AMBER = "#FFB703";
export const SUB = "#9FB7C2";
export const GREEN = "#34C759";

/* ── Screen ───────────────────────────────────────────────────────── */

/** One app screen: GlassHeader (back, centred title, a right slot) over a phone-width column. */
export function AppScreen({
  title,
  onBack,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section className={`mx-auto flex w-full max-w-[460px] flex-col text-white ${className}`}>
      {title !== undefined || onBack || right ? (
        <header className="grid h-[42px] grid-cols-[45px_minmax(0,1fr)_45px] items-center">
          <div className="flex items-center">
            {onBack ? (
              <button type="button" onClick={onBack} aria-label={t("common.back")} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white transition-colors hover:bg-white/[0.06]">
                <Ion name="chevron-back" size={22} />
              </button>
            ) : null}
          </div>
          <h2 className="truncate text-center text-[17px] font-strong text-white">{title}</h2>
          <div className="flex items-center justify-end">{right}</div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────── */

/** Receive's Share and Confirm's Send: the one filled amber action on a screen. 52 high, radius 16, 15/700. */
export function PrimaryButton({
  children,
  icon,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  icon?: IonName;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#FFB703] px-5 text-[15px] font-strong text-[#0A0F14] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon ? <Ion name={icon} size={18} color="#0A0F14" /> : null}
      {children}
    </button>
  );
}

/** QuickSend's Continue: the near-white plate (#F2F7FA, #8896A0 when it cannot go yet). */
export function ContinueButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 w-full items-center justify-center rounded-[16px] px-5 text-[16px] font-strong text-[#0A1A24] transition-colors ${
        disabled ? "cursor-not-allowed bg-[#8896A0]" : "bg-[#F2F7FA] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

/** The app's secondary button: glass plate, amber words. */
export function SecondaryButton({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: ReactNode;
  icon?: IonName;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] px-5 py-3.5 text-[15px] font-strong text-[#FFB703] transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon ? <Ion name={icon} size={18} color={AMBER} /> : null}
      {children}
    </button>
  );
}

/* ── Surfaces ─────────────────────────────────────────────────────── */

/** GlassCard: the solid ink #15313D, radius 18, lit top edge, dim sides and foot. */
export const cardClass =
  "rounded-[18px] border border-b-white/[0.04] border-l-white/[0.07] border-r-white/[0.07] border-t-white/[0.16] bg-[#15313D]";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>;
}

/** The app's section label: 12/700, uppercase, tracked. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 px-0.5 text-[12px] font-strong uppercase tracking-[0.6px] text-white/55">{children}</p>;
}

/**
 * The app's hero card (Backup "Your safety net"): amber-tinted plate, an icon in a 54pt amber disc, a 17/800 title,
 * a centred 13/19 line, then whatever it asks the person to do.
 */
export function HeroCard({ icon, title, children }: { icon: IonName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-[rgba(255,183,3,0.22)] bg-[rgba(255,183,3,0.06)] p-5 text-center">
      <span className="mb-0.5 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[rgba(255,183,3,0.12)]">
        <Ion name={icon} size={26} color={AMBER} />
      </span>
      <p className="text-[17px] font-strong text-white">{title}</p>
      {children}
    </div>
  );
}

export function HeroBody({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[13px] leading-[19px] text-[#9FB7C2]">{children}</p>;
}

/** The backup screen's foot: a small icon and a 12/17 line. */
export function FooterNote({ icon, children }: { icon: IonName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-1 pt-4">
      <Ion name={icon} size={16} color={SUB} style={{ marginTop: 1 }} />
      <p className="flex-1 text-[12px] leading-[17px] text-[#9FB7C2]">{children}</p>
    </div>
  );
}

/** The one line that says what is happening now, amber-tinted while it waits. */
export function StatusLine({ children, pulse = true }: { children: ReactNode; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[rgba(255,183,3,0.22)] bg-[rgba(255,183,3,0.06)] px-4 py-3">
      {pulse ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-[4px] bg-[#FFB703]" aria-hidden /> : null}
      <p className="text-[14px] font-strong text-white" role="status">
        {children}
      </p>
    </div>
  );
}

/** m:ss until `until`, ticking each second; "" without one. */
export function useCountdown(until: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  const end = until ? Date.parse(until) : NaN;
  if (!Number.isFinite(end)) return "";
  const s = Math.max(0, Math.round((end - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** view-recovery's warning plate: amber words on an amber tint. Never red. */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[12px] border border-[rgba(255,183,3,0.3)] bg-[rgba(255,183,3,0.1)] p-4 text-[14px] leading-5 text-[#FFB703]">
      {children}
    </p>
  );
}

/** The app's quiet info box. */
export function InfoBox({ icon = "alert-circle-outline", children }: { icon?: IonName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] bg-white/[0.05] p-4">
      <Ion name={icon} size={20} color="rgba(255,255,255,0.6)" />
      <p className="flex-1 text-[13px] leading-[18px] text-white/65">{children}</p>
    </div>
  );
}

/* ── Dashboard ────────────────────────────────────────────────────── */

/**
 * HeroBalance: a dollar value in the person's display currency, with the
 * currency's own decimals ("$1,234.56" in English and dollars), 48/800,
 * line-height 52. Every caller shows a value the product knows in dollars
 * (a balance, an activity row's USD value, savings, invest, analytics):
 * nothing paid goes through here. A component that shows it calls useT().
 */
export function money(n: number): string {
  return fmtUsd(n);
}

export function HeroBalance({ value, loading }: { value: string | null; loading?: boolean }) {
  if (loading || value === null) return <span className="block h-[52px] w-[200px] animate-pulse rounded-[12px] bg-white/[0.08]" aria-hidden />;
  // Shrinks with the screen rather than cutting the number: at 48px a seven
  // figure balance is wider than a phone, and a truncated balance is a wrong one.
  return <span className="block max-w-full whitespace-nowrap text-[clamp(32px,11vw,48px)] font-strong leading-[52px] tabular-nums text-white">{value}</span>;
}

/** MiniAction: the dashboard's quick action. */
export function MiniAction({ icon, label, onClick, href }: { icon: IonName; label: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className="mb-2 flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border border-white/[0.15] bg-white/[0.06] backdrop-blur-md transition-transform group-active:scale-90">
        <Ion name={icon} size={20} color="#FFFFFF" />
      </span>
      <span className="text-center text-[12px] font-strong tracking-[0.1px] text-white/85">{label}</span>
    </>
  );
  const cls = "group flex min-w-[68px] flex-col items-center";
  if (href)
    return (
      <a href={href} className={cls} aria-label={label}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {inner}
    </button>
  );
}

export function ActionsRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start justify-center gap-6 px-4 py-2.5">{children}</div>;
}

/* ── Tokens ───────────────────────────────────────────────────────── */

const TOKEN_ICON: Record<string, string> = { USDC: "/pay/usdc.png", SOL: "/pay/solana.svg" };

/**
 * A token's mark. The app reads its icon registry; the web has the two marks
 * it ships, and anything else falls back the way the app itself falls back
 * when the registry has nothing — the ticker, in its `heroTicker` weight.
 */
export function TokenIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const src = TOKEN_ICON[symbol.toUpperCase()];
  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.08] font-black tracking-[0.5px] text-[#CFE3EC]"
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.3)) }}
        aria-hidden
      >
        {symbol.toUpperCase().slice(0, 4)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full" style={{ width: size, height: size }} />
  );
}

/** TokenList row: icon, 14/600 name over a 12pt amount, the value 14/700 on the right. */
export function TokenRow({
  symbol,
  name,
  sub,
  value,
  valueSub,
  onClick,
}: {
  symbol: "USDC" | "SOL";
  name: string;
  sub: ReactNode;
  value: ReactNode;
  valueSub?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <TokenIcon symbol={symbol} />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-strong text-white">{name}</span>
          <span className="mt-0.5 block truncate text-[12px] tabular-nums text-white/60">{sub}</span>
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-right text-[14px] font-strong tabular-nums text-white">{value}</span>
        {valueSub ? <span className="mt-0.5 text-right text-[12px] tabular-nums text-white/60">{valueSub}</span> : null}
      </span>
    </>
  );
  const cls = "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-white/[0.03]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function RowSeparator() {
  return <div className="ml-[52px] h-px bg-white/[0.06]" />;
}

/* ── The address ──────────────────────────────────────────────────── */

/** Receive's shorten(): six, an ellipsis, five. */
export function shortAddr(addr: string): string {
  if (!addr) return "…";
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`;
}

/* ── HQR ──────────────────────────────────────────────────────────── */

const MODULE = "#0A1A24";

/**
 * HQR, the app's one QR: rounded modules (32%), outer eyes at 26% in module
 * ink, inner eyes at 40% in amber, error correction H so the HOLD chip (a
 * quarter of the width) can sit in the middle.
 */
export function HQR({ value, size = 212, title }: { value: string; size?: number; title: string }) {
  const m = qrMatrix(value);
  if (!m) return null;
  const n = m.size;
  const eyes = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const inEye = (r: number, c: number) => eyes.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);
  const chip = n * 0.25;
  const c0 = (n - chip) / 2;
  const inChip = (r: number, c: number) => r + 1 > c0 - 0.3 && r < c0 + chip + 0.3 && c + 1 > c0 - 0.3 && c < c0 + chip + 0.3;
  const dots: ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m.data[r * n + c] || inEye(r, c) || inChip(r, c)) continue;
      dots.push(<rect key={`${r}-${c}`} x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.3} />);
    }
  }
  const icon = chip * 0.86;
  return (
    <div className="inline-block rounded-[28px] bg-white p-[18px]" style={{ width: size + 36 }}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={title} className="block">
        <g fill={MODULE}>{dots}</g>
        {eyes.map(([er, ec]) => (
          <g key={`${er}-${ec}`}>
            <path
              fillRule="evenodd"
              fill={MODULE}
              d={`${roundedRect(ec, er, 7, 7, 7 * 0.26)} ${roundedRect(ec + 1, er + 1, 5, 5, 5 * 0.2)}`}
            />
            <rect x={ec + 2} y={er + 2} width={3} height={3} rx={3 * 0.4} fill={AMBER} />
          </g>
        ))}
        <rect x={c0} y={c0} width={chip} height={chip} rx={chip * 0.28} fill="#FFFFFF" />
        <image href="/icon.png" x={c0 + (chip - icon) / 2} y={c0 + (chip - icon) / 2} width={icon} height={icon} clipPath="url(#hqr-chip)" preserveAspectRatio="xMidYMid slice" />
        <defs>
          <clipPath id="hqr-chip">
            <rect x={c0 + (chip - icon) / 2} y={c0 + (chip - icon) / 2} width={icon} height={icon} rx={icon * 0.22} />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

const BACKSPACE =
  "M144 98Q150 96 280 96Q410 96 415 98Q437 103 446 126L448 132V256V380L446 386Q438 407 416 414L410 416H280H150L144 414Q131 410 124 402Q122 399 78 332.5Q34 266 32 263Q31 260 31 256Q31 252 32 249.5Q33 247 78 179Q113 127 121 116Q129 105 136 101Q140 99 144 98ZM107 193 66 256 107 319Q149 381 151.5 382.5Q154 384 280 384Q406 384 409 382.5Q412 381 414 378L416 375V256V137L414 134Q412 131 409 129.5Q406 128 280 128Q154 128 151.5 129.5Q149 131 107 193ZM201 178Q201 178 201 178Q207 175 214 178Q216 179 244 207Q244 207 272 235L299 207Q326 180 330 178Q339 174 346 180Q349 182 351 185Q355 192 351 200Q349 203 322 230Q322 230 294 257L322 285Q350 313 351 315Q354 321 352 328Q348 338 337 338Q332 338 327 334Q322 330 300 308Q300 308 272 280L243 308Q215 337 211 338Q201 340 195 333.5Q189 327 191 317Q192 314 221 286Q221 286 249 257L221 230Q194 202 192.5 199.5Q191 197 191 192.5Q191 188 192 186Q195 180 201 178Z";
