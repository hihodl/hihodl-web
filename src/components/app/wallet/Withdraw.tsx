"use client";

/**
 * Send from the web: USDC or SOL, on Solana, to a Solana address, from the
 * wallet made in the HOLD app, approved on the phone it lives on.
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
 * The web does not pay by itself any more (2026-09-24): every send is
 * approved and signed in the HOLD app, on the linked phone (iPhone or
 * Android). documentation/one-wallet-every-device.md.
 *
 *   channel app   the phone gets a push, the person approves and the app
 *                 signs. This screen waits: "Approve on your phone", with
 *                 Open HOLD (an intent on Android, the site's universal link
 *                 on an iPhone), the inbox hint and Cancel.
 *   409 LINK_YOUR_PHONE_FIRST
 *                 no phone linked: the link sheet (link/LinkGate), coming
 *                 back to this send.
 *
 * The backend contract is the withdrawal one: only the screens took the
 * app's shape.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { recordSentPayment } from "@/lib/app/groups";
import { t, type MessageKey } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";
import { moneyText } from "@/lib/app/groups-rules";
import { settleWithWithdrawal, type SettleOutcome } from "@/lib/app/payment-requests";
import { createWithdrawal, getWithdrawal, rejectWithdrawal, type Withdrawal, type WithdrawalStatus } from "@/lib/link/api";
import { useDefaultPhone } from "@/lib/link/default-phone";
import { openOnPhone } from "@/lib/link/intent";
import { approveOnDefaultPhone, phonePlatformOf, type PhonePlatform } from "@/lib/link/payment-approval-core";
import { phoneOf, type Phone } from "@/lib/link/ua";
import { WalletApiError, type Balances } from "@/lib/wallet/api";
import { explain } from "@/lib/wallet/explain";
import { canonicalAmount, isSolanaAddress, paysTheRequest, toBaseUnits, type WithdrawToken } from "@/lib/wallet/withdraw-core";

import { AppScreen, FooterNote, PrimaryButton, StatusLine, SUB, useCountdown, WarningNote } from "./app-kit";
import { QuickSendView } from "./QuickSend";
import { Ion } from "../ion";
import { useProductHref } from "../base";
import { hereNow, useLinkGate } from "../link/LinkGate";

/**
 * What another screen already knows when it opens Send. `group` is Pay on a
 * group debt (contract §11.2): once the send confirms, it is recorded against
 * that group. `back` is the group thread to return to.
 */
export interface WithdrawPrefill {
  to?: string;
  amount?: string;
  token?: WithdrawToken;
  requestId?: string;
  group?: { groupId: string; toUserId: string; amountMinor: string };
  back?: string;
  /**
   * Quick Send from a 1:1 thread: the person's name, shown in the header with
   * a lock. The recipient is not asked for again, and Back goes to the thread.
   */
  peer?: string;
  /** Paying a request: the amount and the token are the request's, not editable here. */
  lock?: boolean;
}

/* ── Parts ────────────────────────────────────────────────────────── */

const DECIMALS: Record<WithdrawToken, number> = { USDC: 6, SOL: 9 };

/** What became of the request, said once the payment is on the result screen. */
function settleLine(o: SettleOutcome | "pending"): string {
  if (o === "pending") return t("requests.settle.pending");
  if (o.kind === "settled") return t("requests.settle.done");
  if (o.kind === "closed") return t("requests.settle.closed");
  if (o.kind === "short") {
    const cur = o.currency && /^[A-Z]{3}$/.test(o.currency.toUpperCase()) ? o.currency.toUpperCase() : null;
    const proven = o.provenMinor && /^\d+$/.test(o.provenMinor) && cur ? moneyText(o.provenMinor, cur) : null;
    return proven ? t("requests.settle.shortBy", { amount: proven }) : t("requests.settle.short");
  }
  return o.kind === "unknown" ? t("requests.settle.unknown") : t("requests.settle.unproven");
}

