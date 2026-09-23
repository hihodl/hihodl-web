"use client";

/**
 * Onboarding on the web, drawn as the HOLD app draws its own
 * (hihodl-wallet/app/onboarding/setup.tsx): the step's gradient, "Protect
 * your wallet" on top with a close that signs out, and at the foot the step
 * just done (tap to go back), the step now, the step after it, one glass
 * action. The pieces are in ./step; the map is
 * documentation/web-copies-the-app-onboarding.md.
 *
 *   Username        the app's claim and rules (PATCH /me aliasHandle)
 *   Profile         name and photo, optional, "Skip" (the app has no such step)
 *   Passkey         /passkeys/register/* with the session
 *   Recovery Key    the codes emailed, only when the account has none
 *   Wallet          by device (documentation/one-wallet-every-device.md):
 *                   an iPhone or a computer makes the Solana web wallet here
 *                   with a passkey, when the rollout gate lets it be made; an
 *                   Android phone leads with "Get HOLD on Google Play" (the app
 *                   makes it with every chain) and "Make it here instead".
 *                   "your wallet is in the HOLD app" when the app made one.
 *                   Made, it shows the app's Ready: "Your wallet is ready"
 *   Link your phone offered with "Later" while no phone is linked
 *                   (link/LinkPhone); Menu → Security links one any time
 *
 * What to ask is decided from the server once, when the page opens
 * (lib/app/onboarding), so closing the tab half-way means coming back to the
 * first step still missing. Then the person lands where they were going
 * (`?next=`, same-origin only) or on the Dashboard.
 */

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
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
import { markOnboarded, playFirst, readChoices, readFacts, saveChoice, stepsFor, walletToMake, type Facts, type StepKey } from "@/lib/app/onboarding";
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

import { playHref } from "../link/in-app";
import { LinkPhone } from "../link/LinkPhone";
import { Door } from "./Door";
import { HoldMark } from "./kit";
import {
  ACCENTS,
  ActionButton,
  CompletedRow,
  Cta,
  ErrorBanner,
  InfoSheet,
  InputRow,
  inputFieldCls,
  Ion,
  NextHint,
  ReadyBox,
  SkipButton,
  Spinner,
  StatusLine,
  StepDesc,
  StepScreen,
  StepTitle,
  type IonName,
  type StepTone,
} from "./step";

/* ── The page ─────────────────────────────────────────────────────── */

export function Welcome() {
  const { session, configured } = useCreatorSession();
  if (session === null) return <Door configured={configured} />;
  if (session === undefined) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <HoldMark />
      </div>
    );
  }
  return <Flow key={session.user.id} session={session} />;
}

