import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { HOLD_KEEPS, bps } from "@/lib/rates.config";

/**
 * /esim — the data plan product, in the words of somebody about to get on a
 * plane.
 *
 * WHY THIS IS ITS OWN PAGE AND NOT A SECTION OF /travel
 *
 * Two reasons, and the second is the one that matters.
 *
 * The first is search: nobody types "hold travel products". They type "esim for
 * japan" the week before they fly, and a page that has to share its title, its
 * canonical URL and its first paragraph with hotel bookings ranks for neither.
 *
 * The second is the disclosure rule at the top of rates.config.ts. Every take we
 * charge is published beside the product it belongs to, and no page anywhere
 * collects two of them. A single "Products" page would have to state the eSIM
 * spread and the stays markup in the same scroll, which is the aggregate fee
 * schedule we deliberately deleted, wearing a different hat. One page per
 * product is not a layout preference here; it is what keeps that rule true.
 *
 * RULES FOR ANYTHING ADDED HERE
 *
 * 1. Never promise coverage. Coverage is the local operator's and we are not in
 *    a position to guarantee a signal at an address. /legal/esim is precise
 *    about this and this page must not be looser than it.
 * 2. Every limit that costs a buyer money is on this page, not only in the
 *    terms. A phone that turns out to be carrier-locked, a plan with no SMS for
 *    bank codes, a country we cannot sell in — someone who discovers those
 *    after paying is a refund and a bad story; someone who reads them here is
 *    an informed customer.
 * 3. Numbers come from rates.config.ts. Only `HOLD_KEEPS.esim` may be rendered
 *    here, and it may not be rendered anywhere else.
 *
 * STRUCTURE
 *
 * The shell of /savings and /travel: alternating night/abyss, a hairline
 * at each seam, card grids, "How we make money here" last.
 */

export const metadata: Metadata = {
  title: "eSIM data plans",
  description:
    "Mobile data in more than 50 countries, bought from your HOLD balance and installed before you land. Data-only plans, no roaming bill, and the price never sits above what you could find publicly.",
  alternates: { canonical: "/esim" },
};

/** What the buyer keeps of the spread. The page renders this, never our share. */
const userShareBps = 10_000 - HOLD_KEEPS.esim.marginShareBps;
const userShareProBps = 10_000 - HOLD_KEEPS.esim.marginShareProBps;

