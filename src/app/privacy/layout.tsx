import type { Metadata } from "next";

const OG_URL = "https://www.hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "HIHODL Privacy Policy - Learn how we collect, use, and protect your personal information.",
  alternates: { canonical: "https://www.hihodl.xyz/privacy" },
  openGraph: {
    type: "website",
    url: "https://www.hihodl.xyz/privacy",
    siteName: "HIHODL",
    title: "Privacy Policy | HIHODL",
    description: "HIHODL Privacy Policy - Learn how we collect, use, and protect your personal information.",
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
    title: "Privacy Policy | HIHODL",
    description: "HIHODL Privacy Policy - Learn how we collect, use, and protect your personal information.",
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

