import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { FREE_ALLOWANCE, HOLD_KEEPS, RATE_DISCLAIMER, usd } from "@/lib/rates.config";

/**
 * /invest — the portfolio, and what it costs to change one thing into another.
 *
 * WHY THIS PAGE REPLACES "SWAP"
 *
 * The site sold Swap as a product for a year. It never was one. Nobody wakes up
 * wanting to swap; they want to buy something, or take profit, or move into
 * dollars before rent is due. Swap is the verb underneath all three, and a nav
 * entry named after a verb is a nav entry nobody clicks. In the app the same
 * thing already happened: the Invest hub owns the route and the exchange screen
 * is a nested action inside it.
 *
 * So the price of a conversion is disclosed HERE, on the product that makes you
 * do one, instead of on a section called Pricing that read like an exchange fee
 * schedule.
 *
 * RULES FOR ANYTHING ADDED HERE
 *
 * 1. No named securities, no tickers, no example portfolios with a number on
 *    them. The tokenized-stock copy came off this site before the Apple appeal
 *    and does not come back until Invest ships as a distinct, regulator-aligned
 *    product. What this page describes is the portfolio view over what a
 *    customer already holds.
 * 2. No performance figures, no past returns, no "up X%".
 * 3. Every number comes from rates.config.ts. Rule 2 at the top of that file.
 */

export const metadata: Metadata = {
  title: "Invest",
  description:
    "One portfolio with what you paid for it and what it is worth now. Buy and rebalance from your balance, with no exchange account — and see exactly what a conversion costs.",
  alternates: { canonical: "/invest" },
};

const FAQ = [
  {
    q: "What shows up in my portfolio?",
    a: "Everything you hold that is not a dollar, with a live price beside it, what you paid for it, and what that position is up or down. Stablecoins are deliberately left out — the dollars you get paid in are cash, and cash sitting on a portfolio screen makes a portfolio look like it is doing something it is not.",
  },
  {
    q: "Where does the cost basis come from?",
    a: "From your own history in the app. When you buy, we record what you paid; the profit and loss you see is measured against that, not against some market average. If you moved something in from elsewhere we cannot know what you paid for it, and the app says so rather than guessing.",
  },
  {
    q: "Do I need an exchange account?",
    a: "No. Buying and rebalancing happen from the balance you already have, in the same app you get paid into. Nothing is transferred out to a third party and there is no second login, no second set of limits and no withdrawal queue between you and your money.",
  },
  {
    q: "Who holds what I buy?",
    a: "You do. A position you open is held in your own name with the key on your phone, exactly like the rest of your balance. There is no brokerage account in the middle, and nothing to claim back from us if we disappear.",
  },
  {
    q: "Can I lose money?",
    a: "Yes. Anything whose price moves can go down, and this page is not going to pretend otherwise. Nothing here is advice, nothing is guaranteed, and the money you need for rent belongs on the payments side of the app rather than in a position.",
  },
  {
    q: "How is this different from Savings?",
    a: "Savings is your dollars earning interest while staying dollars — the amount does not move, it grows. Invest is holding something whose price moves, which can go either way. Most people use both, and they are deliberately separate screens so that neither gets confused for the other.",
  },
];

