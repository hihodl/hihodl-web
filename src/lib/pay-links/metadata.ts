import type { Metadata } from "next";

import type { PayPreview } from "./og-copy";

/**
 * A pay page's metadata: private (noindex, no referrer, no canonical), with
 * the link card a chat app draws when the link is shared.
 *
 * The card's words come from ./og-copy (who you pay, what and how much, never
 * a crypto word); without a preview it is the plain HOLD card. The image is
 * always the HOLD banner, drawn large the way revolut.me's is: the person's
 * name is in the title, and nothing the owner chose is ever drawn as a picture.
 */
const BANNER = { url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD", type: "image/png" };
const PLAIN = { title: "Pay with HOLD", description: "Instant payments. Beautifully simple." };

/**
 * The Smart App Banner that also names the HOLD App Clip. On a page that
 * carries it, iOS shows the App Clip card in Safari, and a link to the page
 * shared in Messages opens the App Clip for anyone without HOLD installed
 * (Apple: "Supporting invocations from your website and the Messages app").
 * The card only appears once an app version with the App Clip is live.
 */
export const APP_CLIP_BANNER =
  "app-id=6755203065, app-clip-bundle-id=com.sayhihodl.hihodlyes.Clip, app-clip-display=card";

export function payPageMetadata(
  title: string,
  preview?: PayPreview & { lang?: string },
  opts: { appClip?: boolean } = {},
): Metadata {
  const card = preview ?? PLAIN;
  return {
    ...(opts.appClip ? { other: { "apple-itunes-app": APP_CLIP_BANNER } } : {}),
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
