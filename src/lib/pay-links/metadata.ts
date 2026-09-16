import type { Metadata } from "next";

/**
 * The only metadata a pay page ever has.
 *
 * Generic on purpose. A pay link's title and note are written by whoever made
 * it, and a link card that repeats them ("Wallet recovery fee", in our name and
 * on our domain) is exactly what a phishing post needs. So the title, the
 * description and the image are the same for every link, no user text reaches
 * them, and there is no per-link image route at all.
 */
export function payPageMetadata(title: string): Metadata {
  const description = "Pay in USDC from any wallet. Only pay people you know.";
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    // The layout's canonical points at the home page; a private page names none.
    alternates: { canonical: null },
    openGraph: {
      type: "website",
      siteName: "HOLD",
      title: "A HOLD pay link",
      description,
      images: [{ url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD", type: "image/png" }],
    },
    twitter: {
      card: "summary",
      site: "@hiihodl",
      title: "A HOLD pay link",
      description,
      images: ["/banner-social.png"],
    },
  };
}
