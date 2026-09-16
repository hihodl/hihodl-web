import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocHeader, DocCard, DocStep, DocLimit, DocAnswer, DocNext } from "@/components/site/Doc";

/**
 * /how-it-works/self-custody — the "who actually holds it" page.
 *
 * Sourced from the code, not from the pitch:
 *   src/lib/vault.ts (wallet)     scrypt(passphrase) + server pepper → HKDF →
 *                                 AES-256-GCM over the mnemonic
 *   server/api/security.router.ts per-user 32-byte pepper, stored encrypted,
 *                                 released only to an authenticated session
 *   wallet CLAUDE.md              SEED_PRIMARY in SecureStore; one mnemonic,
 *                                 every subaccount by derivation index
 *
 * The honest shape, which is what this page has to convey without diagrams: we
 * hold the encrypted blob and the pepper, your device holds the passphrase, and
 * two out of three does not open it. Do not upgrade that into "we hold nothing"
 * — we hold plenty, it is just useless.
 *
 * THE LIMIT ON THIS PAGE IS NOT OPTIONAL. Stablecoin issuers maintain freeze
 * lists and can freeze an address holding their token. "Nobody can freeze it"
 * is false and we do not get to say it, anywhere on this site.
 */

export const metadata: Metadata = {
  title: "Who holds your money",
  description:
    "HOLD is non-custodial: your money sits in your own name and every movement is signed on your device. What that protects you from, how the keys are actually stored, and the one case where it is not the whole story.",
  alternates: { canonical: "/how-it-works/self-custody" },
};

const FAQ = [
  {
    q: "If you cannot move my money, how does the app move it?",
    a: "It does not. Your phone does. When you tap send, the instruction is signed on your device with your key, and what reaches us is an already-signed instruction we pass on to the network. We are the postman, and the envelope is sealed. This is also why a HOLD employee cannot move your money for you if you ask nicely, and why a court order served on us cannot make us move it either — the thing being asked for does not exist on our side.",
  },
  {
    q: "So what happens if HOLD shuts down?",
    a: "Your money is not on our books, so it is not part of anything that would be wound up. It sits at addresses in your own name on public networks that keep running whether we exist or not. In Hybrid or Native mode you already have the recovery phrase that reaches those addresses from any other wallet in the world. We would also publish what you need to do it — but the point is that the money is already outside us, not that we promise to be nice on the way out.",
  },
  {
    q: "Can you see my balance?",
    a: "Yes. We can see the addresses your account uses, so we can see what is in them and what has moved — that is how the app shows you a balance at all, and anyone else looking at the public network can see the same thing. What we cannot do is anything about it. On Pro, your incoming payments land on rotating addresses, so an outside observer watching one address does not get your whole income history.",
  },
  {
    q: "Do I have to write down twelve words?",
    a: "Not unless you want to. In the default mode we never show them to you, and getting back in is done with your passkey and your recovery codes instead — the things people actually manage to keep. The phrase still exists underneath, and if you switch to Hybrid or Native mode you can see it and write it down. Both routes reach the same money.",
  },
  {
    q: "What if I lose my phone?",
    a: "Sign in on the new one with your passkey. Passkeys sync through your Apple or Google account, so on a replacement phone this usually takes a few seconds and no recovery codes at all. If the passkey is gone too, a recovery code gets you back. Losing everything at once is what the recovery codes exist to prevent, which is why the app keeps asking about them once your balance is worth something.",
  },
  {
    q: "Is this insured?",
    a: "No. There is no deposit guarantee scheme behind a non-custodial account, in any country, and any company telling you otherwise about this kind of product is misleading you. What you get instead is that there is no institution in the middle whose failure could take your money down with it — a different protection, not a stronger one, and you should decide for yourself which you would rather have.",
  },
];