export default function EsimPage() {
  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">eSIM</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Data the minute
                <br />
                <span className="text-text-muted">you land.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Buy a data plan for where you are going, pay for it out of the dollars you
                already hold, and install it before you get on the plane. No roaming bill,
                no queue at an airport kiosk, no second phone.
              </p>
            </div>
          </div>
        </section>

        {/* ─── How it works ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">How it works</h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Three steps, and the longest of them is choosing how much data you want.
              </p>
            </div>

            <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                n={1}
                title="Pick the country and the size"
                body="More than fifty destinations. You choose how much data you want; the shelf works out which plan length gives you that data for the least money and puts the days on the tile."
              />
              <Step
                n={2}
                title="Pay from your balance"
                body="The price you see is the price you pay, settled from your HOLD account. If that money happens to be earning at the time, it comes out of the yield position in the same tap and the rest keeps earning."
              />
              <Step
                n={3}
                title="Install it and it is on"
                body="The plan is delivered to your phone straight after payment. Your normal SIM stays where it is and keeps your number — the data plan sits alongside it."
              />
            </ol>
          </div>
        </section>

        {/* ─── The shelf ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                The shop does the comparing
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Every data shelf in this category is built the same way: three lengths, a
                dozen sizes, and a customer expected to hold six numbers in their head in
                the middle of an airport. Ours resolves that before you see it.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Fact
                title="One decision, not three"
                body="The size is what you actually care about. So you choose the data, and we show the cheapest plan that delivers it — whatever length that turns out to be. The number of days is printed on the tile, not buried in a filter you had to operate."
              />
              <Fact
                title="Nothing that loses to the tile beside it"
                body="A plan is taken off the shelf when another one on the same shelf gives at least as much data for no more money. Showing both is not more choice; it is a trap, and the tile that catches you would have been one we priced."
              />
              <Fact
                title="Unlimited only when it wins"
                body="Unlimited stays on the shelf while it is within reach of the largest metered plan, and disappears when it is not. Being shown unlimited at double the price of 20 GB does not read as an honest shop."
              />
            </div>
          </div>
        </section>

        {/* ─── Before you buy ────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What to know before you buy
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                The limits that cost money are here rather than only in the terms. Finding
                one out after paying is a refund; reading it now is a decision.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Fact
                title="Data only, so no SMS codes"
                body="There is no phone number attached, which means no normal calls and no text messages — including the one-time codes some banks send. Anything that runs over data works exactly as it does at home: messaging calls, email, maps, HOLD itself."
              />
              <Fact
                title="Your phone has to be able to take it"
                body="It needs to support eSIM and it must not be locked to a mobile operator. Most phones sold in the last few years qualify; a handset bought on contract often does not, and neither we nor you can check that from the checkout screen."
              />
              <Fact
                title="If it will not install, you get your money back"
                body="That is the promise the checkout makes. If the plan cannot be installed on your device, or it installs and never connects where you are, we refund it in full — points included — and it is not conditional on you working out why."
              />
              <Fact
                title="Coverage belongs to the local network"
                body="We tell you which country a plan covers. We cannot promise a signal at a specific address, a specific speed, or a specific generation of network — buildings, rural areas and busy events all change what you get, and none of them are ours."
              />
              <Fact
                title="Auto-renew is off unless you turn it on"
                body="If you switch it on and run out of data before your days run out, we buy the same plan once more at the price you paid rather than the price on the day. It renews once and then stops on its own."
              />
              <Fact
                title="One place we cannot sell you a plan"
                body="Inside the United Arab Emirates. Selling mobile data within the country requires a local licence, so while you are physically there our shelf is empty — for every destination, not just that one. From anywhere else, plans for the UAE are on sale as normal."
              />
            </div>

            <p className="mt-12 text-small text-text-faint max-w-2xl">
              The full terms of sale, including how the clock on a plan starts and what
              happens to an unused one, are on the{" "}
              <Link href="/legal/esim" className="text-text-muted hover:text-text underline">
                eSIM Terms of Sale
              </Link>
              .
            </p>

            {/* Every product page carries this section, and it names only the
                take that belongs to that product. See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h2 font-light text-text">
                How we make money here
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted">
                <p>
                  We buy data wholesale and sell it at our own price. That spread is the
                  whole of it: there is no booking fee, no delivery fee, no card fee and
                  no charge for the plan sitting unused, because the price on the tile is
                  the entire transaction.
                </p>
                <p>
                  Where the same trip can be priced on a public shelf, we read that price
                  and stay under it — we aim to come in around {bps(HOLD_KEEPS.esim.targetUndercutVsPublicBps)}{" "}
                  below, and we are never above it. Where nothing comparable exists to read,
                  the price runs off what the plan costs us.
                </p>
                <p className="text-text">
                  Then {bps(userShareBps)} of what we make on the sale goes back to you as
                  HiPoints, credited when the order completes — {bps(userShareProBps)} on
                  Pro. We keep the rest. That is why the cheaper the plan, the smaller the
                  reward: it is a share of a real margin rather than a number chosen to
                  look generous on a screen.
                </p>
                <p>
                  You can also put HiPoints toward the next plan at checkout, up to the
                  whole price. A point is worth the same wherever it is spent.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Why we sell this at all ───────────────────────────── */}
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
            <p className="text-tiny uppercase tracking-wider text-amber">Why data</p>
            <p className="mt-8 font-editorial text-h3 md:text-h2 text-text max-w-3xl mx-auto leading-snug">
              The first thing you need in a new country is the thing you cannot buy until
              you get there.
            </p>
            <p className="mt-8 text-lead text-text-muted max-w-2xl mx-auto">
              A wallet for people who move is worth very little at an airport with no
              connection. Selling the data is not a side business bolted onto a bank app —
              it is the first ten minutes of every trip, and it is a purchase we can make
              cheaper and faster than the kiosk in arrivals.
            </p>
            <p className="mt-8 text-small text-text-faint max-w-2xl mx-auto">
              See{" "}
              <Link href="/travel" className="text-text-muted hover:text-text underline">
                stays
              </Link>{" "}
              for the rest of the travel product.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-card p-8 border border-[color:var(--color-hairline)] bg-white/[0.03]">
      <span className="font-mono text-small text-moonlight">0{n}</span>
      <h3 className="mt-8 font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </li>
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