export default function InvestPage() {
  const { monthlyVolumeUsd, networkFeeCeilingUsd } = FREE_ALLOWANCE;
  const freeMarkupPct = HOLD_KEEPS.swapMarkupFreeBps / 100;
  const proMarkupPct = HOLD_KEEPS.swapMarkupProBps / 100;

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">Invest</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                One portfolio, with
                <br />
                <span className="text-text-muted">what you paid for it.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Everything you hold that is not a dollar, in one place, with live prices
                and your own cost basis beside them. Buy and rebalance straight from your
                balance — no exchange account, no transfer out, no second login.
              </p>
              <p className="mt-8 text-small text-text-faint max-w-2xl">
                <span aria-hidden>* </span>
                Prices go down as well as up. Nothing on this page is investment advice.
              </p>
            </div>
          </div>
        </section>

        {/* ─── The short version ─────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">The short version</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Getting paid and investing usually live in two apps that do not know about
                each other, so you find out how you are doing by exporting a spreadsheet.
                Here they are the same balance.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card
                title="Your number, not the market's"
                body="Every position shows what you paid and what it is worth now. A portfolio that only shows today's price tells you nothing about whether you are up."
              />
              <Card
                title="Cash stays on the other side"
                body="Dollars are not a position, so they are not in here. They sit on the payments side where you can spend them, and they earn there instead."
              />
              <Card
                title="Nothing leaves the app"
                body="Buying and rebalancing happen against the balance you already have. There is no exchange account to open, fund, and eventually withdraw from."
              />
            </div>
          </div>
        </section>

        {/* ─── What it costs ─────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What a conversion costs
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Opening a position, closing one, or moving back into dollars all do the
                same thing underneath: they turn one currency into another. That is the
                only moment this product charges you anything. There is no account fee, no
                custody fee, no charge for holding a position and no charge for looking.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              <PriceCard
                plan="Free"
                headline={`First ${usd(monthlyVolumeUsd)} a month`}
                body={`We pay the network fee on your behalf, up to ${usd(networkFeeCeilingUsd)} a conversion. If the network is busy and the real cost is higher than that, you pay only the difference — never the whole thing.`}
                foot={`Above ${usd(monthlyVolumeUsd)} in a calendar month: ${freeMarkupPct}% all-in on the excess, not on the whole amount. ${usd(2)} minimum conversion.`}
              />
              <PriceCard
                highlight
                plan="Pro"
                headline="No monthly cap"
                body="The network fee is covered every time, whatever you moved this month. There is no volume at which Pro starts charging you more."
                foot={
                  proMarkupPct === 0
                    ? "No markup on what you convert, at any volume."
                    : `${proMarkupPct}% markup on what you convert.`
                }
              />
            </div>

            <p className="mt-10 text-small text-text-faint max-w-2xl">
              <span aria-hidden>* </span>
              The app shows one combined figure before you confirm, and that figure is what
              you pay. We do not widen the exchange rate and take the difference quietly —
              if we are charging you, it is on the screen. {RATE_DISCLAIMER}
            </p>
          </div>
        </section>

        {/* ─── Questions ─────────────────────────────────────────── */}
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
                <Answer key={item.q} q={item.q} a={item.a} />
              ))}
            </div>

            {/* Every product page carries this, naming only its own take.
                See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h2 font-light text-text">
                How we make money here
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted leading-relaxed">
                <p>
                  On conversions, and only above the free allowance above. We take nothing
                  for holding a position, nothing for the portfolio itself, and nothing
                  from the price movement either way — if what you hold doubles, all of it
                  is yours.
                </p>
                <p>
                  What your dollars earn while they wait is a different product with a
                  different share, stated in full on{" "}
                  <Link href="/savings" className="text-text hover:text-amber underline">
                    the savings page
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Availability ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Where this is available
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Not everywhere, and what you can hold differs by country. The app tells you
                what is available to you before you open anything, and the rest of HOLD
                works either way.
              </p>
              <p className="mt-8 text-small text-text-faint">
                <span aria-hidden>* </span>
                This page describes the product and is not investment advice. The value of
                what you hold can fall as well as rise, and you may get back less than you
                put in.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function PriceCard({
  plan,
  headline,
  body,
  foot,
  highlight,
}: {
  plan: string;
  headline: string;
  body: string;
  foot: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-card p-8 md:p-10 border flex flex-col ${
        highlight
          ? "border-amber/40 bg-gradient-to-b from-amber/[0.06] to-amber/[0.02]"
          : "border-[color:var(--color-hairline)] bg-white/[0.03]"
      }`}
    >
      <p
        className={`text-tiny uppercase tracking-wider ${
          highlight ? "text-amber" : "text-text-faint"
        }`}
      >
        {plan}
      </p>
      <h3 className="mt-4 font-display text-h3 font-light text-text leading-tight">{headline}</h3>
      <p className="mt-5 text-body text-text-muted leading-relaxed flex-1">{body}</p>
      <p className="mt-8 pt-6 border-t border-[color:var(--color-hairline)] text-small text-text-muted">
        {foot}
      </p>
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
