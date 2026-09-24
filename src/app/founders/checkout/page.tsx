import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { Checkout } from "@/components/founders/Checkout";

export const metadata: Metadata = {
  title: "Your order",
  description: "The status of an existing HOLD order.",
  // An order page has nothing to offer a search engine and everything to lose
  // from a stale order reference being indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[0-9a-z]{26}$/;

/**
 * The Founder Pass is closed to new buyers (24 Sep 2026). This URL survives
 * only as the status page of an order that already exists: the Stripe
 * success and cancel URLs and the on-chain payment screen all carry
 * `?order=<reference>`, and a buyer who paid or is mid payment must still see
 * it settle. Without a reference there is nothing to show, so it goes home.
 */
export default function FounderOrderPage({
  searchParams,
}: {
  searchParams: { order?: string | string[] };
}) {
  const order = typeof searchParams.order === "string" ? searchParams.order : "";
  if (!REFERENCE_RE.test(order)) permanentRedirect("/");

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
