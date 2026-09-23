"use client";

/**
 * Send from the web: USDC or SOL, on Solana, to a Solana address. From a
 * wallet made on the web, or one made in the HOLD app with its phone linked.
 *
 * It looks like the HOLD app's Send, screen for screen
 * (documentation/web-copies-the-app-wallet.md):
 *
 *   recipient   send/search: the address field and the "Detected" wallet row
 *   amount      QuickSendScreen: the big number, "Available", the token chip,
 *               presets, the keypad and the white Continue
 *   review      ConfirmPaymentScreen: "Recipient gets", the recipient card,
 *               the summary card, the amber Send
 *   result      tx-confirm: "Payment sent", "To … • amount", Close
 *
 * Every send is approved on the strongest device the person has, and the
 * server picks it (documentation/one-wallet-every-device.md, rule 4):
 *
 *   app           an Android phone is linked: it gets a push, the person
 *                 approves and the app signs, on a SECOND device. This screen
 *                 waits: "Approve on your phone", with Open HOLD (an intent on
 *                 Android), the inbox hint and Cancel. Every wallet, including
 *                 one made in the app.
 *   web_passkey   a web wallet with no Android phone (an iPhone, a laptop).
 *                 Approved here, with ONE passkey prompt that both answers
 *                 the server's challenge (bound to the exact bytes of this
 *                 transfer) and opens the wallet (PRF) to sign them.
 *   409 LINK_YOUR_PHONE_FIRST
 *                 a wallet made in the app with no Android phone linked: the
 *                 web holds no key for it, so the answer is the link screen.
 *
 * The backend contract is the withdrawal one: only the screens took the
 * app's shape.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { settleRequest } from "@/lib/app/payment-requests";
import { clientProductBase } from "@/lib/app/paths";
import {
  authorizeWithdrawalPasskey,
  createWithdrawal,
  getWithdrawal,
  rejectWithdrawal,
  relayerQuote,
  relayerSubmit,
  withdrawalPasskeyChallenge,
  type AssertionOptionsJSON,
  type Withdrawal,
  type WithdrawalStatus,
} from "@/lib/link/api";
import { withdrawalIntent } from "@/lib/link/intent";
import { phoneOf, type Phone } from "@/lib/link/ua";
import { getWalletBackup, WalletApiError, type Balances, type WalletBackup } from "@/lib/wallet/api";
import { fromBase64, wipe } from "@/lib/wallet/core";
import { explain } from "@/lib/wallet/explain";
import { openWallet } from "@/lib/wallet/flows";
import { assertWithPrf, evaluatePrf } from "@/lib/wallet/passkey";
import { buildWithdrawal, messageHash, signWithdrawal, type BuiltWithdrawal } from "@/lib/wallet/withdraw";
import {
  canonicalAmount,
  isSolanaAddress,
  paysTheRequest,
  sameBytes,
  toBaseUnits,
  withdrawalChallenge,
  type WithdrawToken,
} from "@/lib/wallet/withdraw-core";

import { AMBER, AppScreen, BackspaceIcon, ContinueButton, FooterNote, HeroBody, HeroCard, PrimaryButton, StatusLine, SUB, TokenIcon, useCountdown, WarningNote } from "./app-kit";
import { Ion } from "../ion";

/* ── Parts ────────────────────────────────────────────────────────── */

const DECIMALS: Record<WithdrawToken, number> = { USDC: 6, SOL: 9 };
const TOKEN_NAME: Record<WithdrawToken, string> = { USDC: "USD Coin", SOL: "Solana" };

/** Confirm's short recipient: six, an ellipsis, four. */
function shortTo(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });
}

/** Confirm's hero: "RECIPIENT GETS", the amount at 44/800, the symbol at 22/600. */
function Hero({ label = "Recipient gets", amount, token }: { label?: string; amount: string; token: WithdrawToken }) {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-[18px] pt-8">
      <p className="text-[12px] font-strong uppercase tracking-[0.8px] text-white/55">{label}</p>
      <p className="flex items-end gap-2.5 pb-0.5">
        <span className="text-[44px] font-strong leading-none tracking-[-0.8px] tabular-nums text-white">{fmtAmount(amount)}</span>
        <span className="mb-1 text-[22px] font-strong text-white/55">{token}</span>
      </p>
    </div>
  );
}

