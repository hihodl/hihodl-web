"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { Button } from "@/ui/components/Button";
import { Wordmark } from "@/components/site/Wordmark";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function EsimLegalPage() {
  return (
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#060B10] to-[#0B1520]">
        {/* ==== TOP BAR ==== */}
        <div className="flex w-full flex-col items-center justify-center bg-[#0a141e66] px-6 py-6 sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 mobile:px-2 mobile:py-2 mb-6 md:mb-8">
          <div className="flex w-full max-w-[1280px] items-center justify-between rounded-2xl bg-[#0a141e26] px-8 py-4 shadow-lg backdrop-blur-2xl border-b border-[rgba(255,255,255,0.12)] border-t-2 border-t-brand-600 mobile:hidden">
            <a href="/" aria-label="HOLD home" className="text-[#eaf6ffff] hover:text-brand-ffb703 transition">
              <Wordmark className="h-5 w-auto" />
            </a>
            <Button
              className="hover:shadow-[0_0_28px_rgba(255,183,3,0.5)] inline-flex items-center px-6 py-3 rounded-xl text-black font-['Inter'] font-[700] bg-brand-ffb703 transition-all duration-300"
              onClick={() => (window.location.href = "/#waitlist")}
            >
              Join Beta
            </Button>
          </div>
        </div>

        {/* ==== CONTENT ==== */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex w-full max-w-[900px] flex-col gap-8 px-4 sm:px-6 md:px-8 py-16 md:py-24"
        >
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-['Inter'] font-[700] -tracking-[0.05em] leading-tight text-[#eaf6ffff]">
              eSIM Terms of Sale
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last reviewed: August 9, 2026
            </p>
          </div>

          {/* The one thing a buyer needs before any clause: who is on the other
              side of this purchase. */}
          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <p className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed">
              You are buying a mobile data plan from HIHODL TECHNOLOGIES OÜ, an
              Estonian company (registry code 17460059). We are the seller: our
              price, our receipt, our refund. The network your phone connects to
              is not ours — it is run by our connectivity partner eSIM Go and the
              mobile operators they work with in each country. These terms cover
              what we owe you. Where something is decided by the operator rather
              than by us, this page says so.
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                1. What you are buying
              </h2>
              <p className="text-[#94a3b8ff]">
                A data-only eSIM: a digital SIM profile that you install on your
                phone and that gives you mobile data in the destination you chose,
                up to the allowance and for the validity period shown on the plan
                before you paid.
              </p>
              <p className="text-[#94a3b8ff]">
                Data only means data only. There is no phone number attached, so
                you cannot make or receive normal calls or SMS on it — including
                SMS one-time codes from your bank. Apps that work over data (calls
                in messaging apps, email, maps, HOLD itself) work normally. Your
                existing SIM keeps your number and stays where it is; an eSIM sits
                alongside it.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                2. Your phone has to be able to take it
              </h2>
              <p className="text-[#94a3b8ff]">
                Two conditions, both about your device and neither of which we can
                check for you before you buy: the phone must support eSIM, and it
                must not be carrier-locked. Most phones sold in the last few years
                support eSIM; phones bought on contract from a mobile operator are
                often locked to that operator, and a locked phone will refuse the
                profile even though everything else worked.
              </p>
              <p className="text-[#94a3b8ff]">
                If the profile cannot be installed on your device, you get your
                money back. See section 7.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                3. Coverage, speed and fair use
              </h2>
              <p className="text-[#94a3b8ff]">
                Coverage is whatever the local operators provide where you
                physically are. We show you which country or region a plan covers;
                we cannot promise a signal at a given address, a given speed, or a
                given generation of network. Rural areas, buildings, borders and
                busy events all change what you get, and none of them are things
                we control.
              </p>
              <p className="text-[#94a3b8ff]">
                Speeds are set by the operator and by the plan. Where a plan is
                described as unlimited, that refers to the amount of data, not to
                the speed: operators apply fair-use policies and may slow a
                connection down once a threshold is passed. Tethering or hotspot
                use may be restricted on some networks.
              </p>
              <p className="text-[#94a3b8ff]">
                Some destinations are not available at all. Our connectivity
                partner does not operate in every country, and where they do not,
                we have nothing to sell you — the destination simply will not
                appear.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                4. When your plan starts, and when it ends
              </h2>
              <p className="text-[#94a3b8ff]">
                Every plan has a validity period in days, shown before you pay.
                When the clock starts is set by the operator and differs between
                bundles: some begin counting when the profile is assigned to your
                device, others when the device first connects to a network in the
                destination. We do not apply a single rule to all of them, because
                there is not one.
              </p>
              <p className="text-[#94a3b8ff]">
                Your plan ends when the validity period runs out or when the data
                allowance is used up, whichever happens first. Unused data does
                not roll over into another plan, and days left on an expired plan
                are not refundable. HOLD shows the data and the days you have left
                for as long as the plan is live.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                5. What you pay, and how
              </h2>
              <p className="text-[#94a3b8ff]">
                The price you see at checkout is the price you pay. It is shown in
                your display currency and settled from your HOLD balance in USDC;
                where your display currency is not the US dollar, the checkout
                converts at the rate in force at that moment and tells you if that
                rate is not live. There is no separate booking fee, card fee or
                delivery fee. Local taxes, where they apply to a digital service in
                your country, are included in the price shown.
              </p>
              <p className="text-[#94a3b8ff]">
                Payment leaves the account you selected at checkout. If that
                balance is earning yield, the amount needed is taken out of the
                yield position and paid in the same step — you approve once, and
                the rest of the balance keeps earning.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. HiPoints</h2>
              <p className="text-[#94a3b8ff]">
                You can put HiPoints toward a plan at checkout. A point is worth
                the same wherever it is spent, and the checkout shows exactly how
                many points are being applied and what they take off the price
                before you confirm. Points applied to a purchase are spent; if the
                purchase is refunded, the points that were applied go back to your
                balance along with the money.
              </p>
              <p className="text-[#94a3b8ff]">
                Buying a plan also earns points, credited after the order
                completes. Points are a loyalty benefit, not money and not a
                claim on us: they have no cash value and cannot be transferred or
                withdrawn.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Auto-renew</h2>
              <p className="text-[#94a3b8ff]">
                Auto-renew is off unless you turn it on at checkout. When it is on
                and you run out of data before your validity period ends, we buy
                you the same plan once more, at the price you paid — not the price
                on the day — and tell you when we have.
              </p>
              <p className="text-[#94a3b8ff]">
                It renews once and then stops on its own. Operators cap a plan at
                60 days, so a second period is as far as this can go. Turning it on
                authorises us to take that one amount from your wallet when the
                renewal happens, up to that ceiling and no further; the money stays
                in your wallet until then, and you can cancel the arrangement at
                any time before it fires from the plan in HOLD.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                8. Refunds, and your right to change your mind
              </h2>
              <p className="text-[#94a3b8ff]">
                <span className="text-[#eaf6ffff] font-[600]">
                  If it will not install, you get your money back.
                </span>{" "}
                If the profile cannot be installed on your device, or it installs
                and never connects in the destination, contact us and we refund the
                purchase in full, points included. That is the promise the checkout
                makes and it is not conditional on you being right about why.
              </p>
              <p className="text-[#94a3b8ff]">
                <span className="text-[#eaf6ffff] font-[600]">
                  Once data has been used, the plan is not refundable.
                </span>{" "}
                A plan you bought and did not use is refundable while it has not
                started and has not expired — write to us and we will cancel it.
                Poor coverage in a specific spot, a phone that was carrier-locked
                and has since been unlocked, or a trip that did not happen after
                the plan started are not grounds for a refund.
              </p>
              <p className="text-[#94a3b8ff]">
                <span className="text-[#eaf6ffff] font-[600]">
                  The 14-day withdrawal right.
                </span>{" "}
                Under EU consumer law you normally have 14 days to withdraw from a
                distance contract. Digital content supplied immediately is an
                exception: when you confirm a purchase you are asking us to supply
                the eSIM straight away and acknowledging that you lose the 14-day
                right of withdrawal once it has been delivered to you. Everything in
                the two paragraphs above is what we offer regardless, and it does
                not limit any statutory right you have that cannot be waived.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                9. If something goes wrong
              </h2>
              <p className="text-[#94a3b8ff]">
                Talk to us first, not to the operator. That is not a preference,
                it is how this works: we are your support, for installation, for
                coverage, for billing and for refunds, and the operator has no
                relationship with you to act on. Write to{" "}
                <a
                  href="mailto:hello@hihodl.xyz"
                  className="text-brand-ffb703 hover:underline"
                >
                  hello@hihodl.xyz
                </a>{" "}
                with the destination and the date you bought, and we will take it
                up with our partner.
              </p>
              <p className="text-[#94a3b8ff]">
                What we are responsible for is delivering a working plan and
                refunding you when we cannot. We are not responsible for what an
                outage costs you — a missed booking, a missed flight, a call that
                did not connect. Nothing here excludes liability that cannot be
                excluded by law.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                10. Fair use of the service itself
              </h2>
              <p className="text-[#94a3b8ff]">
                These plans are sold for personal use while travelling. Reselling
                them, using them as a permanent home connection, or using them for
                anything unlawful in the country you are in is a reason for us to
                stop supplying you.
              </p>
              <p className="text-[#94a3b8ff]">
                The network also prohibits a specific set of uses, and these reach
                you through us: the connection may not be used to run a GSM
                gateway, a SIM box or an unlicensed signal booster, to send or
                host unlawful or defamatory material, or to provide a commercial
                service of your own on top of it. Doing any of those can get the
                profile cut off by the operator, not just by us.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                11. What the network operator knows about you
              </h2>
              <p className="text-[#94a3b8ff]">
                Buying a data plan means a network somewhere carries your traffic,
                and the operators behind it are required to know who their users
                are. Our connectivity partner can ask us for the identity and
                contact details of the person a specific eSIM belongs to, and we
                are obliged to provide them. We do not hand over anything else,
                and we do not hand over anything at all about people who have not
                bought a plan.
              </p>
              <p className="text-[#94a3b8ff]">
                What passes over the network itself — the sites you visit, the
                apps you use — is between you and the operator carrying it, exactly
                as it is on any mobile network. We do not see it. Our{" "}
                <a href="/privacy" className="text-brand-ffb703 hover:underline">
                  Privacy Policy
                </a>{" "}
                covers everything else we hold.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">
                12. Changes, law, and contact
              </h2>
              <p className="text-[#94a3b8ff]">
                We may update these terms. The version that governs your purchase
                is the one published when you confirmed it, and the date at the top
                of this page tells you when it last changed. These terms sit
                alongside our{" "}
                <a href="/terms" className="text-brand-ffb703 hover:underline">
                  Terms of Service
                </a>{" "}
                and our{" "}
                <a href="/privacy" className="text-brand-ffb703 hover:underline">
                  Privacy Policy
                </a>
                ; where they say different things about a data plan, this page
                wins.
              </p>
              <p className="text-[#94a3b8ff]">
                Estonian law governs this contract, without prejudice to the
                consumer protections of the country you live in. Questions:{" "}
                <a
                  href="mailto:hello@hihodl.xyz"
                  className="text-brand-ffb703 hover:underline"
                >
                  hello@hihodl.xyz
                </a>
                .
              </p>
            </section>
          </div>
        </motion.section>

        {/* ==== FOOTER ==== */}
        <div className="flex w-full flex-col items-center px-4 sm:px-6 md:px-8 py-12 border-t-2 border-[rgba(255,255,255,0.08)] mt-8">
          <div className="flex w-full max-w-[1280px] flex-col items-center gap-6">
            <div className="flex gap-6">
              <a href="/privacy" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Privacy
              </a>
              <a href="/terms" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Terms
              </a>
              <a href="/legal/esim" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                eSIM
              </a>
              <a href="/legal/traveler" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Traveler
              </a>
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2026 HIHODL TECHNOLOGIES OÜ. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
