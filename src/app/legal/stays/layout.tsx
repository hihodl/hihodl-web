import type { Metadata } from "next";

/**
 * Metadata for /legal/stays. The page is a client component (LegalDoc), so the
 * title lives here; the URL is opened from the app's checkout mid-purchase.
 */

const OG_URL = "https://hihodl.xyz/banner-social.png";
const DESCRIPTION =
  "The terms for stays booked in HOLD: who provides the room, cancellation, refunds, local taxes and check-in.";

export const metadata: Metadata = {
  title: "Stay Terms",
  description: DESCRIPTION,
  alternates: { canonical: "https://hihodl.xyz/legal/stays" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/stays",
    siteName: "HOLD",
    title: "Stay Terms | HOLD",
    description: DESCRIPTION,
    images: [{ url: OG_URL, width: 1200, height: 630, alt: "HOLD", type: "image/png" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "Stay Terms | HOLD",
    description: DESCRIPTION,
    images: [OG_URL],
  },
};

export default function StayTermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