const confirmCard = "rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-4 py-3";

/** Confirm's recipient card: the wallet avatar, the short address, (i) for the whole one. */
function RecipientCard({ to }: { to: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={confirmCard}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(124,198,232,0.25)] bg-[rgba(124,198,232,0.12)]">
          <Ion name="wallet-outline" size={20} color="#7CC6E8" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-strong tracking-[-0.2px] text-white">{shortTo(to)}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Recipient wallet" className="rounded-[10px] p-1 hover:bg-white/[0.06]">
          <Ion name="information-circle-outline" size={20} color="rgba(255,255,255,0.55)" />
        </button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[11px] font-strong uppercase tracking-[0.5px] text-white/55">Recipient wallet</p>
          <p className="mt-2 break-all font-mono text-[13px] leading-[19px] text-white">{to}</p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[9px]">
      <span className="text-[13.5px] text-white/60">{label}</span>
      <span className="text-right text-[13.5px] font-strong tabular-nums text-white">{children}</span>
    </div>
  );
}

/** Confirm's summary card: You send, Network fee, Network. */
function Summary({ token, amount }: { token: WithdrawToken; amount: string }) {
  return (
    <div className={confirmCard}>
      <Row label="You send">
        {fmtAmount(amount)} {token}
      </Row>
      <div className="h-px bg-white/[0.08]" />
      <Row label="Network fee">
        <span className="text-[#22C55E]">Free</span>
      </Row>
      <div className="h-px bg-white/[0.08]" />
      <Row label="Network">Solana</Row>
    </div>
  );
}

