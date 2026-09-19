"use client";

/**
 * "Link your phone": the computer's side (onboarding's last step, required).
 *
 * documentation/link-your-phone-and-approved-withdrawals.md. One QR for
 * both phones, `app.hihodl.xyz/link/<sessionId>?k=<webPub>`:
 *
 *   iPhone    opens it in Safari, signs in, joins; this screen goes to done
 *   Android   the HOLD app opens it (App Link) and joins with its key; this
 *             screen shows the six-digit code both screens compute, and only
 *             when the person says they match does it unlock the wallet with
 *             the passkey and seal the wallet's secret to the phone's key.
 *             Without a web wallet (made in the app, or "Not now") the phone
 *             still links: same code, same confirm, and the seal carries
 *             nothing (`carriesSecret: false`, box and nonce null).
 *
 * The web's X25519 key pair lives in a ref for this session and is wiped when
 * the screen goes away. The server only ever sees public keys and the box.
 *
 * On a phone (a "phone only" web user) there is no QR to scan: an iPhone
 * links itself here; an Android phone opens the same link in the app.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { QrCode } from "@/components/ad-space/qr";
import {
  createLinkSession,
  getLinkState,
  joinLinkSession,
  sealLinkSession,
  type LinkStatus,
} from "@/lib/link/api";
import { computeSas, formatSas } from "@/lib/link/sas";
import { newLinkKeyPair, sealSecret, type LinkKeyPair } from "@/lib/link/seal";
import { thisDevice, type Phone } from "@/lib/link/ua";
import { getWalletBackup, getWalletStatus, WalletApiError, type WalletBackup, type WalletStatus } from "@/lib/wallet/api";
import { fromBase64, toBase64, toBase64Url, wipe } from "@/lib/wallet/core";
import { explain } from "@/lib/wallet/explain";
import { userSecretFrom } from "@/lib/wallet/flows";
import { evaluatePrf } from "@/lib/wallet/passkey";

import { ActionButton, Cta, ErrorBanner, ReadyBox, SkipButton, Spinner, StepDesc } from "../front/step";

/* ── What the screen shows ────────────────────────────────────────── */

export type LinkPhase =
  | { kind: "starting" }
  | { kind: "failed"; message: string }
  | { kind: "waiting"; url: string; expiresAt: number; here: Phone | null; joining?: boolean; notice?: string | null }
  | { kind: "confirm"; sas: string; carries: boolean; busy: boolean; notice?: string | null }
  | { kind: "mismatch" }
  | { kind: "sending"; carries: boolean }
  | { kind: "expired" }
  | { kind: "done"; platform: Phone };

export interface LinkActions {
  onRetry: () => void;
  onJoinHere: () => void;
  onConfirm: () => void;
  onMismatch: () => void;
  onDone: () => void;
}

function useCountdown(until: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return "";
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Drawn with the app's step pieces (../front/step), under the "Link your
 * phone" title row onboarding puts above it. The app has no computer's side
 * to copy; the QR sits on the app's white tile (hihodl-wallet/src/ui/HQR.tsx:
 * padding 18, radius 28), and "linked" is the app's Ready check.
 */
