"use client";

/**
 * The Wallet page: the wallet made in the HOLD app, opened on the web.
 *
 * The HOLD app's Receive and Send, ported (documentation/web-copies-the-app-wallet.md).
 * The web makes, opens and signs with no wallet (Alex, 2026-09-24): no
 * passkey, no recovery phrase, no backup. What it shows:
 *
 *   a wallet in the HOLD app  → its Receive, and Send through the linked
 *                               phone (canPayFromWeb "app"), or "Link your
 *                               phone to pay from here" ("link_first")
 *   anything else             → "Get the HOLD app". The shell's gate keeps
 *                               such an account out already; this is the
 *                               answer if it gets here anyway
 *   Send                      → approved and signed on the linked phone,
 *                               iPhone or Android (Withdraw.tsx)
 *
 * /wallet/send renders this with `send`: straight to Send. Home and a
 * Payments thread send from there.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useT } from "@/lib/app/i18n/react";
import { useBalances, useHoldWallet } from "@/lib/app/hold-wallet";
import { Skeleton } from "@/components/app/ui";
import { getWalletStatus, payerOf, type WalletStatus } from "@/lib/wallet/api";
import { explain } from "@/lib/wallet/explain";

import { useProductHref } from "../base";
import { inAppHref, usePhone } from "../link/in-app";
import { hereNow, useLinkGate } from "../link/LinkGate";
import { AppScreen, FooterNote, PrimaryButton, SecondaryButton, WarningNote } from "./app-kit";
import { GetTheAppCard } from "../main/GetTheApp";
import { Receive } from "./Receive";
import { Withdraw, type WithdrawPrefill } from "./Withdraw";

/** An error line, the app's way: amber on an amber tint, never red. */
function Problem({ children }: { children: ReactNode }) {
  return <WarningNote>{children}</WarningNote>;
}

/* ── The screen ───────────────────────────────────────────────────── */

/** What Payments already knows when it opens Send: ?to, ?amount, ?token, ?peer, ?request, ?lock, ?back. Read once. */
function prefillFromUrl(): WithdrawPrefill {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const token = (q.get("token") ?? "").toUpperCase();
  const group = q.get("group") ?? "";
  const groupTo = q.get("groupTo") ?? "";
  const groupOwe = q.get("groupOwe") ?? "";
  const back = q.get("back") ?? "";
  // Quick Send's locked recipient: a name to SHOW, never a thing to route by (`to` routes).
  const peer = (q.get("peer") ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 64);
  return {
    ...(q.get("to") ? { to: q.get("to")! } : {}),
    ...(q.get("amount") ? { amount: q.get("amount")! } : {}),
    ...(token === "USDC" || token === "SOL" ? { token } : {}),
    // Pay on a payment request: Withdraw settles it once the send confirms.
    ...(q.get("request") ? { requestId: q.get("request")! } : {}),
    // Pay on a group debt (§11.2): Withdraw records it against the group once the send confirms.
    ...(/^[A-Za-z0-9_-]{1,64}$/.test(group) && /^[A-Za-z0-9_-]{1,64}$/.test(groupTo) && /^\d{1,20}$/.test(groupOwe) ? { group: { groupId: group, toUserId: groupTo, amountMinor: groupOwe } } : {}),
    // Only back into a group thread or a 1:1 thread: never an address somebody else chose.
    ...(/^\/payments\/groups\/[A-Za-z0-9_-]{1,64}$/.test(back) || /^\/payments\?thread=[A-Za-z0-9%._~-]{1,200}$/.test(back) ? { back } : {}),
    // Quick Send from a thread, and Pay on a request (its amount locked).
    ...(peer && q.get("to") ? { peer } : {}),
    ...(q.get("lock") === "1" && q.get("request") && q.get("amount") ? { lock: true } : {}),
  };
}

