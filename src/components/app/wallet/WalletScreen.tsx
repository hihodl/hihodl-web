"use client";

/**
 * The web wallet (phase 1: Solana, read-only), protected by a passkey.
 *
 * Every screen is the HOLD app's own, ported (documentation/web-copies-the-app-wallet.md):
 * the home is the app's balance hero and quick actions, Receive is the app's
 * Receive, Send is Quick Send and Confirm, and the settings are the app's
 * Account recovery, Passkeys and Recovery Phrase. One screen at a time, each
 * with the app's back chevron:
 *
 *   no wallet anywhere        → Create (passkey with PRF, then the wallet);
 *                               with the rollout gate closed, how to get one
 *   a wallet in the HOLD app  → its Receive, and Send through the linked
 *                               phone (canPayFromWeb "app"), or "Link your
 *                               phone to pay from here" ("link_first"). We
 *                               never make a second wallet
 *   a web wallet, locked      → Unlock with passkey
 *   unlocked                  → Home: balance · Receive · Send · Security
 *   Send                      → approved on the linked Android phone, or
 *                               with the passkey (Withdraw.tsx)
 *
 * /wallet/send renders this with `send`: straight to Send, for everybody,
 * gate or not (nav.openToAll). Home and a Payments thread send from there.
 *   Security                  → Recovery phrase (12 words) · Passkeys (add, remove)
 *
 * Design and threat model: documentation/web-wallet-passkey-phase-1.md.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { chosenUsername } from "@/lib/app/me";
import { useBalances, useHoldWallet } from "@/lib/app/hold-wallet";
import { useMe } from "@/lib/app/spaces-data";
import { useShell } from "@/components/app/Shell";
import { Skeleton } from "@/components/app/ui";
import {
  addWrapping,
  beginPasskeyRegistration,
  completePasskeyRegistration,
  getBalances,
  getWalletBackup,
  getWalletStatus,
  listPasskeys,
  payerOf,
  removeWrapping,
  WalletApiError,
  type Balances,
  type RegistrationOptionsJSON,
  type WalletBackup,
  type WalletStatus,
  type WrappingMeta,
} from "@/lib/wallet/api";
import { wipe } from "@/lib/wallet/core";
import { explain, LOSS_WARNING } from "@/lib/wallet/explain";
import {
  openMnemonic,
  openWallet,
  registerWalletAddress,
  sealNewWallet,
  userSecretFrom,
  WalletFlowError,
  wrapForPasskey,
} from "@/lib/wallet/flows";
import { createPasskeyWithPrf, evaluatePrf, normalizeCredentialId, PasskeyError, passkeysHere, prfTrustedHere } from "@/lib/wallet/passkey";
import { lock, unlockWith, useVault } from "@/lib/wallet/vault";

import { UserAvatar } from "../account/UserAvatar";
import { useProductHref } from "../base";
import { inAppHref, linkHref, playHref, usePhone } from "../link/in-app";
import {
  ActionsRow,
  AppScreen,
  Card,
  FooterNote,
  HeroBalance,
  HeroBody,
  HeroCard,
  InfoBox,
  MiniAction,
  money,
  PrimaryButton,
  RowSeparator,
  SecondaryButton,
  SectionLabel,
  TokenRow,
  WarningNote,
  AMBER,
  GREEN,
} from "./app-kit";
import { Ion, type IonName } from "../ion";
import { Receive } from "./Receive";
import { Withdraw } from "./Withdraw";

/* ── Small parts ──────────────────────────────────────────────────── */

/** An error line, the app's way: amber on an amber tint, never red. */
function Problem({ children }: { children: ReactNode }) {
  return <WarningNote>{children}</WarningNote>;
}

/** Registration options, fetched ahead of the click (Safari wants the ceremony inside it) and kept fresh. */
function useRegistrationOptions(active: boolean) {
  const { session } = useShell();
  const [options, setOptions] = useState<RegistrationOptionsJSON | null>(null);
  const [error, setError] = useState<unknown>(null);
  const refresh = useCallback(async () => {
    setOptions(null);
    setError(null);
    try {
      setOptions(await beginPasskeyRegistration(session.user.email ?? "", session.user.id));
    } catch (e) {
      setError(e);
    }
  }, [session.user.email, session.user.id]);
  useEffect(() => {
    if (!active) return;
    void refresh();
    // The server's challenge lives five minutes.
    const t = setInterval(() => void refresh(), 4 * 60 * 1000);
    return () => clearInterval(t);
  }, [active, refresh]);
  return { options, error, refresh };
}

