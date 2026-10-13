import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Partner Program Terms",
  description:
    "The rules of HOLD Partners: who is your traveller, what you earn on their bookings, when it is paid, and when it comes back.",
  alternates: { canonical: "https://hihodl.xyz/legal/partner-terms" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/partner-terms",
    siteName: "HOLD",
    title: "Partner Program Terms | HOLD",
    description:
      "Who is your traveller, what you earn, when it is paid, and when it comes back.",
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
    title: "Partner Program Terms | HOLD",
    description:
      "Who is your traveller, what you earn, when it is paid, and when it comes back.",
    images: [OG_URL],
  },
};

export default function PartnerTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
