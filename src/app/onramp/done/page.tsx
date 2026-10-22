import type { Metadata } from "next";

/**
 * /onramp/done — where the onramp page goes once Stripe settles the session.
 * Inside the app this load is caught and never shown; the app takes over with
 * its own screen. A browser that somehow lands here gets one honest line.
 */

export const metadata: Metadata = {
  title: "Add money",
  robots: { index: false, follow: false },
};

export default function OnrampDonePage() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#070C12]">
      <p className="px-6 pt-24 text-center text-base text-[#94a3b8]">You can go back to HOLD now.</p>
    </main>
  );
}
