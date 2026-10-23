import type { Metadata } from "next";
import Image from "next/image";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { DownloadLink } from "@/components/site/DownloadLink";
import { Body, Chapter, Eyebrow, Title } from "@/components/site/chapters/Chapter";
import { GlassBanner } from "@/components/site/chapters/GlassBanner";
import { PeopleCarousel } from "@/components/site/chapters/PeopleCarousel";
import { HiFirst } from "@/components/site/chapters/HiFirst";
import { StoreBadges } from "@/components/site/chapters/StoreBadges";
import {
  AccountProof,
  GroupProof,
  HiChatProof,
  SavingsProof,
  SplitProof,
} from "@/components/site/chapters/Proof";
import { DOWNLOAD_ANCHOR } from "@/lib/appLinks";
import { FREE_ALLOWANCE, usd } from "@/lib/rates.config";

/**
 * The homepage told as chapters of people, not products: a photo per chapter
 * and the app's own sheet rising over it.
 *
 * The order is the positioning. HOLD is a money app first, so the money comes
 * first; then what Hi does for one person on their own; then travel, as what
 * the balance pays for; then other people (split, groups), which is the second
 * message and not the first.
 *
 * Lives under /lab until it replaces the homepage, so it is not indexed.
 */
export const metadata: Metadata = {
  title: "Home, chapters preview",
  robots: { index: false, follow: false },
};

/** The painted wall behind the hero, sampled off walk.jpg. It is also the brand's deep blue. */
const WALL = "#2C4556";

export default function HomeChaptersPage() {
  return (
    <>
      <TopNav />

      <main className="bg-abyss">
        <Chapter
          id="money"
          photo="/home/walk.jpg"
          alt="A woman in a linen coat walking past a deep blue wall in the sun"
          focus={{ mobile: "39% 50%", desktop: "50% 50%" }}
          lead="peek"
          side="left"
          priority
          groundTop={WALL}
          overPhoto={<Hero />}
        >
          <Eyebrow>Your money</Eyebrow>
          <Title>
            Get paid from <em>anywhere</em>.
          </Title>
          <Body>
            Your own USD account details for clients and employers, euros when
            you need them, and a @username anyone on HOLD can pay in seconds.
          </Body>
          <AccountProof />
        </Chapter>

        <Chapter
          id="savings"
          photo="/home/bus.jpg"
          alt="A nurse resting against a bus window at sunrise, coffee in hand"
          focus={{ mobile: "58% 50%", desktop: "50% 50%" }}
        >
          <Eyebrow>Savings</Eyebrow>
          <Title>
            Earning while you <em>sleep</em>.
          </Title>
          <Body>
            Move part of your balance into Savings and it starts earning that
            day. Rates are variable and not guaranteed.
          </Body>
          <SavingsProof />
        </Chapter>

        <PeopleCarousel />

        <Chapter
          id="hi"
          photo="/home/tokyo.jpg"
          alt="A woman with a backpack arriving in a quiet Tokyo street at dusk"
          focus={{ mobile: "44% 50%", desktop: "50% 50%" }}
        >
          <Eyebrow>Hi</Eyebrow>
          <Title>
            Say it. Hi <em>books</em> it.
          </Title>
          <Body>
            Tell Hi what you need in your own words. It finds the stay with
            live prices and pays from your balance, once you confirm.
          </Body>
          <HiChatProof />
        </Chapter>

        <GlassBanner
          id="travel"
          photo="/home/key.jpg"
          alt="One hand passing an old brass key to another in front of a blue door"
          focus="55% 50%"
          eyebrow="Benefits"
          title={
            <>
              Your balance, <em>on the trip</em>.
            </>
          }
          body="Stays and eSIMs inside HOLD, paid from the same account you get paid into."
          cta={{ label: "See stays", href: "/travel" }}
          secondary={{ label: "eSIM", href: "/esim" }}
        />

        <Chapter
          id="pay"
          photo="/home/dinner.jpg"
          alt="Friends laughing at the end of a long dinner on a terrace under string lights"
          focus={{ mobile: "42% 50%", desktop: "50% 50%" }}
          side="left"
        >
          <Eyebrow>Payments</Eyebrow>
          <Title>
            Split it before <em>dessert</em>.
          </Title>
          <Body>
            Send to a @username in seconds. Split the bill with the table and
            everyone pays their share in a tap.
          </Body>
          <SplitProof />
        </Chapter>

        <Chapter
          id="together"
          photo="/home/crew.jpg"
          alt="Three friends in linen relaxing on white steps against a blue wall"
          focus={{ mobile: "50% 50%", desktop: "50% 50%" }}
        >
          <Eyebrow>Groups</Eyebrow>
          <Title>
            One plan for <em>everyone</em> going.
          </Title>
          <Body>
            Make a group for the trip. The stay, the costs and who paid what
            live in one chat, so nobody keeps a spreadsheet.
          </Body>
          <GroupProof />
        </Chapter>

        <GlassBanner
          id="security"
          photo="/home/hands.jpg"
          alt="Close up of one hand gently holding another's wrist"
          eyebrow="Self custody"
          title={
            <>
              Yours. <em>Only</em> yours.
            </>
          }
          body="Your key never leaves your phone. Sign in with Face ID, and an encrypted backup brings everything back on a new one. Hi suggests, you approve."
          cta={{ label: "How it works", href: "/how-it-works/self-custody" }}
        />

        <GlassBanner
          id="free"
          photo="/home/coffee.jpg"
          alt="Hands around a coffee cup on a sunny stone table"
          eyebrow="One plan"
          title={
            <>
              Start <em>free</em>.
            </>
          }
          body={`The first ${usd(FREE_ALLOWANCE.monthlyVolumeUsd)} you convert each month, the network fee is on us. Savings and Benefits come with it.`}
          cta={{ label: "Download free", href: DOWNLOAD_ANCHOR }}
        />

        <Closing />
      </main>

      <Footer />
      <HiFirst />
    </>
  );
}

