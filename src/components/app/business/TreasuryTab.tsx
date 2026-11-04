"use client";

/**
 * Business › Treasury: the Squads vault sponsors pay, who approves, what it
 * holds, the last sales paid into it, and a pending change with its
 * countdown and Cancel.
 *
 * HOW SIGNING WORKS HERE
 *
 * Create, link and remove need the step-up: a signature by the person's HOLD
 * Solana key over the server's words. That key is on the phone behind Face ID
 * and the web cannot ask it to sign, so those three open the app's treasury
 * screen (ApproveInApp). Cancelling a pending change needs no step-up and
 * happens here.
 *
 * A hardware wallet member (a CFO's Ledger) is the desk's part: the browser
 * wallet (Phantom or Solflare, either of which can front a Ledger) signs the
 * member challenge here, and the proof travels to the app in the link that
 * opens it, to be sent with the create. It is good for 30 minutes.
 */

import { useEffect, useState } from "react";

import {
  cancelChange,
  memberChallenge,
  useBusinessRefresh,
  useChange,
  useTreasury,
  type Treasury,
  type TreasuryChange,
  type TreasuryMember,
} from "@/lib/app/business";
import { timeLeft, usdcFromBase } from "@/lib/app/business-rules";
import { fmtDateTime } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { connectSolana, describeWalletError, signSolanaMessage, WalletError } from "@/lib/creator/wallets";

import { Notice } from "../hold";
import { Ion } from "../ion";
import { btnGlassPill, btnWhite, Card, Divider, Empty, Field, inputCls, KV, ListRow, SectionLabel, Tag } from "../spaces/kit";
import { Skeleton } from "../ui";
import { AddressLine, ApproveInApp, businessErrorText, ErrorNote, shortAddress, solscanTx } from "./parts";

/** The app's treasury screen (hihodl://ad-space/treasury). */
const APP_TREASURY = "ad-space/treasury";

export function TreasuryTab({ isOwner, hasProfile, changeId }: { isOwner: boolean; hasProfile: boolean; changeId: string | null }) {
  const t = useT();
  const treasury = useTreasury(isOwner);

  return (
    <div className="flex flex-col gap-2.5">
      {changeId && (!isOwner || treasury.data?.pendingChange?.id !== changeId) ? <ChangeById id={changeId} /> : null}
      {isOwner ? (
        !hasProfile ? (
          <Notice tone="calm">{t("business.treasury.profileFirst")}</Notice>
        ) : treasury.error ? (
          <ErrorNote error={treasury.error} />
        ) : treasury.data === undefined ? (
          <Skeleton className="h-48" />
        ) : treasury.data.treasury ? (
          <TreasuryView treasury={treasury.data.treasury} change={treasury.data.pendingChange ?? null} />
        ) : (
          <NoTreasury change={treasury.data.pendingChange ?? null} />
        )
      ) : null}
    </div>
  );
}

/* ── No treasury yet ─────────────────────────────────────────────── */

function NoTreasury({ change }: { change: TreasuryChange | null }) {
  const t = useT();
  return (
    <>
      {change ? <PendingChange change={change} /> : null}
      <Card>
        <Empty icon="shield-checkmark-outline" title={t("business.treasury.emptyTitle")} body={t("business.treasury.emptyBody")} />
      </Card>
      <ApproveInApp title={t("business.treasury.setUpTitle")} body={t("business.treasury.setUpBody")} path={APP_TREASURY} />
      <ExternalMember />
    </>
  );
}

/* ── The treasury ────────────────────────────────────────────────── */

