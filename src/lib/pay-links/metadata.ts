import type { Metadata } from "next";

import type { PayPreview } from "./og-copy";

/**
 * A pay page's metadata: private (noindex, no referrer, no canonical), with
 * the link card a chat app draws when the link is shared.
 *
 * The card's words come from ./og-copy (who you pay, what and how much, never
 * a crypto word); without a preview it is the plain HOLD card. The image is
 * always the static HOLD banner, drawn large: it is 1200x630, the 1.91:1 a
 * `summary_large_image` card and WhatsApp's wide preview expect.
 */
const BANNER = { url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD", type: "image/png" };
const PLAIN = { title: "HOLD Pay", description: "Pay or get paid easily with payment links. Fast, secure and no account needed." };

export function payPageMetadata(title: string, preview?: PayPreview & { lang?: string }): Metadata {
  const card = preview ?? PLAIN;
  return {
    title,
    description: card.description,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    // The layout's canonical points at the home page; a private page names none.
    alternates: { canonical: null },
    openGraph: {
      type: "website",
      siteName: "HOLD",
      title: card.title,
      description: card.description,
      locale: preview?.lang?.replace("-", "_"),
      images: [BANNER],
    },
    twitter: {
      card: "summary_large_image",
      site: "@hiihodl",
      title: card.title,
      description: card.description,
      images: [BANNER.url],
    },
  };
}
