import type { Metadata } from "next";

import { Footer } from "@/components/site/Footer";
import { TopNav } from "@/components/site/TopNav";
import { EventsStrip } from "@/components/site/spaces/EventsStrip";
import { ForBrands, HowItWorks, SpacesClose, SpacesFaq } from "@/components/site/spaces/sections";
import { StoryHero, StoryScenes } from "@/components/site/spaces/Story";
import { productUrl } from "@/lib/app/paths";

/**
 * hihodl.xyz: HOLD Spaces, told from the creator's side as a story in images
 * (see components/site/spaces/scenes.ts), then how to start, brands, events and
 * a small FAQ. The product behind
 * the login is app.hihodl.xyz, and every "Create your space" goes there. The
 * money app that used to be this page lives at /money, section ids intact.
 *
 * Rebuilt every five minutes: the events strip reads the live event pages.
 */
export const revalidate = 300;

const TITLE = "HOLD Spaces: this is your hook";
const DESCRIPTION =
  "Turn a suitcase, a dress or a photo into ad space. Set your spots and prices, post one link, and brands pay you per spot in USDC, straight to your wallet.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Next replaces a nested openGraph/twitter object whole, so the image is restated.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "HOLD",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@hiihodl",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/banner-social.png"],
  },
};

export default function Home() {
  const createHref = productUrl("/spaces");

  return (
    <>
      <TopNav cta={{ label: "Create your space", href: createHref }} />
      <main>
        <StoryHero createHref={createHref} />
        <StoryScenes />
        <HowItWorks createHref={createHref} />
        <ForBrands />
        <EventsStrip createHref={createHref} />
        <SpacesFaq />
        <SpacesClose createHref={createHref} />
      </main>
      <Footer />
    </>
  );
}
