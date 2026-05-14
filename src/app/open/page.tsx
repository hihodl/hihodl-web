"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const APP_STORE_URL =
  "https://apps.apple.com/nl/app/hihodl-stablecoin-wallet/id6755203065";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sayhihodl.hihodlyes";
const DEEP_LINK_SCHEME = "hihodl://";
const FALLBACK_DELAY_MS = 1500;

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function OpenContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"opening" | "fallback">("opening");
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    const to = searchParams?.get("to") ?? "";
    const deepLink = `${DEEP_LINK_SCHEME}${to}`;

    if (detected === "desktop") {
      window.location.href = "https://hihodl.xyz";
      return;
    }

    const storeUrl = detected === "ios" ? APP_STORE_URL : PLAY_STORE_URL;

    let timeoutId: number | undefined;
    const cancelFallback = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) cancelFallback();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", cancelFallback);
    window.addEventListener("blur", cancelFallback);

    timeoutId = window.setTimeout(() => {
      setStatus("fallback");
      window.location.href = storeUrl;
    }, FALLBACK_DELAY_MS);

    window.location.href = deepLink;

    return () => {
      cancelFallback();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", cancelFallback);
      window.removeEventListener("blur", cancelFallback);
    };
  }, [searchParams]);

  const storeUrl = platform === "android" ? PLAY_STORE_URL : APP_STORE_URL;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #060B10 0%, #0B1520 100%)",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 2,
            marginBottom: 32,
          }}
        >
          HIHODL
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: "30px",
          }}
        >
          {status === "opening" ? "Opening HIHODL…" : "Almost there"}
        </h1>

        <p
          style={{
            margin: "0 0 32px",
            color: "#9AA5B4",
            fontSize: 15,
            lineHeight: "22px",
          }}
        >
          {status === "opening"
            ? "If the app does not open automatically, tap below."
            : "Looks like the app is not installed. Get it now."}
        </p>

        <a
          href={storeUrl}
          style={{
            display: "inline-block",
            padding: "14px 28px",
            background: "#FFB703",
            color: "#070C12",
            fontSize: 16,
            fontWeight: 700,
            textDecoration: "none",
            borderRadius: 12,
          }}
        >
          Get the app
        </a>

        <p
          style={{
            marginTop: 40,
            color: "#5A6470",
            fontSize: 12,
            lineHeight: "18px",
          }}
        >
          HIHODL · The wallet for the remote economy
        </p>
      </div>
    </main>
  );
}

function OpenFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #060B10 0%, #0B1520 100%)",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 2,
            marginBottom: 32,
          }}
        >
          HIHODL
        </div>
        <p style={{ color: "#9AA5B4", fontSize: 15 }}>Opening…</p>
      </div>
    </main>
  );
}

export default function OpenPage() {
  return (
    <Suspense fallback={<OpenFallback />}>
      <OpenContent />
    </Suspense>
  );
}
