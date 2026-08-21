import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Referral Program Terms",
  description:
    "The rules of the HOLD referral program: what qualifies, what each side earns in HiPoints, the caps, and when a reward expires.",
  alternates: { canonical: "https://hihodl.xyz/legal/referral-terms" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/referral-terms",
    siteName: "HOLD",
    title: "Referral Program Terms | HOLD",
    description:
      "What qualifies a referral, what each side earns, the caps, and when a reward expires.",
    images: [
      {
        url: OG_URL,
        width: 1200,
        height: 630,
        alt: "HOLD — Earn globally, live locally",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "Referral Program Terms | HOLD",
    description:
      "What qualifies a referral, what each side earns, the caps, and when a reward expires.",
    images: [OG_URL],
  },
};

export default function ReferralTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
