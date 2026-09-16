import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Traveler — How We Calculate Visa & Tax Days",
  description:
    "How HOLD's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Traveler is an informational tool, not tax or immigration advice.",
  alternates: { canonical: "https://hihodl.xyz/legal/traveler" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/traveler",
    siteName: "HOLD",
    title: "Traveler — How We Calculate Visa & Tax Days | HOLD",
    description:
      "How HOLD's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Informational only, not advice.",
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
    title: "Traveler — How We Calculate Visa & Tax Days | HOLD",
    description:
      "How HOLD's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Informational only, not advice.",
    images: [OG_URL],
  },
};

export default function TravelerLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
