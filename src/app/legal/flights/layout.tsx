import type { Metadata } from "next";

/**
 * Metadata for /legal/flights. The page is a client component (LegalDoc), so the
 * title lives here; the URL is opened from the app's checkout mid-purchase.
 */

const OG_URL = "https://hihodl.xyz/banner-social.png";
const DESCRIPTION =
  "The terms for flights booked in HOLD: who flies you, what you pay us, changes, cancellations and refunds, and what you must check before you fly.";

export const metadata: Metadata = {
  title: "Flight Terms",
  description: DESCRIPTION,
  alternates: { canonical: "https://hihodl.xyz/legal/flights" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/flights",
    siteName: "HOLD",
    title: "Flight Terms | HOLD",
    description: DESCRIPTION,
    images: [{ url: OG_URL, width: 1200, height: 630, alt: "HOLD", type: "image/png" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "Flight Terms | HOLD",
    description: DESCRIPTION,
    images: [OG_URL],
  },
};

export default function FlightTermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