/** Confirm's short recipient: six, an ellipsis, four. */
function shortTo(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return fmtNumber(n, { maximumFractionDigits: n < 1 ? 6 : 4 });
}

/** Confirm's hero: "RECIPIENT GETS", the amount at 44/800, the symbol at 22/600. */
function Hero({ label, amount, token }: { label?: string; amount: string; token: WithdrawToken }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-1.5 pb-[18px] pt-8">
      <p className="text-[12px] font-strong uppercase tracking-[0.8px] text-white/55">{label ?? t("wallet.send.recipientGets")}</p>
      <p className="flex items-end gap-2.5 pb-0.5">
        <span className="text-[44px] font-strong leading-none tracking-[-0.8px] tabular-nums text-white">{fmtAmount(amount)}</span>
        <span className="mb-1 text-[22px] font-strong text-white/55">{token}</span>
      </p>
    </div>
  );
}

const confirmCard = "rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-4 py-3";

/** Confirm's recipient card: the wallet avatar, the short address, (i) for the whole one. */
function RecipientCard({ to, name = null }: { to: string; name?: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className={confirmCard}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(124,198,232,0.25)] bg-[rgba(124,198,232,0.12)]">
          <Ion name="wallet-outline" size={20} color="#7CC6E8" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-strong tracking-[-0.2px] text-white">
          {name ? (
            <>
              {name} <span className="font-normal text-white/55">· {shortTo(to)}</span>
            </>
          ) : (
            shortTo(to)
          )}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t("wallet.send.recipientWallet")} className="rounded-[10px] p-1 hover:bg-white/[0.06]">
          <Ion name="information-circle-outline" size={20} color="rgba(255,255,255,0.55)" />
        </button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[11px] font-strong uppercase tracking-[0.5px] text-white/55">{t("wallet.send.recipientWallet")}</p>
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
  const t = useT();
  return (
    <div className={confirmCard}>
      <Row label={t("wallet.send.youSend")}>
        {fmtAmount(amount)} {token}
      </Row>
      <div className="h-px bg-white/[0.08]" />
      <Row label={t("wallet.send.networkFee")}>
        <span className="text-[#22C55E]">{t("wallet.send.free")}</span>
      </Row>
      <div className="h-px bg-white/[0.08]" />
      <Row label={t("common.network")}>Solana</Row>
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
  | { kind: "on-phone"; withdrawal: Withdrawal; cancelling?: boolean; notice?: string | null }
  | { kind: "sending"; withdrawal: Withdrawal }
  | { kind: "result"; withdrawal: Withdrawal; status: WithdrawalStatus };

/** tx-confirm's headings, and the web's own for the ways a phone approval ends without a send. */
const RESULT: Partial<Record<WithdrawalStatus, { title: MessageKey; text: MessageKey; ok: boolean }>> = {
  confirmed: { title: "wallet.send.result.confirmedTitle", text: "wallet.send.result.confirmedText", ok: true },
  rejected: { title: "wallet.send.result.rejectedTitle", text: "wallet.send.result.rejectedText", ok: false },
  expired: { title: "wallet.send.result.expiredTitle", text: "wallet.send.result.expiredText", ok: false },
  failed: { title: "wallet.send.result.failedTitle", text: "wallet.send.result.failedText", ok: false },
};

const ON_PHONE: Partial<Record<WithdrawalStatus, MessageKey>> = {
  approved: "wallet.send.onPhone.approved",
  submitted: "wallet.send.onPhone.submitted",
};

/** Review's last line: who approves next. */
const NEXT: MessageKey = "wallet.send.next.phone";

/** The countdown inside a sentence, kept in tabular figures. */
const tabular = { n: (c: ReactNode) => <span className="tabular-nums">{c}</span> };

export function WithdrawView({
  phase,
  draft,
  balances,
  setDraft,
  here = null,
  defaultPhone = null,
  peer = null,
  locked = false,
  settle = null,
  actions,
}: {
  phase: WithdrawPhase;
  draft: Draft;
  balances: Balances | null;
  setDraft: (d: Draft) => void;
  /** Quick Send from a thread: the person, locked in. */
  peer?: string | null;
  /** Paying a request: the amount and token are fixed. */
  locked?: boolean;
  /** Paying a request: what closing it came to, once the money moved ("pending" while it is asked). */
  settle?: SettleOutcome | "pending" | null;
  /** The phone this page is on: it gets Open HOLD (an intent on Android, the universal link on an iPhone). */
  here?: Phone | null;
  /** The default phone, which approves: "Open HOLD on your iPhone to approve". */
  defaultPhone?: PhonePlatform | null;
  actions: {
    onBack: () => void;
    onReview: () => void;
    onRequest: () => void;
    onCancel: () => void;
    onDone: () => void;
    onEdit: () => void;
  };
}) {
  const t = useT();
  const withdrawal = "withdrawal" in phase ? phase.withdrawal : null;
  const left = useCountdown(phase.kind === "on-phone" ? (withdrawal?.expiresAt ?? null) : null);
  // The form is the app's two screens: who (send/search), then how much (QuickSend).
  const [step, setStep] = useState<"to" | "amount">(() => (isSolanaAddress(draft.to) ? "amount" : "to"));

  if (phase.kind === "form" && step === "to") {
    const toOk = isSolanaAddress(draft.to);
    const toHint = draft.to && !toOk ? (draft.to.trim().startsWith("0x") ? t("wallet.send.notSolanaEvm") : t("wallet.send.notSolana")) : "";
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
              placeholder={t("wallet.send.pasteAddress")}
              aria-label={t("wallet.send.recipientAddressAria")}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value.trim() })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && toOk) setStep("amount");
              }}
            />
          </label>
          {toOk ? (
            <>
              <p className="px-1 pt-2 text-[13px] font-strong text-white/60">{t("wallet.send.detected")}</p>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="flex w-full items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.09]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(124,198,232,0.12)]">
                  <Ion name="wallet-outline" size={16} color="#7CC6E8" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-strong text-white">{t("wallet.send.walletRow", { address: shortTo(draft.to) })}</span>
                <Ion name="chevron-forward" size={18} color="rgba(255,255,255,0.55)" />
              </button>
            </>
          ) : toHint ? (
            <WarningNote>{toHint}</WarningNote>
          ) : (
            <div className="flex flex-col items-center px-8 pt-16 text-center">
              <Ion name="wallet-outline" size={48} color={SUB} />
              <p className="mt-4 text-[15px] font-strong text-[#9FB7C2]">{t("wallet.send.pasteAddress")}</p>
              <p className="mt-2 text-[13px] text-[#9FB7C2]">{t("wallet.send.emptyHint")}</p>
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
    const holding = (t: WithdrawToken) => (balances ? (t === "USDC" ? balances.usdc : balances.sol) : null);
    const options = (["USDC", "SOL"] as const)
      .filter((t) => !locked || t === draft.token)
      .map((t) => ({ token: t, chain: "solana", balance: holding(t) }));

    return (
      <QuickSendView
        mode="send"
        recipient={{ name: peer ?? shortTo(draft.to), locked: !!peer }}
        // From a thread there is no "who" step to go back to: Back is the thread.
        onBack={peer ? actions.onBack : () => setStep("to")}
        amount={draft.amount}
        onAmount={(amount) => setDraft({ ...draft, amount })}
        amountLocked={locked}
        decimals={DECIMALS[draft.token]}
        option={{ token: draft.token, chain: "solana" }}
        options={options}
        onOption={(o) => setDraft({ ...draft, token: o.token === "SOL" ? "SOL" : "USDC", amount: "" })}
        available={have}
        notice={phase.notice}
        lockedLine={locked ? t("requests.payingRequest", { name: peer ?? shortTo(draft.to) }) : null}
        cta={{ label: t("common.continue"), disabled: units === null || tooMuch || !toOk, onClick: actions.onReview }}
      />
    );
  }

  if (phase.kind === "review") {
    return (
      <AppScreen title={t("wallet.send.confirmTitle")} onBack={actions.onEdit}>
        <Hero amount={draft.amount} token={draft.token} />
        <div className="flex flex-col gap-3">
          <RecipientCard to={draft.to} name={peer} />
          <Summary token={draft.token} amount={draft.amount} />
          {phase.notice ? <WarningNote>{phase.notice}</WarningNote> : null}
          <div className="pt-4">
            <PrimaryButton disabled={phase.busy} onClick={actions.onRequest}>
              {phase.busy ? t("wallet.send.preparing") : t("common.send")}
            </PrimaryButton>
          </div>
          <FooterNote icon="phone-portrait-outline">{t(NEXT)}</FooterNote>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "on-phone") {
    const w = phase.withdrawal;
    // Open HOLD on the withdrawal from this phone (an intent on Android, the universal link on an iPhone); nothing on a computer.
    const open = openOnPhone(`withdrawals/${encodeURIComponent(w.id)}`, here);
    return (
      <AppScreen title={t("wallet.send.confirmTitle")}>
        <Hero amount={w.amount} token={w.token} />
        <div className="flex flex-col gap-3">
          <StatusLine>{w.status === "pending" || !ON_PHONE[w.status] ? approveOnDefaultPhone(defaultPhone) : t(ON_PHONE[w.status]!)}</StatusLine>
          <RecipientCard to={w.to} name={peer} />
          <Summary token={w.token} amount={w.amount} />
          {phase.notice ? <WarningNote>{phase.notice}</WarningNote> : null}
          {w.status === "pending" ? (
            <div className="flex flex-col gap-2 pt-2">
              {open ? (
                // A new tab: this page keeps following the withdrawal while the app opens on it.
                <a
                  href={open}
                  target="_blank"
                  rel="noopener"
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#FFB703] px-5 text-[15px] font-strong text-[#0A0F14] transition-opacity hover:opacity-90"
                >
                  <Ion name="open-outline" size={18} color="#0A0F14" />
                  {t("wallet.send.openHold")}
                </a>
              ) : null}
              <button
                type="button"
                onClick={actions.onCancel}
                disabled={phase.cancelling}
                className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] px-5 py-3.5 text-[15px] font-strong text-white transition-colors hover:bg-white/[0.12] disabled:opacity-60"
              >
                {phase.cancelling ? t("wallet.send.cancelling") : t("common.cancel")}
              </button>
            </div>
          ) : null}
          <FooterNote icon="phone-portrait-outline">
            <Rich k="wallet.send.phoneNote" vars={{ left }} tags={tabular} />
          </FooterNote>
        </div>
      </AppScreen>
    );
  }

  if (phase.kind === "sending") {
    const w = phase.withdrawal;
    return (
      <AppScreen title={t("wallet.send.confirmTitle")}>
        <Hero amount={w.amount} token={w.token} />
        <div className="flex flex-col gap-3">
          <StatusLine>{t("wallet.send.sendingPayment")}</StatusLine>
          <RecipientCard to={w.to} name={peer} />
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
        <h2 className="mb-1.5 text-[20px] font-strong text-white">{t(r.title)}</h2>
        <p className="text-[14px] text-[#CFE3EC]">{t("wallet.send.resultTo", { to: peer ?? shortTo(w.to), amount: `${fmtAmount(w.amount)} ${w.token}` })}</p>
        <p className={`mt-2.5 text-[13px] ${r.ok ? "text-[#20D690]" : "text-[#CFE3EC]"}`}>{t(r.text)}</p>
        {r.ok && settle ? <p className="mt-1.5 text-[13px] leading-[18px] text-[#CFE3EC]">{settleLine(settle)}</p> : null}
        {w.signature ? (
          <a
            className="mt-2.5 inline-flex items-center gap-1 text-[13px] text-[#9FB7C2] underline decoration-white/20 underline-offset-2 hover:text-white"
            href={`https://solscan.io/tx/${w.signature}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("wallet.send.seeOnSolscan")} <Ion name="open-outline" size={13} color={SUB} />
          </a>
        ) : null}
        <button type="button" onClick={actions.onDone} className="mt-[18px] flex h-12 w-full items-center justify-center rounded-[12px] bg-[#FFB703] text-[15px] font-strong text-[#0A1A24] hover:opacity-90">
          {t("common.close")}
        </button>
      </div>
    </AppScreen>
  );
}

/* ── The logic ────────────────────────────────────────────────────── */

const POLL_MS = 2000;
const FINAL: WithdrawalStatus[] = ["confirmed", "rejected", "expired", "failed"];

function describe(e: unknown): string {
  if (e instanceof WalletApiError) {
    if (e.code === "WITHDRAWAL_NEEDS_APPROVAL") return t("wallet.send.error.needsApproval");
    if (e.code === "WITHDRAWAL_EXPIRED" || e.status === 410) return t("wallet.send.error.expired");
    if (e.code === "INSUFFICIENT_FUNDS" || e.code === "INSUFFICIENT_BALANCE") return t("wallet.send.error.insufficient");
    if (e.code === "NO_WALLET" || e.code === "NO_WEB_WALLET") return t("wallet.send.error.noWalletGetApp");
    if (e.code === "APPROVE_ON_YOUR_DEFAULT_PHONE") return approveOnDefaultPhone(phonePlatformOf(e.details.platform));
  }
  return explain(e);
}

export function Withdraw({
  balances,
  onBack,
  prefill,
}: {
  balances: Balances | null;
  onBack: () => void;
  /**
   * What another screen already knows: Pay on a request, or Send from a
   * thread whose handle resolved. Read once, into the first draft — after
   * that the person owns the form, and a prop that kept writing into it would
   * undo their typing on every re-render.
   */
  prefill?: WithdrawPrefill;
}) {
  const productHref = useProductHref();
  // Recording a group payment, or closing a request, in flight: leaving waits a little for it, so a quick Close doesn't drop it.
  const recording = useRef<Promise<unknown> | null>(null);
  // Opened from a group's Pay or a thread's Quick Send: Back and Close return there.
  const leave = prefill?.back
    ? () => {
        const go = () => window.location.assign(productHref(prefill.back!));
        if (!recording.current) return go();
        void Promise.race([recording.current.catch(() => undefined), new Promise((r) => setTimeout(r, 8000))]).then(go);
      }
    : onBack;
  const [draft, setDraft] = useState<Draft>({
    token: prefill?.token ?? "USDC",
    amount: prefill?.amount ?? "",
    to: prefill?.to ?? "",
  });
  const [phase, setPhase] = useState<WithdrawPhase>({ kind: "form" });
  const gate = useLinkGate();
  const defaultPhone = useDefaultPhone();
  const [here, setHere] = useState<Phone | null>(null);
  useEffect(() => setHere(phoneOf(navigator.userAgent, navigator.maxTouchPoints ?? 0)), []);
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
   * with the withdrawal as proof (contract §1, `settle {withdrawalId}`).
   * After the send, never before it, and once per page.
   *
   * It is no longer gated on what went out matching what was asked: the
   * server checks the proof (the payer's wallet to the requester's, and an
   * amount that covers it) and says `transfer_amount_short` when it does not,
   * which is an answer this screen can SAY, where a silent client-side gate
   * left the request open with no word as to why. So the outcome is shown on
   * the result, under "Payment sent" — the payment happened either way.
   */
  const settled = useRef(false);
  const [settle, setSettle] = useState<SettleOutcome | "pending" | null>(null);
  const confirmed = phase.kind === "result" && phase.status === "confirmed" ? phase.withdrawal : null;
  useEffect(() => {
    const requestId = prefill?.requestId;
    if (!confirmed || !requestId || settled.current) return;
    settled.current = true;
    setSettle("pending");
    const p = settleWithWithdrawal(requestId, confirmed.id).then(setSettle, () => setSettle({ kind: "unproven" }));
    recording.current = p;
    void p.finally(() => {
      if (recording.current === p) recording.current = null;
    });
  }, [confirmed, prefill]);

  /*
   * Pay on a group debt: once the money is confirmed, and only when what went
   * out is what the debt asked (same address, token and amount), record it in
   * the group. Once per page; a failure leaves the debt showing in the group,
   * where "Paid another way" still records it.
   */
  const groupRecorded = useRef(false);
  useEffect(() => {
    const g = prefill?.group;
    if (!confirmed || !g || groupRecorded.current) return;
    if (!paysTheRequest(prefill, confirmed)) return;
    groupRecorded.current = true;
    const p = recordSentPayment(g.groupId, { toUserId: g.toUserId, amountMinor: g.amountMinor }, confirmed.id).catch(() => undefined);
    recording.current = p;
    void p.finally(() => {
      if (recording.current === p) recording.current = null;
    });
  }, [confirmed, prefill]);

  const request = async () => {
    const amount = canonicalAmount(draft.amount, draft.token);
    if (!amount || !isSolanaAddress(draft.to)) return setPhase({ kind: "form" });
    setPhase({ kind: "review", busy: true });
    let w: Withdrawal;
    try {
      w = await createWithdrawal({ token: draft.token, amount, to: draft.to });
    } catch (e) {
      // Every refusal says its own name: only this one means "link your phone".
      if (e instanceof WalletApiError && e.code === "LINK_YOUR_PHONE_FIRST") {
        // No phone linked (or it was removed since this page read the status):
        // the same sheet as every other payment, coming back to this send.
        // Nothing was sent; the review stays under it.
        setPhase({ kind: "review", busy: false });
        return gate.ask(hereNow());
      }
      return setPhase({ kind: "review", busy: false, notice: describe(e) });
    }
    if (w.channel === "app") return setPhase({ kind: "on-phone", withdrawal: w });
    // An older server handed it to the passkey, which the web no longer
    // opens: withdrawn, so it cannot be approved anywhere, and the phone asked for.
    void rejectWithdrawal(w.id).catch(() => undefined);
    setPhase({ kind: "review", busy: false });
    gate.ask(hereNow());
  };

  /** Cancel while the phone has not decided: the server's reject, so the phone cannot approve it after. */
  const cancel = async () => {
    if (phase.kind !== "on-phone") return;
    const w = phase.withdrawal;
    setPhase({ ...phase, cancelling: true, notice: null });
    try {
      await rejectWithdrawal(w.id);
      setPhase({ kind: "form", notice: t("wallet.send.cancelled") });
    } catch (e) {
      const decided = e instanceof WalletApiError && e.code === "NOT_PENDING";
      setPhase((p) =>
        p.kind === "on-phone"
          ? { ...p, cancelling: false, notice: decided ? t("wallet.send.alreadyDecided") : describe(e) }
          : p,
      );
    }
  };

  return (
    <>
      {gate.sheet}
      <WithdrawView
        phase={phase}
        draft={draft}
        balances={balances}
        setDraft={setDraft}
        here={here}
        defaultPhone={defaultPhone}
        peer={prefill?.peer ?? null}
        locked={!!prefill?.lock}
        settle={settle}
        actions={{
          onBack: leave,
          onReview: () => setPhase({ kind: "review", busy: false }),
          onRequest: () => void request(),
          onCancel: () => void cancel(),
          onDone: leave,
          onEdit: () => setPhase({ kind: "form" }),
        }}
      />
    </>
  );
}
