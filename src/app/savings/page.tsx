import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { HOLD_KEEPS, RATE_DISCLAIMER } from "@/lib/rates.config";

/**
 * /savings — money you deliberately set aside, and what it costs you.
 *
 * SAVINGS IS NOT SMART ACCOUNT
 *
 * The two were briefly merged on 16-aug-2026 and un-merged the same day. They
 * are different products at different prices, and the price difference IS the
 * product difference:
 *
 *   Savings  — money you MOVED into Savings or a Pocket. Live today on Base and
 *              Polygon. We keep savingsInterestShareBps of the interest. Lower,
 *              because you did the work. This page.
 *   Smart    — the Main balance, the money you never got round to moving,
 *   Account    earning anyway. We keep mainInterestShareBps, which is higher.
 *              /smart-account.
 *
 * rates.config rule 3: never render two HOLD_KEEPS keys on the same page. Only
 * savingsInterestShareBps appears here. If you find yourself wanting to show
 * both so the reader can compare, you are building the fee schedule that file
 * exists to prevent — link to the other page instead, which is what the two
 * pages do for each other.
 *
 * RULES FOR ANYTHING ADDED HERE
 *
 * 1. No jargon. Not one word a customer would have to look up.
 * 2. No APY, anywhere, ever. Rates float and a number on a marketing page is a
 *    promise. The app shows the live rate; this page shows the split.
 * 3. No number that is not pulled from rates.config.ts.
 * 4. Never claim it works everywhere. It does not.
 */

export const metadata: Metadata = {
  title: "Savings",
  description:
    "Move money into Savings and it earns from that day, on Base and Polygon, with no lock-up and no notice period. What that means, how it works, and exactly what HOLD keeps.",
  alternates: { canonical: "/savings" },
};

const FAQ = [
  {
    q: "Where does the interest come from?",
    a: "Around the world, people and businesses borrow dollars and pay interest to do it. Money you put into Savings joins the pool that lends to them, and you receive a share of what they pay. It is the same reason a savings account pays you anything at all — the bank lends your deposit out. The difference is that a bank keeps most of the interest and hands you a fraction, and we tell you exactly what our share is.",
  },
  {
    q: "Is my money locked up?",
    a: "No. There is no notice period, no minimum, no term and no penalty. Move it back, spend it, send it — whenever you want, in full, in the same tap. You will not see two balances, because you do not have two balances.",
  },
  {
    q: "When do I get the interest?",
    a: "Continuously. There is no payment date and no monthly credit — the amount under your Savings balance is what has been earned so far, and it is already yours. Nothing has to be claimed and nothing is held back until a cut-off.",
  },
  {
    q: "Do Pockets earn as well?",
    a: "Yes, and at the same share as Savings. A pocket is money you decided to set aside for something — a trip, next quarter's tax, a deposit — and that decision is the same one you make when you move money into Savings, so it is priced the same way.",
  },
  {
    q: "Can HOLD take my money?",
    a: "No, and this is not a promise — it is how it is built. Your money stays in your own name the entire time and every withdrawal is signed on your device. We can help it start earning, and that is the only thing we can do with it. There is no button on our side that moves your money to us, because we never built one.",
  },
  {
    q: "What if HOLD disappears tomorrow?",
    a: "Your money is not ours to lose. It sits in your name in a public lending market, and you keep the keys to it. If we vanished overnight you would still be able to reach it without us.",
  },
  {
    q: "Is the rate guaranteed?",
    a: "No. It moves with what borrowers are paying, the same way any savings rate moves. We show you the current rate in the app, and it can go up or down. That is also why there is no rate printed on this page — a number here would be out of date by the time you read it. Nobody who guarantees you a fixed return on this kind of product is telling you the truth.",
  },
  {
    q: "Can I lose money?",
    a: "It is not a bank deposit and it is not government insured, so it is not risk-free — no honest product page would say otherwise. Your balance is held in dollars, so it does not swing with the price of anything. The risk is that the lending markets we use fail in some way. We only use large, long-established ones, and you can move everything back to plain dollars whenever you like if you would rather not take that risk at all.",
  },
];

