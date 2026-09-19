"use client";

/**
 * Onboarding on the web: one step per card, progress on top, Back that works.
 *
 *   Username        the app's claim and rules (PATCH /me aliasHandle)
 *   Name and photo  optional, "Skip"
 *   Passkey         /passkeys/register/* with the session
 *   Recovery codes  emailed, only when the account has none
 *   Wallet          the Solana web wallet, when the rollout gate lets it be made;
 *                   "your wallet is in the HOLD app" when the app made one
 *   Link your phone required, no skip, while no phone is linked (link/LinkPhone)
 *
 * What to ask is decided from the server once, when the page opens
 * (lib/app/onboarding), so closing the tab half-way means coming back to the
 * first step still missing. Then the person lands where they were going
 * (`?next=`, same-origin only) or on the Dashboard.
 */

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import { demoParam } from "@/lib/creator/demo";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import { clientProductBase, safeNext } from "@/lib/app/paths";
import {
  checkUsername,
  cleanUsername,
  emailRecoveryCodes,
  updateMe,
  uploadAvatar,
  type UsernameVerdict,
} from "@/lib/app/me";
import { markOnboarded, readChoices, readFacts, saveChoice, stepsFor, type Facts, type StepKey } from "@/lib/app/onboarding";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  listPasskeys,
  type RegistrationOptionsJSON,
} from "@/lib/wallet/api";
import { wipe } from "@/lib/wallet/core";
import { explain, LOSS_WARNING } from "@/lib/wallet/explain";
import { registerWalletAddress, sealNewWallet } from "@/lib/wallet/flows";
import { createPasskeyWithPrf, evaluatePrf, PasskeyError } from "@/lib/wallet/passkey";
import { lock, unlockWith } from "@/lib/wallet/vault";

import { LinkPhone } from "../link/LinkPhone";
import { Door } from "./Door";
import { Avatar, btnGhost, btnLink, btnPrimary, DoorCard, HoldMark, inputCls, Note, Warn } from "./kit";

/* ── The page ─────────────────────────────────────────────────────── */

export function Welcome() {
  const { session, configured } = useCreatorSession();
  if (session === null) return <Door configured={configured} />;
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-8">
      {session === undefined ? <HoldMark /> : <Flow key={session.user.id} session={session} />}
    </div>
  );
}

const TITLES: Record<StepKey, string> = {
  username: "Choose your username",
  profile: "Your name and photo",
  passkey: "Create your passkey",
  recovery: "Your recovery codes",
  wallet: "Create your wallet",
  "app-wallet": "Your wallet",
  link: "Link your phone",
};

/** Where to go once done: back where they were going, or the Dashboard. */
function destination(): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  return safeNext(raw, window.location.origin) ?? dashboard();
}

function dashboard(): string {
  return clientProductBase() || "/";
}

