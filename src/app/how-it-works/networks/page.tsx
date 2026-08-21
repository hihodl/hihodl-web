import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocHeader, DocCard, DocLimit, DocAnswer, DocNext } from "@/components/site/Doc";

/**
 * /how-it-works/networks — the four networks and the dollars.
 *
 * Sourced from the code:
 *   wallet src/config/chains.ts        APP_SUPPORTED_CHAINS — Ethereum, Base,
 *                                      Polygon, Solana. Four. Not five.
 *   wallet src/constants/stablecoins   STABLE_SYMBOLS + STABLE_TO_FIAT, which
 *                                      is the list rendered below verbatim
 *   backend gasless-routing.service    native token per chain, used on /fees
 *
 * ON NAMING TICKERS HERE. The rest of the site deliberately says "stablecoin
 * rails" and never prints USDC or USDT — a ticker in a shop window is a word
 * the reader has to look up before they can want the product. This page is the
 * opposite situation: the reader arrived BECAUSE they want the list. Naming
 * them here is not a relapse, it is the reason the section exists. Do not
 * propagate them back up to the homepage.
 *
 * Anything not in APP_SUPPORTED_CHAINS does not go on this page, however close
 * to shipping it is. A network we are "about to support" is a network a reader
 * will send money to.
 */

export const metadata: Metadata = {
  title: "Networks and dollars",
  description:
    "HOLD settles on Ethereum, Base, Polygon and Solana, and supports the major dollar and euro stablecoins. Why you are never asked to pick one, and what happens when a network has a bad day.",
  alternates: { canonical: "/how-it-works/networks" },
};

/** Mirrors STABLE_SYMBOLS / STABLE_TO_FIAT in the wallet. */
const DOLLARS = [
  { symbol: "USDC", issuer: "Circle", peg: "US dollar" },
  { symbol: "USDT", issuer: "Tether", peg: "US dollar" },
  { symbol: "PYUSD", issuer: "PayPal", peg: "US dollar" },
  { symbol: "RLUSD", issuer: "Ripple", peg: "US dollar" },
  { symbol: "USDG", issuer: "Paxos", peg: "US dollar" },
  { symbol: "DAI", issuer: "Sky", peg: "US dollar" },
  { symbol: "USDe", issuer: "Ethena", peg: "US dollar" },
  { symbol: "sUSDS", issuer: "Sky", peg: "US dollar" },
  { symbol: "USDM", issuer: "Mountain", peg: "US dollar" },
  { symbol: "EURC", issuer: "Circle", peg: "Euro" },
];

const NETWORKS = [
  {
    name: "Base",
    body: "Where most of what you do ends up. Cheap enough that moving small amounts is not absurd, fast enough that a payment feels like a payment. Part of what your Savings balance is supplied to.",
  },
  {
    name: "Solana",
    body: "The fastest of the four and the cheapest to send on, which makes it the default for everyday payments between people. Confirmation is close enough to instant that the app does not bother showing you a spinner.",
  },
  {
    name: "Polygon",
    body: "Cheap, long-established, and widely accepted by the businesses and payroll providers that pay people in dollars. The other half of where Savings goes to work.",
  },
  {
    name: "Ethereum",
    body: "The oldest and the most expensive, and still where large amounts and institutional counterparties prefer to settle. We support it because the money that arrives from a company often arrives here, not because we would route you through it by choice.",
  },
];

const FAQ = [
  {
    q: "Do I have to pick a network?",
    a: "No. In the default view you never see them at all — you have a dollar balance, and when you pay someone the app works out where the money is, where it needs to go and what the cheapest way to do that is. If you want the controls, one setting in the app gives you every network in view and the routing decision in your hands.",
  },
  {
    q: "Someone is paying me. What do I give them?",
    a: "Your username. The app resolves it to whatever address is right for the network they are sending from, so they do not have to get it right and neither do you. If they insist on an address, the app will give you one for the network they asked about.",
  },
  {
    q: "Are all these dollars the same?",
    a: "Close enough for spending, not identical underneath. Each is issued by a different company backing it in a different way — some hold cash and short-term government debt, others work differently. They all aim at one dollar and they trade at one dollar. The app shows you one balance because that is how you think about your money, and the app tells you what you are holding if you ask.",
  },
  {
    q: "Why is EURC the only euro?",
    a: "Because it is the only euro stablecoin with enough depth to be worth holding — an account balance you cannot convert or spend without a bad price is not a feature. Euro income lands as euros through the bank rails; it does not have to become EURC to reach you.",
  },
  {
    q: "Can I hold things that are not dollars?",
    a: "Yes, and you can put money into a wider range of assets through Invest. What this page is about is the money that behaves like money — the balance you get paid into, save from and spend.",
  },
];