export function LinkView({ phase, actions }: { phase: LinkPhase; actions: LinkActions }) {
  const left = useCountdown(phase.kind === "waiting" ? phase.expiresAt : null);

  if (phase.kind === "starting") {
    return (
      <div>
        <StepDesc>Your phone approves every withdrawal from your wallet.</StepDesc>
        <div className="mx-auto mt-3 h-[248px] w-[248px] animate-pulse rounded-[28px] bg-white/[0.06]" />
      </div>
    );
  }

  if (phase.kind === "failed") {
    return (
      <div>
        <ErrorBanner>{phase.message}</ErrorBanner>
        <Cta>
          <ActionButton title="Try again" onClick={actions.onRetry} />
        </Cta>
      </div>
    );
  }

  if (phase.kind === "waiting") {
    if (phase.here === "ios") {
      return (
        <div>
          {phase.notice ? <ErrorBanner>{phase.notice}</ErrorBanner> : null}
          <StepDesc>You are on your iPhone, so this is the phone we link. It approves every withdrawal with your passkey.</StepDesc>
          <Cta>
            <ActionButton title={phase.joining ? "Linking..." : "Link this iPhone"} icon="phone-portrait-outline" disabled={phase.joining} onClick={actions.onJoinHere} />
          </Cta>
        </div>
      );
    }
    if (phase.here === "android") {
      return (
        <div>
          <StepDesc>Open the HOLD app with this link. It shows a six-digit code; come back here to check it matches.</StepDesc>
          <p className="text-[13px] font-medium text-white/[0.55]">Code valid for {left}</p>
          <Cta>
            <a
              href={phase.url}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] border border-white/10 bg-white/[0.05] text-[16px] font-bold text-white/[0.85] transition-colors hover:bg-white/[0.09]"
            >
              Open in HOLD
            </a>
          </Cta>
        </div>
      );
    }
    return (
      <div>
        <StepDesc>Your phone approves every withdrawal from your wallet. Scan this code with its camera.</StepDesc>
        <div className="mt-3">
          <div className="mx-auto w-[248px] rounded-[28px] bg-white p-[18px]">
            <QrCode text={phase.url} title="Scan with your phone" className="h-auto w-full" />
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-[14px]">
          <li>
            <span className="font-bold text-white">iPhone</span>
            <span className="text-white/60"> opens it in Safari. Sign in with this account.</span>
          </li>
          <li>
            <span className="font-bold text-white">Android</span>
            <span className="text-white/60"> opens the HOLD app, or shows where to get it.</span>
          </li>
        </ul>
        <p className="mt-4 flex items-center gap-2 text-[13px] font-medium text-white/[0.55]" role="status">
          <Spinner size={14} color="rgba(255,255,255,0.55)" />
          Waiting for your phone · <span className="tabular-nums">{left}</span>
        </p>
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div>
        {phase.notice ? <ErrorBanner>{phase.notice}</ErrorBanner> : null}
        <StepDesc>{phase.carries ? "Your phone joined. Before your wallet goes to it, check this is your phone." : "Your phone joined. Check this is your phone."}</StepDesc>
        <p className="mt-4 text-center font-mono text-[40px] font-medium tracking-[0.12em] text-white tabular-nums" aria-label={`Code ${phase.sas.split("").join(" ")}`}>
          {formatSas(phase.sas)}
        </p>
        <p className="mt-2 text-center text-[15px] font-semibold text-white/80">Does your phone show this code?</p>
        <Cta>
          <ActionButton
            title={phase.busy ? (phase.carries ? "Waiting for your passkey..." : "Linking...") : "Yes, it matches"}
            icon={phase.carries ? "key-outline" : undefined}
            disabled={phase.busy}
            onClick={actions.onConfirm}
          />
          <SkipButton label="No, it is different" disabled={phase.busy} onClick={actions.onMismatch} />
        </Cta>
      </div>
    );
  }

  if (phase.kind === "mismatch") {
    return (
      <div>
        <ErrorBanner>The codes were different, so nothing was sent. That can happen when another phone scanned the code.</ErrorBanner>
        <Cta>
          <ActionButton title="Show a new code" onClick={actions.onRetry} />
        </Cta>
      </div>
    );
  }

  if (phase.kind === "sending") {
    return (
      <div className="flex items-center gap-3 py-5" role="status">
        <Spinner color="#20D690" />
        <span className="text-[16px] font-semibold text-white/60">{phase.carries ? "Sending your wallet to your phone..." : "Linking your phone..."}</span>
      </div>
    );
  }

  if (phase.kind === "expired") {
    return (
      <div>
        <StepDesc>That code expired. Codes last five minutes.</StepDesc>
        <Cta>
          <ActionButton title="Show a new code" onClick={actions.onRetry} />
        </Cta>
      </div>
    );
  }

  return (
    <div>
      <ReadyBox
        title="Your phone is linked"
        line={phase.platform === "android" ? "Your Android phone approves every withdrawal in the HOLD app." : "Your iPhone approves every withdrawal with your passkey."}
      />
      <Cta>
        <ActionButton title="Continue" onClick={actions.onDone} />
      </Cta>
    </div>
  );
}

/* ── The logic ────────────────────────────────────────────────────── */

const POLL_MS = 2000;
const FIVE_MINUTES = 5 * 60 * 1000;