function Flow({ session }: { session: Session }) {
  const uid = session.user.id;
  const [facts, setFacts] = useState<Facts | null>(null);
  const [steps, setSteps] = useState<StepKey[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [at, setAt] = useState(0);
  // What this visit finished, so Back to a done step shows it done.
  const [done, setDone] = useState<Set<StepKey>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const f = await readFacts();
      // DEMO BRANCH: ?step=<key> opens onboarding on that step, every step listed.
      const demoStep = demoParam("step") as StepKey | null;
      const all: StepKey[] = ["username", "profile", "passkey", "recovery", f.wallet?.state === "app_wallet" ? "app-wallet" : "wallet", "link"];
      const s = demoStep && all.includes(demoStep) ? all : stepsFor(f, readChoices(uid));
      setFacts(f);
      setSteps(s);
      if (demoStep && all.includes(demoStep)) setAt(all.indexOf(demoStep));
      if (s.length === 0) {
        markOnboarded(uid);
        window.location.replace(destination());
      }
    } catch (e) {
      setError(e);
    }
  }, [uid]);

  useEffect(() => void load(), [load]);
  // Nothing made here stays open once the person moves on.
  useEffect(() => () => lock(), []);

  const finish = useCallback(() => {
    lock();
    markOnboarded(uid);
    window.location.replace(destination());
  }, [uid]);

  const complete = useCallback(
    (key: StepKey) => {
      setDone((d) => new Set(d).add(key));
      if (!steps) return;
      if (at + 1 >= steps.length) finish();
      else setAt(at + 1);
    },
    [steps, at, finish],
  );

  if (error) {
    return (
      <DoorCard>
        <HoldMark />
        <div className="mt-8 flex flex-col gap-4">
          <Warn>{describeCreatorError(error)}</Warn>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => void load()}>
              Try again
            </button>
            <button type="button" className={btnGhost} onClick={() => window.location.replace(dashboard())}>
              Skip for now
            </button>
          </div>
        </div>
      </DoorCard>
    );
  }
  if (!facts || !steps || steps.length === 0) return <HoldMark />;

  const key = steps[at];
  const back = at > 0 ? () => setAt(at - 1) : undefined;
  const props = { facts, session, done: done.has(key), onDone: () => complete(key) };

  return (
    <DoorCard wide>
      <div className="flex items-center justify-between gap-3">
        <HoldMark className="h-4 w-auto" />
        <button type="button" className="text-tiny text-[#9FB7C2] hover:text-text" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <Progress steps={steps} at={at} />

      <div className="mt-6 flex min-h-[300px] flex-col">
        <div className="flex items-center gap-1">
          {back ? (
            <button type="button" onClick={back} className="-ml-2 h-8 shrink-0 rounded-[8px] px-2 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text">
              ← Back
            </button>
          ) : null}
          <h1 className="text-h4 font-light text-text">{TITLES[key]}</h1>
        </div>
        <div className="mt-4 flex flex-1 flex-col">
          {key === "username" ? <UsernameStep {...props} /> : null}
          {key === "profile" ? <ProfileStep {...props} onSkip={() => { saveChoice(session.user.id, "profile"); complete(key); }} /> : null}
          {key === "passkey" ? <PasskeyStep {...props} /> : null}
          {key === "recovery" ? <RecoveryStep {...props} /> : null}
          {key === "wallet" ? <WalletStep {...props} onSkip={() => { saveChoice(session.user.id, "wallet"); complete(key); }} /> : null}
          {key === "app-wallet" ? <AppWalletStep onDone={() => { saveChoice(session.user.id, "appWallet"); complete(key); }} /> : null}
          {key === "link" ? <LinkPhone onDone={() => { facts.linkedPhones = 1; complete(key); }} /> : null}
        </div>
      </div>
    </DoorCard>
  );
}

