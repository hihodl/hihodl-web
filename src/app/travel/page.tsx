import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { HOLD_KEEPS, RATE_DISCLAIMER, bps } from "@/lib/rates.config";

/**
 * /travel — booking a stay from inside HOLD.
 *
 * WHAT THIS PAGE USED TO SAY, AND WHY IT NO LONGER SAYS IT
 *
 * Twice, now.
 *
 * Until 13-aug-2026 this URL described a click-out affiliate programme: you book
 * with a partner, the partner pays us a commission, we pass most of it on. That
 * page was honest about a model we then did not build. The click-out was dropped
 * — a partner's own app intercepts the link, strips the parameters and takes the
 * commission with it — and the travel product that exists in code books the stay
 * itself, at a rate hotels give trade partners, with a price we set. Archived
 * verbatim at documentation/superseded/travel-affiliate-page-2026-08-13.tsx.txt.
 *
 * Its replacement, written the same day, then said the guest gets half of the
 * margin back IN DOLLARS after check-out. Alex struck that out within the hour:
 * we do not hand back cash on a stay. The reward is HiPoints, the spread is ours
 * in full, and the revenue behind the product is that spread plus the float on
 * money we hold against a supplier invoice.
 *
 * So: no dollar figure, no share of the margin, no "cashback" on this page.
 *
 * THREE WORDS THIS PAGE MUST NEVER USE
 *
 * "Discount" — we do not lower anybody's rate. We are quoted a net rate, we set
 * a price on top of it, and we hold that price under the public one. Calling the
 * gap a discount describes the wrong party's decision.
 *
 * "Commission" — not on this page and not in the app. The guest's number is the
 * guest's number; the word invites the question of whose margin it came out of.
 *
 * "Cashback" — the card pays cashback, in dollars, and that word is spoken for.
 * A stay earns points. Letting the two share a word is how a guest ends up
 * expecting a transfer that is never coming.
 *
 * WHAT IS DELIBERATELY NOT ON THIS PAGE
 *
 * The float. It is the larger half of the economics and it stays off the public
 * site until Nuitée confirms their invoicing terms in writing. The reason is in
 * the header of server/services/travel/float.service.ts: "we hold the guest's
 * payment until their October stay" and "we owe our supplier on invoice terms"
 * are the same bank balance and completely different things in law, and only the
 * second one keeps us out of travel-insolvency territory. A marketing sentence
 * that gets that backwards would be read back to us. TRAVEL_FLOAT.ENABLED is
 * false today; the page can describe it when the contract says we may.
 *
 * RULES
 *
 * 1. Only `HOLD_KEEPS.stays` may be rendered here, and nowhere else.
 * 2. No hotel or supplier is named on the page until it is agreed in writing.
 * 3. The reward is described as landing AFTER check-out, always. A stay that is
 *    cancelled earns nothing, and points credited at booking are points taken
 *    back from somebody who had already counted them.
 */

export const metadata: Metadata = {
  title: "Stays",
  description:
    "Book a hotel from inside HOLD and pay from the dollars you already hold. Priced under what the same room shows publicly, with no booking fee, and every night earns HiPoints.",
  alternates: { canonical: "/travel" },
};