/** Each step as the app names and colours it (setup.tsx ALL_STEPS, STEP_GRADIENTS, STEP_INFO). */
const STEP: Record<StepKey, { title: string; icon: IonName; tone: StepTone; info?: string }> = {
  username: {
    title: "Username",
    icon: "person-outline",
    tone: "username",
    info: "Your unique @handle for receiving payments and being found by friends on HOLD.",
  },
  profile: {
    title: "Profile",
    icon: "person-circle-outline",
    tone: "username",
    info: "Your name and photo, shown to the people you pay and sell to. Both are optional.",
  },
  passkey: {
    title: "Passkey",
    icon: "key-outline",
    tone: "passkey",
    info: "A secure key stored on your device. Uses Face ID or fingerprint to verify your identity — no passwords needed.",
  },
  recovery: {
    title: "Recovery Key",
    icon: "mail-outline",
    tone: "recovery",
    info: "We'll send 8 recovery codes to your email. These codes are the ONLY way to recover your account if you lose access to Google or Apple. Save them somewhere safe — each code works only once.",
  },
  wallet: {
    title: "Wallet",
    icon: "wallet-outline",
    tone: "ready",
    info: "A Solana wallet for USDC, made in this browser and locked by your passkey. HOLD keeps only an encrypted backup it cannot open.",
  },
  "app-wallet": { title: "Wallet", icon: "wallet-outline", tone: "ready" },
  link: {
    title: "Link your phone",
    icon: "phone-portrait-outline",
    tone: "passkey",
    info: "A linked Android phone approves and signs, in the HOLD app, the payments you start on the web. Without one, your passkey approves them. You can link one later from Menu, Security.",
  },
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
  const [info, setInfo] = useState<StepKey | null>(null);
  // The wallet step's Ready takes the whole foot, as the app's does.
  const [ready, setReady] = useState(false);
  const slow = useSlow(!facts && !error);

  const load = useCallback(async () => {
    setError(null);
    try {
      const f = await readFacts();
      const s = stepsFor(f, readChoices(uid));
      setFacts(f);
      setSteps(s);
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
      setReady(false);
      if (!steps) return;
      if (at + 1 >= steps.length) finish();
      else setAt(at + 1);
    },
    [steps, at, finish],
  );

  const close = () => void signOut();

  // setup.tsx's "Setup incomplete": what the app shows when it could not read the account.
  if (error) {
    return (
      <StepScreen tone="ready" title={"Protect\nyour wallet"} onClose={close} closeLabel="Sign out">
        <div className="flex flex-col items-center gap-3.5 py-5 text-center">
          <Ion name="warning-outline" size={32} className="text-[#F59E0B]" />
          <h2 className="text-[24px] font-extrabold leading-8 text-[#F59E0B]">Setup incomplete</h2>
          <p className="text-[15px] leading-[22px] text-white/60">Check your connection and try again.</p>
        </div>
        <Cta>
          <ActionButton title="Retry" onClick={() => void load()} />
          <SkipButton label="Skip for now" onClick={() => window.location.replace(dashboard())} />
        </Cta>
      </StepScreen>
    );
  }

  if (!facts || !steps || steps.length === 0) {
    return (
      <StepScreen tone="username" title={"Protect\nyour wallet"}>
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3.5">
          <Spinner />
          {slow ? <p className="px-8 text-center text-[13px] text-white/60">Connection seems slow. Hang on…</p> : null}
        </div>
      </StepScreen>
    );
  }

  const key = steps[at];
  const meta = STEP[key];
  const last = at + 1 >= steps.length;
  const back = at > 0 ? () => { setReady(false); setAt(at - 1); } : undefined;
  const next = !last ? STEP[steps[at + 1]] : null;

  const head = (
    <>
      {back ? <CompletedRow title={STEP[steps[at - 1]].title} onBack={back} /> : null}
      <StepTitle icon={meta.icon} title={meta.title} accent={ACCENTS[meta.tone]} onInfo={meta.info ? () => setInfo(key) : undefined} />
    </>
  );
  const hint = next ? <NextHint icon={next.icon} title={next.title} /> : null;
  const props = { facts, session, done: done.has(key), onDone: () => complete(key), head, hint };

  return (
    <StepScreen
      tone={ready ? "ready" : meta.tone}
      title={ready && last ? "All set!" : "Protect\nyour wallet"}
      onClose={ready && last ? undefined : close}
      closeLabel="Sign out"
    >
      {key === "username" ? <UsernameStep {...props} /> : null}
      {key === "profile" ? <ProfileStep {...props} onSkip={() => { saveChoice(session.user.id, "profile"); complete(key); }} /> : null}
      {key === "passkey" ? <PasskeyStep {...props} /> : null}
      {key === "recovery" ? <RecoveryStep {...props} /> : null}
      {key === "wallet" ? (
        <WalletStep {...props} last={last} onReady={setReady} onSkip={() => { saveChoice(session.user.id, "wallet"); complete(key); }} />
      ) : null}
      {key === "app-wallet" ? <AppWalletStep {...props} onDone={() => { saveChoice(session.user.id, "appWallet"); complete(key); }} /> : null}
      {key === "link" ? (
        <>
          {head}
          <LinkPhone onDone={() => { facts.linkedPhones = 1; complete(key); }} onLater={() => complete(key)} />
        </>
      ) : null}

      {info && STEP[info].info ? <InfoSheet title={STEP[info].title} body={STEP[info].info} onClose={() => setInfo(null)} /> : null}
    </StepScreen>
  );
}

/** setup.tsx: "Connection seems slow" after a second and a half of waiting. */
function useSlow(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(t);
  }, [waiting]);
  return waiting && slow;
}

