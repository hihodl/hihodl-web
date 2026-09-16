import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Tokenized Stocks — Product Disclosure",
  description:
    "How tokenized stocks work in HOLD: a non-custodial, peer-to-pool product you execute yourself. HOLD is not a broker or issuer. Not available to US persons or in restricted regions.",
  alternates: { canonical: "https://hihodl.xyz/legal/tokenized-stocks" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/tokenized-stocks",
    siteName: "HOLD",
    title: "Tokenized Stocks — Product Disclosure | HOLD",
    description:
      "How tokenized stocks work in HOLD: a non-custodial, peer-to-pool product you execute yourself. HOLD is not a broker or issuer.",
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
    title: "Tokenized Stocks — Product Disclosure | HOLD",
    description:
      "How tokenized stocks work in HOLD: a non-custodial, peer-to-pool product you execute yourself. HOLD is not a broker or issuer.",
    images: [OG_URL],
  },
};

export default function TokenizedStocksLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