/** QuickAmountPad: presets over a 3×4 keypad, keys on white/6, radius 12. */
function AmountPad({ onKey, onPreset, onBackspace }: { onKey: (k: string) => void; onPreset: (n: number) => void; onBackspace: () => void }) {
  const key = "flex h-[46px] flex-1 items-center justify-center rounded-[12px] bg-white/[0.06] text-[16px] font-strong text-white transition-colors hover:bg-white/[0.1] active:bg-white/[0.14]";
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "back"],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {[10, 20, 50, 100].map((v) => (
          <button key={v} type="button" onClick={() => onPreset(v)} className="flex h-9 flex-1 items-center justify-center rounded-[12px] bg-white/[0.08] text-[14px] font-strong text-white hover:bg-white/[0.12]">
            +{v}
          </button>
        ))}
        <button type="button" onClick={() => onPreset(Number.POSITIVE_INFINITY)} className="flex h-9 flex-[1.2] items-center justify-center rounded-[12px] bg-white/[0.08] text-[14px] font-strong text-white hover:bg-white/[0.12]">
          MAX
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.join("")} className="flex gap-2">
          {r.map((k) =>
            k === "back" ? (
              <button key={k} type="button" onClick={onBackspace} aria-label="Delete" className={key}>
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

/* ── Screens (pure: what each phase looks like) ───────────────────── */

export interface Draft {
  token: WithdrawToken;
  amount: string;
  to: string;
}

export type WithdrawPhase =
  | { kind: "form"; notice?: string | null }
  | { kind: "review"; busy: boolean; notice?: string | null }
  | { kind: "link-first" }
  | { kind: "on-phone"; withdrawal: Withdrawal; cancelling?: boolean; notice?: string | null }
  | { kind: "preparing"; withdrawal: Withdrawal }
  | { kind: "passkey"; withdrawal: Withdrawal; busy: boolean; notice?: string | null }
  | { kind: "sending"; withdrawal: Withdrawal }
  | { kind: "result"; withdrawal: Withdrawal; status: WithdrawalStatus };

/** tx-confirm's headings, and the web's own for the ways a phone approval ends without a send. */
const RESULT: Partial<Record<WithdrawalStatus, { title: string; text: string; ok: boolean }>> = {
  confirmed: { title: "Payment sent", text: "Confirmed on Solana", ok: true },
  rejected: { title: "Declined on your phone", text: "Nothing was sent.", ok: false },
  expired: { title: "Not approved in time", text: "It was not approved within ten minutes. Nothing was sent.", ok: false },
  failed: { title: "Payment failed", text: "The network did not take it. Nothing left your wallet.", ok: false },
};

const ON_PHONE: Partial<Record<WithdrawalStatus, string>> = {
  pending: "Approve on your phone",
  approved: "Approved on your phone. Sending…",
  submitted: "Approved. Sending…",
};

/** Review's last line: who approves next, when that is known before the server answers. */
const NEXT: Record<"phone" | "passkey" | "unknown", string> = {
  phone: "A payment cannot be undone. Your linked phone approves and signs it next, in the HOLD app.",
  passkey: "A payment cannot be undone. You approve it with your passkey next.",
  unknown: "A payment cannot be undone. You approve it in the next step.",
};

export function WithdrawView({
  phase,
  draft,
  balances,
  setDraft,
  approver,
  here = null,
  actions,
}: {
  phase: WithdrawPhase;
  draft: Draft;
  balances: Balances | null;
  setDraft: (d: Draft) => void;
  /** Who approves, when the server said so up front (canPayFromWeb). */
  approver?: "phone" | "passkey";
  /** The phone this page is on: an Android phone gets Open HOLD as an intent. */
  here?: Phone | null;
  actions: {
    onBack: () => void;
    onReview: () => void;
    onRequest: () => void;
    onConfirmPasskey: () => void;
    onLink: () => void;
    onCancel: () => void;
    onDone: () => void;
    onEdit: () => void;
  };
}) {
  const withdrawal = "withdrawal" in phase ? phase.withdrawal : null;
  const left = useCountdown(phase.kind === "on-phone" || phase.kind === "passkey" ? (withdrawal?.expiresAt ?? null) : null);
  // The form is the app's two screens: who (send/search), then how much (QuickSend).
  const [step, setStep] = useState<"to" | "amount">(() => (isSolanaAddress(draft.to) ? "amount" : "to"));
  const [picking, setPicking] = useState(false);

  if (phase.kind === "form" && step === "to") {
    const toOk = isSolanaAddress(draft.to);
    const toHint = draft.to && !toOk ? (draft.to.trim().startsWith("0x") ? "That is not a Solana address. Only Solana is supported." : "That is not a valid Solana address.") : "";
    return (
      <AppScreen onBack={actions.onBack} title={null}>
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex h-11 items-center gap-2 rounded-[16px] border border-white/[0.15] bg-white/[0.06] px-3.5 focus-within:border-white/30">
            <Ion name="wallet-outline" size={18} color={SUB} />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/55"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Paste wallet address"
              aria-label="Recipient wallet address"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value.trim() })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && toOk) setStep("amount");
              }}
            />
          </label>
          {toOk ? (
            <>
              <p className="px-1 pt-2 text-[13px] font-strong text-white/60">Detected</p>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="flex w-full items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.09]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(124,198,232,0.12)]">
                  <Ion name="wallet-outline" size={16} color="#7CC6E8" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-strong text-white">Wallet · {shortTo(draft.to)}</span>
                <Ion name="chevron-forward" size={18} color="rgba(255,255,255,0.55)" />
              </button>
            </>
          ) : toHint ? (
            <WarningNote>{toHint}</WarningNote>
          ) : (
            <div className="flex flex-col items-center px-8 pt-16 text-center">
              <Ion name="wallet-outline" size={48} color={SUB} />
              <p className="mt-4 text-[15px] font-strong text-[#9FB7C2]">Paste wallet address</p>
              <p className="mt-2 text-[13px] text-[#9FB7C2]">A Solana address, for USDC or SOL.</p>
            </div>
          )}
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "form") {
    const units = toBaseUnits(draft.amount, draft.token);
    const have = balances ? (draft.token === "USDC" ? balances.usdc : balances.sol) : null;
    const tooMuch = units !== null && have !== null && Number(draft.amount) > have;
    const toOk = isSolanaAddress(draft.to);
    const maxDigits = DECIMALS[draft.token];
    const fmtHave = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: draft.token === "USDC" ? 2 : 6 });
    const line = tooMuch && have !== null ? `Most you can send is ${fmtHave(have)} ${draft.token}` : have !== null ? `Available: ${fmtHave(have)} ${draft.token}` : "";

    const append = (k: string) => {
      const prev = draft.amount;
      if (k === ".") {
        if (prev.includes(".")) return;
        return setDraft({ ...draft, amount: prev ? `${prev}.` : "0." });
      }
      const dot = prev.indexOf(".");
      if (dot >= 0 && prev.length - dot - 1 >= maxDigits) return;
      setDraft({ ...draft, amount: prev === "0" ? k : prev + k });
    };
    const backspace = () => setDraft({ ...draft, amount: draft.amount.slice(0, -1) });
    const preset = (n: number) => setDraft({ ...draft, amount: n === Number.POSITIVE_INFINITY ? String(have ?? 0) : String(n) });
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (/^[0-9]$/.test(e.key)) append(e.key);
      else if (e.key === "." || e.key === ",") append(".");
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter" && units !== null && !tooMuch && toOk) actions.onReview();
      else return;
      e.preventDefault();
    };

    return (
      <AppScreen onBack={() => setStep("to")} title={null}>
        <div tabIndex={0} onKeyDown={onKeyDown} className="flex flex-col outline-none" aria-label="Amount">
          {/* The amount block */}
          <div className="flex flex-col items-center pt-8">
            <p className="flex items-center gap-2">
              <span className="text-[54px] font-strong leading-tight tracking-[0.5px] tabular-nums text-white">{draft.amount || "0"}</span>
              <span className="text-[30px] font-strong text-white">{draft.token}</span>
            </p>
            <p className={`mt-2 h-5 text-[13px] ${tooMuch ? "text-[#FFB703]" : "text-[#9FB7C2]"}`}>{line}</p>
            {phase.notice ? (
              <div className="mt-3 w-full">
                <WarningNote>{phase.notice}</WarningNote>
              </div>
            ) : null}
          </div>

          {/* The source chip, and its picker (SourceTokenSheet) */}
          <div className="relative mt-8 flex justify-center">
            <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking} className="flex items-center gap-2 rounded-[12px] px-2 py-1 hover:bg-white/[0.05]">
              <TokenIcon symbol={draft.token} size={36} />
              <span className="text-[15px] font-strong text-white">{draft.token}</span>
              <Ion name="chevron-down" size={13} color="#AFC9D6" />
            </button>
            {picking ? (
              <div className="absolute top-full z-10 mt-2 w-full max-w-[320px] rounded-[18px] border border-white/[0.12] bg-[#15313D] p-2 shadow-[0_18px_36px_rgba(0,0,0,0.4)]">
                {(["USDC", "SOL"] as const).map((t) => {
                  const on = t === draft.token;
                  const bal = balances ? (t === "USDC" ? balances.usdc : balances.sol) : null;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, token: t, amount: "" });
                        setPicking(false);
                      }}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${on ? "bg-[rgba(255,183,3,0.10)]" : "hover:bg-white/[0.06]"}`}
                    >
                      <TokenIcon symbol={t} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-strong text-white">{TOKEN_NAME[t]}</span>
                        <span className="block text-[12px] tabular-nums text-white/60">{bal !== null ? `${bal.toLocaleString("en-US", { maximumFractionDigits: t === "USDC" ? 2 : 6 })} ${t}` : t}</span>
                      </span>
                      {on ? <Ion name="checkmark-circle" size={20} color={AMBER} /> : <span className="w-5" />}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* The bottom bloc: Continue above the keypad */}
          <div className="mt-6 rounded-[20px] bg-[rgba(12,16,20,0.94)] px-4 pb-4 pt-2">
            <div className="mb-[18px] mt-2">
              <ContinueButton disabled={units === null || tooMuch || !toOk} onClick={actions.onReview}>
                Continue
              </ContinueButton>
            </div>
            <AmountPad onKey={append} onPreset={preset} onBackspace={backspace} />
          </div>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "review") {
    return (
      <AppScreen title="Confirm payment" onBack={actions.onEdit}>
        <Hero amount={draft.amount} token={draft.token} />
        <div className="flex flex-col gap-3">
          <RecipientCard to={draft.to} />
          <Summary token={draft.token} amount={draft.amount} />
          {phase.notice ? <WarningNote>{phase.notice}</WarningNote> : null}
          <div className="pt-4">
            <PrimaryButton disabled={phase.busy} onClick={actions.onRequest}>
              {phase.busy ? "Preparing…" : "Send"}
            </PrimaryButton>
          </div>
          <FooterNote icon={approver === "passkey" ? "finger-print" : "phone-portrait-outline"}>{NEXT[approver ?? "unknown"]}</FooterNote>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "link-first") {
    return (
      <AppScreen title="Confirm payment" onBack={actions.onEdit}>
        <div className="flex flex-col gap-4 pt-4">
          <HeroCard icon="phone-portrait-outline" title="Link your phone to pay from here">
            <HeroBody>
              This wallet was made in the HOLD app, and its keys stay on your phone. Link the phone once, and it approves and
              signs every payment you start here. Nothing was sent.
            </HeroBody>
          </HeroCard>
          <PrimaryButton icon="phone-portrait-outline" onClick={actions.onLink}>
            Link your phone
          </PrimaryButton>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "on-phone") {
    const w = phase.withdrawal;
    return (
      <AppScreen title="Confirm payment">
        <Hero amount={w.amount} token={w.token} />
        <div className="flex flex-col gap-3">
          <StatusLine>{ON_PHONE[w.status] ?? "Approve on your phone"}</StatusLine>
          <RecipientCard to={w.to} />
          <Summary token={w.token} amount={w.amount} />
          {phase.notice ? <WarningNote>{phase.notice}</WarningNote> : null}
          {w.status === "pending" ? (
            <div className="flex flex-col gap-2 pt-2">
              {here === "android" ? (
                // A new tab: this page keeps following the withdrawal while the app opens on it.
                <a
                  href={withdrawalIntent(w.id)}
                  target="_blank"
                  rel="noopener"
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#FFB703] px-5 text-[15px] font-strong text-[#0A0F14] transition-opacity hover:opacity-90"
                >
                  <Ion name="open-outline" size={18} color="#0A0F14" />
                  Open HOLD
                </a>
              ) : null}
              <button
                type="button"
                onClick={actions.onCancel}
                disabled={phase.cancelling}
                className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] px-5 py-3.5 text-[15px] font-strong text-white transition-colors hover:bg-white/[0.12] disabled:opacity-60"
              >
                {phase.cancelling ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          ) : null}
          <FooterNote icon="phone-portrait-outline">
            A notification in the HOLD app on your phone asks you to approve it. No notification? Open HOLD and go to Withdrawals.
            It expires in <span className="tabular-nums">{left}</span>.
          </FooterNote>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "preparing" || phase.kind === "passkey") {
    const w = phase.withdrawal;
    const busy = phase.kind === "preparing" || phase.busy;
    return (
      <AppScreen title="Confirm payment">
        <Hero amount={w.amount} token={w.token} />
        <div className="flex flex-col gap-3">
          <RecipientCard to={w.to} />
          <Summary token={w.token} amount={w.amount} />
          {phase.kind === "passkey" && phase.notice ? <WarningNote>{phase.notice}</WarningNote> : null}
          <div className="pt-4">
            <PrimaryButton icon="finger-print" disabled={busy} onClick={actions.onConfirmPasskey}>
              {phase.kind === "preparing" ? "Preparing…" : phase.busy ? "Waiting for your passkey…" : "Approve with passkey"}
            </PrimaryButton>
          </div>
          {phase.kind === "passkey" ? (
            <FooterNote icon="finger-print">
              Your passkey approves exactly this payment and signs it, in one step. Expires in <span className="tabular-nums">{left}</span>.
            </FooterNote>
          ) : null}
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "sending") {
    const w = phase.withdrawal;
    return (
      <AppScreen title="Confirm payment">
        <Hero amount={w.amount} token={w.token} />
        <div className="flex flex-col gap-3">
          <StatusLine>Sending payment</StatusLine>
          <RecipientCard to={w.to} />
          <Summary token={w.token} amount={w.amount} />
        </div>
      </AppScreen>
    );
  }

  const r = RESULT[phase.status] ?? RESULT.failed!;
  const w = phase.withdrawal;
  return (
    <AppScreen>
      <div className="mt-10 rounded-[16px] border border-white/[0.08] bg-[#0A1A24] p-[18px]">
        <h2 className="mb-1.5 text-[20px] font-strong text-white">{r.title}</h2>
        <p className="text-[14px] text-[#CFE3EC]">
          To {shortTo(w.to)} • {fmtAmount(w.amount)} {w.token}
        </p>
        <p className={`mt-2.5 text-[13px] ${r.ok ? "text-[#20D690]" : "text-[#CFE3EC]"}`}>{r.text}</p>
        {w.signature ? (
          <a
            className="mt-2.5 inline-flex items-center gap-1 text-[13px] text-[#9FB7C2] underline decoration-white/20 underline-offset-2 hover:text-white"
            href={`https://solscan.io/tx/${w.signature}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See it on Solscan <Ion name="open-outline" size={13} color={SUB} />
          </a>
        ) : null}
        <button type="button" onClick={actions.onDone} className="mt-[18px] flex h-12 w-full items-center justify-center rounded-[12px] bg-[#FFB703] text-[15px] font-strong text-[#0A1A24] hover:opacity-90">
          Close
        </button>
      </div>
    </AppScreen>
  );
}