/* ── The screen ───────────────────────────────────────────────────── */

/** What Payments already knows when it opens Send: ?to, ?amount, ?token. Read once. */
function prefillFromUrl(): { to?: string; amount?: string; token?: "USDC" | "SOL" } {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const token = (q.get("token") ?? "").toUpperCase();
  return {
    ...(q.get("to") ? { to: q.get("to")! } : {}),
    ...(q.get("amount") ? { amount: q.get("amount")! } : {}),
    ...(token === "USDC" || token === "SOL" ? { token } : {}),
  };
}

/** Who approves a web wallet's send, when the server has said; undefined when it has not. */
function approverOf(status: WalletStatus): "phone" | "passkey" | undefined {
  if (!status.canPayFromWeb) return undefined;
  return status.canPayFromWeb === "app" ? "phone" : "passkey";
}

export function WalletScreen({ send = false }: { send?: boolean } = {}) {
  const vault = useVault();
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
  // Leaving the wallet locks it: another page of the product, signing out, or
  // another person signing in on this tab never finds it open.
  useEffect(() => () => lock(), []);

  // Once unlocked (or just created), make sure the backend watches this
  // address for deposits. One attempt per address per page visit; a failure
  // is retried on the next unlock.
  const tried = useRef<string | null>(null);
  const unlockedAddress = vault.status === "unlocked" ? vault.address : null;
  useEffect(() => {
    if (!unlockedAddress || status === null || tried.current === unlockedAddress) return;
    tried.current = unlockedAddress;
    void registerWalletAddress(unlockedAddress, status.registered_address).then((r) => {
      if (r === "registered") setStatus((s) => (s ? { ...s, registered_address: unlockedAddress } : s));
    });
  }, [unlockedAddress, status]);

  let body: ReactNode;
  if (loadError) {
    body = (
      <AppScreen title="Wallet">
        <div className="flex flex-col gap-4 pt-4">
          <Problem>{explain(loadError)}</Problem>
          <SecondaryButton onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      </AppScreen>
    );
  } else if (!status) {
    body = <Skeleton className="mx-auto h-[320px] w-full max-w-[460px]" />;
  } else if (status.state === "app_wallet") {
    // A wallet made in the app shows whatever the gate says: the gate is about
    // making one here, and this one is already made.
    body = <AppWallet status={status} send={send} />;
  } else if (status.state === "none" && status.enabled === false) {
    // The rollout gate: no wallet is made on the web for this account yet. Said, not a blank page.
    body = <NoWalletHere />;
  } else if (status.state === "web_wallet" && !status.current_blob_hash) {
    body = <WalletOnAnotherAccount />;
  } else if (!passkeysHere()) {
    body = (
      <AppScreen title="Wallet">
        <div className="pt-4">
          <InfoBox>{explain(new PasskeyError("unavailable"))}</InfoBox>
        </div>
      </AppScreen>
    );
  } else if (status.state === "none" && !prfTrustedHere()) {
    // Said instead of the Create screen, not after it: on this OS a wallet
    // made here could later refuse to open, and there is nothing on the
    // screen that would fix it.
    body = (
      <AppScreen title="Wallet">
        <div className="pt-4">
          <InfoBox>{explain(new PasskeyError("os_too_old"))}</InfoBox>
        </div>
      </AppScreen>
    );
  } else if (status.state === "none") {
    body = <Create status={status} onCreated={() => void load()} />;
  } else if (vault.status === "unlocked" && vault.address) {
    body = <Home address={vault.address} status={status} send={send} onChanged={() => void load()} />;
  } else {
    body = <Unlock />;
  }

  return <div className="flex min-h-0 flex-1 flex-col py-2">{body}</div>;
}

/* ── A web wallet kept under an older account with this email ────── */

function WalletOnAnotherAccount() {
  return (
    <AppScreen title="Wallet">
      <div className="pt-4">
        <HeroCard icon="wallet-outline" title="Your wallet is on your previous account">
          <HeroBody>
            This email already has a web wallet, made under an earlier HOLD account, and the web never makes a second one.
            Write to support from this email and we will move you back to that account.
          </HeroBody>
        </HeroCard>
      </div>
    </AppScreen>
  );
}