interface StepProps {
  facts: Facts;
  session: Session;
  done: boolean;
  onDone: () => void;
  /** The step just done and this step's title row. */
  head: ReactNode;
  /** The step after this one, faint. */
  hint: ReactNode;
}

/* ── Username ─────────────────────────────────────────────────────── */

type UsernameStatus = UsernameVerdict | "checking" | "error";

/** The app's four states (setup.tsx); "own" is the web's, for a name already theirs. */
function statusLine(s: UsernameStatus | null) {
  if (s === null || s === "invalid") return null;
  if (s === "checking")
    return (
      <StatusLine tone="muted">
        <Spinner size={14} color="rgba(255,255,255,0.55)" />
        Checking...
      </StatusLine>
    );
  if (s === "available" || s === "own") return <StatusLine tone="ok">Available</StatusLine>;
  if (s === "error") return <StatusLine tone="warn">Connection error</StatusLine>;
  return <StatusLine tone="warn">Not available</StatusLine>;
}

function UsernameStep({ facts, onDone, head, hint }: StepProps) {
  const [value, setValue] = useState(facts.username ?? "");
  const [verdict, setVerdict] = useState<UsernameStatus | null>(facts.username ? "own" : null);
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
    asked.current = v;
    // The app waits 800 ms after the last key.
    timer.current = setTimeout(() => {
      setVerdict("checking");
      checkUsername(v).then(
        (r) => asked.current === v && setVerdict(r),
        () => asked.current === v && setVerdict("error"),
      );
    }, 800);
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
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) void save();
      }}
    >
      {head}
      {notice ? <ErrorBanner onDismiss={() => setNotice(null)}>{notice}</ErrorBanner> : null}
      <InputRow prefix={<span className="mr-0.5 text-[17px] font-semibold text-white/[0.55]">@</span>}>
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
          className={inputFieldCls}
        />
      </InputRow>
      {statusLine(verdict)}
      {hint}
      <Cta>
        <ActionButton type="submit" title={busy ? "Saving..." : "Continue"} disabled={!ok || busy} />
      </Cta>
    </form>
  );
}

/* ── Profile: name and photo (the web's; optional) ───────────────── */

