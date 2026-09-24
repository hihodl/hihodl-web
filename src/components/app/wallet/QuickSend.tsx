"use client";

/**
 * Quick Send, ported from the app's `payments/QuickSendScreen.tsx` and its
 * request twin `QuickRequestScreen.tsx`: one screen, two modes.
 *
 *   header     GlassHeader: back on the left, the person in the middle. From
 *              a thread the person is LOCKED: the name wears a lock and there
 *              is nothing to change it with, because a thread is already the
 *              answer to "who".
 *   amount     the 54/900 number with the 30/900 unit beside it, and under it
 *              one line: "Available", "Most you can send is…" in amber, or
 *              "Requesting from @x"
 *   fee line   QuickSend's `feeLine`, 13/600 in SUB under the amount. A web
 *              send is sponsored (relayerQuote, `sponsored: true`), so it says
 *              there is no network fee, which is what Confirm's "Free" says
 *   selector   TokenWithMini: the token's mark with the chain's small mark on
 *              its corner, the ticker and a chevron. It opens the token and
 *              chain list (SourceTokenSheet): one row per token on a chain
 *   note       request mode only: the note the other person reads on the bubble
 *   bottom     the bloc: the CTA ABOVE the keypad, in one column, on the app's
 *              near-black (rgba(12,16,20,0.94)); presets over the 3×4 pad
 *
 * WHAT IT DOES NOT DO
 *
 * It does not move money and it does not write a request. It is the screen:
 * the caller owns the draft and says what the CTA does. Send hands it to the
 * web's withdrawal path (Withdraw.tsx, passkey or linked phone); Request calls
 * `POST /payments/request` with the session and nothing else.
 */

import { type KeyboardEvent, type ReactNode, useState } from "react";

import { fmtNumber } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";

import { Ion } from "../ion";
import { AMBER, AppScreen, BackspaceIcon, ContinueButton, SUB, TokenIcon, WarningNote } from "./app-kit";

/** One token on one chain, as the selector offers it. */
export interface QuickOption {
  token: string;
  chain: string;
  /** What you hold of it, when known. Request mode leaves it out. */
  balance?: number | null;
}

const CHAIN_LABEL: Record<string, string> = { solana: "Solana", base: "Base", polygon: "Polygon", ethereum: "Ethereum" };
const CHAIN_ICON: Record<string, string> = { solana: "/pay/solana.svg", base: "/pay/base.svg", polygon: "/pay/polygon.svg" };
const TOKEN_NAME: Record<string, string> = { USDC: "USD Coin", SOL: "Solana" };

export function chainLabel(chain: string): string {
  return CHAIN_LABEL[chain.toLowerCase()] ?? chain;
}

export const NOTE_MAX = 140;

