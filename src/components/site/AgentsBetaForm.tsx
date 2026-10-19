"use client";

import { useState } from "react";

import { API_BASE } from "@/lib/agents/reference";

/**
 * /agents: ask to join the AI agents beta with a HOLD @handle.
 *
 * Posts to POST /api/v1/agents-beta, which stamps the account once and tells
 * the team; people are let in in batches. The backend answers `received` for
 * any handle shaped like one, whether or not it is somebody, so the page says
 * the same thing every time and never confirms who has HOLD.
 */
export function AgentsBetaForm() {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "bad_handle" | "failed">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/v1/agents-beta`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
        credentials: "omit",
      });
      if (res.status === 400) return setStatus("bad_handle");
      setStatus(res.ok ? "sent" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-8 inline-flex items-center gap-2 px-5 py-4 rounded-pill bg-amber/15 border border-amber/30 text-amber font-medium">
        <span aria-hidden>✓</span>
        <span>Got it. When you are in, AI assistants shows up in HOLD under Settings.</span>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="agents-beta-handle" className="sr-only">
          Your HOLD @handle
        </label>
        <input
          id="agents-beta-handle"
          type="text"
          name="handle"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            if (status !== "sending") setStatus("idle");
          }}
          required
          maxLength={51}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="@yourhandle"
          disabled={status === "sending"}
          className="flex-1 px-5 py-4 rounded-pill bg-white/[0.04] border border-[color:var(--color-hairline)] text-text placeholder:text-text-faint focus:outline-none focus:border-moonlight transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "sending" || !handle.trim()}
          className="inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Ask to join"}
        </button>
      </form>
      {status === "bad_handle" ? (
        <p className="mt-3 text-small text-text-muted">That does not look like a HOLD @handle. You find yours in the app, under your name.</p>
      ) : null}
      {status === "failed" ? (
        <p className="mt-3 text-small text-text-muted">
          That did not go through. Try again, or write to{" "}
          <a href="mailto:hello@hihodl.xyz" className="text-text underline hover:text-amber">
            hello@hihodl.xyz
          </a>{" "}
          with your @handle.
        </p>
      ) : null}
      <p className="mt-4 text-small text-text-faint">
        New to HOLD? Get the app first: the beta is for HOLD accounts.
      </p>
    </div>
  );
}
