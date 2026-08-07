import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { HIHODL_KEEPS, RATE_DISCLAIMER } from "@/lib/rates.config";

/**
 * /smart-account — what the product is, in the words a customer would use.
 *
 * WHY THIS PAGE EXISTS
 *
 * We are about to tell people their money grows by itself. That claim invites
 * exactly one question -- "so how do YOU make money?" -- and a company that
 * cannot answer it in a sentence gets called a scam, correctly. This is the
 * page a social post links to when someone asks in the replies.
 *
 * RULES FOR ANYTHING ADDED HERE
 *
 * 1. No jargon. Not one word a customer would have to look up. If a sentence
 *    needs a glossary it is not finished.
 * 2. No number that is not either fixed or pulled from rates.config.ts. Rates
 *    float; a hardcoded percentage here becomes a lie on a schedule.
 * 3. The share we keep is stated on this page, in full, and this page is the
 *    only place it appears. There is no fee schedule to defer to and there will
 *    not be one: an aggregate of every take we charge is a document written for
 *    a competitor, not for the person deciding whether to use this product. If
 *    a number belongs to Smart Account it belongs here; if it belongs to
 *    another product it belongs on that product's page.
 * 4. Never claim it works everywhere. It does not, and the one thing worse than
 *    a limit is a limit somebody discovers after signing up.
 *
 * STRUCTURE
 *
 * Same shell as /rewards and /travel: alternating night/abyss sections, a
 * hairline at each seam, card grids rather than prose walls, and the "How we
 * make money here" block last. A reader who lands on two product pages should
 * not have to learn two layouts to find the same answer.
 */

export const metadata: Metadata = {
  title: "Smart Account",
  description:
    "Your balance earns while it sits there, and you can spend it whenever you want. What that means, how it works, and exactly what HIHODL keeps.",
  alternates: { canonical: "/smart-account" },
};

const FAQ = [
  {
    q: "Where does the money come from?",
    a: "Around the world, people and businesses borrow dollars and pay interest to do it. Your balance joins the pool that lends to them, and you receive a share of what they pay. It is the same reason a savings account pays you anything at all — the bank lends your deposit out. The difference is that a bank keeps most of the interest and hands you a fraction, and we tell you exactly what our share is.",
  },
  {
    q: "Is my money locked up?",
    a: "No. There is no notice period, no minimum, no term and no penalty. Spend it, send it, withdraw it — whenever you want, in full. If your money happens to be earning at that moment, it stops earning and becomes spendable in the same tap. You will not see two balances, because you do not have two balances.",
  },
  {
    q: "When do I get the interest?",
    a: "Continuously. There is no payment date and no monthly credit — the amount under your balance is what has been earned so far, and it is already yours. Nothing has to be claimed and nothing is held back until a cut-off.",
  },
  {
    q: "Can HIHODL take my money?",
    a: "No, and this is not a promise — it is how the account is built. Your money stays in your own name the entire time. We can help it start earning, and that is the only thing we can do with it. There is no button on our side that moves your money to us, because we never built one.",
  },
  {
    q: "What if HIHODL disappears tomorrow?",
    a: "Your money is not ours to lose. It sits in your name, and you keep the keys to it. If we vanished overnight you would still be able to reach it without us.",
  },
  {
    q: "Do I have to do anything?",
    a: "Turn it on once. After that, money that arrives starts earning by itself. Every few months we will ask you to confirm you still want that — one tap, and it is deliberately temporary so that nobody, including us, has an open-ended say over your money.",
  },
  {
    q: "Is the rate guaranteed?",
    a: "No. It moves with what borrowers are paying, the same way any savings rate moves. We show you the current rate in the app, and it can go up or down. Nobody who guarantees you a fixed return on this kind of product is telling you the truth.",
  },
  {
    q: "Can I lose money?",
    a: "It is not a bank deposit and it is not government insured, so it is not risk-free — no honest product page would say otherwise. Your balance is held in dollars, so it does not swing with the price of anything. The risk is that the lending pools we use fail in some way. We only use large, long-established ones, and you can turn the whole thing off and simply hold your dollars if you would rather not take that risk at all.",
  },
];

