import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  title: "Tokenized Stocks — Investment Risk Disclosure",
  description:
    "The risks of buying, holding, and selling tokenized stocks in HIHODL: market, issuer, counterparty, liquidity, technology, and regulatory risk. You may lose your entire investment.",
  alternates: { canonical: "https://hihodl.xyz/legal/stocks-risk" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/stocks-risk",
    siteName: "HIHODL",
    title: "Tokenized Stocks — Investment Risk Disclosure | HIHODL",
    description:
      "The risks of buying, holding, and selling tokenized stocks in HIHODL. You may lose your entire investment.",
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
    title: "Tokenized Stocks — Investment Risk Disclosure | HIHODL",
    description:
      "The risks of buying, holding, and selling tokenized stocks in HIHODL. You may lose your entire investment.",
    images: [OG_URL],
  },
};

export default function StocksRiskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
