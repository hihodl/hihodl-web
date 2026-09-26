"use client";

/**
 * app.hihodl.xyz/connect: the window a site opens when somebody picks HOLD in
 * its wallet list on a computer (documentation/hold-connect-v0.md, "The
 * fourth door"). One card, like the link screens:
 *
 *   the site's host, big        from MessageEvent.origin, never from the site's words
 *   "Says it is SP3ND", small   the name the site gave itself, display only
 *   the one status line         amber and pulsing while the default phone decides
 *
 * Signed out, the product's own door signs in here (the email code stays on
 * this page; Apple and Google go and come back to /connect). The site's
 * origin is kept in this popup's sessionStorage for that trip, but only to
 * draw it: a fresh hello from the opener is needed before anything is asked.
 * A provider's page can cut the popup from its opener on the way (COOP): then
 * the person is signed in and presses Connect on the site again, which
 * reopens this same window by name with a new opener.
 *
 * The token goes to the opener with targetOrigin = the verified origin, so a
 * site that navigated away in the meantime never receives it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Door as SignInDoor } from "@/components/app/front/Door";
import { t as tNow } from "@/lib/app/i18n";
import { Rich, useT } from "@/lib/app/i18n/react";
import { askToConnect, waitForConnect } from "@/lib/connect/api";
import {
  CONNECTED,
  dappOrigin,
  decodeKept,
  encodeKept,
  errorFor,
  hostOf,
  isLocalOrigin,
  READY,
  readHello,
  STORE_KEY,
  type ConnectRequest,
} from "@/lib/connect/handshake";
import { useCreatorSession } from "@/lib/creator/session";
import { phonePlatformOf, approveOnDefaultPhone, type PhonePlatform } from "@/lib/link/payment-approval-core";
import { getWalletStatus, WalletApiError } from "@/lib/wallet/api";

import { useProductHref } from "../base";
import { btnGhost, btnPrimary, DoorCard, HoldMark, Note, Warn } from "../front/kit";
import { Spinner } from "../front/step";
import { Ion } from "../ion";
import { linkHref } from "../link/in-app";
import { FooterNote, StatusLine, useCountdown } from "../wallet/app-kit";

/** How long the opener has to say hello after our ready. */
const HELLO_WAIT_MS = 10_000;

type Site = { origin: string; appName: string | null };

type Phase =
  | { k: "starting" }
  | { k: "no-opener" }
  | { k: "no-hello" }
  | { k: "insecure"; origin: string }
  | { k: "reopen" }
  | { k: "hello" }
  | { k: "asking" }
  | { k: "waiting"; req: ConnectRequest }
  | { k: "no-phone" }
  | { k: "failed"; message: string }
  | { k: "connected" }
  | { k: "rejected" }
  | { k: "expired" };

function keep(site: Site | null): void {
  try {
    if (site) window.sessionStorage.setItem(STORE_KEY, encodeKept({ ...site, at: Date.now() }));
    else window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* only the drawing after a sign-in trip depends on it */
  }
}

function kept(): Site | null {
  try {
    return decodeKept(window.sessionStorage.getItem(STORE_KEY), Date.now());
  } catch {
    return null;
  }
}

function refusal(e: unknown): Phase {
  const err = e instanceof WalletApiError ? e : null;
  if (err?.code === "NO_LINKED_PHONE") return { k: "no-phone" };
  if (err?.status === 429 || err?.code === "rate_limited") return { k: "failed", message: tNow("link.connect.rateLimited") };
  if (err?.status === 400) return { k: "failed", message: tNow("link.connect.badOrigin") };
  return { k: "failed", message: tNow("link.connect.failed") };
}

