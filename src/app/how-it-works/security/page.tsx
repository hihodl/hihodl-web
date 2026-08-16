import type { Metadata } from "next";
import Link from "next/link";

import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { SectionHairline } from "@/components/site/SectionHairline";
import { DocHeader, DocCard, DocLimit, DocAnswer, DocNext } from "@/components/site/Doc";

/**
 * /how-it-works/security — every gate on the account, and what each one stops.
 *
 * Sourced from the code:
 *   src/config/accountProtection.ts   the tier rule: 0 factors under $50, one
 *                                     factor from $50, two INDEPENDENT factors
 *                                     from $1,000. Independence = distinct
 *                                     failure domains, not distinct toggles.
 *   src/lib/stepUpAuth.ts             loosening a protection or revealing key
 *                                     material demands the strongest factor held
 *   src/auth/mfa.ts                   TOTP is the ACCOUNT gate; AppLock (PIN +
 *                                     biometric) is the DEVICE gate. Different
 *                                     things — the page must not blur them.
 *   app/onboarding/setup.tsx          passkey-first, no visible Skip; the
 *                                     escape hatch appears only on a genuine
 *                                     ceremony failure (TECH-311)
 *   server/api/recovery-codes.router  batches of 8, bcrypt-hashed, single-use,
 *                                     a new batch supersedes unused old ones
 *   server/api/sessions.router.ts     device list, revoke one, revoke all,
 *                                     new-device email on first sight
 *
 * NUMBERS: the two tier thresholds are the only figures on this page and they
 * come from PROTECTION_TIERS. If that array changes, this page is wrong. It is
 * not wired to rates.config because those are prices, not thresholds — but the
 * next person to touch PROTECTION_TIERS needs to grep for this file.
 *
 * DO NOT add a strength claim about the recovery codes ("impossible to guess",
 * a bits-of-entropy figure, anything of that shape). Describe what they are and
 * how they behave. The generator's actual strength is an engineering question
 * that is being looked at separately, and a marketing page must never be the
 * thing that makes a security claim load-bearing.
 */

export const metadata: Metadata = {
  title: "How your account is protected",
  description:
    "Passkeys, your device PIN, two-factor codes, recovery codes and the list of devices signed in — what each one protects, why HOLD asks for more as your balance grows, and what none of them can stop.",
  alternates: { canonical: "/how-it-works/security" },
};

