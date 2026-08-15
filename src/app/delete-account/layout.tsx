import type { Metadata } from "next";

const OG_URL = "https://hihodl.xyz/banner-social.png";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description:
    "How to permanently delete your HOLD account and the data associated with it.",
  alternates: { canonical: "https://hihodl.xyz/delete-account" },
  robots: {
    index: true,
    follow: false,
  },
  openGraph: {
    type: "website",
    url: "https://hihodl.xyz/delete-account",
    siteName: "HOLD",
    title: "Delete Your Account | HOLD",
    description:
      "How to permanently delete your HOLD account and the data associated with it.",
    images: [
      {
        url: OG_URL,
        width: 1200,
        height: 630,
        alt: "HOLD Wallet",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    creator: "@hiihodl",
    title: "Delete Your Account | HOLD",
    description:
      "How to permanently delete your HOLD account and the data associated with it.",
    images: [OG_URL],
  },
};

export default function DeleteAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
