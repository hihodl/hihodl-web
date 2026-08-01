import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { HIHODL_KEEPS, RATE_DISCLAIMER, bps } from "@/lib/rates.config";

/**
 * /travel — what travel rewards are and how they will work.
 *
 * EXPLANATORY ONLY. No exit links, no partner buttons, no outbound tracking.
 *
 * A click-out endpoint was scoped and dropped on purpose: the only way to keep
 * affiliate attribution alive from a mobile app is to force the booking into a
 * system browser tab, and the partner's own app then intercepts the link,
 * strips the parameters and takes the commission with it. Sending people into a
 * browser that is about to close on them is a worse experience and earns
 * nothing. The page exists so the story is written down and ready for the day
 * the card ships and the flow lives inside the product.
 *
 * TWO WORDS THIS PAGE MUST NEVER USE.
 *
 * "Discount" — we do not set partner prices and we cannot lower them. What we
 * do is share a commission the partner pays us. Calling that a discount is a
 * claim about someone else's pricing that we have no standing to make.
 *
 * A partner's name — not one appears here, and none may be added until the
 * agreement is signed. Naming an unsigned partner is a promise made with
 * somebody else's brand.
 */

export const metadata: Metadata = {
  title: "Travel rewards",
  description:
    "How travel rewards work at HIHODL: we are paid a commission by travel partners and share it with you as cashback. We do not set partner prices. Rates vary by partner and are not guaranteed.",
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
              <p className="text-tiny uppercase tracking-wider text-moonlight">
                Travel rewards · in development
              </p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Cashback on travel,
                <br />
                <span className="text-text-muted">paid out of our share.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Travel partners pay a commission when someone books through them. When that
                happens through HIHODL, most of that commission goes to you as cashback.
                The price you pay is set by the partner and we never touch it.
              </p>
              <p className="mt-8 text-small text-text-faint max-w-2xl">
                This page explains how the programme works. It is not live yet — it starts
                with the card.
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
                Three steps, and it is worth being precise about which of them we control.
              </p>
            </div>

            <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                n={1}
                title="You book"
                body="You choose a flight or a stay and you pay the partner directly, at the partner's price. We are not in the transaction and we cannot change what you are charged."
              />
              <Step
                n={2}
                title="The partner pays us"
                body="Travel partners run commission programmes. When a booking is credited to us, they pay us a percentage of it out of their own margin."
              />
              <Step
                n={3}
                title="We pass most of it on"
                body="That commission becomes cashback on your account, in dollars. It is money we received and shared, not a reduction we negotiated."
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
                title="It is not a discount"
                body="We do not set partner prices, we cannot lower them, and we will never tell you a booking is cheaper because you came through us. What changes is what lands back in your account afterwards."
              />
              <Fact
                title="The rate depends on the partner"
                body={`Every partner runs its own programme and every programme pays differently — by product, by season, by market. Commissions in this category typically run to around ${bps(HIHODL_KEEPS.partnerCommissionBps)}, and what we can share follows whatever we are actually paid.`}
              />
              <Fact
                title="Rates move"
                body={`${RATE_DISCLAIMER} A partner can change its commission at any time, and the cashback rate moves with it. Whatever rate is shown when you book is the rate for that booking.`}
              />
              <Fact
                title="Cancellations reverse it"
                body="Partners pay after a stay is completed or a booking becomes final. If you cancel, the commission is reversed and so is the cashback — usually weeks after the booking, which is why it is not credited instantly."
              />
              <Fact
                title="No partner is named until it is signed"
                body="We will not put a company's name on this page to make a programme look bigger than it is. When an agreement is signed, that partner appears here, and not before."
              />
              <Fact
                title="It is a category, not everything"
                body="Travel cashback applies to travel bookings made through the programme. It does not change the cashback on the rest of your spending, which works the same as always."
              />
            </div>

            <p className="mt-12 text-small text-text-faint max-w-2xl">
              <span aria-hidden>* </span>
              {RATE_DISCLAIMER} Rates vary by partner, by product and by market.{" "}
              <Link href="/fees" className="text-amber hover:underline">
                Our full fee schedule
              </Link>{" "}
              states what we keep of a partner commission, alongside everything else.
            </p>
          </div>
        </section>

        {/* ─── Why a category and not a bigger flat rate ─────────── */}
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
              A high rate on one category we are paid for beats a thin rate on everything we
              are not.
            </p>
            <p className="mt-8 text-lead text-text-muted max-w-2xl mx-auto">
              Cashback has to be funded by something. Travel is a category where somebody
              else already pays a commission, so the rate can be generous without being a
              transfer out of the treasury — which is the only kind of reward programme that
              survives its first busy month.
            </p>
            <p className="mt-8 text-small text-text-faint max-w-2xl mx-auto">
              See{" "}
              <Link href="/rewards" className="text-text-muted hover:text-text underline">
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
