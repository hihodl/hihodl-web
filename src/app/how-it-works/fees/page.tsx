import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocHeader, DocStep, DocLimit, DocAnswer, DocNext } from "@/components/site/Doc";
import { FREE_ALLOWANCE, usd } from "@/lib/rates.config";

/**
 * /how-it-works/fees — who pays the network fee, and when that stops being us.
 *
 * Sourced from the code:
 *   backend swap-fees.service.ts       NETWORK_FEE_SPONSOR_CAP_USD, FREE_MONTHLY_CAP_USD
 *                                      → both now live in FREE_ALLOWANCE
 *   backend gasless-routing.service    the routing rule this page discloses:
 *                                      enough native balance → YOU pay the gas
 *                                      from it; not enough → we sponsor
 *   backend evm-relayer.service.ts     the meta-transaction path on EVM
 *
 * WHAT THIS PAGE MUST NOT RENDER. HOLD_KEEPS.swapMarkupFreeBps belongs to
 * /invest and only /invest — rates.config rule 3. This page is about the
 * NETWORK's fee (a real cost paid to strangers) and never about our margin.
 * Two different things that a reader will happily conflate if we let them, so
 * the page separates them explicitly and links out for the other one.
 *
 * The native-balance routing rule is disclosed on purpose. It is the one thing
 * here capable of surprising someone — you hold a bit of SOL, and a transaction
 * quietly spends some of it — and a fee page that omits the surprising case is
 * the reason nobody trusts fee pages.
 */

export const metadata: Metadata = {
  title: "Who pays the network fee",
  description:
    "Every movement on these networks costs a small fee paid to the network itself. HOLD covers it on the first $500 of conversions a month, up to $0.10 each. Exactly how that works and exactly when you pay.",
  alternates: { canonical: "/how-it-works/fees" },
};

const FAQ = [
  {
    q: "Is sending money to someone free?",
    a: "Sending dollars to another person costs you nothing from us, and on the fast networks the network's own fee is a fraction of a cent that we absorb without thinking about it. The allowance on this page exists for conversions, which are the operations heavy enough to be worth counting.",
  },
  {
    q: "What happens on the first of the month?",
    a: "The counter resets. It runs on calendar months, not a rolling window, and it counts the value you converted rather than the number of times you did it. Nothing carries over and nothing is lost — the allowance is not a balance you are spending down.",
  },
  {
    q: "How will I know if I am about to be charged?",
    a: "The screen tells you before you confirm, in dollars and cents, as part of the total. There is no line item that appears afterwards. If a transaction is going to cost you something, you see the number while you can still decide against it.",
  },
  {
    q: "Why does the same action cost different amounts?",
    a: "Because the fee is set by the network, not by us, and it moves with how busy the network is — like surge pricing, except nobody collects it. The same transfer might cost a fraction of a cent at one hour and several cents at another. It is one of the reasons the app prefers the cheaper networks unless something requires otherwise.",
  },
  {
    q: "Is this how HOLD makes money?",
    a: "No. Covering the fee costs us money — that is the point of it. What we make is described on the page of whichever product you are using, and never here, because a fee paid to a network is not revenue and putting them in one place invites you to confuse them.",
  },
];

export default function FeesPage() {
  return (
    <>
      <TopNav />

      <main>
        <DocHeader
          eyebrow="How HOLD works"
          title="Somebody has to pay"
          sub="the network. Usually it is us."
          lead={`Every movement on a public network carries a small fee that goes to the network itself — not to us, and not to anyone we could ask for a discount. Most apps pass it to you and call it gas. We cover it on the first ${usd(FREE_ALLOWANCE.monthlyVolumeUsd)} of conversions each month, up to ${usd(FREE_ALLOWANCE.networkFeeCeilingUsd)} on any single one.`}
        />

        {/* ─── The mechanics ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                How we pay a fee on your behalf
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                The awkward part of these networks is that paying the fee normally requires
                holding the network&rsquo;s own token — so someone with a hundred dollars and
                no other holdings cannot move their hundred dollars. That is a genuinely
                stupid piece of design, and it is worth understanding how it gets removed.
              </p>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-10">
              <DocStep
                n={1}
                title="You sign, but you do not send"
                body="Your phone produces a signed instruction — the sealed envelope. Signing costs nothing; it is a piece of maths on your device. What costs money is putting it on the network."
              />
              <DocStep
                n={2}
                title="We put it on the network and pay the fee"
                body="Our system takes your signed instruction, submits it, and pays the network's fee out of our own funds. It cannot alter what you signed: the instruction is sealed, and a network rejects a tampered one outright."
              />
              <DocStep
                n={3}
                title="You are never holding the network's token"
                body="No topping up, no keeping a little something aside so your money can move, no arriving at a payment to find you cannot make it. Your balance is dollars, all of it is spendable, and the mechanics stay ours."
              />
            </div>
          </div>
        </section>

        {/* ─── When you pay ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                The three times you pay it yourself
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Told plainly, because an allowance whose edges are vague is a bill you did not
                agree to.
              </p>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-5">
              <Case
                title={`Past ${usd(FREE_ALLOWANCE.monthlyVolumeUsd)} of conversions in a month`}
                body="Beyond that, the network's fee is yours. It is not a penalty and it is not a different rate — it is the same few cents, now paid by you instead of by us. The counter resets on the first."
              />
              <Case
                title={`On a single fee above ${usd(FREE_ALLOWANCE.networkFeeCeilingUsd)}`}
                body={`We cover up to ${usd(FREE_ALLOWANCE.networkFeeCeilingUsd)} per conversion and you pay only the excess — not the whole fee. On the fast networks this effectively never happens. On Ethereum at a busy hour it can, and the app shows you the number before you confirm.`}
              />
              <Case
                title="When you already hold the network's own token"
                body="If your account happens to hold enough of it to cover the fee, the transaction pays from there rather than from us. Nothing extra is charged and nothing is hidden — but it does mean a small holding of a network token can go down slightly after a transaction, and you should not be surprised by that."
              />
            </div>
          </div>
        </section>

        {/* ─── Not our fee ────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                This is not what HOLD charges
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Worth separating, because they arrive in the same sentence and are not the
                same thing. The network fee is a real cost paid to strangers who keep the
                network running. What HOLD makes is a different number, and it is written on
                the page of the product it applies to — never gathered into a single schedule,
                which is a document that serves competitors more than customers.
              </p>
            </div>

            <div className="mt-12 max-w-3xl flex flex-wrap gap-3">
              <Chip href="/invest" label="What converting costs" />
              <Chip href="/savings" label="What Savings costs" />
              <Chip href="/smart-account" label="What Smart Account costs" />
              <Chip href="/hipoints" label="How HiPoints work" />
            </div>

            <div className="mt-16 max-w-3xl">
              <DocLimit title="The allowance is a policy, not a promise.">
                <p>
                  We can change what we cover, and if these networks became dramatically more
                  expensive we would have to. What we will not do is change it quietly: the
                  figures on this page and in the app are the same figures, and if they move
                  you will see them move before it costs you anything.
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

        <DocNext current="/how-it-works/fees" />
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Case({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-8">
      <h3 className="font-display text-h4 font-light text-text leading-snug">{title}</h3>
      <p className="mt-4 text-body text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Chip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-5 py-3 rounded-pill border border-[color:var(--color-hairline-strong)] text-small text-text-muted hover:text-text hover:bg-white/5 transition-colors duration-180"
    >
      {label}
    </Link>
  );
}