export default function NetworksPage() {
  return (
    <>
      <TopNav />

      <main>
        <DocHeader
          eyebrow="How HOLD works"
          title="Four networks."
          sub="You are asked about none of them."
          lead="Underneath, your money moves over public payment networks — the same infrastructure a bank wire uses, except open and running at three in the morning on a Sunday. Which of the four your money is on at any moment is a routing decision, and routing decisions are our job, not yours."
        />

        {/* ─── The four ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Where your money actually settles
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Four, chosen for different reasons, and the app moves between them for you.
                Each one is public: anyone can verify a payment happened without asking us.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              {NETWORKS.map((n) => (
                <DocCard key={n.name} title={n.name} body={n.body} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── The dollars ────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                The dollars we support
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                A stablecoin is a digital dollar issued by a company that holds real assets
                behind it. You can hold any of these; the app adds them up and shows you one
                figure in the currency they are pegged to, because &ldquo;$8.00&rdquo; is more
                useful than three rows that sum to it.
              </p>
            </div>

            <div className="mt-14 max-w-3xl rounded-card border border-[color:var(--color-hairline)] overflow-hidden">
              <div className="hidden md:flex px-8 py-4 bg-white/[0.03] text-tiny uppercase tracking-wider text-text-faint">
                <span className="w-32">Symbol</span>
                <span className="w-48">Issued by</span>
                <span>Shown as</span>
              </div>
              {DOLLARS.map((d) => (
                <div
                  key={d.symbol}
                  className="flex flex-col md:flex-row px-8 py-4 border-t border-[color:var(--color-hairline)] bg-white/[0.015]"
                >
                  <span className="md:w-32 font-mono text-small text-text">{d.symbol}</span>
                  <span className="md:w-48 text-small text-text-muted">{d.issuer}</span>
                  <span className="text-small text-text-faint">{d.peg}</span>
                </div>
              ))}
            </div>

            <p className="mt-8 max-w-3xl text-small text-text-faint">
              <span aria-hidden>* </span>
              Not every one of these exists on all four networks, and the app only offers you
              the combinations that actually work. You will never be shown a route that
              cannot complete.
            </p>
          </div>
        </section>

        {/* ─── Limits ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What we do not control
              </h2>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-5">
              <DocLimit title="A network having a bad day is a bad day for your payment.">
                <p>
                  These networks are run by nobody in particular, which is the source of most
                  of their good properties and all of this one. When one is congested,
                  transactions cost more and take longer; in rare cases a network has stopped
                  producing blocks for a period. We route around a struggling network where
                  the money is somewhere that allows it, and where it is not, your payment
                  waits.
                </p>
                <p>
                  This is a real difference from a bank, and not always in the bank&rsquo;s
                  favour: the same openness means there is no closing time, no cut-off, and
                  no bank holiday.
                </p>
              </DocLimit>

              <DocLimit title="Money sent on a network we do not support does not arrive.">
                <p>
                  If someone pays you on a fifth network, or in a token that is not on the
                  list above, it will not show up in the app — it is not lost, it is at an
                  address the app does not read. Give people your username and this cannot
                  happen, because the app hands them a destination that works.
                </p>
              </DocLimit>

              <DocLimit title="The dollars are only as good as the companies issuing them.">
                <p>
                  Each stablecoin is a claim on a real company holding real assets. They are
                  regulated in various places and audited to varying standards, and the large
                  ones have held their peg through several bad weeks in the market. But it is
                  a company, not a government, and{" "}
                  <Link
                    href="/how-it-works/self-custody"
                    className="text-text hover:text-amber underline"
                  >
                    that company can freeze an address holding its token
                  </Link>
                  . Holding more than one issuer is one reason the app lets you.
                </p>
              </DocLimit>
            </div>
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="moonlight" />
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

        <DocNext current="/how-it-works/networks" />
      </main>

      <Footer />
    </>
  );
}
