import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";

import { HomeFooter, HomeNav } from "@/components/site/home/Chrome";
import { HeroShrink } from "@/components/site/home/HeroShrink";
import { Accounts } from "@/components/site/home/Accounts";
import { Tour } from "@/components/site/home/Tour";
import { HiFirst } from "@/components/site/home/HiFirst";
import { Changes, Faq, HowItWorks, Inside, People, Private, Ready } from "@/components/site/home/Sections";

/**
 * The new homepage: a full screen photo that closes into the account as you
 * scroll (Revolut's opening), the account three ways, a card to tap around,
 * then Persona's order: three steps, who it is for, privacy, what changes,
 * questions, what is inside, one closing banner.
 *
 * A light page like Persona's, with the app's colours as the accents (see
 * home/ui.tsx) and Inter Tight: sharp, light weights, no heavy bold (Alex, 23-oct).
 * Its copy comes from the app's own strings, never from the old pages.
 *
 * Lives under /lab until it replaces the homepage, so it is not indexed.
 */
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HOLD, the new home (preview)",
  robots: { index: false, follow: false },
};

export default function HomePreview() {
  return (
    <div className={`${interTight.className} bg-white`}>
      <HomeNav />
      <main>
        <HeroShrink />
        <Accounts />
        <Tour />
        <HowItWorks />
        <People />
        <Private />
        <Changes />
        <Faq />
        <Inside />
        <Ready />
      </main>
      <HomeFooter />
      <HiFirst />
    </div>
  );
}
