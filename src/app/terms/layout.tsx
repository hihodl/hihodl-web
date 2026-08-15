import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "HOLD Terms of Service - Read our terms and conditions for using HOLD wallet services.",
  alternates: { canonical: "https://hihodl.xyz/terms" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/terms",
    siteName: "HOLD",
    title: "Terms of Service | HOLD",
    description: "HOLD Terms of Service - Read our terms and conditions for using HOLD wallet services.",
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
    title: "Terms of Service | HOLD",
    description: "HOLD Terms of Service - Read our terms and conditions for using HOLD wallet services.",
    images: [OG_URL],
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

