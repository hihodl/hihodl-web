"use client";

/**
 * /legal/referral-terms — linked from the app's referral promo fine print
 * (`src/features/referral/promo.ts` → `termsUrl`) and 404'd until 2026-08-13.
 *
 * Every number on this page is copied from a live constant, not from a deck:
 *   HIPOINTS.REFERRAL_QUALIFIED_POINTS = 2500   (server/services/hipoints.service.ts)
 *   HIPOINTS.REFERRAL_WELCOME_POINTS   = 1000
 *   HIPOINTS.REFERRAL_QUALIFY_USD      = 50
 *   HIPOINTS.MAX_REFERRAL_AWARDS       = 3
 *   HIPOINTS.EXPIRY_DAYS               = 180
 *   POINT_USD                          = 0.01   (server/services/rewards-economics.ts)
 *   24h code window + 14-day qualification window (server/api/referrals.router.ts)
 *
 * If one of those constants moves, this page moves in the same commit. A terms
 * page that disagrees with the ledger is worse than no terms page, because it is
 * the document a user will hold us to.
 */

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

export default function ReferralTermsPage() {
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
              Referral program terms
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: August 13, 2026
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <p className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed">
              In short: your friend joins with your invite link and makes a swap
              of $50 or more within 14 days, and you both get HiPoints — 2,500
              for you, 1,000 for them. Up to 3 rewarded invites per account. The
              detail is below, and it is the detail our systems actually apply.
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Who can take part</h2>
              <p className="text-[#94a3b8ff]">
                You need a HOLD account in good standing. Every account gets a
                personal invite code and link. You may not refer yourself, and
                you may not create accounts in order to refer them.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. How a referral is registered</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Your friend must be a new HOLD user. An invite code can only be applied within <span className="text-[#eaf6ffff] font-[600]">24 hours</span> of their account being created.</li>
                <li>Each account can be referred once. If a code has already been applied to an account, another cannot replace it.</li>
                <li>Once registered, the referral has <span className="text-[#eaf6ffff] font-[600]">14 days</span> to qualify. After that it expires and no reward is paid to either side.</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. What qualifies</h2>
              <p className="text-[#94a3b8ff]">
                A referral qualifies when your friend completes a single swap in
                the app worth at least{" "}
                <span className="text-[#eaf6ffff] font-[600]">$50</span>, within
                the 14-day window. It has to be one swap of $50 or more, not $50
                added up across several. Signing up, installing the app,
                applying the code, or simply holding a balance does not by
                itself earn anything on either side — we pay both of you for the
                same event, and that event is the one above.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. What each side gets</h2>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-[#94a3b8ff] mb-3">
                  <span className="text-[#eaf6ffff] font-[600]">You (the referrer): </span>
                  2,500 HiPoints per qualified referral.
                </p>
                <p className="text-[#94a3b8ff]">
                  <span className="text-[#eaf6ffff] font-[600]">Your friend: </span>
                  1,000 HiPoints, credited at the same moment.
                </p>
              </div>
              <p className="text-[#94a3b8ff]">
                Both are paid in HiPoints, our rewards balance. HiPoints are not
                money, are not a deposit, are not a financial instrument, cannot
                be bought, sold, transferred between users, or withdrawn as
                cash, and have no value outside HOLD. They are redeemable inside
                the app at a rate of{" "}
                <span className="text-[#eaf6ffff] font-[600]">$0.01 per point</span>.
                Rewards are not a free month of any paid plan — earlier versions
                of this program paid Pro months, and that is no longer how it
                works.
              </p>
              <p className="text-[#94a3b8ff]">
                HiPoints and the places you can spend them are rolling out
                progressively. Points you earn are recorded against your account
                whether or not the balance is visible in your build of the app
                yet.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Caps and expiry</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>A maximum of <span className="text-[#eaf6ffff] font-[600]">3 rewarded referrals</span> per account. Beyond that, referrals can still be registered and can still qualify, but no further referrer reward is paid.</li>
                <li>Awarded points expire <span className="text-[#eaf6ffff] font-[600]">180 days</span> after they are granted if they have not been used. We notify you before they do.</li>
                <li>A promotional round may add its own end date or cap. Where one applies, it is shown in the app next to the offer.</li>
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Abuse</h2>
              <p className="text-[#94a3b8ff]">
                We may withhold or reverse rewards, and suspend participation,
                where we identify self-referral, duplicate or automated account
                creation, funding done solely to trigger a reward and then
                withdrawn, spam or deceptive promotion, or any breach of our{" "}
                <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>.
                Rewards already spent may be recovered as a negative balance.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. Changes</h2>
              <p className="text-[#94a3b8ff]">
                We may change or end the program at any time. Changes apply to
                referrals registered after the change; a referral already
                registered and still inside its 14-day window is settled on the
                terms in force when it was registered. Material changes are
                reflected on this page with a new &quot;Last updated&quot; date.
              </p>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Tax and general</h2>
              <p className="text-[#94a3b8ff]">
                Any tax arising from a reward is yours to handle. This program is
                offered by HIHODL TECHNOLOGIES OÜ and is governed by, and forms
                part of, our{" "}
                <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>.
                Where a term here conflicts with the Terms of Service, this page
                governs for the referral program only. The program is void where
                prohibited by law.
              </p>
              <p className="text-[#94a3b8ff]">
                Questions:{" "}
                <a href="mailto:support@hihodl.xyz" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">support@hihodl.xyz</a>
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
              <a href="/legal/providers" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                Providers
              </a>
              <a href="/e-sign" className="text-[#94a3b8ff] hover:text-brand-ffb703 transition text-sm font-['Inter']">
                E-Sign Consent
              </a>
            </div>
            <span className="font-['Inter'] text-[13px] font-[400] leading-[19px] text-[#94a3b8ff]">
              © 2026 HOLD. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
