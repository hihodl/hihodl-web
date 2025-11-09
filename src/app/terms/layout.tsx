import type { Metadata } from "next";

const OG_URL = "https://www.hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "HIHODL Terms of Service - Read our terms and conditions for using HIHODL wallet services.",
  alternates: { canonical: "https://www.hihodl.xyz/terms" },
  openGraph: {
    type: "website",
    url: "https://www.hihodl.xyz/terms",
    siteName: "HIHODL",
    title: "Terms of Service | HIHODL",
    description: "HIHODL Terms of Service - Read our terms and conditions for using HIHODL wallet services.",
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
    title: "Terms of Service | HIHODL",
    description: "HIHODL Terms of Service - Read our terms and conditions for using HIHODL wallet services.",
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

