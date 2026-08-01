import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { SeatsCounter, LivePrice } from "@/components/founders/SeatsCounter";
import { FOUNDER_PASS, TIER_BY_ID, usd } from "@/lib/rates.config";

/**
 * /founders — the Founder Pass sales page.
 *
 * WHAT THIS PAGE SELLS, AND WHAT IT DOES NOT.
 *
 * It sells what is live today: the plan, the savings terms, the referral tier,
 * FX. The card appears once, near the bottom, as something that arrives when it
 * arrives. There is no launch date on this page and there is no wording that
 * lets a reader come away thinking they bought a card — because they did not,
 * and a pass sold on a card that slips is a refund queue and a reputation.
 *
 * The money-back guarantee is the honest version of the same thing: if the card
 * has not shipped in six months, the pass is refundable in full, no argument.
 *
 * No rate on this page states what HIHODL keeps. That belongs on /fees and
 * nowhere else. Everything here is what the buyer receives, net.
 */

export const metadata: Metadata = {
  title: "Founder Pass — 500 seats",
  description:
    "500 founder seats. One payment. Pro for life, no savings fee on your first $25,000, no FX markup in any corridor, and a permanent creator referral tier. Full refund if the card has not shipped within six months.",
  alternates: { canonical: "/founders" },
  openGraph: {
    type: "website",
    url: "https://www.hihodl.xyz/founders",
    siteName: "HIHODL",
    title: "HIHODL Founder Pass — 500 seats",
    description:
      "One payment. Pro for life, no savings fee on your first $25,000, no FX markup anywhere, and a permanent creator referral tier.",
    locale: "en_US",
  },
};

const CHECKOUT = "/founders/checkout";

