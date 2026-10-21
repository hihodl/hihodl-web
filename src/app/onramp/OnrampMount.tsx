"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts Stripe's embedded onramp with what the wallet put in the fragment.
 *
 * ── Why the fragment, and nothing injected ──
 * On iOS a web view loses Apple Pay once the app injects scripts into it, so
 * the app passes nothing by injection and listens to nothing by messages. The
 * fragment (#cs=…&pk=…) never reaches a server or a Referer, and it is wiped
 * from the address the moment it is read. Analytics skip /onramp entirely.
 *
 * ── How the app learns the outcome ──
 * It polls our backend for the session while this page is open. When Stripe
 * reports a settled or paid session here, the page also moves to
 * /onramp/done, which the app catches as the faster signal.
 *
 * The scripts load from Stripe's own domains, as Stripe requires ("Don't
 * include the scripts in a bundle or host a copy yourself").
 */

type OnrampEvent = { payload?: { session?: { id?: string; status?: string } } };
interface OnrampSession {
  addEventListener: (type: string, fn: (e: OnrampEvent) => void) => OnrampSession;
  mount: (selector: string | HTMLElement) => void;
}

declare global {
  interface Window {
    StripeOnramp?: (publishableKey: string) => {
      createSession: (opts: { clientSecret: string; appearance?: { theme: "dark" | "light" } }) => OnrampSession;
    };
  }
}

const SCRIPTS = ["https://js.stripe.com/endive/stripe.js", "https://crypto-js.stripe.com/crypto-onramp-outer.js"];
const SECRET = /^cos_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/;
const KEY = /^pk_(live|test)_[A-Za-z0-9]+$/;

function load(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
}

const DONE = new Set(["fulfillment_processing", "fulfillment_complete", "rejected"]);

function readFragment(): { clientSecret: string; publishableKey: string } {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  // Out of the address, history and any later read at once.
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  return { clientSecret: params.get("cs") ?? "", publishableKey: params.get("pk") ?? "" };
}

export function OnrampMount() {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"mounting" | "outside" | "failed">("mounting");

  useEffect(() => {
    const { clientSecret, publishableKey } = readFragment();
    if (!SECRET.test(clientSecret) || !KEY.test(publishableKey)) {
      // Opened as a plain web page: nothing to buy here without the app.
      setState("outside");
      return;
    }

    let gone = false;
    (async () => {
      try {
        for (const src of SCRIPTS) await load(src);
        if (gone || !host.current || !window.StripeOnramp) return;
        window
          .StripeOnramp(publishableKey)
          .createSession({ clientSecret, appearance: { theme: "dark" } })
          .addEventListener("onramp_session_updated", (e) => {
            const status = e?.payload?.session?.status ?? "";
            if (DONE.has(status)) window.location.replace(`/onramp/done?status=${encodeURIComponent(status)}`);
          })
          .mount(host.current);
      } catch {
        setState("failed");
      }
    })();
    return () => {
      gone = true;
    };
  }, []);

  if (state === "outside") {
    return (
      <p className="px-6 pt-24 text-center text-base text-[#94a3b8]">
        Open Add money in the HOLD app to buy USDC with a card.
      </p>
    );
  }
  if (state === "failed") {
    return (
      <p className="px-6 pt-24 text-center text-base text-[#94a3b8]">
        Stripe could not load. Close this and try again.
      </p>
    );
  }
  return <div ref={host} className="mx-auto w-full max-w-[480px]" />;
}
