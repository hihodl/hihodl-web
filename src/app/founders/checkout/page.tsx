import type { Metadata } from "next";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { Checkout } from "@/components/founders/Checkout";

export const metadata: Metadata = {
  title: "Founder Pass — checkout",
  description: "Complete your HOLD Founder Pass.",
  alternates: { canonical: "/founders/checkout" },
  // A checkout has nothing to offer a search engine and everything to lose from
  // a stale order reference being indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function FounderCheckoutPage() {
  return (
    <>
      <TopNav />
      <main>
        <Checkout />
      </main>
      <Footer />
    </>
  );
}