export default function SelfCustodyPage() {
  return (
    <>
      <TopNav />

      <main>
        <DocHeader
          eyebrow="How HOLD works"
          title="Your money is in your name."
          sub="Ours is a different account."
          lead="Most apps that hold dollars for you hold them in the company's name, in the company's account, and show you a number that represents your claim on it. HOLD does not work that way. The money sits at addresses that belong to your account, and it takes a signature from your phone to move a cent of it — including for us."
        />

        {/* ─── What this buys you ─────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What that actually changes
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                &ldquo;Non-custodial&rdquo; is an industry word for a very ordinary idea: we
                are not holding your money, so we cannot do the things a company holding your
                money can do to you.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
              <DocCard
                title="We cannot freeze it"
                body="There is no button in our systems that suspends your balance, because there is no balance of yours in our systems to suspend. If we decided tomorrow that we did not want you as a customer, the most we could do is stop serving you the app. Your money would carry on sitting where it sits."
              />
              <DocCard
                title="We cannot spend it"
                body="Not for you, not by mistake, not under pressure. Every movement needs a signature that only your device can produce. This holds for the useful things too, which is the honest cost: we cannot undo a payment you regret, because we could not have made it in the first place."
              />
              <DocCard
                title="Our problems are not your problems"
                body="If HOLD ran out of money tomorrow, none of what you are holding would be part of the mess. Customer money being caught up in a company's collapse is possible because the company was holding it. Here it never was."
              />
            </div>
          </div>
        </section>

        {/* ─── How the key is actually stored ─────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Where the key lives
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                A key that only exists on one phone is lost with that phone. A key we could
                restore for you is a key we could use. The way out of that is to split it, so
                that neither side holds enough on its own.
              </p>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-10">
              <DocStep
                n={1}
                title="Your phone makes the key, and never sends it"
                body="It is generated on the device, in the storage the operating system reserves for secrets — the same place your saved passwords and card details live, protected by the phone's own security chip. It does not travel to us in a form we could read, at setup or ever."
              />
              <DocStep
                n={2}
                title="A locked copy goes to us, so a lost phone is not a lost account"
                body="Before it leaves, your device encrypts it with a secret that stays on the device. What arrives with us is a sealed blob. We store it, we back it up, and we cannot open it — which is the entire point of doing it this way rather than the easy way."
              />
              <DocStep
                n={3}
                title="We add a second lock, and hold that one"
                body="A random secret of ours, unique to your account, goes into the encryption alongside your device's secret. So opening the blob needs both halves: the one on your phone and the one we release only to a properly signed-in session. Someone who stole our entire database would have our half of a lock and nothing to turn it with."
              />
              <DocStep
                n={4}
                title="Every subsequent account comes from that one key"
                body="Main, Savings, your Pockets, and the addresses on each network are all derived from the same key by a published, standard method. That is why you never manage a second phrase, and why moving to a new phone brings everything back rather than one account of five."
              />
            </div>

            <p className="mt-12 max-w-3xl text-small text-text-faint">
              The building blocks are all standard and public — scrypt to turn your device
              secret into a key, HKDF to combine it with ours, AES-256-GCM to do the
              encrypting. We did not invent any cryptography, which is the correct number of
              cryptographic primitives for a company to invent.
            </p>
          </div>
        </section>

        {/* ─── The limits ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Where this stops being true
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Three of them, and the first is the one nobody in this industry puts on a
                marketing page.
              </p>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-5">
              <DocLimit title="We cannot freeze your money. The people who issue the dollars can.">
                <p>
                  The digital dollars in your account are issued by regulated companies, and
                  those companies keep the ability to freeze a specific address holding their
                  token. They use it rarely and generally under a court order, usually against
                  addresses tied to theft or sanctions. But it exists, it does not need our
                  cooperation, and no wallet on earth can prevent it.
                </p>
                <p>
                  So the accurate sentence is the one we use: we cannot freeze your account.
                  Not that nobody can. Anyone selling you the second sentence is either
                  misinformed or counting on you being.
                </p>
              </DocLimit>

              <DocLimit title="A payment that has gone is gone.">
                <p>
                  There is no chargeback, no reversal and no recall. If you send to the wrong
                  person, we cannot claw it back — the same property that stops us seizing your
                  money stops us retrieving it. The app pushes back hard on first-time
                  recipients and on addresses that do not look right, because prevention is
                  the only tool that exists here.
                </p>
              </DocLimit>

              <DocLimit title="If you lose every way back in, we cannot let you in.">
                <p>
                  Your passkey, your recovery codes, your phone: lose all of them at once and
                  the account is unreachable, by you and by us. We would not be withholding
                  anything — we genuinely could not do it, and a company that could do it for
                  you could also do it to you.
                </p>
                <p>
                  This is why the app gets insistent about a second recovery method once you
                  are holding real money, and why{" "}
                  <Link
                    href="/how-it-works/security"
                    className="text-text hover:text-amber underline"
                  >
                    that whole system
                  </Link>{" "}
                  has a page of its own.
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

        <DocNext current="/how-it-works/self-custody" />
      </main>

      <Footer />
    </>
  );
}