/* ── An app user ──────────────────────────────────────────────────── */

/**
 * A wallet made in the HOLD app. The web holds no key for it, so what it can
 * do here is what `canPayFromWeb` says (documentation/one-wallet-every-device.md):
 *
 *   app         an Android phone is linked: Send creates the withdrawal here,
 *               and the phone approves and signs it
 *   link_first  no Android phone yet: "Link your phone to pay from here"
 *   none        an older backend that cannot take it: send from the app
 */
function AppWallet({ status, send }: { status: WalletStatus; send: boolean }) {
  const w = useHoldWallet();
  const { session } = useShell();
  const productHref = useProductHref();
  const phone = usePhone();
  const payer = payerOf(status);
  const [sending, setSending] = useState(send && payer === "app");
  const [prefill] = useState(prefillFromUrl);
  const balances = useBalances(payer === "app" ? w.solana : null);

  if (w.loading) return <Skeleton className="mx-auto h-[320px] w-full max-w-[460px]" />;
  if (sending && w.solana) {
    return (
      <Withdraw
        uid={session.user.id}
        from={w.solana}
        balances={balances.data ?? null}
        approver="phone"
        onBack={() => setSending(false)}
        prefill={prefill}
      />
    );
  }

  const openApp = inAppHref("", phone);
  const pay =
    payer === "app" ? (
      <>
        <PrimaryButton icon="send-outline" disabled={!w.solana} onClick={() => setSending(true)}>
          Send
        </PrimaryButton>
        <FooterNote icon="phone-portrait-outline">
          This wallet was made in the HOLD app. Your linked phone approves and signs every payment you start here.
        </FooterNote>
      </>
    ) : payer === "link_first" ? (
      <>
        <HeroCard icon="phone-portrait-outline" title="Link your phone to pay from here">
          <HeroBody>
            This wallet was made in the HOLD app, and its keys stay on your phone. Link the phone once, and every payment you
            start here is approved and signed there.
          </HeroBody>
        </HeroCard>
        <PrimaryButton icon="qr-code-outline" onClick={() => window.location.assign(linkHref(productHref, productHref(send ? "/wallet/send" : "/wallet")))}>
          Link your phone
        </PrimaryButton>
      </>
    ) : (
      <>
        <FooterNote icon="phone-portrait-outline">This wallet was made in the HOLD app, which keeps its keys. Send and swap there.</FooterNote>
        {openApp ? (
          <SecondaryButton icon="open-outline" onClick={() => window.location.assign(openApp)}>
            Open HOLD
          </SecondaryButton>
        ) : null}
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      {send ? <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3 pt-2">{pay}</div> : null}
      {w.solana ? <Receive address={w.solana} /> : null}
      {!send ? <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3">{pay}</div> : null}
    </div>
  );
}

/* ── No wallet, and the web does not make one for this account yet ── */

function NoWalletHere() {
  const phone = usePhone();
  return (
    <AppScreen title="Wallet">
      <div className="flex flex-col gap-4 pt-4">
        {phone === "ios" ? (
          <HeroCard icon="wallet-outline" title="No wallet yet">
            <HeroBody>Making a wallet on the web is not open for this account yet. Nothing is lost: when it opens, it is made here with your passkey.</HeroBody>
          </HeroCard>
        ) : (
          <>
            <HeroCard icon="wallet-outline" title="Make your wallet in the HOLD app">
              <HeroBody>
                The HOLD app on Google Play makes your wallet with every chain. Sign in there with this account, and it shows here
                too.
              </HeroBody>
            </HeroCard>
            <PrimaryButton icon="logo-google" onClick={() => window.open(playHref(phone), "_blank", "noopener")}>
              Get HOLD on Google Play
            </PrimaryButton>
          </>
        )}
      </div>
    </AppScreen>
  );
}

/* ── Create ───────────────────────────────────────────────────────── */

type CreateStep =
  | { kind: "intro" }
  | { kind: "confirm"; credentialId: string } // passkey made, PRF not yet evaluated
  | { kind: "sealing" }
  | { kind: "done"; address: string };

function Create({ status, onCreated }: { status: WalletStatus; onCreated: () => void }) {
  const { session } = useShell();
  const [step, setStep] = useState<CreateStep>({ kind: "intro" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);
  const reg = useRegistrationOptions(step.kind === "intro");

  useEffect(() => {
    listPasskeys()
      .then((p) => setExisting(p.map((x) => normalizeCredentialId(x.id))))
      .catch(() => setExisting([]));
  }, []);

  const seal = async (credentialId: string, prf: Uint8Array, label: string | null) => {
    setStep({ kind: "sealing" });
    try {
      const key = await sealNewWallet({ uid: session.user.id, credentialId, prf, label });
      const address = key.address;
      unlockWith(key);
      setStep({ kind: "done", address });
    } catch (e) {
      setError(e);
      setStep({ kind: "intro" });
    } finally {
      wipe(prf);
    }
  };

  const createNew = async () => {
    if (!reg.options) return;
    setBusy(true);
    setError(null);
    try {
      // PRF is checked before anything reaches the server: a passkey that
      // cannot protect a wallet is never registered and nothing is written.
      const made = await createPasskeyWithPrf(reg.options);
      await completePasskeyRegistration(made.registration);
      if (made.prf) await seal(made.credentialId, made.prf, "This browser");
      else setStep({ kind: "confirm", credentialId: made.credentialId });
    } catch (e) {
      setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (credentialIds: string[], label: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const a = await evaluatePrf(credentialIds);
      await seal(a.credentialId, a.prf, label);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === "done") {
    return (
      <AppScreen title="Wallet">
        <div className="flex flex-col gap-4 pt-4">
          <HeroCard icon="shield-checkmark" title="Your wallet is ready">
            <HeroBody>Your Solana address:</HeroBody>
            <p className="break-all px-1 text-center font-mono text-[13px] leading-[19px] text-white">{step.address}</p>
          </HeroCard>
          <PrimaryButton onClick={onCreated}>Open wallet</PrimaryButton>
          <FooterNote icon="lock-closed-outline">Write down your 12 words from Security. They are the only way back if every passkey is lost.</FooterNote>
        </div>
      </AppScreen>
    );
  }

  if (step.kind === "sealing") {
    return (
      <AppScreen title="Wallet">
        <div className="flex flex-col gap-4 pt-4">
          <HeroCard icon="hourglass-outline" title="Creating your wallet">
            <HeroBody>Making it in this browser and sealing it with your passkey.</HeroBody>
          </HeroCard>
          <Skeleton className="h-[52px] w-full" />
        </div>
      </AppScreen>
    );
  }

  if (step.kind === "confirm") {
    return (
      <AppScreen title="Wallet">
        <div className="flex flex-col gap-4 pt-4">
          <HeroCard icon="finger-print" title="Confirm your new passkey">
            <HeroBody>Once more, so it can seal your wallet.</HeroBody>
          </HeroCard>
          {error ? <Problem>{explain(error)}</Problem> : null}
          <PrimaryButton icon="finger-print" disabled={busy} onClick={() => void confirm([step.credentialId], "This browser")}>
            Confirm with passkey
          </PrimaryButton>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Wallet">
      <div className="flex flex-col gap-4 pt-4">
        <HeroCard icon="finger-print" title="Create your wallet">
          <HeroBody>A Solana wallet for USDC and SOL, locked by a passkey: Face ID, Touch ID or your device PIN.</HeroBody>
        </HeroCard>
        {!status.email_verified ? <Problem>{explain(new WalletApiError("EMAIL_NOT_VERIFIED", 403))}</Problem> : null}
        {error ? <Problem>{explain(error)}</Problem> : null}
        {reg.error ? <Problem>{explain(reg.error)}</Problem> : null}
        <PrimaryButton icon="add" disabled={busy || !reg.options || !status.email_verified} onClick={() => void createNew()}>
          Create with a new passkey
        </PrimaryButton>
        {existing.length > 0 ? (
          <SecondaryButton icon="finger-print" disabled={busy || !status.email_verified} onClick={() => void confirm(existing, null)}>
            Use a passkey I already have
          </SecondaryButton>
        ) : null}
        <FooterNote icon="lock-closed-outline">{LOSS_WARNING}</FooterNote>
      </div>
    </AppScreen>
  );
}

/* ── Unlock ───────────────────────────────────────────────────────── */

function Unlock() {
  const { session } = useShell();
  const [backup, setBackup] = useState<WalletBackup | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getWalletBackup().then(setBackup, setError);
  }, []);

  const unlock = async () => {
    if (!backup) return;
    setBusy(true);
    setError(null);
    let prf: Uint8Array | null = null;
    try {
      const a = await evaluatePrf(backup.wrappings.map((w) => w.credential_id));
      prf = a.prf;
      unlockWith(await openWallet({ uid: session.user.id, backup, credentialId: a.credentialId, prf }));
    } catch (e) {
      setError(e);
    } finally {
      wipe(prf);
      setBusy(false);
    }
  };

  const name = useDisplayName();
  return (
    <AppScreen>
      <div className="flex flex-col items-center px-6 pt-10">
        <p className="mb-6 text-center text-[24px] font-strong text-white">Welcome Back, {name}</p>
        <span className="mb-8">
          <UserAvatar size={100} fallbackName={name} />
        </span>
        {error ? (
          <div className="mb-4 w-full">
            <Problem>{explain(error)}</Problem>
          </div>
        ) : null}
        <PrimaryButton icon="finger-print" disabled={busy || !backup} onClick={() => void unlock()}>
          Unlock with passkey
        </PrimaryButton>
      </div>
    </AppScreen>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */

/** The name the app greets with: the @username, else the display name, else the email. */
function useDisplayName(): string {
  const me = useMe();
  const { session } = useShell();
  const username = chosenUsername(me.data);
  return username ? `@${username}` : me.data?.profile.displayName?.trim() || session.user.email || "you";
}

type HomeScreen = "home" | "withdraw" | "receive" | "security" | "passkeys" | "export" | "add";

function Home({ address, status, send, onChanged }: { address: string; status: WalletStatus; send: boolean; onChanged: () => void }) {
  const { session } = useShell();
  // The Dashboard's quick actions land here as ?open=receive|send|security; /wallet/send as `send`.
  const [screen, setScreen] = useState<HomeScreen>(() => {
    if (send) return "withdraw";
    const open = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("open");
    return open === "receive" ? "receive" : open === "send" ? "withdraw" : open === "security" ? "security" : "home";
  });
  /*
   * …and Payments lands here with the answer already in hand: Pay on a request
   * carries the amount, and a thread whose handle resolved carries the
   * address. Read ONCE, at mount, so a later render can never write over what
   * the person has typed since.
   */
  const [prefill] = useState(prefillFromUrl);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const name = useDisplayName();

  useEffect(() => {
    getBalances(address).then(
      (b) => setBalances(b),
      () => setBalanceError(true),
    );
  }, [address]);

  const back = () => setScreen("home");
  const toSecurity = () => setScreen("security");
  const toPasskeys = () => setScreen("passkeys");

  if (screen === "receive") return <Receive address={address} onBack={back} />;
  if (screen === "withdraw")
    return <Withdraw uid={session.user.id} from={address} balances={balances} approver={approverOf(status)} onBack={back} prefill={prefill} />;
  if (screen === "security") return <Security onBack={back} onPhrase={() => setScreen("export")} onPasskeys={toPasskeys} />;
  if (screen === "passkeys")
    return <Passkeys wrappings={status.wrappings} onBack={toSecurity} onAdd={() => setScreen("add")} onChanged={onChanged} />;
  if (screen === "export") return <Export onBack={toSecurity} />;
  if (screen === "add") return <AddPasskey onBack={toPasskeys} onAdded={onChanged} />;

  const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d === 2 ? 2 : 0, maximumFractionDigits: d });
  const sol = balances ? `${fmt(balances.sol, 4)} SOL` : balanceError ? "–" : "…";
  return (
    <AppScreen>
      {/* DashboardHeader: who you are on the left, the glass buttons on the right. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="flex min-w-0 items-center gap-2.5">
          <UserAvatar size={36} fallbackName={name} />
          <span className="truncate text-[17px] font-strong text-white">{name}</span>
        </span>
        <button
          type="button"
          onClick={lock}
          aria-label="Lock"
          title="Lock"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.15] bg-white/10 transition-colors hover:bg-white/[0.16]"
        >
          <Ion name="lock-closed-outline" size={18} color="#FFFFFF" />
        </button>
      </div>

      {/* HeroSection: the balance, centred, then the quick actions. */}
      <div className="mt-8 flex flex-col items-center">
        {balanceError ? (
          <span className="block text-[48px] font-strong leading-[52px] text-white">–</span>
        ) : (
          <HeroBalance value={balances ? money(balances.usdc) : null} />
        )}
      </div>
      <div className="mt-7">
        <ActionsRow>
          <MiniAction icon="add-circle-outline" label="Receive" onClick={() => setScreen("receive")} />
          <MiniAction icon="send-outline" label="Send" onClick={() => setScreen("withdraw")} />
          <MiniAction icon="shield-checkmark-outline" label="Security" onClick={toSecurity} />
        </ActionsRow>
      </div>

      {/* TokenList, in its GlassCard. */}
      <div className="mt-5">
        <Card className="overflow-hidden">
          <TokenRow
            symbol="USDC"
            name="USD Coin"
            sub={balances ? `${fmt(balances.usdc, 2)} USDC` : balanceError ? "–" : "…"}
            value={balances ? money(balances.usdc) : balanceError ? "–" : "…"}
            valueSub={balances ? `${fmt(balances.usdc, 2)} USDC` : undefined}
          />
          <RowSeparator />
          <TokenRow symbol="SOL" name="Solana" sub="Network fees" value={sol} />
        </Card>
      </div>
    </AppScreen>
  );
}

/* ── Security: the app's Account recovery (backup.tsx) ────────────── */

function MenuRow({ icon, label, sub, onClick, divider }: { icon: IonName; label: string; sub?: string; onClick: () => void; divider?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-[18px] py-[18px] text-left transition-colors hover:bg-white/[0.03] ${divider ? "border-t border-white/[0.08]" : ""}`}
    >
      <Ion name={icon} size={18} color="#FFFFFF" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-strong text-white">{label}</span>
        {sub ? <span className="mt-0.5 block text-[13px] text-white/55">{sub}</span> : null}
      </span>
      <Ion name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
    </button>
  );
}

function Security({ onBack, onPhrase, onPasskeys }: { onBack: () => void; onPhrase: () => void; onPasskeys: () => void }) {
  return (
    <AppScreen title="Account recovery" onBack={onBack}>
      <div className="flex flex-col pt-2">
        <HeroCard icon="shield-checkmark" title="Your safety net">
          <HeroBody>
            HOLD is non-custodial — we cannot recover your funds if you lose access. Keep at least one backup factor active and
            stored somewhere safe.
          </HeroBody>
        </HeroCard>
        <div className="mt-6">
          <SectionLabel>Backup factors</SectionLabel>
          <Card className="overflow-hidden">
            <MenuRow icon="key-outline" label="Recovery phrase" onClick={onPhrase} />
            <MenuRow icon="finger-print" label="Passkeys" onClick={onPasskeys} divider />
          </Card>
        </div>
        <FooterNote icon="lock-closed-outline">{LOSS_WARNING}</FooterNote>
      </div>
    </AppScreen>
  );
}

/* ── Passkeys (passkeys.tsx) ──────────────────────────────────────── */

function Passkeys({
  wrappings,
  onBack,
  onAdd,
  onChanged,
}: {
  wrappings: WrappingMeta[];
  onBack: () => void;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const remove = async (id: string) => {
    setError(null);
    try {
      await removeWrapping(id);
      setConfirming(null);
      onChanged();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <AppScreen title="Passkeys" onBack={onBack}>
      <div className="flex flex-col pt-3">
        <SectionLabel>All passkeys</SectionLabel>
        <div className="mb-4 flex flex-col gap-3">
          {wrappings.map((w, i) => {
            const name = w.label ?? `Passkey ${i + 1}`;
            const asking = confirming === w.credential_id;
            return (
              <div key={w.credential_id} className="flex flex-col gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.05] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,183,3,0.1)]">
                    <Ion name="finger-print" size={20} color={AMBER} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-[15px] font-strong text-white">{name}</span>
                    <span className="truncate text-[12px] font-medium text-white/55">
                      Added {new Date(w.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  {wrappings.length > 1 && !asking ? (
                    <button
                      type="button"
                      onClick={() => setConfirming(w.credential_id)}
                      aria-label={`Remove ${name}`}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[17px] transition-colors hover:bg-white/[0.12]"
                    >
                      <Ion name="trash-outline" size={18} color="rgba(255,255,255,0.55)" />
                    </button>
                  ) : null}
                </div>
                {asking ? (
                  <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                    <p className="text-[13px] leading-[18px] text-white/65">
                      Remove {name}? It won&apos;t open this wallet anymore. You can add it back any time from this screen.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void remove(w.credential_id)}
                        className="h-9 flex-1 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-strong text-[#FFB703] hover:bg-white/[0.12]"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="h-9 flex-1 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-strong text-white hover:bg-white/[0.12]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {error ? (
          <div className="mb-4">
            <Problem>{explain(error)}</Problem>
          </div>
        ) : null}
        <SecondaryButton icon="add" onClick={onAdd}>
          Add a passkey
        </SecondaryButton>
        <FooterNote icon="shield-checkmark-outline">
          Removing the last passkey is not allowed. To replace it, add a new one first, then remove the old.
        </FooterNote>
      </div>
    </AppScreen>
  );
}

/* ── Recovery Phrase (view-recovery.tsx) ──────────────────────────── */

function Export({ onBack }: { onBack: () => void }) {
  const { session } = useShell();
  const [backup, setBackup] = useState<WalletBackup | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const vault = useVault();

  useEffect(() => {
    getWalletBackup().then(setBackup, setError);
  }, []);
  // The words leave the screen with the wallet: a lock hides them too.
  useEffect(() => {
    if (vault.status === "locked") setWords(null);
  }, [vault.status]);

  const reveal = async () => {
    if (!backup) return;
    setBusy(true);
    setError(null);
    let prf: Uint8Array | null = null;
    try {
      // A fresh ceremony: being unlocked is not enough to see the words.
      const a = await evaluatePrf(backup.wrappings.map((w) => w.credential_id));
      prf = a.prf;
      const m = await openMnemonic({ uid: session.user.id, backup, credentialId: a.credentialId, prf });
      setWords(m.split(" "));
    } catch (e) {
      setError(e);
    } finally {
      wipe(prf);
      setBusy(false);
    }
  };

  return (
    <AppScreen
      title="Recovery Phrase"
      onBack={() => {
        setWords(null);
        onBack();
      }}
    >
      <div className="flex flex-col pt-4">
        {words ? (
          <>
            <WarningNote>Never share your recovery phrase with anyone. Anyone with access to these words can control your wallet.</WarningNote>
            <ol className="my-6 grid grid-cols-2 gap-3">
              {words.map((w, i) => (
                <li key={i} className="flex items-center rounded-[12px] border border-white/[0.08] bg-[rgba(3,12,16,0.35)] p-3.5">
                  <span className="mr-2.5 min-w-6 text-[12px] font-strong tabular-nums text-[#9FB7C2]">{i + 1}</span>
                  <span className="flex-1 text-[15px] font-strong text-white">{w}</span>
                </li>
              ))}
            </ol>
            <SecondaryButton icon="checkmark" onClick={() => setWords(null)}>
              I wrote them down, hide them
            </SecondaryButton>
            <FooterNote icon="lock-closed-outline">Write them on paper, in order. They are never copied to your clipboard.</FooterNote>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <HeroCard icon="key-outline" title="Recovery phrase">
              <HeroBody>Your 12 words open this wallet anywhere. Show them only where nobody can see your screen.</HeroBody>
            </HeroCard>
            {error ? <Problem>{explain(error)}</Problem> : null}
            <PrimaryButton icon="finger-print" disabled={busy || !backup} onClick={() => void reveal()}>
              Confirm with passkey
            </PrimaryButton>
          </div>
        )}
      </div>
    </AppScreen>
  );
}

/* ── Add a passkey ────────────────────────────────────────────────── */

type AddStep = "current" | "create" | "confirm" | "done";

function AddPasskey({ onBack, onAdded }: { onBack: () => void; onAdded: () => void }) {
  const [step, setStep] = useState<AddStep>("current");
  const [backup, setBackup] = useState<WalletBackup | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  // The userSecret, only between the two ceremonies of this flow.
  const secret = useRef<Uint8Array | null>(null);
  const reg = useRegistrationOptions(step === "create");

  useEffect(() => {
    getWalletBackup().then(setBackup, setError);
    return () => {
      wipe(secret.current);
      secret.current = null;
    };
  }, []);

  const finish = async (credentialId: string, prf: Uint8Array) => {
    if (!secret.current) throw new WalletFlowError("self_check_failed");
    const wrapped = await wrapForPasskey(secret.current, prf);
    await addWrapping({ credential_id: normalizeCredentialId(credentialId), wrapped, label: "Added on the web" });
    wipe(secret.current);
    secret.current = null;
    setStep("done");
    onAdded();
  };

  const current = async () => {
    if (!backup) return;
    setBusy(true);
    setError(null);
    let prf: Uint8Array | null = null;
    try {
      const a = await evaluatePrf(backup.wrappings.map((w) => w.credential_id));
      prf = a.prf;
      secret.current = await userSecretFrom(backup, a.credentialId, prf);
      setStep("create");
    } catch (e) {
      setError(e);
    } finally {
      wipe(prf);
      setBusy(false);
    }
  };

  const create = async () => {
    if (!reg.options) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createPasskeyWithPrf(reg.options);
      await completePasskeyRegistration(made.registration);
      setNewId(made.credentialId);
      if (made.prf) {
        const prf = made.prf;
        try {
          await finish(made.credentialId, prf);
        } finally {
          wipe(prf);
        }
      } else setStep("confirm");
    } catch (e) {
      setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!newId) return;
    setBusy(true);
    setError(null);
    let prf: Uint8Array | null = null;
    try {
      const a = await evaluatePrf([newId]);
      prf = a.prf;
      await finish(a.credentialId, prf);
    } catch (e) {
      setError(e);
    } finally {
      wipe(prf);
      setBusy(false);
    }
  };

  const steps: { key: AddStep; label: string }[] = [
    { key: "current", label: "Confirm with a passkey that opens your wallet" },
    { key: "create", label: "Create the new passkey" },
    { key: "confirm", label: "Confirm the new passkey" },
  ];
  const at = steps.findIndex((x) => x.key === step);

  return (
    <AppScreen title="Add passkey" onBack={onBack}>
      <div className="flex flex-col gap-4 pt-3">
        {step === "done" ? (
          <div className="flex items-center gap-3 rounded-[16px] border border-[rgba(52,199,89,0.28)] bg-[rgba(52,199,89,0.06)] p-3.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(52,199,89,0.12)]">
              <Ion name="shield-checkmark" size={20} color={GREEN} />
            </span>
            <span className="text-[15px] font-strong text-white">That passkey now opens your wallet too.</span>
          </div>
        ) : (
          <>
            <HeroCard icon="finger-print" title="Add a passkey">
              <HeroBody>One in another password manager too means losing one of them does not lock you out.</HeroBody>
            </HeroCard>
            <Card className="overflow-hidden">
              {steps.map((x, i) => (
                <div key={x.key} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-white/[0.08]" : ""}`}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] text-[12px] font-strong ${
                      i < at ? "bg-[#3ED598] text-[#0A1A24]" : i === at ? "bg-[rgba(255,183,3,0.16)] text-[#FFB703]" : "bg-white/[0.08] text-white/60"
                    }`}
                  >
                    {i < at ? <Ion name="checkmark" size={15} color="#0A1A24" /> : i + 1}
                  </span>
                  <span className={`text-[14px] ${i === at ? "font-strong text-white" : "text-white/60"}`}>{x.label}</span>
                </div>
              ))}
            </Card>
            {error ? <Problem>{explain(error)}</Problem> : null}
            {reg.error && step === "create" ? <Problem>{explain(reg.error)}</Problem> : null}
            {step === "current" ? (
              <PrimaryButton icon="finger-print" disabled={busy || !backup} onClick={() => void current()}>
                Confirm with passkey
              </PrimaryButton>
            ) : step === "create" ? (
              <PrimaryButton icon="add" disabled={busy || !reg.options} onClick={() => void create()}>
                Create new passkey
              </PrimaryButton>
            ) : (
              <PrimaryButton icon="finger-print" disabled={busy} onClick={() => void confirm()}>
                Confirm new passkey
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </AppScreen>
  );
}
