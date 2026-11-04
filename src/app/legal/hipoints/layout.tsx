import type { Metadata } from "next";

/**
 * Metadata for /legal/hipoints. The page is a client component (LegalDoc), so the
 * title lives here; the URL is opened from the app's checkout mid-purchase.
 */

const OG_URL = "https://hihodl.xyz/banner-social.png";
const DESCRIPTION =
  "How HiPoints work in HOLD: how you earn them, what they are worth, where you spend them, and when they expire.";

export const metadata: Metadata = {
  title: "HiPoints Terms",
  description: DESCRIPTION,
  alternates: { canonical: "https://hihodl.xyz/legal/hipoints" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/hipoints",
    siteName: "HOLD",
    title: "HiPoints Terms | HOLD",
    description: DESCRIPTION,
    images: [{ url: OG_URL, width: 1200, height: 630, alt: "HOLD", type: "image/png" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "HiPoints Terms | HOLD",
    description: DESCRIPTION,
    images: [OG_URL],
  },
};

export default function HiPointsTermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
