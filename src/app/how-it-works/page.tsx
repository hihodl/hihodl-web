import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DOC_PAGES } from "@/components/site/Doc";

/**
 * /how-it-works — the index of the technical section.
 *
 * DELIBERATELY NOT IN THE HEADER. The nav is four product words and stays four
 * product words: someone deciding whether to open an account is not asking how
 * key derivation works, and putting it up there would suggest they should. This
 * is for the reader who has already decided they are interested and is now
 * trying to find the reason not to. Footer-linked, indexed, and written so that
 * reader finds the reason from us rather than from a thread.
 */

export const metadata: Metadata = {
  title: "How HOLD works",
  description:
    "The technical side, in plain language: who actually holds your money, how your account is protected, which networks and dollars we use, who pays the network fee, and the three ways to view the same balance.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <TopNav />

      <main>
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">How HOLD works</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                The part most apps
                <br />
                <span className="text-text-muted">would rather you skipped.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                You do not need any of this to use HOLD. The app is built so that none of it
                ever surfaces. But you are trusting us with the money you work for, and
                &ldquo;trust us&rdquo; is not an answer — so here is the whole thing, in
                language that does not require you to already know it.
              </p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {DOC_PAGES.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.06] transition-colors duration-180"
                >
                  <h2 className="font-display text-h4 font-light text-text leading-snug">
                    {p.label}
                  </h2>
                  <p className="mt-3 text-body text-text-muted leading-relaxed">{p.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* One promise about the section itself, which is the only promise a
            technical page is really in a position to make. */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What we promised ourselves about these pages
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted leading-relaxed">
                <p>
                  Every page in this section names something HOLD cannot do, or a case where
                  the good property stops holding. Not as a disclaimer at the bottom — in the
                  body, where you will read it.
                </p>
                <p>
                  That is not modesty. A security page with no limits in it is a page that has
                  been written by marketing, and anybody who knows the subject can tell within
                  a paragraph. The limits are the part that proves the rest was written by
                  someone who understood it.
                </p>
                <p>
                  If you find something here that is out of date or wrong, tell us and we will
                  fix the page. That offer is not rhetorical:{" "}
                  <a
                    href="mailto:hello@hihodl.xyz"
                    className="text-text hover:text-amber underline"
                  >
                    hello@hihodl.xyz
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