export default function SmartAccountPage() {
  const savingsShare = HIHODL_KEEPS.savingsInterestShareBps / 100;
  const mainShare = HIHODL_KEEPS.mainInterestShareBps / 100;

  return (
    <>
      <TopNav />

      <main>
        {/* ─── Header ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <div className="absolute inset-0 bg-moonlight-glow opacity-30 pointer-events-none" aria-hidden />
          <div className="container-page section relative">
            <div className="max-w-3xl">
              <p className="text-tiny uppercase tracking-wider text-moonlight">Smart Account</p>
              <h1 className="mt-6 font-display text-h1 font-light text-text leading-tight">
                Your money works
                <br />
                <span className="text-text-muted">while you are not looking.</span>
              </h1>
              <p className="mt-8 text-lead text-text-muted">
                Most accounts hold your money still. Yours does not. The balance sitting in
                your account earns while it sits there, and you can still spend it, send it
                or withdraw it the second you want to. No notice, no minimum, no lock-up.
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
                There is no separate savings product to open, no transfer to remember and no
                minimum to reach. The account you already have is the account that earns.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card
                title="It earns where it sits"
                body="Money in your account does not sit idle. It earns quietly in the background, and you never have to move it anywhere or think about it."
              />
              <Card
                title="It is still spendable"
                body="Nothing about earning makes your money harder to reach. If we ever made you choose between earning and spending, we would have built the wrong thing."
              />
              <Card
                title="You turn it on once"
                body="After that it runs by itself. Every few months we ask you to confirm you still want it — one tap, and usually alongside something you were doing anyway."
              />
            </div>
          </div>
        </section>

        {/* ─── Control ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                You stay in control, on purpose
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Your money is yours the whole time. It stays in your name, you hold the keys,
                and we cannot move it anywhere except into the thing you turned on.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <Fact
                title="Permission is temporary by design"
                body="Every few months we ask you to confirm it, with a single tap. Most people never notice, because we ask alongside something they were already doing. It is deliberate friction, and it exists so that nobody — including us — ever holds an open-ended say over your money."
              />
              <Fact
                title="It is bounded, not open-ended"
                /*
                 * This card used to end "money that arrives afterwards simply
                 * sits still until you say so again. Nothing is lost and nothing
                 * breaks", which sold the failure case as a feature. Money
                 * sitting still IS the thing broken: a balance that is half
                 * earning and half idle is the one state this product exists not
                 * to have. The permission still runs out on purpose; what
                 * changed is that we now measure how fast it is being spent and
                 * ask before it does.
                 */
                body="What you agree to is an amount and a date, not a blank cheque. We watch how fast you are using it and ask you to renew before it runs out, so your balance is never half earning and half sitting still. If you ignore us, what is already earning carries on — the permission only ever governs what happens next."
              />
              <Fact
                title="Turning it off changes nothing else"
                body="You can turn the whole thing off at any moment and keep your dollars exactly as they are. What you have already earned stays yours and keeps earning while you decide."
              />
              <Fact
                title="We never hold your money"
                body="There is no account of ours that your balance passes through and no instruction on our side that could send it anywhere but back to you. That is a property of how it is built, not a policy we could change."
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

            {/* Every product page carries this section, and it names only the
                take that belongs to that product. See rates.config.ts. */}
            <div className="mt-20 max-w-2xl border-t border-white/10 pt-10">
              <h2 className="font-display text-h2 font-light text-text">
                How we make money here
              </h2>
              <div className="mt-8 space-y-6 text-body text-text-muted">
                <p>
                  Your balance earns interest. We keep a share of that interest, and you keep
                  the rest. We never take a share of your money itself — only of what it
                  earns. If it earns nothing, we get nothing.
                </p>
              </div>

              <div className="mt-10 overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
                <table className="w-full min-w-[420px] border-collapse text-left">
                  <thead>
                    <tr>
                      {["Where your money is", "We keep", "You keep"].map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={`pb-4 text-tiny uppercase tracking-wider text-text-faint font-normal border-b border-[color:var(--color-hairline-strong)] ${
                            i === 0 ? "" : "text-right pl-6"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <ShareRow
                      label="Main"
                      note="Your everyday balance. Nothing to set up."
                      keepPct={mainShare}
                    />
                    <ShareRow
                      label="Savings and Pockets"
                      note="Money you chose to set aside."
                      keepPct={savingsShare}
                    />
                  </tbody>
                </table>
              </div>

              <p className="mt-8 text-body text-text-muted leading-relaxed">
                Money you deliberately set aside costs you less, because you did the work of
                putting it there. Money that simply sits in Main costs more, because we do
                that work for you. Move money between them whenever you like — we charge each
                share only for the days your money actually spent there.
              </p>

              <p className="mt-6 text-small text-text-faint">
                <span aria-hidden>* </span>
                {RATE_DISCLAIMER} There is no account fee, no minimum balance and no charge
                to move money between Main, Savings and Pockets. The two percentages above
                are everything we make on this product — there is no other charge, and
                nothing further to look up. What the card gives back and what you can borrow
                are on{" "}
                <Link href="/rewards" className="text-text-muted hover:text-text underline">
                  the rewards page
                </Link>
                .
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
                whether it is available to you before you turn anything on, and everything
                else in HIHODL works either way.
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

function ShareRow({
  label,
  note,
  keepPct,
}: {
  label: string;
  note: string;
  keepPct: number;
}) {
  return (
    <tr>
      <td className="py-4 pr-6 border-b border-[color:var(--color-hairline)]">
        <span className="text-body text-text">{label}</span>
        <span className="block mt-1 text-small text-text-faint">{note}</span>
      </td>
      <td className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]">
        <span className="font-mono tabular-nums text-body text-text-muted">{keepPct}%</span>
      </td>
      <td className="py-4 pl-6 text-right align-top border-b border-[color:var(--color-hairline)]">
        <span className="font-mono tabular-nums text-body text-amber">{100 - keepPct}%</span>
      </td>
    </tr>
  );
}