function Hero() {
  return (
    <div className="container-page flex h-full flex-col pt-[104px] md:items-end md:justify-center md:pt-0">
      <div className="max-w-[560px] md:w-[44%]">
        <h1 className="font-display font-light text-[44px] md:text-[60px] lg:text-[68px] leading-[1.0] tracking-[-0.04em] text-white [&_em]:font-editorial [&_em]:text-[1.06em]">
          Money that <em>moves</em> with you.
        </h1>
        <p className="mt-4 max-w-[440px] text-body md:mt-6 md:text-lead text-white/[0.85]">
          Dollars and euros in one account. Get paid, send, split and save, and
          let Hi book the trip from your balance.
        </p>
        <DownloadLink className="mt-6 inline-flex items-center justify-center rounded-pill bg-amber px-6 py-3.5 text-body font-medium text-text-on-amber transition-colors duration-180 hover:bg-amber-glow md:mt-9">
          Download free
        </DownloadLink>
      </div>
    </div>
  );
}

function Closing() {
  return (
    <section id="download" className="relative flex min-h-[100svh] flex-col items-center overflow-hidden text-center">
      <Image
        src="/home/beach.jpg"
        alt="Four friends walking barefoot along a beach at golden hour, two holding hands"
        fill
        sizes="100vw"
        className="object-cover [object-position:58%_50%]"
      />
      <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-black/55 via-black/30 to-transparent" aria-hidden />
      {/* The photo has little sky above the walkers, so on a wide screen the
          headline and the badges share one row inside it. */}
      <div className="container-page relative w-full pt-[18svh] md:flex md:items-center md:justify-between md:gap-8 md:pt-[104px] md:text-left">
        <div>
          <h2 className="font-display font-light text-[48px] md:text-[64px] lg:text-[72px] leading-[1.0] tracking-[-0.04em] text-white [&_em]:font-editorial [&_em]:text-[1.06em]">
            Ready <em>when you are</em>.
          </h2>
          <p className="mt-6 text-small text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.55)] md:mt-3">
            Self custodial. Available worldwide.
          </p>
        </div>
        <StoreBadges className="mt-10 md:mt-0 md:flex-nowrap" />
      </div>
    </section>
  );
}
