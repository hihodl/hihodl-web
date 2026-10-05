"use client";

/**
 * A recurring link's page, under the owner: "10 USDC / month", what paying
 * means (this period now, then every period, cancel anytime), and the
 * wallets that can subscribe. Paying is subscribing, once, from a Solana
 * wallet (Phantom, Solflare, any injected one): card, bank, the EVM networks
 * and the QR can't subscribe yet, and the page says so in one line.
 *
 * The server builds the subscribe transaction; the page checks it is exactly
 * that (recurring.ts) before the wallet sees it, and the wallet signs and
 * sends it (the payer pays the network fee and the accounts' rent, ~0.004
 * SOL). Then the page asks the server, which reads the chain, until the
 * subscription is there. The first period is charged by HOLD right after.
 *
 * A wallet already subscribed whose approval another app replaced (nothing
 * can be charged) gets "Renew" instead of a refusal: the server hands back
 * the SPL Approve alone, checked the same way (reapproveTxProblem), and the
 * wallet signs that.
 */

import { useEffect, useState } from "react";

import { CheckoutError } from "@/lib/ad-space/checkout-client";
import { base64ToBytes, blockhashExpired, watchSolanaWallets, type SolanaWallet } from "@/lib/ad-space/wallets";
import { useT } from "@/lib/app/i18n/react";
import { startSubscribe, subscribed } from "@/lib/pay-links/client";
import { walletBrowseUrl, type Platform } from "@/lib/pay-links/page-rules";
import { reapproveTxProblem, subscribeTxProblem, usdcText } from "@/lib/pay-links/recurring";
import type { PayLinkRecurring, ShownPayLink } from "@/lib/pay-links/types";

import { WALLET_LOGO } from "./PayLinkPay";

type Phase =
  | { kind: "choose" }
  | { kind: "busy"; label: string }
  | { kind: "renew"; wallet: SolanaWallet; payer: string }
  | { kind: "done"; renewed?: boolean };

const POLL_MS = 3_000;
const POLL_FOR_MS = 120_000;
/** The wallets whose own browser a phone opens this page in. Solana only: a subscription is a Solana program. */
const PHONE_WALLETS = ["phantom", "solflare"] as const;
const WALLET_NAME = { phantom: "Phantom", solflare: "Solflare" } as const;

