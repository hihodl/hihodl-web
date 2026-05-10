"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

// iOS is live; Android is in active development per layout.tsx:214 — until
// Play Store goes live, send Android visitors to the homepage where the
// "Coming soon to Google Play" copy + email-notify CTA lives.
const APP_STORE_URL = "https://apps.apple.com/nl/app/hihodl-stablecoin-wallet/id6755203065";
const PLAY_STORE_URL = "https://www.hihodl.xyz/#download";

export default function InviteRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;

    // Try to open the app via deep link
    window.location.href = `hihodl://invite/${code}`;

    // Fallback: after 1.5s, redirect to the appropriate store
    const timer = setTimeout(() => {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);

      if (isIOS) {
        window.location.href = APP_STORE_URL;
      } else if (isAndroid) {
        window.location.href = PLAY_STORE_URL;
      } else {
        // Desktop fallback — go to homepage
        window.location.href = "https://www.hihodl.xyz";
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A1929",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="24" fill="#FFB703" />
          <text
            x="24"
            y="30"
            textAnchor="middle"
            fill="#0A1929"
            fontSize="20"
            fontWeight="900"
          >
            H
          </text>
        </svg>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
        You&apos;ve been invited to HiHODL
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 32,
          maxWidth: 400,
        }}
      >
        Your friend invited you to join HiHODL — the gasless crypto wallet.
        Sign up and swap $5+ to earn them a free month of Pro.
      </p>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
        Redirecting to the app...
      </p>
      <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
        <a
          href={APP_STORE_URL}
          style={{
            padding: "12px 24px",
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          App Store
        </a>
        <a
          href={PLAY_STORE_URL}
          style={{
            padding: "12px 24px",
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Google Play
        </a>
      </div>
    </div>
  );
}