const FAQ = [
  {
    q: "Why can I not skip the passkey?",
    a: "Because the alternative is a password, and passwords are how almost every account in the world gets taken. A passkey cannot be phished — it will not work on a site that merely looks like ours — cannot be reused across services, and cannot be leaked in someone else's data breach, because there is nothing to leak. It is also faster than typing. If the setup genuinely fails on your device, we let you carry on and ask again later; what we do not offer is a Skip button, because a skip you can take in three seconds during setup is a skip almost everyone takes.",
  },
  {
    q: "What is the difference between my PIN and my two-factor code?",
    a: "The PIN opens the app on the phone in your hand. The two-factor code proves it is you signing in to the account from anywhere at all. They protect against different people: the PIN is about someone holding your unlocked phone, two-factor is about someone in another country who has your email. Having one is not having the other.",
  },
  {
    q: "Someone knows my PIN. How bad is that?",
    a: "Bad, but not unlimited, and this is exactly the case two-factor is for. Anything that would weaken your security or expose your keys — turning off protections, raising a spending limit, revealing your recovery phrase — asks for your authenticator code, not your PIN. That code is generated on a different device, so someone who watched you type your PIN still cannot strip the account down. Without two-factor set up, that same request falls back to the PIN, and they can.",
  },
  {
    q: "Where should I keep the recovery codes?",
    a: "Anywhere that is not your email and not the phone the app is on. A screenshot in your photo library is inside the thing you are protecting against. Paper in a drawer is unfashionable and genuinely good. A password manager on a different account is good. The test is simple: if someone got into your email right now, would they find them?",
  },
  {
    q: "Can I use one code twice?",
    a: "No. Each of the eight is consumed the moment it works, so a code that helped you in once is dead. Generating a fresh set retires every unused code from the old set, which is what you should do if you ever think one has been seen.",
  },
  {
    q: "Do you email me when someone signs in?",
    a: "The first time a device we have never seen appears on your account, yes. You can also open the device list at any point, see every session with when it was last active, and end any of them — or all of them but the one you are holding, which is the right move if you are unsure and want to start clean.",
  },
  {
    q: "Do you have my passkey?",
    a: "No, and the design does not permit it. What we hold is the public half, which is only useful for checking a signature your device produced. The private half stays in your phone's secure hardware or your Apple or Google keychain, and never reaches us. This is also why we cannot recreate one for you.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <TopNav />

      <main>
        <DocHeader
          eyebrow="How HOLD works"
          title="Five locks."
          sub="You will meet two of them."
          lead="An account holding real money needs more than one way to stop someone else reaching it, and more than one way to let you back in. The trick is asking for the right amount at the right time — nothing while the account is empty, and more as there is more to lose."
        />

        {/* ─── The five ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="moonlight" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What each one is for
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                They are not five versions of the same thing. Each one stops a different
                person, and the reason you are asked for several is that the attacker who gets
                past one of them is usually stopped cold by another.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              <DocCard
                title="Your passkey — stops someone with your password"
                body="It replaces the password rather than adding to it. Your face or fingerprint unlocks a key held in your phone's secure hardware, and nothing that could be stolen, guessed or phished is ever typed. Because it syncs through your Apple or Google account, a new phone signs in without a fuss."
              />
              <DocCard
                title="Your PIN — stops someone holding your phone"
                body="Set during setup, checked when you open the app and again before anything that moves money. It never leaves the device and is not a login for anything. Face ID sits in front of it for speed; the PIN is what is underneath when Face ID will not read."
              />
              <DocCard
                title="Two-factor — stops someone with your email"
                body="A six-digit code from an authenticator app on a separate device. Optional, strongly recommended, and it is what turns a stolen phone from a disaster into an inconvenience: it is required before anything that weakens the account or reveals your keys, and it lives somewhere the thief is not."
              />
              <DocCard
                title="Recovery codes — stop you being locked out"
                body="Eight one-time codes, generated once and yours to keep. We store only a scrambled version, so we cannot read them back to you and neither can anyone who reads our database. Each works once. A fresh set retires any old ones you have not used."
              />
              <DocCard
                title="Your device list — stops someone who is already in"
                body="Every session on your account, with the device and when it was last active. Sign out any of them from here, or all of them at once. The first time a device we have never seen signs in, you get an email about it without having asked."
              />
              <DocCard
                title="Step-up — stops the panicked five minutes"
                body="Tightening your security never asks for anything. Loosening it always does: turning a protection off, raising a limit, revealing your phrase. It demands the strongest factor you hold, which is deliberate — the moments when someone talks you into weakening your own account are the moments worth slowing down."
              />
            </div>
          </div>
        </section>

        {/* ─── The rule ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-night">
          <SectionHairline tone="blue" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                Why we ask for more later
              </h2>
              <p className="mt-6 text-body text-text-muted leading-relaxed">
                Security you are made to set up before you have anything to protect is
                security you click through. So the app scales what it asks for to what is
                actually at stake, by one written-down rule.
              </p>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-px bg-[color:var(--color-hairline)] border border-[color:var(--color-hairline)] rounded-card overflow-hidden">
              <TierRow
                when="An empty or nearly empty account"
                need="Nothing beyond the passkey"
                why="There is nothing here to lose yet, and nagging you now only teaches you to dismiss us later."
              />
              <TierRow
                when="Once you are holding around $50"
                need="One way back in"
                why="Real money, so one independent recovery method: recovery codes, a phone number, or your phrase if you use a mode that shows it."
              />
              <TierRow
                when="Once you are holding around $1,000"
                need="Two independent ways back in"
                why="Enough that losing it would genuinely hurt. Two, so that any single accident — a lost phone, a closed email, a dead laptop — is survivable."
              />
            </div>

            <div className="mt-12 max-w-3xl rounded-card border border-[color:var(--color-hairline)] bg-white/[0.03] p-8">
              <h3 className="font-display text-h4 font-light text-text leading-snug">
                &ldquo;Independent&rdquo; is doing real work in that sentence
              </h3>
              <p className="mt-4 text-body text-text-muted leading-relaxed">
                We count things that can fail separately, not boxes ticked. Two passkeys that
                both live in the same iCloud account are one method, not two — lose the Apple
                account and both are gone at once. So the second thing we ask for is always
                somewhere else entirely. It is the difference between two locks on one door
                and two doors.
              </p>
            </div>

            <p className="mt-8 max-w-3xl text-small text-text-faint">
              <span aria-hidden>* </span>
              Approximate figures, in US dollars, and they may be tuned. The app shows you
              exactly where you stand and what is missing.
            </p>
          </div>
        </section>

        {/* ─── Limits ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-abyss">
          <SectionHairline tone="amber" />
          <div className="container-page section relative">
            <div className="max-w-2xl">
              <h2 className="font-display text-h2 font-light text-text">
                What none of this stops
              </h2>
            </div>

            <div className="mt-14 max-w-3xl flex flex-col gap-5">
              <DocLimit title="Somebody who has your recovery phrase does not need the app.">
                <p>
                  Every lock on this page is a lock on HOLD. The phrase reaches your money
                  from any wallet ever written, and someone holding it simply uses one of
                  those and never comes near our PIN, our two-factor or our device list.
                </p>
                <p>
                  Which is why the default mode never shows you the phrase, and why the app
                  asks for your strongest factor before revealing it in the modes that do. If
                  anyone ever asks you for those words — support, a giveaway, someone helpful
                  in a chat — that is the whole attack, and there is no version of it that is
                  legitimate.
                </p>
              </DocLimit>

              <DocLimit title="Your Apple or Google account is part of your security now.">
                <p>
                  Passkeys sync through it, which is what makes a new phone painless. It also
                  means whoever controls that account controls a passkey. It is worth having
                  strong two-factor there too — and it is the specific reason your second
                  recovery method must not live in the same place.
                </p>
              </DocLimit>

              <DocLimit title="We cannot reset any of it for you.">
                <p>
                  Not the two-factor, not the passkey, not a recovery code you did not keep.
                  There is no support process that ends with us letting you in, because a
                  support process that could do that is a process someone else can talk their
                  way through — and account takeover through support is one of the most
                  common ways people lose money at companies that do offer it.
                </p>
                <p>
                  The trade is honest and it is not free:{" "}
                  <Link
                    href="/how-it-works/self-custody"
                    className="text-text hover:text-amber underline"
                  >
                    nobody can take your money, including us
                  </Link>
                  , and the price of that is that nobody can rescue you either.
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

        <DocNext current="/how-it-works/security" />
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

function TierRow({ when, need, why }: { when: string; need: string; why: string }) {
  return (
    <div className="bg-night/60 px-8 py-7 flex flex-col md:flex-row md:items-baseline gap-2 md:gap-8">
      <p className="md:w-64 shrink-0 text-small text-text-faint">{when}</p>
      <div>
        <p className="text-body text-text">{need}</p>
        <p className="mt-2 text-small text-text-muted leading-relaxed">{why}</p>
      </div>
    </div>
  );
}
