import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = "https://hihodl.xyz";
const OG_URL = `${SITE}/banner-social.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "HOLD — Earn globally, live locally",
    template: "%s | HOLD",
  },
  description:
    "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "HOLD",
    title: "HOLD — Earn globally, live locally",
    description:
      "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
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
    title: "HOLD — Earn globally, live locally",
    description:
      "One account for people who earn in one country and live in another. Get paid in minutes, earn on the balance, invest and spend — you hold the keys.",
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
    <html lang="en" className="bg-abyss text-text antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800;900&family=Source+Serif+4:ital,opsz,wght@1,8..60,300&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-abyss text-text min-h-dvh">{children}</body>
    </html>
  );
}
