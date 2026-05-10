"use client";

import { useState } from "react";
import { setStoredToken } from "@/lib/clientAuth";

/**
 * Lightweight email-only signup for the homepage "Notify me" CTA.
 *
 * Posts to /api/waitlist/join with displayName derived from the email prefix
 * (the homepage UX intentionally only asks for email; the full waitlist with
 * referral codes lives on a separate page that uses JoinWaitlist.tsx).
 *
 * Was previously a server-rendered <form action="/api/newsletter/subscribe">
 * which 404'd because that endpoint doesn't exist — broken primary CTA on the
 * homepage. Now POSTs to the real endpoint and shows inline success/error
 * without a full page navigation.
 */
export function NotifyMeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);

    try {
      // Derive a displayName from the email prefix — the homepage UX only
      // collects email, but the API requires both fields. Cap at 50 chars so
      // we never push something pathological into the welcome email render.
      const namePart = email.split("@")[0]?.slice(0, 50) || "there";

      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName: namePart }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Generic message — the API logs the detail server-side.
        throw new Error("Could not save your signup. Try again in a moment.");
      }
      // Persist token so the user can later view their referral stats /
      // milestones without re-entering their email (those endpoints gate
      // on a Bearer token returned here).
      if (data.sessionToken) {
        setStoredToken(data.sessionToken);
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-12 max-w-md mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-5 py-4 rounded-pill bg-amber/15 border border-amber/30 text-amber font-medium">
          <span className="text-lg">✓</span>
          <span>You&apos;re in. Check your inbox for the welcome email.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 max-w-md mx-auto">
      <form
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={120}
          placeholder="your@email.com"
          disabled={status === "loading"}
          className="flex-1 px-5 py-4 rounded-pill bg-white/[0.04] border border-[color:var(--color-hairline)] text-text placeholder:text-text-faint focus:outline-none focus:border-moonlight transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || !email}
          className="inline-flex items-center justify-center px-6 py-4 rounded-pill bg-amber text-text-on-amber font-medium hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        >
          {status === "loading" ? "Joining..." : "Notify me"}
        </button>
      </form>
      {status === "error" && errorMsg && (
        <div
          role="alert"
          className="mt-3 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-sm text-red-400 text-center"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
