import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { HomeFooter, HomeNav } from "@/components/site/home/Chrome";
import { Hero } from "@/components/site/home/Hero";
import { HiFirst } from "@/components/site/home/HiFirst";
import { Changes, Faq, HowItWorks, Inside, People, Private, Ready } from "@/components/site/home/Sections";

/**
 * The new homepage, built on Persona's product page: a gallery with the
 * account's sheet under it, three steps, who it is for, privacy, what
 * changes, questions, what is inside, one closing banner.
 *
 * A light page like Persona's, with the app's colours as the accents (see
 * home/ui.tsx) and the app's typeface, Nunito (hihodl-wallet src/theme/fonts.ts).
 * Its copy comes from the app's own strings, never from the old pages.
 *
 * Lives under /lab until it replaces the homepage, so it is not indexed.
 */
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HOLD, the new home (preview)",
  robots: { index: false, follow: false },
};

export default function HomePreview() {
  return (
    <div className={`${nunito.className} bg-white`}>
      <HomeNav />
      <main>
        <Hero />
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
