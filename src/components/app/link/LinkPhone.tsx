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
 *             the passkey and seal the wallet's secret to the phone's key
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
import { getWalletBackup, getWalletStatus, type WalletBackup, type WalletStatus } from "@/lib/wallet/api";
import { fromBase64, toBase64, toBase64Url, wipe } from "@/lib/wallet/core";
import { explain } from "@/lib/wallet/explain";
import { userSecretFrom } from "@/lib/wallet/flows";
import { evaluatePrf } from "@/lib/wallet/passkey";

import { btnGhost, btnPrimary, Note, Warn } from "../front/kit";

/* ── What the screen shows ────────────────────────────────────────── */

export type LinkPhase =
  | { kind: "starting" }
  | { kind: "failed"; message: string }
  | { kind: "waiting"; url: string; expiresAt: number; here: Phone | null; joining?: boolean; notice?: string | null }
  | { kind: "confirm"; sas: string; busy: boolean; notice?: string | null }
  | { kind: "no-wallet"; reason: "app_wallet" | "none" }
  | { kind: "mismatch" }
  | { kind: "sending" }
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

/** The step's actions, always at the bottom of the card. */
function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">{children}</div>;
}

export function LinkView({ phase, actions }: { phase: LinkPhase; actions: LinkActions }) {
  const left = useCountdown(phase.kind === "waiting" ? phase.expiresAt : null);

  if (phase.kind === "starting") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Your phone approves every withdrawal from your wallet. Getting a code for it…</Note>
        <div className="mt-5 h-[200px] w-[200px] animate-pulse self-center rounded-[16px] bg-white/[0.06]" />
      </div>
    );
  }

  if (phase.kind === "failed") {
    return (
      <div className="flex flex-1 flex-col">
        <Warn>{phase.message}</Warn>
        <Actions>
          <button type="button" className={btnPrimary} onClick={actions.onRetry}>
            Try again
          </button>
        </Actions>
      </div>
    );
  }

  if (phase.kind === "waiting") {
    if (phase.here === "ios") {
      return (
        <div className="flex flex-1 flex-col">
          <Note>
            You are on your iPhone, so this is the phone we link. From now on it approves every withdrawal from your
            wallet with your passkey.
          </Note>
          {phase.notice ? <div className="mt-4"><Warn>{phase.notice}</Warn></div> : null}
          <Actions>
            <button type="button" className={btnPrimary} disabled={phase.joining} onClick={actions.onJoinHere}>
              {phase.joining ? "Linking…" : "Link this iPhone"}
            </button>
          </Actions>
        </div>
      );
    }
    if (phase.here === "android") {
      return (
        <div className="flex flex-1 flex-col">
          <Note>
            You are on your Android phone. Open the HOLD app with this link: it shows a six-digit code, and you come back
            here to check it matches.
          </Note>
          <p className="mt-4 text-tiny text-[#9FB7C2]">Code valid for {left}</p>
          <Actions>
            <a href={phase.url} className={btnPrimary}>
              Open in HOLD
            </a>
          </Actions>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col">
        <Note>Your phone approves every withdrawal from your wallet. Scan this code with its camera.</Note>
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="w-[184px] shrink-0 overflow-hidden rounded-[14px]">
            <QrCode text={phase.url} title="Scan with your phone" className="h-auto w-full" />
          </div>
          <ul className="flex min-w-0 flex-col gap-3 text-small text-[#CFE3EC]">
            <li>
              <span className="block font-medium text-text">iPhone</span>
              <span className="text-[#9FB7C2]">Opens in Safari. Sign in with this account.</span>
            </li>
            <li>
              <span className="block font-medium text-text">Android</span>
              <span className="text-[#9FB7C2]">Opens the HOLD app, or shows where to get it.</span>
            </li>
          </ul>
        </div>
        <p className="mt-5 text-tiny text-[#9FB7C2]">
          Waiting for your phone · code valid for <span className="tabular-nums">{left}</span>
        </p>
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Your phone joined. Before your wallet goes to it, check this is your phone.</Note>
        <p className="mt-6 text-center font-mono text-[40px] font-medium tracking-[0.12em] text-text tabular-nums" aria-label={`Code ${phase.sas.split("").join(" ")}`}>
          {formatSas(phase.sas)}
        </p>
        <p className="mt-3 text-center text-body text-text">Does your phone show this code?</p>
        {phase.notice ? <div className="mt-4"><Warn>{phase.notice}</Warn></div> : null}
        <Actions>
          <button type="button" className={btnPrimary} disabled={phase.busy} onClick={actions.onConfirm}>
            {phase.busy ? "Waiting for your passkey…" : "Yes, it matches"}
          </button>
          <button type="button" className={btnGhost} disabled={phase.busy} onClick={actions.onMismatch}>
            No, it is different
          </button>
        </Actions>
      </div>
    );
  }

  if (phase.kind === "no-wallet") {
    return (
      <div className="flex flex-1 flex-col">
        <Warn>
          {phase.reason === "app_wallet"
            ? "Your wallet was made in the HOLD app, so there is nothing on the web to send to this phone. Sign in to the HOLD app on it with this account."
            : "There is no wallet on the web yet to send to your phone. Create your wallet first, then link your phone."}
        </Warn>
        <Actions>
          <button type="button" className={btnGhost} onClick={actions.onRetry}>
            Show a new code
          </button>
        </Actions>
      </div>
    );
  }

  if (phase.kind === "mismatch") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>
          The codes were different, so nothing was sent. That can happen when another phone scanned the code. Start again
          with a new one.
        </Note>
        <Actions>
          <button type="button" className={btnPrimary} onClick={actions.onRetry}>
            Show a new code
          </button>
        </Actions>
      </div>
    );
  }

  if (phase.kind === "sending") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>Sending your wallet to your phone, locked so only your phone can open it. Finish on your phone.</Note>
        <div className="mt-5 h-11 animate-pulse rounded-[12px] bg-white/[0.06]" />
      </div>
    );
  }

  if (phase.kind === "expired") {
    return (
      <div className="flex flex-1 flex-col">
        <Note>That code expired. Codes last five minutes.</Note>
        <Actions>
          <button type="button" className={btnPrimary} onClick={actions.onRetry}>
            Show a new code
          </button>
        </Actions>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-small text-success">Your phone is linked.</p>
      <Note>
        <span className="mt-2 block">
          {phase.platform === "android"
            ? "Your Android phone approves every withdrawal in the HOLD app."
            : "Your iPhone approves every withdrawal with your passkey."}
        </span>
      </Note>
      <Actions>
        <button type="button" className={btnPrimary} onClick={actions.onDone}>
          Continue
        </button>
      </Actions>
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
        onStatus(s.status, s.platform, s.appPub);
      } catch {
        /* the next tick asks again */
      }
    };
    const onStatus = (status: LinkStatus, platform: Phone | null, pub: string | null) => {
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
        if (!wallet || wallet.state !== "web_wallet" || !wallet.current_blob_hash) {
          setPhase({ kind: "no-wallet", reason: wallet?.state === "app_wallet" ? "app_wallet" : "none" });
          return;
        }
        // Read ahead: the passkey prompt must start inside the click.
        getWalletBackup().then((b) => (backup.current = b), () => undefined);
        setPhase({ kind: "confirm", sas: computeSas(id, session.current.webPub, raw), busy: false });
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
      setPhase({ kind: "sending" });
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