export function WalletScreen({ send = false }: { send?: boolean } = {}) {
  const t = useT();
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setStatus(await getWalletStatus());
    } catch (e) {
      setLoadError(e);
    }
  }, []);
  useEffect(() => void load(), [load]);

  let body: ReactNode;
  if (loadError) {
    body = (
      <AppScreen title={t("wallet.screen.title")}>
        <div className="flex flex-col gap-4 pt-4">
          <Problem>{explain(loadError)}</Problem>
          <SecondaryButton onClick={() => void load()}>
            {t("common.tryAgain")}
          </SecondaryButton>
        </div>
      </AppScreen>
    );
  } else if (!status) {
    body = <Skeleton className="mx-auto h-[320px] w-full max-w-[460px]" />;
  } else if (status.state === "app_wallet") {
    body = <AppWallet status={status} send={send} />;
  } else {
    // No wallet from the app: it is made there, never here.
    body = <NoWalletHere />;
  }

  return <div className="flex min-h-0 flex-1 flex-col py-2">{body}</div>;
}

/* ── An app user ──────────────────────────────────────────────────── */

/**
 * A wallet made in the HOLD app. The web holds no key for it, so what it can
 * do here is what `canPayFromWeb` says (documentation/one-wallet-every-device.md):
 *
 *   app         a phone (iPhone or Android) is linked: Send creates the withdrawal here,
 *               and the phone approves and signs it
 *   link_first  no phone yet: "Link your phone to pay from here"
 *   none        an older backend that cannot take it: send from the app
 */
function AppWallet({ status, send }: { status: WalletStatus; send: boolean }) {
  const t = useT();
  const w = useHoldWallet();
  const productHref = useProductHref();
  const phone = usePhone();
  const payer = payerOf(status);
  const [sending, setSending] = useState(send && payer === "app");
  const [prefill] = useState(prefillFromUrl);
  const balances = useBalances(payer === "app" ? w.solana : null);
  const gate = useLinkGate();
  // Arrived to send (Home, a thread, a request, a typed /wallet/send): the sheet opens at once.
  const { ask } = gate;
  useEffect(() => {
    if (send && payer === "link_first") ask(hereNow());
  }, [send, payer, ask]);

  if (w.loading) return <Skeleton className="mx-auto h-[320px] w-full max-w-[460px]" />;
  if (sending && w.solana) {
    return (
      <Withdraw balances={balances.data ?? null} onBack={() => setSending(false)} prefill={prefill} />
    );
  }

  const openApp = inAppHref("", phone);
  const pay =
    payer === "app" ? (
      <>
        <PrimaryButton icon="send-outline" disabled={!w.solana} onClick={() => setSending(true)}>
          {t("common.send")}
        </PrimaryButton>
        <FooterNote icon="phone-portrait-outline">{t("wallet.appWallet.linkedNote")}</FooterNote>
      </>
    ) : payer === "link_first" ? (
      <>
        {/* Send asks, in the sheet every payment opens (link/LinkGate), and linking comes back to the send. */}
        <PrimaryButton icon="send-outline" onClick={() => gate.ask(send ? hereNow() : productHref("/wallet/send"))}>
          {t("common.send")}
        </PrimaryButton>
        <FooterNote icon="phone-portrait-outline">{t("wallet.appWallet.linkFirstNote")}</FooterNote>
      </>
    ) : (
      <>
        <FooterNote icon="phone-portrait-outline">{t("wallet.appWallet.appOnlyNote")}</FooterNote>
        {openApp ? (
          <SecondaryButton icon="open-outline" onClick={() => window.location.assign(openApp)}>
            {t("wallet.appWallet.openHold")}
          </SecondaryButton>
        ) : null}
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      {gate.sheet}
      {send ? <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3 pt-2">{pay}</div> : null}
      {w.solana ? <Receive address={w.solana} /> : null}
      {!send ? <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3">{pay}</div> : null}
    </div>
  );
}

/* ── No wallet: it is made in the HOLD app ─────────────────────────── */

function NoWalletHere() {
  const t = useT();
  return (
    <AppScreen title={t("wallet.screen.title")}>
      <div className="flex flex-col gap-4 pt-4">
        <GetTheAppCard />
      </div>
    </AppScreen>
  );
}
