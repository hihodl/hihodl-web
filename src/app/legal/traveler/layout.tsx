import type { Metadata } from "next";

const OG_URL = "https://www.hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  title: "Traveler — How We Calculate Visa & Tax Days",
  description:
    "How HIHODL's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Traveler is an informational tool, not tax or immigration advice.",
  alternates: { canonical: "https://www.hihodl.xyz/legal/traveler" },
  openGraph: {
    type: "website",
    url: "https://www.hihodl.xyz/legal/traveler",
    siteName: "HIHODL",
    title: "Traveler — How We Calculate Visa & Tax Days | HIHODL",
    description:
      "How HIHODL's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Informational only, not advice.",
    images: [
      {
        url: OG_URL,
        width: 1200,
        height: 630,
        alt: "HIHODL Wallet — Don't Save. HODL.",
        type: "image/jpeg",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "Traveler — How We Calculate Visa & Tax Days | HIHODL",
    description:
      "How HIHODL's Traveler feature estimates visa allowances and tax-residency days, the data behind it, and its limits. Informational only, not advice.",
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
