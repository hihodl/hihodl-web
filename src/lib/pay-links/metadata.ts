import type { Metadata } from "next";

import type { PayPreview } from "./og-copy";

/**
 * A pay page's metadata: private (noindex, no referrer, no canonical), with
 * the link card a chat app draws when the link is shared.
 *
 * The card's words come from ./og-copy (who you pay, what and how much, never
 * a crypto word); without a preview it is the plain HOLD card. `image` is the
 * link's own card (/api/og/pay/<code>), else the static HOLD banner.
 */
const BANNER = { url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD", type: "image/png" };
const PLAIN = { title: "Pay with HOLD", description: "Fast and secure. No account needed." };

export function payPageMetadata(title: string, preview?: PayPreview & { imageUrl?: string | null; lang?: string }): Metadata {
  const card = preview ?? PLAIN;
  const image = preview?.image && preview.imageUrl ? { url: preview.imageUrl, width: 1200, height: 630, alt: preview.title, type: "image/png" } : BANNER;
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
      images: [image],
    },
    twitter: {
      card: image === BANNER ? "summary" : "summary_large_image",
      site: "@hiihodl",
      title: card.title,
      description: card.description,
      images: [image.url],
    },
  };
}
