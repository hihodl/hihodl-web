"use client";

/**
 * The web wallet (phase 1: Solana, read-only), protected by a passkey.
 *
 * One screen at a time, each a card that opens its own screen with a Back:
 *
 *   no wallet anywhere        → Create (passkey with PRF, then the wallet)
 *   a wallet in the HOLD app  → "Open the HOLD app" (we never make a second one)
 *   a web wallet, locked      → Unlock with passkey
 *   unlocked                  → Home: Balance · Withdraw · Receive · Settings
 *   Withdraw                  → approved on the linked phone (Withdraw.tsx)
 *   Settings                  → Add another passkey · Export 12 words
 *
 * Design and threat model: documentation/web-wallet-passkey-phase-1.md.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { QrCode } from "@/components/ad-space/qr";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { useShell } from "@/components/app/Shell";
import { Alert, glass, Skeleton } from "@/components/app/ui";
import {
  addWrapping,
  beginPasskeyRegistration,
  completePasskeyRegistration,
  getBalances,
  getWalletBackup,
  getWalletStatus,
  listPasskeys,
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
import { createPasskeyWithPrf, evaluatePrf, normalizeCredentialId, PasskeyError, passkeysHere } from "@/lib/wallet/passkey";
import { demoParam } from "@/lib/creator/demo";
import { lock, unlockWith, useVault } from "@/lib/wallet/vault";

import { Withdraw } from "./Withdraw";

/* ── Small parts ──────────────────────────────────────────────────── */

const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-amber px-4 text-small font-medium text-text-on-amber transition-colors hover:bg-amber-glow disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.05] px-4 text-small font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