export default function SavingsPage() {
  // Only the savings share on this page. Main is a different product at a
  // different price and lives on /smart-account. rates.config rule 3.
  const savingsShare = HOLD_KEEPS.savingsInterestShareBps / 100;

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">Savings</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Money set aside
                <br />
                <span className="text-text-muted">should be doing something.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Move any part of your balance into Savings and it starts earning that day.
                No notice period, no minimum, no term — you can move it straight back the
                moment you want it, and it never stops being yours while it is in there.
              </p>
              <p className="mt-8 text-small text-text-faint max-w-2xl">
                <span aria-hidden>* </span>
                {RATE_DISCLAIMER} Your balance is not a bank deposit and is not covered by
                any deposit guarantee scheme.
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
                One tap moves money in. One tap moves it back. In between it earns, and you
                keep the larger share of what it earns.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card
                title="It earns from day one"
                body="Not from the first of next month, and not after a qualifying period. Money that arrives in Savings today is earning today, and it stops the moment you take it out."
              />
              <Card
                title="It is still your money"
                body="Nothing about earning makes it harder to reach. There is no queue, no request and nobody to ask. If we ever made you choose between earning and getting to your money, we built the wrong thing."
              />
              <Card
                title="Pockets count too"
                body="A pocket is money you set aside for something — a trip, next quarter's tax, a deposit. That is the same decision, so it earns on the same terms."
              />
            </div>
          </div>
        </section>

        {/* ─── How it works ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Where the money actually goes
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                We would rather tell you than have you find out. Money you put into Savings
                is not lent to us and does not sit on our books.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Fact
                title="Into a public lending market"
                body="Your money is supplied to Aave — one of the largest and longest-running lending markets there is, open for anyone to inspect at any hour. Borrowers post more collateral than they take out, and the interest they pay is where your interest comes from."
              />
              <Fact
                title="On Base and Polygon"
                body="Two networks, chosen because they are cheap enough that the fee to move your money in does not eat the first weeks of interest. You never pick one; the app does, and you see a single balance either way."
              />
              <Fact
                title="Still in your name, the whole time"
                body="It is not pooled with other customers' money under our name, and it does not pass through an account of ours on the way. It goes from your account to the market and back, and only you can sign either leg."
              />
              <Fact
                title="Nothing happens without a signature"
                body="Putting money in and taking it out are both signed on your device. That is why we cannot do either for you — and it is also why we cannot do it to you."
              />
            </div>
          </div>
        </section>

        {/* ─── Questions ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
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
                  Your Savings balance earns interest. We keep a share of that interest and
                  you keep the rest. We never take a share of the money itself — only of what
                  it earns, and only while it is earning. If it earns nothing, we get nothing.
                </p>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-px bg-[color:var(--color-hairline)] border border-[color:var(--color-hairline)] rounded-card overflow-hidden">
                <Split label="You keep" value={`${100 - savingsShare}%`} highlight />
                <Split label="We keep" value={`${savingsShare}%`} />
              </div>
              <p className="mt-4 text-small text-text-faint">of the interest — never of the balance</p>

              <p className="mt-8 text-body text-text-muted leading-relaxed">
                This is the cheaper of our two rates, because you did the work of moving the
                money. The balance you leave sitting in Main earns too, and costs you more,
                for exactly that reason — that number is on{" "}
                <Link href="/smart-account" className="text-text hover:text-amber underline">
                  the Smart Account page
                </Link>
                .
              </p>

              <p className="mt-6 text-small text-text-faint">
                <span aria-hidden>* </span>
                {RATE_DISCLAIMER} There is no account fee, no minimum balance and no charge
                to move money in or out. The percentage above is everything we make on this
                product — there is no other charge and nothing further to look up.
              </p>
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
                Not everywhere. Rules on this kind of product differ from country to country,
                and in some places we cannot offer it at all. The app tells you plainly
                whether it is available to you before you move anything, and everything else
                in HOLD works either way.
              </p>
              <p className="mt-8 text-small text-text-faint">
                <span aria-hidden>* </span>
                This page describes the product and is not financial advice.
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

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
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

function Split({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 bg-night/60 px-8 py-8">
      <p className="text-tiny uppercase tracking-wider text-text-faint">{label}</p>
      <p
        className={`mt-3 font-mono tabular-nums text-h2 font-light ${
          highlight ? "text-amber" : "text-text-muted"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
