import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Tokenized Stocks — Investment Risk Disclosure",
  description:
    "The risks of buying, holding, and selling tokenized stocks in HOLD: market, issuer, counterparty, liquidity, technology, and regulatory risk. You may lose your entire investment.",
  alternates: { canonical: "https://hihodl.xyz/legal/stocks-risk" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/stocks-risk",
    siteName: "HOLD",
    title: "Tokenized Stocks — Investment Risk Disclosure | HOLD",
    description:
      "The risks of buying, holding, and selling tokenized stocks in HOLD. You may lose your entire investment.",
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
    title: "Tokenized Stocks — Investment Risk Disclosure | HOLD",
    description:
      "The risks of buying, holding, and selling tokenized stocks in HOLD. You may lose your entire investment.",
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