/** TokenWithMini: the token's mark, and the chain's on its corner. */
function TokenWithMini({ token, chain, size = 36 }: { token: string; chain: string; size?: number }) {
  const icon = CHAIN_ICON[chain.toLowerCase()];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <TokenIcon symbol={token} size={size} />
      <span className="absolute -bottom-1.5 -right-[3px] flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/[0.15] bg-black/20">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" width={14} height={14} className="h-[14px] w-[14px] rounded-full" />
        ) : (
          <span className="text-[7px] font-black text-[#CFE3EC]">{chainLabel(chain).slice(0, 3).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}

/** QuickAmountPad: presets over a 3×4 keypad, keys on white/6, radius 12. */
function AmountPad({
  onKey,
  onPreset,
  onBackspace,
  maxOff,
}: {
  onKey: (k: string) => void;
  onPreset: (n: number) => void;
  onBackspace: () => void;
  /** Request mode: there is no "most" to ask for, as in the app, where MAX is dead there. */
  maxOff?: boolean;
}) {
  const t = useT();
  const key = "flex h-[46px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-white/[0.06] text-[16px] font-strong text-white transition-colors hover:bg-white/[0.1] active:bg-white/[0.14]";
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "back"],
  ];
  const chip = "flex h-9 min-w-0 flex-1 items-center justify-center rounded-[12px] bg-white/[0.08] text-[14px] font-strong text-white hover:bg-white/[0.12] disabled:opacity-50 disabled:hover:bg-white/[0.08]";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {[10, 20, 50, 100].map((v) => (
          <button key={v} type="button" onClick={() => onPreset(v)} className={chip}>
            +{fmtNumber(v)}
          </button>
        ))}
        <button type="button" disabled={maxOff} onClick={() => onPreset(Number.POSITIVE_INFINITY)} className={`${chip} flex-[1.2]`}>
          {t("wallet.send.max")}
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.join("")} className="flex gap-2">
          {r.map((k) =>
            k === "back" ? (
              <button key={k} type="button" onClick={onBackspace} aria-label={t("wallet.send.deleteKey")} className={key}>
                <BackspaceIcon />
              </button>
            ) : (
              <button key={k} type="button" onClick={() => onKey(k)} className={key}>
                {k}
              </button>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * "1,234.5" / "1.234,5" while typing: the integer part grouped and the
 * decimal mark as the language writes them, the decimals as typed (the app's
 * displayAmount). The draft itself always keeps a "." — this is only the look.
 */
function displayAmount(s: string): string {
  if (!s) return fmtNumber(0);
  const [int, dec] = s.split(".");
  const grouped = fmtNumber(Number(int || 0), { maximumFractionDigits: 0 });
  const mark = fmtNumber(1.5, { minimumFractionDigits: 1 }).replace(/[0-9\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/g, "") || ".";
  return s.includes(".") ? `${grouped}${mark}${dec ?? ""}` : grouped;
}

export function QuickSendView({
  mode,
  recipient,
  onBack,
  amount,
  onAmount,
  amountLocked = false,
  decimals,
  option,
  options,
  onOption,
  available = null,
  note = "",
  onNote,
  notice,
  lockedLine,
  cta,
}: {
  mode: "send" | "request";
  /** Who, already decided. `locked` draws the lock: it came from a thread. */
  recipient: { name: string; locked: boolean };
  onBack: () => void;
  amount: string;
  onAmount: (next: string) => void;
  /** Paying a request: the figure is theirs to set, not yours. */
  amountLocked?: boolean;
  /** How many decimals the token takes. */
  decimals: number;
  option: QuickOption;
  options: readonly QuickOption[];
  onOption: (o: QuickOption) => void;
  /** Send mode: what the source holds, for "Available" and the ceiling. */
  available?: number | null;
  note?: string;
  onNote?: (v: string) => void;
  notice?: ReactNode;
  /** A line under the amount that says why it is locked. */
  lockedLine?: string | null;
  cta: { label: string; disabled: boolean; onClick: () => void };
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const n = Number(amount);
  const tooMuch = mode === "send" && available !== null && Number.isFinite(n) && n > available;
  const fmtHave = (x: number) => fmtNumber(x, { maximumFractionDigits: option.token === "USDC" ? 2 : 6 });
  const line =
    mode === "request"
      ? t("requests.requestingFrom", { name: recipient.name })
      : tooMuch && available !== null
        ? t("wallet.send.mostYouCanSend", { amount: `${fmtHave(available)} ${option.token}` })
        : available !== null
          ? t("wallet.send.available", { amount: `${fmtHave(available)} ${option.token}` })
          : "";

  const append = (k: string) => {
    if (amountLocked) return;
    const prev = amount;
    if (k === ".") {
      if (prev.includes(".") || decimals === 0) return;
      return onAmount(prev ? `${prev}.` : "0.");
    }
    const dot = prev.indexOf(".");
    if (dot >= 0 && prev.length - dot - 1 >= decimals) return;
    if (prev.replace(".", "").length >= 12) return;
    onAmount(prev === "0" ? k : prev + k);
  };
  const backspace = () => !amountLocked && onAmount(amount.slice(0, -1));
  const preset = (v: number) => {
    if (amountLocked) return;
    if (v === Number.POSITIVE_INFINITY) {
      if (mode === "send" && available !== null) onAmount(String(available));
      return;
    }
    onAmount(String(v));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Typing in the note is typing, not the keypad.
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
    if (/^[0-9]$/.test(e.key)) append(e.key);
    else if (e.key === "." || e.key === ",") append(".");
    else if (e.key === "Backspace") backspace();
    else if (e.key === "Enter" && !cta.disabled && !tooMuch) cta.onClick();
    else return;
    e.preventDefault();
  };

  const title = (
    <span className="inline-flex max-w-full items-center justify-center gap-1.5">
      <span className="truncate">{recipient.name}</span>
      {recipient.locked ? <Ion name="lock-closed-outline" size={13} color={SUB} aria-label={t("wallet.quick.locked")} /> : null}
    </span>
  );

  return (
    <AppScreen onBack={onBack} title={title}>
      <div tabIndex={0} onKeyDown={onKeyDown} className="flex min-w-0 flex-col outline-none" aria-label={t("common.amount")}>
        {/* The amount block */}
        <div className="flex min-w-0 flex-col items-center px-1 pt-8 text-center">
          <p className="flex max-w-full items-center gap-2">
            <span className="min-w-0 truncate text-[54px] font-strong leading-tight tracking-[0.5px] tabular-nums text-white">{displayAmount(amount)}</span>
            <span className="shrink-0 text-[30px] font-strong text-white">{option.token}</span>
          </p>
          <p className={`mt-2 min-h-5 text-[13px] ${tooMuch ? "text-[#FFB703]" : "text-[#9FB7C2]"}`}>{line}</p>
          {lockedLine ? <p className="mt-1 text-[12.5px] text-white/60">{lockedLine}</p> : null}
          {mode === "send" ? (
            <p className="mt-1.5 flex items-center gap-[5px] text-[13px] font-strong" style={{ color: SUB }}>
              <Ion name="information-circle-outline" size={14} color="rgba(255,255,255,0.45)" />
              {t("wallet.quick.noFee")}
            </p>
          ) : null}
          {notice ? (
            <div className="mt-3 w-full text-left">
              <WarningNote>{notice}</WarningNote>
            </div>
          ) : null}
        </div>

        {/* The selector (TokenWithMini), and its list (SourceTokenSheet) */}
        <div className="relative mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            disabled={amountLocked && options.length <= 1}
            className="flex items-center gap-2.5 rounded-[12px] px-2 py-1 hover:bg-white/[0.05] disabled:hover:bg-transparent"
          >
            <TokenWithMini token={option.token} chain={option.chain} />
            <span className="flex flex-col items-start">
              <span className="flex items-center gap-0.5 text-[15px] font-strong text-white">
                {option.token || t("wallet.quick.choose")}
                {amountLocked && options.length <= 1 ? null : <Ion name="chevron-down" size={13} color="#AFC9D6" />}
              </span>
              <span className="text-[11px] text-white/55">{chainLabel(option.chain)}</span>
            </span>
          </button>
          {picking ? (
            <div className="absolute top-full z-10 mt-2 w-full max-w-[340px] rounded-[18px] border border-white/[0.12] bg-[#15313D] p-2 shadow-[0_18px_36px_rgba(0,0,0,0.4)]">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-strong uppercase tracking-[0.5px] text-white/55">{t("wallet.quick.pickTitle")}</p>
              {options.map((o) => {
                const on = o.token === option.token && o.chain === option.chain;
                return (
                  <button
                    key={`${o.token}:${o.chain}`}
                    type="button"
                    onClick={() => {
                      onOption(o);
                      setPicking(false);
                    }}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${on ? "bg-[rgba(255,183,3,0.10)]" : "hover:bg-white/[0.06]"}`}
                  >
                    <TokenWithMini token={o.token} chain={o.chain} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-strong text-white">
                        <Rich
                          k="wallet.quick.tokenOn"
                          vars={{ token: TOKEN_NAME[o.token] ?? o.token, chain: chainLabel(o.chain) }}
                          tags={{ muted: (c) => <span className="font-normal text-white/60">{c}</span> }}
                        />
                      </span>
                      <span className="block text-[12px] tabular-nums text-white/60">
                        {o.balance !== undefined && o.balance !== null
                          ? `${fmtNumber(o.balance, { maximumFractionDigits: o.token === "USDC" ? 2 : 6 })} ${o.token}`
                          : o.token}
                      </span>
                    </span>
                    {on ? <Ion name="checkmark-circle" size={20} color={AMBER} /> : <span className="w-5" />}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {mode === "request" && onNote ? (
          <label className="mx-auto mt-5 flex h-11 w-full max-w-[340px] items-center gap-2 rounded-[16px] border border-white/[0.15] bg-white/[0.06] px-3.5 focus-within:border-white/30">
            <Ion name="create-outline" size={16} color={SUB} />
            <input
              value={note}
              onChange={(e) => onNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder={t("wallet.quick.notePlaceholder")}
              aria-label={t("wallet.quick.noteLabel")}
              maxLength={NOTE_MAX}
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-white outline-none placeholder:text-white/55"
            />
          </label>
        ) : null}

        {/* The bottom bloc: the CTA above the keypad */}
        <div className="mt-6 rounded-[20px] bg-[rgba(12,16,20,0.94)] px-4 pb-4 pt-2">
          <div className="mb-[18px] mt-2">
            <ContinueButton disabled={cta.disabled || tooMuch} onClick={cta.onClick}>
              {cta.label}
            </ContinueButton>
          </div>
          {amountLocked ? null : <AmountPad onKey={append} onPreset={preset} onBackspace={backspace} maxOff={mode === "request" || available === null} />}
        </div>
      </div>
    </AppScreen>
  );
}