export function ConnectPopup() {
  const t = useT();
  const productHref = useProductHref();
  const { session, configured } = useCreatorSession();
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  const [site, setSite] = useState<Site | null>(null);
  const [platform, setPlatform] = useState<PhonePlatform | null>(null);
  const siteRef = useRef<Site | null>(null);
  const askedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /** Tell the site, only at the origin the browser vouched for. */
  const tell = useCallback((msg: object) => {
    const s = siteRef.current;
    const opener = window.opener as Window | null;
    if (!s || !opener || opener.closed) return false;
    try {
      opener.postMessage(msg, s.origin);
      return true;
    } catch {
      return false;
    }
  }, []);

  // The handshake: ready to the opener, then its hello, from it only.
  useEffect(() => {
    const opener = window.opener as Window | null;
    const before = kept();
    if (!opener) {
      if (before) {
        siteRef.current = before;
        setSite(before);
        setPhase({ k: "reopen" });
      } else setPhase({ k: "no-opener" });
      return;
    }
    if (before) setSite(before);

    const onMessage = (e: MessageEvent) => {
      if (e.source !== opener || siteRef.current) return;
      const hello = readHello(e.data);
      if (!hello) return;
      const origin = dappOrigin(e.origin);
      if (!origin) {
        setPhase({ k: "insecure", origin: String(e.origin) });
        return;
      }
      const s = { origin, appName: hello.appName };
      siteRef.current = s;
      setSite(s);
      keep(s);
      setPhase({ k: "hello" });
    };
    window.addEventListener("message", onMessage);
    // Nothing secret in it, and the site's origin is not known yet: "*".
    try {
      opener.postMessage({ type: READY }, "*");
    } catch {
      /* an opener that cannot be written to never says hello either */
    }
    const timer = setTimeout(() => {
      if (!siteRef.current) setPhase((p) => (p.k === "starting" ? { k: "no-hello" } : p));
    }, HELLO_WAIT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  const ask = useCallback(async () => {
    const s = siteRef.current;
    if (!s) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ k: "asking" });
    let first: ConnectRequest;
    try {
      first = await askToConnect(s.origin, s.appName);
    } catch (e) {
      if (!ctrl.signal.aborted) setPhase(refusal(e));
      return;
    }
    if (ctrl.signal.aborted) return;
    setPhase({ k: "waiting", req: first });
    const done = await waitForConnect(first, ctrl.signal);
    if (ctrl.signal.aborted || !done) return;
    if (done.status === "approved") {
      // The token is revealed on one read only: without it (or without the
      // site to hand it to) this connect is spent, and the site asks again.
      if (!done.account || !done.token || !tell({ type: CONNECTED, account: done.account, token: done.token })) {
        setPhase({ k: "failed", message: tNow("link.connect.noHello") });
        return;
      }
      keep(null);
      setPhase({ k: "connected" });
      window.close();
      return;
    }
    const status = done.status === "rejected" ? "rejected" : "expired";
    tell(errorFor(status));
    keep(null);
    setPhase({ k: status });
  }, [tell]);

  // Signed in with a verified site: ask the phone, once per page.
  useEffect(() => {
    if (phase.k !== "hello" || !session || askedRef.current) return;
    askedRef.current = true;
    void ask();
  }, [phase.k, session, ask]);

  // Which phone to name in the status line; nothing depends on it.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    getWalletStatus()
      .then((s) => alive && setPlatform(phonePlatformOf(s.approver?.platform)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = () => {
    abortRef.current?.abort();
    tell(errorFor("cancelled"));
    keep(null);
    window.close();
  };

  // Signed out, with a site to connect: the product's door, here.
  const needsSignIn = session === null && (phase.k === "hello" || phase.k === "reopen");
  if (needsSignIn) return <SignInDoor configured={configured} />;

  const host = site ? hostOf(site.origin) : null;
  let body: React.ReactNode;
  switch (phase.k) {
    case "starting":
    case "hello":
    case "asking":
      body = (
        <div className="flex items-center gap-3 py-2 text-small text-[#9FB7C2]">
          <Spinner color="#FFB703" size={18} />
          {phase.k === "asking" ? t("link.connect.asking") : null}
        </div>
      );
      break;
    case "waiting":
      body = <Waiting req={phase.req} platform={platform} onCancel={cancel} />;
      break;
    case "no-opener":
      body = <Note>{t("link.connect.noOpener.body")}</Note>;
      break;
    case "no-hello":
      body = <Warn>{t("link.connect.noHello")}</Warn>;
      break;
    case "insecure":
      body = <Warn>{t("link.connect.insecure", { origin: phase.origin })}</Warn>;
      break;
    case "reopen":
      body = <Note>{t("link.connect.reopen", { host: host ?? "" })}</Note>;
      break;
    case "no-phone":
      body = (
        <div className="flex flex-col gap-3">
          <Warn>{t("link.connect.noPhone.body")}</Warn>
          {/* A full load: the link screen carries the wallet pages' strict CSP. It comes back here, to the same opener. */}
          <a href={linkHref(productHref, productHref("/connect"))} className={`${btnPrimary} w-full`}>
            <Ion name="phone-portrait-outline" size={18} />
            {t("link.connect.noPhone.cta")}
          </a>
          <button type="button" className={`${btnGhost} w-full`} onClick={cancel}>
            {t("common.cancel")}
          </button>
        </div>
      );
      break;
    case "failed":
      body = (
        <div className="flex flex-col gap-3">
          <Warn>{phase.message}</Warn>
          {siteRef.current && window.opener ? (
            <button type="button" className={`${btnPrimary} w-full`} onClick={() => void ask()}>
              {t("link.connect.tryAgain")}
            </button>
          ) : null}
          <button type="button" className={`${btnGhost} w-full`} onClick={cancel}>
            {t("common.close")}
          </button>
        </div>
      );
      break;
    case "connected":
      body = (
        <p role="status" className="flex items-center gap-2 text-small text-text">
          <Ion name="checkmark-circle" size={18} color="#20D690" />
          {t("link.connect.connected")}
        </p>
      );
      break;
    case "rejected":
    case "expired":
      body = (
        <div className="flex flex-col gap-3">
          <Warn>{t(phase.k === "rejected" ? "link.connect.rejected" : "link.connect.expired", { host: host ?? "" })}</Warn>
          <button type="button" className={`${btnGhost} w-full`} onClick={() => window.close()}>
            {t("common.close")}
          </button>
        </div>
      );
      break;
  }

  const title = phase.k === "no-opener" ? t("link.connect.noOpener.title") : phase.k === "no-phone" ? t("link.connect.noPhone.title") : null;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-6">
      <DoorCard>
        <HoldMark className="h-4 w-auto" />
        {host && phase.k !== "insecure" ? (
          <div className="mt-6">
            <p className="text-tiny uppercase tracking-[0.08em] text-[#9FB7C2]">{t("link.connect.eyebrow")}</p>
            <h1 className="mt-2 break-all text-[26px] font-bold leading-[1.15] tracking-[-0.4px] text-white">{host}</h1>
            {site?.appName ? <p className="mt-1 text-small text-[#9FB7C2]">{t("link.connect.saysItIs", { name: site.appName })}</p> : null}
            {site && isLocalOrigin(site.origin) ? <p className="mt-1 text-tiny text-[#9FB7C2]">{t("link.connect.localDev")}</p> : null}
          </div>
        ) : title ? (
          <h1 className="mt-6 text-h4 font-light text-text">{title}</h1>
        ) : null}
        {host && (phase.k === "waiting" || phase.k === "asking" || phase.k === "hello") ? (
          <p className="mt-3 text-small leading-relaxed text-[#9FB7C2]">{t("link.connect.what")}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-4">{body}</div>
      </DoorCard>
    </div>
  );
}

function Waiting({ req, platform, onCancel }: { req: ConnectRequest; platform: PhonePlatform | null; onCancel: () => void }) {
  const t = useT();
  const left = useCountdown(req.expiresAt || null);
  return (
    <div className="flex flex-col gap-3">
      <StatusLine>{approveOnDefaultPhone(platform)}</StatusLine>
      <button type="button" className={`${btnGhost} w-full`} onClick={onCancel}>
        {t("common.cancel")}
      </button>
      <FooterNote icon="phone-portrait-outline">
        {t("link.connect.footer")}
        {left ? (
          <>
            {" "}
            <Rich k="link.approval.expiresIn" vars={{ left }} tags={{ n: (c) => <span className="tabular-nums">{c}</span> }} />
          </>
        ) : null}
      </FooterNote>
    </div>
  );
}