function TreasuryView({ treasury, change }: { treasury: Treasury; change: TreasuryChange | null }) {
  const t = useT();
  const balance = usdcFromBase(treasury.usdcBalanceBase);
  const payments = treasury.payments ?? [];
  return (
    <>
      {change ? <PendingChange change={change} /> : null}

      <SectionLabel right={<Tag label={treasury.source === "linked" ? t("business.treasury.linked") : t("business.treasury.created")} tone="calm" />}>
        {t("business.treasury.vault")}
      </SectionLabel>
      <Card className="gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-white/55">{t("business.treasury.balance")}</span>
          <span className="text-[28px] font-extrabold tabular-nums tracking-[-0.6px] text-white">{balance !== null ? `${balance} USDC` : "—"}</span>
        </div>
        <Divider />
        <KV k={t("business.treasury.vaultAddress")} v={<AddressLine address={treasury.vaultAddress} />} />
        <KV k={t("business.treasury.multisig")} v={<AddressLine address={treasury.multisigAddress} />} />
        <KV k={t("business.treasury.approvals")} v={t("business.treasury.threshold", { threshold: treasury.threshold, members: treasury.members.length })} />
        {treasury.live === false ? <Notice tone="calm">{t("business.treasury.notLive")}</Notice> : null}
        <p className="text-[12.5px] leading-[18px] text-white/55">{t("business.treasury.vaultHint")}</p>
      </Card>

      <SectionLabel>{t("business.treasury.members")}</SectionLabel>
      <Card className="gap-0 py-1.5">
        {treasury.members.map((m) => (
          <MemberRow key={m.address} member={m} />
        ))}
      </Card>

      <SectionLabel>{t("business.treasury.payments")}</SectionLabel>
      <Card className="gap-0 py-1.5">
        {payments.length === 0 ? (
          <p className="px-1 py-3 text-[13.5px] text-white/55">{t("business.treasury.noPayments")}</p>
        ) : (
          payments.map((p) => (
            <ListRow
              key={p.orderId}
              title={`${usdcFromBase(p.priceBase) ?? "—"} USDC`}
              meta={p.paidAt ? fmtDateTime(p.paidAt) : p.status}
              right={
                p.txSignature ? (
                  <a href={solscanTx(p.txSignature)} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-strong text-white/[0.82] underline-offset-2 hover:underline">
                    {t("business.treasury.viewTx")}
                  </a>
                ) : null
              }
            />
          ))
        )}
      </Card>

      {!change ? (
        <ApproveInApp title={t("business.treasury.changeTitle")} body={t("business.treasury.changeBody")} path={APP_TREASURY} />
      ) : null}
    </>
  );
}

function MemberRow({ member: m }: { member: TreasuryMember }) {
  const t = useT();
  const name =
    m.kind === "external"
      ? m.label || t("business.treasury.outsideWallet")
      : m.displayName || (m.handle ? `@${m.handle}` : m.userId ? t("business.treasury.holdUser") : m.label || t("business.treasury.outsideWallet"));
  return (
    <ListRow
      title={
        <span className="inline-flex items-center gap-2">
          {name}
          {m.isYou ? <Tag label={t("business.you")} tone="good" /> : null}
        </span>
      }
      meta={shortAddress(m.address)}
      right={<Tag label={m.kind === "external" || (!m.kind && !m.userId) ? t("business.treasury.kindExternal") : t("business.treasury.kindHold")} tone="dim" />}
    />
  );
}

/* ── A pending change ────────────────────────────────────────────── */

