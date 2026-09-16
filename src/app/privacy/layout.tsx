import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "HOLD Privacy Policy - Learn how we collect, use, and protect your personal information.",
  alternates: { canonical: "https://hihodl.xyz/privacy" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/privacy",
    siteName: "HOLD",
    title: "Privacy Policy | HOLD",
    description: "HOLD Privacy Policy - Learn how we collect, use, and protect your personal information.",
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
    title: "Privacy Policy | HOLD",
    description: "HOLD Privacy Policy - Learn how we collect, use, and protect your personal information.",
    images: [OG_URL],
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

