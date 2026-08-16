import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocHeader, DocLimit, DocAnswer, DocNext } from "@/components/site/Doc";

/**
 * /how-it-works/modes — Fintech, Hybrid, Native.
 *
 * Sourced from wallet src/store/userPrefs.ts, which is the source of truth:
 *   fintech  stablecoins masked behind their pegged fiat, no chain context
 *            anywhere. The DEFAULT. The target persona never reads the words
 *            "USDC" or "Solana".
 *   hybrid   real stablecoin symbols, aggregated across every chain, but not
 *            which network they sit on
 *   native   per-chain rows, network badges, manual routing
 * And src/config/accountProtection.ts: the recovery phrase is only OFFERED in
 * hybrid and native — hidden in fintech. That asymmetry is the one genuinely
 * consequential difference between the modes and it goes in the limit block,
 * not in a footnote.
 *
 * The framing to hold on to: these are three views of ONE account. Nothing
 * moves, nothing converts, no address changes. Anything that implies the modes
 * are three products is wrong.
 */

export const metadata: Metadata = {
  title: "Three ways to see one account",
  description:
    "The same balance shown three ways: as plain dollars, as the dollars you actually hold, or with every network in view. Switching changes the display and nothing else.",
  alternates: { canonical: "/how-it-works/modes" },
};

const FAQ = [
  {
    q: "Does switching move my money?",
    a: "No. Nothing is converted, nothing is transferred, no address changes and no fee is charged. It is the same account with more or less of it on screen — closer to turning on a detailed view than to changing anything. You can switch back in the same number of taps.",
  },
  {
    q: "Which one am I on?",
    a: "The first one, unless you went looking. Everybody starts on the plain-dollars view, and most people never leave it, which is the intended outcome rather than a failure to discover a feature.",
  },
  {
    q: "Why hide any of it?",
    a: "Because the details are true and mostly useless while you are trying to pay someone. Which network a dollar is on has about the same relevance to your rent as which correspondent bank a wire passed through — real, occasionally important, and not something to put on the screen where the amount goes. Hidden is not the same as unavailable: one setting brings all of it back.",
  },
  {
    q: "Is the detailed view for experts only?",
    a: "It is for people who want it. Nothing breaks if you turn it on out of curiosity and nothing is at risk while you look around. The controls it adds — choosing a network by hand, seeing each balance separately — are all things you could have left to the app.",
  },
];

export default function ModesPage() {
  return (
    <>
      <TopNav />

      <main>
        <DocHeader
          eyebrow="How HOLD works"
          title="One account."
          sub="Three amounts of detail."
          lead="Some people want an app that shows a dollar balance and gets out of the way. Some want to see exactly which digital dollars they hold, and some want every network in view with their hand on the routing. Rather than guess which you are, the app has one setting and starts at the simplest."
        />

        {/* ─── The three ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Mode
                eyebrow="Default"
                name="Plain dollars"
                body="Your balance is a dollar figure. Every digital dollar you hold is added up behind it, and no network is mentioned anywhere in the app. Sending, saving and spending all work without the word 'crypto' appearing once."
                shows={["$8.00", "One balance", "No networks"]}
                highlight
              />
              <Mode
                eyebrow="A step further"
                name="Your actual dollars"
                body="The same total, now itemised by what you are really holding — the specific dollar tokens and how much of each. Still no networks: which one a balance sits on stays the app's problem."
                shows={["USDC · USDT", "Still one total", "No networks"]}
              />
              <Mode
                eyebrow="Everything"
                name="Every network"
                body="Each balance split by the network it is on, badges to match, and manual control over routing when you send. This is the view for someone who would otherwise be checking our work in a block explorer."
                shows={["Per network", "Network badges", "Manual routing"]}
              />
            </div>

            <p className="mt-12 max-w-3xl text-body text-text-muted leading-relaxed">
              One setting, changed as often as you like. It is a display preference in the
              literal sense: the account underneath is identical in all three, and so is every
              address, balance and payment you have ever made.
            </p>
          </div>
        </section>

        {/* ─── Limit ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                One real difference
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Everything above is presentation. This one is not.
              </p>
            </div>

            <div className="mt-14 max-w-3xl">
              <DocLimit title="The plain-dollars view never shows you your recovery phrase.">
                <p>
                  The twelve words that reach your money from any other wallet in the world
                  exist regardless of which view you are on. In the default one, we do not
                  offer them and do not ask you to write them down — for most people, a phrase
                  they were made to record during setup is a phrase in a screenshot, which is
                  worse than not having it. Getting back in is done with your passkey and
                  recovery codes instead.
                </p>
                <p>
                  Switch to either of the other two and the phrase becomes available, behind
                  your strongest security factor. If holding it yourself matters to you, that
                  is the switch — and it is worth reading{" "}
                  <Link
                    href="/how-it-works/security"
                    className="text-text hover:text-amber underline"
                  >
                    what that phrase can do in the wrong hands
                  </Link>{" "}
                  before you write it anywhere.
                </p>
              </DocLimit>
            </div>
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                The questions people actually ask
              </h2>
            </div>
            <div className="mt-14 max-w-3xl flex flex-col gap-4">
              {FAQ.map((item) => (
                <DocAnswer key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        <DocNext current="/how-it-works/modes" />
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Mode({
  eyebrow,
  name,
  body,
  shows,
  highlight,
}: {
  eyebrow: string;
  name: string;
  body: string;
  shows: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card p-8 border bg-white/[0.03] ${
        highlight
          ? "border-[color:var(--color-hairline-strong)]"
          : "border-[color:var(--color-hairline)]"
      }`}
    >
      <p
        className={`text-tiny uppercase tracking-wider ${
          highlight ? "text-amber" : "text-text-faint"
        }`}
      >
        {eyebrow}
      </p>
      <h3 className="mt-4 font-display text-h4 font-light text-text leading-snug">{name}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
      <ul className="mt-6 flex flex-col gap-2">
        {shows.map((s) => (
          <li key={s} className="font-mono text-tiny text-text-faint">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