/* ── The logic ────────────────────────────────────────────────────── */

const POLL_MS = 2000;
/** A quote's blockhash lasts about a minute: past this, the transfer is built again before the prompt. */
const FRESH_MS = 45_000;
const FINAL: WithdrawalStatus[] = ["confirmed", "rejected", "expired", "failed"];

/** The server's `messageHash`, hex or base64, against sha256 of our bytes. */
function sameHash(given: string, message: Uint8Array): boolean {
  const mine = messageHash(message);
  const hex = Array.from(mine, (b) => b.toString(16).padStart(2, "0")).join("");
  if (/^[0-9a-f]{64}$/i.test(given)) return given.toLowerCase() === hex;
  try {
    return sameBytes(fromBase64(given), mine);
  } catch {
    return false;
  }
}

function describe(e: unknown): string {
  if (e instanceof WalletApiError) {
    if (e.code === "WITHDRAWAL_NEEDS_APPROVAL") return "That withdrawal was not approved. Nothing was sent. Start again.";
    if (e.code === "WITHDRAWAL_EXPIRED" || e.status === 410) return "That withdrawal expired. Nothing was sent. Start again.";
    if (e.code === "INSUFFICIENT_FUNDS" || e.code === "INSUFFICIENT_BALANCE") return "Your wallet does not hold enough for that. Nothing was sent.";
    // The two refusals that used to arrive as a bare 409 and be read as
    // "link your phone". Each says the thing this person actually has to do.
    if (e.code === "NO_PASSKEY") return "This account has no passkey, and a passkey is what approves a send. Add one from Menu → Passkeys. Nothing was sent.";
    if (e.code === "NO_WEB_WALLET") return "This wallet was made in the HOLD app, which sends it for now. Nothing was sent.";
  }
  if (e instanceof Error && e.message === "challenge_mismatch") return "HOLD asked the passkey to approve something other than this transfer, so we stopped. Nothing was sent.";
  if (e instanceof Error && e.message === "wrong_key") return "That passkey opened a different wallet. Nothing was sent.";
  return explain(e);
}