export function RecurringPay({
  link,
  recurring,
  payee,
  platform,
  pageUrl,
}: {
  link: ShownPayLink;
  recurring: PayLinkRecurring;
  payee: string;
  platform: Platform | null;
  pageUrl: string;
}) {
  const t = useT();
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => watchSolanaWallets(setWallets), []);

  const plan = recurring.plan;
  const price = plan ? usdcText(plan.amountBase) : usdcText(String(recurring.amountCents * 10_000));
  const phone = platform === "ios" || platform === "android";
  const busy = phase.kind === "busy";

  function problemText(e: unknown): string {
    if (e instanceof CheckoutError) {
      if (e.code === "insufficient_funds" || e.code === "no_usdc_account") return t("payPage.recurring.needUsdc", { amount: price });
      if (e.code === "already_subscribed") return t("payPage.recurring.already");
      if (e.code === "own_link") return t("payPage.recurring.ownLink");
      if (e.code === "plan_not_ready" || e.code === "link_not_active") return t("payPage.recurring.notReady");
    }
    const msg = String((e as { message?: unknown })?.message ?? "");
    // The wallet's simulation: no SOL for the fee and the accounts' rent.
    if (/insufficient (lamports|funds for rent)|0x1\b|debit an account/i.test(msg)) return t("payPage.recurring.needSol");
    if (/reject|cancel|denied|declined/i.test(msg)) return t("payPage.recurring.cancelled");
    return t("payPage.recurring.failed");
  }

  /** The server's transaction for this wallet, checked: a subscription, or (renew) the Approve alone. */
  async function built(web3: typeof import("@solana/web3.js"), payer: string) {
    const res = await startSubscribe(link.code, payer);
    const tx = web3.VersionedTransaction.deserialize(base64ToBytes(res.transaction));
    const problem = res.renew
      ? reapproveTxProblem(web3, tx, { payerAddress: payer })
      : subscribeTxProblem(web3, tx, { payerAddress: payer, plan: plan! });
    if (problem) throw new Error(`unexpected_transaction:${problem}`);
    return { tx, renew: res.renew === true };
  }

  /** Signs and sends what the server built (once more on a stale blockhash), then waits for the chain. */
  async function signAndWait(wallet: SolanaWallet, payer: string, renew: boolean) {
    const web3 = await import("@solana/web3.js");
    setPhase({ kind: "busy", label: t("payPage.recurring.preparing") });
    let { tx, renew: now } = await built(web3, payer);
    // The page offered one thing; the server must still mean the same.
    if (now !== renew) throw new Error("state_changed");
    setPhase({ kind: "busy", label: t("payPage.recurring.approveIn", { wallet: wallet.name }) });
    try {
      await wallet.provider.signAndSendTransaction(tx);
    } catch (e) {
      if (!blockhashExpired(e)) throw e;
      ({ tx, renew: now } = await built(web3, payer));
      if (now !== renew) throw new Error("state_changed");
      await wallet.provider.signAndSendTransaction(tx);
    }
    setPhase({ kind: "busy", label: t(renew ? "payPage.recurring.renewing" : "payPage.recurring.subscribing") });
    const since = Date.now();
    for (;;) {
      const r = await subscribed(link.code, payer).catch(() => ({ state: "pending" as const }));
      if (r.state === "active") return setPhase({ kind: "done", renewed: renew });
      if (Date.now() - since > POLL_FOR_MS) throw new Error("not_seen");
      await new Promise((ok) => setTimeout(ok, POLL_MS));
    }
  }

  async function subscribeWith(wallet: SolanaWallet) {
    if (!plan) return;
    setNotice(null);
    try {
      setPhase({ kind: "busy", label: t("payPage.stable.connecting", { wallet: wallet.name }) });
      const connected = (await wallet.provider.connect()) as { publicKey?: { toString(): string } } | undefined;
      const payer = (connected?.publicKey ?? wallet.provider.publicKey)?.toString();
      if (!payer) throw new Error("no_account");
      const web3 = await import("@solana/web3.js");
      setPhase({ kind: "busy", label: t("payPage.recurring.preparing") });
      // Already subscribed, approval gone: ask before the wallet signs anything.
      if ((await built(web3, payer)).renew) return setPhase({ kind: "renew", wallet, payer });
      await signAndWait(wallet, payer, false);
    } catch (e) {
      setNotice(problemText(e));
      setPhase({ kind: "choose" });
    }
  }

  async function renewWith(wallet: SolanaWallet, payer: string) {
    setNotice(null);
    try {
      await signAndWait(wallet, payer, true);
    } catch (e) {
      setNotice(problemText(e));
      setPhase({ kind: "renew", wallet, payer });
    }
  }

  const per = t("payPage.recurring.per", { period: recurring.period });

  return (
    <>
      <section className="mt-4 flex flex-col items-center text-center">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[40px] font-extrabold leading-[46px] tracking-[-0.8px] text-white">{price}</span>
          <span className="text-[17px] font-bold text-[#CFE3EC]">{per}</span>
        </p>
        <p className="mt-1.5 max-w-[320px] text-[14px] leading-[19px] text-[#CFE3EC]">
          {t("payPage.recurring.terms", { amount: price, period: recurring.period })}
        </p>
        {notice ? (
          <p className="mt-2.5 px-2 text-center text-[13px] leading-[18px] text-amber" role="status">
            {notice}
          </p>
        ) : null}
      </section>

      {phase.kind === "done" ? (
        <section className="mt-6 flex flex-col items-center rounded-[28px] border border-white/[0.08] bg-white/[0.06] px-5 py-6 text-center">
          <span className="text-[17px] font-extrabold text-[#2FBE8A]">
            {t(phase.renewed ? "payPage.recurring.renewedTitle" : "payPage.recurring.doneTitle")}
          </span>
          <span className="mt-1.5 text-[14px] leading-[19px] text-[#CFE3EC]">
            {t(phase.renewed ? "payPage.recurring.renewedBody" : "payPage.recurring.doneBody", { payee, amount: price, period: recurring.period })}
          </span>
        </section>
      ) : phase.kind === "renew" ? (
        <>
          <p className="mt-5 px-2 text-center text-[14px] leading-[19px] text-[#CFE3EC]">{t("payPage.recurring.renewNeeded", { payee })}</p>
          <div className="mt-3 overflow-hidden rounded-[28px] border border-x-white/[0.07] border-b-white/[0.04] border-t-white/[0.16] bg-white/[0.06] backdrop-blur-xl">
            <Row
              icon={<Logo src={phase.wallet.icon ?? logoFor(phase.wallet.name)} />}
              label={t("payPage.recurring.renewWith", { wallet: phase.wallet.name })}
              onClick={() => void renewWith(phase.wallet, phase.payer)}
              last
            />
          </div>
        </>
      ) : !recurring.ready || !plan ? (
        <p className="mt-6 text-center text-[14px] text-[#9FB7C2]">{t("payPage.recurring.notReady")}</p>
      ) : (
        <>
          <h2 className="mb-1.5 mt-5 px-1 text-[13px] font-strong leading-[18px] text-[#9FB7C2]">{t("payPage.howToPay")}</h2>
          <div className="overflow-hidden rounded-[28px] border border-x-white/[0.07] border-b-white/[0.04] border-t-white/[0.16] bg-white/[0.06] backdrop-blur-xl">
            {wallets.length > 0
              ? wallets.map((w, i) => (
                  <Row
                    key={w.name}
                    icon={<Logo src={w.icon ?? logoFor(w.name)} />}
                    label={t("payPage.recurring.subscribeWith", { wallet: w.name })}
                    onClick={() => void subscribeWith(w)}
                    disabled={busy}
                    last={i === wallets.length - 1}
                  />
                ))
              : phone
                ? PHONE_WALLETS.map((id, i) => (
                    <Row
                      key={id}
                      icon={<Logo src={WALLET_LOGO[id]} />}
                      label={t("payPage.recurring.subscribeWith", { wallet: WALLET_NAME[id] })}
                      href={pageUrl ? walletBrowseUrl(id, pageUrl) : undefined}
                      last={i === PHONE_WALLETS.length - 1}
                    />
                  ))
                : (
                    <p className="px-4 py-3.5 text-[14px] leading-[19px] text-[#CFE3EC]">{t("payPage.recurring.noWallet")}</p>
                  )}
          </div>
          {busy ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-[#CFE3EC]" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden />
              {phase.label}
            </p>
          ) : null}
          <p className="mt-3 px-2 text-center text-[12.5px] leading-[17px] text-[#9FB7C2]">{t("payPage.recurring.onlySolana")}</p>
        </>
      )}
    </>
  );
}

function logoFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("solflare")) return WALLET_LOGO.solflare;
  return WALLET_LOGO.phantom;
}

function Logo({ src }: { src: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={36} height={36} className="h-full w-full object-contain" />
    </span>
  );
}

function Row({
  icon,
  label,
  onClick,
  href,
  disabled,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  last?: boolean;
}) {
  const cls = `flex w-full min-w-0 items-center gap-3.5 px-4 py-2.5 text-start transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-60 ${
    last ? "" : "border-b border-white/[0.06]"
  }`;
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold leading-5 text-white">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  );
}