function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function PendingChange({ change }: { change: TreasuryChange }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const left = timeLeft(change.effectiveAt, now);
  const pending = change.status === "pending";

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelChange(change.id);
      await refresh("treasury", "change");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const status =
    change.status === "cancelled"
      ? t("business.change.cancelled")
      : change.status === "applied"
        ? t("business.change.applied")
        : change.status === "void"
          ? t("business.change.void")
          : left
            ? t("business.change.appliesIn", { days: left.days, hours: left.hours, minutes: left.minutes })
            : t("business.change.applying");

  return (
    <Card className="gap-3 border-amber/40 bg-amber/[0.08]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[20px] bg-amber/[0.16] text-amber">
          <Ion name="time-outline" size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[15px] font-bold text-white">{change.action === "remove" ? t("business.change.removeTitle") : t("business.change.replaceTitle")}</p>
          <p className="text-[13.5px] font-strong text-amber">{status}</p>
          <p className="text-[13px] leading-5 text-white/[0.82]">
            {t("business.change.requestedAt", { when: fmtDateTime(change.requestedAt) })} · {t("business.change.effectiveAt", { when: fmtDateTime(change.effectiveAt) })}
          </p>
        </div>
      </div>
      {change.to ? (
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-white/[0.05] px-3 py-2.5">
          <KV k={t("business.change.newVault")} v={<AddressLine address={change.to.vaultAddress} />} />
          <KV k={t("business.treasury.approvals")} v={t("business.treasury.threshold", { threshold: change.to.threshold, members: change.to.members.length })} />
          {change.to.members.map((m) => (
            <MemberRow key={m.address} member={m} />
          ))}
        </div>
      ) : change.action === "remove" ? (
        <p className="text-[13px] leading-5 text-white/[0.82]">{t("business.change.removeBody")}</p>
      ) : null}
      {pending ? <p className="text-[12.5px] leading-[18px] text-white/[0.82]">{t("business.change.notYou")}</p> : null}
      <ErrorNote error={error} />
      {pending && change.canCancel ? (
        <button type="button" className={`${btnWhite} self-start`} disabled={busy} onClick={() => void cancel()}>
          {busy ? t("business.change.cancelling") : t("business.change.cancel")}
        </button>
      ) : null}
    </Card>
  );
}

/** A change opened from its push (`?change=<id>`): the owner, a manager or a member of the multisig. */
function ChangeById({ id }: { id: string }) {
  const change = useChange(id);
  if (change.error) return <ErrorNote error={change.error} />;
  if (!change.data) return <Skeleton className="h-32" />;
  return <PendingChange change={change.data.change} />;
}

/* ── A hardware wallet member ────────────────────────────────────── */

type Proof = { address: string; nonce: string; signature: string; label: string; expiresAt: number };

/**
 * The member challenge, signed by a browser wallet. Phantom and Solflare sign
 * it with `signMessage`; with a Ledger behind them, the Ledger shows the words
 * (one line of plain ASCII) and the wallet hands back the signature, which
 * the server checks against every off-chain envelope a Ledger produces.
 */
function ExternalMember() {
  const t = useT();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const now = useNow(15_000);

  async function prove() {
    setBusy(true);
    setError(null);
    try {
      const address = await connectSolana();
      const challenge = await memberChallenge(address);
      const signature = await signSolanaMessage(challenge.message);
      setProof({ address, nonce: challenge.nonce, signature, label: label.trim(), expiresAt: Date.now() + challenge.expiresInMinutes * 60_000 });
    } catch (e) {
      setError(e instanceof WalletError ? describeWalletError(e) : businessErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  const expired = proof ? proof.expiresAt <= now : false;
  const path = proof
    ? `${APP_TREASURY}?${new URLSearchParams({
        member: proof.address,
        nonce: proof.nonce,
        signature: proof.signature,
        ...(proof.label ? { label: proof.label } : {}),
      })}`
    : APP_TREASURY;

  return (
    <>
      <SectionLabel>{t("business.member.title")}</SectionLabel>
      <Card className="gap-3">
        <p className="text-[13.5px] leading-5 text-white/[0.82]">{t("business.member.body")}</p>
        {!proof || expired ? (
          <>
            <Field label={t("business.member.label")} htmlFor="b-member-label" hint={t("business.member.labelHint")}>
              <input id="b-member-label" className={inputCls} maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("business.member.labelPlaceholder")} />
            </Field>
            {expired ? <Notice>{t("business.error.memberProofExpired")}</Notice> : null}
            {error ? <Notice>{error}</Notice> : null}
            <button type="button" className={`${btnGlassPill} self-start`} disabled={busy} onClick={() => void prove()}>
              <Ion name="key-outline" size={16} />
              {busy ? t("business.member.signing") : t("business.member.connect")}
            </button>
          </>
        ) : (
          <Notice tone="good" icon="checkmark-circle-outline">
            {t("business.member.proved", { address: shortAddress(proof.address), when: fmtDateTime(new Date(proof.expiresAt)) })}
          </Notice>
        )}
      </Card>
      {proof && !expired ? <ApproveInApp title={t("business.member.continueTitle")} body={t("business.member.continueBody")} path={path} /> : null}
    </>
  );
}
