"use client";

/**
 * Withdraw from the web wallet: USDC or SOL, on Solana, to a Solana address.
 *
 * Every withdrawal is approved by the linked phone
 * (documentation/link-your-phone-and-approved-withdrawals.md). The server
 * picks how, from what is linked:
 *
 *   app           an Android phone: it gets a push, the person approves and
 *                 the app signs. This screen waits: "Approve on your phone".
 *   web_passkey   an iPhone: approved here, with ONE passkey prompt that both
 *                 answers the server's challenge (bound to the exact bytes of
 *                 this transfer) and opens the wallet (PRF) to sign them.
 *   409 LINK_YOUR_PHONE_FIRST   no phone yet: go and link one.
 *
 * One screen at a time, each with a Back: form → review → waiting or passkey
 * → sending → result.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, glass, Segmented } from "@/components/app/ui";
import { clientProductBase } from "@/lib/app/paths";
import {
  authorizeWithdrawalPasskey,
  createWithdrawal,
  getWithdrawal,
  relayerQuote,
  relayerSubmit,
  withdrawalPasskeyChallenge,
  type AssertionOptionsJSON,
  type Withdrawal,
  type WithdrawalStatus,
} from "@/lib/link/api";
import { getWalletBackup, WalletApiError, type Balances, type WalletBackup } from "@/lib/wallet/api";
import { fromBase64, wipe } from "@/lib/wallet/core";
import { explain } from "@/lib/wallet/explain";
import { openWallet } from "@/lib/wallet/flows";
import { assertWithPrf, evaluatePrf } from "@/lib/wallet/passkey";
import { buildWithdrawal, messageHash, signWithdrawal, type BuiltWithdrawal } from "@/lib/wallet/withdraw";
import {
  canonicalAmount,
  isSolanaAddress,
  sameBytes,
  toBaseUnits,
  withdrawalChallenge,
  type WithdrawToken,
} from "@/lib/wallet/withdraw-core";

/* ── Parts ────────────────────────────────────────────────────────── */

const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-amber px-4 text-small font-medium text-text-on-amber transition-colors hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.05] px-4 text-small font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";
const input =
  "h-11 w-full min-w-0 rounded-[12px] border border-white/10 bg-white/[0.05] px-4 text-small text-text outline-none transition-colors placeholder:text-[#6B8A99] focus:border-amber/60 disabled:opacity-60";

function Card({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <section className={`${glass} mx-auto flex w-full max-w-[640px] flex-col gap-4 p-5 sm:p-6`}>
      <header className="flex items-center gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} className="h-8 rounded-[8px] px-2 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text">
            ← Back
          </button>
        ) : null}
        <h2 className="truncate text-body font-medium text-text">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-small leading-relaxed text-[#9FB7C2]">{children}</p>;
}

function Summary({ token, amount, to }: { token: WithdrawToken; amount: string; to: string }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-[14px] border border-white/10 bg-white/[0.04] p-4 text-small">
      <dt className="text-[#9FB7C2]">You send</dt>
      <dd className="text-right font-medium tabular-nums text-text">
        {amount} {token}
      </dd>
      <dt className="text-[#9FB7C2]">To</dt>
      <dd className="break-all text-right font-mono text-tiny text-text">{to}</dd>
      <dt className="text-[#9FB7C2]">Network</dt>
      <dd className="text-right text-text">Solana</dd>
      <dt className="text-[#9FB7C2]">Network fee</dt>
      <dd className="text-right text-text">Paid by HOLD</dd>
    </dl>
  );
}

