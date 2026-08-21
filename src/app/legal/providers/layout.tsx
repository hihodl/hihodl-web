import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Service Providers — Who We Work With",
  description:
    "The regulated financial institutions, verification partners, commercial suppliers, and technical infrastructure behind HOLD, and what data each one receives.",
  alternates: { canonical: "https://hihodl.xyz/legal/providers" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/providers",
    siteName: "HOLD",
    title: "Service Providers — Who We Work With | HOLD",
    description:
      "The regulated financial institutions, verification partners, commercial suppliers, and technical infrastructure behind HOLD, and what data each one receives.",
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
    title: "Service Providers — Who We Work With | HOLD",
    description:
      "The regulated financial institutions, verification partners, commercial suppliers, and technical infrastructure behind HOLD.",
    images: [OG_URL],
  },
};

export default function ProvidersLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
