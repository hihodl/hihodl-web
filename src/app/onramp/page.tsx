import type { Metadata } from "next";

import { OnrampMount } from "./OnrampMount";

/**
 * /onramp — Stripe's crypto onramp inside the HOLD app (21-Oct-2026).
 *
 * The wallet opens this page in its own screen with the session's client
 * secret and our publishable key in the fragment, which no server or Referer
 * ever sees, and the page wipes it on read. Stripe says the client secret
 * exposes the wallet address and must not be logged
 * (https://docs.stripe.com/crypto/onramp/embedded). Nothing is injected, so
 * iOS keeps Apple Pay available in the web view. See OnrampMount.
 *
 * Stripe sells the USDC, runs the KYC and delivers to the user's own address.
 * This page only mounts their widget and tells the app when the session moves.
 * The domain has to be on Stripe's onramp allowlist (Dashboard, Crypto onramp).
 */

export const metadata: Metadata = {
  title: "Add money",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OnrampPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#070C12]">
      <OnrampMount />
    </main>
  );
}
