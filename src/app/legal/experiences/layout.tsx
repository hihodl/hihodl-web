import type { Metadata } from "next";

/**
 * Metadata for /legal/experiences. The page is a client component (LegalDoc), so
 * the title lives here; the URL is opened from the app's experience screen.
 */

const OG_URL = "https://hihodl.xyz/banner-social.png";
const DESCRIPTION =
  "The terms for activities, tours and attraction tickets found in HOLD: who sells you the ticket, prices, cancellations and refunds, and what happens on the day.";

export const metadata: Metadata = {
  title: "Experience Terms",
  description: DESCRIPTION,
  alternates: { canonical: "https://hihodl.xyz/legal/experiences" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/experiences",
    siteName: "HOLD",
    title: "Experience Terms | HOLD",
    description: DESCRIPTION,
    images: [{ url: OG_URL, width: 1200, height: 630, alt: "HOLD", type: "image/png" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihold",
    creator: "@hiihold",
    title: "Experience Terms | HOLD",
    description: DESCRIPTION,
    images: [OG_URL],
  },
};

export default function ExperienceTermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