function ProfileStep({ facts, session, onDone, onSkip, head, hint }: StepProps & { onSkip: () => void }) {
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

  const initial = (name || facts.username || "?").replace(/^@/, "").trim().charAt(0).toUpperCase() || "?";
  return (
    <div>
      {head}
      {notice ? <ErrorBanner onDismiss={() => setNotice(null)}>{notice}</ErrorBanner> : null}
      <div className="mb-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={file ? "Choose another photo" : "Add a photo"}
          className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[36px] border-2 border-[rgba(236,240,244,0.55)] bg-white/10 text-[30px] font-bold text-white"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </button>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded-[10px] px-1 py-2 text-[14px] font-semibold text-white/80 hover:text-white">
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
      <InputRow prefix={<Ion name="person-outline" size={18} className="mr-2 shrink-0" style={{ color: ACCENTS.username }} />}>
        <input
          aria-label="Your name"
          maxLength={60}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className={inputFieldCls}
        />
      </InputRow>
      {hint}
      <Cta>
        <ActionButton title={busy ? "Saving..." : "Continue"} disabled={busy || (!file && !name.trim())} onClick={() => void save()} />
        <SkipButton onClick={onSkip} disabled={busy} />
      </Cta>
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

/** A closed prompt is the person's call, not a failure: the app says nothing. */
const cancelled = (e: unknown) => e instanceof PasskeyError && e.code === "cancelled";

function PasskeyStep({ facts, session, done, onDone, head, hint }: StepProps) {
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
      if (!cancelled(e)) setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  const problem = error ?? (!made ? reg.error : null);
  return (
    <div>
      {head}
      {problem ? (
        <ErrorBanner onDismiss={() => setError(null)}>{explain(problem)}</ErrorBanner>
      ) : made ? (
        <StepDesc>Your passkey is set.</StepDesc>
      ) : (
        <StepDesc>Uses Face ID or fingerprint — no passwords needed.</StepDesc>
      )}
      {hint}
      <Cta>
        {made ? (
          <ActionButton title="Continue" onClick={onDone} />
        ) : (
          <ActionButton title={busy ? "Creating..." : "Create Passkey"} icon="key-outline" disabled={busy || !reg.options} onClick={() => void create()} />
        )}
      </Cta>
    </div>
  );
}

/* ── Recovery Key ─────────────────────────────────────────────────── */

function RecoveryStep({ facts, session, done, onDone, head, hint }: StepProps) {
  const [email, setEmail] = useState(session.user.email ?? facts.me.email ?? "");
  const sent = done || facts.hasCodes;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The app's one Continue: it sends, then moves on.
  const send = async () => {
    if (sent) return onDone();
    setBusy(true);
    setNotice(null);
    try {
      await emailRecoveryCodes(email.trim());
      facts.hasCodes = true;
      onDone();
    } catch (e) {
      setNotice(e instanceof CreatorApiError && e.serverMessage ? e.serverMessage : "Failed to send recovery codes. Please check your email and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && email.trim()) void send();
      }}
    >
      {head}
      {notice ? <ErrorBanner onDismiss={() => setNotice(null)}>{notice}</ErrorBanner> : null}
      <InputRow prefix={<Ion name="mail-outline" size={18} className="mr-2 shrink-0" style={{ color: ACCENTS.recovery }} />}>
        <input
          type="email"
          autoComplete="email"
          aria-label="Email for your recovery codes"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || sent}
          className={inputFieldCls}
        />
      </InputRow>
      {sent ? <StatusLine tone="ok">Sent</StatusLine> : null}
      {hint}
      <Cta>
        <ActionButton type="submit" title={busy ? "Sending..." : "Continue"} disabled={busy || !email.trim()} />
      </Cta>
    </form>
  );
}

/* ── Wallet ───────────────────────────────────────────────────────── */

type WalletPhase =
  | { kind: "play"; went: boolean }
  | { kind: "intro" }
  | { kind: "confirm"; credentialId: string }
  | { kind: "sealing" }
  | { kind: "ready" };

function WalletStep({
  facts,
  session,
  onDone,
  onSkip,
  onReady,
  last,
  head,
  hint,
}: StepProps & { onSkip: () => void; onReady: (ready: boolean) => void; last: boolean }) {
  // An Android phone is offered the Play app first; an iPhone and a computer make the wallet here.
  const [phase, setPhase] = useState<WalletPhase>(() => (playFirst(facts) ? { kind: "play", went: false } : { kind: "intro" }));
  const canMakeHere = walletToMake(facts);
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
      unlockWith(key);
      // So the backend watches it for deposits, as the Wallet page does after an unlock.
      await registerWalletAddress(key.address, null).catch(() => undefined);
      lock();
      setPhase({ kind: "ready" });
      onReady(true);
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
      if (!cancelled(e)) setError(e);
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
      if (!cancelled(e)) setError(e);
      void reg.refresh();
    } finally {
      setBusy(false);
    }
  };

  // Android: the Play app makes the wallet with every chain. A new tab, so this page is still here after.
  if (phase.kind === "play") {
    return (
      <div>
        {head}
        {phase.went ? (
          <StepDesc>Once HOLD is installed, sign in there with this account and make your wallet. It shows here too, with every chain.</StepDesc>
        ) : (
          <StepDesc>HOLD on Google Play makes your wallet with every chain: Solana, Base, Polygon and Ethereum. Sign in there with this account, and it shows here too.</StepDesc>
        )}
        {hint}
        <Cta>
          {phase.went ? (
            <ActionButton title="Continue" onClick={onSkip} />
          ) : (
            <a
              href={playHref("android")}
              target="_blank"
              rel="noopener"
              onClick={() => setPhase({ kind: "play", went: true })}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] border border-white/10 bg-white/[0.05] text-[16px] font-bold text-white/[0.85] transition-[background-color,transform] hover:bg-white/[0.09] active:scale-[0.98]"
            >
              <Ion name="logo-google" size={18} />
              Get HOLD on Google Play
            </a>
          )}
          {canMakeHere ? <SkipButton label="Make it here instead" onClick={() => setPhase({ kind: "intro" })} /> : null}
          {phase.went ? null : <SkipButton label="Not now" onClick={onSkip} />}
        </Cta>
      </div>
    );
  }

  // setup.tsx's Ready, what the app shows once the wallet is set up (and after a restore).
  if (phase.kind === "ready") {
    return (
      <div>
        <ReadyBox title="Your wallet is ready" line="You're all set to start using HOLD." />
        <Cta>
          <ActionButton title={last ? "Go to Dashboard" : "Continue"} onClick={onDone} />
        </Cta>
      </div>
    );
  }

  if (phase.kind === "sealing") {
    return (
      <div>
        {head}
        <div className="flex items-center gap-3 py-5" role="status">
          <Spinner color="#20D690" />
          <span className="text-[16px] font-semibold text-white/60">Setting up your wallet...</span>
        </div>
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div>
        {head}
        {error ? <ErrorBanner onDismiss={() => setError(null)}>{explain(error)}</ErrorBanner> : null}
        <StepDesc>Your new passkey was created. Confirm it once more so it can lock your wallet.</StepDesc>
        {hint}
        <Cta>
          <ActionButton title={busy ? "Creating..." : "Confirm with passkey"} icon="key-outline" disabled={busy} onClick={() => void withExisting([phase.credentialId])} />
        </Cta>
      </div>
    );
  }

  // Neither of these is fixed by reaching for another passkey: one is the
  // password manager, the other is the operating system under all of them.
  const cannotWrap = error instanceof PasskeyError && (error.code === "no_prf" || error.code === "os_too_old");
  const useExisting = ids.length > 0 && !cannotWrap;
  return (
    <div>
      {head}
      {error ? <ErrorBanner onDismiss={() => setError(null)}>{explain(error)}</ErrorBanner> : null}
      <StepDesc>A Solana wallet for USDC, locked by your passkey.</StepDesc>
      {/* A disclosure, not filler: the web wallet has no seed in a keychain behind it. */}
      <div className="mt-1 flex gap-2 rounded-[12px] border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.08)] p-2.5">
        <Ion name="warning-outline" size={16} className="mt-px shrink-0 text-[#F59E0B]" />
        <p className="text-[13px] font-medium leading-[18px] text-white/75">{LOSS_WARNING}</p>
      </div>
      {hint}
      <Cta>
        <ActionButton
          title={busy ? "Creating..." : "Create Wallet"}
          icon="key-outline"
          disabled={busy || (!useExisting && !reg.options)}
          onClick={() => void (useExisting ? withExisting() : withNew())}
        />
        {useExisting ? <SkipButton label="Use a new passkey" disabled={busy || !reg.options} onClick={() => void withNew()} /> : null}
        <SkipButton label="Not now" disabled={busy} onClick={onSkip} />
      </Cta>
    </div>
  );
}

function AppWalletStep({ onDone, head, hint }: StepProps) {
  return (
    <div>
      {head}
      <StepDesc>Your account already has a wallet, made in the HOLD app. Open the HOLD app to turn it on here too.</StepDesc>
      {hint}
      <Cta>
        <ActionButton title="Continue" onClick={onDone} />
      </Cta>
    </div>
  );
}