export default function FoundersPage() {
  const pro = TIER_BY_ID.pro;

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Hero ──────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #2C4566 0%, #4F7090 50%, #243246 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 70% at 30% 25%, rgba(255,183,3,0.14), transparent 70%), radial-gradient(70% 70% at 85% 90%, rgba(44,69,102,0.45), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-amber">
                Founder Pass · 500 seats, ever
              </p>

              <h1 className="mt-6 font-display text-h1 md:text-display-sm font-light text-text leading-[1.02]">
                Pay once.
                <br />
                <span className="text-text-muted">Keep the terms for good.</span>
              </h1>

              <p className="mt-8 text-lead text-text-muted max-w-2xl">
                A one-off payment for a permanent set of terms on your dollar account:
                the paid plan for life, no fee on what your savings earn up to{" "}
                {usd(FOUNDER_PASS.savingsFeeWaiverUpToUsd)}, and no markup when you spend
                in another currency. Five hundred seats and then the door closes.
              </p>

              <div className="mt-10">
                <SeatsCounter />
              </div>

              <div className="mt-10">
                <LivePrice
                  earlyPriceUsd={FOUNDER_PASS.earlyPriceUsd}
                  listPriceUsd={FOUNDER_PASS.priceUsd}
                  earlySeats={FOUNDER_PASS.earlySeats}
                />
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href={CHECKOUT}
                  className="inline-flex items-center justify-center px-7 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]"
                >
                  Take a seat
                </Link>
                <Link
                  href="#included"
                  className="inline-flex items-center justify-center px-7 py-4 rounded-pill border border-[color:var(--color-hairline-strong)] text-text font-medium text-body hover:bg-white/5 transition-colors duration-180"
                >
                  What is included
                </Link>
              </div>

              <p className="mt-8 text-small text-text-faint max-w-xl">
                Card, external wallet, or a direct transfer. Full refund if the card has not
                shipped within {FOUNDER_PASS.refundWindowMonths} months.
              </p>
            </div>
          </div>
        </section>

        {/* ─── What you get ──────────────────────────────────────── */}
        <section id="included" className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div
            className="absolute inset-0 bg-amber-glow opacity-30 pointer-events-none"
            aria-hidden
          />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">
                What the pass includes
              </p>
              <h2 className="mt-6 font-display text-h2 md:text-h1 font-light text-text leading-tight">
                Live today.
                <br />
                <span className="text-text-muted">Not a roadmap.</span>
              </h2>
              <p className="mt-8 text-lead text-text-muted">
                Everything in the first group works the day you buy. The card benefits sit
                in their own group at the bottom, because they start when the card starts.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Benefit
                title="The paid plan, for life"
                body={`${pro.name} never renews and never bills you again. Unlimited pockets, priority support, no monthly fee for as long as the account exists.`}
                worth={`${usd(pro.priceUsdMonthly)}/month, forever`}
              />
              <Benefit
                title={`No savings fee on your first ${usd(FOUNDER_PASS.savingsFeeWaiverUpToUsd)}`}
                body={`Every cent your savings earn is yours, on balances up to ${usd(FOUNDER_PASS.savingsFeeWaiverUpToUsd)}. Nothing is taken out of the interest. For life.`}
                worth="For life"
              />
              <Benefit
                title="No FX markup, in any corridor"
                body="Spend in any currency at the wholesale rate. Not a reduced markup — no markup, in every corridor, on every purchase."
                worth="Every currency"
              />
              <Benefit
                title="Permanent creator tier"
                body={`Introduce someone and you keep ${FOUNDER_PASS.creatorReferralShareBps / 100}% of the revenue they generate for us, for as long as they stay. It is a share of what we earn, never a cut of what they spend.`}
                worth={`${FOUNDER_PASS.creatorReferralShareBps / 100}% share`}
              />
              <Benefit
                title={`${FOUNDER_PASS.welcomeHiPoints.toLocaleString("en-US")} HiPoints to start`}
                body="Credited when your pass is confirmed. Points pay for your plan and for partner perks — they are the currency inside the product."
                worth="On day one"
              />
              <Benefit
                title="Founder perk pack"
                body="Partner perks, redeemed with HiPoints. The list expands as agreements are signed; we name a partner when the deal is done and not before."
                worth="Expanding"
              />
              <Benefit
                title="The founders room"
                body="A private group with the people building this, and a vote on what gets built next. Not a survey — the queue is published and founders rank it."
                worth="Direct line"
              />
            </div>

            {/* Card benefits, quarantined into their own block on purpose */}
            <div className="mt-8 rounded-card border border-amber/30 bg-amber/[0.04] p-8 md:p-10">
              <p className="text-tiny uppercase tracking-wider text-amber">
                When the card ships
              </p>
              <h3 className="mt-5 font-display text-h3 font-light text-text">
                Two things that start on the card&rsquo;s first day.
              </h3>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-body text-text">A numbered card, first batch</p>
                  <p className="mt-2 text-body text-text-muted">
                    Your founder number is fixed when you buy and printed on the card. First
                    batch, no issuance fee.
                  </p>
                </div>
                <div>
                  <p className="text-body text-text">
                    Double cashback band, for life
                  </p>
                  <p className="mt-2 text-body text-text-muted">
                    Whatever the cashback band is when the card launches, yours is twice as
                    wide, permanently.
                  </p>
                </div>
              </div>
              <p className="mt-8 text-small text-text-faint">
                The card is not what you are buying, and we are not giving it a date. If it
                has not shipped within {FOUNDER_PASS.refundWindowMonths} months of your
                purchase, ask for your money back and you get all of it.
              </p>
            </div>
          </div>
        </section>

        {/* ─── The guarantee ─────────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #2A1F18 0%, #1F1A14 45%, #1F2535 100%)",
          }}
        >
          <SectionHairline tone="amber" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(70% 60% at 50% 45%, rgba(255,183,3,0.10), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="container-page section relative text-center">
            <p className="text-tiny uppercase tracking-wider text-amber">The guarantee</p>
            <p className="mt-8 font-editorial text-h3 md:text-h2 text-text max-w-3xl mx-auto leading-snug">
              If the card has not shipped within {FOUNDER_PASS.refundWindowMonths} months,
              you get every cent back.
            </p>
            <p className="mt-8 text-lead text-text-muted max-w-2xl mx-auto">
              No form to argue with, no partial credit, no store voucher. One email and the
              full amount goes back the way it came.
            </p>
            <p className="mt-6 text-small text-text-faint max-w-2xl mx-auto">
              Everything else in the pass keeps working the whole time, because none of it
              depends on the card.
            </p>
          </div>
        </section>

        {/* ─── Straight answers ──────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">
                Straight answers
              </p>
              <h2 className="mt-6 font-display text-h2 font-light text-text leading-tight">
                The questions worth asking
                <br />
                <span className="text-text-muted">before you pay for anything.</span>
              </h2>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-4">
              <Answer
                q="When does the card ship?"
                a="We are not going to give you a date. Card programmes depend on an issuer and a bank sponsor, and every date we could give you would be a guess with someone else's calendar in it. What we will commit to is the refund: six months from your purchase, no card, full money back."
              />
              <Answer
                q="So what am I actually paying for?"
                a="The plan, the savings terms, the referral tier and the FX terms. All four work today. The card benefits are on top, and they are the part the guarantee covers."
              />
              <Answer
                q="What happens to my terms if you change your prices?"
                a="Nothing. The pass fixes your terms at the moment you buy. If the plan gets more expensive or the savings fee changes, yours does not."
              />
              <Answer
                q="Is 500 a real number?"
                a="Yes, and the counter at the top of this page reads the live figure out of our database, not a decoration. Seat 500 is the last one; there is no second batch and no extension."
              />
              <Answer
                q="Do I need to understand any of the technical side?"
                a="No. You can pay by card like any other purchase. If you already hold dollars in a wallet you can pay that way instead, but nothing about the pass requires it."
              />
              <Answer
                q="Do you hold my money?"
                a="No, and that does not change with a Founder Pass. HIHODL is a stablecoin wallet where you hold the keys. The pass changes your terms, never your custody."
              />
            </div>
          </div>
        </section>

        {/* ─── Close ─────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #243246 0%, #2D3D52 50%, #243246 100%)",
          }}
        >
          <SectionHairline tone="blue" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 30%, rgba(255,183,3,0.12), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="container-page py-20 md:py-28 relative text-center">
            <SeatsCounter />
            <h2 className="mt-8 font-display text-h2 md:text-h1 font-light text-text max-w-3xl mx-auto leading-tight">
              Five hundred people
              <br />
              <span className="text-text-muted">get these terms.</span>
            </h2>
            <div className="mt-10 flex justify-center">
              <Link
                href={CHECKOUT}
                className="inline-flex items-center justify-center px-8 py-4 rounded-pill bg-amber text-text-on-amber font-medium text-body hover:bg-amber-glow transition-all duration-180 ease-out-soft hover:scale-[1.02]"
              >
                Take a seat
              </Link>
            </div>
            <p className="mt-8 text-small text-text-faint">
              Full refund if the card has not shipped within{" "}
              {FOUNDER_PASS.refundWindowMonths} months.{" "}
              <Link href="/fees" className="text-text-muted hover:text-text underline">
                Every fee we charge
              </Link>{" "}
              is on one page.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Benefit({
  title,
  body,
  worth,
}: {
  title: string;
  body: string;
  worth: string;
}) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-320">
      <div className="flex items-start justify-between gap-6">
        <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
        <span className="shrink-0 text-tiny uppercase tracking-wider text-text-faint border border-[color:var(--color-hairline)] rounded-pill px-3 py-1">
          {worth}
        </span>
      </div>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Answer({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-6 open:bg-white/[0.05] transition-colors">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-6">
        <h3 className="font-display text-h4 font-light text-text leading-snug">{q}</h3>
        <span
          className="mt-1 shrink-0 text-text-faint group-open:rotate-45 transition-transform duration-180"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{a}</p>
    </details>
  );
}