export default function TravelPage() {
  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">Stays</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Book the room
                <br />
                <span className="text-text-muted">for less than it costs you.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Hotels quote travel companies a rate below the one they show the public.
                We book at that rate and price the room under what you would pay booking
                it yourself, so the saving is in the number you pay — not in something we
                promise to send you later. The nights you stay earn HiPoints.
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
                Three steps, and none of them ask you to leave the app or reach for a card.
              </p>
            </div>

            <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                n={1}
                title="Find the stay"
                body="Search a city and a set of dates the way you would anywhere else. Live availability, live rates, the map and the list showing the same rooms."
              />
              <Step
                n={2}
                title="Pay from your balance"
                body="The booking is settled out of the dollars in your HOLD account, from whichever account you choose at checkout. No card, no separate payment page, no booking fee on top."
              />
              <Step
                n={3}
                title="Points land after you check out"
                body="HiPoints for the stay are credited once it is completed, not when you book — a room you cancel earns nothing, and we would rather credit late than take points back off you."
              />
            </ol>
          </div>
        </section>

        {/* ─── The honest part ───────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What we can and cannot promise
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Fact
                title="Never above the public price"
                body="When the same room can be priced publicly we read that number and stay under it. If our own pricing would have landed above it, our price comes down — not the other way around."
              />
              <Fact
                title="It is not a discount"
                body="We are not lowering a hotel's rate; nobody can do that from outside. What you are seeing is a rate hotels quote to trade partners, priced under the one they publish themselves."
              />
              <Fact
                title="You earn points, not money back"
                body="A stay pays HiPoints. It does not pay dollars, and nothing is transferred to your balance afterwards — the whole of what you get out of booking here is in the price you paid and the points you earned. The card is the product that pays cash."
              />
              <Fact
                title="Cancellations follow the hotel"
                body="Whether a room is refundable, and until when, is the hotel's own policy — it is shown before you pay and we do not override it. What we handle is getting your money back to you when a cancellation qualifies."
              />
              <Fact
                title="We are the one you talk to"
                body="If something is wrong with a booking, the conversation is with us. That is not a preference: the reservation was made by us, and the hotel has no relationship with you to act on."
              />
              <Fact
                title="No hotel is named until it is signed"
                body="We will not put a brand on this page to make the inventory look bigger than it is. What you will find in the app is live availability, not a list of logos."
              />
            </div>

            <p className="mt-12 text-small text-text-faint max-w-2xl">
              <span aria-hidden>* </span>
              {RATE_DISCLAIMER} How far under the public price a given room lands depends
              on the rate that room was quoted at, so it moves with the booking.
            </p>

            {/* Every product page carries this section, and it names only the
                take that belongs to that product. See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h2 font-light text-text">
                How we make money here
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted">
                <p>
                  Hotels quote travel companies a net rate — the price they will accept for
                  the room — and expect the company to sell it for more. We add up to{" "}
                  {bps(HOLD_KEEPS.stays.markupOnNetBps)} to that rate. Then we look at what
                  the same room is showing publicly, and if our number is not comfortably
                  under it, ours comes down until it is.
                </p>
                <p className="text-text">
                  That gap is what we make, and we keep it. There is nothing else: no
                  booking fee, no service fee, no resort fee of our own, no charge for
                  paying from a particular account, and no fee taken at cancellation. One
                  number, disclosed here, already inside the price you were shown.
                </p>
                <p>
                  Which is also why we are straight about the points rather than dressing
                  them up as money back. A rewards programme paid out of a margin that may
                  not exist on a given room is a programme that gets quietly cut in its
                  first busy month. Points come out of the same place for every product, at
                  the same rate, whether the room was a good one for us or not.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Why this category ─────────────────────────────────── */}
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
            <p className="text-tiny uppercase tracking-wider text-amber">Why travel</p>
            <p className="mt-8 font-editorial text-h3 md:text-h2 text-text max-w-3xl mx-auto leading-snug">
              The cheapest thing we can give you is the price itself.
            </p>
            <p className="mt-8 text-lead text-text-muted max-w-2xl mx-auto">
              Every other travel app puts its margin in the price and then hands a slice of
              it back to you with a flourish, as though the two were unrelated. We would
              rather take the margin once, quietly, and let the number on the room be the
              reason you booked. Hotels are a category where a trade rate already exists
              before we arrive — so being cheaper does not cost us anything we had.
            </p>
            <p className="mt-8 text-small text-text-faint max-w-2xl mx-auto">
              See{" "}
              <Link href="/esim" className="text-text-muted hover:text-text underline">
                eSIM data plans
              </Link>{" "}
              for the other half of the trip, or{" "}
              <Link href="/hipoints" className="text-text-muted hover:text-text underline">
                how rewards work
              </Link>{" "}
              for the rest of the programme.
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