function useCountdown(until: string | null): string {
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
  | { kind: "on-phone"; withdrawal: Withdrawal }
  | { kind: "preparing"; withdrawal: Withdrawal }
  | { kind: "passkey"; withdrawal: Withdrawal; busy: boolean; notice?: string | null }
  | { kind: "sending"; withdrawal: Withdrawal }
  | { kind: "result"; withdrawal: Withdrawal; status: WithdrawalStatus };

const RESULT: Partial<Record<WithdrawalStatus, { title: string; text: string; ok: boolean }>> = {
  confirmed: { title: "Sent", text: "It is on the Solana network. The recipient has it now.", ok: true },
  rejected: { title: "Declined on your phone", text: "You declined it on your phone. Nothing was sent.", ok: false },
  expired: { title: "Not approved in time", text: "It was not approved within ten minutes. Nothing was sent.", ok: false },
  failed: { title: "It did not go through", text: "The network did not take it. Nothing left your wallet. Try again.", ok: false },
};

const ON_PHONE: Partial<Record<WithdrawalStatus, string>> = {
  pending: "Waiting for you to approve on your phone",
  approved: "Approved on your phone. Sending…",
  submitted: "Approved. Sending…",
};

export function WithdrawView({
  phase,
  draft,
  balances,
  setDraft,
  actions,
}: {
  phase: WithdrawPhase;
  draft: Draft;
  balances: Balances | null;
  setDraft: (d: Draft) => void;
  actions: {
    onBack: () => void;
    onReview: () => void;
    onRequest: () => void;
    onConfirmPasskey: () => void;
    onLink: () => void;
    onDone: () => void;
    onEdit: () => void;
  };
}) {
  const withdrawal = "withdrawal" in phase ? phase.withdrawal : null;
  const left = useCountdown(phase.kind === "on-phone" || phase.kind === "passkey" ? (withdrawal?.expiresAt ?? null) : null);

  if (phase.kind === "form") {
    const units = toBaseUnits(draft.amount, draft.token);
    const have = balances ? (draft.token === "USDC" ? balances.usdc : balances.sol) : null;
    const tooMuch = units !== null && have !== null && Number(draft.amount) > have;
    const toOk = isSolanaAddress(draft.to);
    const amountHint = !draft.amount
      ? have !== null
        ? `You have ${have.toLocaleString("en-US", { maximumFractionDigits: draft.token === "USDC" ? 2 : 6 })} ${draft.token}`
        : ""
      : units === null
        ? `A positive amount, up to ${draft.token === "USDC" ? 6 : 9} decimals`
        : tooMuch
          ? `More than you have (${have} ${draft.token})`
          : "";
    const toHint = draft.to && !toOk ? (draft.to.trim().startsWith("0x") ? "That is not a Solana address. Only Solana is supported." : "That is not a valid Solana address.") : "";
    return (
      <Card title="Withdraw" onBack={actions.onBack}>
        <Segmented
          label="Token"
          options={[
            { value: "USDC", label: "USDC" },
            { value: "SOL", label: "SOL" },
          ]}
          value={draft.token}
          onChange={(token) => setDraft({ ...draft, token })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-tiny text-[#9FB7C2]">Amount</span>
          <div className="flex gap-2">
            <input className={input} inputMode="decimal" placeholder="0.00" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(",", ".") })} />
            {have !== null && have > 0 ? (
              <button type="button" className={`${btnGhost} h-11`} onClick={() => setDraft({ ...draft, amount: String(have) })}>
                Max
              </button>
            ) : null}
          </div>
          <span className={`h-4 text-tiny ${tooMuch || (draft.amount && units === null) ? "text-amber" : "text-[#7F97A3]"}`}>{amountHint}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-tiny text-[#9FB7C2]">To (a Solana address)</span>
          <input
            className={`${input} font-mono`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Solana address"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value.trim() })}
          />
          <span className="h-4 text-tiny text-amber">{toHint}</span>
        </label>
        {phase.notice ? <Alert>{phase.notice}</Alert> : null}
        <div>
          <button type="button" className={btnPrimary} disabled={units === null || tooMuch || !toOk} onClick={actions.onReview}>
            Review
          </button>
        </div>
      </Card>
    );
  }

  if (phase.kind === "review") {
    return (
      <Card title="Review" onBack={actions.onEdit}>
        <Summary token={draft.token} amount={draft.amount} to={draft.to} />
        <Note>Check the address: a withdrawal cannot be undone. Your phone approves it next.</Note>
        {phase.notice ? <Alert>{phase.notice}</Alert> : null}
        <div>
          <button type="button" className={btnPrimary} disabled={phase.busy} onClick={actions.onRequest}>
            {phase.busy ? "Asking…" : "Withdraw"}
          </button>
        </div>
      </Card>
    );
  }

  if (phase.kind === "link-first") {
    return (
      <Card title="Link your phone first" onBack={actions.onEdit}>
        <Note>Every withdrawal is approved on your phone, and none is linked yet. Link it once, then withdraw.</Note>
        <div>
          <button type="button" className={btnPrimary} onClick={actions.onLink}>
            Link your phone
          </button>
        </div>
      </Card>
    );
  }

  if (phase.kind === "on-phone") {
    const w = phase.withdrawal;
    return (
      <Card title="Approve on your phone">
        <Summary token={w.token} amount={w.amount} to={w.to} />
        <div className="flex items-center gap-3 rounded-[14px] border border-amber/30 bg-amber/10 px-4 py-3">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-[1px] bg-amber" aria-hidden />
          <p className="text-small text-text" role="status">
            {ON_PHONE[w.status] ?? "Waiting for your phone"}
          </p>
        </div>
        <Note>
          Open the HOLD app on your Android phone: a notification asks you to approve this withdrawal. It expires in{" "}
          <span className="tabular-nums">{left}</span>.
        </Note>
      </Card>
    );
  }

  if (phase.kind === "preparing") {
    return (
      <Card title="Approve with your passkey">
        <Summary token={phase.withdrawal.token} amount={phase.withdrawal.amount} to={phase.withdrawal.to} />
        <Note>Preparing the transfer…</Note>
      </Card>
    );
  }

  if (phase.kind === "passkey") {
    const w = phase.withdrawal;
    return (
      <Card title="Approve with your passkey">
        <Summary token={w.token} amount={w.amount} to={w.to} />
        <Note>
          Your passkey approves exactly this transfer and signs it, in one step. Expires in <span className="tabular-nums">{left}</span>.
        </Note>
        {phase.notice ? <Alert>{phase.notice}</Alert> : null}
        <div>
          <button type="button" className={btnPrimary} disabled={phase.busy} onClick={actions.onConfirmPasskey}>
            {phase.busy ? "Waiting for your passkey…" : "Approve with passkey"}
          </button>
        </div>
      </Card>
    );
  }

  if (phase.kind === "sending") {
    const w = phase.withdrawal;
    return (
      <Card title="Sending">
        <Summary token={w.token} amount={w.amount} to={w.to} />
        <p className="text-small text-text" role="status">
          Approved. Sending on Solana…
        </p>
      </Card>
    );
  }

  const r = RESULT[phase.status] ?? RESULT.failed!;
  return (
    <Card title={r.title}>
      <Summary token={phase.withdrawal.token} amount={phase.withdrawal.amount} to={phase.withdrawal.to} />
      <p className={`text-small ${r.ok ? "text-success" : "text-text"}`}>{r.text}</p>
      {phase.withdrawal.signature ? (
        <a
          className="text-tiny text-[#9FB7C2] underline decoration-white/20 underline-offset-2 hover:text-text"
          href={`https://solscan.io/tx/${phase.withdrawal.signature}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          See it on Solscan
        </a>
      ) : null}
      <div>
        <button type="button" className={btnPrimary} onClick={actions.onDone}>
          Done
        </button>
      </div>
    </Card>
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
  }
  if (e instanceof Error && e.message === "challenge_mismatch") return "HOLD asked the passkey to approve something other than this transfer, so we stopped. Nothing was sent.";
  if (e instanceof Error && e.message === "wrong_key") return "That passkey opened a different wallet. Nothing was sent.";
  return explain(e);
}

export function Withdraw({ uid, from, balances, onBack }: { uid: string; from: string; balances: Balances | null; onBack: () => void }) {
  const [draft, setDraft] = useState<Draft>({ token: "USDC", amount: "", to: "" });
  const [phase, setPhase] = useState<WithdrawPhase>({ kind: "form" });
  const backup = useRef<WalletBackup | null>(null);
  const prepared = useRef<{ built: BuiltWithdrawal; options: AssertionOptionsJSON } | null>(null);
  // The withdrawal the server already approved: its bytes are fixed from then on.
  const authorized = useRef<string | null>(null);

  useEffect(() => {
    getWalletBackup().then((b) => (backup.current = b), () => undefined);
  }, []);

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
      if (e instanceof WalletApiError && (e.code === "LINK_YOUR_PHONE_FIRST" || e.status === 409)) return setPhase({ kind: "link-first" });
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
      actions={{
        onBack,
        onReview: () => setPhase({ kind: "review", busy: false }),
        onRequest: () => void request(),
        onConfirmPasskey: () => void approve(),
        onLink: () => {
          const base = clientProductBase();
          // A full load: /welcome has the wallet pages' strict CSP.
          window.location.assign(`${base}/welcome?next=${encodeURIComponent(`${base}/wallet`)}`);
        },
        onDone: onBack,
        onEdit: () => setPhase({ kind: "form" }),
      }}
    />
  );
}
