"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { QrCode } from "@/components/ad-space/qr";
import { Wordmark } from "@/components/site/Wordmark";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

/**
 * hihodl.xyz/wc?uri=wc:… : a WalletConnect pairing link for HOLD.
 *
 * With HOLD installed, the phone never loads this page: /wc and /wc/* are in
 * apple-app-site-association (and Android's App Link intent filter), so the
 * app opens and pairs. This page is for everybody else:
 *
 *   a computer   "Open this on the phone that has HOLD", with the same link
 *                as a QR for the phone's camera
 *   a phone      tries hihodl://wc?uri=… (the app's own scheme, for an
 *                in-app browser that does not follow universal links), and
 *                offers the store if nothing opened
 *
 * Only a `wc:` URI is passed on: the app is never handed anything else
 * through this door.
 */
const DEEP_LINK = "hihodl://wc?uri=";
const OPEN_WAIT_MS = 1500;

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** A WalletConnect v2 pairing URI (`wc:<topic>@2?…`), and nothing longer than one needs. */
function pairingUri(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!/^wc:[0-9a-zA-Z]+@\d+(\?.*)?$/.test(v) || v.length > 2048) return null;
  return v;
}

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(180deg, #060B10 0%, #0B1520 100%)",
  color: "#FFFFFF",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 16px",
};

const button: React.CSSProperties = {
  display: "inline-block",
  padding: "14px 28px",
  background: "#FFB703",
  color: "#070C12",
  fontSize: 16,
  fontWeight: 700,
  textDecoration: "none",
  borderRadius: 12,
};

function WcContent() {
  const searchParams = useSearchParams();
  const uri = pairingUri(searchParams?.get("uri"));
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [tried, setTried] = useState(false);
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setHere(window.location.href);
    if (p === "desktop" || !uri) return;

    const deepLink = `${DEEP_LINK}${encodeURIComponent(uri)}`;
    let timer: number | undefined = window.setTimeout(() => setTried(true), OPEN_WAIT_MS);
    const opened = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) opened();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", opened);
    window.location.href = deepLink;
    return () => {
      opened();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", opened);
    };
  }, [uri]);

  const deepLink = uri ? `${DEEP_LINK}${encodeURIComponent(uri)}` : null;
  const storeUrl = platform === "android" ? PLAY_STORE_URL : APP_STORE_URL;

  let title: string;
  let body: string;
  if (!uri) {
    title = "This link is not complete";
    body = "It has no WalletConnect code in it. Go back to the site and choose HOLD again.";
  } else if (platform === "desktop") {
    title = "Open this on the phone that has HOLD";
    body = "Scan this code with your phone's camera. HOLD opens and asks you to connect the site.";
  } else if (tried) {
    title = "HOLD did not open";
    body = "If HOLD is on this phone, tap Open HOLD. If it isn't, get it and open this link again.";
  } else {
    title = "Opening HOLD…";
    body = "HOLD asks you to connect the site.";
  }

  return (
    <main style={shell}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, color: "#FFFFFF" }}>
          <Wordmark className="h-6 w-auto" />
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, lineHeight: "30px" }}>{title}</h1>
        <p style={{ margin: "0 0 32px", color: "#9AA5B4", fontSize: 15, lineHeight: "22px" }}>{body}</p>

        {uri && platform === "desktop" && here ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <QrCode text={here} title="The link to open on your phone" className="h-56 w-56 rounded-xl" />
          </div>
        ) : null}

        {uri && platform && platform !== "desktop" && deepLink ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <a href={deepLink} style={button}>
              Open HOLD
            </a>
            {tried ? (
              <a href={storeUrl} style={{ color: "#9AA5B4", fontSize: 15, textDecoration: "underline" }}>
                Get HOLD
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function WcPage() {
  return (
    <Suspense fallback={<main style={shell} />}>
      <WcContent />
    </Suspense>
  );
}