export function Withdraw({
  uid,
  from,
  balances,
  approver,
  onBack,
  prefill,
}: {
  uid: string;
  from: string;
  balances: Balances | null;
  /** Who approves, when the server said so up front (canPayFromWeb). Only changes a sentence: the server's channel decides. */
  approver?: "phone" | "passkey";
  onBack: () => void;
  /**
   * What another screen already knows: Pay on a request, or Send from a
   * thread whose handle resolved. Read once, into the first draft — after
   * that the person owns the form, and a prop that kept writing into it would
   * undo their typing on every re-render.
   */
  prefill?: { to?: string; amount?: string; token?: WithdrawToken; requestId?: string };
}) {
  const [draft, setDraft] = useState<Draft>({
    token: prefill?.token ?? "USDC",
    amount: prefill?.amount ?? "",
    to: prefill?.to ?? "",
  });
  const [phase, setPhase] = useState<WithdrawPhase>({ kind: "form" });
  const [here, setHere] = useState<Phone | null>(null);
  useEffect(() => setHere(phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)), []);
  const backup = useRef<WalletBackup | null>(null);
  const prepared = useRef<{ built: BuiltWithdrawal; options: AssertionOptionsJSON } | null>(null);
  // The withdrawal the server already approved: its bytes are fixed from then on.
  const authorized = useRef<string | null>(null);

  useEffect(() => {
    // A wallet made in the app has no backup here, and needs none: its phone signs.
    if (approver !== "phone") getWalletBackup().then((b) => (backup.current = b), () => undefined);
  }, [approver]);

  // Follow a withdrawal the server is deciding: the phone's approval, then the chain.
  const following = phase.kind === "on-phone" || phase.kind === "sending" ? phase.withdrawal.id : null;
  useEffect(() => {
    if (!following) return;
    let stop = false;
    const tick = async () => {
      try {
        const w = await getWithdrawal(following);
        if (stop) return;
        if (FINAL.includes(w.status)) setPhase({ kind: "result", withdrawal: w, status: w.status });
        else setPhase((p) => (p.kind === "on-phone" ? { ...p, withdrawal: w } : p));
      } catch {
        /* asked again on the next tick */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [following]);

  /*
   * Pay on a payment request: once the money is confirmed, close the request
   * the way the app does (_QuickSendScreen.send.ts), with POST
   * /payments/requests/:id/settle. After the send, never before it; only when
   * what went out is what was asked (paysTheRequest); once per page; and
   * silent on failure — the payment happened, and an open request is a stale
   * row, not lost money.
   */
  const settled = useRef(false);
  const confirmed = phase.kind === "result" && phase.status === "confirmed" ? phase.withdrawal : null;
  useEffect(() => {
    const requestId = prefill?.requestId;
    if (!confirmed || !requestId || settled.current) return;
    if (!paysTheRequest(prefill, confirmed)) return;
    settled.current = true;
    void settleRequest(requestId, confirmed.signature ? { txHash: confirmed.signature } : undefined).catch(() => undefined);
  }, [confirmed, prefill]);

  /** Quote, build, and ask the server for the challenge bound to those exact bytes. */
  const prepare = useCallback(
    async (w: Withdrawal) => {
      const quote = await relayerQuote({ tokenId: w.token === "SOL" ? "SOL" : "usdc.circle", amount: w.amount, to: w.to, from });
      const built = await buildWithdrawal({ from, to: w.to, token: w.token, amount: w.amount, quote });
      const { options, messageHash: serverHash } = await withdrawalPasskeyChallenge(w.id, built.messageB64);
      // The passkey signs only what this screen built: the server's challenge (and hash, when it says) must be exactly ours.
      if (!sameBytes(fromBase64(options.challenge), withdrawalChallenge(w.id, built.message))) throw new Error("challenge_mismatch");
      if (serverHash && !sameHash(serverHash, built.message)) throw new Error("challenge_mismatch");
      prepared.current = { built, options };
    },
    [from],
  );

  // While the passkey button waits, keep the transfer fresh (the blockhash ages).
  const waitingOn = phase.kind === "passkey" && !phase.busy ? phase.withdrawal : null;
  useEffect(() => {
    if (!waitingOn) return;
    const t = setInterval(() => {
      if (authorized.current === waitingOn.id) return;
      if (prepared.current && Date.now() - prepared.current.built.builtAt > FRESH_MS) {
        prepare(waitingOn).catch((e) => setPhase((p) => (p.kind === "passkey" ? { ...p, notice: describe(e) } : p)));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [waitingOn, prepare]);

  const request = async () => {
    const amount = canonicalAmount(draft.amount, draft.token);
    if (!amount || !isSolanaAddress(draft.to)) return setPhase({ kind: "form" });
    setPhase({ kind: "review", busy: true });
    let w: Withdrawal;
    try {
      w = await createWithdrawal({ token: draft.token, amount, to: draft.to });
    } catch (e) {
      /*
       * A bare 409 used to mean "link your phone", because that was the only
       * one this route could answer. It is not any more — the server refuses
       * a missing passkey with 409 NO_PASSKEY, and a missing web wallet with
       * 409 NO_WEB_WALLET — so catching the STATUS would put "link your
       * phone" in front of somebody whose phone has nothing to do with it.
       * Every refusal now says its own name.
       */
      if (e instanceof WalletApiError && e.code === "LINK_YOUR_PHONE_FIRST") return setPhase({ kind: "link-first" });
      return setPhase({ kind: "review", busy: false, notice: describe(e) });
    }
    if (w.channel === "app") return setPhase({ kind: "on-phone", withdrawal: w });
    setPhase({ kind: "preparing", withdrawal: w });
    try {
      await prepare(w);
      setPhase({ kind: "passkey", withdrawal: w, busy: false });
    } catch (e) {
      setPhase({ kind: "passkey", withdrawal: w, busy: false, notice: describe(e) });
    }
  };

  /** Cancel while the phone has not decided: the server's reject, so the phone cannot approve it after. */
  const cancel = async () => {
    if (phase.kind !== "on-phone") return;
    const w = phase.withdrawal;
    setPhase({ ...phase, cancelling: true, notice: null });
    try {
      await rejectWithdrawal(w.id);
      setPhase({ kind: "form", notice: "Cancelled. Nothing was sent." });
    } catch (e) {
      const decided = e instanceof WalletApiError && e.code === "NOT_PENDING";
      setPhase((p) =>
        p.kind === "on-phone"
          ? { ...p, cancelling: false, notice: decided ? "Your phone already decided on this one, so it can no longer be cancelled." : describe(e) }
          : p,
      );
    }
  };

  const approve = async () => {
    if (phase.kind !== "passkey") return;
    const w = phase.withdrawal;
    const p = prepared.current;
    const b = backup.current;
    if (!p || !b) {
      setPhase({ ...phase, notice: "Still preparing. Try again in a moment." });
      if (!b) void getWalletBackup().then((x) => (backup.current = x), () => undefined);
      if (!p) void prepare(w).catch(() => undefined);
      return;
    }
    setPhase({ ...phase, busy: true, notice: null });
    let prf: Uint8Array | null = null;
    let seed: Uint8Array | null = null;
    try {
      const ids = b.wrappings.map((x) => x.credential_id);
      let a: { credentialId: string; prf: Uint8Array };
      if (authorized.current === w.id) {
        // Approved already (the send failed after): only the wallet has to open again.
        a = await evaluatePrf(ids);
        prf = a.prf;
      } else {
        // One prompt: the server's challenge and the wallet's PRF together.
        const bound = await assertWithPrf(p.options, ids);
        a = bound;
        prf = bound.prf;
        await authorizeWithdrawalPasskey(w.id, bound.assertion);
        authorized.current = w.id;
      }
      const key = await openWallet({ uid, backup: b, credentialId: a.credentialId, prf });
      seed = key.seed;
      const serializedTx = await signWithdrawal(p.built, key.seed, from);
      wipe(seed);
      seed = null;
      setPhase({ kind: "sending", withdrawal: w });
      const sent = await relayerSubmit({ serializedTx, idempotencyKey: p.built.idempotencyKey, withdrawalId: w.id });
      if (sent.status === "confirmed") setPhase({ kind: "result", withdrawal: { ...w, status: "confirmed", signature: sent.signature }, status: "confirmed" });
    } catch (e) {
      setPhase({ kind: "passkey", withdrawal: w, busy: false, notice: describe(e) });
    } finally {
      wipe(prf, seed);
    }
  };

  return (
    <WithdrawView
      phase={phase}
      draft={draft}
      balances={balances}
      setDraft={setDraft}
      approver={approver}
      here={here}
      actions={{
        onBack,
        onReview: () => setPhase({ kind: "review", busy: false }),
        onRequest: () => void request(),
        onConfirmPasskey: () => void approve(),
        onLink: () => {
          // The link screen, then back here. A full load: it carries the wallet pages' strict CSP.
          const back = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`${clientProductBase()}/wallet/link?next=${encodeURIComponent(back)}`);
        },
        onCancel: () => void cancel(),
        onDone: onBack,
        onEdit: () => setPhase({ kind: "form" }),
      }}
    />
  );
}