/** Onboarding's link step: opens a session, waits for the phone, seals on Android. */
export function LinkPhone({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<LinkPhase>({ kind: "starting" });
  // Read here, not handed down: a wallet made one step earlier must count.
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  useEffect(() => {
    getWalletStatus().then(setWallet, () => setWallet(null));
  }, []);
  const keys = useRef<LinkKeyPair | null>(null);
  const session = useRef<{ id: string; webPub: Uint8Array } | null>(null);
  const backup = useRef<WalletBackup | null>(null);
  const appPub = useRef<Uint8Array | null>(null);
  // Which run of the flow a poll belongs to: a new code ends the old poll.
  const run = useRef(0);

  const forget = useCallback(() => {
    if (keys.current) wipe(keys.current.secretKey);
    keys.current = null;
    session.current = null;
    appPub.current = null;
  }, []);

  const start = useCallback(async () => {
    const mine = ++run.current;
    forget();
    setPhase({ kind: "starting" });
    const k = newLinkKeyPair();
    keys.current = k;
    const device = thisDevice();
    try {
      const webPub = toBase64Url(k.publicKey);
      const s = await createLinkSession({ webPub, desktopPlatform: device.platform, desktopBrowser: device.browser });
      if (mine !== run.current) return;
      session.current = { id: s.sessionId, webPub: k.publicKey };
      try {
        // So the phone page can tell a phone that is linking itself.
        window.localStorage.setItem("hold-link-session", s.sessionId);
      } catch {
        /* only changes a sentence on the phone page */
      }
      const url = s.url || `${window.location.origin}/link/${encodeURIComponent(s.sessionId)}?k=${webPub}`;
      const expiresAt = Date.parse(s.expiresAt) || Date.now() + FIVE_MINUTES;
      setPhase({ kind: "waiting", url, expiresAt, here: device.phone });
    } catch (e) {
      if (mine === run.current) setPhase({ kind: "failed", message: explain(e) });
    }
  }, [forget]);

  useEffect(() => {
    const runs = run;
    void start();
    return () => {
      // Ends any poll or request still in flight.
      runs.current++;
      forget();
    };
  }, [start, forget]);

  // Follow the session while it is open.
  const waitingFor = phase.kind === "waiting" || phase.kind === "confirm" || phase.kind === "sending" ? phase.kind : null;
  useEffect(() => {
    if (!waitingFor || !session.current) return;
    const mine = run.current;
    const id = session.current.id;
    let stopped = false;
    const tick = async () => {
      try {
        const s = await getLinkState(id);
        if (stopped || mine !== run.current) return;
        onStatus(s.status, s.platform, s.appPub, s.carriesSecret);
      } catch {
        /* the next tick asks again */
      }
    };
    const onStatus = (status: LinkStatus, platform: Phone | null, pub: string | null, carriesSecret: boolean | null) => {
      if (status === "done") {
        forget();
        setPhase({ kind: "done", platform: platform ?? "ios" });
      } else if (status === "expired") {
        forget();
        setPhase({ kind: "expired" });
      } else if (status === "joined" && platform === "android" && pub && waitingFor === "waiting") {
        const raw = fromBase64(pub);
        if (raw.length !== 32 || !session.current) return;
        appPub.current = raw;
        // The server says; an older one that does not, read from the wallet itself.
        const carries = carriesSecret ?? (!!wallet && wallet.state === "web_wallet" && !!wallet.current_blob_hash);
        // Read ahead: the passkey prompt must start inside the click.
        if (carries) getWalletBackup().then((b) => (backup.current = b), () => undefined);
        setPhase({ kind: "confirm", sas: computeSas(id, session.current.webPub, raw), carries, busy: false });
      }
    };
    void tick();
    const t = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [waitingFor, wallet, forget]);

  const joinHere = async () => {
    if (!session.current || phase.kind !== "waiting") return;
    setPhase({ ...phase, joining: true, notice: null });
    try {
      await joinLinkSession(session.current.id, { platform: "ios" });
    } catch (e) {
      setPhase({ ...phase, joining: false, notice: explain(e) });
    }
  };

  const confirm = async () => {
    if (phase.kind !== "confirm" || !session.current || !keys.current || !appPub.current) return;
    if (!phase.carries) {
      // No web wallet: the phone links, and nothing is sealed.
      setPhase({ ...phase, busy: true, notice: null });
      try {
        await sealLinkSession(session.current.id, { box: null, nonce: null });
        wipe(keys.current.secretKey);
        setPhase({ kind: "sending", carries: false });
      } catch (e) {
        if (e instanceof WalletApiError && e.code === "SECRET_REQUIRED") {
          // There is a web wallet after all: it goes to the phone, with the passkey.
          void getWalletBackup().then((x) => (backup.current = x), () => undefined);
          setPhase({ ...phase, carries: true, busy: false, notice: "Your wallet goes to this phone too. Confirm again with your passkey." });
        } else setPhase({ ...phase, busy: false, notice: explain(e) });
      }
      return;
    }
    const b = backup.current;
    if (!b) {
      setPhase({ ...phase, notice: "Still reading your wallet. Try again in a moment." });
      void getWalletBackup().then((x) => (backup.current = x), () => undefined);
      return;
    }
    setPhase({ ...phase, busy: true, notice: null });
    let prf: Uint8Array | null = null;
    let secret: Uint8Array | null = null;
    try {
      const a = await evaluatePrf(b.wrappings.map((w) => w.credential_id));
      prf = a.prf;
      secret = await userSecretFrom(b, a.credentialId, prf);
      const { box, nonce } = sealSecret(secret, appPub.current, keys.current.secretKey);
      await sealLinkSession(session.current.id, { box: toBase64(box), nonce: toBase64(nonce) });
      // The web's part is over: its secret key is no longer needed.
      wipe(keys.current.secretKey);
      setPhase({ kind: "sending", carries: true });
    } catch (e) {
      setPhase({ ...phase, busy: false, notice: explain(e) });
    } finally {
      wipe(prf, secret);
    }
  };

  return (
    <LinkView
      phase={phase}
      actions={{
        onRetry: () => void start(),
        onJoinHere: () => void joinHere(),
        onConfirm: () => void confirm(),
        onMismatch: () => {
          run.current++;
          forget();
          setPhase({ kind: "mismatch" });
        },
        onDone,
      }}
    />
  );
}

