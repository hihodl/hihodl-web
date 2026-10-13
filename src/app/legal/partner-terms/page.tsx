"use client";

/**
 * /legal/partner-terms: the HOLD Partners terms every person on a team accepts,
 * the owner when applying and everyone else when joining from an invite.
 *
 * The version is PARTNER_TERMS_VERSION (server/services/partners/partner-rules.ts),
 * kept on each membership with the time it was accepted. A material change
 * means a new date there AND in "Last updated" below, in the same commit.
 *
 * Every number on this page is a live constant in partner-rules.ts:
 *   DEFAULT_SHARE_BPS = 4000          (40% of HOLD's margin, per partner in the desk)
 *   DEFAULT_ATTRIBUTION_MONTHS = 12
 *   payableAfterOf: stay = day after check out, flight = day after last departure,
 *                   eSIM = ESIM_HOLD_DAYS (14) after delivery
 *   PAYOUT_MIN_USDC = 10, PAYOUT_CEILING_USDC = 2500 (a bigger month is paid in parts, pickPayoutRows)
 *   payoutPeriodFor / nextPayoutOn: the 1st of the month pays the month before
 *   clawbackOf: a paid commission on a booking cancelled later comes off the next payout
 *
 * Pending a review by HOLD's counsel in Estonia before PARTNER_PAYOUTS_ENABLED
 * is switched on.
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

export default function PartnerTermsPage() {
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
              HOLD Partners terms
            </h1>
            <p className="text-base sm:text-lg text-[#94a3b8ff] font-['Inter'] font-[400]">
              Last updated: October 13, 2026
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(255,183,3,0.35)] bg-[rgba(255,183,3,0.06)] p-6">
            <p className="text-[#eaf6ffff] font-['Inter'] font-[600] leading-relaxed">
              In short: travellers who sign up through your link are yours for 12 months. You earn a share of HOLD&apos;s
              margin on the stays, flights and eSIMs they book, once the trip has happened. We pay it monthly in USDC into
              your HOLD Savings, after your billing details are checked. If a paid booking is cancelled later, it comes off
              your next payout.
            </p>
          </div>

          <div className="flex flex-col gap-8 text-[#eaf6ffff] font-['Inter'] font-[400] leading-relaxed">
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">1. Who can be a partner</h2>
              <p className="text-[#94a3b8ff]">
                HOLD Partners is for travel agencies, creators, event organisers and other teams who bring travellers to HOLD. You apply from your HOLD account and we review every application by hand. Your partner account starts when we approve it, and we may decline an application without giving a reason.
              </p>
              <p className="text-[#94a3b8ff]">
                Every person on a partner team signs in with their own HOLD account and accepts these terms when they join. The person who applied is the owner and is responsible for the team.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">2. Who your travellers are</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>A traveller is yours when they create a HOLD account through your link, your QR code or one of your trip invites, or enter your code when they sign up.</li>
                <li>They stay yours for <span className="text-[#eaf6ffff] font-[600]">12 months</span> from that day, unless your terms in the desk say otherwise. Bookings they make in that window count for you.</li>
                <li>A traveller belongs to one partner only. The first link they sign up through decides it, and it cannot be moved afterwards.</li>
                <li>Bookings made by you or by anyone on your team never count, and neither do accounts created to book for yourself.</li>
              </ul>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">3. What you earn</h2>
              <p className="text-[#94a3b8ff]">
                You earn a share of <span className="text-[#eaf6ffff] font-[600]">HOLD&apos;s margin</span> on the stays, flights and eSIMs your travellers book and pay for in HOLD. It is never a share of the price. The default share is <span className="text-[#eaf6ffff] font-[600]">40%</span>; the share agreed for your account is always shown in your desk under Settings, and it is the one that applies.
              </p>
              <p className="text-[#94a3b8ff]">
                The margin is what HOLD keeps on the booking, after anything we give back to the traveller on it, such as cashback. Your travellers always pay HOLD&apos;s normal prices. Nothing is added to them because they came through you.
              </p>
              <p className="text-[#94a3b8ff]">
                A traveller who earns you commission does not also earn you HiPoints from the standard referral program, so the same person is never paid for twice. They still get their own welcome points.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">4. When a commission is earned</h2>
              <p className="text-[#94a3b8ff]">
                A commission is pending until the booking can no longer be cancelled by the traveller, and earned after that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>A stay: the day after check out.</li>
                <li>A flight: the day after the last departure on the booking.</li>
                <li>An eSIM: <span className="text-[#eaf6ffff] font-[600]">14 days</span> after it is delivered.</li>
              </ul>
              <p className="text-[#94a3b8ff]">
                A booking cancelled or refunded while it is pending earns nothing.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">5. Payouts</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>On the <span className="text-[#eaf6ffff] font-[600]">1st of each month</span> we pay what you earned in the month before, in <span className="text-[#eaf6ffff] font-[600]">USDC</span>, into the HOLD Savings of the person being paid.</li>
                <li>A payout under <span className="text-[#eaf6ffff] font-[600]">$10</span> is not sent. It carries over to the next month.</li>
                <li>We pay only once your billing details (your name or company, address, country and tax ID) are filled in under Settings and checked by HOLD. Until then your commissions keep adding up and nothing is lost.</li>
                <li>A month above <span className="text-[#eaf6ffff] font-[600]">$2,500</span> is paid in parts: up to $2,500 now, the rest with the next payouts.</li>
                <li>A team can be paid in one of two ways, chosen by its owner: everything to the owner, or each member paid their agreed part of the commission on their own travellers straight into their own Savings, with the rest to the owner.</li>
                <li>Each payout comes with a statement in your desk. The statement is not a tax invoice.</li>
              </ul>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">6. Cancellations after a payout</h2>
              <p className="text-[#94a3b8ff]">
                If a booking is cancelled or refunded after its commission was paid, the same amount comes off the next payout of the person who was paid it. Your desk shows it as a clawback line. If there is not enough to cover it, it carries over until there is.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">7. How you promote HOLD</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-[#94a3b8ff]">
                <li>Say clearly that you earn from HOLD. On social media that means marking the post as an ad or paid partnership (<span className="text-[#eaf6ffff] font-[600]">#ad</span>), as the rules of the platform and of your country require.</li>
                <li>Do not promise returns, prices or availability HOLD has not published, and do not present yourself as HOLD or speak on HOLD&apos;s behalf.</li>
                <li>No spam, no bought traffic, no fake accounts, and no ads bidding on the HOLD name.</li>
                <li>Follow the advertising and consumer law of every country you promote in.</li>
              </ul>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">8. Your team</h2>
              <p className="text-[#94a3b8ff]">
                Owners and admins can invite people, set their part of the commission and remove them. Anyone can leave a team from Settings; what they earned until then is still paid. The owner can hand the team to another member. The travellers they brought stay with the team, and the commission on them goes to the owner from that day.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">9. Tax</h2>
              <p className="text-[#94a3b8ff]">
                You are responsible for declaring what you earn and for any tax, VAT or social contributions on it in your country. HOLD may ask for more information before paying, and may withhold or report where the law requires it.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">10. Suspension and abuse</h2>
              <p className="text-[#94a3b8ff]">
                We may pause or close a partner account, withhold commissions that are not yet paid, and recover commissions already paid, where we find self booking, fake or bought sign ups, misleading promotion, a breach of these terms or of our <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>, or anything the law does not allow. A paused account keeps what it earned honestly before the pause.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">11. Changes</h2>
              <p className="text-[#94a3b8ff]">
                We may change or end the program. Changes apply from the day they are published on this page with a new &quot;Last updated&quot; date. Bookings already made are settled on the terms in force when they were made.
              </p>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-[700] text-[#eaf6ffff]">12. General</h2>
              <p className="text-[#94a3b8ff]">
                HOLD Partners is offered by HIHODL TECHNOLOGIES OÜ and forms part of our <a href="/terms" className="text-brand-ffb703 underline underline-offset-2 hover:opacity-80 transition">Terms of Service</a>. Where a term here conflicts with the Terms of Service, this page governs for HOLD Partners only. Nothing here makes you an employee, agent or representative of HOLD.
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
