import type { Metadata } from "next";

/**
 * Metadata for /legal/esim.
 *
 * The page itself is a client component, so it cannot export `metadata` — which
 * is why it was serving the site-wide default title. That matters more here than
 * on a normal legal page: this URL is linked from the eSIM checkout inside the
 * app, so it is opened by someone mid-purchase who wants to know who they are
 * buying from, and the tab said "Earn globally, live locally".
 */

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "eSIM Terms of Sale",
  description:
    "The terms of sale for HOLD data plans: who the seller is, what a data-only eSIM does and does not do, when a plan starts, and when you get your money back.",
  alternates: { canonical: "https://hihodl.xyz/legal/esim" },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/legal/esim",
    siteName: "HOLD",
    title: "eSIM Terms of Sale | HOLD",
    description:
      "Who the seller is, what a data-only eSIM does and does not do, when a plan starts, and when you get your money back.",
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
    title: "eSIM Terms of Sale | HOLD",
    description:
      "Who the seller is, what a data-only eSIM does and does not do, when a plan starts, and when you get your money back.",
    images: [OG_URL],
  },
};

export default function EsimLegalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