function Progress({ steps, at }: { steps: StepKey[]; at: number }) {
  return (
    <div className="mt-6">
      <p className="text-tiny text-[#9FB7C2]">
        Step {at + 1} of {steps.length}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-[2px] transition-colors ${i <= at ? "bg-amber" : "bg-white/10"}`} />
        ))}
      </div>
    </div>
  );
}

interface StepProps {
  facts: Facts;
  session: Session;
  done: boolean;
  onDone: () => void;
}

/** The step's actions, always at the bottom of the card. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">{children}</div>;
}

/* ── Username ─────────────────────────────────────────────────────── */

const VERDICT_TEXT: Record<UsernameVerdict | "checking" | "error", string> = {
  checking: "Checking…",
  available: "Available",
  own: "This is yours",
  taken: "Taken. Try another.",
  reserved: "That one is reserved. Try another.",
  invalid: "3 or more letters, numbers, _ . or -",
  error: "We could not check that right now. Try again.",
};

function UsernameStep({ facts, onDone }: StepProps) {
  const [value, setValue] = useState(facts.username ?? "");
  const [verdict, setVerdict] = useState<UsernameVerdict | "checking" | "error" | null>(facts.username ? "own" : null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef("");

  const onChange = (raw: string) => {
    const v = cleanUsername(raw).toLowerCase();
    setValue(v);
    setNotice(null);
    if (timer.current) clearTimeout(timer.current);
    if (!v) return setVerdict(null);
    setVerdict("checking");
    asked.current = v;
    timer.current = setTimeout(() => {
      checkUsername(v).then(
        (r) => asked.current === v && setVerdict(r),
        () => asked.current === v && setVerdict("error"),
      );
    }, 450);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const save = async () => {
    if (verdict === "own" && value === facts.username) return onDone();
    setBusy(true);
    setNotice(null);
    try {
      await updateMe({ aliasHandle: value });
      facts.username = value;
      onDone();
    } catch (e) {
      if (e instanceof CreatorApiError && e.code === "CONFLICT") setVerdict("taken");
      else if (e instanceof CreatorApiError && e.code === "RATE_LIMIT_EXCEEDED") setNotice(e.serverMessage ?? "You changed your username recently. Try again later.");
      else setNotice(describeCreatorError(e));
    } finally {
      setBusy(false);
    }
  };

  const ok = verdict === "available" || verdict === "own";
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) void save();
      }}
    >
      <Note>How people find you and pay you on HOLD. The same in the app.</Note>
      <div className="mt-4 flex items-center rounded-[12px] border border-white/10 bg-white/[0.05] pl-4 focus-within:border-amber/60">
        <span className="text-small text-[#9FB7C2]">@</span>
        <input
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={50}
          aria-label="Username"
          placeholder="username"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          className="h-11 min-w-0 flex-1 bg-transparent pl-1 pr-4 text-small text-text outline-none placeholder:text-[#6B8A99]"
        />
      </div>
      <p className={`mt-2 h-5 text-tiny ${ok ? "text-success" : verdict === "checking" || verdict === null ? "text-[#9FB7C2]" : "text-amber"}`}>
        {verdict ? VERDICT_TEXT[verdict] : "3 or more letters, numbers, _ . or -"}
      </p>
      {notice ? <Warn>{notice}</Warn> : null}
      <Actions>
        <button type="submit" className={btnPrimary} disabled={!ok || busy}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </Actions>
    </form>
  );
}

/* ── Name and photo (optional) ────────────────────────────────────── */

function ProfileStep({ facts, session, onDone, onSkip }: StepProps & { onSkip: () => void }) {
  const [name, setName] = useState(facts.me.profile.displayName ?? "");
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      if (file) await uploadAvatar(file, facts.me.supabaseUid ?? session.user.id, facts.me.profile.avatarUrl);
      const n = name.trim();
      if (n && n !== facts.me.profile.displayName) await updateMe({ displayName: n });
      onDone();
    } catch (e) {
      setNotice(e instanceof CreatorApiError ? describeCreatorError(e) : "That photo could not be used. Try another, or skip it for now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Note>Optional. Shown to people you pay and sell to.</Note>
      <div className="mt-5 flex items-center gap-4">
        <Avatar src={preview} name={name || facts.username || "?"} size={72} />
        <div className="flex flex-col items-start gap-1">
          <button type="button" className={btnGhost} disabled={busy} onClick={() => input.current?.click()}>
            {file ? "Choose another photo" : "Add a photo"}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <label className="mt-5 block text-tiny text-[#9FB7C2]" htmlFor="onb-name">
        Display name
      </label>
      <input id="onb-name" className={`${inputCls} mt-1.5`} maxLength={60} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      {notice ? <div className="mt-3"><Warn>{notice}</Warn></div> : null}
      <Actions>
        <button type="button" className={btnPrimary} disabled={busy || (!file && !name.trim())} onClick={() => void save()}>
          {busy ? "Saving…" : "Continue"}
        </button>
        <button type="button" className={btnLink} disabled={busy} onClick={onSkip}>
          Skip
        </button>
      </Actions>
    </div>
  );
}

/* ── Passkey ──────────────────────────────────────────────────────── */

/** Registration options, fetched ahead of the click (Safari wants the ceremony inside it) and kept fresh. */
function useRegistrationOptions(session: Session, active: boolean) {
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
    const t = setInterval(() => void refresh(), 4 * 60 * 1000);
    return () => clearInterval(t);
  }, [active, refresh]);
  return { options, error, refresh };
}

function PasskeyStep({ facts, session, done, onDone }: StepProps) {
  const [made, setMade] = useState(done || facts.hasPasskey);
  const reg = useRegistrationOptions(session, !made);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const create = async () => {
    if (!reg.options) return;
    setBusy(true);
    setError(null);
    try {
      const p = await createPasskeyWithPrf(reg.options, { requirePrf: false });
      wipe(p.prf);
      await completePasskeyRegistration(p.registration);
      facts.hasPasskey = true;
      facts.passkeyIds = [...facts.passkeyIds, p.credentialId];
      setMade(true);
      onDone();
    } catch (e) {
      // This device already holds one of the account's passkeys: that is the passkey.
      if (e instanceof PasskeyError && e.code === "exists") {
        setMade(true);
        onDone();
        return;
      }
      setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Note>
        Face ID, Touch ID or your device PIN, instead of a password. It signs you in to HOLD and it is what locks your
        wallet. Kept by your password manager (iCloud Keychain or Google Password Manager), so it follows you to your
        other devices.
      </Note>
      {made ? <p className="mt-4 text-small text-success">Your passkey is set.</p> : null}
      {error ? <div className="mt-4"><Warn>{explain(error)}</Warn></div> : null}
      {reg.error && !made ? <div className="mt-4"><Warn>{explain(reg.error)}</Warn></div> : null}
      <Actions>
        {made ? (
          <button type="button" className={btnPrimary} onClick={onDone}>
            Continue
          </button>
        ) : (
          <button type="button" className={btnPrimary} disabled={busy || !reg.options} onClick={() => void create()}>
            {busy ? "Waiting for your passkey…" : "Create passkey"}
          </button>
        )}
      </Actions>
    </div>
  );
}

/* ── Recovery codes ───────────────────────────────────────────────── */

function RecoveryStep({ facts, session, done, onDone }: StepProps) {
  const email = session.user.email ?? facts.me.email ?? "";
  const [sent, setSent] = useState(done || facts.hasCodes);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await emailRecoveryCodes(email);
      facts.hasCodes = true;
      setSent(true);
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Note>
        Eight single-use codes, sent to your email. They get you back into your HOLD account if you ever lose your
        sign-in (your Apple or Google account, or this email). Keep them somewhere safe and offline.
      </Note>
      <div className="mt-4 rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3">
        <p className="text-tiny text-[#9FB7C2]">Sent to</p>
        <p className="mt-0.5 break-all text-small text-text">{email || "Your account's email"}</p>
      </div>
      {sent ? <p className="mt-4 text-small text-success">Sent. Check your inbox, then save them.</p> : null}
      {notice ? <div className="mt-4"><Warn>{notice}</Warn></div> : null}
      <Actions>
        {sent ? (
          <button type="button" className={btnPrimary} onClick={onDone}>
            Continue
          </button>
        ) : (
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void send()}>
            {busy ? "Sending…" : "Email my recovery codes"}
          </button>
        )}
      </Actions>
    </div>
  );
}

/* ── Wallet ───────────────────────────────────────────────────────── */

type WalletPhase = { kind: "intro" } | { kind: "confirm"; credentialId: string } | { kind: "sealing" } | { kind: "ready"; address: string };

function WalletStep({ facts, session, onDone, onSkip }: StepProps & { onSkip: () => void }) {
  const [phase, setPhase] = useState<WalletPhase>({ kind: "intro" });
  const [ids, setIds] = useState<string[]>(facts.passkeyIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const reg = useRegistrationOptions(session, phase.kind === "intro");

  useEffect(() => {
    listPasskeys().then(
      (p) => setIds(p.map((x) => x.id)),
      () => undefined,
    );
  }, []);

  const seal = async (credentialId: string, prf: Uint8Array, label: string | null) => {
    setPhase({ kind: "sealing" });
    try {
      const key = await sealNewWallet({ uid: session.user.id, credentialId, prf, label });
      const address = key.address;
      unlockWith(key);
      // So the backend watches it for deposits, as the Wallet page does after an unlock.
      await registerWalletAddress(address, null).catch(() => undefined);
      lock();
      setPhase({ kind: "ready", address });
    } catch (e) {
      setError(e);
      setPhase({ kind: "intro" });
    } finally {
      wipe(prf);
    }
  };

  const withExisting = async (only?: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const a = await evaluatePrf(only ?? ids);
      await seal(a.credentialId, a.prf, only ? "This browser" : null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const withNew = async () => {
    if (!reg.options) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createPasskeyWithPrf(reg.options);
      await completePasskeyRegistration(made.registration);
      if (made.prf) await seal(made.credentialId, made.prf, "This browser");
      else setPhase({ kind: "confirm", credentialId: made.credentialId });
    } catch (e) {
      setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === "ready") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Your Solana wallet is ready. Sponsors pay you here, and you can receive USDC on Solana to this address.</Note>
        <p className="mt-4 break-all rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-small text-text">{phase.address}</p>
        <Note>
          <span className="mt-3 block">Export your 12 words from Wallet, Settings, and keep them on paper.</span>
        </Note>
        <Actions>
          <button type="button" className={btnPrimary} onClick={onDone}>
            Continue
          </button>
        </Actions>
      </div>
    );
  }

  if (phase.kind === "sealing") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Making your wallet in this browser, checking it opens with your passkey, then saving the encrypted backup.</Note>
        <div className="mt-4 h-11 animate-pulse rounded-[12px] bg-white/[0.06]" />
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Your new passkey was created. Confirm it once more so it can lock your wallet.</Note>
        {error ? <div className="mt-4"><Warn>{explain(error)}</Warn></div> : null}
        <Actions>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void withExisting([phase.credentialId])}>
            Confirm with passkey
          </button>
        </Actions>
      </div>
    );
  }

  const noPrf = error instanceof PasskeyError && error.code === "no_prf";
  return (
    <div className="flex flex-1 flex-col">
      <Note>
        A Solana wallet for USDC, made in this browser and locked by your passkey. HOLD keeps only an encrypted backup
        it cannot open. Sponsors pay your listings into it.
      </Note>
      <p className="mt-4 rounded-[12px] border border-amber/30 bg-amber/10 px-4 py-3 text-tiny leading-relaxed text-text">{LOSS_WARNING}</p>
      {error ? <div className="mt-3"><Warn>{explain(error)}</Warn></div> : null}
      <Actions>
        {ids.length > 0 && !noPrf ? (
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void withExisting()}>
            {busy ? "Waiting for your passkey…" : "Create my wallet"}
          </button>
        ) : null}
        <button
          type="button"
          className={ids.length > 0 && !noPrf ? btnGhost : btnPrimary}
          disabled={busy || !reg.options}
          onClick={() => void withNew()}
        >
          {ids.length > 0 ? "Use a new passkey" : "Create my wallet"}
        </button>
        <button type="button" className={btnLink} disabled={busy} onClick={onSkip}>
          Not now
        </button>
      </Actions>
    </div>
  );
}

function AppWalletStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <Note>
        Your account already has a wallet, made in the HOLD app. To keep one wallet per person, the web never makes a
        second one. Sponsors pay you there.
      </Note>
      <Note>
        <span className="mt-3 block">Open the HOLD app to turn it on here too.</span>
      </Note>
      <Actions>
        <button type="button" className={btnPrimary} onClick={onDone}>
          Continue
        </button>
      </Actions>
    </div>
  );
}

