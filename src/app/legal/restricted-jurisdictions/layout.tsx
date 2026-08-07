import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  title: "Tokenized Stocks — Restricted Jurisdictions",
  description:
    "The jurisdictions where HIHODL does not offer tokenized stocks: the United States, Canada, the United Kingdom, Australia, and sanctioned regions.",
  alternates: { canonical: "https://hihodl.xyz/legal/restricted-jurisdictions" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/restricted-jurisdictions",
    siteName: "HIHODL",
    title: "Tokenized Stocks — Restricted Jurisdictions | HIHODL",
    description:
      "The jurisdictions where HIHODL does not offer tokenized stocks: the US, Canada, the UK, Australia, and sanctioned regions.",
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
    title: "Tokenized Stocks — Restricted Jurisdictions | HIHODL",
    description:
      "The jurisdictions where HIHODL does not offer tokenized stocks: the US, Canada, the UK, Australia, and sanctioned regions.",
    images: [OG_URL],
  },
};

export default function RestrictedJurisdictionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
