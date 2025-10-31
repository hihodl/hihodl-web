// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hihodl.xyz"),
  title: {
    default: "HIHODL",
    template: "%s | HIHODL",
  },
  description:
    "Self-custodial. Multichain. Gasless. Transparent. HIHODL is the wallet that makes crypto feel as simple as Fintech.",
  alternates: {
    canonical: "https://www.hihodl.xyz",
  },
  openGraph: {
    title: "HIHODL — The Next Crypto Wallet That Feels Like Fintech",
    description:
      "Self-custodial. Multichain. Gasless. Transparent. HiHODL is the wallet that makes crypto feel as simple as Fintech.",
    url: "https://www.hihodl.xyz",
    siteName: "HIHODL",
    images: [
      {
        url: "https://www.hihodl.xyz/banner-social.jpg?v=3",
        width: 1200,
        height: 630,
        alt: "HIHODL Wallet — Don't Save. HODL.",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",    
    creator: "@hihodl",
    title: "HIHODL — The Next-Gen Crypto Wallet That Feels Like Fintech",
    description:
      "Self-custodial. Multichain. Gasless. Transparent. HIHODL makes crypto feel as simple as Revolut.",
    images: ["https://www.hihodl.xyz/banner-social.jpg?v=3"],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Metas OG explícitas para width/height (algunos scrapers son tiquismiquis) */}
        <meta property="og:image" content="https://www.hihodl.xyz/banner-social.png?v=3" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}