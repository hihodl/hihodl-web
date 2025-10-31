// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

// Open Graph image URL - debe ser absoluta y accesible públicamente
// La imagen está en public/banner-social.jpg
const OG_URL = "https://www.hihodl.xyz/banner-social.jpg";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hihodl.xyz"),
  title: {
    default: "HIHODL",
    template: "%s | HIHODL",
  },
  description:
    "Self-custodial. Multichain. Gasless. Transparent. HIHODL is the wallet that makes crypto feel as simple as Fintech.",
  alternates: { canonical: "https://www.hihodl.xyz" },
  openGraph: {
    type: "website",
    url: "https://www.hihodl.xyz",
    siteName: "HIHODL",
    title: "HIHODL — The Next Crypto Wallet That Feels Like Fintech",
    description:
      "Self-custodial. Multichain. Gasless. Transparent. HIHODL is the wallet that makes crypto feel as simple as Fintech.",
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
    title: "HIHODL — The Next-Gen Crypto Wallet That Feels Like Fintech",
    description:
      "Self-custodial. Multichain. Gasless. Transparent. HIHODL makes crypto feel as simple as Fintech.",
    images: [OG_URL],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* 🔴 Elimina metas OG manuales para evitar duplicados */}
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