function Card({ title, children, onBack, action }: { title: string; children: ReactNode; onBack?: () => void; action?: ReactNode }) {
  return (
    <section className={`${glass} mx-auto flex w-full max-w-[640px] flex-col gap-4 p-5 sm:p-6`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button type="button" onClick={onBack} className="h-8 rounded-[8px] px-2 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text">
              ← Back
            </button>
          ) : null}
          <h2 className="truncate text-body font-medium text-text">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, onClick }: { label: string; value: ReactNode; sub?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${glass} flex min-w-0 flex-col items-start gap-2 px-5 py-4 text-left transition-colors hover:bg-white/[0.06]`}>
      <span className="text-tiny text-[#9FB7C2]">{label}</span>
      <span className="text-[22px] font-medium leading-none tabular-nums text-text">{value}</span>
      {sub ? <span className="truncate text-tiny text-[#7F97A3]">{sub}</span> : null}
    </button>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-small leading-relaxed text-[#9FB7C2]">{children}</p>;
}

function short(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
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

export function WalletScreen() {
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

  // The rollout gate: not enabled means no wallet here at all, not an error.
  if (status && status.enabled === false) return null;

  let body: ReactNode;
  if (loadError) {
    body = (
      <Card title="Wallet">
        <Alert>{explain(loadError)}</Alert>
        <div>
          <button type="button" className={btnGhost} onClick={() => void load()}>
            Try again
          </button>
        </div>
      </Card>
    );
  } else if (!status) {
    body = <Skeleton className="mx-auto h-[240px] w-full max-w-[640px]" />;
  } else if (status.state === "app_wallet") {
    body = <AppWallet />;
  } else if (status.state === "web_wallet" && !status.current_blob_hash) {
    body = <WalletOnAnotherAccount />;
  } else if (!passkeysHere()) {
    body = (
      <Card title="Wallet">
        <Alert>{explain(new PasskeyError("unavailable"))}</Alert>
      </Card>
    );
  } else if (status.state === "none") {
    body = <Create status={status} onCreated={() => void load()} />;
  } else if (vault.status === "unlocked" && vault.address) {
    body = <Home address={vault.address} status={status} onChanged={() => void load()} />;
  } else {
    body = <Unlock />;
  }

  return <div className="flex min-h-0 flex-1 flex-col justify-center py-2">{body}</div>;
}

/* ── A web wallet kept under an older account with this email ────── */

function WalletOnAnotherAccount() {
  return (
    <Card title="Your wallet is on your previous account">
      <Note>
        This email already has a web wallet, created while you were signed in to an earlier HOLD account. To keep one
        wallet per person, the web never makes a second one. Write to support from this email and we will move you back
        to the account that holds it.
      </Note>
    </Card>
  );
}

/* ── An app user ──────────────────────────────────────────────────── */

function AppWallet() {
  const w = useHoldWallet();
  if (w.loading) return <Skeleton className="mx-auto h-[240px] w-full max-w-[640px]" />;
  return (
    <div className="flex flex-col gap-4">
      {w.solana ? <Receive address={w.solana} /> : null}
      <Card title="Your wallet is in the HOLD app">
        <Note>
          This account&apos;s wallet was made in the HOLD app, and this is its Solana address: sponsors and deposits reach it
          here. The web never makes a second wallet and never holds this one&apos;s keys.
        </Note>
        <Note>Send, swap and withdraw in the HOLD app.</Note>
      </Card>
    </div>
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
      <Card title="Your wallet is ready">
        <Note>This is your Solana address. Send USDC or SOL on Solana to it.</Note>
        <p className="break-all rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-small text-text">{step.address}</p>
        <Note>Export your 12 words from Settings and keep them on paper: they are the only way back if every passkey is lost.</Note>
        <div>
          <button type="button" className={btnPrimary} onClick={onCreated}>
            Open wallet
          </button>
        </div>
      </Card>
    );
  }

  if (step.kind === "sealing") {
    return (
      <Card title="Creating your wallet">
        <Note>Generating your wallet in this browser, checking it opens with your passkey, then saving the encrypted backup.</Note>
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  if (step.kind === "confirm") {
    return (
      <Card title="Confirm your new passkey">
        <Note>Your passkey was created. Confirm it once more so it can seal your wallet.</Note>
        {error ? <Alert>{explain(error)}</Alert> : null}
        <div>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void confirm([step.credentialId], "This browser")}>
            Confirm with passkey
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Create your wallet">
      <Note>
        A Solana wallet for USDC and SOL, created in this browser and locked by a passkey (Face ID, Touch ID or your device
        PIN). HOLD stores only an encrypted backup it cannot open.
      </Note>
      <p className="rounded-[12px] border border-amber/30 bg-amber/10 px-4 py-3 text-small text-text">{LOSS_WARNING}</p>
      {!status.email_verified ? <Alert>{explain(new WalletApiError("EMAIL_NOT_VERIFIED", 403))}</Alert> : null}
      {error ? <Alert>{explain(error)}</Alert> : null}
      {reg.error ? <Alert>{explain(reg.error)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy || !reg.options || !status.email_verified} onClick={() => void createNew()}>
          Create with a new passkey
        </button>
        {existing.length > 0 ? (
          <button type="button" className={btnGhost} disabled={busy || !status.email_verified} onClick={() => void confirm(existing, null)}>
            Use a passkey I already have
          </button>
        ) : null}
      </div>
    </Card>
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

  // DEMO BRANCH: ?unlock=1 (or a ?screen= inside the wallet) opens it with the demo passkey at once.
  const autoUnlock = demoParam("unlock") === "1" || !!demoParam("screen");
  useEffect(() => {
    if (autoUnlock && backup) void unlock();
    // Once, when the backup arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUnlock, backup]);

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

  return (
    <Card title="Wallet locked">
      <Note>Unlock with your passkey. The wallet opens in this tab only and locks itself after a few minutes away.</Note>
      {error ? <Alert>{explain(error)}</Alert> : null}
      <div>
        <button type="button" className={btnPrimary} disabled={busy || !backup} onClick={() => void unlock()}>
          Unlock with passkey
        </button>
      </div>
    </Card>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */

type HomeScreen = "home" | "withdraw" | "receive" | "settings" | "export" | "add";

function Home({ address, status, onChanged }: { address: string; status: WalletStatus; onChanged: () => void }) {
  const { session } = useShell();
  // DEMO BRANCH: ?screen= opens the wallet on one of its screens.
  const [screen, setScreen] = useState<HomeScreen>(() => {
    const want = demoParam("screen");
    return want === "withdraw" || want === "receive" || want === "settings" || want === "export" || want === "add" ? want : "home";
  });
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balanceError, setBalanceError] = useState(false);

  useEffect(() => {
    getBalances(address).then(
      (b) => setBalances(b),
      () => setBalanceError(true),
    );
  }, [address]);

  const back = () => setScreen("home");
  const toSettings = () => setScreen("settings");

  if (screen === "receive") return <Receive address={address} onBack={back} />;
  if (screen === "withdraw") return <Withdraw uid={session.user.id} from={address} balances={balances} onBack={back} />;
  if (screen === "settings")
    return <Settings wrappings={status.wrappings} onBack={back} onExport={() => setScreen("export")} onAdd={() => setScreen("add")} onChanged={onChanged} />;
  if (screen === "export") return <Export onBack={toSettings} />;
  if (screen === "add") return <AddPasskey onBack={toSettings} onAdded={onChanged} />;

  const fmt = (n: number, d: number) => n.toLocaleString("en-US", { maximumFractionDigits: d });
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="truncate text-small text-[#9FB7C2]">
          Solana · <span className="font-mono text-text">{short(address)}</span>
        </p>
        <button type="button" className={btnGhost} onClick={lock}>
          Lock
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile
          label="USDC"
          value={balances ? fmt(balances.usdc, 2) : balanceError ? "—" : "…"}
          sub={balanceError ? "Balance unavailable right now" : "On Solana"}
          onClick={() => setScreen("receive")}
        />
        <Tile label="SOL" value={balances ? fmt(balances.sol, 4) : balanceError ? "—" : "…"} sub="For network fees" onClick={() => setScreen("receive")} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Withdraw" value="Send out" sub="Approved on your phone" onClick={() => setScreen("withdraw")} />
        <Tile label="Receive" value="Address & QR" sub="USDC or SOL on Solana only" onClick={() => setScreen("receive")} />
        <Tile label="Settings" value="Passkeys & words" sub={`${status.wrappings.length} passkey${status.wrappings.length === 1 ? "" : "s"} open this wallet`} onClick={toSettings} />
      </div>
    </div>
  );
}

function Receive({ address, onBack }: { address: string; onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Card title="Receive" onBack={onBack}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="w-[180px] shrink-0 overflow-hidden rounded-[12px]">
          <QrCode text={address} title="Your Solana address" className="h-auto w-full" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="break-all font-mono text-small text-text">{address}</p>
          <Note>Send only USDC or SOL, and only on the Solana network. Tokens sent on another network to this address are lost.</Note>
          <div>
            <button type="button" className={btnGhost} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Settings ─────────────────────────────────────────────────────── */

function Settings({
  wrappings,
  onBack,
  onExport,
  onAdd,
  onChanged,
}: {
  wrappings: WrappingMeta[];
  onBack: () => void;
  onExport: () => void;
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
    <Card title="Wallet settings" onBack={onBack}>
      <div className="flex flex-col gap-1">
        <p className="text-tiny text-[#9FB7C2]">Passkeys that open this wallet</p>
        {wrappings.map((w, i) => (
          <div key={w.credential_id} className="flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 hover:bg-white/[0.04]">
            <div className="min-w-0">
              <p className="truncate text-small text-text">{w.label ?? `Passkey ${i + 1}`}</p>
              <p className="text-tiny text-[#7F97A3]">Added {new Date(w.created_at).toLocaleDateString("en-GB")}</p>
            </div>
            {wrappings.length > 1 ? (
              confirming === w.credential_id ? (
                <div className="flex gap-1.5">
                  <button type="button" className={btnGhost} onClick={() => void remove(w.credential_id)}>
                    Remove
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <button type="button" className="h-8 rounded-[8px] px-2 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text" onClick={() => setConfirming(w.credential_id)}>
                  Remove
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>
      {error ? <Alert>{explain(error)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onAdd}>
          Add another passkey
        </button>
        <button type="button" className={btnGhost} onClick={onExport}>
          Export 12 words
        </button>
      </div>
      <p className="text-tiny leading-relaxed text-[#9FB7C2]">{LOSS_WARNING}</p>
    </Card>
  );
}

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
    <Card title="Export 12 words" onBack={() => { setWords(null); onBack(); }}>
      {words ? (
        <>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {words.map((w, i) => (
              <li key={i} className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2 text-small text-text">
                <span className="w-5 text-right text-tiny tabular-nums text-[#7F97A3]">{i + 1}</span>
                <span className="font-mono">{w}</span>
              </li>
            ))}
          </ol>
          <Note>
            Write them on paper, in order, and keep them offline. Anyone with these words controls the funds. They are not
            copied to your clipboard and are not shown again unless you confirm with a passkey.
          </Note>
          <div>
            <button type="button" className={btnPrimary} onClick={() => setWords(null)}>
              I wrote them down, hide them
            </button>
          </div>
        </>
      ) : (
        <>
          <Note>
            Your 12 words are the master key to this wallet. Show them only where nobody can see your screen. Confirm with
            your passkey to show them once.
          </Note>
          {error ? <Alert>{explain(error)}</Alert> : null}
          <div>
            <button type="button" className={btnPrimary} disabled={busy || !backup} onClick={() => void reveal()}>
              Confirm with passkey
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ── Add another passkey ──────────────────────────────────────────── */

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

  return (
    <Card title="Add another passkey" onBack={onBack}>
      {step === "done" ? (
        <Note>Done. That passkey now opens your wallet too.</Note>
      ) : (
        <>
          <Note>
            A second passkey in another password manager (for example Google Password Manager besides iCloud Keychain)
            means losing one of them does not lock you out.
          </Note>
          <ol className="flex flex-col gap-1 text-small">
            <li className={step === "current" ? "text-text" : "text-[#7F97A3]"}>1. Confirm with a passkey that opens your wallet</li>
            <li className={step === "create" ? "text-text" : "text-[#7F97A3]"}>2. Create the new passkey</li>
            <li className={step === "confirm" ? "text-text" : "text-[#7F97A3]"}>3. Confirm the new passkey</li>
          </ol>
          {error ? <Alert>{explain(error)}</Alert> : null}
          {reg.error && step === "create" ? <Alert>{explain(reg.error)}</Alert> : null}
          <div>
            {step === "current" ? (
              <button type="button" className={btnPrimary} disabled={busy || !backup} onClick={() => void current()}>
                Confirm with passkey
              </button>
            ) : step === "create" ? (
              <button type="button" className={btnPrimary} disabled={busy || !reg.options} onClick={() => void create()}>
                Create new passkey
              </button>
            ) : (
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => void confirm()}>
                Confirm new passkey
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
