"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { productUrl } from "@/lib/app/paths";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

export default function InviteRedirect() {
  const { code } = useParams<{ code: string }>();
  // Set when the link carries a group or an event: the page then stays up with
  // an "Open the group" / "Open the event" button instead of leaving for the
  // store. An event wins the words on the page when the link carries both.
  const [carried, setCarried] = useState<{ kind: "group" | "event"; link: string } | null>(null);

  useEffect(() => {
    if (!code) return;

    // A creator's team invitation is this same link with `?seat=<code>` on the
    // end. The app's deep link below carries the invite code and nothing after
    // it, and the store fallback carries nothing at all, so a seat sent that
    // way was lost on every device. The creator console takes seats in the
    // browser with no install (HOLD Spaces, app.hihodl.xyz), so a link carrying
    // one goes there instead. The
    // seat alone says whose invitation it is; the invite code is not passed on.
    // Read from `location` rather than `useSearchParams`: this runs once, after
    // mount, and needs no Suspense boundary around the whole page for it.
    // A crew invitation is the lead's link with `?crew=<code>`: same reasoning
    // as a seat, taken in the browser at app.hihodl.xyz/spaces/crew.
    const crew = new URLSearchParams(window.location.search).get("crew");
    if (crew && /^[A-Za-z0-9_-]{16,128}$/.test(crew)) {
      const q = new URLSearchParams({ join: crew });
      window.location.replace(productUrl(`/spaces/crew?${q.toString()}`));
      return;
    }

    const seat = new URLSearchParams(window.location.search).get("seat");
    if (seat && /^[A-Za-z0-9_-]{16,128}$/.test(seat)) {
      const q = new URLSearchParams({ seat });
      window.location.replace(productUrl(`/spaces/team?${q.toString()}`));
      return;
    }

    // A group's join link is the sharer's invite link with `?group=<code>`.
    // The deep link carries it into the app. Someone without HOLD has no app
    // to open, and a store install drops every parameter, so for a group the
    // page never leaves for the store on its own: it stays up with the store
    // buttons and an "Open the group" button that works once HOLD is installed.
    //
    // An event shared with someone is the same link with `?event=<slug>`, the
    // path of the event's public Luma page (luma.com/<slug>). Same reasoning,
    // same treatment: the slug rides the deep link and the page stays up with
    // "Open the event". The slug is only passed through, never fetched, and
    // one that is not a plain slug is dropped: nothing a link carries reaches
    // the deep link unchecked. A link may carry a group and an event together.
    const params = new URLSearchParams(window.location.search);
    const group = params.get("group");
    const event = params.get("event");
    const q = new URLSearchParams();
    if (group && /^[A-Za-z0-9]{10,32}$/.test(group)) q.set("group", group);
    if (event && /^[A-Za-z0-9_-]{1,120}$/.test(event)) q.set("event", event);
    if (q.has("group") || q.has("event")) {
      const deepLink = `hihodl://invite/${encodeURIComponent(code)}?${q.toString()}`;
      setCarried({ kind: q.has("event") ? "event" : "group", link: deepLink });
      window.location.href = deepLink;
      return;
    }

    // Try to open the app via deep link.
    //
    // `hihodl`, not `hold`: the app registers exactly one custom scheme, and
    // that is it — `scheme: "hihodl"` in app.json, `hihodl` in Info.plist and
    // in the Android manifest. `hold://` is registered on neither platform, so
    // it opened nothing and every invite fell through to the store, code lost.
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
        window.location.href = "https://hihodl.xyz";
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
        {carried?.kind === "event"
          ? "See this event on HOLD"
          : carried
            ? "You\u2019re invited to a group on HOLD"
            : "You\u2019ve been invited to HOLD"}
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 32,
          maxWidth: 400,
        }}
      >
        {carried?.kind === "event" ? (
          <>
            Book it with friends, free or in stablecoins. Get HOLD, then come
            back to this page and tap Open the event.
          </>
        ) : carried ? (
          <>
            Split the bill and pay your share in dollars, straight from your
            phone. Get HOLD, then come back to this page and tap Open the group.
          </>
        ) : (
          <>
            Your friend invited you to join HOLD, the gasless stablecoin wallet.
            Sign up and swap $50 or more within 14 days, and you both get HiPoints.
          </>
        )}
      </p>
      {carried ? (
        <a
          href={carried.link}
          style={{
            padding: "14px 28px",
            backgroundColor: "#FFB703",
            borderRadius: 14,
            color: "#0A1929",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          {carried.kind === "event" ? "Open the event" : "Open the group"}
        </a>
      ) : (
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
          Redirecting to the app...
        </p>
      )}
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
